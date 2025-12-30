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
    skipEvals: v.optional(v.boolean()),
  },
  handler: async (ctx, { versionId, prompt, skipEvals }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const version = await ctx.db.get(versionId)
    if (!version) throw new Error(`Canvas version ${versionId} not found`)

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas) throw new Error(`Canvas ${version.canvasId} not found`)
    if (canvas.userId !== userId) throw new Error("Not authorized")

    // skipEvals is accepted but not used yet
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _skipEvals = skipEvals

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
