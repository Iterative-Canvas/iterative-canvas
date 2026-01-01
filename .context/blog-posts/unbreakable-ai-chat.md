# Unbreakable AI Chat: Streaming Responses with Convex + Vercel AI SDK

How I built a persistent, reliable chat system with Convex and the AI SDK

Published on: 2025-04-30

---

Streaming AI responses is easy until something goes wrong. Maybe your user loses internet, or your server hiccups. Suddenly, your beautiful real-time chat breaks. Lost messages and broken UX with no recovery. I built a solution using Convex and the Vercel AI SDK that solves this with minimal complexity and no database spam.

After evaluating several options, I decided to build on top of the Vercel AI SDK. While it's not perfect out of the box, it's clean interface for LLM integration and structured generation made it the best foundation to build upon. The challenge would be extending it to handle the persistence and reliability requirements of a production chat system.

## Why I Picked the Vercel AI SDK (Despite Its Limits)

## The F5 Problem

Most AI chat UIs fail the basic resilience test. Refresh the page mid-stream or lose internet? You've either lost the message or wait until its fully generated and then refresh the page to see it.

Here's how some of today's top platforms stack up:

| Platform                 | Result          | Details                                                   |
| ------------------------ | --------------- | --------------------------------------------------------- |
| chatgpt.com              | ⚠️ Partial Pass | Requires another refresh to see the complete response     |
| claude.ai                | ❌ Fail         | Response is lost entirely when the page is refreshed      |
| T3.chat                  | ❌ Fail         | Response is stuck at the point of interruption            |
| chat.vercel.ai           | ❌ Fail         | Response is lost entirely when refreshing the page        |
| chatprd.ai               | ❌ Fail         | Shows error alert for in-progress response, then loses it |
| Perplexity               | ⚠️ Partial Pass | Requires another refresh to see the complete response     |
| sdk.vercel.ai/playground | ❌ Fail         | Chat is lost entirely on refresh                          |

To get both real-time streaming and persistence, you need to decouple the LLM stream from the HTTP request and persist every chunk. Most frameworks don't help you do this. The Vercel AI SDK assumes Node and Next.js API routes. If you use Convex or another backend, you end up streaming across systems, adding latency and risk.

> How does Convex help?

Convex lets you put LLM logic right next to your database. This means we have minimal network hops, and fast data operations.

> Saving every token?

Saving every token chunk to Convex is too many writes. A job queue could help, but then you lose streaming. My solution: buffer tokens in memory and post a messagechunk to Convex every 200ms.

## The Solution

Here's a breif overview of the solution I came up with. I'll go into more detail in the next section.

- Define your message schema
- Start the chat with `startChatMessagePair`
- Save the user's message and initiate the LLM response
- Generate the response in `internal.llm.generateAssistantMessage`
- Use `useQuery` to stream the response

We're going to store the message chunks in the database, but we're going to stream the tokens to the client as soon as they're generated.

### 1. Define your message schema

This is the schema I used for the chat. We're going to need a message thread, a message, and a message chunk. The message thread is just a title. The message is the user's message or the AI's response. The message chunk is a chunk of the AI's response.

```ts
const messageThreads = defineTable({
  title: v.string(),
}).index("by_title", ["title"]);

const messageChunks = defineTable({
  content: v.string(),
  messageId: v.id("messages"),
}).index("by_messageId", ["messageId""]);

const messages = defineTable({
  isComplete: v.optional(v.boolean()),
  role: v.union(v.literal("user"), v.literal("assistant")),
  threadId: v.id("messageThreads"),
}).index("by_threadId", ["threadId"]);

const userSettings = defineTable({
  userId: v.id("users"),
  role: v.union(v.literal("free"), v.literal("pro"), v.literal("admin")),
}).index("by_userId", ["userId"]);
```

### 2. Start the chat with `startChatMessagePair`

This Convex `useAction` hook allows you to call a Convex action from a client component.

```tsx
// In your client component
const startChat = useAction(api.chat.startChatMessagePair)

const sendMessage = async () => {
  if (!input.trim()) return

  setIsSending(true)

  await startChat({
    threadId,
    content: input,
  })

  setInput("")
  setIsSending(false)
}

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  await sendMessage()
  formRef.current?.reset()
}
```

### 3. Save the user's message and initiate the LLM response

This Convex action:

- Stores the user's message
- Creates a blank assistant message
- Schedules the LLM job to generate the reply immediately

```tsx
export const startChatMessagePair = action({
  args: {
    threadId: v.id("messageThreads"),
    content: v.string(),
    saveId: v.id("saves"),
  },
  returns: v.object({
    assistantMessageId: v.id("messages"),
  }),
  handler: async (ctx, { threadId, content, saveId }) => {
    await ctx.runMutation(api.messages.createMessage, {
      threadId,
      role: "user",
      content,
      isComplete: true,
    })

    const assistantMessageResult = await ctx.runMutation(
      api.messages.createMessage,
      {
        threadId,
        role: "assistant",
        content: "",
        isComplete: false,
      },
    )

    const assistantMessageId: Id<"messages"> = assistantMessageResult

    // 3. Schedule the LLM job immediately
    await ctx.scheduler.runAfter(0, internal.llm.generateAssistantMessage, {
      threadId,
      content,
      assistantMessageId,
      saveId,
    })

    return { assistantMessageId }
  },
})

export const createMessage = mutation({
  args: {
    role: v.union(v.literal("user"), v.literal("assistant")),
    threadId: v.id("messageThreads"),
    isComplete: v.boolean(),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const newMessageId = await ctx.db.insert("messages", {
      threadId: args.threadId as Id<"messageThreads">,
      role: args.role,
      isComplete: args.isComplete,
    })

    if (args.content) {
      await ctx.db.insert("messageChunks", {
        messageId: newMessageId,
        content: args.content,
      })
    }

    return newMessageId
  },
})
```

### 4. Generate the response in `internal.llm.generateAssistantMessage`

This internal Convex action:

- Uses `streamText()` from the Vercel AI SDK
- Streams tokens with `for await...of result.textStream`
- Keeps them in memory
- Saves to Convex every 200ms

```tsx
// Minimum chunk size to reduce database writes
const MIN_CHUNK_SIZE = 20
const FLUSH_INTERVAL = 200 // ms

export const generateAssistantMessage = internalAction({
  args: {
    threadId: v.id("messageThreads"),
    content: v.string(),
    assistantMessageId: v.id("messages"),
    saveId: v.id("saves"),
  },

  handler: async (ctx, args) => {
    try {
      const messages = await ctx.runQuery(api.messages.getMessages, {
        threadId: args.threadId,
      })

      const fullPrompt = [
        ...messages.map((m) => ({
          role: m.role,
          content: m.messageChunks.map((chunk) => chunk.content).join(""),
        })),
        { role: "user", content: args.content },
      ]

      const result = streamText({
        model: openai("gpt-4.1-mini"),
        system: `You are helpful assistant.`,
        messages: fullPrompt as CoreMessage[],
      })

      let buffer = ""
      let lastFlushTime = Date.now()
      let flushTimeout: NodeJS.Timeout | null = null

      const flush = async (force = false) => {
        if (
          !force &&
          (buffer.length < MIN_CHUNK_SIZE ||
            Date.now() - lastFlushTime < FLUSH_INTERVAL)
        ) {
          return
        }

        if (buffer.length === 0) return

        const contentToFlush = buffer
        buffer = ""
        flushTimeout = null
        lastFlushTime = Date.now()

        try {
          await ctx.runMutation(api.messages.createMessageChunk, {
            messageId: args.assistantMessageId,
            content: contentToFlush,
          })
        } catch (error) {
          console.error("Failed to save message chunk:", error)
          // In case of error, add content back to buffer
          buffer = contentToFlush + buffer
          // Retry after a short delay
          await new Promise((resolve) => setTimeout(resolve, 1000))
          await flush(true)
        }
      }

      for await (const chunk of result.textStream) {
        if (chunk) {
          buffer += chunk

          // Schedule a flush if not already scheduled
          if (!flushTimeout) {
            flushTimeout = setTimeout(() => flush(), FLUSH_INTERVAL)
          }

          // Force flush if buffer gets too large
          if (buffer.length >= MIN_CHUNK_SIZE * 2) {
            if (flushTimeout) {
              clearTimeout(flushTimeout)
              flushTimeout = null
            }
            await flush(true)
          }
        }
      }

      // Final cleanup
      if (flushTimeout) {
        clearTimeout(flushTimeout)
      }
      // Force flush any remaining content
      await flush(true)

      // Mark message as complete
      await ctx.runMutation(api.messages.updateMessage, {
        messageId: args.assistantMessageId,
        isComplete: true,
      })
    } catch (error) {
      console.error("Error in generateAssistantMessage:", error)

      // Mark message as complete but with error state
      await ctx.runMutation(api.messages.updateMessage, {
        messageId: args.assistantMessageId,
        isComplete: true,
      })

      // Add error message as final chunk
      await ctx.runMutation(api.messages.createMessageChunk, {
        messageId: args.assistantMessageId,
        content:
          "\n\nI apologize, but I encountered an error while generating the response. Please try again.",
      })

      throw error // Re-throw to trigger Convex's error handling
    }
  },
})
```

### 5. Use `useQuery` to stream the response

Convex's `useQuery` is reactive, so it'll update as soon as the message is saved.

```tsx
// Convex query:
export const getMessages = query({
  args: {
    threadId: v.id("messageThreads"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get the most recent messages first, limited if specified
    const query = ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .order("desc")

    const messages = await (args.limit
      ? query.take(args.limit)
      : query.collect())
    messages.reverse() // Put them back in chronological order

    // Fetch chunks for each message
    const messagesWithChunks = await Promise.all(
      messages.map(async (message) => {
        const chunks = await ctx.db
          .query("messageChunks")
          .withIndex("by_messageId", (q) => q.eq("messageId", message._id))
          .order("asc")
          .collect()

        return {
          ...message,
          messageChunks: chunks,
        }
      }),
    )

    return messagesWithChunks
  },
})

// Client component:
// Memoized Message component to optimize re-renders
const Message = memo(
  ({
    role,
    content,
    isComplete = true,
  }: {
    role: "user" | "assistant"
    content: string
    isComplete?: boolean
  }) => (
    <div
      className={cn(
        "mb-4 flex w-full",
        role === "assistant" ? "justify-start" : "justify-end",
      )}
    >
      <div
        className={cn(
          "rounded-lg px-4 py-3",
          role === "assistant"
            ? "w-full"
            : "max-w-[90%] bg-primary text-primary-foreground",
        )}
      >
        <Markdown>{content}</Markdown>
        {!isComplete && (
          <span className="inline-block h-4 w-1 animate-pulse bg-current" />
        )}
      </div>
    </div>
  ),
)

// ...

export default function Chat() {
  const messages = useQuery(api.messages.getMessages, {
    threadId,
    limit: MESSAGE_LIMIT,
  })

  /* Rest of the chat code. */
  return (
    <div>
      {/* ... */}
      {messages?.map((message) => (
        <Message
          key={message._id}
          role={message.role}
          content={message.messageChunks.map((chunk) => chunk.content).join("")}
          isComplete={message.isComplete}
        />
      ))}
    </div>
  )
}
```

## Results

After implementing this solution, I was able to achieve a simple implementation that provides a streaming feel even after disconnects while maintaining controlled database load. The system maintains message history, handles disconnects gracefully, and provides a smooth streaming experience without overwhelming the database since we capped the update rate at 200ms.

## Final Thoughts

If you're building real AI products, you can't afford to ignore resilience. The risk of losing a message increases the longer your response takes. This system works well for me, but it's not a silver bullet. If your use case demands token-level persistence (like hallucination tracking or audit logs), you'll need to tweak the flush cadence, or add extra logic.

If you're building something real with AI don't just trust the magic SDKs. Understand what's happening under the hood. Own your infra.
