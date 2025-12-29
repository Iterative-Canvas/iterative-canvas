# XState + Convex Backend State Machine Architecture

## Overview

You are setting up a robust architecture for managing complex state machines on the backend using XState v5 integrated with Convex. State machines serve as the authoritative source of truth for entity lifecycles. The frontend subscribes to state reactively and dispatches events through mutations—it never runs its own machine instance.

## Core Architectural Principles

### Backend as Single Source of Truth

- State machines are defined and executed on the Convex backend
- Machine state is persisted in the database as serialized state values + context
- The frontend reads state and sends events; it does not run or interpret machines

### State Machine Responsibilities

State machines handle:
- Defining valid states (including nested/parallel states)
- Defining allowed transitions between states
- Guards (conditions that allow or block transitions)
- Pure, synchronous context updates via `assign` actions

State machines do NOT handle:
- Side effects (API calls, scheduling, emails, payments)
- Database operations
- Anything async (no `invoke`, no promises)

### Side Effect Policy

Side effects are triggered in Convex mutations or actions AFTER a successful state transition:

```typescript
// CORRECT: Side effects orchestrated by Convex
export const sendEvent = mutation({
  handler: async (ctx, args) => {
    // 1. Apply transition (pure)
    const result = applyTransition(machine, currentState, event);
    
    // 2. Persist new state
    await ctx.db.patch(entityId, result);
    
    // 3. Trigger side effects based on new state
    if (result.state === "confirmed") {
      await ctx.scheduler.runAfter(0, api.emails.sendConfirmation, { entityId });
    }
  },
});
```

```typescript
// WRONG: Side effects inside machine
createMachine({
  states: {
    confirmed: {
      entry: () => sendEmail(), // ❌ Never do this
    },
  },
  // ❌ No invoke/async
  invoke: {
    src: "fetchData",
  },
});
```

For complex or retriable side effects, consider an outbox pattern: the mutation writes an intent record, a scheduled action processes it, and a follow-up mutation records completion.

### Optimistic UI Clarification

- Never optimistically update authoritative state (don't pretend the backend accepted an event)
- Ephemeral UI feedback is fine (loading spinners, temporary button disables) as long as it reconciles with the backend result
- Do not mirror machine state into local React state via `useEffect`

---

## Project Structure

```
convex/
├── lib/
│   └── stateMachine/
│       ├── engine.ts          # Core transition logic
│       ├── types.ts           # Shared types
│       └── helpers.ts         # Utilities (getAllowedEvents, etc.)
├── machines/
│   └── [entityName]Machine.ts # Machine definitions (pure)
├── [entityName].ts            # Mutations/queries per entity
└── schema.ts

src/ (or app/)
├── lib/
│   └── machineTypes.ts        # Re-export types for frontend use
├── hooks/
│   └── useStateMachine.ts     # Optional convenience hook
└── components/
    └── [Feature]/
```

---

## Implementation Requirements

### 1. Type Definitions (`convex/lib/stateMachine/types.ts`)

```typescript
// Supports both simple string states and nested/parallel states
export type StateValue = string | Record<string, StateValue>;

export type PersistedMachineState<TContext> = {
  value: StateValue;
  context: TContext;
  version: number; // For optimistic locking
};

export type TransitionSuccess<TContext> = {
  success: true;
  state: PersistedMachineState<TContext>;
  changed: boolean;
};

export type TransitionError = {
  success: false;
  error: string;
  currentState: StateValue;
  attemptedEvent: string;
};

export type TransitionResult<TContext> =
  | TransitionSuccess<TContext>
  | TransitionError;
```

### 2. Core Transition Engine (`convex/lib/stateMachine/engine.ts`)

Create a reusable, synchronous transition function:

```typescript
import { type AnyStateMachine } from "xstate";
import { PersistedMachineState, TransitionResult } from "./types";

/**
 * Rehydrates a machine from persisted state, applies one event,
 * and returns the new state or an error.
 * 
 * This function is pure and synchronous—no side effects.
 */
export function applyTransition<TContext, TEvent extends { type: string }>(
  machine: AnyStateMachine,
  persistedState: PersistedMachineState<TContext>,
  event: TEvent
): TransitionResult<TContext> {
  // Implementation:
  // 1. Rehydrate machine at persisted state
  // 2. Check if event is allowed
  // 3. Compute next state
  // 4. Return new persisted state or error
}
```

### 3. Helper Functions (`convex/lib/stateMachine/helpers.ts`)

```typescript
/**
 * Returns sorted array of event types allowed from current state.
 * Sorted for stable references (prevents unnecessary re-renders).
 */
export function getAllowedEvents(
  machine: AnyStateMachine,
  stateValue: StateValue
): string[] {
  // Extract from machine definition, return sorted
}

/**
 * Check if a specific event type can be sent from current state.
 */
export function canTransition(
  machine: AnyStateMachine,
  stateValue: StateValue,
  eventType: string
): boolean {
  return getAllowedEvents(machine, stateValue).includes(eventType);
}
```

### 4. Machine Definition Pattern (`convex/machines/[entity]Machine.ts`)

Use XState v5's `setup()` for full type safety:

```typescript
import { setup, assign } from "xstate";

// Explicit context type
export type OrderContext = {
  items: string[];
  failureReason?: string;
  // Store source data only—derive counts/totals in queries
};

// Discriminated union for events
export type OrderEvent =
  | { type: "ADD_ITEM"; itemId: string }
  | { type: "SUBMIT" }
  | { type: "PAYMENT_SUCCESS"; transactionId: string }
  | { type: "PAYMENT_FAILED"; reason: string }
  | { type: "CANCEL" };

export const orderMachine = setup({
  types: {
    context: {} as OrderContext,
    events: {} as OrderEvent,
  },
  guards: {
    hasItems: ({ context }) => context.items.length > 0,
  },
  actions: {
    // ONLY pure assign actions
    recordFailure: assign({
      failureReason: ({ event }) => {
        if (event.type === "PAYMENT_FAILED") return event.reason;
        return undefined;
      },
    }),
  },
}).createMachine({
  id: "order",
  initial: "draft",
  context: {
    items: [],
    failureReason: undefined,
  },
  states: {
    draft: {
      on: {
        ADD_ITEM: { /* ... */ },
        SUBMIT: {
          target: "pendingPayment",
          guard: "hasItems",
        },
      },
    },
    pendingPayment: {
      on: {
        PAYMENT_SUCCESS: { target: "confirmed" },
        PAYMENT_FAILED: {
          target: "paymentFailed",
          actions: "recordFailure",
        },
        CANCEL: { target: "cancelled" },
      },
    },
    confirmed: { /* ... */ },
    paymentFailed: { /* ... */ },
    cancelled: { type: "final" },
  },
});
```

### 5. Database Schema (`convex/schema.ts`)

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Helper for machine state fields
const machineStateFields = {
  _machineState: v.union(v.string(), v.record(v.string(), v.any())),
  _machineContext: v.any(), // Typed per-entity in application code
  _stateVersion: v.number(),
};

export default defineSchema({
  orders: defineTable({
    ...machineStateFields,
    customerId: v.id("users"),
    createdAt: v.number(),
  }),

  // Event audit log (append-only)
  machineEventLog: defineTable({
    entityType: v.string(),
    entityId: v.string(),
    eventType: v.string(),
    eventPayload: v.optional(v.any()),
    actor: v.union(v.id("users"), v.literal("system")),
    timestamp: v.number(),
    fromState: v.union(v.string(), v.record(v.string(), v.any())),
    toState: v.union(v.string(), v.record(v.string(), v.any())),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  }).index("by_entity", ["entityType", "entityId", "timestamp"]),
});
```

### 6. Entity Mutations and Queries (`convex/[entity].ts`)

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { orderMachine, OrderEvent } from "./machines/orderMachine";
import { applyTransition } from "./lib/stateMachine/engine";
import { getAllowedEvents } from "./lib/stateMachine/helpers";

export const create = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    return await ctx.db.insert("orders", {
      _machineState: "draft",
      _machineContext: { items: [] },
      _stateVersion: 0,
      customerId: /* ... */,
      createdAt: Date.now(),
    });
  },
});

export const sendEvent = mutation({
  args: {
    orderId: v.id("orders"),
    event: v.object({
      type: v.string(),
      // Additional payload fields as needed
    }),
    expectedVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    // Authorization check
    // if (order.customerId !== userId) throw new Error("Forbidden");

    // Optimistic locking
    if (order._stateVersion !== args.expectedVersion) {
      throw new Error(
        `Conflict: expected version ${args.expectedVersion}, found ${order._stateVersion}`
      );
    }

    const result = applyTransition(
      orderMachine,
      {
        value: order._machineState,
        context: order._machineContext,
        version: order._stateVersion,
      },
      args.event as OrderEvent
    );

    // Log the attempt (success or failure)
    await ctx.db.insert("machineEventLog", {
      entityType: "order",
      entityId: args.orderId,
      eventType: args.event.type,
      eventPayload: args.event,
      actor: identity.subject as any, // or resolve to user ID
      timestamp: Date.now(),
      fromState: order._machineState,
      toState: result.success ? result.state.value : order._machineState,
      success: result.success,
      errorMessage: result.success ? undefined : result.error,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    // Persist new state
    await ctx.db.patch(args.orderId, {
      _machineState: result.state.value,
      _machineContext: result.state.context,
      _stateVersion: result.state.version + 1,
    });

    // Trigger side effects based on new state
    if (result.state.value === "confirmed") {
      await ctx.scheduler.runAfter(0, internal.emails.sendConfirmation, {
        orderId: args.orderId,
      });
    }

    return {
      newState: result.state.value,
      newVersion: result.state.version + 1,
    };
  },
});

export const get = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) return null;

    // Compute allowed events for UI
    const allowedEvents = getAllowedEvents(orderMachine, order._machineState);

    return {
      ...order,
      allowedEvents,
    };
  },
});
```

---

## Frontend Integration

### Type Sharing

Re-export machine types for frontend consumption:

```typescript
// src/lib/machineTypes.ts
export type { OrderContext, OrderEvent } from "../../convex/machines/orderMachine";

// Also export any shared state value types or helpers
export type { StateValue } from "../../convex/lib/stateMachine/types";
```

### Convenience Hook (`src/hooks/useStateMachine.ts`)

```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useCallback, useMemo } from "react";

export function useOrderMachine(orderId: Id<"orders"> | undefined) {
  const order = useQuery(
    api.orders.get,
    orderId ? { orderId } : "skip"
  );
  const sendEventMutation = useMutation(api.orders.sendEvent);

  const send = useCallback(
    async (event: { type: string; [key: string]: any }) => {
      if (!orderId || !order) return;
      return sendEventMutation({
        orderId,
        event,
        expectedVersion: order._stateVersion,
      });
    },
    [orderId, order?._stateVersion, sendEventMutation]
  );

  const can = useCallback(
    (eventType: string) => order?.allowedEvents.includes(eventType) ?? false,
    [order?.allowedEvents]
  );

  return {
    // State
    state: order?._machineState,
    context: order?._machineContext,
    version: order?._stateVersion,
    allowedEvents: order?.allowedEvents ?? [],

    // Actions
    send,
    can,

    // Raw data
    order,

    // Loading state
    isLoading: order === undefined,
  };
}
```

### Component Pattern

```typescript
function OrderPanel({ orderId }: { orderId: Id<"orders"> }) {
  const { state, context, allowedEvents, send, can, isLoading } = useOrderMachine(orderId);

  if (isLoading) return <Loading />;

  return (
    <div>
      <Badge>{state}</Badge>

      {/* Buttons reflect allowed transitions */}
      {can("SUBMIT") && (
        <Button onClick={() => send({ type: "SUBMIT" })}>
          Submit Order
        </Button>
      )}

      {can("CANCEL") && (
        <Button variant="destructive" onClick={() => send({ type: "CANCEL" })}>
          Cancel
        </Button>
      )}
    </div>
  );
}
```

---

## Anti-Patterns to Avoid

### Backend

```typescript
// ❌ Async/invoke in machine
createMachine({
  invoke: { src: "fetchData" },
});

// ❌ Side effects in machine actions
actions: {
  sendEmail: () => emailService.send(), // Never
}

// ❌ Storing derived data in context
context: {
  items: [],
  itemCount: 5,    // Derive in query instead
  totalPrice: 100, // Derive in query instead
}

// ❌ Trusting client-supplied state
handler: async (ctx, args) => {
  // Always read current state from DB
  const fromState = args.fromState; // Never trust this
}
```

### Frontend

```typescript
// ❌ Running machine actor on frontend
const actor = useActor(orderMachine);

// ❌ Mirroring backend state into local state
const [localState, setLocalState] = useState(order?.machineState);
useEffect(() => setLocalState(order?.machineState), [order]);

// ❌ Optimistic authoritative updates
const handleClick = () => {
  setLocalState("confirmed"); // Don't pretend backend accepted
  send({ type: "CONFIRM" });
};

// ❌ Over-subscribing with many queries
// Prefer one "screen query" that returns the view model needed
```

### General

```typescript
// ❌ State machine for trivial state
const toggleMachine = createMachine({
  states: { on: {}, off: {} }, // Just use a boolean
});

// ❌ High-frequency writes
// Don't commit to Convex on every keystroke
// Use local React state, commit on blur/submit
```

---

## State Migration Stub

```typescript
// convex/lib/stateMachine/migrations.ts
export const CURRENT_MACHINE_VERSION = 1;

export function migratePersistedState<TContext>(
  persistedState: PersistedMachineState<TContext>,
  fromVersion: number
): PersistedMachineState<TContext> {
  if (fromVersion === CURRENT_MACHINE_VERSION) {
    return persistedState;
  }

  // Add migration logic here as machine evolves
  // if (fromVersion === 1) {
  //   return migrateV1toV2(persistedState);
  // }

  throw new Error(`No migration path from version ${fromVersion}`);
}
```

---

## Testing Stub

Create a stubbed test file illustrating common patterns. Do not implement a full test suite, but provide enough structure to guide future testing:

```typescript
// convex/lib/stateMachine/__tests__/engine.test.ts
import { describe, it, expect } from "vitest";
import { applyTransition } from "../engine";
import { orderMachine } from "../../machines/orderMachine";

describe("applyTransition", () => {
  it("allows valid transitions", () => {
    // const result = applyTransition(
    //   orderMachine,
    //   { value: "draft", context: { items: ["item1"] }, version: 0 },
    //   { type: "SUBMIT" }
    // );
    // expect(result.success).toBe(true);
    // expect(result.state.value).toBe("pendingPayment");
  });

  it("rejects invalid transitions", () => {
    // const result = applyTransition(
    //   orderMachine,
    //   { value: "draft", context: { items: [] }, version: 0 },
    //   { type: "SHIP" }
    // );
    // expect(result.success).toBe(false);
    // expect(result.error).toContain("not allowed");
  });

  it("enforces guards", () => {
    // const result = applyTransition(
    //   orderMachine,
    //   { value: "draft", context: { items: [] }, version: 0 },
    //   { type: "SUBMIT" }
    // );
    // expect(result.success).toBe(false); // Guard "hasItems" blocks
  });

  it("updates context correctly", () => {
    // Test that assign actions modify context as expected
  });
});

describe("getAllowedEvents", () => {
  it("returns correct events for each state", () => {
    // Test that allowedEvents matches machine definition
  });

  it("returns stable sorted array", () => {
    // Verify sorting for React stability
  });
});
```

---

## Initial Feature Implementation

Implement the following feature to validate the architecture works end-to-end:

### Feature Specification

When the user submits a prompt using the primary submit button, it should be combined together with the evals in a uniified prompt and sent to a language model to generate a response (i.e. canvas).

When the user submits a prompt:
- The input box should revert back to "view mode" and the prompt should be immediately persisted to the database (like is currently done).
- The AI SDK should be used to generate a response (i.e. canvas) using whatever prompt model is currently selected. The response should be eagerly streamed to the user as it is being generated and displayed in the canvas.
- Only when the full response has been received should the response be persisted to the database.
  - Note: The <CanvasContent /> component should be subscribed to the generated canvas response stored in the database, so when the final response is persisted to the database, the <CanvasContent /> component will do one final reactive update to display the final response.

As the response is being generated:
- The pencil icon in the <PromptInput /> component should be replaced with the CircleStop lucide icon. If the user clicks the stop button, the stream should be aborted and the canvas should revert back to it's previous state that is stored in the database.
- The pencil icon in the <CanvasContent /> component should be disabled.
- All functionality in the <EvalsContent /> component should be disabled. Additionally, the <EvalsHeader /> component should show a loading spinner next to the title that goes away once the response has finished or been aborted.
  - Notes: We will follow up with additional functionality at a later date to automatically fire off the evals as soon as the response is generated. But for now, we are just focused on the previously mentioned functionality.

Misc. notes:
- Since AI SDK Core will be running on the Convex backend, rather than in a Next.js API route, we may need to utilize `new DefaultChatTransport()` on the frontend to configure the transport.
- Do not skip proper error handling. Errors should be handled gracefully and displayed to the user. Just use a native browser alert dialog for now instead of a toast.

### Implementation Goals

1. **Verify Architecture**: Confirm XState + Convex integration works by implementing a real feature that exercises:
   - Machine definition with multiple states
   - At least one guard condition
   - Context updates via assign
   - Side effect triggering after transitions
   - Frontend subscription and event dispatching
   - Optimistic locking (version check)
   - Event audit logging

2. **Demonstrate End-to-End Flow**: Show the complete path:
   - User interaction →
   - Event dispatch with version →
   - Backend transition validation →
   - State persistence + audit log →
   - Reactive UI update

3. **Establish Patterns**: Create reference implementations demonstrating:
   - Proper file organization
   - Type safety from machine → Convex → frontend
   - Error handling for invalid transitions and conflicts
   - UI patterns for displaying state and available actions

### Deliverables

1. Machine definition file with full type annotations
2. Schema updates for the entity and event log
3. Convex mutations/queries for the entity
4. React component(s) demonstrating UI integration
5. Stubbed test file with example test cases

---

## Final Checklist

Before considering setup complete, verify:

- [ ] XState v5 installed (not v4)
- [ ] Core transition engine handles nested/parallel states
- [ ] Error handling provides clear messages for invalid transitions
- [ ] Optimistic locking prevents concurrent modification issues
- [ ] Event audit log captures all transition attempts
- [ ] Types flow correctly from machine → Convex → frontend
- [ ] No XState actors, invoke, or async in machines
- [ ] Side effects handled in Convex mutations/actions, not machine
- [ ] Frontend subscribes reactively without local state duplication
- [ ] `allowedEvents` exposed to frontend (sorted for stability)
- [ ] Migration stub exists for future schema evolution
- [ ] At least one working feature demonstrates full architecture