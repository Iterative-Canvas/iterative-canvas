import React from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Check, X } from "lucide-react"

export type InlineRenameProps = {
  icon?: React.ReactNode
  value: string
  onChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
  maxLength?: number
}

export function InlineRename({
  icon,
  value,
  onChange,
  onConfirm,
  onCancel,
  maxLength = 75,
}: InlineRenameProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1">
      {icon}
      <Input
        value={value}
        onChange={(e) => {
          const v = e.target.value
          if (v.length <= maxLength) onChange(v)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onConfirm()
          } else if (e.key === "Escape") {
            onCancel()
          }
        }}
        onFocus={(e) => e.currentTarget.select()}
        className="h-6 text-sm"
        maxLength={maxLength}
        autoFocus
      />
      <Button
        size="sm"
        variant="ghost"
        disabled={!value.trim()}
        className="h-6 w-6 p-0 cursor-pointer text-submit hover:text-submit"
        onClick={onConfirm}
      >
        <Check className="h-3 w-3" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0 cursor-pointer text-cancel hover:text-cancel"
        onClick={onCancel}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}

type RenameGuardProps = React.PropsWithChildren<{
  className?: string
}>

/** Blocks parent click/drag handlers while renaming. */
export function InlineRenameDndGuard({
  children,
  className,
}: RenameGuardProps) {
  const stopAll = (e: React.SyntheticEvent) => {
    e.stopPropagation()
  }

  return (
    <div
      className={className}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onPointerDownCapture={stopAll}
      onClickCapture={stopAll}
      onKeyDownCapture={stopAll}
    >
      {children}
    </div>
  )
}
