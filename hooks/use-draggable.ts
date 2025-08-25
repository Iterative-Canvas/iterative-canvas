import { useDndContext } from "@/providers/DndProvider"
import { DND_MIME, DragEnvelope } from "@/types/dnd-types"
import { useState } from "react"

type DraggableHTMLProps = React.HTMLAttributes<HTMLElement> & {
  "data-dragging"?: boolean
}

export interface UseDraggableOptions<T = unknown> {
  type: string
  data: T
  effectAllowed?: DataTransfer["effectAllowed"]
  onDragStart?: (e: React.DragEvent<HTMLElement>) => void
  onDragEnd?: (e: React.DragEvent<HTMLElement>) => void
}

function writeTransfer(
  e: React.DragEvent<HTMLElement>,
  envelope: DragEnvelope,
): void {
  try {
    e.dataTransfer.setData(DND_MIME, JSON.stringify(envelope))
  } catch {
    /* noop */
  }
  try {
    e.dataTransfer.setData("text/plain", JSON.stringify(envelope))
  } catch {
    /* noop */
  }
}

export function useDraggable<T = unknown>(opts: UseDraggableOptions<T>) {
  const { type, data, effectAllowed = "move", onDragStart, onDragEnd } = opts
  const [isDragging, setIsDragging] = useState(false)
  const { setDrag } = useDndContext()

  const props: DraggableHTMLProps = {
    draggable: true,
    onDragStart: (e) => {
      const envelope: DragEnvelope<T> = { type, data }
      writeTransfer(e, envelope)
      e.dataTransfer.effectAllowed = effectAllowed
      setIsDragging(true)
      setDrag(envelope)
      onDragStart?.(e)
    },
    onDragEnd: (e) => {
      setIsDragging(false)
      setDrag(null)
      onDragEnd?.(e)
    },
    "aria-grabbed": isDragging || undefined,
    "data-dragging": isDragging || undefined,
  }

  return { dragProps: props, isDragging }
}
