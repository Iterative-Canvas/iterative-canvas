import { useMemo } from "react"
import { Preloaded, useQuery } from "convex/react"
import type { FunctionReference } from "convex/server"
import { jsonToConvex } from "convex/values"

// TODO: This hasn't been tested yet, so I'm not 100% sure it works as intended.
// The idea is that it allows you to skip a preloaded query, just like you can
// skip a normal query.
export function useSkippablePreloadedQuery<
  Q extends FunctionReference<"query">,
>(preloaded: Preloaded<Q>, skip: boolean): Q["_returnType"] {
  const args = useMemo(
    () => jsonToConvex(preloaded._argsJSON) as Q["_args"],
    [preloaded._argsJSON],
  )
  const preloadedResult = useMemo(
    () => jsonToConvex(preloaded._valueJSON) as Q["_returnType"],
    [preloaded._valueJSON],
  )

  // `useQuery` accepts either args or the literal "skip"
  const result = useQuery(
    preloaded._name as unknown as Q, // `useQuery` handles string names internally
    skip ? ("skip" as const) : args,
  )

  // If we're skipping (or the client hasn't loaded yet), keep using the server result
  if (skip) {
    return preloadedResult
  }
  if (result === undefined) {
    return preloadedResult
  }
  return result
}
