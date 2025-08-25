// @ts-nocheck

import React, { createContext, useContext, useMemo, useState } from "react"

/**
 * =============================================================
 * Native HTML5 Drag & Drop – Reusable Hooks & Components (React)
 * =============================================================
 *
 * What you get:
 * 1) <DnDProvider> – Context for global drag state (type + payload).
 * 2) useDraggable({ type, data, effectAllowed }) – Make any element draggable.
 * 3) useDropZone({ accept, onDrop, dropEffect }) – Make any element a drop target.
 *
 * These utilities wrap **native HTML5 drag & drop** — no external DnD libs.
 * Copy the toolkit section into your app and use the hooks on your existing
 * sidebar tree. A full example using a folder + files tree lives below.
 *
 * Notes:
 * • Data is serialized into `dataTransfer` under both a custom MIME type
 *   ("application/x-dnd-json") and a text/plain fallback for robustness.
 * • `accept` is a string or string[] of the dragged `type` you want to allow.
 * • Hooks expose booleans (isDragging / isOver) for styling.
 * • This is minimal and unopinionated. Compose however you like.
 * • Native DnD is mouse-focused; for full accessibility consider adding
 *   keyboard move actions as a separate enhancement.
 */

// ─────────────────────────────────────────────────────────────────────────────
// DnD Toolkit
// ─────────────────────────────────────────────────────────────────────────────

const DND_MIME = "application/x-dnd-json"

/** @typedef {{ type: string, data: any }} DragEnvelope */

const DnDContext = createContext({
  drag: /** @type {null | DragEnvelope} */ null,
  setDrag: /** @type {(d: DragEnvelope | null) => void} */ () => {},
})

export function DnDProvider({ children }) {
  const [drag, setDrag] = useState(null)
  return (
    <DnDContext.Provider value={{ drag, setDrag }}>
      {children}
    </DnDContext.Provider>
  )
}

function writeTransfer(e, envelope) {
  try {
    e.dataTransfer.setData(DND_MIME, JSON.stringify(envelope))
  } catch {}
  try {
    e.dataTransfer.setData("text/plain", JSON.stringify(envelope))
  } catch {}
}

function readTransfer(e) {
  let raw = ""
  try {
    raw = e.dataTransfer.getData(DND_MIME)
  } catch {}
  if (!raw) {
    try {
      raw = e.dataTransfer.getData("text/plain")
    } catch {}
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.type === "string") return parsed
  } catch {}
  return null
}

/**
 * useDraggable
 * @param {{ type: string, data: any, effectAllowed?: DataTransfer['effectAllowed'], onDragStart?: (e: DragEvent) => void, onDragEnd?: (e: DragEvent) => void }} opts
 */
export function useDraggable(opts) {
  const { type, data, effectAllowed = "move", onDragStart, onDragEnd } = opts
  const [isDragging, setIsDragging] = useState(false)
  const { setDrag } = useContext(DnDContext)

  /** @type {React.HTMLAttributes<HTMLElement>} */
  const props = {
    draggable: true,
    onDragStart: (e) => {
      const envelope = { type, data }
      writeTransfer(e, envelope)
      e.dataTransfer.effectAllowed = effectAllowed
      setIsDragging(true)
      setDrag(envelope)
      onDragStart?.(/** @type {any} */ e)
    },
    onDragEnd: (e) => {
      setIsDragging(false)
      setDrag(null)
      onDragEnd?.(/** @type {any} */ e)
    },
    "aria-grabbed": isDragging || undefined,
    "data-dragging": isDragging || undefined,
  }

  return { dragProps: props, isDragging }
}

/**
 * useDropZone
 * @param {{ accept: string | string[], onDrop: (payload: { type: string, data: any }) => void, dropEffect?: DataTransfer['dropEffect'], onDragEnter?: Function, onDragLeave?: Function, onDragOver?: Function }} opts
 */
export function useDropZone(opts) {
  const {
    accept,
    onDrop,
    dropEffect = "move",
    onDragEnter,
    onDragLeave,
    onDragOver,
  } = opts
  const { drag } = useContext(DnDContext)
  const [isOver, setIsOver] = useState(false)
  const accepts = useMemo(() => new Set([].concat(accept)), [accept])

  /** @type {React.HTMLAttributes<HTMLElement>} */
  const props = {
    onDragOver: (e) => {
      const allowed = drag && accepts.has(drag.type)
      if (allowed) {
        e.preventDefault()
        e.dataTransfer.dropEffect = dropEffect
        setIsOver(true)
      }
      onDragOver?.(e)
    },
    onDragEnter: (e) => {
      const allowed = drag && accepts.has(drag.type)
      if (allowed) setIsOver(true)
      onDragEnter?.(e)
    },
    onDragLeave: (e) => {
      setIsOver(false)
      onDragLeave?.(e)
    },
    onDrop: (e) => {
      e.preventDefault()
      const env = readTransfer(e) || drag
      setIsOver(false)
      if (env && accepts.has(env.type)) onDrop(env)
    },
    "data-over": isOver || undefined,
  }

  return { dropProps: props, isOver }
}
