import { redirect } from "next/navigation"
import { fetchQuery } from "convex/nextjs"
import { api } from "@/convex/_generated/api"
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server"
import { Id } from "@/convex/_generated/dataModel"

export default async function Page({
  params,
}: {
  params: Promise<{ folderId: Id<"folders">; canvasId: Id<"canvases"> }>
}) {
  const token = await convexAuthNextjsToken()
  if (!token) redirect("/signin")

  const { folderId, canvasId } = await params

  const { draftVersionId } = await fetchQuery(
    api.public.getActiveDraftVersionIdForCanvas,
    { canvasId },
    { token },
  )

  redirect(
    `/app/folder/${folderId}/canvas/${canvasId}/version/${draftVersionId}`,
  )
}
