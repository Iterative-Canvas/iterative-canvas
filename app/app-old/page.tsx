"use client"

import { useEffect, useRef, useState } from "react"
import { useCompletion } from "@ai-sdk/react"
import {
  Archive,
  Clock,
  Copy,
  Download,
  Eye,
  History,
  Share,
  Trash2,
  Send,
  Sparkles,
  Plus,
  Play,
  X,
  PlayCircle,
  RefreshCw,
  Maximize2,
  ChevronDown,
  ChevronsUpDown,
  ChevronsDownUp,
  CircleDashed,
  CircleCheck,
  TriangleAlert,
  Loader2,
  Wrench,
  BatteryMedium,
  BatteryFull,
  BatteryLow,
  Paperclip,
  Minimize2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import {
  ImperativePanelGroupHandle,
  ImperativePanelHandle,
} from "react-resizable-panels"

const actionButtons = [
  { icon: History, label: "History" },
  { icon: Clock, label: "Recent" },
  { icon: Share, label: "Share" },
  { icon: Eye, label: "Preview" },
  { icon: Copy, label: "Copy" },
  { icon: Download, label: "Download" },
  { icon: Archive, label: "Archive" },
  { icon: Trash2, label: "Delete" },
]

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

const RunButton = ({
  disabled,
  loading,
  tooltipText,
  onRunClick,
  onRunWithoutEvalClick,
}: {
  disabled: boolean
  loading: boolean
  tooltipText: string
  onRunClick: () => void
  onRunWithoutEvalClick: () => void
}) => {
  const buttonGroup = (
    <div
      className="inline-flex items-center rounded-md shadow-xs"
      aria-disabled={disabled}
    >
      <Button
        className="rounded-r-none bg-primary hover:bg-primary/90 h-8 disabled:bg-primary/50 disabled:cursor-not-allowed"
        disabled={disabled}
        onClick={onRunClick}
      >
        {!loading ? (
          <Send className="h-4 w-4" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
      </Button>
      <Separator orientation="vertical" className="h-4 bg-white/20" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            className="rounded-l-none bg-primary hover:bg-primary/90 h-8 w-8 disabled:bg-primary/50 disabled:cursor-not-allowed"
            disabled={disabled}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRunWithoutEvalClick}>
            Run Without Evaluating Requirements
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  if (disabled && !loading) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{buttonGroup}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return buttonGroup
}

const RefinePopover = () => {
  const [includePrompt, setIncludePrompt] = useState(true)
  const [includeEvalResults, setIncludeEvalResults] = useState(true)
  const [includeCustom, setIncludeCustom] = useState(false)
  const [usePredictedOutputs, setUsePredictedOutputs] = useState(false)
  const [refineModel, setRefineModel] = useState("gpt-4o")

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

  const isDisabled =
    !includePrompt &&
    !includeEvalResults &&
    !includeCustom &&
    !usePredictedOutputs

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refine Response
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium leading-none">Refine Canvas</h4>
              <ModelSelector
                models={models}
                selectedModel={refineModel}
                onModelChange={setRefineModel}
                buttonClassName="h-7"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Select the elements to include as additional context when refining
              the canvas.
            </p>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includePrompt"
                checked={includePrompt}
                onCheckedChange={(checked) =>
                  setIncludePrompt(Boolean(checked))
                }
              />
              <Label htmlFor="includePrompt">Prompt</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeEvalResults"
                checked={includeEvalResults}
                onCheckedChange={(checked) =>
                  setIncludeEvalResults(Boolean(checked))
                }
              />
              <Label htmlFor="includeEvalResults">Evaluation Results</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeCustom"
                checked={includeCustom}
                onCheckedChange={(checked) =>
                  setIncludeCustom(Boolean(checked))
                }
              />
              <Label htmlFor="includeCustom">Custom Instructions</Label>
            </div>
            {includeCustom && (
              <Textarea
                placeholder="Enter custom instructions..."
                className="mt-1"
              />
            )}
            {(refineModel === "gpt-4o" || refineModel === "gpt-4o-mini") && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Predicted outputs are generated based on the current prompt
                  and requirements to anticipate the final response.
                </p>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="usePredictedOutputs"
                    checked={usePredictedOutputs}
                    onCheckedChange={(checked) =>
                      setUsePredictedOutputs(Boolean(checked))
                    }
                  />
                  <Label htmlFor="usePredictedOutputs">
                    Use Predicted Outputs
                  </Label>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <RunButton
              disabled={isDisabled}
              loading={false}
              tooltipText="Select at least one element to refine."
              onRunClick={() => {}}
              onRunWithoutEvalClick={() => {}}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

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

interface FileAndToolChipProps {
  name: string
  onDelete: () => void
}

const FileAndToolChip = ({ name, onDelete }: FileAndToolChipProps) => (
  <div className="flex items-center gap-1 bg-muted text-muted-foreground rounded-full px-2 py-1 text-xs animate-in fade-in-50">
    <span>{name}</span>
    <button
      onClick={onDelete}
      className="rounded-full hover:bg-muted-foreground/20 p-0.5"
      aria-label={`Remove ${name}`}
    >
      <X className="h-3 w-3" />
    </button>
  </div>
)

interface FileUploaderProps {
  onAddFiles: (files: { id: number; name: string }[]) => void
}

const FileUploader = ({ onAddFiles }: FileUploaderProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleAddFiles = () => {
    onAddFiles([
      { id: 1, name: "flowchart.jpg" },
      { id: 2, name: "financials.pdf" },
    ])
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Paperclip className="h-4 w-4" />
          <span className="sr-only">Add</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <Button onClick={handleAddFiles} variant="outline" size="sm">
          Add Photos and Files
        </Button>
      </PopoverContent>
    </Popover>
  )
}

interface ToolsPopoverProps {
  enabledTools: {
    codeInterpreter: boolean
    webSearch: boolean
  }
  onToolChange: (tool: "codeInterpreter" | "webSearch", value: boolean) => void
}

const ToolsPopover = ({ enabledTools, onToolChange }: ToolsPopoverProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Wrench className="h-4 w-4" />
          <span className="sr-only">Tools</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Tools</h4>
            <p className="text-sm text-muted-foreground">
              Enable tools for the model to use.
            </p>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="codeInterpreter"
                checked={enabledTools.codeInterpreter}
                onCheckedChange={(checked) =>
                  onToolChange("codeInterpreter", Boolean(checked))
                }
              />
              <Label htmlFor="codeInterpreter">Code Interpreter</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="webSearch"
                checked={enabledTools.webSearch}
                onCheckedChange={(checked) =>
                  onToolChange("webSearch", Boolean(checked))
                }
              />
              <Label htmlFor="webSearch">Web Search</Label>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function App() {
  const [canvas, setCanvas] = useState("")
  const [selectedModel, setSelectedModel] = useState("gpt-4o")
  const [requirements, setRequirements] = useState(initialRequirements)
  const [successThreshold, setSuccessThreshold] = useState(0.8)
  const [isRunAllLoading, setIsRunAllLoading] = useState(false)
  const [overallResult, setOverallResult] = useState<ResultIndicatorProps>({
    result: null,
    score: null,
    reasoning: null,
  })
  const [attachedFiles, setAttachedFiles] = useState<
    { id: number; name: string }[]
  >([])
  const [enabledTools, setEnabledTools] = useState({
    codeInterpreter: false,
    webSearch: false,
  })

  const [promptPanelCollapsed, setPromptPanelCollapsed] = useState(false)
  const [requirementsPanelCollapsed, setRequirementsPanelCollapsed] =
    useState(false)
  const [
    promptRequirementsPanelCollapsed,
    setPromptRequirementsPanelCollapsed,
  ] = useState(false)

  const firstPanelGroupRef = useRef<ImperativePanelGroupHandle>(null)
  const secondPanelGroupRef = useRef<ImperativePanelGroupHandle>(null)
  const promptPanelRef = useRef<ImperativePanelHandle>(null)
  const requirementsPanelRef = useRef<ImperativePanelHandle>(null)
  const promptRequirementsPanelRef = useRef<ImperativePanelHandle>(null)
  const canvasPanelRef = useRef<ImperativePanelHandle>(null)

  const maximizePromptPanel = () => {
    const requirementsPanel = requirementsPanelRef.current
    const canvasPanel = canvasPanelRef.current
    if (requirementsPanel && canvasPanel) {
      requirementsPanel.collapse()
      canvasPanel.collapse()
    }
  }

  const maximizeRequirementsPanel = () => {
    const promptPanel = promptPanelRef.current
    const canvasPanel = canvasPanelRef.current
    if (promptPanel && canvasPanel) {
      promptPanel.collapse()
      canvasPanel.collapse()
    }
  }

  const maximizeCanvasPanel = () => {
    const promptRequirementsPanel = promptRequirementsPanelRef.current
    if (promptRequirementsPanel) {
      promptRequirementsPanel.collapse()
    }
  }

  const resetPanelsLayout = () => {
    const firstPanelGroup = firstPanelGroupRef.current
    const secondPanelGroup = secondPanelGroupRef.current
    if (firstPanelGroup && secondPanelGroup) {
      firstPanelGroup.setLayout([50, 50])
      secondPanelGroup.setLayout([50, 50])
    }
  }

  const {
    completion,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
  } = useCompletion({
    api: "/api/generate-response",
  })

  useEffect(() => {
    if (completion) setCanvas(completion)
  }, [completion])

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

  const handleRequirementChange = <K extends keyof Requirement>(
    id: number,
    field: K,
    value: Requirement[K],
  ) => {
    setRequirements((prev) =>
      prev.map((req) => (req.id === id ? { ...req, [field]: value } : req)),
    )
  }

  const handleDeleteFile = (id: number) => {
    setAttachedFiles((files) => files.filter((file) => file.id !== id))
  }

  const handleAddFiles = (newFiles: { id: number; name: string }[]) => {
    setAttachedFiles((currentFiles) => {
      const existingIds = new Set(currentFiles.map((f) => f.id))
      const uniqueNewFiles = newFiles.filter((f) => !existingIds.has(f.id))
      return [...currentFiles, ...uniqueNewFiles]
    })
  }

  const handleToolChange = (
    tool: "codeInterpreter" | "webSearch",
    value: boolean,
  ) => {
    setEnabledTools((prev) => ({ ...prev, [tool]: value }))
  }

  const toggleFitToContent = (id: number) => {
    setRequirements((prev) =>
      prev.map((req) =>
        req.id === id ? { ...req, fitToContent: !req.fitToContent } : req,
      ),
    )
  }

  const runSingleRequirement = async (req: (typeof requirements)[0]) => {
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
        newReasoning = `The model's output did not meet the threshold. It scored ${newScore.toFixed(
          2,
        )} which is below the required pass condition.`
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
        // Add a random delay to simulate network requests
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

    const overallReasoning = `Overall weighted score of ${overallScore.toFixed(
      2,
    )} was ${overallPass ? "above" : "below"} the success threshold of ${successThreshold}.`

    setRequirements(updatedRequirements)
    setOverallResult({
      result: overallPass ? "pass" : "fail",
      score: overallScore,
      reasoning: overallReasoning,
    })
    setIsRunAllLoading(false)
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center gap-2">
            <h1 className="text-lg font-semibold">Lesson Plan • v2</h1>
          </div>
          <div className="flex items-center gap-1">
            {actionButtons.map((button, index) => (
              <Button
                key={index}
                variant="ghost"
                size="icon"
                className="h-8 w-8"
              >
                <button.icon className="h-4 w-4" />
                <span className="sr-only">{button.label}</span>
              </Button>
            ))}
          </div>
        </header>
        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1"
          ref={firstPanelGroupRef}
        >
          <ResizablePanel
            defaultSize={50}
            className="scrollbar-hidden"
            ref={promptRequirementsPanelRef}
            collapsible={true}
            onResize={(size) => setPromptRequirementsPanelCollapsed(size === 0)}
          >
            <ResizablePanelGroup direction="vertical" ref={secondPanelGroupRef}>
              <ResizablePanel
                defaultSize={50}
                className="p-4 !overflow-y-auto scrollbar-hidden"
                ref={promptPanelRef}
                collapsible={true}
                onResize={(size) => setPromptPanelCollapsed(size === 0)}
              >
                {/* User Prompt Section */}
                <div className="h-full">
                  <Card className="flex flex-col h-full border-none shadow-none gap-4 py-5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-base font-medium">
                        Prompt
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <ModelSelector
                          models={models}
                          selectedModel={selectedModel}
                          onModelChange={setSelectedModel}
                          buttonClassName="h-8"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Sparkles className="h-4 w-4" />
                          <span className="sr-only">Improve Prompt</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Copy className="h-4 w-4" />
                          <span className="sr-only">Copy</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={
                            requirementsPanelCollapsed
                              ? resetPanelsLayout
                              : maximizeRequirementsPanel
                          }
                        >
                          {requirementsPanelCollapsed ? (
                            <Minimize2 className="h-4 w-4" />
                          ) : (
                            <Maximize2 className="h-4 w-4" />
                          )}
                          <span className="sr-only">
                            {requirementsPanelCollapsed
                              ? "Restore"
                              : "Full Screen"}
                          </span>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col relative">
                      <Textarea
                        value={input}
                        placeholder="Enter your prompt here..."
                        onChange={handleInputChange}
                        className="flex-1 resize-none pb-16 field-sizing-fixed"
                      />
                      <div className="absolute py-2 bottom-px left-6 right-6 mx-2 flex items-center justify-between bg-background/95">
                        <div className="flex items-center gap-1">
                          <FileUploader onAddFiles={handleAddFiles} />
                          <ToolsPopover
                            enabledTools={enabledTools}
                            onToolChange={handleToolChange}
                          />
                          {enabledTools.codeInterpreter && (
                            <FileAndToolChip
                              name="Code Interpreter"
                              onDelete={() =>
                                handleToolChange("codeInterpreter", false)
                              }
                            />
                          )}
                          {enabledTools.webSearch && (
                            <FileAndToolChip
                              name="Web Search"
                              onDelete={() =>
                                handleToolChange("webSearch", false)
                              }
                            />
                          )}
                          {attachedFiles.map((file) => (
                            <FileAndToolChip
                              key={file.id}
                              name={file.name}
                              onDelete={() => handleDeleteFile(file.id)}
                            />
                          ))}
                        </div>
                        <RunButton
                          disabled={!input || isLoading}
                          loading={isLoading}
                          tooltipText="Please enter a prompt to run."
                          onRunClick={handleSubmit}
                          onRunWithoutEvalClick={() => {}}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle className="bg-primary/25" />
              <ResizablePanel
                defaultSize={50}
                className="p-4 !overflow-y-auto scrollbar-hidden"
                ref={requirementsPanelRef}
                collapsible={true}
                onResize={(size) => setRequirementsPanelCollapsed(size === 0)}
              >
                {/* Requirements Section */}
                <div className="h-full">
                  <Card className="flex flex-col h-full border-none shadow-none gap-4 py-5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-base font-medium">
                        Requirements
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Sparkles className="h-4 w-4" />
                          <span className="sr-only">Improve Prompt</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={
                            promptPanelCollapsed
                              ? resetPanelsLayout
                              : maximizePromptPanel
                          }
                        >
                          {promptPanelCollapsed ? (
                            <Minimize2 className="h-4 w-4" />
                          ) : (
                            <Maximize2 className="h-4 w-4" />
                          )}
                          <span className="sr-only">
                            {promptPanelCollapsed ? "Restore" : "Full Screen"}
                          </span>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-3 overflow-auto">
                      <Card className="flex flex-1 flex-col pl-8 pr-4 rounded-md shadow-xs overflow-auto scrollbar-hidden">
                        <div className="flex-1 space-y-8 min-h-[120px]">
                          {requirements.map((req) => (
                            <div
                              key={req.id}
                              className="flex flex-col gap-2 -ml-6"
                            >
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
                                        handleRequirementChange(
                                          req.id,
                                          "text",
                                          e.target.value,
                                        )
                                      }
                                    />
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="absolute top-1 right-1 h-6 w-6 text-primary/30"
                                      onClick={() => toggleFitToContent(req.id)}
                                      title={
                                        req.fitToContent ? "Collapse" : "Expand"
                                      }
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
                                        <Label htmlFor={`req-${req.id}`}>
                                          Required?
                                        </Label>
                                        <Checkbox
                                          id={`req-${req.id}`}
                                          checked={req.required}
                                          onCheckedChange={(checked: boolean) =>
                                            handleRequirementChange(
                                              req.id,
                                              "required",
                                              checked,
                                            )
                                          }
                                        />
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <Label htmlFor={`weight-${req.id}`}>
                                          Weight
                                        </Label>
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
                                          onValueChange={(
                                            value: "pass-fail" | "subjective",
                                          ) =>
                                            handleRequirementChange(
                                              req.id,
                                              "type",
                                              value,
                                            )
                                          }
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
                                          <Label
                                            htmlFor={`threshold-${req.id}`}
                                          >
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
                                                Number.parseFloat(
                                                  e.target.value,
                                                ),
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
                                            handleRequirementChange(
                                              req.id,
                                              "model",
                                              model,
                                            )
                                          }
                                          buttonClassName="h-6"
                                        />
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() =>
                                            handleRunRequirement(req.id)
                                          }
                                          disabled={req.loading}
                                        >
                                          {req.loading ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Play className="h-3 w-3" />
                                          )}
                                        </Button>
                                        <Separator
                                          orientation="vertical"
                                          className="h-4"
                                        />
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
                          <Label
                            htmlFor="success-threshold"
                            className="text-xs font-normal"
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
                              setSuccessThreshold(
                                Number.parseFloat(e.target.value),
                              )
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
                  </Card>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle withHandle className="bg-primary/25" />
          <ResizablePanel
            defaultSize={50}
            className="p-4 !overflow-y-auto scrollbar-hidden"
            ref={canvasPanelRef}
            collapsible={true}
          >
            {/* Right Half - Canvas */}
            <div className="h-full min-w-64">
              <Card className="flex flex-col h-full border-none shadow-none gap-4 py-5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-medium">
                    Canvas
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Copy className="h-4 w-4" />
                      <span className="sr-only">Copy</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={
                        promptRequirementsPanelCollapsed
                          ? resetPanelsLayout
                          : maximizeCanvasPanel
                      }
                    >
                      {promptRequirementsPanelCollapsed ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )}
                      <span className="sr-only">
                        {promptRequirementsPanelCollapsed
                          ? "Restore"
                          : "Full Screen"}
                      </span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <Textarea
                    value={canvas}
                    placeholder="The generated response will appear here..."
                    className="flex-1 resize-none field-sizing-fixed"
                    onChange={(e) => setCanvas(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <RefinePopover />
                  </div>
                </CardContent>
              </Card>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>
    </SidebarProvider>
  )
}
