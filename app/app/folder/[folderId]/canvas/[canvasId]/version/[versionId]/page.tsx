import { AppContentArea } from "@/components/app-content-area"
import { AppHeader } from "@/components/app-header"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server"
import { preloadQuery } from "convex/nextjs"
import { redirect } from "next/navigation"

export default async function App({
  params,
}: {
  params: Promise<{
    folderId: Id<"folders">
    canvasId: Id<"canvases">
    versionId: Id<"canvasVersions">
  }>
} & Readonly<{ children: React.ReactNode }>) {
  const token = await convexAuthNextjsToken()
  if (!token) redirect("/signin")

  const { folderId: _folderId, canvasId, versionId } = await params

  const [canvas, canvasVersion, availableModels] = await Promise.all([
    preloadQuery(api.public.getCanvasById, { id: canvasId }, { token }),
    preloadQuery(api.public.getCanvasVersionById, { id: versionId }, { token }),
    preloadQuery(api.public.getAvailableModels, {}, { token }),
  ])

  return (
    <>
      <AppHeader
        preloadedCanvas={canvas}
        preloadedCanvasVersion={canvasVersion}
      />
      <AppContentArea
        preloadedCanvasVersion={canvasVersion}
        preloadedAvailableModels={availableModels}
      />
    </>
  )
}
