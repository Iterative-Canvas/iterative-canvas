import { DotDotDot } from "@/components/dot-dot-dot"

// This file is not simply cosmetic or decorative. It plays a crucial role
// in preventing a reactivity explosion during folder deletion. Without this
// file, Next.js cannot immediately transition away from the original route
// to this one. It has to wait for the server component to finish rendering.
// That would be a problem because the server component deletes the folder
// and all its contents, triggering a reactive update that causes the original
// route to re-render and blow up.

export default function Loading() {
  return (
    <div className="mt-4 ml-4">
      <DotDotDot>Deleting folder</DotDotDot>
    </div>
  )
}
