import { DragEnvelope } from "@/types/dnd-types"
import { createContext, useContext, useState } from "react"

type DndContextType = {
  drag: DragEnvelope | null
  setDrag: (d: DragEnvelope | null) => void
}

const DndContext = createContext<DndContextType>({
  drag: null,
  setDrag: () => {
    /* noop */
  },
})

export function DndProvider({ children }: { children: React.ReactNode }) {
  const [drag, setDrag] = useState<DragEnvelope | null>(null)
  return (
    <DndContext.Provider value={{ drag, setDrag }}>
      {children}
    </DndContext.Provider>
  )
}

export const useDndContext = () => useContext(DndContext)
