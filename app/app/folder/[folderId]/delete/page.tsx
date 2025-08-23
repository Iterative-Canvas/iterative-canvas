import { redirect } from "next/navigation"
import { fetchMutation } from "convex/nextjs"
import { api } from "@/convex/_generated/api"
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server"
import { Id } from "@/convex/_generated/dataModel"

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ folderId: Id<"folders"> }>
  searchParams: Promise<{ cascade?: string }>
}) {
  const token = await convexAuthNextjsToken()
  if (!token) redirect("/signin")

  const { folderId } = await params
  const { cascade } = await searchParams
  const cascadeBool = cascade === "1"

  await fetchMutation(
    api.public.deleteFolder,
    { folderId, cascade: cascadeBool },
    { token },
  )

  const {
    folderId: nextFolderId,
    canvasId,
    versionId,
  } = await fetchMutation(api.public.getDefaultAppUrlPathParams, {}, { token })

  redirect(
    `/app/folder/${nextFolderId}/canvas/${canvasId}/version/${versionId}`,
  )
}
