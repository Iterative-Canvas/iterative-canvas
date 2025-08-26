'use client"'

import { Button } from "@/components/ui/button"
import { CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Copy, Maximize2 } from "lucide-react"

export type CanvasHeaderProps = {
  className?: string
}

export function CanvasHeader({ className }: CanvasHeaderProps) {
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
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {}}
          aria-label="Maximize"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </CardHeader>
  )
}
