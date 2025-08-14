import { convexAuth } from "@convex-dev/auth/server"
import GitHub from "@auth/core/providers/github"

const BASE = process.env.SITE_URL!

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [GitHub],
  callbacks: {
    async redirect({ redirectTo }) {
      // Default target if nothing was provided:
      const target = redirectTo ?? "/app"

      // Turn relative paths into absolute URLs using SITE_URL:
      const url = new URL(target, BASE)

      // Safety: only allow same-origin redirects (prevents open redirects)
      const baseOrigin = new URL(BASE).origin
      if (url.origin !== baseOrigin) return BASE

      return url.toString()
    },
  },
})
