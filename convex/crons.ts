import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

crons.daily(
  "syncAIGatewayModels",
  {
    hourUTC: 0,
    minuteUTC: 0,
  },
  internal.private.fetchAndSyncAIGatewayModels,
)

export default crons
