"use client"

import { useAuthActions } from "@convex-dev/auth/react"

export default function SignInPage() {
  const { signIn } = useAuthActions()
  return (
    <main>
      <h1>Sign in</h1>
      <button
        onClick={() =>
          void signIn(
            "github",
            // Could specify the redirect here if we wanted to
            // override the default redirect in convex/auth.ts
            // { redirectTo: "/some-random-page" }
          )
        }
      >
        Continue with GitHub
      </button>
    </main>
  )
}
