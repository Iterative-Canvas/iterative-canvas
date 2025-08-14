import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server"

const isSignIn = createRouteMatcher(["/signin"])
const isProtected = createRouteMatcher(["/app(.*)"])

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authed = await convexAuth.isAuthenticated()

  if (isSignIn(request) && authed) {
    return nextjsMiddlewareRedirect(request, "/app")
  }
  if (isProtected(request) && !authed) {
    return nextjsMiddlewareRedirect(request, "/")
  }
  // else fall through
})

export const config = {
  // The following matcher runs middleware on all routes except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
}
