import { Sparkles, Copy, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardHeader, CardTitle } from "@/components/ui/card"
import ModelCombobox from "@/components/ai-elements/model-combobox"
import { Id } from "@/convex/_generated/dataModel"

type PromptHeaderProps = {
  onMaximize?: () => void
  onRestore?: () => void
  isMaximized?: boolean
}

export function PromptHeader({
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
          defaultValue={{
            _id: "asdfasdf" as Id<"aiGatewayModels">,
            modelId: "goofy/goober-1",
            name: "Goober 1",
            description: "A silly model for silly tasks",
            provider: "GoofyAI",
            input: 2048,
            output: 2048,
            isDeprecated: true,
            _creationTime: Date.now(),
          }}
          onChange={(model) => console.log({ onChangeModel: model })}
          onValidityChange={(valid) => console.log({ comboboxValidity: valid })}
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
