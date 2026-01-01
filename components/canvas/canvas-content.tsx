"use client"

import { useCallback, useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Response } from "@/components/ai-elements/response"
import {
  PromptInput as AIPromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputButton,
} from "@/components/ai-elements/prompt-input"
import { CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { SplitButton } from "@/components/split-button"
import { RefreshCw, PencilIcon, XIcon, CheckIcon } from "lucide-react"
import { usePreloadedQuery, useMutation } from "convex/react"
import { Preloaded } from "convex/react"
import { api } from "@/convex/_generated/api"

const PLACEHOLDER_TEXT =
  "Submit a prompt to generate the **canvas**. You may also edit the canvas directly."

export type CanvasContentProps = {
  className?: string
  preloadedCanvasVersion?: Preloaded<typeof api.public.getCanvasVersionById>
}

export function CanvasContent({
  className,
  preloadedCanvasVersion,
}: CanvasContentProps) {
  const canvasVersion = preloadedCanvasVersion
    ? usePreloadedQuery(preloadedCanvasVersion)
    : null

  const response = canvasVersion?.response
  const hasResponse = response && response.trim().length > 0
  const displayContent = hasResponse ? response : PLACEHOLDER_TEXT

  const versionId = canvasVersion?._id

  const [content, setContent] = useState(displayContent)
  const [draft, setDraft] = useState(content)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateResponse = useMutation(api.public.updateCanvasVersionResponse)

  // Update content when response changes from the database
  useEffect(() => {
    if (!isEditing) {
      setContent(displayContent)
      setDraft(displayContent)
    }
  }, [displayContent, isEditing])

  const submitToBackend = useCallback(
    async (response: string, skip?: "evals") => {
      if (!versionId) {
        console.warn("Cannot submit response: versionId is missing")
        return
      }
      const responseText = response.trim() || undefined
      await updateResponse({
        versionId,
        response: responseText,
        skip,
      })
    },
    [versionId, updateResponse],
  )

  const handleSubmit = useCallback(
    async (
      e?: React.FormEvent<HTMLFormElement> | React.MouseEvent,
      skip?: "evals",
    ) => {
      if (e && "preventDefault" in e) e.preventDefault()
      if (!isEditing) return

      setIsSubmitting(true)
      try {
        await submitToBackend(draft, skip)
        setContent(draft)
        setIsEditing(false)
      } catch (error) {
        console.error("Failed to update canvas response:", error)
      } finally {
        setIsSubmitting(false)
      }
    },
    [isEditing, draft, submitToBackend],
  )

  const handleSubmitWithSkipEvals = useCallback(
    async (e?: React.FormEvent<HTMLFormElement> | React.MouseEvent) => {
      await handleSubmit(e, "evals")
    },
    [handleSubmit],
  )

  return (
    <CardContent className="flex-1 min-h-0">
      <AIPromptInput
        onSubmit={(e) => handleSubmit(e, undefined)}
        className={cn(
          "size-full min-w-[26rem] min-h-[15rem] flex flex-col",
          className,
        )}
      >
        <div className="flex-1 overflow-auto">
          {isEditing ? (
            <PromptInputTextarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-full min-h-full bg-transparent p-4"
              placeholder="Edit canvas in plain text..."
            />
          ) : (
            <div className="p-4">
              <Response>{content}</Response>
            </div>
          )}
        </div>

        <PromptInputToolbar>
          {/* Left: Refine dropdown */}
          <PromptInputTools>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <PromptInputButton aria-label="Refine Response">
                  <RefreshCw size={16} />
                  Refine Response
                </PromptInputButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onSelect={() => console.log("Improve clarity")}
                >
                  Improve clarity
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => console.log("Fix grammar")}>
                  Fix grammar & style
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => console.log("Summarize")}>
                  Summarize
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => console.log("Expand")}>
                  Expand detail
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </PromptInputTools>

          {/* Right: contextual actions */}
          <div className="flex items-center gap-1">
            {!isEditing ? (
              <PromptInputButton
                onClick={() => {
                  setDraft(displayContent)
                  setIsEditing(true)
                }}
                aria-label="Edit"
              >
                <PencilIcon size={16} />
              </PromptInputButton>
            ) : (
              <>
                <PromptInputButton
                  onClick={() => {
                    setDraft(displayContent) // discard edits and reset to current database value
                    setIsEditing(false)
                  }}
                  disabled={isSubmitting}
                  aria-label="Cancel"
                >
                  <XIcon size={16} />
                </PromptInputButton>
                <SplitButton
                  disabled={!draft || isSubmitting}
                  loading={isSubmitting}
                  tooltipText="Please enter content to save."
                >
                  <Button
                    type="button"
                    onClick={(e) => handleSubmit(e, undefined)}
                    aria-label="Save"
                  >
                    <CheckIcon size={16} />
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmitWithSkipEvals}
                    aria-label="Save Canvas Without Running Evals"
                  >
                    Save Canvas Without Running Evals
                  </Button>
                </SplitButton>
              </>
            )}
          </div>
        </PromptInputToolbar>
      </AIPromptInput>
    </CardContent>
  )
}
