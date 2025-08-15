import { query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"

export const getDefaultAppUrlPathParams = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Your app logic here:
    // pick the right folder/canvas/version for this user
    const folderId = "1"
    const canvasId = "2"
    const versionId = "3"

    return { folderId, canvasId, versionId }
  },
})
