"use client"

import { ComponentProps, type ReactNode } from "react"
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
import { InlineRename } from "@/components/inline-rename"
import { useDraggable } from "@/hooks/use-draggable"
import { useDropZone } from "@/hooks/use-drop-zone"
import { DndProvider } from "@/providers/DndProvider"
import { cn } from "@/lib/utils"
import { ConfirmModal } from "./confirm-modal"

type CanvasLike = {
  _id: Id<"canvases">
  name?: string
  [key: string]: unknown
}

type FolderWithCanvases = {
  folderId: Id<"folders"> | null
  folderName: string
  canvases: CanvasLike[]
}

type CanvasDragData = {
  canvasId: Id<"canvases">
  fromFolderId: Id<"folders"> | "root"
}

function useMoveCanvasToFolder(activeCanvasId: Id<"canvases">) {
  const moveCanvasToFolderMutation = useMutation(api.public.moveCanvasToFolder)

  return async (
    canvasId: Id<"canvases">,
    targetFolderId: Id<"folders"> | "root",
  ) => {
    await moveCanvasToFolderMutation({
      canvasId,
      folderId: targetFolderId === "root" ? undefined : targetFolderId,
    })
    if (canvasId === activeCanvasId) {
      // keep URL in sync if active canvas moved
      window.history.replaceState(
        {},
        "",
        `/app/folder/${targetFolderId}/canvas/${canvasId}`,
      )
    }
  }
}

export function CanvasRow({
  canvas,
  folderId,
  activeCanvasId,
  isSubItem = false,
}: {
  canvas: CanvasLike
  folderId: Id<"folders"> | "root"
  activeCanvasId: Id<"canvases">
  isSubItem?: boolean
}) {
  const router = useRouter()
  const { state, dispatch } = useAppContext()
  const { isMobile } = useSidebar()

  const isRenaming = state.renamingCanvasId === canvas._id
  const { dragProps, isDragging } = useDraggable<CanvasDragData>({
    type: `canvas:${folderId}`,
    data: { canvasId: canvas._id, fromFolderId: folderId },
    effectAllowed: "move",
  })

  const renameCanvasMutation = useMutation(api.public.renameCanvas)

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

  const handleCancelRename = () => dispatch({ type: "CANCEL_RENAMING_CANVAS" })

  const MenuButtonComponent = isSubItem
    ? SidebarMenuSubButton
    : SidebarMenuButton
  const MenuItemComponent = isSubItem ? SidebarMenuSubItem : SidebarMenuItem

  return (
    <MenuItemComponent className="group/canvas">
      {isRenaming ? (
        <div draggable={false} onDragStart={(e) => e.stopPropagation()}>
          <InlineRename
            icon={<FileText className="h-4 w-4 flex-shrink-0" />}
            value={state.renamingCanvasName}
            onChange={(v) =>
              dispatch({ type: "SET_RENAMING_CANVAS_NAME", payload: v })
            }
            onConfirm={handleConfirmRename}
            onCancel={handleCancelRename}
          />
        </div>
      ) : (
        <>
          <MenuButtonComponent
            {...dragProps}
            isActive={canvas._id === activeCanvasId}
            onClick={
              canvas._id === activeCanvasId
                ? undefined
                : () =>
                    router.push(`/app/folder/${folderId}/canvas/${canvas._id}`)
            }
            className={`$
              {canvas._id === activeCanvasId ? "" : "cursor-pointer"}
            ${isDragging ? "opacity-60" : ""}`}
          >
            <FileText />
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
                    dispatch({
                      type: "START_RENAMING_CANVAS",
                      payload: {
                        canvasId: canvas._id,
                        currentName: canvas.name ?? "Untitled Canvas",
                      },
                    })
                  }
                >
                  <span className="text-sm">Rename</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={state.canvasDeleteInProgress}
                  onClick={() =>
                    dispatch({
                      type: "OPEN_DELETE_CANVAS_MODAL",
                      payload: {
                        canvasId: canvas._id,
                        canvasName: canvas.name ?? "Untitled Canvas",
                      },
                    })
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

export function FolderRow({
  folder,
  folders,
  activeCanvasId,
}: {
  folder: FolderWithCanvases & { folderId: Id<"folders"> }
  folders: Array<FolderWithCanvases & { folderId: Id<"folders"> }>
  activeCanvasId: Id<"canvases">
}) {
  const { state, dispatch } = useAppContext()
  const { isMobile } = useSidebar()

  const renameFolderMutation = useMutation(api.public.renameFolder)
  const moveCanvas = useMoveCanvasToFolder(activeCanvasId)

  const acceptTypes = [
    "canvas:root",
    ...folders
      .filter((f) => f.folderId !== folder.folderId)
      .map((f) => `canvas:${f.folderId}`),
  ]

  const { dropProps, isOver } = useDropZone<CanvasDragData>({
    accept: acceptTypes,
    onDrop: (env) => {
      const { canvasId, fromFolderId } = env.data
      if (!canvasId || !folder.folderId) return
      if (fromFolderId === folder.folderId) return
      void moveCanvas(canvasId, folder.folderId)
    },
    dropEffect: "move",
  })

  const handleConfirmRenameFolder = async () => {
    if (!state.renamingFolderId || !state.renamingFolderName.trim()) return

    try {
      await renameFolderMutation({
        folderId: state.renamingFolderId,
        name: state.renamingFolderName.trim(),
      })
      dispatch({ type: "CANCEL_RENAMING_FOLDER" })
    } catch (error) {
      console.error("Failed to rename folder:", error)
    }
  }

  const handleCancelRenameFolder = () =>
    dispatch({ type: "CANCEL_RENAMING_FOLDER" })

  return (
    <SidebarMenuItem>
      {state.renamingFolderId === folder.folderId ? (
        <div draggable={false} onDragStart={(e) => e.stopPropagation()}>
          <InlineRename
            icon={<Folder className="h-4 w-4 flex-shrink-0" />}
            value={state.renamingFolderName}
            onChange={(v) =>
              dispatch({
                type: "SET_RENAMING_FOLDER_NAME",
                payload: v,
              })
            }
            onConfirm={handleConfirmRenameFolder}
            onCancel={handleCancelRenameFolder}
          />
        </div>
      ) : (
        <>
          <SidebarMenuButton
            {...dropProps}
            className={`peer/folder cursor-pointer ${
              isOver ? "ring-2 ring-muted-foreground rounded-md" : ""
            }`}
            onClick={() =>
              dispatch({
                type: "TOGGLE_FOLDER",
                payload: folder.folderId,
              })
            }
            aria-expanded={!!state.openFolders[folder.folderId]}
          >
            <Folder />
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
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() =>
                    dispatch({
                      type: "START_RENAMING_FOLDER",
                      payload: {
                        folderId: folder.folderId,
                        currentName: folder.folderName,
                      },
                    })
                  }
                >
                  <span className="text-sm">Rename</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() =>
                    dispatch({
                      type: "OPEN_DELETE_FOLDER_MODAL",
                      payload: {
                        folderId: folder.folderId,
                        folderName: folder.folderName,
                      },
                    })
                  }
                >
                  <span className="text-sm">Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>
          {state.openFolders[folder.folderId] && (
            <SidebarMenuSub>
              {folder.canvases.length ? (
                folder.canvases.map((canvas) => (
                  <CanvasRow
                    key={`${canvas._id}`}
                    canvas={canvas}
                    folderId={folder.folderId}
                    activeCanvasId={activeCanvasId}
                    isSubItem
                  />
                ))
              ) : (
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton aria-disabled>
                    <Ghost />
                    <span className="italic pr-2">Empty Folder</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )}
            </SidebarMenuSub>
          )}
        </>
      )}
    </SidebarMenuItem>
  )
}

export function RootDropZone({
  children,
  folders,
  activeCanvasId,
  className,
}: {
  children: ReactNode
  folders: Array<FolderWithCanvases & { folderId: Id<"folders"> }>
  activeCanvasId: Id<"canvases">
  className?: string
}) {
  const moveCanvas = useMoveCanvasToFolder(activeCanvasId)

  const acceptFromFolders = folders.map((f) => `canvas:${f.folderId}`)
  const { dropProps, isOver } = useDropZone<CanvasDragData>({
    accept: acceptFromFolders,
    onDrop: (env) => {
      const { canvasId, fromFolderId } = env.data
      if (!canvasId) return
      if (fromFolderId === "root") return
      void moveCanvas(canvasId, "root")
    },
    dropEffect: "move",
  })

  return (
    <div
      {...dropProps}
      className={cn(
        isOver ? "ring-2 ring-muted-foreground rounded-md" : undefined,
        className,
      )}
    >
      {children}
    </div>
  )
}

export function AppSidebar({
  activeCanvasId,
  preloadedFoldersWithCanvases,
  preloadedCurrentUser,
  ...props
}: {
  activeCanvasId: Id<"canvases">
  preloadedFoldersWithCanvases: Preloaded<
    typeof api.public.getFoldersWithCanvases
  >
  preloadedCurrentUser: Preloaded<typeof api.public.getCurrentUser>
} & ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const { state, dispatch } = useAppContext()

  const foldersWithCanvases = usePreloadedQuery(preloadedFoldersWithCanvases)
  const currentUser = usePreloadedQuery(preloadedCurrentUser)

  const activeFolderId =
    foldersWithCanvases.find((folder) =>
      folder.canvases.some((canvas) => canvas._id === activeCanvasId),
    )?.folderId ?? "root"

  const newCanvasMutation = useMutation(api.public.createNewCanvas)
  const newFolderMutation = useMutation(api.public.createNewFolder)
  const deleteCanvasMutation = useMutation(api.public.deleteCanvas)
  const deleteFolderMutation = useMutation(api.public.deleteFolder)

  const allFolders = (foldersWithCanvases ??
    []) as unknown as FolderWithCanvases[]
  const root = allFolders.find((f) => f.folderId === null)
  const folders = allFolders.filter(
    (f): f is FolderWithCanvases & { folderId: Id<"folders"> } =>
      f.folderId !== null,
  )

  const handleCreateNewCanvas = async () => {
    const { canvasId, versionId } = await newCanvasMutation()
    router.push(`/app/folder/root/canvas/${canvasId}/version/${versionId}`)
  }

  const handleConfirmNewFolder = async () => {
    if (!state.newFolderName.trim()) return
    dispatch({ type: "CLOSE_NEW_FOLDER_MODAL" })
    await newFolderMutation({ name: state.newFolderName.trim() })
  }

  const handleCloseDeleteCanvasModal = () => {
    dispatch({ type: "CLOSE_DELETE_CANVAS_MODAL" })
  }

  const handleConfirmDeleteCanvas = async () => {
    if (!state.canvasIdToDelete) return
    dispatch({ type: "BEGIN_DELETE_CANVAS" })
    try {
      const isActive = state.canvasIdToDelete === activeCanvasId
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

  const handleCloseDeleteFolderModal = () => {
    dispatch({ type: "CLOSE_DELETE_FOLDER_MODAL" })
  }

  const handleConfirmDeleteFolder = async (cascade: boolean) => {
    if (!state.folderIdToDelete) return
    dispatch({ type: "BEGIN_DELETE_FOLDER" })
    try {
      const isActiveFolder = state.folderIdToDelete === activeFolderId

      if (isActiveFolder) {
        // Redirect to safe location first, similar to canvas deletion page strategy
        dispatch({ type: "FINISH_DELETE_FOLDER" })
        dispatch({ type: "CLOSE_DELETE_FOLDER_MODAL" })
        const cascadeParam = cascade ? "1" : "0"
        router.replace(
          `/app/folder/${state.folderIdToDelete}/delete?cascade=${cascadeParam}`,
        )
        return
      }

      await deleteFolderMutation({
        folderId: state.folderIdToDelete,
        cascade,
      })
      dispatch({ type: "FINISH_DELETE_FOLDER" })
      dispatch({ type: "CLOSE_DELETE_FOLDER_MODAL" })
    } catch (error) {
      console.error("Failed to delete folder:", error)
    }
  }

  // Note: Probably don't need this ChatGPT generated snippet below
  // but keeping it around just in case.

  // For SSR safety, only render after mount
  // const [mounted, setMounted] = React.useState(false)
  // React.useEffect(() => setMounted(true), [])
  // if (!mounted) return null

  return (
    <DndProvider>
      <Sidebar {...props}>
        <SidebarHeader className="p-0">
          <h1 className="flex h-16 shrink-0 items-center border-b px-4 text-lg font-semibold">
            Iterative Canvas
          </h1>
          <SidebarMenu className="p-2">
            <SidebarMenuItem>
              <SidebarMenuButton
                className="cursor-pointer"
                onClick={handleCreateNewCanvas}
              >
                <Plus />
                <span>New Canvas</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="cursor-pointer"
                onClick={() => dispatch({ type: "OPEN_NEW_FOLDER_MODAL" })}
              >
                <FolderPlus />
                <span>New Folder</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton className="cursor-pointer" onClick={() => {}}>
                <Search />
                <span>Search</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          {/* IDK. It works. */}
          <SidebarSeparator className="-ml-[0.01rem]" />
        </SidebarHeader>

        <SidebarContent className="overflow-x-hidden overflow-y-auto">
          {/* Folders */}
          {folders.length > 0 && (
            <>
              <SidebarGroup className="mt-2">
                <SidebarGroupContent>
                  <SidebarMenu>
                    {folders.map((folder) => (
                      <FolderRow
                        key={`${folder.folderId}`}
                        folder={folder}
                        folders={folders}
                        activeCanvasId={activeCanvasId}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarSeparator />
            </>
          )}

          {/* Canvases not in a folder (root) */}
          <RootDropZone
            folders={folders}
            activeCanvasId={activeCanvasId}
            className={folders.length > 0 ? undefined : "mt-2"}
          >
            {root && root.canvases.length > 0 ? (
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {root.canvases.map((canvas) => (
                      <CanvasRow
                        key={`${canvas._id}`}
                        canvas={canvas}
                        folderId="root"
                        activeCanvasId={activeCanvasId}
                      />
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
          </RootDropZone>
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
              dispatch({
                type: "SET_NEW_FOLDER_NAME",
                payload: e.target.value,
              })
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
      <ConfirmModal
        open={state.showDeleteCanvasModal}
        onOpenChange={() => dispatch({ type: "TOGGLE_DELETE_CANVAS_MODAL" })}
        title="Delete Canvas"
        variant="destructive"
        description={
          <>
            Are you sure you want to delete{" "}
            <span className="font-bold">{state.canvasNameToDelete}</span>? This
            action cannot be undone. All versions, evals, and related data will
            be permanently deleted.
          </>
        }
        onConfirm={handleConfirmDeleteCanvas}
        onCancel={handleCloseDeleteCanvasModal}
      />
      <ConfirmModal
        open={state.showDeleteFolderModal}
        onOpenChange={() => dispatch({ type: "TOGGLE_DELETE_FOLDER_MODAL" })}
        title="Delete Folder"
        variant="destructive"
        description={
          <>
            Are you sure you want to delete folder{" "}
            <span className="font-bold">{state.folderNameToDelete}</span>? This
            action cannot be undone.
          </>
        }
        onConfirm={() => handleConfirmDeleteFolder(false)}
        onCancel={handleCloseDeleteFolderModal}
        splitActions={[
          {
            label: state.folderDeleteInProgress
              ? "Deleting..."
              : "Delete Folder",
            onClick: () => handleConfirmDeleteFolder(false),
            destructive: true,
          },
          {
            label: state.folderDeleteInProgress
              ? "Deleting..."
              : "Delete Folder + Canvases",
            onClick: () => handleConfirmDeleteFolder(true),
            destructive: true,
          },
        ]}
      />
    </DndProvider>
  )
}
