"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import { ChevronDown, Loader2 } from "lucide-react"

/**
 * SplitButton
 *
 * Usage (children API — matches your desired DX):
 *
 * <SplitButton tooltipText="You can't run right now" disabled={isDisabled} loading={isLoading}>
 *   <Button onClick={onRun}>Run</Button>
 *   <Button onClick={onRunWithoutEval}>Run Without Evaluating Requirements</Button>
 *   <Button onClick={onSomethingElse}>Something else</Button>
 * </SplitButton>
 *
 * OR items API (explicit, no child parsing):
 *
 * <SplitButton
 *   items=[
 *     { label: "Run", onClick: onRun },
 *     { label: "Run Without Evaluating Requirements", onClick: onRunWithoutEval },
 *   ]
 * />
 *
 * Controlled vs. Uncontrolled:
 * - The dropdown's `open` state is controllable via `open` and `onOpenChange`.
 *   If not provided, it falls back to internal state (uncontrolled) — the common
 *   "controllable state" pattern.
 */

export type SplitButtonAction = {
  label: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  destructive?: boolean
}

export type SplitButtonProps = {
  /**
   * You can either pass shadcn <Button> children (we only read their `children`,
   * `onClick`, `disabled`) or provide the `items` prop.
   */
  children?: React.ReactNode
  items?: SplitButtonAction[]

  /** Visual/state controls */
  disabled?: boolean
  loading?: boolean
  tooltipText?: string
  className?: string
  size?: "sm" | "default" | "lg"
  variant?: React.ComponentProps<typeof Button>["variant"]
  /** Dropdown alignment for the menu; defaults to "end" */
  menuAlign?: "start" | "center" | "end"
  /** A11y label for the chevron trigger */
  moreLabel?: string

  /** Optional controlled dropdown state */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function toActionsFromChildren(children: React.ReactNode): SplitButtonAction[] {
  const out: SplitButtonAction[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props: any = child.props ?? {}
    out.push({
      label: props.children,
      onClick: props.onClick,
      disabled: props.disabled,
    })
  })
  return out
}

export function SplitButton({
  children,
  items,
  disabled,
  loading,
  tooltipText,
  className,
  size = "default",
  variant = "default",
  menuAlign = "end",
  moreLabel = "More actions",
  open: controlledOpen,
  onOpenChange,
}: SplitButtonProps) {
  const actions = (
    items && items.length ? items : toActionsFromChildren(children)
  ).filter(Boolean)
  const primary = actions[0]
  const secondary = actions.slice(1)

  const isDisabled = Boolean(disabled)
  const isLoading = Boolean(loading)

  // Controllable dropdown state
  const [uOpen, setUOpen] = React.useState(false)
  const open = controlledOpen ?? uOpen
  const setOpen = onOpenChange ?? setUOpen

  const group = (
    <div
      className={["inline-flex items-center rounded-md shadow-xs", className]
        .filter(Boolean)
        .join(" ")}
      aria-disabled={isDisabled}
    >
      {/* Primary button */}
      {primary ? (
        <Button
          size={size}
          variant={variant}
          disabled={isDisabled || isLoading || primary.disabled}
          type="button"
          onClick={primary.onClick}
          className="rounded-r-none h-8"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            primary.label
          )}
        </Button>
      ) : null}

      {secondary.length > 0 ? (
        <>
          <Separator orientation="vertical" className="h-4" />
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={moreLabel}
                variant={variant}
                size="icon"
                className="rounded-l-none w-8 h-8"
                type="button"
                disabled={isDisabled || isLoading}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={menuAlign}>
              {secondary.map((item, idx) => (
                <DropdownMenuItem
                  key={idx}
                  onSelect={item.onClick}
                  disabled={isDisabled || item.disabled}
                  className={
                    item.destructive
                      ? "text-destructive focus:text-destructive"
                      : undefined
                  }
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}
    </div>
  )

  const withTooltip =
    isDisabled && !isLoading && tooltipText ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{group}</TooltipTrigger>
          <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      group
    )

  return withTooltip
}

// Convenience: a typed subcomponent if you prefer an explicit API instead of <Button> children
SplitButton.Action = function Action(props: SplitButtonAction) {
  // This is a no-op component used only for its props when passed as children.
  // It allows: <SplitButton><SplitButton.Action label="Run" onClick={...} /></SplitButton>
  return <>{props.label}</>
}
