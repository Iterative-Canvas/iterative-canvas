import { internal } from "./_generated/api"
import { internalAction, internalMutation } from "./_generated/server"
import { gateway } from "@ai-sdk/gateway"
import schema from "./schema"
import { v } from "convex/values"

// Module-level flag to track if sync has run during local dev
let hasRunInLocalDev = false

export const fetchAndSyncAIGatewayModels = internalAction({
  args: {},
  handler: async (ctx) => {
    // In local dev, only run once per server restart
    const isLocalDev = process.env.NODE_ENV !== "production"

    if (isLocalDev && hasRunInLocalDev) {
      return
    }

    // Uses the AI_GATEWAY_API_KEY environment variable by default
    const availableModels = await gateway.getAvailableModels()

    const languageModels = availableModels.models
      // Only consider language models with pricing info
      .filter((m) => m.modelType === "language" && m.pricing)
      // Map to the expected database format
      .map((m) => ({
        modelId: m.id,
        name: m.name,
        description: m.description ?? "No description available",
        provider: m.specification.provider,
        input: Number(m.pricing!.input),
        output: Number(m.pricing!.output),
        cachedInputTokens: m.pricing!.cachedInputTokens
          ? Number(m.pricing!.cachedInputTokens)
          : undefined,
        cacheCreationInputTokens: m.pricing!.cacheCreationInputTokens
          ? Number(m.pricing!.cacheCreationInputTokens)
          : undefined,
        isDeprecated: false,
      }))

    await ctx.runMutation(internal.private.syncAIGatewayModels, {
      incomingModels: languageModels,
    })

    if (isLocalDev) {
      hasRunInLocalDev = true
    }

    return null
  },
})

export const syncAIGatewayModels = internalMutation({
  args: {
    incomingModels: v.array(schema.tables.aiGatewayModels.validator),
  },
  handler: async (ctx, args) => {
    const { incomingModels } = args

    const existingModels = await ctx.db.query("aiGatewayModels").collect()

    // Add or update incoming models
    for (const incomingModel of incomingModels) {
      const existingModel = existingModels.find(
        (m) => m.modelId === incomingModel.modelId,
      )
      if (existingModel) {
        // Update if any field has changed (excluding isDeprecated)
        if (
          existingModel.name !== incomingModel.name ||
          existingModel.description !== incomingModel.description ||
          existingModel.provider !== incomingModel.provider ||
          existingModel.input !== incomingModel.input ||
          existingModel.output !== incomingModel.output ||
          existingModel.cachedInputTokens !== incomingModel.cachedInputTokens ||
          existingModel.cacheCreationInputTokens !==
            incomingModel.cacheCreationInputTokens
        ) {
          await ctx.db.patch(existingModel._id, incomingModel)
        }
      } else {
        // Insert new model
        await ctx.db.insert("aiGatewayModels", incomingModel)
      }
    }

    const incomingModelIds = new Set(incomingModels.map((m) => m.modelId))

    // Mark models as deprecated if they are not in the incoming list
    for (const existingModel of existingModels) {
      if (
        !incomingModelIds.has(existingModel.modelId) &&
        !existingModel.isDeprecated
      ) {
        await ctx.db.patch(existingModel._id, { isDeprecated: true })
      }
    }
  },
})
