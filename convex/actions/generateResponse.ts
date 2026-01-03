"use node"

import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { gateway } from "@ai-sdk/gateway"
import { streamText } from "ai"
import { v } from "convex/values"

// Buffer settings (from unbreakable-ai-chat pattern)
// These control how often we flush to the database
const MIN_CHUNK_SIZE = 20
const FLUSH_INTERVAL_MS = 200
// How often to check for cancellation (in milliseconds)
const CANCELLATION_CHECK_INTERVAL_MS = 500

/**
 * Compile a system prompt that includes eval requirements.
 * This helps the LLM understand what constraints it should satisfy.
 */
function compileSystemPrompt(
  evals: Array<{ eval: string | undefined }>
): string | undefined {
  const evalRequirements = evals
    .filter((e) => e.eval && e.eval.trim().length > 0)
    .map((e, i) => `${i + 1}. ${e.eval}`)

  if (evalRequirements.length === 0) {
    return undefined
  }

  return `You are a helpful assistant. Your response will be evaluated against the following criteria. Please ensure your response satisfies these requirements:

${evalRequirements.join("\n")}

Provide a thorough, well-structured response that addresses the user's prompt while meeting the above criteria.`
}

/**
 * Generate an LLM response with streaming, persisting chunks to the database
 * for real-time frontend updates and resilience to disconnects.
 */
export const generateResponse = internalAction({
  args: {
    versionId: v.id("canvasVersions"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    { versionId }
  ): Promise<{ success: boolean; error?: string }> => {
    // 1. Load version and model info
    const versionData = await ctx.runQuery(
      internal.internal.queries.getVersionForGeneration,
      { versionId }
    )

    if (!versionData.prompt) {
      return { success: false, error: "No prompt to generate from" }
    }

    // 2. Clear old chunks
    await ctx.runMutation(internal.internal.mutations.clearResponseChunks, {
      versionId,
    })

    // 3. Update status to generating
    await ctx.runMutation(internal.internal.mutations.updateResponseStatus, {
      versionId,
      status: "generating",
    })

    try {
      // 4. Stream from LLM
      const model = gateway(versionData.modelId)
      const systemPrompt = compileSystemPrompt(versionData.evals)

      const result = streamText({
        model,
        ...(systemPrompt && { system: systemPrompt }),
        prompt: versionData.prompt,
        onError: ({ error }) => console.error("Stream error:", error),
      })

      // 5. Buffer and flush pattern with cancellation checking
      let buffer = ""
      let chunkIndex = 0
      let lastFlushTime = Date.now()
      let lastCancellationCheckTime = Date.now()
      let wasCancelled = false

      const flush = async (force = false) => {
        const now = Date.now()
        const shouldFlush =
          force ||
          (buffer.length >= MIN_CHUNK_SIZE &&
            now - lastFlushTime >= FLUSH_INTERVAL_MS)

        if (shouldFlush && buffer.length > 0) {
          await ctx.runMutation(internal.internal.mutations.saveResponseChunk, {
            versionId,
            content: buffer,
            chunkIndex,
          })
          buffer = ""
          chunkIndex++
          lastFlushTime = now
        }
      }

      const checkCancellation = async (): Promise<boolean> => {
        const now = Date.now()
        if (now - lastCancellationCheckTime >= CANCELLATION_CHECK_INTERVAL_MS) {
          lastCancellationCheckTime = now
          const cancelledAt = await ctx.runQuery(
            internal.internal.queries.checkGenerationCancelled,
            { versionId }
          )
          return cancelledAt !== null
        }
        return false
      }

      for await (const textPart of result.textStream) {
        buffer += textPart
        await flush()

        // Check for cancellation periodically
        if (await checkCancellation()) {
          wasCancelled = true
          break
        }
      }

      // 6. Flush remaining buffer
      await flush(true)

      // 7. Consolidate chunks into final response
      // This happens whether cancelled or completed normally
      await ctx.runMutation(internal.internal.mutations.finalizeResponse, {
        versionId,
      })

      if (wasCancelled) {
        console.log("Generation was cancelled by user, partial response saved")
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      console.error("Generation failed:", message)

      // Record the error for frontend toast notifications.
      // Status stays "generating" — workflow will set final error if all retries fail.
      await ctx.runMutation(internal.internal.mutations.recordRetryError, {
        versionId,
        error: message,
      })

      throw error
    }
  },
})

