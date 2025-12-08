import { CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, Copy, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type EvalsHeaderProps = {
  onMaximize?: () => void
  onRestore?: () => void
  isMaximized?: boolean
}

export function EvalsHeader({
  onMaximize,
  onRestore,
  isMaximized = false,
}: EvalsHeaderProps) {
  const handleToggle = isMaximized ? onRestore : onMaximize

  return (
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-base font-medium">Evals</CardTitle>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Sparkles />
        </Button>
        {/* For evals, could offer two different copy options... */}
        {/*   - JSON */}
        {/*   - Markdown */}
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
            isMaximized ? "Restore evals panel" : "Maximize evals panel"
          }
        >
          {isMaximized ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </div>
    </CardHeader>
  )
}
