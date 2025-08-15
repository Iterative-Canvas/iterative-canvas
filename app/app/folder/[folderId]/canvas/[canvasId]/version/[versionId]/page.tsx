import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function App() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 items-center justify-center">
            <h1 className="text-2xl font-bold">
              Create a canvas to get started
            </h1>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
