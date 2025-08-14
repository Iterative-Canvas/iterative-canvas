---
applyTo: "___THIS_PATTERN_MATCHES_NOTHING___"
---

_Note_: Update `applyTo` in the frontmatter of this file to have it automatically included as additional context for the specified file types. For example: `**/*.ts,**/*.tsx,**/*.js,**/*.jsx`

# Schemas

A schema is a description of

1. the tables in your Convex project
2. the type of documents within your tables

While it is possible to use Convex _without_ defining a schema, adding a
`schema.ts` file will ensure that the documents in your tables are the correct
type. If you're using
[TypeScript](/understanding/best-practices/typescript.mdx), adding a schema will
also give you end-to-end type safety throughout your app.

We recommend beginning your project without a schema for rapid prototyping and
then adding a schema once you've solidified your plan. To learn more see our
[Schema Philosophy](/database/advanced/schema-philosophy.md).

**Example:**
[TypeScript and Schemas](https://github.com/get-convex/convex-demos/tree/main/typescript)

## Writing schemas

Schemas are defined in a `schema.ts` file in your `convex/` directory and look
like:

<Snippet source={SchemaTS} title="convex/schema.ts" />

This schema (which is based on our
[users and auth example](https://github.com/get-convex/convex-demos/tree/main/users-and-auth)),
has 2 tables: messages and users. Each table is defined using the
[`defineTable`](/api/modules/server#definetable) function. Within each table,
the document type is defined using the validator builder,
[`v`](/api/modules/values#v). In addition to the fields listed, Convex will also
automatically add `_id` and `_creationTime` fields. To learn more, see
[System Fields](/database/types.md#system-fields).

<Admonition type="tip" title="Generating a Schema">

While writing your schema, it can be helpful to consult the
[Convex Dashboard](/dashboard/deployments/data.md#generating-a-schema). The
"Generate Schema" button in the "Data" view suggests a schema declaration based
on the data in your tables.

</Admonition>

### Validators

The validator builder, [`v`](/api/modules/values#v) is used to define the type
of documents in each table. It has methods for each of
[Convex's types](/database/types):

```ts noDialect title="convex/schema.ts"
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  documents: defineTable({
    id: v.id("documents"),
    string: v.string(),
    number: v.number(),
    boolean: v.boolean(),
    nestedObject: v.object({
      property: v.string(),
    }),
  }),
})
```

It additionally allows you to define unions, optional property, string literals,
and more. [Argument validation](/functions/validation.mdx) and schemas both use
the same validator builder, `v`.

#### Optional fields

You can describe optional fields by wrapping their type with `v.optional(...)`:

```typescript
defineTable({
  optionalString: v.optional(v.string()),
  optionalNumber: v.optional(v.number()),
})
```

This corresponds to marking fields as optional with `?` in TypeScript.

#### Unions

You can describe fields that could be one of multiple types using `v.union`:

```typescript
defineTable({
  stringOrNumber: v.union(v.string(), v.number()),
})
```

If your table stores multiple different types of documents, you can use
`v.union` at the top level:

```typescript
defineTable(
  v.union(
    v.object({
      kind: v.literal("StringDocument"),
      value: v.string(),
    }),
    v.object({
      kind: v.literal("NumberDocument"),
      value: v.number(),
    }),
  ),
)
```

In this schema, documents either have a `kind` of `"StringDocument"` and a
string for their `value`:

```json
{
  "kind": "StringDocument",
  "value": "abc"
}
```

or they have a `kind` of `"NumberDocument"` and a number for their `value`:

```json
{
  "kind": "NumberDocument",
  "value": 123
}
```

#### Literals

Fields that are a constant can be expressed with `v.literal`:

```typescript
defineTable({
  oneTwoOrThree: v.union(
    v.literal("one"),
    v.literal("two"),
    v.literal("three"),
  ),
})
```

#### Record objects

You can describe objects that map arbitrary keys to values with `v.record`:

```typescript
defineTable({
  simpleMapping: v.record(v.string(), v.boolean()),
})
```

You can use other types of string validators for the keys:

```typescript
import { mutation } from "./_generated/server"
import { v } from "convex/values"

export default mutation({
  args: {
    userIdToValue: v.record(v.id("users"), v.boolean()),
  },
  handler: async ({ db }, { userIdToValue }) => {
    //...
  },
})
```

Notes:

- This type corresponds to the
  [Record\<K,V\>](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)
  type in TypeScript
- You cannot use string literals as a `record` key
- Using `v.string()` as a `record` key validator will only allow ASCII
  characters

#### Any

Fields or documents that could take on any value can be represented with
`v.any()`:

```typescript
defineTable({
  anyValue: v.any(),
})
```

This corresponds to the `any` type in TypeScript.

### Options

These options are passed as part of the
[options](/api/interfaces/server.DefineSchemaOptions) argument to
[`defineSchema`](/api/modules/server#defineschema).

#### `schemaValidation: boolean`

Whether Convex should validate at runtime that your documents match your schema.

By default, Convex will enforce that all new and existing documents match your
schema.

You can disable `schemaValidation` by passing in `schemaValidation: false`:

```typescript
defineSchema(
  {
    // Define tables here.
  },
  {
    schemaValidation: false,
  },
)
```

When `schemaValidation` is disabled, Convex will not validate that new or
existing documents match your schema. You'll still get schema-specific
TypeScript types, but there will be no validation at runtime that your documents
match those types.

#### `strictTableNameTypes: boolean`

Whether the TypeScript types should allow accessing tables not in the schema.

By default, the TypeScript table name types produced by your schema are strict.
That means that they will be a union of strings (ex. `"messages" | "users"`) and
only support accessing tables explicitly listed in your schema.

Sometimes it's useful to only define part of your schema. For example, if you
are rapidly prototyping, it could be useful to try out a new table before adding
it your `schema.ts` file.

You can disable `strictTableNameTypes` by passing in
`strictTableNameTypes: false`:

```typescript
defineSchema(
  {
    // Define tables here.
  },
  {
    strictTableNameTypes: false,
  },
)
```

When `strictTableNameTypes` is disabled, the TypeScript types will allow access
to tables not listed in the schema and their document type will be `any`.

Regardless of the value of `strictTableNameTypes`, your schema will only
validate documents in the tables listed in the schema. You can still create and
modify documents in other tables in JavaScript or on the dashboard (they just
won't be validated).

## Schema validation

Schemas are pushed automatically in
[`npx convex dev`](/cli.md#run-the-convex-dev-server) and
[`npx convex deploy`](/cli.md#deploy-convex-functions-to-production).

The first push after a schema is added or modified will validate that all
existing documents match the schema. If there are documents that fail
validation, the push will fail.

After the schema is pushed, Convex will validate that all future document
inserts and updates match the schema.

Schema validation is skipped if [`schemaValidation`](#schemavalidation-boolean)
is set to `false`.

Note that schemas only validate documents in the tables listed in the schema.
You can still create and modify documents in other tables (they just won't be
validated).

### Circular references

You might want to define a schema with circular ID references like:

```typescript title="convex/schema.ts"
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  users: defineTable({
    preferencesId: v.id("preferences"),
  }),
  preferences: defineTable({
    userId: v.id("users"),
  }),
})
```

In this schema, documents in the `users` table contain a reference to documents
in `preferences` and vice versa.

Because schema validation enforces your schema on every `db.insert`,
`db.replace`, and `db.patch` call, creating circular references like this is not
possible.

The easiest way around this is to make one of the references nullable:

```typescript title="convex/schema.ts"
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  users: defineTable({
    preferencesId: v.id("preferences"),
  }),
  preferences: defineTable({
    userId: v.union(v.id("users"), v.null()),
  }),
})
```

This way you can create a preferences document first, then create a user
document, then set the reference on the preferences document:

```typescript title="convex/users.ts"
import { mutation } from "./_generated/server"

export default mutation({
  handler: async (ctx) => {
    const preferencesId = await ctx.db.insert("preferences", {})
    const userId = await ctx.db.insert("users", { preferencesId })
    await ctx.db.patch(preferencesId, { userId })
  },
})
```

[Let us know](/production/contact.md) if you need better support for circular
references.

## TypeScript types

Once you've defined a schema,
[`npx convex dev`](/cli.md#run-the-convex-dev-server) will produce new versions
of [`dataModel.d.ts`](/generated-api/data-model) and
[`server.d.ts`](/generated-api/server) with types based on your schema.

### `Doc<TableName>`

The [`Doc`](/generated-api/data-model#doc) TypeScript type from
[`dataModel.d.ts`](/generated-api/data-model) provides document types for all of
your tables. You can use these both when writing Convex functions and in your
React components:

```tsx noDialect title="MessageView.tsx"
import { Doc } from "../convex/_generated/dataModel";

function MessageView(props: { message: Doc<"messages"> }) {
  ...
}
```

If you need the type for a portion of a document, use the
[`Infer` type helper](/functions/validation#extracting-typescript-types).

### `query` and `mutation`

The [`query`](/generated-api/server#query) and
[`mutation`](/generated-api/server#mutation) functions in
[`server.js`](/generated-api/server) have the same API as before but now provide
a `db` with more precise types. Functions like
[`db.insert(table, document)`](/api/interfaces/server.GenericDatabaseWriter#insert)
now understand your schema. Additionally
[database queries](/database/reading-data/reading-data.mdx) will now return the
correct document type (not `any`).

# Document IDs

Every document in convex has a globally unique string _document ID_ that is
automatically generated by the system.

```ts
const userId = await ctx.db.insert("users", { name: "Michael Jordan" })
```

You can use this ID to efficiently read a single document using the `get`
method:

```ts
const retrievedUser = await ctx.db.get(userId)
```

You can access the ID of a document in the
[`_id` field](/database/types.md#system-fields):

```ts
const userId = retrievedUser._id
```

Also, this same ID can be used to update that document in place:

```ts
await ctx.db.patch(userId, { name: "Steph Curry" })
```

Convex generates an [`Id`](/generated-api/data-model#id) TypeScript type based
on your [schema](/database/schemas.mdx) that is parameterized over your table
names:

```typescript
import { Id } from "./_generated/dataModel"

const userId: Id<"users"> = user._id
```

IDs are strings at runtime, but the [`Id`](/generated-api/data-model#id) type
can be used to distinguish IDs from other strings at compile time.

## References and relationships

In Convex, you can reference a document simply by embedding its `Id` in another
document:

```ts
await ctx.db.insert("books", {
  title,
  ownerId: user._id,
})
```

You can follow references with `ctx.db.get`:

```ts
const user = await ctx.db.get(book.ownerId)
```

And [query for documents](/database/reading-data/reading-data.mdx) with a
reference:

```ts
const myBooks = await ctx.db
  .query("books")
  .filter((q) => q.eq(q.field("ownerId"), user._id))
  .collect()
```

Using `Id`s as references can allow you to build a complex data model.

## Trading off deeply nested documents vs. relationships

While it's useful that Convex supports nested objects and arrays, you should
keep documents relatively small in size. In practice, we recommend limiting
Arrays to no more than 5-10 elements and avoiding deeply nested Objects.

Instead, leverage separate tables, documents, and references to structure your
data. This will lead to better maintainability and performance as your project
grows.

## Serializing IDs

IDs are strings, which can be easily inserted into URLs or stored outside of
Convex.

You can pass an ID string from an external source (like a URL) into a Convex
function and get the corresponding object. If you're using TypeScript on the
client you can cast a string to the `Id` type:

```ts
// src/App.tsx
import { useQuery } from "convex/react"
import { Id } from "../convex/_generated/dataModel"
import { api } from "../convex/_generated/api"

export function App() {
  const id = localStorage.getItem("myIDStorage")
  const task = useQuery(api.tasks.getTask, { taskId: id as Id<"tasks"> })
  // ...
}
```

Since this ID is coming from an external source, use an argument validator or
[`ctx.db.normalizeId`](/api/interfaces/server.GenericDatabaseReader#normalizeid)
to confirm that the ID belongs to the expected table before returning the
object.

```ts
// convex/tasks.ts
import { query } from "./_generated/server"
import { v } from "convex/values"

export const getTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId)
    // ...
  },
})
```

# Data Types

All Convex documents are defined as Javascript objects. These objects can have
field values of any of the types below.

You can codify the shape of documents within your tables by
[defining a schema](/database/schemas.mdx).

## Convex values

<div>

| Convex Type | TS/JS Type                                                                                                                   | <div style={{width: "11em"}}>Example Usage</div> | Validator for [Argument Validation](/functions/validation) and [Schemas](/database/schemas) | `json` Format for [Export](/database/import-export) | Notes                                                                                                                                                                                                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Id          | [Id](/database/document-ids) ([string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#string_type)) | `doc._id`                                        | `v.id(tableName)`                                                                           | string                                              | See [Document IDs](/database/document-ids).                                                                                                                                                                                                                                                                                                            |
| Null        | [null](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#null_type)                                    | `null`                                           | `v.null()`                                                                                  | null                                                | JavaScript's `undefined` is not a valid Convex value. Functions the return `undefined` or do not return will return `null` when called from a client. Use `null` instead.                                                                                                                                                                              |
| Int64       | [bigint](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#bigint_type)                                | `3n`                                             | `v.int64()`                                                                                 | string (base10)                                     | Int64s only support BigInts between -2^63 and 2^63-1. Convex supports `bigint`s in [most modern browsers](https://caniuse.com/bigint).                                                                                                                                                                                                                 |
| Float64     | [number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#number_type)                                | `3.1`                                            | `v.number()`                                                                                | number / string                                     | Convex supports all IEEE-754 double-precision floating point numbers (such as NaNs). Inf and NaN are JSON serialized as strings.                                                                                                                                                                                                                       |
| Boolean     | [boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#boolean_type)                              | `true`                                           | `v.boolean()`                                                                               | bool                                                |
| String      | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#string_type)                                | `"abc"`                                          | `v.string()`                                                                                | string                                              | Strings are stored as UTF-8 and must be valid Unicode sequences. Strings must be smaller than the 1MB total size limit when encoded as UTF-8.                                                                                                                                                                                                          |
| Bytes       | [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer)                  | `new ArrayBuffer(8)`                             | `v.bytes()`                                                                                 | string (base64)                                     | Convex supports first class bytestrings, passed in as `ArrayBuffer`s. Bytestrings must be smaller than the 1MB total size limit for Convex types.                                                                                                                                                                                                      |
| Array       | [Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)                              | `[1, 3.2, "abc"]`                                | `v.array(values)`                                                                           | array                                               | Arrays can have at most 8192 values.                                                                                                                                                                                                                                                                                                                   |
| Object      | [Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#objects)                                    | `{a: "abc"}`                                     | `v.object({property: value})`                                                               | object                                              | Convex only supports "plain old JavaScript objects" (objects that do not have a custom prototype). Convex includes all [enumerable properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties). Objects can have at most 1024 entries. Field names must be nonempty and not start with "$" or "\_". |
| Record      | [Record](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)                                    | `{"a": "1", "b": "2"}`                           | `v.record(keys, values)`                                                                    | object                                              | Records are objects at runtime, but can have dynamic keys. Keys must be only ASCII characters, nonempty, and not start with "$" or "\_".                                                                                                                                                                                                               |

</div>

## System fields

Every document in Convex has two automatically-generated system fields:

- `_id`: The [document ID](/database/document-ids.mdx) of the document.
- `_creationTime`: The time this document was created, in milliseconds since the
  Unix epoch.

## Limits

Convex values must be less than 1MB in total size. This is an approximate limit
for now, but if you're running into these limits and would like a more precise
method to calculate a document's size,
[reach out to us](https://convex.dev/community). Documents can have nested
values, either objects or arrays that contain other Convex types. Convex types
can have at most 16 levels of nesting, and the cumulative size of a nested tree
of values must be under the 1MB limit.

Table names may contain alphanumeric characters ("a" to "z", "A" to "Z", and "0"
to "9") and underscores ("\_"), and they cannot start with an underscore.

For information on other limits, see [here](/production/state/limits.mdx).

If any of these limits don't work for you,
[let us know](https://convex.dev/community)!

## Working with `undefined`

The TypeScript value `undefined` is not a valid Convex value, so it cannot be
used in Convex function arguments or return values, or in stored documents.

1. Objects/records with `undefined` values are the same as if the field were
   missing: `{a: undefined}` is transformed into `{}` when passed to a function
   or stored in the database. You can think of Convex function calls and the
   Convex database as serializing the data with `JSON.stringify`, which
   similarly removes `undefined` values.
2. Validators for object fields can use `v.optional(...)` to indicate that the
   field might not be present.
   - If an object's field "a" is missing, i.e. `const obj = {};`, then
     `obj.a === undefined`. This is a property of TypeScript/JavaScript, not
     specific to Convex.
3. You can use `undefined` in filters and index queries, and it will match
   documents that do not have the field. i.e.
   `.withIndex("by_a", q=>q.eq("a", undefined))` matches document `{}` and
   `{b: 1}`, but not `{a: 1}` or `{a: null, b: 1}`.
   - In Convex's ordering scheme, `undefined < null < all other values`, so you
     can match documents that _have_ a field via `q.gte("a", null as any)` or
     `q.gt("a", undefined)`.
4. There is exactly one case where `{a: undefined}` is different from `{}`: when
   passed to `ctx.db.patch`. Passing `{a: undefined}` removes the field "a" from
   the document, while passing `{}` does not change the field "a". See
   [Updating existing documents](/database/writing-data.mdx#updating-existing-documents).
5. Since `undefined` gets stripped from function arguments but has meaning in
   `ctx.db.patch`, there are some tricks to pass patch's argument from the
   client.
   - If the client passing `args={}` (or `args={a: undefined}` which is
     equivalent) should leave the field "a" unchanged, use
     `ctx.db.patch(id, args)`.
   - If the client passing `args={}` should remove the field "a", use
     `ctx.db.patch(id, {a: undefined, ...args})`.
   - If the client passing `args={}` should leave the field "a" unchanged and
     `args={a: null}` should remove it, you could do
     ```ts
     if (args.a === null) {
       args.a = undefined
     }
     await ctx.db.patch(id, args)
     ```
6. Functions that return a plain `undefined`/`void` are treated as if they
   returned `null`.
7. Arrays containing `undefined` values, like `[undefined]`, throw an error when
   used as Convex values.

If you would prefer to avoid the special behaviors of `undefined`, you can use
`null` instead, which _is_ a valid Convex value.

## Working with dates and times

Convex does not have a special data type for working with dates and times. How
you store dates depends on the needs of your application:

1. If you only care about a point in time, you can store a
   [UTC timestamp](https://en.wikipedia.org/wiki/Unix_time). We recommend
   following the `_creationTime` field example, which stores the timestamp as a
   `number` in milliseconds. In your functions and on the client you can create
   a JavaScript `Date` by passing the timestamp to its constructor:
   `new Date(timeInMsSinceEpoch)`. You can then print the date and time in the
   desired time zone (such as your user's machine's configured time zone).
   - To get the current UTC timestamp in your function and store it in the
     database, use `Date.now()`
2. If you care about a calendar date or a specific clock time, such as when
   implementing a booking app, you should store the actual date and/or time as a
   string. If your app supports multiple timezones you should store the timezone
   as well. [ISO8601](https://en.wikipedia.org/wiki/ISO_8601) is a common format
   for storing dates and times together in a single string like
   `"2024-03-21T14:37:15Z"`. If your users can choose a specific time zone you
   should probably store it in a separate `string` field, usually using the
   [IANA time zone name](https://en.wikipedia.org/wiki/Tz_database#Names_of_time_zones)
   (although you could concatenate the two fields with unique character like
   `"|"`).

For more sophisticated printing (formatting) and manipulation of dates and times
use one of the popular JavaScript libraries: [date-fns](https://date-fns.org/),
[Day.js](https://day.js.org/), [Luxon](https://moment.github.io/luxon/) or
[Moment.js](https://momentjs.com/).
