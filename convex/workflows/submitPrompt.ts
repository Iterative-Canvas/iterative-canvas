import { workflow } from "../workflow"
import { internal } from "../_generated/api"
import { v } from "convex/values"
import { Id } from "../_generated/dataModel"

/**
 * The Submit Prompt workflow orchestrates the core user interaction:
 * 1. Generate an LLM response (with streaming persistence)
 * 2. Run all evals against the response (in parallel)
 * 3. Compute aggregate scoring
 *
 * This is implemented as a durable workflow to ensure reliability:
 * - Survives server restarts
 * - Provides retry behavior for transient failures
 * - Can be canceled if needed
 * - Status can be observed reactively
 */
export const submitPromptWorkflow = workflow.define({
  args: {
    versionId: v.id("canvasVersions"),
    skipEvals: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { versionId, skipEvals }): Promise<null> => {
    // =========================================================================
    // Step 1: Generate LLM Response
    // =========================================================================
    try {
      await ctx.runAction(
        internal.actions.generateResponse.generateResponse,
        { versionId },
        { retry: true } // Retry on transient failures (max 3 attempts)
      )
    } catch (error) {
      // All retries exhausted — now we set the final error state
      const message = error instanceof Error ? error.message : "Unknown error"
      console.error("Response generation failed after all retries:", message)

      await ctx.runMutation(internal.internal.mutations.updateResponseStatus, {
        versionId,
        status: "error",
        error: message,
      })
      return null
    }

    // =========================================================================
    // Step 2: Run Evals (unless skipped or generation was cancelled)
    // =========================================================================
    if (skipEvals) {
      return null
    }

    // Check if generation was cancelled by the user
    const cancelledAt = await ctx.runQuery(
      internal.internal.queries.checkGenerationCancelled,
      { versionId }
    )
    if (cancelledAt !== null) {
      console.log("Generation was cancelled, skipping evals")
      return null
    }

    // Load response and evals
    const versionData = await ctx.runQuery(
      internal.internal.queries.getVersionWithResponseAndEvals,
      { versionId }
    )

    if (!versionData.response) {
      // No response to evaluate (shouldn't happen if generation succeeded)
      console.warn("No response found to evaluate")
      return null
    }

    // Filter to evals that have criteria defined
    type EvalDef = (typeof versionData.evals)[number]
    const evalsToRun = versionData.evals.filter(
      (e: EvalDef) => e.eval && e.eval.trim().length > 0
    )

    if (evalsToRun.length === 0) {
      // No evals to run, mark as complete
      await ctx.runMutation(internal.internal.mutations.updateEvalsStatus, {
        versionId,
        status: "complete",
      })
      return null
    }

    // Mark evals as running
    await ctx.runMutation(internal.internal.mutations.updateEvalsStatus, {
      versionId,
      status: "running",
    })

    // Run all evals in parallel
    const evalPromises = evalsToRun.map((evalDef: EvalDef) =>
      ctx.runAction(
        internal.actions.runSingleEval.runSingleEval,
        {
          evalId: evalDef._id as Id<"evals">,
          response: versionData.response!,
        },
        { retry: true }
      )
    )

    await Promise.all(evalPromises)

    // =========================================================================
    // Step 3: Compute Aggregate Score
    // =========================================================================
    await ctx.runMutation(internal.internal.mutations.computeAggregateScore, {
      versionId,
    })

    return null
  },
})

