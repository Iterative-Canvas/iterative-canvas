"use client"

import { useCallback } from "react"
import { useMutation } from "convex/react"
import { Card } from "@/components/ui/card"
import { CanvasHeader } from "./canvas-header"
import { CanvasContent } from "./canvas-content"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"

type CanvasSectionProps = {
  canvasVersion: Doc<"canvasVersions">
  onMaximize?: () => void
  onRestore?: () => void
  isMaximized?: boolean
}

export function CanvasSection({
  canvasVersion,
  onMaximize,
  onRestore,
  isMaximized,
}: CanvasSectionProps) {
  const updateResponse = useMutation(api.public.updateCanvasVersionResponse)

  const handleSaveResponse = useCallback(
    async (response: string) => {
      await updateResponse({
        canvasVersionId: canvasVersion._id,
        response,
      })
    },
    [canvasVersion._id, updateResponse],
  )

  return (
    <Card className="flex flex-col h-full border-none shadow-none gap-4 py-5">
      <CanvasHeader
        onMaximize={onMaximize}
        onRestore={onRestore}
        isMaximized={isMaximized}
      />
      <CanvasContent
        initialMarkdown={canvasVersion.response ?? ""}
        onSave={handleSaveResponse}
      />
    </Card>
  )
}
