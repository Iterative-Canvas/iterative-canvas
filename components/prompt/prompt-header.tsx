"use client"

import { Sparkles, Copy, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardHeader, CardTitle } from "@/components/ui/card"
import ModelCombobox from "@/components/ai-elements/model-combobox"
import { usePreloadedQuery, useMutation } from "convex/react"
import { Preloaded } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useMemo } from "react"
import type { Doc } from "@/convex/_generated/dataModel"

type PromptHeaderProps = {
  onMaximize?: () => void
  onRestore?: () => void
  isMaximized?: boolean
  preloadedCanvasVersion?: Preloaded<typeof api.public.getCanvasVersionById>
  preloadedAvailableModels?: Preloaded<typeof api.public.getAvailableModels>
}

export function PromptHeader({
  onMaximize,
  onRestore,
  isMaximized = false,
  preloadedCanvasVersion,
  preloadedAvailableModels,
}: PromptHeaderProps) {
  const handleToggle = isMaximized ? onRestore : onMaximize

  // Use preloaded query - it's reactive and will update when data changes
  const canvasVersion = preloadedCanvasVersion
    ? usePreloadedQuery(preloadedCanvasVersion)
    : null

  const versionId = canvasVersion?._id

  // Get available models from preloaded query - also reactive
  const availableModels = preloadedAvailableModels
    ? usePreloadedQuery(preloadedAvailableModels)
    : []

  // Find the selected model from the canvas version's promptModelId
  const selectedModel = useMemo(() => {
    if (!canvasVersion?.promptModelId || !availableModels) {
      return undefined
    }
    return (
      availableModels.find((m) => m._id === canvasVersion.promptModelId) ??
      undefined
    )
  }, [canvasVersion?.promptModelId, availableModels])

  // Mutation to update the prompt model
  const updatePromptModel = useMutation(api.public.updateCanvasVersionPromptModel)

  const handleModelChange = async (
    model: Doc<"aiGatewayModels"> | undefined,
  ) => {
    if (!versionId) return
    await updatePromptModel({
      versionId,
      promptModelId: model?._id,
    })
  }

  return (
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-base font-medium">Prompt</CardTitle>
      <div className="flex items-center gap-1">
        <ModelCombobox
          value={selectedModel}
          onChange={handleModelChange}
          className="h-6"
          availableModels={availableModels}
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
