import { preloadQuery } from "convex/nextjs"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { api } from "@/convex/_generated/api"
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server"
import { redirect } from "next/navigation"

export default async function App({
  params,
}: {
  params: Promise<{ folderId: string; canvasId: string; versionId: string }>
}) {
  const token = await convexAuthNextjsToken()
  if (!token) redirect("/signin")

  const { folderId, canvasId, versionId } = await params

  const foldersWithCanvases = await preloadQuery(
    api.public.getFoldersWithCanvases,
    {},
    { token },
  )

  const currentUser = await preloadQuery(
    api.public.getCurrentUser,
    {},
    { token },
  )

  return (
    <SidebarProvider>
      <AppSidebar
        activeFolderId={folderId}
        activeCanvasId={canvasId}
        activeVersionId={versionId}
        preloadedFoldersWithCanvases={foldersWithCanvases}
        preloadedCurrentUser={currentUser}
      />
      <SidebarInset>
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 items-center justify-center">
            <h1 className="text-2xl font-bold">
              Create a canvas to get started
            </h1>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
