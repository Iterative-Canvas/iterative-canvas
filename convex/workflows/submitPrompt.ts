import { workflow } from "../workflow"
import { internal } from "../_generated/api"
import { v } from "convex/values"

/**
 * The Submit Prompt workflow orchestrates the core user interaction:
 * 1. Generate an LLM response (with streaming persistence) via sub-workflow
 * 2. Run all evals against the response (in parallel) via sub-workflow
 *
 * This is implemented as a composite durable workflow using ctx.runWorkflow
 * to compose reusable sub-workflows. This enables:
 * - Proper retry and failure isolation for each sub-workflow
 * - The same sub-workflows can be invoked standalone (e.g., "Run All" evals)
 * - Clear separation of concerns
 */
export const submitPromptWorkflow = workflow.define({
  args: {
    versionId: v.id("canvasVersions"),
    skipEvals: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { versionId, skipEvals }): Promise<null> => {
    // =========================================================================
    // Step 1: Run GenerateResponseWorkflow as sub-workflow
    // =========================================================================
    const genResult = await ctx.runWorkflow(
      internal.workflows.generateResponse.generateResponseWorkflow,
      { versionId, skipEvals },
    )

    // If generation failed or was cancelled, stop here
    if (!genResult.success || genResult.cancelled) {
      if (genResult.cancelled) {
        console.log("Generation was cancelled, skipping evals")
      }
      return null
    }

    // =========================================================================
    // Step 2: Run RunEvalsWorkflow as sub-workflow (unless skipped)
    // =========================================================================
    if (skipEvals) {
      console.log("Evals skipped as requested")
      return null
    }

    // Get the generated response
    // Note: Evals are already marked as running by finalizeResponse for faster UI feedback
    const response = await ctx.runQuery(
      internal.internal.queries.getVersionResponse,
      { versionId },
    )

    if (!response) {
      // No response to evaluate (shouldn't happen if generation succeeded)
      console.warn("No response found to evaluate")
      return null
    }

    // Run evals as a sub-workflow
    await ctx.runWorkflow(internal.workflows.runEvals.runEvalsWorkflow, {
      versionId,
      response,
    })

    return null
  },
})
