"use client"

import { Separator } from "@radix-ui/react-separator"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  History as HistoryIcon,
  Clock,
  Share,
  Eye,
  Copy,
  Download,
  Archive,
  Trash2,
} from "lucide-react"
import { Preloaded, usePreloadedQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

const actionButtons = [
  { icon: HistoryIcon, label: "History" },
  { icon: Clock, label: "Recent" },
  { icon: Share, label: "Share" },
  { icon: Eye, label: "Preview" },
  { icon: Copy, label: "Copy" },
  { icon: Download, label: "Download" },
  { icon: Archive, label: "Archive" },
  { icon: Trash2, label: "Delete" },
]

export const AppHeader = ({
  preloadedCanvas,
  preloadedCanvasVersion,
}: {
  preloadedCanvas: Preloaded<typeof api.public.getCanvasById>
  preloadedCanvasVersion: Preloaded<
    typeof api.public.getCanvasVersionNumberById
  >
}) => {
  const canvas = usePreloadedQuery(preloadedCanvas)
  const { canvasVersionNo } = usePreloadedQuery(preloadedCanvasVersion)

  const prettyVersion = `v${canvasVersionNo}`

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-2 w-px bg-sidebar-border h-6"
      />
      <div className="flex flex-1 items-center gap-2">
        <h1 className="text-lg font-semibold">
          {canvas.name ?? "Untitled Canvas"} • {prettyVersion}
        </h1>
      </div>
      <div className="flex items-center gap-1">
        {actionButtons.map((button, index) => (
          <Button key={index} variant="ghost" size="icon" className="h-8 w-8">
            <button.icon />
            <span className="sr-only">{button.label}</span>
          </Button>
        ))}
      </div>
    </header>
  )
}
