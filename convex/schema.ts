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
    name: v.string(),
  })
    .index("userId", ["userId"])
    .index("folderId", ["folderId"]),

  canvasVersions: defineTable({
    canvasId: v.id("canvases"),
    parentVersionId: v.optional(v.id("canvasVersions")),
    name: v.optional(v.string()),
    isDraft: v.boolean(),
  })
    .index("canvasId", ["canvasId"])
    .index("parentVersionId", ["parentVersionId"])
    .index("canvasId_draft", ["canvasId", "isDraft"]),

  prompts: defineTable({
    canvasVersionId: v.id("canvasVersions"),
    model: v.string(),
    content: v.optional(v.string()),
  }).index("canvasVersionId", ["canvasVersionId"]),

  requirementGroups: defineTable({
    canvasVersionId: v.id("canvasVersions"),
    successThreshold: v.number(),
  }).index("canvasVersionId", ["canvasVersionId"]),

  requirements: defineTable({
    requirementGroupId: v.id("requirementGroups"),
    model: v.string(),
    content: v.optional(v.string()),
    isRequired: v.boolean(),
    weight: v.number(),
    type: v.union(v.literal("pass_fail"), v.literal("subjective")),
    threshold: v.optional(v.number()),
  }).index("requirementGroupId", ["requirementGroupId"]),

  evaluations: defineTable({
    requirementId: v.id("requirements"),
    score: v.number(),
    explanation: v.string(),
  }).index("requirementId", ["requirementId"]),

  responses: defineTable({
    canvasVersionId: v.id("canvasVersions"),
    content: v.optional(v.string()),
  }).index("canvasVersionId", ["canvasVersionId"]),

  roles: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
  }).index("name", ["name"]),

  permissions: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
  }).index("name", ["name"]),

  role_permissions: defineTable({
    roleId: v.id("roles"),
    permissionId: v.id("permissions"),
  })
    .index("roleId", ["roleId"])
    .index("permissionId", ["permissionId"])
    .index("role_permission_pair", ["roleId", "permissionId"]),

  user_roles: defineTable({
    userId: v.id("users"),
    roleId: v.id("roles"),
  })
    .index("userId", ["userId"])
    .index("roleId", ["roleId"])
    .index("user_role_pair", ["userId", "roleId"]),
})

export default schema
