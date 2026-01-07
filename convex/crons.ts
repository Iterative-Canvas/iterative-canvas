import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

crons.cron(
  "syncAIGatewayModelsEveryDay",
  "0 0 * * *", // daily at midnight UTC
  internal.private.fetchAndSyncAIGatewayModels,
)

// This, combined with the local dev idempotency of fetchAndSyncAIGatewayModels, is a poor man's `onApplicationStart` hook.
// Convex does not provide any lifecycle hooks. Running this on startup in local dev just to ensure that the dev database
// is actually updated once in a while.
if (process.env.NODE_ENV === "development") {
  crons.interval(
    "syncAIGatewayModelsEveryMinute",
    { seconds: 60 },
    internal.private.fetchAndSyncAIGatewayModels,
  )
}

export default crons
