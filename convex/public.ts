import { mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { Id } from "./_generated/dataModel"
import {
  getCanvasesByFolderIdWithUpdatedTime,
  scaffoldNewCanvas,
} from "./helpers"
import { v } from "convex/values"

export const getCanvasById = query({
  args: { id: v.id("canvases") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const canvas = await ctx.db.get(args.id)

    if (!canvas) throw new Error(`Canvas ${args.id} not found`)

    return canvas
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

      // 3. Get the parent version of the draft
      versionId = draft.parentVersionId
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
    await ctx.db.patch(canvas.entityUpdate, {
      updatedTime: Date.now(),
    })
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

    // 1. Get all canvas versions for this canvas
    const canvasVersions = await ctx.db
      .query("canvasVersions")
      .filter((q) => q.eq(q.field("canvasId"), canvasId))
      .collect()

    // 2. Delete all evals for each canvas version
    for (const version of canvasVersions) {
      const evalRecords = await ctx.db
        .query("evals")
        .withIndex("canvasVersionId", (q) => q.eq("canvasVersionId", version._id))
        .collect()
      
      for (const evalRecord of evalRecords) {
        await ctx.db.delete(evalRecord._id)
      }
    }

    // 3. Delete all canvas versions
    for (const version of canvasVersions) {
      await ctx.db.delete(version._id)
    }

    // 4. Delete the entity update record
    if (canvas.entityUpdate) {
      await ctx.db.delete(canvas.entityUpdate)
    }

    // 5. Delete the canvas itself
    await ctx.db.delete(canvasId)
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

export const getActiveVersionIdForCanvas = query({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, { canvasId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

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

    return { versionId: draft.parentVersionId }
  },
})
