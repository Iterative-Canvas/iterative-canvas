import { workflow } from "../workflow"
import { internal } from "../_generated/api"
import { v } from "convex/values"

/**
 * GenerateResponseWorkflow - Handles LLM response generation with streaming.
 *
 * This workflow:
 * 1. Runs the generateResponse action (which streams and persists chunks)
 * 2. Handles retries on transient failures
 * 3. Sets final error state if all retries fail
 * 4. Returns whether generation succeeded and whether it was cancelled
 *
 * Can be run standalone or as a sub-workflow of SubmitPromptWorkflow.
 */
export const generateResponseWorkflow = workflow.define({
  args: {
    versionId: v.id("canvasVersions"),
    skipEvals: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    cancelled: v.boolean(),
  }),
  handler: async (
    ctx,
    { versionId, skipEvals }
  ): Promise<{ success: boolean; cancelled: boolean }> => {
    // Run the generateResponse action with retry
    try {
      await ctx.runAction(
        internal.actions.generateResponse.generateResponse,
        { versionId, skipEvals },
        { retry: true } // Retry on transient failures (max 3 attempts)
      )
    } catch (error) {
      // All retries exhausted — set final error state
      const message = error instanceof Error ? error.message : "Unknown error"
      console.error("Response generation failed after all retries:", message)

      await ctx.runMutation(internal.internal.mutations.updateResponseStatus, {
        versionId,
        status: "error",
        error: message,
      })

      return { success: false, cancelled: false }
    }

    // Check if generation was cancelled by the user
    const cancelledAt = await ctx.runQuery(
      internal.internal.queries.checkGenerationCancelled,
      { versionId }
    )

    return {
      success: true,
      cancelled: cancelledAt !== null,
    }
  },
})

