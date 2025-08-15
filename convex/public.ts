import { mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { Id } from "./_generated/dataModel"
import { scaffoldNewCanvas } from "./helpers"
import { v } from "convex/values"

export const getCanvasesNotInFolder = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    return await ctx.db
      .query("canvases")
      .withIndex("userId_lastModifiedTime", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("folderId"), null))
      .order("desc")
      .collect()
  },
})

export const getCanvasesByFolder = query({
  args: {
    folderId: v.id("folders"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const canvases = await ctx.db
      .query("canvases")
      .withIndex("folderId_lastModifiedTime", (q) =>
        q.eq("folderId", args.folderId),
      )
      .order("desc")
      .collect()

    // Sanity check
    const allSameUserId = canvases.every((canvas) => canvas.userId === userId)
    if (!allSameUserId)
      throw new Error(
        "Data corruption detected. All canvases in a folder should belong to the same user.",
      )

    return canvases
  },
})

export const getFolders = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Folders will be sorted alphabetically by default because of the userId_name index
    return await ctx.db
      .query("folders")
      .withIndex("userId_name", (q) => q.eq("userId", userId))
      .collect()
  },
})

export const getDefaultAppUrlPathParams = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // 1. Find the most recently edited/updated canvas for the user
    const canvas = await ctx.db
      .query("canvases")
      .withIndex("userId_lastModifiedTime", (q) => q.eq("userId", userId))
      .order("desc")
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
