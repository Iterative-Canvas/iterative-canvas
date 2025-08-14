"use client"

import { useAuthActions } from "@convex-dev/auth/react"
import { Button } from "./ui/button"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

export function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuthActions()

  return (
    <Button
      variant="ghost"
      size="icon"
      // className="h-8 w-8"
      // accept a className prop for custom styling and merge it with the default styles
      className={cn("h-8 w-8", className)}
      onClick={async () => {
        await signOut()
        window.location.reload()
      }}
    >
      <LogOut className="h-4 w-4" />
      <span className="sr-only">Logout</span>
    </Button>
  )
}
