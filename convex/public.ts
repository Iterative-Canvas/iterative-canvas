import { mutation } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { Id } from "./_generated/dataModel"
import { scaffoldNewCanvas } from "./helpers"

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
      const drafts = await ctx.db
        .query("canvasVersions")
        .withIndex("canvasId_isDraft", (q) =>
          q.eq("canvasId", canvasId).eq("isDraft", true),
        )
        .collect()

      if (drafts.length === 0) {
        throw new Error("Draft not found for canvas")
      }
      if (drafts.length > 1) {
        throw new Error("More than one draft version found for canvas")
      }

      const draft = drafts[0]

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
