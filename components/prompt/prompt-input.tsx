"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Response } from "@/components/ai-elements/response"
import {
  PromptInput as AIPromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputButton,
} from "@/components/ai-elements/prompt-input"
import {
  PencilIcon,
  XIcon,
  SettingsIcon,
  FileIcon,
  ImageIcon,
  SendIcon,
  CircleStopIcon,
} from "lucide-react"
import { CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { SplitButton } from "@/components/split-button"
import { usePreloadedQuery, useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Preloaded } from "convex/react"

const DEFAULT_PROMPT =
  "Write your **prompt** here. Use _markdown_ for rich text."

type Props = {
  preloadedCanvasVersion?: Preloaded<typeof api.public.getCanvasVersionById>
  className?: string
}

export function PromptInput({ preloadedCanvasVersion, className }: Props) {
  const canvasVersion = preloadedCanvasVersion
    ? usePreloadedQuery(preloadedCanvasVersion)
    : null

  const prompt = canvasVersion?.prompt
  const versionId = canvasVersion?._id

  // Query the streaming response to detect generation status
  const streamingResponse = useQuery(
    api.public.getCanvasVersionResponse,
    versionId ? { versionId } : "skip",
  )
  const isGenerating = streamingResponse?.status === "generating"

  const [draft, setDraft] = useState(prompt ?? DEFAULT_PROMPT)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Track when we've just submitted for generation to bridge the gap
  // between mutation completing and query updating
  const [isPendingGeneration, setIsPendingGeneration] = useState(false)

  // Clear the pending state once the backend confirms generation has started
  useEffect(() => {
    if (isGenerating && isPendingGeneration) {
      setIsPendingGeneration(false)
    }
  }, [isGenerating, isPendingGeneration])

  // Combined state: show stop button if generating OR about to generate
  const showStopButton = isGenerating || isPendingGeneration

  // For saving prompt only (no generation)
  const updatePrompt = useMutation(api.public.updateCanvasVersionPrompt)
  // For submitting prompt and generating response (with optional evals)
  const submitPrompt = useMutation(api.public.submitPrompt)
  // For cancelling an in-progress generation
  const cancelGeneration = useMutation(api.public.cancelGeneration)

  // Save prompt only - no LLM generation
  const handleSavePrompt = async () => {
    if (!isEditing || !versionId) return
    setIsSubmitting(true)
    try {
      await updatePrompt({
        versionId,
        prompt: draft,
      })
      setIsEditing(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit prompt - generates LLM response AND runs evals
  const handleSubmit = async () => {
    if (!isEditing || !versionId) return
    setIsSubmitting(true)
    setIsPendingGeneration(true) // Immediately show stop button
    try {
      await submitPrompt({
        versionId,
        prompt: draft,
        skipEvals: false,
      })
      setIsEditing(false)
    } catch {
      setIsPendingGeneration(false) // Clear on error
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit prompt - generates LLM response but skips evals
  const handleSubmitWithSkipEvals = async () => {
    if (!isEditing || !versionId) return
    setIsSubmitting(true)
    setIsPendingGeneration(true) // Immediately show stop button
    try {
      await submitPrompt({
        versionId,
        prompt: draft,
        skipEvals: true,
      })
      setIsEditing(false)
    } catch {
      setIsPendingGeneration(false) // Clear on error
    } finally {
      setIsSubmitting(false)
    }
  }

  // Cancel an in-progress generation
  const handleCancelGeneration = async () => {
    if (!versionId) return
    // Clear pending state immediately for responsive UI
    setIsPendingGeneration(false)
    // Only call backend if generation has actually started
    if (isGenerating) {
      try {
        await cancelGeneration({ versionId })
      } catch (error) {
        console.error("Failed to cancel generation:", error)
      }
    }
  }

  return (
    <CardContent className="flex-1 min-h-0">
      <AIPromptInput
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
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
            />
          ) : (
            <div className="p-4">
              <Response>{prompt ?? DEFAULT_PROMPT}</Response>
            </div>
          )}
        </div>

        <PromptInputToolbar>
          {/* Left: Gear dropdown (always visible) */}
          <PromptInputTools>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <PromptInputButton aria-label="Options">
                  <SettingsIcon size={16} />
                </PromptInputButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem>
                  <FileIcon size={16} />
                  Files
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ImageIcon size={16} />
                  Images
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </PromptInputTools>

          {/* Right: Contextual actions */}
          <div className="flex items-center gap-1">
            {showStopButton ? (
              // Show stop button during generation (or pending generation)
              <PromptInputButton
                onClick={handleCancelGeneration}
                aria-label="Stop Generation"
                className="text-destructive hover:text-destructive"
              >
                <CircleStopIcon size={16} />
              </PromptInputButton>
            ) : !isEditing ? (
              <PromptInputButton
                onClick={() => {
                  setDraft(prompt ?? DEFAULT_PROMPT)
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
                  tooltipText="Please enter a prompt to run."
                >
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    aria-label="Send"
                  >
                    <SendIcon size={16} />
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSavePrompt}
                    aria-label="Save Prompt"
                  >
                    Save Prompt
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmitWithSkipEvals}
                    aria-label="Submit Without Running Evals"
                  >
                    Submit Without Running Evals
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
