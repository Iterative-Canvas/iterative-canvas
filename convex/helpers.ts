import { MutationCtx, QueryCtx } from "./_generated/server"
import { Id } from "./_generated/dataModel"

export async function getAppDefaultModelDbIds(ctx: QueryCtx) {
  const models = await ctx.db.query("aiGatewayModels").collect()

  const promptModel = models.find((m) => m.modelId === "openai/gpt-5")
  const refineModel = models.find((m) => m.modelId === "openai/gpt-5")
  const evalsModel = models.find((m) => m.modelId === "openai/gpt-4o")

  return {
    promptModelId: promptModel?._id,
    refineModelId: refineModel?._id,
    evalsModelId: evalsModel?._id,
  }
}

export async function scaffoldNewCanvas(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ canvasId: Id<"canvases">; versionId: Id<"canvasVersions"> }> {
  const updateId = await ctx.db.insert("entityUpdates", {
    updatedTime: Date.now(),
  })

  // Get the user's preferred default models, if any
  const userPreferences = await ctx.db
    .query("userPreferences")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .unique()

  // get the app-wide default models in case user has not set any preferences
  const fallbackModels = await getAppDefaultModelDbIds(ctx)

  const canvasModelsToInitialize = {
    promptModelId:
      userPreferences?.defaultPromptModelId || fallbackModels.promptModelId,
    refineModelId:
      userPreferences?.defaultRefineModelId || fallbackModels.refineModelId,
  }
  const evalsModelToInitialize =
    userPreferences?.defaultEvalsModelId || fallbackModels.evalsModelId
  const evalToInitialize = {
    modelId: evalsModelToInitialize,
    isRequired: true,
    weight: 1,
    type: "pass_fail" as const,
  }

  const canvasId = await ctx.db.insert("canvases", {
    userId,
    entityUpdate: updateId,
  })

  const versionId = await ctx.db.insert("canvasVersions", {
    canvasId,
    versionNo: 1,
    isDraft: false,
    ...canvasModelsToInitialize,
  })

  await ctx.db.insert("evals", {
    canvasVersionId: versionId,
    ...evalToInitialize,
  })

  const draftVersionId = await ctx.db.insert("canvasVersions", {
    canvasId,
    parentVersionId: versionId,
    isDraft: true,
    hasBeenEdited: false,
    ...canvasModelsToInitialize,
  })

  await ctx.db.insert("evals", {
    canvasVersionId: draftVersionId,
    ...evalToInitialize,
  })

  return { canvasId, versionId: draftVersionId }
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

// Delete a canvas and all of its related data (versions, evals, entityUpdates)
// This is reused by both the deleteCanvas mutation and folder deletion for performance and consistency.
export async function deleteCanvasDeep(
  ctx: MutationCtx,
  canvasId: Id<"canvases">,
) {
  const canvas = await ctx.db.get(canvasId)
  if (!canvas) return

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
}
