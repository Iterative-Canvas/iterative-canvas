import { Card } from "../ui/card"
import { PromptInput } from "./prompt-input"
import { PromptHeader } from "./prompt-header"

type PromptSectionProps = {
  onMaximize?: () => void
  onRestore?: () => void
  isMaximized?: boolean
}

export function PromptSection({
  onMaximize,
  onRestore,
  isMaximized,
}: PromptSectionProps) {
  return (
    <Card className="flex flex-col h-full border-none shadow-none gap-4 py-5">
      <PromptHeader
        onMaximize={onMaximize}
        onRestore={onRestore}
        isMaximized={isMaximized}
      />
      <PromptInput />
    </Card>
  )
}
