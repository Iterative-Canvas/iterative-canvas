import { redirect } from "next/navigation"
import { fetchMutation } from "convex/nextjs"
import { api } from "@/convex/_generated/api"
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server"

export default async function AppEntry() {
  const token = await convexAuthNextjsToken()
  if (!token) redirect("/signin")

  const { folderId, canvasId, versionId } = await fetchMutation(
    api.getDefaultAppUrlPathParams.getDefaultAppUrlPathParams,
    {},
    { token },
  )

  redirect(`/app/folder/${folderId}/canvas/${canvasId}/version/${versionId}`)
}
