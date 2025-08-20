import { MutationCtx, QueryCtx } from "./_generated/server"
import { Id } from "./_generated/dataModel"

export async function scaffoldNewCanvas(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ canvasId: Id<"canvases">; versionId: Id<"canvasVersions"> }> {
  const updateId = await ctx.db.insert("entityUpdates", {
    updatedTime: Date.now(),
  })

  const canvasId = await ctx.db.insert("canvases", {
    userId,
    entityUpdate: updateId,
  })

  const versionId = await ctx.db.insert("canvasVersions", {
    canvasId,
    versionNo: 1,
    isDraft: false,
  })

  await ctx.db.insert("canvasVersions", {
    canvasId,
    parentVersionId: versionId,
    isDraft: true,
  })

  return { canvasId, versionId }
}

export async function getCanvasesByFolderIdWithUpdatedTime(
  ctx: QueryCtx,
  userId: Id<"users">,
  folderId: Id<"folders"> | "root",
  order: "asc" | "desc" = "desc",
) {
  const canvases = await ctx.db
    .query("canvases")
    .withIndex("userId_folderId", (q) =>
      q
        .eq("userId", userId)
        .eq("folderId", folderId === "root" ? undefined : folderId),
    )
    .collect()

  const canvasesWithUpdatedTime = await Promise.all(
    canvases.map(async (canvas) => {
      let entityUpdate = null
      if (canvas.entityUpdate) {
        entityUpdate = await ctx.db.get(canvas.entityUpdate)
      } else {
        console.warn(
          `Canvas ${canvas._id} is missing a corresponding entityUpdates.updatedTime`,
        )
      }
      return {
        ...canvas,
        updatedTime: entityUpdate?.updatedTime,
      }
    }),
  )

  const sortedCanvases = canvasesWithUpdatedTime.sort((a, b) => {
    // If updatedTime is missing (it shouldn't be), fallback to _creationTime
    const aTime = a.updatedTime ?? a._creationTime
    const bTime = b.updatedTime ?? b._creationTime
    return order === "asc" ? aTime - bTime : bTime - aTime
  })

  return sortedCanvases
}
