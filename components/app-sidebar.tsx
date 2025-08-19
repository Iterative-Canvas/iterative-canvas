"use client"

import { ComponentProps } from "react"
import { FileText, Folder, FolderPlus, Ghost, Plus, Search } from "lucide-react"
import {
  useMutation,
  usePreloadedQuery,
  Preloaded,
  useConvex,
} from "convex/react"
import { api } from "../convex/_generated/api"
import { Id } from "../convex/_generated/dataModel"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { SignOutButton } from "./signout-button"
import { useRouter } from "next/navigation"
import { useAppContext } from "@/providers/AppProvider"

export function AppSidebar({
  activeFolderId,
  activeCanvasId,
  activeVersionId,
  preloadedFoldersWithCanvases,
  preloadedCurrentUser,
  ...props
}: {
  activeFolderId: string
  activeCanvasId: string
  activeVersionId: string
  preloadedFoldersWithCanvases: Preloaded<
    typeof api.public.getFoldersWithCanvases
  >
  preloadedCurrentUser: Preloaded<typeof api.public.getCurrentUser>
} & ComponentProps<typeof Sidebar>) {
  const convex = useConvex()
  const router = useRouter()
  const { state, dispatch } = useAppContext()

  const foldersWithCanvases = usePreloadedQuery(preloadedFoldersWithCanvases)
  const currentUser = usePreloadedQuery(preloadedCurrentUser)

  const newCanvasMutation = useMutation(api.public.createNewCanvas)
  const newFolderMutation = useMutation(api.public.createNewFolder)

  const createNewCanvas = async () => {
    const { canvasId, versionId } = await newCanvasMutation()
    router.push(`/app/folder/root/canvas/${canvasId}/version/${versionId}`)
  }

  const createNewFolder = async (name: string) => {
    await newFolderMutation({ name })
  }

  const handleConfirmNewFolder = async () => {
    if (!state.newFolderName.trim()) return
    await createNewFolder(state.newFolderName.trim())
    dispatch({ type: "CLOSE_NEW_FOLDER_MODAL" })
  }

  const handleCanvasSelect = async (
    folderId: Id<"folders">,
    canvasId: Id<"canvases">,
  ) => {
    const { versionId } = await convex.query(
      api.public.getActiveVersionIdForCanvas,
      {
        canvasId,
      },
    )

    router.push(
      `/app/folder/${folderId}/canvas/${canvasId}/version/${versionId}`,
    )
  }

  // Separate root and folders
  const root = foldersWithCanvases?.find((f) => f.folderId === null)
  const folders = foldersWithCanvases?.filter((f) => f.folderId !== null) ?? []

  // Note: Probably don't need this ChatGPT generated snippet below
  // but keeping it around just in case.

  // For SSR safety, only render after mount
  // const [mounted, setMounted] = React.useState(false)
  // React.useEffect(() => setMounted(true), [])
  // if (!mounted) return null

  return (
    <>
      <Sidebar {...props}>
        <SidebarHeader>
          <div className="px-2 py-2">
            <h1 className="text-lg font-semibold text-sidebar-foreground">
              Iterative Canvas
            </h1>
          </div>
        </SidebarHeader>

        <SidebarContent className="overflow-x-hidden overflow-y-auto">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="cursor-pointer"
                    onClick={createNewCanvas}
                  >
                    <Plus className="h-4 w-4" />
                    <span>New Canvas</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="cursor-pointer"
                    onClick={() => dispatch({ type: "OPEN_NEW_FOLDER_MODAL" })}
                  >
                    <FolderPlus className="h-4 w-4" />
                    <span>New Folder</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="cursor-pointer"
                    onClick={() => {}}
                  >
                    <Search className="h-4 w-4" />
                    <span>Search</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          {/* Folders */}
          {folders.length > 0 && (
            <>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {folders.map((folder) => (
                      <SidebarMenuItem key={folder.folderId as string}>
                        <SidebarMenuButton
                          // The `peer` className works in tandem with the commented
                          // out dropdown menu below.
                          className="peer cursor-pointer"
                          onClick={() =>
                            dispatch({
                              type: "TOGGLE_FOLDER",
                              payload: folder.folderId as Id<"folders">,
                            })
                          }
                          aria-expanded={
                            !!state.openFolders[
                              folder.folderId as Id<"folders">
                            ]
                          }
                        >
                          <Folder className="h-4 w-4" />
                          <span>{folder.folderName}</span>
                        </SidebarMenuButton>
                        {/* TODO: This is being glitchy for some reason */}
                        {/* <div className="invisible peer-hover:visible">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuAction>
                              <MoreHorizontal className="h-4 w-4" />
                            </SidebarMenuAction>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start">
                            <DropdownMenuItem>
                              <span>Rename</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <span>Duplicate</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div> */}
                        {state.openFolders[
                          folder.folderId as Id<"folders">
                        ] && (
                          <SidebarMenuSub>
                            {folder.canvases.length ? (
                              folder.canvases.map((canvas) => (
                                <SidebarMenuSubItem key={canvas._id}>
                                  <SidebarMenuSubButton
                                    isActive={canvas._id === activeCanvasId}
                                    onClick={() =>
                                      handleCanvasSelect(
                                        folder.folderId!,
                                        canvas._id,
                                      )
                                    }
                                    className="cursor-pointer"
                                  >
                                    <FileText className="h-4 w-4" />
                                    <span>
                                      {canvas.name ?? "Untitled Canvas"}
                                    </span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))
                            ) : (
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton aria-disabled>
                                  <Ghost className="h-4 w-4" />
                                  <span className="italic pr-2">
                                    Empty Folder
                                  </span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )}
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarSeparator />
            </>
          )}

          {/* Canvases not in a folder (root) */}
          {root && root.canvases.length > 0 ? (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {root.canvases.map((canvas) => (
                    <SidebarMenuItem key={canvas._id}>
                      <SidebarMenuButton
                        isActive={canvas._id === activeCanvasId}
                        onClick={() =>
                          handleCanvasSelect(
                            "root" as Id<"folders">,
                            canvas._id,
                          )
                        }
                        className="cursor-pointer"
                      >
                        <FileText className="h-4 w-4" />
                        <span>{canvas.name ?? "Untitled Canvas"}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : (
            <SidebarGroup>
              <SidebarGroupContent className="mt-12 text-center italic">
                {folders.length === 0
                  ? "Create a canvas to get started"
                  : "You do not have any root-level canvases"}
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="h-12 cursor-pointer">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={currentUser.image || "/placeholder.svg"}
                    alt={currentUser.name}
                  />
                  <AvatarFallback>
                    {currentUser.name
                      ? currentUser.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                      : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium">
                    {currentUser.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {currentUser.email}
                  </span>
                </div>
                <SignOutButton className="ml-auto" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <Dialog
        open={state.showNewFolderModal}
        onOpenChange={() => dispatch({ type: "TOGGLE_NEW_FOLDER_MODAL" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Folder name"
            value={state.newFolderName}
            onChange={(e) =>
              dispatch({ type: "SET_NEW_FOLDER_NAME", payload: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && state.newFolderName.trim()) {
                handleConfirmNewFolder()
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => dispatch({ type: "CLOSE_NEW_FOLDER_MODAL" })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmNewFolder}
              disabled={!state.newFolderName.trim()}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
