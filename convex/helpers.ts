import { MutationCtx } from "./_generated/server"
import { Id } from "./_generated/dataModel"

export async function scaffoldNewCanvas(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ canvasId: Id<"canvases">; versionId: Id<"canvasVersions"> }> {
  const canvasId = await ctx.db.insert("canvases", {
    userId,
    lastModifiedTime: Date.now(),
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
