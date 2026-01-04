import { mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { Id } from "./_generated/dataModel"
import {
  getCanvasesByFolderIdWithUpdatedTime,
  scaffoldNewCanvas,
  deleteCanvasDeep,
  upsertCanvasUpdatedTime,
} from "./helpers"
import { v } from "convex/values"
import { workflow } from "./workflow"
import { internal } from "./_generated/api"
import { WorkflowId } from "@convex-dev/workflow"

export const getCanvasById = query({
  args: { id: v.id("canvases") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const canvas = await ctx.db.get(args.id)

    if (!canvas) throw new Error(`Canvas ${args.id} not found`)
    if (canvas.userId !== userId) throw new Error("Not authorized")

    return canvas
  },
})

export const getCanvasVersionById = query({
  args: { id: v.id("canvasVersions") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const version = await ctx.db.get(id)
    if (!version) throw new Error(`Canvas version ${id} not found`)

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas) throw new Error(`Canvas ${version.canvasId} not found`)
    if (canvas.userId !== userId) throw new Error("Not authorized")

    return version
  },
})

export const getEvalsByCanvasVersionId = query({
  args: { canvasVersionId: v.id("canvasVersions") },
  handler: async (ctx, { canvasVersionId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const version = await ctx.db.get(canvasVersionId)
    if (!version) throw new Error(`Canvas version ${canvasVersionId} not found`)

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas) throw new Error(`Canvas ${version.canvasId} not found`)
    if (canvas.userId !== userId) throw new Error("Not authorized")

    const evals = await ctx.db
      .query("evals")
      .withIndex("canvasVersionId", (q) =>
        q.eq("canvasVersionId", canvasVersionId),
      )
      .collect()

    return evals
  },
})

/**
 * Returns an array of folder objects (root first, then alphabetical order).
 * Each folder object contains the canvases it owns, sorted by updatedTime desc.
 */
export const getFoldersWithCanvases = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // 1. Fetch all folders for the user.
    // Folders will be sorted alphabetically by default because of the userId_name index.
    const folders = await ctx.db
      .query("folders")
      .withIndex("userId_name", (q) => q.eq("userId", userId))
      .collect()

    // 2. Prep return value
    const foldersArr = [
      { folderId: null, folderName: "root" },
      ...folders.map((f) => ({ folderId: f._id, folderName: f.name })),
    ]

    // 3. Populate folders with canvases
    const foldersWithCanvases = await Promise.all(
      foldersArr.map(async (f) => {
        const canvases = await getCanvasesByFolderIdWithUpdatedTime(
          ctx,
          userId,
          f.folderId ?? "root",
          "desc",
        )
        return { ...f, canvases }
      }),
    )

    return foldersWithCanvases
  },
})

/**
 * Upon login, we need to direct the user to /app/folder/<folder-id>/canvas/<canvas-id>/version/<version-id>
 *   - We first check if there are any canvases at the root level. If so, get the most recently updated one
 *     and construct the URL.
 *   - If none exist, we scaffold a new canvas at the root level and then construct the URL using that.
 */
export const getDefaultAppUrlPathParams = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // 1. Find the most recently edited/updated canvas that's not organized in a folder
    const canvas = (
      await getCanvasesByFolderIdWithUpdatedTime(ctx, userId, "root", "desc")
    )[0]

    let canvasId: Id<"canvases">
    let versionId: Id<"canvasVersions">

    if (canvas) {
      canvasId = canvas._id

      // 2. Get the current draft version for this canvas
      const draft = await ctx.db
        .query("canvasVersions")
        .withIndex("canvasId_isDraft", (q) =>
          q.eq("canvasId", canvasId).eq("isDraft", true),
        )
        .unique() // We expect there to only be one. Throws if more than one draft found.

      if (!draft) {
        throw new Error("Draft not found for canvas")
      }
      if (!draft.parentVersionId) {
        throw new Error("Draft is not linked to a parent canvas version")
      }

      // 3. Set the versionId to the current draft
      versionId = draft._id
    } else {
      // 4. Scaffold a new canvas, canvas version, and draft version
      ;({ canvasId, versionId } = await scaffoldNewCanvas(ctx, userId))
    }

    // 5. Return the ids needed to construct the URL
    return {
      folderId: "root",
      canvasId,
      versionId,
    }
  },
})

export const createNewCanvas = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    return await scaffoldNewCanvas(ctx, userId)
  },
})

export const createNewFolder = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    return await ctx.db.insert("folders", { userId, name })
  },
})

export const renameFolder = mutation({
  args: { folderId: v.id("folders"), name: v.string() },
  handler: async (ctx, { folderId, name }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      throw new Error("Folder name cannot be empty")
    }
    if (trimmedName.length > 75) {
      throw new Error("Folder name cannot exceed 75 characters")
    }

    const folder = await ctx.db.get(folderId)
    if (!folder) throw new Error("Folder not found")
    if (folder.userId !== userId) throw new Error("Not authorized")

    await ctx.db.patch(folderId, { name: trimmedName })
  },
})

export const renameCanvas = mutation({
  args: { canvasId: v.id("canvases"), name: v.string() },
  handler: async (ctx, { canvasId, name }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      throw new Error("Canvas name cannot be empty")
    }
    if (trimmedName.length > 75) {
      throw new Error("Canvas name cannot exceed 75 characters")
    }

    const canvas = await ctx.db.get(canvasId)
    if (!canvas) throw new Error("Canvas not found")
    if (canvas.userId !== userId) throw new Error("Not authorized")

    await ctx.db.patch(canvasId, {
      name: trimmedName,
    })
    // TODO: Probably should remove this at some point, since this field
    // should reflect when material updates were made, rather than cosmetic
    // metadata changes like renaming. It causes the canvas to "jump" to the
    // top of the list in the sidebar as soon as it is renamed, which is a
    // bit jarring. For right now though, keep it b/c it's useful for testing
    // and debugging and making sure the UI is responsive to changes.
    await upsertCanvasUpdatedTime(ctx, canvasId)
  },
})

export const deleteCanvas = mutation({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, { canvasId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const canvas = await ctx.db.get(canvasId)
    if (!canvas) throw new Error("Canvas not found")
    if (canvas.userId !== userId) throw new Error("Not authorized")

    await deleteCanvasDeep(ctx, canvasId)
  },
})

export const deleteFolder = mutation({
  // If cascade is true, delete all canvases in the folder. Otherwise, just delete the folder record
  // and move canvases to root (folderId undefined). However, the user requested two destructive options only:
  // - Delete Folder (keep canvases by moving them to root)
  // - Delete Folder + Canvases (cascade delete)
  args: { folderId: v.id("folders"), cascade: v.boolean() },
  handler: async (ctx, { folderId, cascade }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const folder = await ctx.db.get(folderId)
    if (!folder) throw new Error("Folder not found")
    if (folder.userId !== userId) throw new Error("Not authorized")

    // Fetch canvases in this folder using the index for performance
    const canvasesInFolder = await ctx.db
      .query("canvases")
      .withIndex("userId_folderId", (q) =>
        q.eq("userId", userId).eq("folderId", folderId),
      )
      .collect()

    if (cascade) {
      // Delete each canvas deeply. Consider doing sequentially to respect DB limits.
      for (const c of canvasesInFolder) {
        await deleteCanvasDeep(ctx, c._id)
      }
    } else {
      // Move canvases to root (folderId undefined)
      for (const c of canvasesInFolder) {
        await ctx.db.patch(c._id, { folderId: undefined })
      }
    }

    // 5. Finally, delete the folder itself
    await ctx.db.delete(folderId)
  },
})

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const user = await ctx.db.get(userId)
    if (!user) throw new Error("User not found")

    return user
  },
})

export const getActiveDraftVersionIdForCanvas = query({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, { canvasId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const canvas = await ctx.db.get(canvasId)
    if (!canvas) throw new Error(`Canvas ${canvasId} not found`)
    if (canvas.userId !== userId) throw new Error("Not authorized")

    // Find the draft version for this canvas
    const draft = await ctx.db
      .query("canvasVersions")
      .withIndex("canvasId_isDraft", (q) =>
        q.eq("canvasId", canvasId).eq("isDraft", true),
      )
      .unique() // Throws if more than one draft found

    if (!draft) throw new Error("Draft not found for canvas")
    if (!draft.parentVersionId)
      throw new Error("Draft is not linked to a parent canvas version")

    return { draftVersionId: draft._id }
  },
})

export const moveCanvasToFolder = mutation({
  args: { canvasId: v.id("canvases"), folderId: v.optional(v.id("folders")) },
  handler: async (ctx, { canvasId, folderId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const canvas = await ctx.db.get(canvasId)
    if (!canvas) throw new Error(`Canvas ${canvasId} not found`)
    if (canvas.userId !== userId) throw new Error("Not authorized")

    if (folderId) {
      const folder = await ctx.db.get(folderId)
      if (!folder) throw new Error(`Folder ${folderId} not found`)
      if (folder.userId !== userId) throw new Error("Not authorized")
    }

    await ctx.db.patch(canvasId, { folderId })
  },
})

export const getAvailableModels = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const availableModels = await ctx.db
      .query("aiGatewayModels")
      .withIndex("isDeprecated_provider_name", (q) =>
        q.eq("isDeprecated", false),
      )
      .collect()

    return availableModels
  },
})

export const updateCanvasVersionPromptModel = mutation({
  args: {
    versionId: v.id("canvasVersions"),
    promptModelId: v.optional(v.id("aiGatewayModels")),
  },
  handler: async (ctx, { versionId, promptModelId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const version = await ctx.db.get(versionId)
    if (!version) throw new Error(`Canvas version ${versionId} not found`)

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas) throw new Error(`Canvas ${version.canvasId} not found`)
    if (canvas.userId !== userId) throw new Error("Not authorized")

    await ctx.db.patch(versionId, {
      promptModelId,
      hasBeenEdited: true,
    })

    await upsertCanvasUpdatedTime(ctx, version.canvasId)
  },
})

export const updateCanvasVersionPrompt = mutation({
  args: {
    versionId: v.id("canvasVersions"),
    prompt: v.optional(v.string()),
    skip: v.optional(v.union(v.literal("generation"), v.literal("evals"))),
  },
  handler: async (ctx, { versionId, prompt, skip }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const version = await ctx.db.get(versionId)
    if (!version) throw new Error(`Canvas version ${versionId} not found`)

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas) throw new Error(`Canvas ${version.canvasId} not found`)
    if (canvas.userId !== userId) throw new Error("Not authorized")

    // skip is accepted but not used yet
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _skip = skip

    await ctx.db.patch(versionId, {
      prompt,
      hasBeenEdited: true,
    })

    await upsertCanvasUpdatedTime(ctx, version.canvasId)
  },
})

export const createEval = mutation({
  args: {
    versionId: v.id("canvasVersions"),
    eval: v.optional(v.string()),
    modelId: v.optional(v.id("aiGatewayModels")),
    isRequired: v.boolean(),
    weight: v.number(),
    type: v.union(v.literal("pass_fail"), v.literal("subjective")),
    threshold: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { versionId, eval: evalText, modelId, isRequired, weight, type, threshold },
  ) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const version = await ctx.db.get(versionId)
    if (!version) throw new Error(`Canvas version ${versionId} not found`)

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas) throw new Error(`Canvas ${version.canvasId} not found`)
    if (canvas.userId !== userId) throw new Error("Not authorized")

    await ctx.db.insert("evals", {
      canvasVersionId: versionId,
      eval: evalText,
      modelId,
      isRequired,
      weight,
      type,
      threshold,
    })

    await ctx.db.patch(versionId, {
      hasBeenEdited: true,
    })

    await upsertCanvasUpdatedTime(ctx, version.canvasId)
  },
})

export const updateEval = mutation({
  args: {
    evalId: v.id("evals"),
    eval: v.optional(v.string()),
    modelId: v.optional(v.id("aiGatewayModels")),
    isRequired: v.optional(v.boolean()),
    weight: v.optional(v.number()),
    type: v.optional(v.union(v.literal("pass_fail"), v.literal("subjective"))),
    threshold: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { evalId, eval: evalText, modelId, isRequired, weight, type, threshold },
  ) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const evalRecord = await ctx.db.get(evalId)
    if (!evalRecord) throw new Error(`Eval ${evalId} not found`)

    const version = await ctx.db.get(evalRecord.canvasVersionId)
    if (!version)
      throw new Error(`Canvas version ${evalRecord.canvasVersionId} not found`)

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas) throw new Error(`Canvas ${version.canvasId} not found`)
    if (canvas.userId !== userId) throw new Error("Not authorized")

    const updateFields: {
      eval?: string
      modelId?: Id<"aiGatewayModels">
      isRequired?: boolean
      weight?: number
      type?: "pass_fail" | "subjective"
      threshold?: number
    } = {}

    if (evalText !== undefined) updateFields.eval = evalText
    if (modelId !== undefined) updateFields.modelId = modelId
    if (isRequired !== undefined) updateFields.isRequired = isRequired
    if (weight !== undefined) updateFields.weight = weight
    if (type !== undefined) updateFields.type = type
    if (threshold !== undefined) updateFields.threshold = threshold

    await ctx.db.patch(evalId, updateFields)

    await ctx.db.patch(version._id, {
      hasBeenEdited: true,
    })

    await upsertCanvasUpdatedTime(ctx, version.canvasId)
  },
})

export const deleteEval = mutation({
  args: { evalId: v.id("evals") },
  handler: async (ctx, { evalId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const evalRecord = await ctx.db.get(evalId)
    if (!evalRecord) throw new Error(`Eval ${evalId} not found`)

    const version = await ctx.db.get(evalRecord.canvasVersionId)
    if (!version)
      throw new Error(`Canvas version ${evalRecord.canvasVersionId} not found`)

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas) throw new Error(`Canvas ${version.canvasId} not found`)
    if (canvas.userId !== userId) throw new Error("Not authorized")

    await ctx.db.delete(evalId)

    await ctx.db.patch(version._id, {
      hasBeenEdited: true,
    })

    await upsertCanvasUpdatedTime(ctx, version.canvasId)
  },
})

export const updateCanvasVersionSuccessThreshold = mutation({
  args: {
    versionId: v.id("canvasVersions"),
    successThreshold: v.optional(v.number()),
  },
  handler: async (ctx, { versionId, successThreshold }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const version = await ctx.db.get(versionId)
    if (!version) throw new Error(`Canvas version ${versionId} not found`)

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas) throw new Error(`Canvas ${version.canvasId} not found`)
    if (canvas.userId !== userId) throw new Error("Not authorized")

    await ctx.db.patch(versionId, {
      successThreshold,
      hasBeenEdited: true,
    })

    await upsertCanvasUpdatedTime(ctx, version.canvasId)
  },
})

export const updateCanvasVersionResponse = mutation({
  args: {
    versionId: v.id("canvasVersions"),
    response: v.optional(v.string()),
    skip: v.optional(v.literal("evals")),
  },
  handler: async (ctx, { versionId, response, skip }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const version = await ctx.db.get(versionId)
    if (!version) throw new Error(`Canvas version ${versionId} not found`)

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas) throw new Error(`Canvas ${version.canvasId} not found`)
    if (canvas.userId !== userId) throw new Error("Not authorized")

    // Check if a workflow is already running
    if (version.activeWorkflowId) {
      throw new Error("Cannot update response while a workflow is running")
    }

    // Save the updated response
    await ctx.db.patch(versionId, {
      response,
      hasBeenEdited: true,
      responseModifiedAt: Date.now(),
    })

    // If not skipping evals and there's a response to evaluate, run evals via workflow
    if (skip !== "evals" && response && response.trim().length > 0) {
      // Get all evals for this version
      const evals = await ctx.db
        .query("evals")
        .withIndex("canvasVersionId", (q) => q.eq("canvasVersionId", versionId))
        .collect()

      // Filter to evals that have criteria defined
      const evalsWithCriteria = evals.filter(
        (e) => e.eval && e.eval.trim().length > 0
      )

      // If no evals to run, just mark as complete
      if (evalsWithCriteria.length === 0) {
        await ctx.db.patch(versionId, {
          evalsStatus: "complete",
          evalsCompletedAt: Date.now(),
        })
      } else {
        // Start the RunEvalsWorkflow
        const workflowId: WorkflowId = await workflow.start(
          ctx,
          internal.workflows.runEvals.runEvalsWorkflow,
          { versionId, response },
          {
            onComplete: internal.internal.mutations.onWorkflowComplete,
            context: { versionId },
          }
        )

        // Store workflow reference
        await ctx.db.patch(versionId, {
          activeWorkflowId: workflowId,
        })
      }
    }

    await upsertCanvasUpdatedTime(ctx, version.canvasId)
  },
})

// =============================================================================
// Submit Prompt Workflow
// =============================================================================

/**
 * Submit a prompt for LLM response generation and optional eval execution.
 *
 * This starts a durable workflow that:
 * 1. Generates an LLM response (with streaming persistence)
 * 2. Runs all evals against the response (in parallel)
 * 3. Computes aggregate scoring
 *
 * The workflow is resilient to server restarts and can be canceled.
 */
export const submitPrompt = mutation({
  args: {
    versionId: v.id("canvasVersions"),
    prompt: v.optional(v.string()),
    skipEvals: v.optional(v.boolean()),
  },
  returns: v.object({
    workflowId: v.string(),
  }),
  handler: async (
    ctx,
    { versionId, prompt, skipEvals }
  ): Promise<{ workflowId: string }> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Validate access
    const version = await ctx.db.get(versionId)
    if (!version) throw new Error("Version not found")

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas || canvas.userId !== userId) throw new Error("Not authorized")

    // Check for existing active workflow
    if (version.activeWorkflowId) {
      throw new Error("A workflow is already running for this version")
    }

    // Save prompt if provided
    if (prompt !== undefined) {
      await ctx.db.patch(versionId, {
        prompt,
        hasBeenEdited: true,
      })
    }

    // Reset response/eval state
    // NOTE: We intentionally keep the old `response` field intact here.
    // This allows the UI to display the previous response while waiting
    // for the first chunk of the new response to arrive. The `response`
    // field will be overwritten by `finalizeResponse` when generation completes.
    // NOTE: We set responseStatus to "generating" immediately (not "idle")
    // so the UI can show the shimmer/loading state right away without
    // waiting for the workflow action to update the status.
    await ctx.db.patch(versionId, {
      responseStatus: "generating",
      responseError: undefined,
      responseErrorAt: undefined,
      responseCompletedAt: undefined,
      responseModifiedAt: undefined,
      generationCancelledAt: undefined, // Clear any previous cancellation
      evalsStatus: "idle",
      evalsCompletedAt: undefined,
      aggregateScore: undefined,
      isSuccessful: undefined,
    })

    // Clear existing response chunks
    const existingChunks = await ctx.db
      .query("responseChunks")
      .withIndex("canvasVersionId_chunkIndex", (q) =>
        q.eq("canvasVersionId", versionId)
      )
      .collect()
    for (const chunk of existingChunks) {
      await ctx.db.delete(chunk._id)
    }

    // Reset individual eval states
    const evals = await ctx.db
      .query("evals")
      .withIndex("canvasVersionId", (q) => q.eq("canvasVersionId", versionId))
      .collect()
    for (const evalRecord of evals) {
      await ctx.db.patch(evalRecord._id, {
        status: "idle",
        error: undefined,
        score: undefined,
        explanation: undefined,
        completedAt: undefined,
      })
    }

    // Start the workflow
    const workflowId: WorkflowId = await workflow.start(
      ctx,
      internal.workflows.submitPrompt.submitPromptWorkflow,
      { versionId, skipEvals },
      {
        onComplete: internal.internal.mutations.onWorkflowComplete,
        context: { versionId },
      }
    )

    // Store workflow reference (as string for database storage)
    await ctx.db.patch(versionId, {
      activeWorkflowId: workflowId,
    })

    await upsertCanvasUpdatedTime(ctx, version.canvasId)

    return { workflowId: workflowId }
  },
})

/**
 * Cancel a running workflow for a canvas version.
 */
export const cancelWorkflow = mutation({
  args: {
    versionId: v.id("canvasVersions"),
  },
  returns: v.null(),
  handler: async (ctx, { versionId }): Promise<null> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const version = await ctx.db.get(versionId)
    if (!version) throw new Error("Version not found")

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas || canvas.userId !== userId) throw new Error("Not authorized")

    if (!version.activeWorkflowId) {
      throw new Error("No active workflow to cancel")
    }

    // Cancel the workflow (cast string back to WorkflowId)
    await workflow.cancel(
      ctx,
      version.activeWorkflowId as unknown as WorkflowId
    )

    // Clear the reference and update status
    await ctx.db.patch(versionId, {
      activeWorkflowId: undefined,
      responseStatus:
        version.responseStatus === "generating"
          ? "idle"
          : version.responseStatus,
      evalsStatus:
        version.evalsStatus === "running" ? "idle" : version.evalsStatus,
    })

    return null
  },
})

/**
 * Cancel an in-progress response generation.
 *
 * This signals the generateResponse action to stop streaming and save
 * whatever has been received so far as the final response.
 *
 * Unlike cancelWorkflow, this allows the action to finish gracefully
 * rather than being abruptly terminated.
 */
export const cancelGeneration = mutation({
  args: {
    versionId: v.id("canvasVersions"),
  },
  returns: v.null(),
  handler: async (ctx, { versionId }): Promise<null> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const version = await ctx.db.get(versionId)
    if (!version) throw new Error("Version not found")

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas || canvas.userId !== userId) throw new Error("Not authorized")

    if (version.responseStatus !== "generating") {
      throw new Error("No generation in progress to cancel")
    }

    // Signal cancellation and immediately clear workflow state
    // This makes the UI (including evals module) responsive right away
    // The generateResponse action will still complete gracefully in the background
    await ctx.db.patch(versionId, {
      generationCancelledAt: Date.now(),
      activeWorkflowId: undefined,
      // Reset evals status to idle since we won't be running evals after cancellation
      evalsStatus: "idle",
    })

    return null
  },
})

/**
 * Get the current response state for a canvas version.
 * Uses chunks for streaming (when generating) or consolidated response (when complete).
 *
 * This query is reactive - it will update in real-time as chunks are added.
 */
export const getCanvasVersionResponse = query({
  args: { versionId: v.id("canvasVersions") },
  handler: async (ctx, { versionId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const version = await ctx.db.get(versionId)
    if (!version) throw new Error("Version not found")

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas || canvas.userId !== userId) throw new Error("Not authorized")

    // If generating, return chunks concatenated; otherwise return consolidated response
    if (version.responseStatus === "generating") {
      const chunks = await ctx.db
        .query("responseChunks")
        .withIndex("canvasVersionId_chunkIndex", (q) =>
          q.eq("canvasVersionId", versionId)
        )
        .collect()

      // Sort by chunkIndex and concatenate
      chunks.sort((a, b) => a.chunkIndex - b.chunkIndex)
      const streamedContent = chunks.map((c) => c.content).join("")

      // If no chunks have arrived yet, show the previous response as a fallback
      // This prevents a flash of placeholder text while waiting for the first chunk
      const displayContent =
        streamedContent.length > 0 ? streamedContent : (version.response ?? "")

      return {
        status: version.responseStatus,
        content: displayContent,
        isComplete: false,
        error: version.responseError,
        errorAt: version.responseErrorAt,
      }
    }

    return {
      status: version.responseStatus ?? "idle",
      content: version.response ?? "",
      isComplete: version.responseStatus === "complete",
      error: version.responseError,
      errorAt: version.responseErrorAt,
    }
  },
})

/**
 * Run a single eval against the current response.
 * Useful for testing or re-running a specific eval.
 *
 * NOTE: This preserves the existing score/explanation while running.
 * The old result is only overwritten when the new run completes successfully.
 * If the new run fails and there was an existing score, it will be recovered.
 */
export const runSingleEvalManually = mutation({
  args: {
    evalId: v.id("evals"),
  },
  returns: v.null(),
  handler: async (ctx, { evalId }): Promise<null> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const evalRecord = await ctx.db.get(evalId)
    if (!evalRecord) throw new Error("Eval not found")

    const version = await ctx.db.get(evalRecord.canvasVersionId)
    if (!version) throw new Error("Version not found")

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas || canvas.userId !== userId) throw new Error("Not authorized")

    if (!version.response) {
      throw new Error("No response to evaluate")
    }

    if (version.activeWorkflowId || version.evalsStatus === "running") {
      throw new Error("Cannot run eval while a workflow or eval run is in progress")
    }

    // Mark eval as running - preserving existing score/explanation
    // The old result will only be overwritten when the new run completes
    await ctx.db.patch(evalId, {
      status: "running",
      error: undefined, // Clear any previous error
    })

    // Set aggregate to indeterminate since an eval is now running
    await ctx.db.patch(version._id, {
      aggregateScore: undefined,
      isSuccessful: undefined,
    })

    // Schedule the eval action
    await ctx.scheduler.runAfter(
      0,
      internal.actions.runSingleEval.runSingleEval,
      {
        evalId,
        response: version.response,
      }
    )

    await upsertCanvasUpdatedTime(ctx, version.canvasId)

    return null
  },
})

/**
 * Run all evals against the current response (without regenerating the response).
 * Useful for re-running evals after manual response edits.
 *
 * This starts the RunEvalsWorkflow, which:
 * - Marks all evals as running (preserving existing scores)
 * - Runs all eval actions in parallel with retry
 * - Computes aggregate when all evals settle
 */
export const runEvals = mutation({
  args: {
    versionId: v.id("canvasVersions"),
  },
  returns: v.null(),
  handler: async (ctx, { versionId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const version = await ctx.db.get(versionId)
    if (!version) throw new Error("Version not found")

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas || canvas.userId !== userId) throw new Error("Not authorized")

    if (!version.response) {
      throw new Error("No response to evaluate")
    }

    if (version.activeWorkflowId) {
      throw new Error("A workflow is already running for this version")
    }

    // Check if there are any evals with criteria to run
    const evals = await ctx.db
      .query("evals")
      .withIndex("canvasVersionId", (q) => q.eq("canvasVersionId", versionId))
      .collect()

    const evalsWithCriteria = evals.filter(
      (e) => e.eval && e.eval.trim().length > 0
    )

    // If no evals to run, mark as complete immediately
    if (evalsWithCriteria.length === 0) {
      await ctx.db.patch(versionId, {
        evalsStatus: "complete",
        evalsCompletedAt: Date.now(),
      })
      await upsertCanvasUpdatedTime(ctx, version.canvasId)
      return null
    }

    // Start the RunEvalsWorkflow
    const workflowId: WorkflowId = await workflow.start(
      ctx,
      internal.workflows.runEvals.runEvalsWorkflow,
      { versionId, response: version.response },
      {
        onComplete: internal.internal.mutations.onWorkflowComplete,
        context: { versionId },
      }
    )

    // Store workflow reference
    await ctx.db.patch(versionId, {
      activeWorkflowId: workflowId,
    })

    await upsertCanvasUpdatedTime(ctx, version.canvasId)

    return null
  },
})
