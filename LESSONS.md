- Don't try to stream the response using the `useChat` hook. Instead, do what this guy did.
  - https://www.arhamhumayun.com/blog/streamed-ai-response
- Don't use XState. Instead...
  - Roll your own state machine
  - or, use the Convex workflow primitives
- We still want Convex to be the single source of truth for the state of the app (within reason)
- We still want Convex to be the primary state store
- Think through what the primary states should be, and what the state transitions should be

### Feature Specification

When the user submits a prompt using the primary submit button, it should be combined together with the evals in a unified prompt and sent to a language model to generate a response (i.e. canvas).

When the user submits a prompt:

- The input box should revert back to "view mode" and the prompt should be immediately persisted to the database (like is currently done).
- Use a Convex HTTP Action with the AI SDK to stream the response. The response should be eagerly streamed to the user as it is being generated and displayed in the canvas.
- Only when the full response has been received should the response be persisted to the database via the `onFinish` callback.
  - Note: The `<CanvasContent />` component should be subscribed to the generated canvas response stored in the database, so when the final response is persisted to the database, the `<CanvasContent />` component will do one final reactive update to display the final response.

As the response is being generated:

- The pencil icon in the `<PromptInput />` component should be replaced with the CircleStop lucide icon. If the user clicks the stop button, the stream should be aborted and the canvas should revert back to its previous state that is stored in the database.
- The pencil icon in the `<CanvasContent />` component should be disabled.
- All functionality in the `<EvalsContent />` component should be disabled. Additionally, the `<EvalsHeader />` component should show a loading spinner next to the title that goes away once the response has finished or been aborted.
  - Note: We will follow up with additional functionality at a later date to automatically fire off the evals as soon as the response is generated. But for now, we are just focused on the previously mentioned functionality.
