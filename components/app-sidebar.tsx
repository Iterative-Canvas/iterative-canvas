"use client"

import { ComponentProps } from "react"
import {
  FileText,
  Folder,
  FolderPlus,
  Ghost,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react"
import { useMutation, usePreloadedQuery, Preloaded } from "convex/react"
import { api } from "../convex/_generated/api"
import { Id } from "../convex/_generated/dataModel"
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { SidebarFooter } from "@/components/sidebar-footer"
import { useRouter } from "next/navigation"
import { useAppContext } from "@/providers/AppProvider"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
} from "@radix-ui/react-dropdown-menu"

export function AppSidebar({
  activeFolderId,
  activeCanvasId,
  preloadedFoldersWithCanvases,
  preloadedCurrentUser,
  ...props
}: {
  activeFolderId: Id<"folders">
  activeCanvasId: Id<"canvases">
  preloadedFoldersWithCanvases: Preloaded<
    typeof api.public.getFoldersWithCanvases
  >
  preloadedCurrentUser: Preloaded<typeof api.public.getCurrentUser>
} & ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const { state, dispatch } = useAppContext()
  const { isMobile } = useSidebar()

  const foldersWithCanvases = usePreloadedQuery(preloadedFoldersWithCanvases)
  const currentUser = usePreloadedQuery(preloadedCurrentUser)

  const newCanvasMutation = useMutation(api.public.createNewCanvas)
  const newFolderMutation = useMutation(api.public.createNewFolder)

  const handleCreateNewCanvas = async () => {
    const { canvasId, versionId } = await newCanvasMutation()
    router.push(`/app/folder/root/canvas/${canvasId}/version/${versionId}`)
  }

  const handleConfirmNewFolder = async () => {
    if (!state.newFolderName.trim()) return
    dispatch({ type: "CLOSE_NEW_FOLDER_MODAL" })
    await newFolderMutation({ name: state.newFolderName.trim() })
  }

  const handleCanvasSelect = async (
    folderId: Id<"folders">,
    canvasId: Id<"canvases">,
  ) => {
    router.push(`/app/folder/${folderId}/canvas/${canvasId}`)
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
                    onClick={handleCreateNewCanvas}
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
                      <SidebarMenuItem
                        // className="group/folder"
                        key={folder.folderId as string}
                      >
                        <SidebarMenuButton
                          className="peer/folder cursor-pointer"
                          onClick={() =>
                            dispatch({
                              type: "TOGGLE_FOLDER",
                              payload: folder.folderId!,
                            })
                          }
                          aria-expanded={!!state.openFolders[folder.folderId!]}
                        >
                          <Folder className="h-4 w-4" />
                          <span>{folder.folderName}</span>
                        </SidebarMenuButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuAction className="opacity-0 peer-hover/folder:opacity-100 hover:opacity-100">
                              <MoreHorizontal />
                            </SidebarMenuAction>
                          </DropdownMenuTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuContent
                              side={isMobile ? "bottom" : "right"}
                              align={isMobile ? "end" : "start"}
                              className="z-50 bg-background p-2 border rounded-lg"
                            >
                              <DropdownMenuItem>
                                <span className="text-sm">Rename</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <span className="text-sm">Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenuPortal>
                        </DropdownMenu>
                        {state.openFolders[folder.folderId!] && (
                          <SidebarMenuSub>
                            {folder.canvases.length ? (
                              folder.canvases.map((canvas) => (
                                <SidebarMenuSubItem
                                  className="group/canvas"
                                  key={canvas._id}
                                >
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
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <SidebarMenuAction className="opacity-0 group-hover/canvas:opacity-100">
                                        <MoreHorizontal />
                                      </SidebarMenuAction>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuPortal>
                                      <DropdownMenuContent
                                        side={isMobile ? "bottom" : "right"}
                                        align={isMobile ? "end" : "start"}
                                        className="z-50 bg-background p-2 border rounded-lg"
                                      >
                                        <DropdownMenuItem>
                                          <span className="text-sm">
                                            Rename
                                          </span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
                                          <span className="text-sm">
                                            Delete
                                          </span>
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenuPortal>
                                  </DropdownMenu>
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
                    <SidebarMenuItem className="group/canvas" key={canvas._id}>
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuAction className="opacity-0 group-hover/canvas:opacity-100">
                            <MoreHorizontal />
                          </SidebarMenuAction>
                        </DropdownMenuTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuContent
                            side={isMobile ? "bottom" : "right"}
                            align={isMobile ? "end" : "start"}
                            className="z-50 bg-background p-2 border rounded-lg"
                          >
                            <DropdownMenuItem>
                              <span className="text-sm">Rename</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <span className="text-sm">Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenuPortal>
                      </DropdownMenu>
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
        <SidebarFooter user={currentUser} />
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
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmNewFolder}
              disabled={!state.newFolderName.trim()}
              className="cursor-pointer"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
