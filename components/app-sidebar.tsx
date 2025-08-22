"use client"

import { ComponentProps } from "react"
import {
  Check,
  FileText,
  Folder,
  FolderPlus,
  Ghost,
  MoreHorizontal,
  Plus,
  Search,
  X,
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

  // Suppress unused prop lint warning until actively needed
  void activeFolderId

  const foldersWithCanvases = usePreloadedQuery(preloadedFoldersWithCanvases)
  const currentUser = usePreloadedQuery(preloadedCurrentUser)

  const newCanvasMutation = useMutation(api.public.createNewCanvas)
  const newFolderMutation = useMutation(api.public.createNewFolder)
  const renameCanvasMutation = useMutation(api.public.renameCanvas)
  const deleteCanvasMutation = useMutation(api.public.deleteCanvas)

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

  const handleStartRenaming = (
    canvasId: Id<"canvases">,
    currentName: string,
  ) => {
    dispatch({
      type: "START_RENAMING_CANVAS",
      payload: { canvasId, currentName },
    })
  }

  const handleConfirmRename = async () => {
    if (!state.renamingCanvasId || !state.renamingCanvasName.trim()) return

    try {
      await renameCanvasMutation({
        canvasId: state.renamingCanvasId,
        name: state.renamingCanvasName.trim(),
      })
      dispatch({ type: "CANCEL_RENAMING_CANVAS" })
    } catch (error) {
      console.error("Failed to rename canvas:", error)
    }
  }

  const handleCancelRename = () => {
    dispatch({ type: "CANCEL_RENAMING_CANVAS" })
  }

  const handleOpenDeleteCanvasModal = (
    canvasId: Id<"canvases">,
    canvasName: string,
  ) => {
    dispatch({
      type: "OPEN_DELETE_CANVAS_MODAL",
      payload: { canvasId, canvasName },
    })
  }

  const handleCloseDeleteCanvasModal = () => {
    dispatch({ type: "CLOSE_DELETE_CANVAS_MODAL" })
  }

  const handleConfirmDeleteCanvas = async () => {
    if (!state.canvasIdToDelete) return
    dispatch({ type: "BEGIN_DELETE_CANVAS" })
    try {
      const isActive = state.canvasIdToDelete === activeCanvasId

      // If deleting the currently active canvas, then we must redirect elsewhere first and handle
      // the deletion there, otherwise Convex will reactively update the UI and the page will crash
      // because the canvas being viewed no longer exists.
      if (isActive) {
        dispatch({ type: "FINISH_DELETE_CANVAS" })
        dispatch({ type: "CLOSE_DELETE_CANVAS_MODAL" })
        router.replace(
          `/app/folder/${activeFolderId}/canvas/${activeCanvasId}/delete`,
        )
        return
      }

      await deleteCanvasMutation({ canvasId: state.canvasIdToDelete })
      dispatch({ type: "FINISH_DELETE_CANVAS" })
      dispatch({ type: "CLOSE_DELETE_CANVAS_MODAL" })
    } catch (error) {
      console.error("Failed to delete canvas:", error)
    }
  }

  const renderCanvasItem = (
    canvas: { _id: Id<"canvases">; name?: string; [key: string]: unknown },
    folderId: Id<"folders"> | "root",
    isSubItem = false,
  ) => {
    const isRenaming = state.renamingCanvasId === canvas._id
    const MenuButtonComponent = isSubItem
      ? SidebarMenuSubButton
      : SidebarMenuButton
    const MenuItemComponent = isSubItem ? SidebarMenuSubItem : SidebarMenuItem

    return (
      <MenuItemComponent className="group/canvas" key={canvas._id}>
        {isRenaming ? (
          <div className="flex items-center gap-1 px-2 py-1">
            <FileText className="h-4 w-4 flex-shrink-0" />
            <Input
              value={state.renamingCanvasName}
              onChange={(e) => {
                const value = e.target.value
                if (value.length <= 75) {
                  dispatch({
                    type: "SET_RENAMING_CANVAS_NAME",
                    payload: value,
                  })
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleConfirmRename()
                } else if (e.key === "Escape") {
                  handleCancelRename()
                }
              }}
              className="h-6 text-sm"
              maxLength={75}
              autoFocus
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 cursor-pointer text-submit hover:text-submit"
              onClick={handleConfirmRename}
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 cursor-pointer text-cancel hover:text-cancel"
              onClick={handleCancelRename}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <MenuButtonComponent
              isActive={canvas._id === activeCanvasId}
              onClick={
                canvas._id === activeCanvasId
                  ? undefined
                  : () =>
                      handleCanvasSelect(folderId as Id<"folders">, canvas._id)
              }
              className={canvas._id === activeCanvasId ? "" : "cursor-pointer"}
            >
              <FileText className="h-4 w-4" />
              <span>{canvas.name ?? "Untitled Canvas"}</span>
            </MenuButtonComponent>
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
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() =>
                      handleStartRenaming(
                        canvas._id,
                        canvas.name ?? "Untitled Canvas",
                      )
                    }
                  >
                    <span className="text-sm">Rename</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={state.canvasDeleteInProgress}
                    onClick={() =>
                      handleOpenDeleteCanvasModal(
                        canvas._id,
                        canvas.name ?? "Untitled Canvas",
                      )
                    }
                  >
                    <span className="text-sm">Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenu>
          </>
        )}
      </MenuItemComponent>
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
                      <SidebarMenuItem key={folder.folderId as string}>
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
                              folder.canvases.map((canvas) =>
                                renderCanvasItem(
                                  canvas,
                                  folder.folderId!,
                                  true,
                                ),
                              )
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
                  {root.canvases.map((canvas) =>
                    renderCanvasItem(canvas, "root", false),
                  )}
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
      {/* Note: I had to patch a bug in the shadcn/ui Dialog component
       ** https://github.com/radix-ui/primitives/issues/1241#issuecomment-2589438039
       */}
      <Dialog
        open={state.showNewFolderModal}
        onOpenChange={() => dispatch({ type: "TOGGLE_NEW_FOLDER_MODAL" })}
      >
        <DialogContent aria-describedby={undefined}>
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
          {/* Note: I had to patch a bug in the shadcn/ui Dialog component
           ** https://github.com/radix-ui/primitives/issues/1241#issuecomment-2589438039
           */}
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
      <Dialog
        open={state.showDeleteCanvasModal}
        onOpenChange={() => dispatch({ type: "TOGGLE_DELETE_CANVAS_MODAL" })}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Delete Canvas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-bold">{state.canvasNameToDelete}</span>? This
            action cannot be undone. All versions, evaluations, and related data
            will be permanently deleted.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseDeleteCanvasModal}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteCanvas}
              className="cursor-pointer"
              disabled={state.canvasDeleteInProgress}
            >
              {state.canvasDeleteInProgress ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
