"use client"

import { Card } from "@/components/ui/card"
import { CanvasHeader } from "./canvas-header"
import { CanvasContent } from "./canvas-content"

export function CanvasSection() {
  return (
    <Card className="flex flex-col h-full border-none shadow-none gap-4 py-5">
      <CanvasHeader />
      <CanvasContent />
    </Card>
  )
}
