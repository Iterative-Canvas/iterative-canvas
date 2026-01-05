"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { usePreloadedQuery, useQuery, useMutation } from "convex/react"
import { Preloaded } from "convex/react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  ChevronsUpDown,
  ChevronsDownUp,
  X,
  Play,
  Loader2,
  PlayCircle,
  CircleDashed,
  CircleCheck,
  TriangleAlert,
  Plus,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import ModelCombobox from "@/components/ai-elements/model-combobox"
import { Doc, Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"

type EvalsContentProps = {
  preloadedCanvasVersion?: Preloaded<typeof api.public.getCanvasVersionById>
  preloadedAvailableModels?: Preloaded<typeof api.public.getAvailableModels>
}

type EvalStatus = "idle" | "running" | "complete" | "error"

type Requirement = {
  id: Id<"evals">
  text: string
  weight: number
  type: "pass-fail" | "subjective"
  threshold: number
  model: Id<"aiGatewayModels"> | undefined // Model ID (from aiGatewayModels._id)
  required: boolean
  fitToContent: boolean
  status: EvalStatus // Derived from backend eval.status
  result: "pass" | "fail" | null
  score: number | null
  reasoning: string | null
}

// const exampleRequirement: Requirement = {
//   id: 1,
//   text: "There are 5 training sessions included in the program, corresponding to UL/PPL",
//   weight: 2,
//   type: "pass-fail",
//   threshold: 1,
//   model: "gpt-4o",
//   required: true,
//   fitToContent: false,
//   loading: false,
//   result: null,
//   score: null,
//   reasoning: null,
// }

// UI helpers migrated from concept page

interface ResultIndicatorProps {
  result: "pass" | "fail" | null
  reasoning: string | null
  className?: string
}

const ResultIndicator = ({
  result,
  reasoning,
  className = "",
}: ResultIndicatorProps) => {
  const icon =
    result === "pass" ? (
      <CircleCheck className="h-4 w-4 text-green-500" />
    ) : result === "fail" ? (
      <TriangleAlert className="h-4 w-4 text-red-500" />
    ) : (
      <CircleDashed className="h-4 w-4" />
    )

  // No result yet - show disabled button without tooltip
  if (!result) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", className)}
        disabled
      >
        {icon}
      </Button>
    )
  }

  // Has result - show with tooltip containing reasoning
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 cursor-default", className)}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p>{reasoning}</p>
      </TooltipContent>
    </Tooltip>
  )
}

interface GlobalResultIndicatorProps {
  evalsStatus?: "idle" | "running" | "complete" | "error"
  aggregateScore?: number
  isSuccessful?: boolean
  successThreshold: number
}

const GlobalResultIndicator = ({
  evalsStatus,
  aggregateScore,
  isSuccessful,
  successThreshold,
}: GlobalResultIndicatorProps) => {
  // Determine result state based on evalsStatus and isSuccessful
  // Show indeterminate (CircleDashed) when:
  // - evalsStatus is "running" (evals in progress)
  // - aggregateScore is undefined (no result yet or indeterminate)
  // - evalsStatus is not "complete"
  const hasResult =
    evalsStatus === "complete" &&
    aggregateScore !== undefined &&
    isSuccessful !== undefined

  let result: "pass" | "fail" | null = null
  if (hasResult) {
    result = isSuccessful ? "pass" : "fail"
  }

  const icon =
    result === "pass" ? (
      <CircleCheck className="h-4 w-4 text-green-500" />
    ) : result === "fail" ? (
      <TriangleAlert className="h-4 w-4 text-red-500" />
    ) : (
      <CircleDashed className="h-4 w-4" />
    )

  // No result yet - show disabled button without tooltip
  if (!hasResult) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8 mr-4" disabled>
        {icon}
      </Button>
    )
  }

  // Build reasoning message
  const scorePercent = (aggregateScore * 100).toFixed(0)
  const thresholdPercent = (successThreshold * 100).toFixed(0)
  const reasoning = isSuccessful
    ? `Success! Aggregate score of ${scorePercent}% meets the ${thresholdPercent}% threshold.`
    : aggregateScore >= successThreshold
      ? `Failed. Aggregate score of ${scorePercent}% meets the ${thresholdPercent}% threshold, but a required eval did not pass.`
      : `Failed. Aggregate score of ${scorePercent}% is below the ${thresholdPercent}% threshold.`

  // Has result - show with tooltip
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 mr-4 cursor-default"
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p>{reasoning}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export function EvalsContent({
  preloadedCanvasVersion,
  preloadedAvailableModels,
}: EvalsContentProps) {
  // Get canvas version data
  const canvasVersion = preloadedCanvasVersion
    ? usePreloadedQuery(preloadedCanvasVersion)
    : null

  const versionId = canvasVersion?._id
  const serverSuccessThreshold = canvasVersion?.successThreshold ?? 0.8

  // Get evals from backend
  const evals = useQuery(
    api.public.getEvalsByCanvasVersionId,
    versionId ? { canvasVersionId: versionId } : "skip",
  )

  // Get available models from preloaded query - also reactive
  const availableModels = preloadedAvailableModels
    ? usePreloadedQuery(preloadedAvailableModels)
    : []

  // Mutations
  const createEval = useMutation(api.public.createEval)
  const updateEval = useMutation(api.public.updateEval)
  const deleteEval = useMutation(api.public.deleteEval)
  const updateSuccessThreshold = useMutation(
    api.public.updateCanvasVersionSuccessThreshold,
  )

  // Local state for UI-only concerns
  const [fitToContentMap, setFitToContentMap] = useState<
    Map<Id<"evals">, boolean>
  >(new Map())
  // Draft text for debounced updates
  const [draftTextMap, setDraftTextMap] = useState<Map<Id<"evals">, string>>(
    new Map(),
  )
  // Refs to track debounce timers
  const debounceTimersRef = useRef<Map<Id<"evals">, NodeJS.Timeout>>(new Map())

  // Derive disabled state from backend - disabled when workflow is active or evals are running
  const isDisabled = Boolean(
    canvasVersion?.activeWorkflowId || canvasVersion?.evalsStatus === "running",
  )

  // Derive evals running state from backend
  const isEvalsRunning = canvasVersion?.evalsStatus === "running"

  // Create a map of models by ID for fast lookup
  const modelsById = useMemo(() => {
    const map = new Map<string, Doc<"aiGatewayModels">>()
    for (const model of availableModels) {
      map.set(model._id, model)
    }
    return map
  }, [availableModels])

  // Helper function to derive eval text: use draft if user is typing, otherwise use server value
  const getEvalText = useCallback(
    (id: Id<"evals">) => {
      const hasActiveDebounce = debounceTimersRef.current.has(id)
      const draft = draftTextMap.get(id)
      const evalRecord = evals?.find((e) => e._id === id)
      const serverText = evalRecord?.eval ?? ""

      // If user is actively typing (has active debounce), use draft
      if (hasActiveDebounce && draft !== undefined) {
        return draft
      }

      // If draft exists and matches server, use draft (they're in sync)
      if (draft !== undefined && draft === serverText) {
        return draft
      }

      // Otherwise, use server value (will initialize draft lazily when user types)
      return serverText
    },
    [evals, draftTextMap],
  )

  // Convert evals from backend to Requirement objects for rendering
  const requirements = useMemo(() => {
    if (!evals) return []

    return evals.map((evalRecord) => {
      const type: "pass-fail" | "subjective" =
        evalRecord.type === "pass_fail" ? "pass-fail" : "subjective"
      // Derive text using helper function
      const text = getEvalText(evalRecord._id)

      // Derive result from backend score
      // For pass_fail: score of 1 = pass, 0 = fail
      // For subjective: score >= threshold = pass
      //
      // An eval is considered "indeterminate" (show CircleDashed) when:
      // - status === "running" (even if there's an existing score preserved)
      // - status === "complete" but score is undefined (shouldn't happen normally)
      // - status === "idle" with no score (never run)
      let result: "pass" | "fail" | null = null
      if (evalRecord.status === "complete" && evalRecord.score !== undefined) {
        if (evalRecord.type === "pass_fail") {
          result = evalRecord.score === 1 ? "pass" : "fail"
        } else {
          const threshold = evalRecord.threshold ?? 0.5
          result = evalRecord.score >= threshold ? "pass" : "fail"
        }
      }
      // Note: If status is "running", result stays null (indeterminate)
      // even if there's a preserved score from a previous run

      return {
        id: evalRecord._id,
        text,
        weight: evalRecord.weight,
        type,
        threshold: evalRecord.threshold ?? 0.5,
        model: evalRecord.modelId,
        required: evalRecord.isRequired,
        fitToContent: fitToContentMap.get(evalRecord._id) ?? false,
        status: (evalRecord.status ?? "idle") as EvalStatus,
        result,
        score: evalRecord.score ?? null,
        reasoning: evalRecord.explanation ?? null,
      }
    })
  }, [evals, fitToContentMap, getEvalText])

  // Sync success threshold with server
  const [successThreshold, setSuccessThreshold] = useState(
    serverSuccessThreshold,
  )

  useEffect(() => {
    if (serverSuccessThreshold !== undefined) {
      setSuccessThreshold(serverSuccessThreshold)
    }
  }, [serverSuccessThreshold])

  // Debounced function to update text in backend
  const debouncedUpdateText = useCallback(
    (id: Id<"evals">, text: string) => {
      // Clear existing timer for this eval
      const existingTimer = debounceTimersRef.current.get(id)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }

      // Set new timer
      const timer = setTimeout(async () => {
        debounceTimersRef.current.delete(id)
        await updateEval({
          evalId: id,
          eval: text,
        })
      }, 500) // 500ms debounce delay

      debounceTimersRef.current.set(id, timer)
    },
    [updateEval],
  )

  const handleRequirementChange = useCallback(
    async <K extends keyof Requirement>(
      id: Id<"evals">,
      field: K,
      value: Requirement[K],
    ) => {
      if (!versionId) return

      // Handle text changes with debouncing
      if (field === "text") {
        const textValue = value as string
        // Update draft immediately for responsive UI
        setDraftTextMap((prev) => {
          const newMap = new Map(prev)
          newMap.set(id, textValue)
          return newMap
        })
        // Debounce the backend update
        debouncedUpdateText(id, textValue)
      } else if (field === "weight") {
        await updateEval({
          evalId: id,
          weight: value as number,
        })
      } else if (field === "type") {
        const dbType =
          (value as string) === "pass-fail" ? "pass_fail" : "subjective"
        await updateEval({
          evalId: id,
          type: dbType,
        })
      } else if (field === "threshold") {
        await updateEval({
          evalId: id,
          threshold: value as number,
        })
      } else if (field === "model") {
        await updateEval({
          evalId: id,
          modelId: value as Id<"aiGatewayModels"> | undefined,
        })
      } else if (field === "required") {
        await updateEval({
          evalId: id,
          isRequired: value as boolean,
        })
      }
    },
    [versionId, updateEval, debouncedUpdateText],
  )

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of debounceTimersRef.current.values()) {
        clearTimeout(timer)
      }
      debounceTimersRef.current.clear()
    }
  }, [])

  const toggleFitToContent = useCallback((id: Id<"evals">) => {
    setFitToContentMap((prev) => {
      const newMap = new Map(prev)
      newMap.set(id, !(prev.get(id) ?? false))
      return newMap
    })
  }, [])

  const handleDeleteRequirement = useCallback(
    async (id: Id<"evals">) => {
      await deleteEval({ evalId: id })
    },
    [deleteEval],
  )

  const handleAddRequirement = useCallback(async () => {
    if (!versionId) return

    // Get default model from user preferences or app defaults
    const defaultModelId = availableModels.find(
      (m) => m.modelId === "openai/gpt-4o",
    )?._id

    await createEval({
      versionId,
      eval: "",
      modelId: defaultModelId,
      isRequired: true,
      weight: 1,
      type: "pass_fail",
      threshold: undefined,
    })
  }, [versionId, createEval, availableModels])

  const handleSuccessThresholdChange = useCallback(
    async (value: number) => {
      setSuccessThreshold(value)
      if (versionId) {
        await updateSuccessThreshold({
          versionId,
          successThreshold: value,
        })
      }
    },
    [versionId, updateSuccessThreshold],
  )

  // Mutation for running all evals
  const runEvals = useMutation(api.public.runEvals)
  // Mutation for running a single eval
  const runSingleEvalManually = useMutation(api.public.runSingleEvalManually)

  // Handler for running all evals
  const handleRunAll = useCallback(async () => {
    if (!versionId || isDisabled) return
    try {
      await runEvals({ versionId })
    } catch (error) {
      console.error("Failed to run evals:", error)
    }
  }, [versionId, runEvals, isDisabled])

  // Handler for running a single eval
  const handleRunSingleEval = useCallback(
    async (evalId: Id<"evals">) => {
      if (isDisabled) return
      try {
        await runSingleEvalManually({ evalId })
      } catch (error) {
        console.error("Failed to run eval:", error)
      }
    },
    [runSingleEvalManually, isDisabled],
  )

  return (
    <CardContent className="flex flex-1 flex-col gap-3 overflow-auto">
      <Card className="flex flex-1 flex-col pl-8 pr-4 rounded-md shadow-xs overflow-auto">
        <div className="flex-1 space-y-10 min-h-[120px]">
          {requirements.map((req) => {
            const isEvalRunning = req.status === "running"
            return (
              <div key={req.id} className="flex flex-col gap-2 -ml-6">
                <div className="flex">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 mt-1 hover:text-red-500"
                    onClick={() => handleDeleteRequirement(req.id)}
                    disabled={isDisabled}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 flex flex-col">
                    <div className="relative w-full">
                      <Textarea
                        placeholder="Enter requirement..."
                        className={cn(
                          "text-sm pr-8 resize-none scrollbars-hidden",
                          req.fitToContent
                            ? "field-sizing-content overflow-hidden"
                            : "field-sizing-fixed h-9 overflow-auto",
                        )}
                        rows={req.fitToContent ? undefined : 1}
                        value={req.text}
                        onChange={(e) =>
                          handleRequirementChange(
                            req.id,
                            "text",
                            e.target.value,
                          )
                        }
                        disabled={isDisabled}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="absolute top-1 right-1 h-6 w-6 text-primary/30"
                        onClick={() => toggleFitToContent(req.id)}
                        title={req.fitToContent ? "Collapse" : "Expand"}
                      >
                        {req.fitToContent ? (
                          <ChevronsDownUp className="h-4 w-4" />
                        ) : (
                          <ChevronsUpDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor={`req-${req.id}`}>Required?</Label>
                          <Checkbox
                            id={`req-${req.id}`}
                            checked={req.required}
                            onCheckedChange={(checked) =>
                              handleRequirementChange(
                                req.id,
                                "required",
                                Boolean(checked),
                              )
                            }
                            disabled={isDisabled}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor={`weight-${req.id}`}>Weight</Label>
                          <Input
                            id={`weight-${req.id}`}
                            type="number"
                            min="1"
                            step="1"
                            value={req.weight}
                            onChange={(e) =>
                              handleRequirementChange(
                                req.id,
                                "weight",
                                Number.parseInt(e.target.value),
                              )
                            }
                            className="h-6 w-14 text-xs"
                            disabled={isDisabled}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Label>Type</Label>
                          <Select
                            value={req.type}
                            onValueChange={(
                              value: "pass-fail" | "subjective",
                            ) => handleRequirementChange(req.id, "type", value)}
                            disabled={isDisabled}
                          >
                            <SelectTrigger className="h-6 text-xs w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pass-fail">
                                Pass/Fail
                              </SelectItem>
                              <SelectItem value="subjective">
                                Subjective
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {req.type === "subjective" && (
                          <div className="flex items-center gap-1.5">
                            <Label htmlFor={`threshold-${req.id}`}>
                              Threshold
                            </Label>
                            <Input
                              id={`threshold-${req.id}`}
                              type="number"
                              min="0"
                              max="1"
                              step="0.1"
                              value={req.threshold}
                              onChange={(e) =>
                                handleRequirementChange(
                                  req.id,
                                  "threshold",
                                  Number.parseFloat(e.target.value),
                                )
                              }
                              className="h-6 w-16 text-xs"
                              disabled={isDisabled}
                            />
                          </div>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          <ModelCombobox
                            value={
                              req.model ? modelsById.get(req.model) : undefined
                            }
                            onChange={(model) =>
                              handleRequirementChange(
                                req.id,
                                "model",
                                model?._id,
                              )
                            }
                            availableModels={availableModels}
                            className="h-6"
                            disabled={isDisabled}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={isDisabled || isEvalRunning}
                            onClick={() => handleRunSingleEval(req.id)}
                          >
                            {isEvalRunning ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                          </Button>
                          <Separator orientation="vertical" className="h-4" />
                          <ResultIndicator
                            result={req.result}
                            reasoning={req.reasoning}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {/* A little hack to keep proper spacing between the last list item and the bottom border of the card container */}
          <div className="h-px" />
        </div>
      </Card>
      <div className="flex justify-end items-center gap-4">
        <div className="flex items-center gap-2">
          <Label
            htmlFor="success-threshold"
            className={cn(
              "text-xs font-normal",
              isDisabled && "text-muted-foreground",
            )}
          >
            Success Threshold
          </Label>
          <Input
            id="success-threshold"
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={successThreshold}
            onChange={(e) =>
              handleSuccessThresholdChange(Number.parseFloat(e.target.value))
            }
            className="h-8 w-20"
            disabled={isDisabled}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddRequirement}
          disabled={isDisabled}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Requirement
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRunAll}
          disabled={isDisabled}
        >
          {isEvalsRunning ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <PlayCircle className="h-4 w-4 mr-2" />
          )}
          Run All
        </Button>
        <Separator orientation="vertical" className="h-6" />
        {/* Global result indicator */}
        <GlobalResultIndicator
          evalsStatus={canvasVersion?.evalsStatus}
          aggregateScore={canvasVersion?.aggregateScore}
          isSuccessful={canvasVersion?.isSuccessful}
          successThreshold={successThreshold}
        />
      </div>
    </CardContent>
  )
}
