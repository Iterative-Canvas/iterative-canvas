import { preloadQuery } from "convex/nextjs"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { api } from "@/convex/_generated/api"
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server"
import { redirect } from "next/navigation"
import { Id } from "@/convex/_generated/dataModel"
import React from "react"

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{
    folderId: Id<"folders">
    canvasId: Id<"canvases">
  }>
} & Readonly<{ children: React.ReactNode }>) {
  const token = await convexAuthNextjsToken()
  if (!token) redirect("/signin")

  const { canvasId } = await params

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
        activeCanvasId={canvasId}
        preloadedFoldersWithCanvases={foldersWithCanvases}
        preloadedCurrentUser={currentUser}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
