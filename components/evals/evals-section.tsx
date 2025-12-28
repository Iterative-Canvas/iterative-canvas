import { Card } from "@/components/ui/card"
import { EvalsContent } from "./evals-content"
import { EvalsHeader } from "./evals-header"
import { Preloaded } from "convex/react"
import { api } from "@/convex/_generated/api"

type EvalsSectionProps = {
  onMaximize?: () => void
  onRestore?: () => void
  isMaximized?: boolean
  preloadedAvailableModels?: Preloaded<typeof api.public.getAvailableModels>
}

export function EvalsSection({
  onMaximize,
  onRestore,
  isMaximized,
  preloadedAvailableModels,
}: EvalsSectionProps) {
  return (
    <Card className="flex flex-col h-full border-none shadow-none gap-4 py-5">
      <EvalsHeader
        onMaximize={onMaximize}
        onRestore={onRestore}
        isMaximized={isMaximized}
      />
      <EvalsContent preloadedAvailableModels={preloadedAvailableModels} />
    </Card>
  )
}
