import { defineSchema, defineTable } from "convex/server"
import { authTables } from "@convex-dev/auth/server"
import { v } from "convex/values"

const schema = defineSchema({
  ...authTables,

  userPreferences: defineTable({
    userId: v.id("users"),
    defaultPromptModelId: v.optional(v.id("aiGatewayModels")),
    defaultRefineModelId: v.optional(v.id("aiGatewayModels")),
    defaultEvalsModelId: v.optional(v.id("aiGatewayModels")),
    // Automatically run evals after generating, refining, or manually editing the canvas?
    autoRunEvals: v.boolean(),
  }).index("userId", ["userId"]),

  folders: defineTable({
    userId: v.id("users"),
    name: v.string(),
  }).index("userId_name", ["userId", "name"]),

  canvases: defineTable({
    userId: v.id("users"),
    folderId: v.optional(v.id("folders")),
    name: v.optional(v.string()),
  }).index("userId_folderId", ["userId", "folderId"]),

  // Allows us to track an updated time for "domain entities", such as a canvas, when
  // considered as a logical unit with all of it's children and relations. By structuring
  // the schema this way, rather than including updatedTime as a field directly on the
  // canvases table, we can avoid problems associated with "over-reactivity", in which
  // canvas queries that don't care about updatedTime are constantly re-running.
  // NOTE: For right now, this table design isn't super generic and just works for canvases.
  // Can refactor later if we want to track updatedTime for other entities.
  entityUpdates: defineTable({
    canvasId: v.id("canvases"),
    updatedTime: v.number(),
  }).index("canvasId", ["canvasId"]),

  canvasVersions: defineTable({
    canvasId: v.id("canvases"),
    parentVersionId: v.optional(v.id("canvasVersions")),
    // Useful for linear versioning. Kinda irrelevant if we switch to branching.
    // A `name` field might be more useful in a branching model.
    // For draft versions, set this to the versionNo of the parent version.
    versionNo: v.number(),
    isDraft: v.boolean(),
    // This field is only applicable to draft versions
    // This allows us to track whether the draft has been
    // edited since it was created from the parent version.
    hasBeenEdited: v.optional(v.boolean()),
    promptModelId: v.optional(v.id("aiGatewayModels")),
    prompt: v.optional(v.string()),
    refineModelId: v.optional(v.id("aiGatewayModels")),
    successThreshold: v.optional(v.number()),
    // =========================================================================
    // Response Generation State
    // =========================================================================
    // The full response text (reconstructed from chunks when generation completes)
    response: v.optional(v.string()),
    // Status of response generation: idle → generating → complete | error
    responseStatus: v.optional(
      v.union(
        v.literal("idle"),
        v.literal("generating"),
        v.literal("complete"),
        v.literal("error")
      )
    ),
    // Error message if responseStatus is "error"
    responseError: v.optional(v.string()),
    // Timestamp when response generation completed (or errored)
    responseCompletedAt: v.optional(v.number()),
    // Timestamp when response was last modified (generation or manual edit)
    // Used to determine if canvas is "evaluated" (compare with evalsCompletedAt)
    responseModifiedAt: v.optional(v.number()),
    // =========================================================================
    // Eval Execution State (Aggregate)
    // =========================================================================
    // Status of running all evals: idle → running → complete | error
    evalsStatus: v.optional(
      v.union(
        v.literal("idle"),
        v.literal("running"),
        v.literal("complete"),
        v.literal("error")
      )
    ),
    // Timestamp when evals completed running
    evalsCompletedAt: v.optional(v.number()),
    // Weighted aggregate score across all evals [0, 1]
    aggregateScore: v.optional(v.number()),
    // Overall success: aggregateScore >= successThreshold AND all required evals passed
    isSuccessful: v.optional(v.boolean()),
    // =========================================================================
    // Workflow Tracking (for durable workflows)
    // =========================================================================
    // Reference to the active workflow (from @convex-dev/workflow component)
    activeWorkflowId: v.optional(v.string()),
  })
    // If we move to a branching model, then we'll probably want a parentVersionId index
    .index("canvasId_isDraft", ["canvasId", "isDraft"]),

  // =========================================================================
  // Response Chunks (for streaming response generation)
  // =========================================================================
  // Stores incremental chunks of the response as they stream in from the LLM.
  // Enables: (1) reactive streaming to frontend, (2) recovery from disconnects,
  // (3) response reconstruction on page refresh mid-generation.
  // See: unbreakable-ai-chat.md for the pattern.
  responseChunks: defineTable({
    canvasVersionId: v.id("canvasVersions"),
    content: v.string(),
    // Ordering index for reconstructing the full response
    chunkIndex: v.number(),
  }).index("canvasVersionId_chunkIndex", ["canvasVersionId", "chunkIndex"]),

  evals: defineTable({
    canvasVersionId: v.id("canvasVersions"),
    modelId: v.optional(v.id("aiGatewayModels")),
    eval: v.optional(v.string()),
    isRequired: v.boolean(),
    weight: v.number(),
    type: v.union(v.literal("pass_fail"), v.literal("subjective")),
    threshold: v.optional(v.number()),
    // =========================================================================
    // Individual Eval Execution State
    // =========================================================================
    // Status of this individual eval: idle → running → complete | error
    status: v.optional(
      v.union(
        v.literal("idle"),
        v.literal("running"),
        v.literal("complete"),
        v.literal("error")
      )
    ),
    // Error message if status is "error"
    error: v.optional(v.string()),
    // Timestamp when this eval last completed running
    completedAt: v.optional(v.number()),
    // Eval results (populated when status is "complete")
    score: v.optional(v.number()),
    explanation: v.optional(v.string()),
  }).index("canvasVersionId", ["canvasVersionId"]),

  roles: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
  }),

  permissions: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
  }),

  rolesPermissions: defineTable({
    roleId: v.id("roles"),
    permissionId: v.id("permissions"),
  }).index("roleId_permissionId", ["roleId", "permissionId"]),

  usersRoles: defineTable({
    userId: v.id("users"),
    roleId: v.id("roles"),
  }).index("userId_roleId", ["userId", "roleId"]),

  aiGatewayModels: defineTable({
    modelId: v.string(),
    name: v.string(),
    description: v.string(),
    provider: v.string(),
    input: v.number(),
    output: v.number(),
    cachedInputTokens: v.optional(v.number()),
    cacheCreationInputTokens: v.optional(v.number()),
    isDeprecated: v.boolean(),
  }).index("isDeprecated_provider_name", ["isDeprecated", "provider", "name"]),
})

export default schema
