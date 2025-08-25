export const DND_MIME = "application/x-dnd-json"

export type DragEnvelope<T = unknown> = { type: string; data: T }
