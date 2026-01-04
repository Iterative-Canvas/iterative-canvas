"use node"

import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { gateway } from "@ai-sdk/gateway"
import { generateText, Output } from "ai"
import { z } from "zod"
import { v } from "convex/values"
import { compileFullPromptContext } from "../lib"

// Schema for the name generation response
const CanvasNameSchema = z.object({
  name: z
    .string()
    .describe(
      "A concise, descriptive name for the canvas based on the prompt content. Should be 2-6 words, clear, and capture the main topic or purpose."
    ),
})

/**
 * Generate a concise canvas name from the prompt content using an LLM.
 *
 * This is called once when a user submits a prompt for the first time
 * on a newly created canvas that doesn't have a name yet.
 *
 * Uses the same compiled prompt context (user prompt + eval requirements)
 * that's sent for the main LLM response generation.
 */
export const generateCanvasName = internalAction({
  args: {
    canvasId: v.id("canvases"),
    versionId: v.id("canvasVersions"),
  },
  returns: v.null(),
  handler: async (ctx, { canvasId, versionId }): Promise<null> => {
    // Load the version data (same query used by generateResponse)
    const versionData = await ctx.runQuery(
      internal.internal.queries.getVersionForGeneration,
      { versionId }
    )

    if (!versionData.prompt) {
      console.log("No prompt to generate name from")
      return null
    }

    // Compile the full prompt context (user prompt + eval requirements)
    const fullPromptContext = compileFullPromptContext(
      versionData.prompt,
      versionData.evals
    )

    // Use a fast, cheap model for name generation
    const model = gateway("openai/gpt-4o-mini")

    try {
      const { output } = await generateText({
        model,
        prompt: `Based on the following prompt context, generate a concise and descriptive name (2-6 words) that captures the main topic or purpose. The name should be clear and professional.

${fullPromptContext.slice(0, 3000)}${fullPromptContext.length > 3000 ? "..." : ""}

Generate a fitting name for this canvas.`,
        output: Output.object({ schema: CanvasNameSchema }),
      })

      // Truncate name to 75 characters (matching existing validation)
      const truncatedName = output.name.slice(0, 75)

      // Update the canvas name
      await ctx.runMutation(internal.internal.mutations.setCanvasName, {
        canvasId,
        name: truncatedName,
      })

      console.log(`Generated canvas name: "${truncatedName}" for canvas ${canvasId}`)
    } catch (error) {
      // Log the error but don't fail the workflow - the canvas just keeps no name
      console.error("Failed to generate canvas name:", error)
    }

    return null
  },
})

