"use client"

import { Sparkles, Copy, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardHeader, CardTitle } from "@/components/ui/card"
import ModelCombobox from "@/components/ai-elements/model-combobox"
import type { Doc, Id } from "@/convex/_generated/dataModel"

type PromptHeaderProps = {
  modelId?: Id<"aiGatewayModels">
  onModelChange?: (model: Doc<"aiGatewayModels"> | undefined) => void
  onMaximize?: () => void
  onRestore?: () => void
  isMaximized?: boolean
}

export function PromptHeader({
  modelId,
  onModelChange,
  onMaximize,
  onRestore,
  isMaximized = false,
}: PromptHeaderProps) {
  const handleToggle = isMaximized ? onRestore : onMaximize

  return (
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-base font-medium">Prompt</CardTitle>
      <div className="flex items-center gap-1">
        <ModelCombobox
          valueId={modelId}
          onChange={onModelChange}
          className="h-6"
        />
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Sparkles />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Copy />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleToggle}
          disabled={!handleToggle}
          aria-label={
            isMaximized ? "Restore prompt panel" : "Maximize prompt panel"
          }
        >
          {isMaximized ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </div>
    </CardHeader>
  )
}
