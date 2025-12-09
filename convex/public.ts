import { mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { Id } from "./_generated/dataModel"
import {
  getCanvasesByFolderIdWithUpdatedTime,
  scaffoldNewCanvas,
  deleteCanvasDeep,
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

export const getCanvasVersionNumberById = query({
  args: { id: v.id("canvasVersions") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const version = await ctx.db.get(id)
    if (!version) throw new Error(`Canvas version ${id} not found`)

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas) throw new Error(`Canvas ${version.canvasId} not found`)
    if (canvas.userId !== userId) throw new Error("Not authorized")

    let versionToDisplay = version

    if (version.isDraft) {
      if (!version.parentVersionId) {
        throw new Error("Draft is not linked to a parent canvas version")
      }

      const parentVersion = await ctx.db.get(version.parentVersionId)

      if (!parentVersion) {
        throw new Error(`Parent version ${version.parentVersionId} not found`)
      }

      if (parentVersion.canvasId !== version.canvasId) {
        throw new Error("Parent version belongs to a different canvas")
      }

      versionToDisplay = parentVersion
    }

    if (versionToDisplay.versionNo == null) {
      throw new Error("Canvas version number not set")
    }

    return { canvasVersionNo: versionToDisplay.versionNo }
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
    const entityUpdate = await ctx.db
      .query("entityUpdates")
      .withIndex("canvasId", (q) => q.eq("canvasId", canvasId))
      .unique()
    if (entityUpdate) {
      await ctx.db.patch(entityUpdate._id, {
        updatedTime: Date.now(),
      })
    }
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
