"use client"

import { useCallback, useState } from "react"
import { cn } from "@/lib/utils"
import { Response } from "@/components/ai-elements/response"
import {
  PromptInput as Container,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input"
import { CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RefreshCw, PencilIcon, XIcon, CheckIcon } from "lucide-react"

export type CanvasContentProps = {
  initialMarkdown?: string
  className?: string
  onSave?: (text: string) => Promise<void> | void
}

export function CanvasContent({
  initialMarkdown,
  className,
  onSave,
}: CanvasContentProps) {
  const [content, setContent] = useState(
    initialMarkdown ??
      "# Your canvas will appear here\n\nUse the Prompt to generate content, or edit directly.",
  )
  const [draft, setDraft] = useState(content)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const mockPersist = useCallback(async (text: string) => {
    // Simulate a backend call
    await new Promise((r) => setTimeout(r, 400))
    console.log("mockPersistCanvas", { text })
  }, [])

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault()
    if (!isEditing) return
    setIsSubmitting(true)
    try {
      setContent(draft)
      await (onSave ? onSave(draft) : mockPersist(draft))
      setIsEditing(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <CardContent className="flex-1 min-h-0">
      <Container
        onSubmit={handleSubmit}
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
                  setDraft(content)
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
                    setDraft(content) // discard edits
                    setIsEditing(false)
                  }}
                  disabled={isSubmitting}
                  aria-label="Cancel"
                >
                  <XIcon size={16} />
                </PromptInputButton>
                <PromptInputSubmit disabled={isSubmitting} aria-label="Save">
                  <CheckIcon size={16} />
                </PromptInputSubmit>
              </>
            )}
          </div>
        </PromptInputToolbar>
      </Container>
    </CardContent>
  )
}
