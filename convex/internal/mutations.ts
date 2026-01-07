import { internalMutation } from "../_generated/server"
import { internal } from "../_generated/api"
import { v } from "convex/values"
import { vWorkflowId } from "@convex-dev/workflow"
import { EVAL_DEFAULTS, EVAL_AGGREGATE_DEFAULTS } from "../lib"

// Validator for workflow result (matches the shape from @convex-dev/workflow)
const vResultValidator = v.union(
  v.object({
    kind: v.literal("success"),
    returnValue: v.any(),
  }),
  v.object({
    kind: v.literal("failed"),
    error: v.string(),
  }),
  v.object({
    kind: v.literal("canceled"),
  }),
)

/**
 * Save a response chunk during streaming generation.
 */
export const saveResponseChunk = internalMutation({
  args: {
    versionId: v.id("canvasVersions"),
    content: v.string(),
    chunkIndex: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { versionId, content, chunkIndex }) => {
    await ctx.db.insert("responseChunks", {
      canvasVersionId: versionId,
      content,
      chunkIndex,
    })
    return null
  },
})

/**
 * Clear all response chunks for a version.
 * Used both before starting new generation (defensive) and after finalization (cleanup).
 */
export const clearResponseChunks = internalMutation({
  args: { versionId: v.id("canvasVersions") },
  returns: v.null(),
  handler: async (ctx, { versionId }) => {
    const chunks = await ctx.db
      .query("responseChunks")
      .withIndex("canvasVersionId_chunkIndex", (q) =>
        q.eq("canvasVersionId", versionId),
      )
      .collect()

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id)
    }
    return null
  },
})

/**
 * Record an error during generation (called before throwing to trigger workflow retry).
 * This allows the frontend to show "retrying" toasts while status remains "generating".
 */
export const recordRetryError = internalMutation({
  args: {
    versionId: v.id("canvasVersions"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { versionId, error }) => {
    await ctx.db.patch(versionId, {
      responseError: error,
      responseErrorAt: Date.now(),
    })
    return null
  },
})

/**
 * Update the response generation status.
 */
export const updateResponseStatus = internalMutation({
  args: {
    versionId: v.id("canvasVersions"),
    status: v.union(
      v.literal("idle"),
      v.literal("generating"),
      v.literal("complete"),
      v.literal("error"),
    ),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { versionId, status, error }) => {
    const updates: {
      responseStatus: "idle" | "generating" | "complete" | "error"
      responseError?: string
      responseCompletedAt?: number
      responseModifiedAt?: number
    } = {
      responseStatus: status,
    }

    if (error !== undefined) {
      updates.responseError = error
    }

    if (status === "complete" || status === "error") {
      updates.responseCompletedAt = Date.now()
      updates.responseModifiedAt = Date.now()
    }

    await ctx.db.patch(versionId, updates)
    return null
  },
})

/**
 * Consolidate response chunks into the final response field and clean up chunks.
 * If there are no chunks (e.g., early cancellation), preserve the existing response.
 *
 * When prepareEvals is true and there's a successful response that wasn't cancelled,
 * this also marks evals as running immediately for faster UI feedback.
 *
 * After consolidation, all response chunks are deleted to free up storage.
 */
export const finalizeResponse = internalMutation({
  args: {
    versionId: v.id("canvasVersions"),
    prepareEvals: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { versionId, prepareEvals }) => {
    const version = await ctx.db.get(versionId)
    if (!version) throw new Error(`Version ${versionId} not found`)

    // Get all chunks in order
    const chunks = await ctx.db
      .query("responseChunks")
      .withIndex("canvasVersionId_chunkIndex", (q) =>
        q.eq("canvasVersionId", versionId),
      )
      .collect()

    // Sort by chunkIndex and concatenate
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex)
    const fullResponse = chunks.map((c) => c.content).join("")

    // If there are no chunks (early cancellation), preserve the existing response
    // Only update the response if we actually have new content
    const updates: {
      response?: string
      responseStatus: "complete"
      responseCompletedAt: number
      responseModifiedAt?: number
      responseError: undefined
      responseErrorAt: undefined
      evalsStatus?: "running"
    } = {
      responseStatus: "complete",
      responseCompletedAt: Date.now(),
      responseError: undefined,
      responseErrorAt: undefined,
    }

    if (fullResponse.length > 0) {
      updates.response = fullResponse
      updates.responseModifiedAt = Date.now()
    }

    // If prepareEvals is requested and we have a response and weren't cancelled,
    // mark evals as running for faster UI feedback
    const wasCancelled = version.generationCancelledAt !== undefined
    const hasResponse =
      fullResponse.length > 0 ||
      (version.response && version.response.length > 0)

    if (prepareEvals && hasResponse && !wasCancelled) {
      updates.evalsStatus = "running"

      // Also mark individual evals as running
      const evals = await ctx.db
        .query("evals")
        .withIndex("canvasVersionId", (q) => q.eq("canvasVersionId", versionId))
        .collect()

      const evalsWithCriteria = evals.filter(
        (e) => e.eval && e.eval.trim().length > 0,
      )

      for (const evalRecord of evalsWithCriteria) {
        await ctx.db.patch(evalRecord._id, { status: "running" })
      }
    }

    await ctx.db.patch(versionId, updates)

    // Schedule background cleanup of response chunks (non-blocking)
    await ctx.scheduler.runAfter(
      0,
      internal.internal.mutations.clearResponseChunks,
      {
        versionId,
      },
    )

    return null
  },
})

/**
 * Update the aggregate evals status.
 */
export const updateEvalsStatus = internalMutation({
  args: {
    versionId: v.id("canvasVersions"),
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("complete"),
      v.literal("error"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { versionId, status }) => {
    const updates: {
      evalsStatus: "idle" | "running" | "complete" | "error"
      evalsCompletedAt?: number
    } = {
      evalsStatus: status,
    }

    if (status === "complete" || status === "error") {
      updates.evalsCompletedAt = Date.now()
    }

    await ctx.db.patch(versionId, updates)
    return null
  },
})

/**
 * Update an individual eval's status (for marking as running).
 * NOTE: This preserves existing score/explanation - only updates status.
 */
export const updateEvalStatus = internalMutation({
  args: {
    evalId: v.id("evals"),
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("complete"),
      v.literal("error"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { evalId, status }) => {
    await ctx.db.patch(evalId, { status })
    return null
  },
})

/**
 * Mark all evals for a version as running (preserving scores).
 * Used at the start of RunEvalsWorkflow to indicate evals are in progress.
 */
export const markEvalsAsRunning = internalMutation({
  args: {
    versionId: v.id("canvasVersions"),
  },
  returns: v.array(
    v.object({
      _id: v.id("evals"),
      eval: v.optional(v.string()),
      modelId: v.optional(v.string()),
      type: v.union(v.literal("pass_fail"), v.literal("subjective")),
      isRequired: v.boolean(),
      weight: v.number(),
      threshold: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, { versionId }) => {
    const evals = await ctx.db
      .query("evals")
      .withIndex("canvasVersionId", (q) => q.eq("canvasVersionId", versionId))
      .collect()

    // Filter to evals with criteria and mark them as running
    const evalsWithCriteria = evals.filter(
      (e) => e.eval && e.eval.trim().length > 0,
    )

    for (const evalRecord of evalsWithCriteria) {
      // Only update status to running - preserve score/explanation
      await ctx.db.patch(evalRecord._id, { status: "running" })
    }

    // Resolve model IDs and return
    const result = await Promise.all(
      evalsWithCriteria.map(async (e) => {
        let modelId: string | undefined
        if (e.modelId) {
          const model = await ctx.db.get(e.modelId)
          modelId = model?.modelId
        }
        return {
          _id: e._id,
          eval: e.eval,
          modelId,
          type: e.type,
          isRequired: e.isRequired,
          weight: e.weight,
          threshold: e.threshold,
        }
      }),
    )

    return result
  },
})

/**
 * Update an individual eval's result after execution.
 * When an eval completes, check if all evals for that version are "settled"
 * and if so, compute the aggregate score.
 *
 * An eval is "settled" when: status === "complete" AND score !== undefined
 * An eval is "unsettled" when:
 *   - status === "running", OR
 *   - status === "idle" with score === undefined (never run), OR
 *   - status === "error" with score === undefined (failed with no prior result)
 *
 * If any eval is unsettled, aggregate is set to undefined (indeterminate).
 */
export const updateEvalResult = internalMutation({
  args: {
    evalId: v.id("evals"),
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("complete"),
      v.literal("error"),
    ),
    score: v.optional(v.number()),
    explanation: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { evalId, status, score, explanation, error }) => {
    const evalRecord = await ctx.db.get(evalId)
    if (!evalRecord) throw new Error(`Eval ${evalId} not found`)

    const updates: {
      status: "idle" | "running" | "complete" | "error"
      score?: number
      explanation?: string
      error?: string
      completedAt?: number
    } = { status }

    if (score !== undefined) updates.score = score
    if (explanation !== undefined) updates.explanation = explanation
    if (error !== undefined) updates.error = error
    if (status === "complete" || status === "error") {
      updates.completedAt = Date.now()
    }

    await ctx.db.patch(evalId, updates)

    // If this eval just completed, check if all evals for this version are settled
    if (status === "complete" || status === "error") {
      const version = await ctx.db.get(evalRecord.canvasVersionId)
      if (!version) return null

      // Get all evals for this version
      const allEvals = await ctx.db
        .query("evals")
        .withIndex("canvasVersionId", (q) =>
          q.eq("canvasVersionId", evalRecord.canvasVersionId),
        )
        .collect()

      // Filter to evals with criteria defined
      const evalsWithCriteria = allEvals.filter(
        (e) => e.eval && e.eval.trim().length > 0,
      )

      // Check if all evals are "settled"
      // Settled: status === "complete" AND score !== undefined
      const isSettled = (e: (typeof evalsWithCriteria)[0]) =>
        e.status === "complete" && e.score !== undefined

      const allSettled = evalsWithCriteria.every(isSettled)

      if (allSettled) {
        // All evals settled - compute aggregate score
        const settledEvals = evalsWithCriteria // All are settled at this point

        if (settledEvals.length === 0) {
          await ctx.db.patch(evalRecord.canvasVersionId, {
            evalsStatus: "complete",
            evalsCompletedAt: Date.now(),
            aggregateScore: undefined,
            isSuccessful: undefined,
            activeWorkflowId: undefined,
          })
        } else {
          // Calculate weighted average
          let totalWeight = 0
          let weightedSum = 0

          for (const e of settledEvals) {
            totalWeight += e.weight
            weightedSum += e.weight * e.score!
          }

          const aggregateScore = totalWeight > 0 ? weightedSum / totalWeight : 0

          // Check if all required evals passed
          const requiredEvals = evalsWithCriteria.filter((e) => e.isRequired)
          const allRequiredPassed = requiredEvals.every((e) => {
            if (e.score === undefined) return false
            if (e.type === "pass_fail") {
              return e.score === 1
            } else {
              const threshold = e.threshold ?? EVAL_DEFAULTS.subjectiveThreshold
              return e.score >= threshold
            }
          })

          const successThreshold =
            version.successThreshold ?? EVAL_AGGREGATE_DEFAULTS.successThreshold
          const isSuccessful =
            aggregateScore >= successThreshold && allRequiredPassed

          await ctx.db.patch(evalRecord.canvasVersionId, {
            evalsStatus: "complete",
            evalsCompletedAt: Date.now(),
            aggregateScore,
            isSuccessful,
            activeWorkflowId: undefined,
          })
        }
      } else {
        // Some evals are unsettled - set aggregate to indeterminate
        // Only update if we're in a running state (to avoid clobbering during idle)
        if (version.evalsStatus === "running") {
          await ctx.db.patch(evalRecord.canvasVersionId, {
            aggregateScore: undefined,
            isSuccessful: undefined,
          })
        }
      }
    }

    return null
  },
})

/**
 * Compute the aggregate score from all evals and determine overall success.
 * Only computes aggregate if all evals are "settled" (complete with score).
 * If any eval is unsettled, sets aggregate to undefined (indeterminate).
 */
export const computeAggregateScore = internalMutation({
  args: { versionId: v.id("canvasVersions") },
  returns: v.null(),
  handler: async (ctx, { versionId }) => {
    const version = await ctx.db.get(versionId)
    if (!version) throw new Error(`Version ${versionId} not found`)

    const evals = await ctx.db
      .query("evals")
      .withIndex("canvasVersionId", (q) => q.eq("canvasVersionId", versionId))
      .collect()

    // Filter to evals with criteria defined
    const evalsWithCriteria = evals.filter(
      (e) => e.eval && e.eval.trim().length > 0,
    )

    // Check if all evals are "settled" (complete with score)
    const isSettled = (e: (typeof evalsWithCriteria)[0]) =>
      e.status === "complete" && e.score !== undefined

    const allSettled = evalsWithCriteria.every(isSettled)

    if (!allSettled) {
      // Some evals are unsettled - set aggregate to indeterminate
      await ctx.db.patch(versionId, {
        aggregateScore: undefined,
        isSuccessful: undefined,
        activeWorkflowId: undefined,
      })
      return null
    }

    // All evals are settled - compute aggregate
    if (evalsWithCriteria.length === 0) {
      await ctx.db.patch(versionId, {
        evalsStatus: "complete",
        evalsCompletedAt: Date.now(),
        aggregateScore: undefined,
        isSuccessful: undefined,
        activeWorkflowId: undefined,
      })
      return null
    }

    // Calculate weighted average
    let totalWeight = 0
    let weightedSum = 0

    for (const evalRecord of evalsWithCriteria) {
      const weight = evalRecord.weight
      const score = evalRecord.score!
      totalWeight += weight
      weightedSum += weight * score
    }

    const aggregateScore = totalWeight > 0 ? weightedSum / totalWeight : 0

    // Check if all required evals passed
    const requiredEvals = evalsWithCriteria.filter((e) => e.isRequired)
    const allRequiredPassed = requiredEvals.every((e) => {
      if (e.score === undefined) return false
      if (e.type === "pass_fail") {
        return e.score === 1
      } else {
        // subjective: check against threshold
        const threshold = e.threshold ?? EVAL_DEFAULTS.subjectiveThreshold
        return e.score >= threshold
      }
    })

    // Determine overall success
    const successThreshold =
      version.successThreshold ?? EVAL_AGGREGATE_DEFAULTS.successThreshold
    const isSuccessful = aggregateScore >= successThreshold && allRequiredPassed

    await ctx.db.patch(versionId, {
      evalsStatus: "complete",
      evalsCompletedAt: Date.now(),
      aggregateScore,
      isSuccessful,
      activeWorkflowId: undefined,
    })

    return null
  },
})

/**
 * Handle workflow completion - clear the activeWorkflowId.
 */
export const onWorkflowComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ versionId: v.id("canvasVersions") }),
  },
  returns: v.null(),
  handler: async (ctx, { result, context }) => {
    const { versionId } = context

    // Clear the active workflow reference
    await ctx.db.patch(versionId, {
      activeWorkflowId: undefined,
    })

    if (result.kind === "failed") {
      console.error("Workflow failed:", result.error)
    } else if (result.kind === "canceled") {
      console.log("Workflow was canceled")
    }

    return null
  },
})

/**
 * Set the name of a canvas (used by auto-name generation).
 * This is an internal mutation because it's called from an action.
 */
export const setCanvasName = internalMutation({
  args: {
    canvasId: v.id("canvases"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { canvasId, name }) => {
    const canvas = await ctx.db.get(canvasId)
    if (!canvas) {
      console.warn(`Canvas ${canvasId} not found when setting name`)
      return null
    }

    // Only set the name if it's still undefined (avoid overwriting user edits)
    if (canvas.name === undefined) {
      await ctx.db.patch(canvasId, { name })
    }

    return null
  },
})
