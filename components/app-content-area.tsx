"use client"

import {
  ComponentProps,
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Panel as PanelPrimitive,
  PanelGroup as PanelGroupPrimitive,
  ImperativePanelGroupHandle,
  ImperativePanelHandle,
} from "react-resizable-panels"
import { ResizableHandle } from "@/components/ui/resizable"
import { PromptSection } from "@/components/prompt/prompt-section"
import { CanvasSection } from "@/components/canvas/canvas-section"
import { EvalsSection } from "@/components/evals/evals-section"
import { cn } from "@/lib/utils"
import { Preloaded } from "convex/react"
import { api } from "@/convex/_generated/api"

const DEFAULT_HORIZONTAL_LAYOUT: [number, number] = [50, 50]
const DEFAULT_VERTICAL_LAYOUT: [number, number] = [50, 50]
const PROMPT_MAX_HORIZONTAL: [number, number] = [100, 0]
const PROMPT_MAX_VERTICAL: [number, number] = [100, 0]
const EVALS_MAX_VERTICAL: [number, number] = [0, 100]
const CANVAS_MAX_HORIZONTAL: [number, number] = [0, 100]

const PanelGroup = forwardRef<
  ImperativePanelGroupHandle,
  ComponentProps<typeof PanelGroupPrimitive>
>(({ className, ...props }, ref) => (
  <PanelGroupPrimitive
    ref={ref}
    data-slot="resizable-panel-group"
    className={cn(
      "flex h-full w-full min-w-0 data-[panel-group-direction=vertical]:flex-col",
      className,
    )}
    {...props}
  />
))
PanelGroup.displayName = "PanelGroup"

const Panel = forwardRef<
  ImperativePanelHandle,
  ComponentProps<typeof PanelPrimitive>
>(({ className, ...props }, ref) => (
  <PanelPrimitive
    ref={ref}
    data-slot="resizable-panel"
    className={className}
    {...props}
  />
))
Panel.displayName = "Panel"

export function AppContentArea({
  preloadedCanvasVersion,
  preloadedAvailableModels,
}: {
  preloadedCanvasVersion?: Preloaded<typeof api.public.getCanvasVersionById>
  preloadedAvailableModels?: Preloaded<typeof api.public.getAvailableModels>
}) {
  const horizontalGroupRef = useRef<ImperativePanelGroupHandle>(null)
  const verticalGroupRef = useRef<ImperativePanelGroupHandle>(null)
  const leftPanelRef = useRef<ImperativePanelHandle>(null)
  const promptPanelRef = useRef<ImperativePanelHandle>(null)
  const evalsPanelRef = useRef<ImperativePanelHandle>(null)
  const canvasPanelRef = useRef<ImperativePanelHandle>(null)

  const [promptCollapsed, setPromptCollapsed] = useState(false)
  const [evalsCollapsed, setEvalsCollapsed] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [canvasCollapsed, setCanvasCollapsed] = useState(false)

  const resetPanelsLayout = useCallback(() => {
    promptPanelRef.current?.expand()
    evalsPanelRef.current?.expand()
    leftPanelRef.current?.expand()
    canvasPanelRef.current?.expand()
    horizontalGroupRef.current?.setLayout([...DEFAULT_HORIZONTAL_LAYOUT])
    verticalGroupRef.current?.setLayout([...DEFAULT_VERTICAL_LAYOUT])
    setPromptCollapsed(false)
    setEvalsCollapsed(false)
    setLeftCollapsed(false)
    setCanvasCollapsed(false)
  }, [])

  const maximizePromptPanel = useCallback(() => {
    leftPanelRef.current?.expand()
    promptPanelRef.current?.expand()
    evalsPanelRef.current?.collapse()
    canvasPanelRef.current?.collapse()
    horizontalGroupRef.current?.setLayout([...PROMPT_MAX_HORIZONTAL])
    verticalGroupRef.current?.setLayout([...PROMPT_MAX_VERTICAL])
    setPromptCollapsed(false)
    setEvalsCollapsed(true)
    setLeftCollapsed(false)
    setCanvasCollapsed(true)
  }, [])

  const maximizeEvalsPanel = useCallback(() => {
    leftPanelRef.current?.expand()
    evalsPanelRef.current?.expand()
    promptPanelRef.current?.collapse()
    canvasPanelRef.current?.collapse()
    horizontalGroupRef.current?.setLayout([...PROMPT_MAX_HORIZONTAL])
    verticalGroupRef.current?.setLayout([...EVALS_MAX_VERTICAL])
    setPromptCollapsed(true)
    setEvalsCollapsed(false)
    setLeftCollapsed(false)
    setCanvasCollapsed(true)
  }, [])

  const maximizeCanvasPanel = useCallback(() => {
    canvasPanelRef.current?.expand()
    promptPanelRef.current?.expand()
    evalsPanelRef.current?.expand()
    leftPanelRef.current?.collapse()
    horizontalGroupRef.current?.setLayout([...CANVAS_MAX_HORIZONTAL])
    verticalGroupRef.current?.setLayout([...DEFAULT_VERTICAL_LAYOUT])
    setPromptCollapsed(false)
    setEvalsCollapsed(false)
    setLeftCollapsed(true)
    setCanvasCollapsed(false)
  }, [])

  const promptMaximized = useMemo(
    () => !promptCollapsed && evalsCollapsed && canvasCollapsed,
    [promptCollapsed, evalsCollapsed, canvasCollapsed],
  )

  const evalsMaximized = useMemo(
    () => !evalsCollapsed && promptCollapsed && canvasCollapsed,
    [evalsCollapsed, promptCollapsed, canvasCollapsed],
  )

  const canvasMaximized = useMemo(
    () => !canvasCollapsed && leftCollapsed,
    [canvasCollapsed, leftCollapsed],
  )

  return (
    <PanelGroup
      id="horizontal-panel-group"
      direction="horizontal"
      ref={horizontalGroupRef}
      className="flex-1"
    >
      <Panel
        defaultSize={50}
        collapsible
        ref={leftPanelRef}
        onResize={(size) => setLeftCollapsed(size === 0)}
      >
        <PanelGroup id="vertical-panel-group" direction="vertical" ref={verticalGroupRef}>
          <Panel
            defaultSize={50}
            className="p-4"
            collapsible
            ref={promptPanelRef}
            onResize={(size) => setPromptCollapsed(size === 0)}
          >
            <PromptSection
              onMaximize={maximizePromptPanel}
              onRestore={resetPanelsLayout}
              isMaximized={promptMaximized}
              preloadedCanvasVersion={preloadedCanvasVersion}
              preloadedAvailableModels={preloadedAvailableModels}
            />
          </Panel>
          <ResizableHandle withHandle className="bg-primary/25" />
          <Panel
            defaultSize={50}
            className="p-4"
            collapsible
            ref={evalsPanelRef}
            onResize={(size) => setEvalsCollapsed(size === 0)}
          >
            <EvalsSection
              onMaximize={maximizeEvalsPanel}
              onRestore={resetPanelsLayout}
              isMaximized={evalsMaximized}
              preloadedCanvasVersion={preloadedCanvasVersion}
              preloadedAvailableModels={preloadedAvailableModels}
            />
          </Panel>
        </PanelGroup>
      </Panel>
      <ResizableHandle withHandle className="bg-primary/25" />
      <Panel
        defaultSize={50}
        className="p-4"
        collapsible
        ref={canvasPanelRef}
        onResize={(size) => setCanvasCollapsed(size === 0)}
      >
        <CanvasSection
          onMaximize={maximizeCanvasPanel}
          onRestore={resetPanelsLayout}
          isMaximized={canvasMaximized}
          preloadedCanvasVersion={preloadedCanvasVersion}
        />
      </Panel>
    </PanelGroup>
  )
}
