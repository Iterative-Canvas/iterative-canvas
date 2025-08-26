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
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input"
import {
  PencilIcon,
  XIcon,
  SettingsIcon,
  FileIcon,
  ImageIcon,
} from "lucide-react"
import { CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

type Props = {
  initialMarkdown?: string
  className?: string
}

export function PromptInput({ initialMarkdown, className }: Props) {
  const [content, setContent] = useState(
    initialMarkdown ??
      "# Hello!\n\nWrite your prompt here. Use **Markdown** for rich text.",
  )
  const [draft, setDraft] = useState(content)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitToBackend = useCallback(async (text: string) => {
    await new Promise((r) => setTimeout(r, 450))
    console.log("submitToBackend", { text })
  }, [])

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isEditing) return
    setIsSubmitting(true)
    try {
      setContent(draft)
      await submitToBackend(draft)
      setIsEditing(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <CardContent className="flex-1 min-h-0">
      <AIPromptInput
        onSubmit={onSubmit}
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
              placeholder="Write your message in plain text..."
            />
          ) : (
            <div className="p-4">
              <Response>{content}</Response>
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
                    setDraft(content)
                    setIsEditing(false)
                  }}
                  disabled={isSubmitting}
                  aria-label="Cancel"
                >
                  <XIcon size={16} />
                </PromptInputButton>
                <PromptInputSubmit disabled={isSubmitting} aria-label="Send" />
              </>
            )}
          </div>
        </PromptInputToolbar>
      </AIPromptInput>
    </CardContent>
  )
}
