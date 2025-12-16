import { useRef, useState } from "react"

/**
 * useBufferedState is a custom React hook for "buffering" real-time updates from Convex's useQuery.
 *
 * Concept:
 * - By default, Convex's useQuery hook is highly reactive and updates the UI immediately when backend data changes.
 * - In some UX scenarios, you may want to let the user control when new data is reflected in the UI,
 *   rather than having the UI update instantly (e.g., to avoid disrupting the user's context).
 * - useBufferedState keeps a local "current" value and computes a "diff" between this value and the latest data from useQuery.
 * - The UI can display a notification (e.g., "Click to load 3 new stories...") and only update when the user triggers a sync.
 *
 * Example usage:
 *
 *   const serverStories = useQuery("getStories") ?? null;
 *   const storyDiffer = (oldVal, newVal) => newVal.length - (oldVal?.length ?? 0);
 *   const buffered = useBufferedState(serverStories, storyDiffer);
 *   const stories = buffered.currentVal;
 *   const diff = buffered.diff;
 *   // Show a button if there are new stories
 *   {diff ? <button onClick={buffered.sync}>Load {diff} new stories</button> : null}
 *
 * For more on this pattern, see:
 * https://stack.convex.dev/coping-with-the-web-s-looming-global-reactivity-crisis
 */
export function useBufferedState<T, D>(
  upstream: T | null,
  differ: (oldVal: T | null, newVal: T) => D,
): {
  currentVal: T | null
  diff: D | null
  sync: () => void
} {
  const [currentVal, setCurrentVal] = useState(upstream)
  const upstreamRef = useRef(upstream)
  // eslint-disable-next-line react-hooks/refs -- this file is vendored code, trust that it's correct
  upstreamRef.current = upstream
  const doSync = () => {
    console.log("sync!")
    setCurrentVal(upstreamRef.current)
  }

  return {
    currentVal,
    diff: upstream ? differ(currentVal, upstream) : null,
    sync: doSync,
  }
}
