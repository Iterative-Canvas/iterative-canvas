import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { PromptSection } from "@/components/prompt/prompt-section"
import { CanvasSection } from "@/components/canvas/canvas-section"

export function AppContentArea() {
  return (
    <ResizablePanelGroup direction="horizontal" className="flex-1">
      <ResizablePanel defaultSize={50} className="scrollbar-hidden">
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={50} className="p-4 !overflow-hidden">
            <PromptSection />
          </ResizablePanel>
          <ResizableHandle withHandle className="bg-primary/25" />
          <ResizablePanel
            defaultSize={50}
            className="p-4 !overflow-y-auto scrollbar-hidden"
          >
            {/* Requirements Section */}
            <div className="h-full"></div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle withHandle className="bg-primary/25" />
      <ResizablePanel
        defaultSize={50}
        className="p-4 !overflow-y-auto scrollbar-hidden"
      >
        <CanvasSection />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
