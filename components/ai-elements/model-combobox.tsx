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
  Layers,
  Building2,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Doc } from "@/convex/_generated/dataModel"

type GroupingMode = "creator" | "provider"

export type ModelComboboxProps = {
  value?: Doc<"aiGatewayModels">
  onChange?: (next: Doc<"aiGatewayModels"> | undefined) => void
  className?: string
  placeholder?: string
  availableModels: Doc<"aiGatewayModels">[]
  disabled?: boolean
}

// Parse creator and model name from modelId (e.g., "openai/gpt-4" -> { creator: "openai", modelName: "gpt-4" })
function parseModelId(modelId: string): { creator: string; modelName: string } {
  const slashIndex = modelId.indexOf("/")
  if (slashIndex === -1) {
    return { creator: modelId, modelName: modelId }
  }
  return {
    creator: modelId.slice(0, slashIndex),
    modelName: modelId.slice(slashIndex + 1),
  }
}

export function ModelCombobox({
  value,
  onChange,
  className,
  placeholder = "No model selected",
  availableModels,
  disabled = false,
}: ModelComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<
    Doc<"aiGatewayModels"> | undefined
  >(value)
  const [batteryState, setBatteryState] = React.useState<
    "medium" | "full" | "low"
  >("medium")
  const [groupingMode, setGroupingMode] = React.useState<GroupingMode>("creator")

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

  // Group models by maker or provider based on groupingMode
  const groups = useMemo(() => {
    const groupMap = new Map<string, Doc<"aiGatewayModels">[]>()
    for (const m of combinedModels) {
      const groupKey =
        groupingMode === "creator" ? parseModelId(m.modelId).creator : m.provider
      const arr = groupMap.get(groupKey) ?? []
      arr.push(m)
      groupMap.set(groupKey, arr)
    }
    // Sort group names alphabetically and each group's models by model name
    const groupNames = Array.from(groupMap.keys()).sort((a, b) =>
      a.localeCompare(b),
    )
    return groupNames.map((groupName) => ({
      groupName,
      models: (groupMap.get(groupName) ?? [])
        .slice()
        .sort((a, b) => {
          const aName = parseModelId(a.modelId).modelName
          const bName = parseModelId(b.modelId).modelName
          return aName.localeCompare(bName)
        }),
    }))
  }, [combinedModels, groupingMode])

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
  const displayLabel = selected ? parseModelId(selected.modelId).modelName : placeholder
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
          disabled={disabled}
        >
          <BatteryIcon className="h-4 w-4" />
        </Button>
      )}
      <Popover
        open={disabled ? false : open}
        onOpenChange={disabled ? undefined : setOpen}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
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
            <div className="flex items-center border-b px-3">
              <CommandInput
                placeholder="Search model..."
                className="h-9 flex-1 border-0"
              />
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-7 w-7 shrink-0"
                    onClick={() =>
                      setGroupingMode((m) =>
                        m === "creator" ? "provider" : "creator",
                      )
                    }
                  >
                    {groupingMode === "creator" ? (
                      <Layers className="h-4 w-4" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>
                    {groupingMode === "creator"
                      ? "Grouped by creator"
                      : "Grouped by provider"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Click to switch
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <CommandList>
              <CommandEmpty>No models found.</CommandEmpty>
              {groups.map(({ groupName, models }) => (
                <CommandGroup key={groupName} heading={groupName}>
                  {models.map((m) => {
                    const isSelected = selected?._id === m._id
                    const isUnavailable = !availableById.has(m._id)
                    const { modelName } = parseModelId(m.modelId)
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
                            {modelName}
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
