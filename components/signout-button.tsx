"use client"

import { useAuthActions } from "@convex-dev/auth/react"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

export function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuthActions()

  return (
    <Button
      variant="ghost"
      size="icon"
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
