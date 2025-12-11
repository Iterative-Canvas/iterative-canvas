"use client"

import * as React from "react"
import { useMemo } from "react"
import {
  Check,
  AlertTriangle,
  ChevronDown,
  BatteryMedium,
  BatteryFull,
  BatteryLow,
} from "lucide-react"
import { useQuery } from "convex/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"

export type ModelComboboxProps = {
  valueId?: Id<"aiGatewayModels">
  disabled?: boolean
  onChange?: (next: Doc<"aiGatewayModels"> | undefined) => void
  onValidityChange?: (isValid: boolean) => void
  className?: string
  placeholder?: string
}

export function ModelCombobox({
  valueId,
  disabled = false,
  onChange,
  onValidityChange,
  className,
  placeholder = "No model selected",
}: ModelComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<
    Id<"aiGatewayModels"> | undefined
  >(valueId)
  const [selected, setSelected] = React.useState<
    Doc<"aiGatewayModels"> | undefined
  >()
  const [batteryState, setBatteryState] = React.useState<
    "medium" | "full" | "low"
  >("medium")

  // Load available models from Convex
  const includeModelId = selectedId
  const availableModels = useQuery(api.public.getAvailableModels, {
    includeModelId,
  })

  // Fast lookup for available models by id
  const availableById = useMemo(() => {
    const map = new Map<string, Doc<"aiGatewayModels">>()
    if (availableModels) {
      for (const m of availableModels) map.set(m._id, m)
    }
    return map
  }, [availableModels])

  React.useEffect(() => {
    setSelectedId(valueId)
  }, [valueId])

  React.useEffect(() => {
    if (!selectedId) {
      setSelected(undefined)
      return
    }
    const next = availableById.get(selectedId)
    if (next && next._id !== selected?._id) {
      setSelected(next)
    }
  }, [availableById, selectedId, selected])

  // Group models by provider and sort by modelId
  const groups = useMemo(() => {
    const byProvider = new Map<string, Doc<"aiGatewayModels">[]>()
    for (const m of availableModels ?? []) {
      const arr = byProvider.get(m.provider) ?? []
      arr.push(m)
      byProvider.set(m.provider, arr)
    }
    const providerNames = Array.from(byProvider.keys()).sort((a, b) =>
      a.localeCompare(b),
    )
    return providerNames.map((provider) => ({
      provider,
      models: (byProvider.get(provider) ?? [])
        .slice()
        .sort((a, b) => a.modelId.localeCompare(b.modelId)),
    }))
  }, [availableModels])

  // Compute validity: valid only if a model is selected AND it exists in available models
  const isValid = !!(selectedId && availableById.has(selectedId))

  // Reasoning models get a battery icon toggle, similar to the ModelSelector component
  const reasoningModelIds = React.useMemo(
    () =>
      new Set(["openai/gpt-5", "openai/gpt-5-pro", "openai/o1", "openai/o3"]),
    [],
  )

  const showBattery = !!(selected && reasoningModelIds.has(selected.modelId))
  const batteryIcons = {
    medium: BatteryMedium,
    full: BatteryFull,
    low: BatteryLow,
  }
  const BatteryIcon = batteryIcons[batteryState]

  const handleBatteryClick = () => {
    setBatteryState((current) => {
      if (current === "medium") return "full"
      if (current === "full") return "low"
      return "medium"
    })
  }

  React.useEffect(() => {
    onValidityChange?.(isValid)
  }, [isValid, onValidityChange])

  // Handle selection from the list
  const handleSelect = (value: string) => {
    const id = (value.split("||")[1] ?? value) as Id<"aiGatewayModels">
    const next = availableById.get(id)
    setSelectedId(id)
    setSelected(next)
    setOpen(false)
    onChange?.(next)
  }

  // Display label for the button
  const displayLabel = selected ? selected.name : placeholder
  const showWarning = !!(
    selected &&
    availableModels &&
    !availableById.has(selected._id)
  )

  return (
    <div className="flex items-center gap-1">
      <Popover
        open={disabled ? false : open}
        onOpenChange={disabled ? undefined : setOpen}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={disabled ? false : open}
            aria-disabled={disabled}
            className={cn("max-w-48 flex items-center text-xs", className)}
            disabled={disabled}
          >
            {showWarning && (
              <AlertTriangle
                className="size-4 text-amber-500"
                aria-label="Unavailable model"
              />
            )}
            <span className="truncate" title={displayLabel}>
              {displayLabel}
            </span>
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0">
          <Command
            filter={(value, search) => {
              const [modelId] = value.split("||")
              const q = search.trim().toLowerCase()
              return modelId.toLowerCase().includes(q) ? 1 : 0
            }}
          >
            <CommandInput placeholder="Search model..." className="h-9" />
            <CommandList>
              <CommandEmpty>No models found.</CommandEmpty>
              {groups.map(({ provider, models }) => (
                <CommandGroup key={provider} heading={provider}>
                  {models.map((m) => {
                    const isSelected = selected?._id === m._id
                    const isUnavailable = !availableById.has(m._id)
                    return (
                      <CommandItem
                        key={m._id}
                        value={`${m.modelId}||${m._id}`}
                        keywords={[m.modelId]}
                        onSelect={handleSelect}
                      >
                        <span className="flex items-center gap-2 truncate">
                          {isUnavailable && (
                            <AlertTriangle
                              className="size-4 text-amber-500"
                              aria-label="Unavailable model"
                            />
                          )}
                          <span className="truncate" title={m.modelId}>
                            {m.modelId}
                          </span>
                        </span>
                        <Check
                          className={cn(
                            "ml-auto",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {showBattery && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleBatteryClick}
          disabled={disabled}
          aria-label={`Battery ${batteryState}`}
        >
          <BatteryIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

export default ModelCombobox
