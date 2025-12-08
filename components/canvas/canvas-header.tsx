import { Button } from "@/components/ui/button"
import { CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Copy, Maximize2, Minimize2 } from "lucide-react"

export type CanvasHeaderProps = {
  className?: string
  onMaximize?: () => void
  onRestore?: () => void
  isMaximized?: boolean
}

export function CanvasHeader({
  className,
  onMaximize,
  onRestore,
  isMaximized = false,
}: CanvasHeaderProps) {
  const handleToggle = isMaximized ? onRestore : onMaximize

  return (
    <CardHeader
      className={cn(
        "flex flex-row items-center justify-between space-y-0 pb-2",
        className,
      )}
    >
      <CardTitle className="text-base font-medium">Canvas</CardTitle>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {}}
          aria-label="Copy"
        >
          <Copy />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleToggle}
          disabled={!handleToggle}
          aria-label={
            isMaximized ? "Restore canvas panel" : "Maximize canvas panel"
          }
        >
          {isMaximized ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </div>
    </CardHeader>
  )
}
