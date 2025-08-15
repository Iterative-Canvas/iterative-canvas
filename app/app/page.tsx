import { redirect } from "next/navigation"
import { fetchQuery } from "convex/nextjs"
import { api } from "@/convex/_generated/api"
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server"

export default async function AppEntry() {
  const token = await convexAuthNextjsToken() // auth token for Convex (server)
  if (!token) redirect("/signin")

  const { folderId, canvasId, versionId } = await fetchQuery(
    api.getDefaultAppUrlPathParams.getDefaultAppUrlPathParams,
    {},
    { token },
  )

  redirect(`/app/folder/${folderId}/canvas/${canvasId}/version/${versionId}`)
}
