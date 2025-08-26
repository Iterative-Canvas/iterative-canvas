import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { PromptSection } from "@/components/prompt/prompt-section"
import { CanvasSection } from "@/components/canvas/canvas-section"

export function AppContentArea() {
  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={50}>
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={50} className="p-4">
            <PromptSection />
          </ResizablePanel>
          <ResizableHandle withHandle className="bg-primary/25" />
          <ResizablePanel defaultSize={50} className="p-4">
            Evals
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle withHandle className="bg-primary/25" />
      <ResizablePanel defaultSize={50} className="p-4">
        <CanvasSection />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
