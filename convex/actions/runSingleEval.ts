"use node"

import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { gateway } from "@ai-sdk/gateway"
import { generateObject } from "ai"
import { z } from "zod"
import { v } from "convex/values"

// Schema for pass/fail eval response
const PassFailResultSchema = z.object({
  passed: z
    .boolean()
    .describe("Whether the response satisfies the evaluation criteria"),
  explanation: z
    .string()
    .describe(
      "A brief explanation of why the response passed or failed the criteria"
    ),
})

// Schema for subjective eval response
const SubjectiveResultSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "A score from 0 to 1 indicating how well the response meets the criteria"
    ),
  explanation: z
    .string()
    .describe("A brief explanation justifying the score given"),
})

/**
 * Build the prompt for the LLM-as-judge evaluation.
 */
function buildEvalPrompt(
  evalCriteria: string,
  response: string,
  evalType: "pass_fail" | "subjective"
): string {
  const typeInstructions =
    evalType === "pass_fail"
      ? "Determine if the response PASSES or FAILS the criteria. A response passes only if it fully satisfies the requirements."
      : "Rate the response on a scale from 0 to 1, where 0 means the response completely fails to meet the criteria and 1 means it perfectly satisfies them."

  return `You are an expert evaluator assessing whether an LLM response meets specific criteria.

## Evaluation Criteria
${evalCriteria}

## Response to Evaluate
${response}

## Instructions
${typeInstructions}

Provide a clear, concise explanation for your assessment.`
}

/**
 * Run a single eval against a response using LLM-as-judge.
 */
export const runSingleEval = internalAction({
  args: {
    evalId: v.id("evals"),
    response: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    { evalId, response }
  ): Promise<{ success: boolean; error?: string }> => {
    // 1. Load eval definition
    const evalDef = await ctx.runQuery(internal.internal.queries.getEvalById, {
      evalId,
    })

    if (!evalDef.eval || evalDef.eval.trim().length === 0) {
      // No eval criteria defined, mark as complete with neutral score
      await ctx.runMutation(internal.internal.mutations.updateEvalResult, {
        evalId,
        status: "complete",
        score: evalDef.type === "pass_fail" ? 1 : 0.5,
        explanation: "No evaluation criteria defined",
      })
      return { success: true }
    }

    // 2. Mark eval as running
    await ctx.runMutation(internal.internal.mutations.updateEvalStatus, {
      evalId,
      status: "running",
    })

    try {
      const model = gateway(evalDef.modelId)

      if (evalDef.type === "pass_fail") {
        const result = await generateObject({
          model,
          schema: PassFailResultSchema,
          prompt: buildEvalPrompt(evalDef.eval, response, "pass_fail"),
        })

        await ctx.runMutation(internal.internal.mutations.updateEvalResult, {
          evalId,
          score: result.object.passed ? 1 : 0,
          explanation: result.object.explanation,
          status: "complete",
        })
      } else {
        // subjective
        const result = await generateObject({
          model,
          schema: SubjectiveResultSchema,
          prompt: buildEvalPrompt(evalDef.eval, response, "subjective"),
        })

        await ctx.runMutation(internal.internal.mutations.updateEvalResult, {
          evalId,
          score: result.object.score,
          explanation: result.object.explanation,
          status: "complete",
        })
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      console.error(`Error running eval ${evalId}:`, message)

      await ctx.runMutation(internal.internal.mutations.updateEvalResult, {
        evalId,
        status: "error",
        error: message,
      })

      return { success: false, error: message }
    }
  },
})

