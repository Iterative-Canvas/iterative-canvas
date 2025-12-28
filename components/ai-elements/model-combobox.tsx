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
import type { Doc } from "@/convex/_generated/dataModel"

export type ModelComboboxProps = {
  value?: Doc<"aiGatewayModels">
  onChange?: (next: Doc<"aiGatewayModels"> | undefined) => void
  className?: string
  placeholder?: string
  availableModels: Doc<"aiGatewayModels">[]
}

export function ModelCombobox({
  value,
  onChange,
  className,
  placeholder = "No model selected",
  availableModels,
}: ModelComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<
    Doc<"aiGatewayModels"> | undefined
  >(value)
  const [batteryState, setBatteryState] = React.useState<
    "medium" | "full" | "low"
  >("medium")

  // Sync selected state when value changes (for reactive updates)
  React.useEffect(() => {
    setSelected(value)
  }, [value])

  // Fast lookup for available models by id
  const availableById = useMemo(() => {
    const map = new Map<string, Doc<"aiGatewayModels">>()
    if (availableModels) {
      for (const m of availableModels) map.set(m._id, m)
    }
    return map
  }, [availableModels])

  // Merge the selected (possibly unavailable) model into the visible list
  const combinedModels = useMemo(() => {
    const base = [...availableModels]
    if (selected && !availableById.has(selected._id)) {
      base.push(selected)
    }
    return base
  }, [availableModels, availableById, selected])

  // Group models by provider and sort by modelId
  const groups = useMemo(() => {
    const byProvider = new Map<string, Doc<"aiGatewayModels">[]>()
    for (const m of combinedModels) {
      const arr = byProvider.get(m.provider) ?? []
      arr.push(m)
      byProvider.set(m.provider, arr)
    }
    // Sort providers alphabetically and each group's models by modelId
    const providerNames = Array.from(byProvider.keys()).sort((a, b) =>
      a.localeCompare(b),
    )
    return providerNames.map((provider) => ({
      provider,
      models: (byProvider.get(provider) ?? [])
        .slice()
        .sort((a, b) => a.modelId.localeCompare(b.modelId)),
    }))
  }, [combinedModels])

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

  // Fire callbacks on initial render and when dependencies change
  React.useEffect(() => {
    onChange?.(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  // Handle selection from the list
  const handleSelect = (value: string) => {
    const id = value.split("||")[1] ?? value
    const next =
      availableById.get(id) ?? combinedModels.find((m) => m._id === id)
    setSelected(next)
    setOpen(false)
  }

  // Display label for the button
  const displayLabel = selected ? selected.name : placeholder
  const showWarning = !!(selected && !availableById.has(selected._id))

  return (
    <div className="flex items-center gap-1">
      {showBattery && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleBatteryClick}
          aria-label={`Battery ${batteryState}`}
        >
          <BatteryIcon className="h-4 w-4" />
        </Button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("max-w-48 flex items-center text-xs", className)}
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
    </div>
  )
}

export default ModelCombobox
