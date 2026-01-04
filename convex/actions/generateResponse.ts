"use node"

import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { gateway } from "@ai-sdk/gateway"
import { streamText } from "ai"
import { v } from "convex/values"
import { compileSystemPrompt } from "../lib"

// Buffer settings (from unbreakable-ai-chat pattern)
// These control how often we flush to the database
const MIN_CHUNK_SIZE = 20
const FLUSH_INTERVAL_MS = 200
// How often to check for cancellation (in milliseconds)
const CANCELLATION_CHECK_INTERVAL_MS = 500

/**
 * Generate an LLM response with streaming, persisting chunks to the database
 * for real-time frontend updates and resilience to disconnects.
 */
export const generateResponse = internalAction({
  args: {
    versionId: v.id("canvasVersions"),
    skipEvals: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    { versionId, skipEvals }
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

    // Set up AbortController for cancellation
    const abortController = new AbortController()
    let wasCancelled = false
    let cancellationCheckInterval: ReturnType<typeof setInterval> | null = null

    try {
      // 4. Check for early cancellation before starting the stream
      const earlyCancelledAt = await ctx.runQuery(
        internal.internal.queries.checkGenerationCancelled,
        { versionId }
      )
      if (earlyCancelledAt !== null) {
        console.log("Generation was cancelled before streaming started")
        await ctx.runMutation(internal.internal.mutations.finalizeResponse, {
          versionId,
        })
        return { success: true }
      }

      // 5. Start background cancellation polling
      // This allows cancellation even while waiting for the first chunk from a slow model
      cancellationCheckInterval = setInterval(async () => {
        try {
          const cancelledAt = await ctx.runQuery(
            internal.internal.queries.checkGenerationCancelled,
            { versionId }
          )
          if (cancelledAt !== null && !wasCancelled) {
            wasCancelled = true
            abortController.abort()
          }
        } catch {
          // Ignore errors in background check - we'll catch cancellation in the main loop too
        }
      }, CANCELLATION_CHECK_INTERVAL_MS)

      // 6. Stream from LLM with abort signal
      const model = gateway(versionData.modelId)
      const systemPrompt = compileSystemPrompt(versionData.evals)

      const result = streamText({
        model,
        ...(systemPrompt && { system: systemPrompt }),
        prompt: versionData.prompt,
        abortSignal: abortController.signal,
        onError: ({ error }) => console.error("Stream error:", error),
      })

      // 7. Buffer and flush pattern
      let buffer = ""
      let chunkIndex = 0
      let lastFlushTime = Date.now()

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

      for await (const textPart of result.textStream) {
        buffer += textPart
        await flush()
      }

      // 8. Flush remaining buffer
      await flush(true)

      // 9. Consolidate chunks into final response
      // Only prepare evals if they will actually run (skipEvals is not true)
      await ctx.runMutation(internal.internal.mutations.finalizeResponse, {
        versionId,
        prepareEvals: !skipEvals, // Mark evals as running only if they will run
      })

      return { success: true }
    } catch (error) {
      // Check if this was a cancellation abort
      if (wasCancelled || abortController.signal.aborted) {
        console.log("Generation was cancelled by user, saving partial response")
        // Still finalize whatever we have
        await ctx.runMutation(internal.internal.mutations.finalizeResponse, {
          versionId,
        })
        return { success: true }
      }

      const message = error instanceof Error ? error.message : "Unknown error"
      console.error("Generation failed:", message)

      // Record the error for frontend toast notifications.
      // Status stays "generating" — workflow will set final error if all retries fail.
      await ctx.runMutation(internal.internal.mutations.recordRetryError, {
        versionId,
        error: message,
      })

      throw error
    } finally {
      // Clean up the cancellation check interval
      if (cancellationCheckInterval) {
        clearInterval(cancellationCheckInterval)
      }
    }
  },
})

