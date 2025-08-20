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
