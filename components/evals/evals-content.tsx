"use client"

import { useState } from "react"
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
  ChevronDown,
  BatteryMedium,
  BatteryFull,
  BatteryLow,
  CircleDashed,
  CircleCheck,
  TriangleAlert,
  Plus,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Types and initial data

type Requirement = {
  id: number
  text: string
  weight: number
  type: "pass-fail" | "subjective"
  threshold: number
  model: string
  required: boolean
  fitToContent: boolean
  loading: boolean
  result: "pass" | "fail" | null
  score: number | null
  reasoning: string | null
}

const initialRequirements: Requirement[] = [
  {
    id: 1,
    text: "The content is suitable for high school freshmen or sophomores with little to no programming experience.",
    weight: 1,
    type: "subjective",
    threshold: 0.75,
    model: "gpt-4o",
    required: true,
    fitToContent: false,
    loading: false,
    result: null,
    score: null,
    reasoning: null,
  },
  {
    id: 2,
    text: "Monday through Friday, with two 1-hour sessions each day",
    weight: 1,
    type: "pass-fail",
    threshold: 1,
    model: "gpt-4o",
    required: true,
    fitToContent: false,
    loading: false,
    result: null,
    score: null,
    reasoning: null,
  },
  {
    id: 3,
    text: "Morning sessions focus on theory and concepts",
    weight: 1,
    type: "subjective",
    threshold: 0.8,
    model: "gpt-4o",
    required: true,
    fitToContent: false,
    loading: false,
    result: null,
    score: null,
    reasoning: null,
  },
  {
    id: 4,
    text: "Afternoon sessions focus on practical exercises and projects that reinforce the concepts learned in the morning",
    weight: 1,
    type: "subjective",
    threshold: 0.8,
    model: "gpt-4o",
    required: false,
    fitToContent: false,
    loading: false,
    result: null,
    score: null,
    reasoning: null,
  },
  {
    id: 5,
    text: "The curriculum is built around JavaScript, HTML, and CSS",
    weight: 1,
    type: "subjective",
    threshold: 0.8,
    model: "gpt-4o",
    required: false,
    fitToContent: false,
    loading: false,
    result: null,
    score: null,
    reasoning: null,
  },
  {
    id: 6,
    text: "Course is structured to gradually build on concepts, starting with basic programming principles and moving towards more complex topics",
    weight: 1,
    type: "subjective",
    threshold: 0.8,
    model: "gpt-4o",
    required: false,
    fitToContent: false,
    loading: false,
    result: null,
    score: null,
    reasoning: null,
  },
]

const models = [
  "gpt-4o",
  "chatgpt-4o-latest",
  "gpt-4o-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "o3",
  "o3-pro",
  "o3-mini",
  "o1",
  "o1-pro",
  "o4-mini",
]

// UI helpers migrated from concept page

interface ModelSelectorProps {
  models: string[]
  selectedModel: string
  onModelChange: (model: string) => void
  buttonClassName?: string
}

const ModelSelector = ({
  models,
  selectedModel,
  onModelChange,
  buttonClassName,
}: ModelSelectorProps) => {
  const [batteryState, setBatteryState] = useState<"medium" | "full" | "low">(
    "medium",
  )

  const batteryModels = ["o3", "o3-pro", "o3-mini", "o1", "o1-pro", "o4-mini"]
  const showBatteryButton = batteryModels.includes(selectedModel)

  const handleBatteryClick = () => {
    setBatteryState((currentState) => {
      if (currentState === "medium") return "full"
      if (currentState === "full") return "low"
      return "medium"
    })
  }

  const batteryIcons = {
    medium: BatteryMedium,
    full: BatteryFull,
    low: BatteryLow,
  }
  const BatteryIcon = batteryIcons[batteryState]

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn("px-2 text-xs", buttonClassName)}
          >
            {selectedModel}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {models.map((model) => (
            <DropdownMenuItem key={model} onSelect={() => onModelChange(model)}>
              {model}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {showBatteryButton && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleBatteryClick}
        >
          <BatteryIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

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

export function EvalsContent() {
  const [requirements, setRequirements] =
    useState<Requirement[]>(initialRequirements)
  const [successThreshold, setSuccessThreshold] = useState(0.8)
  const [isRunAllLoading, setIsRunAllLoading] = useState(false)
  const [overallResult, setOverallResult] = useState<
    Pick<ResultIndicatorProps, "result" | "score" | "reasoning">
  >({
    result: null,
    score: null,
    reasoning: null,
  })

  const handleRequirementChange = <K extends keyof Requirement>(
    id: number,
    field: K,
    value: Requirement[K],
  ) => {
    setRequirements((prev) =>
      prev.map((req) => (req.id === id ? { ...req, [field]: value } : req)),
    )
  }

  const toggleFitToContent = (id: number) => {
    setRequirements((prev) =>
      prev.map((req) =>
        req.id === id ? { ...req, fitToContent: !req.fitToContent } : req,
      ),
    )
  }

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
      ...req,
      loading: false,
      result: newResult,
      score: newScore,
      reasoning: newReasoning,
    }
  }

  const handleRunRequirement = async (id: number) => {
    setRequirements((prev) =>
      prev.map((req) =>
        req.id === id
          ? {
              ...req,
              loading: true,
              result: null,
              score: null,
              reasoning: null,
            }
          : req,
      ),
    )
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const reqToRun = requirements.find((r) => r.id === id)
    if (reqToRun) {
      const updatedReq = await runSingleRequirement(reqToRun)
      setRequirements((prev) => prev.map((r) => (r.id === id ? updatedReq : r)))
    }
  }

  const handleRunAll = async () => {
    setIsRunAllLoading(true)
    setOverallResult({ result: null, score: null, reasoning: null })
    setRequirements((prev) =>
      prev.map((req) => ({
        ...req,
        loading: true,
        result: null,
        score: null,
        reasoning: null,
      })),
    )

    const updatedRequirements = await Promise.all(
      requirements.map((req) =>
        new Promise((resolve) =>
          setTimeout(resolve, 500 + Math.random() * 1000),
        ).then(() => runSingleRequirement(req)),
      ),
    )

    const validReqs = updatedRequirements.filter((r) => r.score !== null)
    const totalWeight = validReqs.reduce((sum, req) => sum + req.weight, 0)
    const weightedSum = validReqs.reduce(
      (sum, req) => sum + (req.score ?? 0) * req.weight,
      0,
    )
    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0
    const overallPass = overallScore >= successThreshold

    const overallReasoning = `Overall weighted score of ${overallScore.toFixed(2)} was ${
      overallPass ? "above" : "below"
    } the success threshold of ${successThreshold}.`

    setRequirements(updatedRequirements)
    setOverallResult({
      result: overallPass ? "pass" : "fail",
      score: overallScore,
      reasoning: overallReasoning,
    })
    setIsRunAllLoading(false)
  }

  return (
    <CardContent className="flex flex-1 flex-col gap-3 overflow-auto">
      <Card className="flex flex-1 flex-col pl-8 pr-4 rounded-md shadow-xs overflow-auto scrollbar-hidden">
        <div className="flex-1 space-y-8 min-h-[120px]">
          {requirements.map((req) => (
            <div key={req.id} className="flex flex-col gap-2 -ml-6">
              <div className="flex">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 mt-1 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex-1 flex flex-col">
                  <div className="relative w-full">
                    <Textarea
                      placeholder="Enter requirement..."
                      className={cn(
                        "text-sm pr-8 resize-none scrollbar-hidden",
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
                        <ModelSelector
                          models={models}
                          selectedModel={req.model}
                          onModelChange={(model) =>
                            handleRequirementChange(req.id, "model", model)
                          }
                          buttonClassName="h-6"
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
              setSuccessThreshold(Number.parseFloat(e.target.value))
            }
            className="h-8 w-20"
          />
        </div>
        <Button variant="outline" size="sm">
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
