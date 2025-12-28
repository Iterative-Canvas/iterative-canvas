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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import ModelCombobox from "@/components/ai-elements/model-combobox"
import { Doc, Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"

type EvalsContentProps = {
  preloadedCanvasVersion?: Preloaded<typeof api.public.getCanvasVersionById>
  preloadedAvailableModels?: Preloaded<typeof api.public.getAvailableModels>
}

type Requirement = {
  id: Id<"evals">
  text: string
  weight: number
  type: "pass-fail" | "subjective"
  threshold: number
  model: Id<"aiGatewayModels"> | undefined // Model ID (from aiGatewayModels._id)
  required: boolean
  fitToContent: boolean
  loading: boolean
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
  score: number | null
  reasoning: string | null
  className?: string
}

const ResultIndicator = ({
  result,
  score,
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", className)}
        >
          {icon}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="grid gap-2 text-sm">
          <p>
            <span className="font-semibold">Score:</span> {score?.toFixed(2)}
          </p>
          <div>
            <p className="font-semibold">Reasoning:</p>
            <p className="text-muted-foreground">{reasoning}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
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
  const [loadingMap, setLoadingMap] = useState<Map<Id<"evals">, boolean>>(
    new Map(),
  )
  const [resultMap, setResultMap] = useState<
    Map<
      Id<"evals">,
      { result: "pass" | "fail" | null; score: number | null; reasoning: string | null }
    >
  >(new Map())
  // Draft text for debounced updates
  const [draftTextMap, setDraftTextMap] = useState<
    Map<Id<"evals">, string>
  >(new Map())
  // Refs to track debounce timers
  const debounceTimersRef = useRef<Map<Id<"evals">, NodeJS.Timeout>>(
    new Map(),
  )
  const [isRunAllLoading, setIsRunAllLoading] = useState(false)
  const [overallResult, setOverallResult] = useState<
    Pick<ResultIndicatorProps, "result" | "score" | "reasoning">
  >({
    result: null,
    score: null,
    reasoning: null,
  })

  // Create a map of models by ID for fast lookup
  const modelsById = useMemo(() => {
    const map = new Map<string, Doc<"aiGatewayModels">>()
    for (const model of availableModels) {
      map.set(model._id, model)
    }
    return map
  }, [availableModels])

  // Sync draft text with server text when it changes (similar to PromptInput)
  // Only update draft if there's no active debounce timer and server text differs
  useEffect(() => {
    if (!evals) return

    setDraftTextMap((prev) => {
      const newMap = new Map(prev)
      for (const evalRecord of evals) {
        const serverText = evalRecord.eval ?? ""
        const currentDraft = newMap.get(evalRecord._id)
        const hasActiveDebounce = debounceTimersRef.current.has(evalRecord._id)

        if (currentDraft === undefined) {
          // No draft exists, initialize with server text
          newMap.set(evalRecord._id, serverText)
        } else if (!hasActiveDebounce && currentDraft !== serverText) {
          // No active debounce and server text differs - server was updated from elsewhere
          newMap.set(evalRecord._id, serverText)
        }
        // If hasActiveDebounce, keep the draft (user is typing)
        // If currentDraft === serverText, keep the draft (they're in sync)
      }
      return newMap
    })
  }, [evals])

  // Convert evals from backend to Requirement objects for rendering
  const requirements = useMemo(() => {
    if (!evals) return []

    return evals.map((evalRecord) => {
      const type: "pass-fail" | "subjective" =
        evalRecord.type === "pass_fail" ? "pass-fail" : "subjective"
      const resultData = resultMap.get(evalRecord._id) || {
        result: null,
        score: null,
        reasoning: null,
      }
      // Use draft text if available, otherwise use server text
      const text = draftTextMap.get(evalRecord._id) ?? evalRecord.eval ?? ""

      return {
        id: evalRecord._id,
        text,
        weight: evalRecord.weight,
        type,
        threshold: evalRecord.threshold ?? 0.5,
        model: evalRecord.modelId,
        required: evalRecord.isRequired,
        fitToContent: fitToContentMap.get(evalRecord._id) ?? false,
        loading: loadingMap.get(evalRecord._id) ?? false,
        ...resultData,
      }
    })
  }, [evals, fitToContentMap, loadingMap, resultMap, draftTextMap])

  // Sync success threshold with server
  const [successThreshold, setSuccessThreshold] = useState(serverSuccessThreshold)

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
        const dbType = (value as string) === "pass-fail" ? "pass_fail" : "subjective"
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

  const runSingleRequirement = async (req: Requirement) => {
    let newResult: "pass" | "fail" = "fail"
    let newScore: number | null = null
    let newReasoning = ""

    if (req.type === "pass-fail") {
      const randomBit = Math.round(Math.random())
      newScore = randomBit
      if (randomBit === 1) newResult = "pass"
    } else if (req.type === "subjective") {
      const randomValue = Math.random()
      newScore = randomValue
      if (randomValue >= req.threshold) newResult = "pass"
    }

    if (newScore !== null) {
      if (newResult === "pass") {
        newReasoning = `The model's output successfully met the criteria with a score of ${newScore.toFixed(2)}.`
      } else {
        newReasoning = `The model's output did not meet the threshold. It scored ${newScore.toFixed(2)} which is below the required pass condition.`
      }
    }

    return {
      result: newResult,
      score: newScore,
      reasoning: newReasoning,
    }
  }

  const handleRunRequirement = async (id: Id<"evals">) => {
    setLoadingMap((prev) => {
      const newMap = new Map(prev)
      newMap.set(id, true)
      return newMap
    })
    setResultMap((prev) => {
      const newMap = new Map(prev)
      newMap.set(id, { result: null, score: null, reasoning: null })
      return newMap
    })

    await new Promise((resolve) => setTimeout(resolve, 1500))
    const reqToRun = requirements.find((r) => r.id === id)
    if (reqToRun) {
      const result = await runSingleRequirement(reqToRun)
      setLoadingMap((prev) => {
        const newMap = new Map(prev)
        newMap.set(id, false)
        return newMap
      })
      setResultMap((prev) => {
        const newMap = new Map(prev)
        newMap.set(id, result)
        return newMap
      })
    }
  }

  const handleRunAll = async () => {
    setIsRunAllLoading(true)
    setOverallResult({ result: null, score: null, reasoning: null })

    // Set all requirements to loading
    const loadingMapUpdate = new Map<Id<"evals">, boolean>()
    const resultMapUpdate = new Map<
      Id<"evals">,
      { result: "pass" | "fail" | null; score: number | null; reasoning: string | null }
    >()
    requirements.forEach((req) => {
      loadingMapUpdate.set(req.id, true)
      resultMapUpdate.set(req.id, { result: null, score: null, reasoning: null })
    })
    setLoadingMap(loadingMapUpdate)
    setResultMap(resultMapUpdate)

    const updatedResults = await Promise.all(
      requirements.map(
        (req) =>
          new Promise<{
            id: Id<"evals">
            result: Awaited<ReturnType<typeof runSingleRequirement>>
          }>(async (resolve) => {
            await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000))
            const result = await runSingleRequirement(req)
            resolve({ id: req.id, result })
          }),
      ),
    )

    // Update results
    const finalLoadingMap = new Map<Id<"evals">, boolean>()
    const finalResultMap = new Map<
      Id<"evals">,
      { result: "pass" | "fail" | null; score: number | null; reasoning: string | null }
    >()
    updatedResults.forEach(({ id, result }) => {
      finalLoadingMap.set(id, false)
      finalResultMap.set(id, result)
    })
    setLoadingMap(finalLoadingMap)
    setResultMap(finalResultMap)

    // Calculate overall score
    const validReqs: Array<Requirement & { score: number }> = []
    for (const { id, result } of updatedResults) {
      const req = requirements.find((r) => r.id === id)
      if (req && result.score !== null) {
        validReqs.push({ ...req, score: result.score })
      }
    }

    const totalWeight = validReqs.reduce((sum, req) => sum + req.weight, 0)
    const weightedSum = validReqs.reduce(
      (sum, req) => sum + req.score * req.weight,
      0,
    )
    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0
    const overallPass = overallScore >= successThreshold

    const overallReasoning = `Overall weighted score of ${overallScore.toFixed(2)} was ${
      overallPass ? "above" : "below"
    } the success threshold of ${successThreshold}.`

    setOverallResult({
      result: overallPass ? "pass" : "fail",
      score: overallScore,
      reasoning: overallReasoning,
    })
    setIsRunAllLoading(false)
  }

  return (
    <CardContent className="flex flex-1 flex-col gap-3 overflow-auto">
      <Card className="flex flex-1 flex-col pl-8 pr-4 rounded-md shadow-xs overflow-auto">
        <div className="flex-1 space-y-10 min-h-[120px]">
          {requirements.map((req) => (
            <div key={req.id} className="flex flex-col gap-2 -ml-6">
              <div className="flex">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 mt-1 hover:text-red-500"
                  onClick={() => handleDeleteRequirement(req.id)}
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
                        handleRequirementChange(req.id, "text", e.target.value)
                      }
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
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label>Type</Label>
                        <Select
                          value={req.type}
                          onValueChange={(value: "pass-fail" | "subjective") =>
                            handleRequirementChange(req.id, "type", value)
                          }
                        >
                          <SelectTrigger className="h-6 text-xs w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pass-fail">Pass/Fail</SelectItem>
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
                          />
                        </div>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <ModelCombobox
                          value={req.model ? modelsById.get(req.model) : undefined}
                          onChange={(model) =>
                            handleRequirementChange(
                              req.id,
                              "model",
                              model?._id,
                            )
                          }
                          availableModels={availableModels}
                          className="h-6"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRunRequirement(req.id)}
                          disabled={req.loading}
                        >
                          {req.loading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </Button>
                        <Separator orientation="vertical" className="h-4" />
                        <ResultIndicator
                          result={req.result}
                          score={req.score}
                          reasoning={req.reasoning}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {/* A little hack to keep proper spacing between the last list item and the bottom border of the card container */}
          <div className="h-px" />
        </div>
      </Card>
      <div className="flex justify-end items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="success-threshold" className="text-xs font-normal">
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
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleAddRequirement}>
          <Plus className="h-4 w-4 mr-2" />
          Add Requirement
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRunAll}
          disabled={isRunAllLoading}
        >
          {isRunAllLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <PlayCircle className="h-4 w-4 mr-2" />
          )}
          Run All
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <ResultIndicator
          result={overallResult.result}
          score={overallResult.score}
          reasoning={overallResult.reasoning}
          className="mr-4"
        />
      </div>
    </CardContent>
  )
}
