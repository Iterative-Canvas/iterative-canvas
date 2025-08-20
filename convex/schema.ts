import { defineSchema, defineTable } from "convex/server"
import { authTables } from "@convex-dev/auth/server"
import { v } from "convex/values"

const schema = defineSchema({
  ...authTables,

  folders: defineTable({
    userId: v.id("users"),
    name: v.string(),
  }).index("userId_name", ["userId", "name"]),

  canvases: defineTable({
    userId: v.id("users"),
    folderId: v.optional(v.id("folders")),
    name: v.optional(v.string()),
    // Update this any time a canvas or any of it's child entities are modified
    entityUpdate: v.id("entityUpdates"),
  }).index("userId_folderId", ["userId", "folderId"]),

  // Allows us to track an updated time for "domain entities", such as a canvas, when
  // considered as a logical unit with all of it's children and relations. By structuring
  // the schema this way, rather than including updatedTime as a field directly on the
  // canvases table, we can avoid problems associated with "over-reactivity", in which
  // canvas queries that don't care about updatedTime are constantly re-running.
  entityUpdates: defineTable({
    updatedTime: v.number(),
  }),

  canvasVersions: defineTable({
    canvasId: v.id("canvases"),
    parentVersionId: v.optional(v.id("canvasVersions")),
    // Useful for linear versioning. Kinda irrelevant if we switch to branching.
    // A `name` field might be more useful in a branching model.
    versionNo: v.optional(v.number()),
    isDraft: v.boolean(),
    promptModel: v.optional(v.string()),
    prompt: v.optional(v.string()),
    response: v.optional(v.string()),
    successThreshold: v.optional(v.number()),
  })
    // If we move to a branching model, then we'll probably want a parentVersionId index
    .index("canvasId_isDraft", ["canvasId", "isDraft"]),

  evals: defineTable({
    canvasVersionId: v.id("canvasVersions"),
    model: v.optional(v.string()),
    eval: v.optional(v.string()),
    isRequired: v.boolean(),
    weight: v.number(),
    type: v.union(v.literal("pass_fail"), v.literal("subjective")),
    threshold: v.optional(v.number()),
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
})

export default schema
