import { internalQuery } from "../_generated/server"
import { v } from "convex/values"

/**
 * Load a canvas version with all data needed for response generation.
 */
export const getVersionForGeneration = internalQuery({
  args: { versionId: v.id("canvasVersions") },
  returns: v.object({
    prompt: v.optional(v.string()),
    modelId: v.string(),
    evals: v.array(
      v.object({
        eval: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, { versionId }) => {
    const version = await ctx.db.get(versionId)
    if (!version) throw new Error(`Version ${versionId} not found`)

    // Get the model ID string from the aiGatewayModels table
    let modelId = "openai/gpt-4o" // fallback default
    if (version.promptModelId) {
      const model = await ctx.db.get(version.promptModelId)
      if (model) {
        modelId = model.modelId
      }
    }

    // Get eval definitions (for system prompt compilation)
    const evals = await ctx.db
      .query("evals")
      .withIndex("canvasVersionId", (q) => q.eq("canvasVersionId", versionId))
      .collect()

    return {
      prompt: version.prompt,
      modelId,
      evals: evals.map((e) => ({ eval: e.eval })),
    }
  },
})

/**
 * Load a canvas version with its response and evals for running evaluations.
 */
export const getVersionWithResponseAndEvals = internalQuery({
  args: { versionId: v.id("canvasVersions") },
  returns: v.object({
    response: v.optional(v.string()),
    successThreshold: v.optional(v.number()),
    evals: v.array(
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
  }),
  handler: async (ctx, { versionId }) => {
    const version = await ctx.db.get(versionId)
    if (!version) throw new Error(`Version ${versionId} not found`)

    const evals = await ctx.db
      .query("evals")
      .withIndex("canvasVersionId", (q) => q.eq("canvasVersionId", versionId))
      .collect()

    // Resolve model IDs
    const evalsWithModelIds = await Promise.all(
      evals.map(async (e) => {
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

    return {
      response: version.response,
      successThreshold: version.successThreshold,
      evals: evalsWithModelIds,
    }
  },
})

/**
 * Check if generation has been cancelled by the user.
 * Returns the cancellation timestamp if cancelled, null otherwise.
 */
export const checkGenerationCancelled = internalQuery({
  args: { versionId: v.id("canvasVersions") },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, { versionId }): Promise<number | null> => {
    const version = await ctx.db.get(versionId)
    if (!version) throw new Error(`Version ${versionId} not found`)
    return version.generationCancelledAt ?? null
  },
})

/**
 * Get the response for a canvas version.
 * Used by SubmitPromptWorkflow to pass response to RunEvalsWorkflow.
 */
export const getVersionResponse = internalQuery({
  args: { versionId: v.id("canvasVersions") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { versionId }): Promise<string | null> => {
    const version = await ctx.db.get(versionId)
    if (!version) throw new Error(`Version ${versionId} not found`)
    return version.response ?? null
  },
})

/**
 * Get a single eval by ID with its model ID resolved.
 * Also includes existing score/explanation for error recovery.
 */
export const getEvalById = internalQuery({
  args: { evalId: v.id("evals") },
  returns: v.object({
    _id: v.id("evals"),
    eval: v.optional(v.string()),
    modelId: v.string(),
    type: v.union(v.literal("pass_fail"), v.literal("subjective")),
    isRequired: v.boolean(),
    weight: v.number(),
    threshold: v.optional(v.number()),
    // Include existing score/explanation for error recovery
    existingScore: v.optional(v.number()),
    existingExplanation: v.optional(v.string()),
  }),
  handler: async (ctx, { evalId }) => {
    const evalRecord = await ctx.db.get(evalId)
    if (!evalRecord) throw new Error(`Eval ${evalId} not found`)

    // Resolve model ID
    let modelId = "openai/gpt-4o" // fallback default
    if (evalRecord.modelId) {
      const model = await ctx.db.get(evalRecord.modelId)
      if (model) {
        modelId = model.modelId
      }
    }

    return {
      _id: evalRecord._id,
      eval: evalRecord.eval,
      modelId,
      type: evalRecord.type,
      isRequired: evalRecord.isRequired,
      weight: evalRecord.weight,
      threshold: evalRecord.threshold,
      existingScore: evalRecord.score,
      existingExplanation: evalRecord.explanation,
    }
  },
})
