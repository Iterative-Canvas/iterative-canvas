import { WorkflowManager } from "@convex-dev/workflow"
import { components } from "./_generated/api"

export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    // Retry failed steps with exponential backoff
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 1000,
      base: 2,
    },
    retryActionsByDefault: true,
    // TODO: Consider making this configurable in the user settings
    // Reasonable parallelism for running multiple evals concurrently
    maxParallelism: 10,
  },
})
