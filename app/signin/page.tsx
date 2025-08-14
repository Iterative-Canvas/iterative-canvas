"use client"

import { useAuthActions } from "@convex-dev/auth/react"
import { useSearchParams } from "next/navigation"

export default function SignInPage() {
  const { signIn } = useAuthActions()
  const params = useSearchParams()
  const redirectTo = params.get("redirectTo") ?? "/app"

  return (
    <main>
      <h1>Sign in</h1>
      <button onClick={() => void signIn("github", { redirectTo })}>
        Continue with GitHub
      </button>
    </main>
  )
}
