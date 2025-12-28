import { Card } from "../ui/card"
import { PromptInput } from "./prompt-input"
import { PromptHeader } from "./prompt-header"
import { Preloaded } from "convex/react"
import { api } from "@/convex/_generated/api"

type PromptSectionProps = {
  onMaximize?: () => void
  onRestore?: () => void
  isMaximized?: boolean
  preloadedCanvasVersion?: Preloaded<typeof api.public.getCanvasVersionById>
  preloadedAvailableModels?: Preloaded<typeof api.public.getAvailableModels>
}

export function PromptSection({
  onMaximize,
  onRestore,
  isMaximized,
  preloadedCanvasVersion,
  preloadedAvailableModels,
}: PromptSectionProps) {
  return (
    <Card className="flex flex-col h-full border-none shadow-none gap-4 py-5">
      <PromptHeader
        onMaximize={onMaximize}
        onRestore={onRestore}
        isMaximized={isMaximized}
        preloadedCanvasVersion={preloadedCanvasVersion}
        preloadedAvailableModels={preloadedAvailableModels}
      />
      <PromptInput preloadedCanvasVersion={preloadedCanvasVersion} />
    </Card>
  )
}
