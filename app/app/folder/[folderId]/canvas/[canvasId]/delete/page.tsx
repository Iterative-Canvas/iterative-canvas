import { redirect } from "next/navigation"
import { fetchMutation } from "convex/nextjs"
import { api } from "@/convex/_generated/api"
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server"
import { Id } from "@/convex/_generated/dataModel"

export default async function Page({
  params,
}: {
  params: Promise<{ canvasId: Id<"canvases"> }>
}) {
  const token = await convexAuthNextjsToken()
  if (!token) redirect("/signin")

  const { canvasId: canvasToDelete } = await params

  await fetchMutation(
    api.public.deleteCanvas,
    { canvasId: canvasToDelete },
    { token },
  )

  const { folderId, canvasId, versionId } = await fetchMutation(
    api.public.getDefaultAppUrlPathParams,
    {},
    { token },
  )

  redirect(`/app/folder/${folderId}/canvas/${canvasId}/version/${versionId}`)
}
