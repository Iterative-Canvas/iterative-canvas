"use client"

import { Card } from "@/components/ui/card"
import { EvalsContent } from "./evals-content"
import { EvalsHeader } from "./evals-header"
import type { Doc } from "@/convex/_generated/dataModel"

type EvalsSectionProps = {
  canvasVersion: Doc<"canvasVersions">
  onMaximize?: () => void
  onRestore?: () => void
  isMaximized?: boolean
}

export function EvalsSection({
  canvasVersion,
  onMaximize,
  onRestore,
  isMaximized,
}: EvalsSectionProps) {
  return (
    <Card className="flex flex-col h-full border-none shadow-none gap-4 py-5">
      <EvalsHeader
        onMaximize={onMaximize}
        onRestore={onRestore}
        isMaximized={isMaximized}
      />
      <EvalsContent canvasVersion={canvasVersion} />
    </Card>
  )
}
