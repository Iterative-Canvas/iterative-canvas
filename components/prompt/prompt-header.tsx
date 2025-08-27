import { Sparkles, Copy, Maximize2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu"

interface ModelSelectorProps {
  buttonClassName?: string
}

const ModelSelector = ({ buttonClassName }: ModelSelectorProps) => {
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn("px-2 text-xs", buttonClassName)}
          >
            gpt-4o
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
      </DropdownMenu>
    </div>
  )
}

export function PromptHeader() {
  return (
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-base font-medium">Prompt</CardTitle>
      <div className="flex items-center gap-1">
        <ModelSelector buttonClassName="h-8" />
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Sparkles />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Copy />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Maximize2 />
        </Button>
      </div>
    </CardHeader>
  )
}
