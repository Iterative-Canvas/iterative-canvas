import { Card } from "../ui/card"
import { PromptInput } from "./prompt-input"
import { PromptHeader } from "./prompt-header"

export function PromptSection() {
  return (
    <Card className="flex flex-col h-full border-none shadow-none gap-4 py-5">
      <PromptHeader />
      <PromptInput />
    </Card>
  )
}
