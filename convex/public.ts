import { mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { Doc, Id } from "./_generated/dataModel"
import { scaffoldNewCanvas } from "./helpers"
import { v } from "convex/values"

export const getFoldersWithCanvases = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Fetch all folders for the user.
    // Folders will be sorted alphabetically by default because of the userId_name index.
    const folders = await ctx.db
      .query("folders")
      .withIndex("userId_name", (q) => q.eq("userId", userId))
      .collect()

    // Fetch all canvases for the user
    const canvases = await ctx.db
      .query("canvases")
      .withIndex("userId_lastModifiedTime", (q) => q.eq("userId", userId))
      .order("desc")
      .collect()

    // Group canvases by folderId (null for root)
    const folderMap = new Map<Id<"folders"> | null, Array<Doc<"canvases">>>()

    for (const canvas of canvases) {
      const key = canvas.folderId ?? null
      if (!folderMap.has(key)) folderMap.set(key, [])
      folderMap.get(key)!.push(canvas)
    }

    // Build the result array
    const result: Array<{
      folderId: Id<"folders"> | null
      folderName: string | "root"
      canvases: Array<Doc<"canvases">>
    }> = []

    // Root folder first
    result.push({
      folderId: null,
      folderName: "root",
      canvases: folderMap.get(null) ?? [],
    })

    // Other folders
    for (const folder of folders) {
      result.push({
        folderId: folder._id,
        folderName: folder.name,
        canvases: folderMap.get(folder._id) ?? [],
      })
    }

    return result
  },
})

export const getDefaultAppUrlPathParams = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // 1. Find the most recently edited/updated canvas that's not organized in a folder
    const canvas = await ctx.db
      .query("canvases")
      .withIndex("userId_lastModifiedTime", (q) => q.eq("userId", userId))
      .order("desc")
      .filter((q) => q.eq(q.field("folderId"), undefined))
      .first()

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

    // 6. Return the ids needed to construct the URL
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
