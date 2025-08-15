import { defineSchema, defineTable } from "convex/server"
import { authTables } from "@convex-dev/auth/server"
import { v } from "convex/values"

const schema = defineSchema({
  ...authTables,

  folders: defineTable({
    userId: v.id("users"),
    name: v.string(),
  }).index("userId", ["userId"]),

  canvases: defineTable({
    userId: v.id("users"),
    folderId: v.optional(v.id("folders")),
    name: v.optional(v.string()),
    // Update this any time a canvas or any of it's child entities are modified
    lastModifiedTime: v.number(),
  })
    .index("userId", ["userId"])
    .index("folderId", ["folderId"])
    .index("userId_lastModifiedTime", ["userId", "lastModifiedTime"]),

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
    .index("canvasId", ["canvasId"])
    .index("parentVersionId", ["parentVersionId"])
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
  }).index("name", ["name"]),

  permissions: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
  }).index("name", ["name"]),

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
