"use client"

import { useCallback, useState } from "react"
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
import { usePreloadedQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Preloaded } from "convex/react"

const DEFAULT_PROMPT = "Write your **prompt** here. Use _markdown_ for rich text."

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

  const [draft, setDraft] = useState(prompt ?? DEFAULT_PROMPT)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updatePrompt = useMutation(api.public.updateCanvasVersionPrompt)

  const submitToBackend = useCallback(
    async (text: string, skipEvals: boolean = false) => {
      if (!versionId) {
        console.warn("Cannot submit prompt: versionId is missing")
        return
      }
      await updatePrompt({
        versionId,
        prompt: text || undefined,
        skipEvals,
      })
    },
    [versionId, updatePrompt],
  )

  // handleSubmit is used in two places:
  // 1. Form's onSubmit handler - triggered when Enter is pressed in the textarea
  // 2. Primary button's onClick handler - triggered when the button is clicked
  // The button has type="button" so it doesn't trigger form submission, therefore
  // this function is not actually executed twice.
  const handleSubmit = async () => {
    if (!isEditing) return
    setIsSubmitting(true)
    try {
      await submitToBackend(draft, false)
      setIsEditing(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitWithSkipEvals = async () => {
    if (!isEditing) return
    setIsSubmitting(true)
    try {
      await submitToBackend(draft, true)
      setIsEditing(false)
    } finally {
      setIsSubmitting(false)
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
            {!isEditing ? (
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
                    onClick={handleSubmitWithSkipEvals}
                    aria-label="Run Without Evaluating Requirements"
                  >
                    Run Without Evaluating Requirements
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
