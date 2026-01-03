import { internalMutation } from "../_generated/server"
import { v } from "convex/values"
import { vWorkflowId } from "@convex-dev/workflow"

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
  })
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
 * Clear all response chunks for a version before starting new generation.
 */
export const clearResponseChunks = internalMutation({
  args: { versionId: v.id("canvasVersions") },
  returns: v.null(),
  handler: async (ctx, { versionId }) => {
    const chunks = await ctx.db
      .query("responseChunks")
      .withIndex("canvasVersionId_chunkIndex", (q) =>
        q.eq("canvasVersionId", versionId)
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
      v.literal("error")
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
 * Consolidate response chunks into the final response field.
 */
export const finalizeResponse = internalMutation({
  args: { versionId: v.id("canvasVersions") },
  returns: v.null(),
  handler: async (ctx, { versionId }) => {
    // Get all chunks in order
    const chunks = await ctx.db
      .query("responseChunks")
      .withIndex("canvasVersionId_chunkIndex", (q) =>
        q.eq("canvasVersionId", versionId)
      )
      .collect()

    // Sort by chunkIndex and concatenate
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex)
    const fullResponse = chunks.map((c) => c.content).join("")

    // Update the version with consolidated response
    // Clear any transient errors from retry attempts
    await ctx.db.patch(versionId, {
      response: fullResponse,
      responseStatus: "complete",
      responseCompletedAt: Date.now(),
      responseModifiedAt: Date.now(),
      responseError: undefined,
      responseErrorAt: undefined,
    })

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
      v.literal("error")
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
 */
export const updateEvalStatus = internalMutation({
  args: {
    evalId: v.id("evals"),
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("complete"),
      v.literal("error")
    ),
  },
  returns: v.null(),
  handler: async (ctx, { evalId, status }) => {
    await ctx.db.patch(evalId, { status })
    return null
  },
})

/**
 * Update an individual eval's result after execution.
 * When an eval completes, check if all evals for that version are done
 * and if so, compute the aggregate score.
 */
export const updateEvalResult = internalMutation({
  args: {
    evalId: v.id("evals"),
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("complete"),
      v.literal("error")
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

    // If this eval just completed, check if all evals for this version are done
    if (status === "complete" || status === "error") {
      const version = await ctx.db.get(evalRecord.canvasVersionId)
      if (version?.evalsStatus === "running") {
        // Get all evals for this version
        const allEvals = await ctx.db
          .query("evals")
          .withIndex("canvasVersionId", (q) =>
            q.eq("canvasVersionId", evalRecord.canvasVersionId)
          )
          .collect()

        // Check if all evals with criteria are complete (not running or idle)
        const evalsWithCriteria = allEvals.filter(
          (e) => e.eval && e.eval.trim().length > 0
        )
        const allComplete = evalsWithCriteria.every(
          (e) => e.status === "complete" || e.status === "error"
        )

        if (allComplete) {
          // All evals done - compute aggregate score
          // This will also clear activeWorkflowId
          const completedEvals = evalsWithCriteria.filter(
            (e) => e.status === "complete" && e.score !== undefined
          )

          if (completedEvals.length === 0) {
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

            for (const e of completedEvals) {
              totalWeight += e.weight
              weightedSum += e.weight * e.score!
            }

            const aggregateScore =
              totalWeight > 0 ? weightedSum / totalWeight : 0

            // Check if all required evals passed
            const requiredEvals = evalsWithCriteria.filter((e) => e.isRequired)
            const allRequiredPassed = requiredEvals.every((e) => {
              if (e.status !== "complete" || e.score === undefined) return false
              if (e.type === "pass_fail") {
                return e.score === 1
              } else {
                const threshold = e.threshold ?? 0.5
                return e.score >= threshold
              }
            })

            const successThreshold = version.successThreshold ?? 0.7
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
        }
      }
    }

    return null
  },
})

/**
 * Compute the aggregate score from all evals and determine overall success.
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

    // Filter to completed evals with scores
    const completedEvals = evals.filter(
      (e) => e.status === "complete" && e.score !== undefined
    )

    if (completedEvals.length === 0) {
      await ctx.db.patch(versionId, {
        evalsStatus: "complete",
        evalsCompletedAt: Date.now(),
        aggregateScore: undefined,
        isSuccessful: undefined,
        activeWorkflowId: undefined, // Clear manual eval run marker
      })
      return null
    }

    // Calculate weighted average
    let totalWeight = 0
    let weightedSum = 0

    for (const evalRecord of completedEvals) {
      const weight = evalRecord.weight
      const score = evalRecord.score!
      totalWeight += weight
      weightedSum += weight * score
    }

    const aggregateScore = totalWeight > 0 ? weightedSum / totalWeight : 0

    // Check if all required evals passed
    const requiredEvals = evals.filter((e) => e.isRequired)
    const allRequiredPassed = requiredEvals.every((e) => {
      if (e.status !== "complete" || e.score === undefined) return false
      if (e.type === "pass_fail") {
        return e.score === 1
      } else {
        // subjective: check against threshold
        const threshold = e.threshold ?? 0.5
        return e.score >= threshold
      }
    })

    // Determine overall success
    const successThreshold = version.successThreshold ?? 0.7
    const isSuccessful = aggregateScore >= successThreshold && allRequiredPassed

    await ctx.db.patch(versionId, {
      evalsStatus: "complete",
      evalsCompletedAt: Date.now(),
      aggregateScore,
      isSuccessful,
      activeWorkflowId: undefined, // Clear manual eval run marker
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
    context: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, { result, context }) => {
    const { versionId } = context as { versionId: string }

    // Clear the active workflow reference
    await ctx.db.patch(versionId as any, {
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

