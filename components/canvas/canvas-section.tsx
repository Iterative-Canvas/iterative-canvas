"use client"

import { Card } from "@/components/ui/card"
import { CanvasHeader } from "./canvas-header"
import { CanvasContent } from "./canvas-content"

type CanvasSectionProps = {
  onMaximize?: () => void
  onRestore?: () => void
  isMaximized?: boolean
}

export function CanvasSection({
  onMaximize,
  onRestore,
  isMaximized,
}: CanvasSectionProps) {
  return (
    <Card className="flex flex-col h-full border-none shadow-none gap-4 py-5">
      <CanvasHeader
        onMaximize={onMaximize}
        onRestore={onRestore}
        isMaximized={isMaximized}
      />
      <CanvasContent />
    </Card>
  )
}
