import { Card } from "@/components/ui/card"
import { EvalsContent } from "./evals-content"
import { EvalsHeader } from "./evals-header"

export function EvalsSection() {
  return (
    <Card className="flex flex-col h-full border-none shadow-none gap-4 py-5">
      <EvalsHeader />
      <EvalsContent />
    </Card>
  )
}
