"use client"

import { Card } from "@/components/ui/card"
import { CanvasHeader } from "./canvas-header"
import { CanvasContent } from "./canvas-content"
import { Preloaded } from "convex/react"
import { api } from "@/convex/_generated/api"

type CanvasSectionProps = {
  onMaximize?: () => void
  onRestore?: () => void
  isMaximized?: boolean
  preloadedCanvasVersion?: Preloaded<typeof api.public.getCanvasVersionById>
}

export function CanvasSection({
  onMaximize,
  onRestore,
  isMaximized,
  preloadedCanvasVersion,
}: CanvasSectionProps) {
  return (
    <Card className="flex flex-col h-full border-none shadow-none gap-4 py-5">
      <CanvasHeader
        onMaximize={onMaximize}
        onRestore={onRestore}
        isMaximized={isMaximized}
      />
      <CanvasContent preloadedCanvasVersion={preloadedCanvasVersion} />
    </Card>
  )
}
