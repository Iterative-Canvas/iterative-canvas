import { useDndContext } from "@/providers/DndProvider"
import { DND_MIME, DragEnvelope } from "@/types/dnd-types"
import { useMemo, useState } from "react"

type DropZoneHTMLProps = React.HTMLAttributes<HTMLElement> & {
  "data-over"?: boolean
}

export interface UseDropZoneOptions<T = unknown> {
  accept: string | string[]
  onDrop: (payload: DragEnvelope<T>) => void
  dropEffect?: DataTransfer["dropEffect"]
  onDragEnter?: (e: React.DragEvent<HTMLElement>) => void
  onDragLeave?: (e: React.DragEvent<HTMLElement>) => void
  onDragOver?: (e: React.DragEvent<HTMLElement>) => void
}

function readTransfer(e: React.DragEvent<HTMLElement>): DragEnvelope | null {
  let raw = ""
  try {
    raw = e.dataTransfer.getData(DND_MIME)
  } catch {
    /* noop */
  }
  if (!raw) {
    try {
      raw = e.dataTransfer.getData("text/plain")
    } catch {
      /* noop */
    }
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<DragEnvelope>
    if (parsed && typeof parsed.type === "string") return parsed as DragEnvelope
  } catch {
    /* noop */
  }
  return null
}

export function useDropZone<T = unknown>(opts: UseDropZoneOptions<T>) {
  const {
    accept,
    onDrop,
    dropEffect = "move",
    onDragEnter,
    onDragLeave,
    onDragOver,
  } = opts
  const { drag } = useDndContext()
  const [isOver, setIsOver] = useState(false)
  const accepts = useMemo(() => {
    const list = Array.isArray(accept) ? accept : [accept]
    return new Set<string>(list)
  }, [accept])

  const props: DropZoneHTMLProps = {
    onDragOver: (e) => {
      const allowed = !!(drag && accepts.has(drag.type))
      if (allowed) {
        e.preventDefault()
        e.dataTransfer.dropEffect = dropEffect
        setIsOver(true)
      }
      onDragOver?.(e)
    },
    onDragEnter: (e) => {
      const allowed = !!(drag && accepts.has(drag.type))
      if (allowed) setIsOver(true)
      onDragEnter?.(e)
    },
    onDragLeave: (e) => {
      setIsOver(false)
      onDragLeave?.(e)
    },
    onDrop: (e) => {
      e.preventDefault()
      const env = (readTransfer(e) || drag) as DragEnvelope<T> | null
      setIsOver(false)
      if (env && accepts.has(env.type)) onDrop(env)
    },
    "data-over": isOver || undefined,
  }

  return { dropProps: props, isOver }
}
