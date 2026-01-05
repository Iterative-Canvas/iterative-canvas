import { workflow } from "../workflow"
import { internal } from "../_generated/api"
import { v } from "convex/values"

/**
 * RunEvalsWorkflow - Runs all evals in parallel against a response.
 *
 * This workflow:
 * 1. Marks evalsStatus as "running" on the canvas version
 * 2. Marks individual evals as "running" (preserving existing scores)
 * 3. Runs all eval actions in parallel with retry
 * 4. Aggregate computation happens in updateEvalResult when last eval settles
 *
 * Can be run standalone (via "Run All" button or Canvas save) or as a
 * sub-workflow of SubmitPromptWorkflow.
 */
export const runEvalsWorkflow = workflow.define({
  args: {
    versionId: v.id("canvasVersions"),
    response: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { versionId, response }): Promise<null> => {
    // =========================================================================
    // Step 1: Mark evals as running
    // =========================================================================
    // Update overall evalsStatus and mark individual evals as running
    await ctx.runMutation(internal.internal.mutations.updateEvalsStatus, {
      versionId,
      status: "running",
    })

    // Get evals to run and mark them as running (preserving scores)
    const evalsToRun = await ctx.runMutation(
      internal.internal.mutations.markEvalsAsRunning,
      { versionId },
    )

    if (evalsToRun.length === 0) {
      // No evals to run, mark as complete
      await ctx.runMutation(internal.internal.mutations.updateEvalsStatus, {
        versionId,
        status: "complete",
      })
      return null
    }

    // =========================================================================
    // Step 2: Run all evals in parallel with retry
    // =========================================================================
    const evalPromises = evalsToRun.map((evalDef) =>
      ctx.runAction(
        internal.actions.runSingleEval.runSingleEval,
        {
          evalId: evalDef._id,
          response,
        },
        { retry: true }, // Retry on transient failures
      ),
    )

    // Wait for all evals to complete
    // Note: updateEvalResult will compute aggregate when the last eval finishes
    await Promise.all(evalPromises)

    return null
  },
})
