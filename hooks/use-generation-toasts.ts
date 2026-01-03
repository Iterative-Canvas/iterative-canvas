"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

type ResponseState = {
  status: string
  error?: string
  errorAt?: number
} | null

/**
 * Hook that watches response generation state and shows appropriate toasts.
 *
 * - Shows info toast when a retry is triggered (transient error during "generating")
 * - Shows error toast when status transitions from "generating" to "error"
 * - Only toasts for transitions we observe (skips pre-existing state on page load)
 */
export function useGenerationToasts(responseState: ResponseState) {
  // Track previous status to detect transitions
  const previousStatus = useRef<string | undefined>(undefined)
  // Track the last error timestamp we've shown a retry toast for
  const lastToastedErrorAt = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!responseState) return

    const { status, error, errorAt } = responseState

    // Retry toast: new error while still generating
    // Only show if we've observed this session (previousStatus is defined)
    if (
      status === "generating" &&
      errorAt &&
      errorAt !== lastToastedErrorAt.current &&
      previousStatus.current !== undefined
    ) {
      lastToastedErrorAt.current = errorAt
      toast.info("Encountered an issue, retrying...", {
        description: "The system is automatically retrying the request.",
        duration: 4000,
      })
    }

    // Final error toast: observed transition from "generating" to "error"
    if (
      status === "error" &&
      previousStatus.current === "generating" &&
      error
    ) {
      // In development, show the error message (but truncate if too long)
      const isDev = process.env.NODE_ENV === "development"
      const truncatedError =
        error.length > 150 ? error.slice(0, 150) + "..." : error

      toast.error("Generation failed", {
        description: isDev
          ? truncatedError
          : "Unable to generate response. Please try again.",
        duration: 6000,
      })
    }

    // Reset error tracking when status goes back to idle
    if (status === "idle") {
      lastToastedErrorAt.current = undefined
    }

    // Always update previous status at the end
    previousStatus.current = status
  }, [responseState])
}

