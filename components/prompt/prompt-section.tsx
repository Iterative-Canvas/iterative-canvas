"use client"

import { useCallback } from "react"
import { useMutation } from "convex/react"
import { Card } from "../ui/card"
import { PromptInput } from "./prompt-input"
import { PromptHeader } from "./prompt-header"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"

type PromptSectionProps = {
  canvasVersion: Doc<"canvasVersions">
  onMaximize?: () => void
  onRestore?: () => void
  isMaximized?: boolean
}

export function PromptSection({
  canvasVersion,
  onMaximize,
  onRestore,
  isMaximized,
}: PromptSectionProps) {
  const updatePromptModel = useMutation(
    api.public.updateCanvasVersionPromptModel,
  )
  const updatePrompt = useMutation(api.public.updateCanvasVersionPrompt)

  const handleModelChange = useCallback(
    async (model: Doc<"aiGatewayModels"> | undefined) => {
      if (!model) return
      try {
        await updatePromptModel({
          canvasVersionId: canvasVersion._id,
          promptModelId: model._id,
        })
      } catch (error) {
        console.error("Failed to update prompt model", error)
      }
    },
    [canvasVersion._id, updatePromptModel],
  )

  const handlePromptSave = useCallback(
    async (prompt: string) => {
      await updatePrompt({
        canvasVersionId: canvasVersion._id,
        prompt,
      })
    },
    [canvasVersion._id, updatePrompt],
  )

  return (
    <Card className="flex flex-col h-full border-none shadow-none gap-4 py-5">
      <PromptHeader
        modelId={canvasVersion.promptModelId}
        onModelChange={handleModelChange}
        onMaximize={onMaximize}
        onRestore={onRestore}
        isMaximized={isMaximized}
      />
      <PromptInput
        initialMarkdown={canvasVersion.prompt ?? ""}
        onSave={handlePromptSave}
      />
    </Card>
  )
}
