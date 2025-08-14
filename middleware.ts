import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server"
import { NextRequest, NextResponse } from "next/server"

const isSignIn = createRouteMatcher(["/signin"])
const isProtected = createRouteMatcher(["/app(.*)"])

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authed = await convexAuth.isAuthenticated()

  // If the user is authenticated and trying to access the sign-in page,
  // redirect them to the app page.
  if (isSignIn(request) && authed) {
    return nextjsMiddlewareRedirect(request, "/app")
  }

  // If the user is not authenticated and trying to access a protected route,
  // redirect them to the sign-in page with the original URL as a query parameter.
  if (isProtected(request) && !authed) {
    const url = new URL(request.url)
    const redirectTo = url.pathname + url.search

    const dest = request.nextUrl.clone()
    dest.pathname = "/signin"
    dest.search = ""
    dest.searchParams.set("redirectTo", redirectTo)

    const route = dest.pathname + dest.search

    // Have to use the patched redirect function for now until the helper
    // provided by Convex is fixed to properly handle query parameters.
    return PATCHED_nextjsMiddlewareRedirect(request, route)
  }
})

export const config = {
  // The following matcher runs middleware on all routes except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}

function PATCHED_nextjsMiddlewareRedirect(request: NextRequest, route: string) {
  const url = request.nextUrl.clone()

  // Parse the incoming route so we can split path & query correctly
  // Prepend a dummy origin because URL() requires absolute URLs
  const parsed = new URL(route, "http://dummy")

  // Assign the path
  url.pathname = parsed.pathname

  // Clear any existing search params
  url.search = ""

  // Copy search params from the provided route
  parsed.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value)
  })

  return NextResponse.redirect(url)
}
