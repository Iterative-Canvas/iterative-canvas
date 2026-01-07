Got it. I’ll first read your app summary + the Convex workspace rules to understand intended behavior and backend conventions, then I’ll review the diff in terms of correctness, UX, security/authz, workflow/cancellation semantics, and maintainability. I’ll finish with a prioritized list of required changes vs nice-to-haves.

[4 tools called]

Nice—your `.context/app-summary.md` aligns strongly with what this PR is doing: durable prompt submission, streaming response, and evals-as-judge with explicit “Run All / Run One” flows. Next I’ll skim the frontend components + workflow/actions for edge cases (cancellation, retry semantics, disabled states), then I’ll write the review with required fixes and follow-ups.

[5 tools called]

### High-level summary

This PR is a big step toward the app’s stated goal (“one prompt, one response, many requirements”): **durable workflows**, **streaming response persistence**, **evals-as-judge run in parallel**, and **UX improvements** (shimmer, stop button, toasts, better resizing).

### What’s working well

- **Architecture fits the one-pager**: prompt submission → generate response → (optional) run evals; manual “Run All” / “Run One” eval flows; evals always run against the stored response.
- **Streaming UX**: keeping the previous `response` while waiting for first chunk + shimmer is a great experience.
- **Retry visibility**: `responseErrorAt` + `useGenerationToasts` is a clean approach to “retrying…” feedback.
- **Eval result derivation**: moving UI to derive pass/fail from backend `status/score/threshold` is the right direction.

---

## Blocking / must-fix issues

### 1) `cancelGeneration` is not actually idempotent + can cause race/corruption
Frontend explicitly calls cancel “even if generation hasn’t updated yet”, but backend currently **no-ops unless `responseStatus === "generating"`** (`convex/public.ts`). That breaks the intended semantics.

More importantly: `cancelGeneration` **clears `activeWorkflowId` immediately** while the workflow/action may still be running. That enables starting another workflow on the same version while the old one can still write chunks / finalize, creating a real risk of **interleaved writes / clobbered state**.

**Recommendation**
- Make cancel always set `generationCancelledAt` regardless of status (true idempotency).
- Do **not** clear `activeWorkflowId` until the workflow is actually finished (or introduce a “generationRunId” so stale workflows can’t write).
- Also disable editing while `responseStatus === "generating"` (and/or while cancel is pending) to keep prompt+eval compilation deterministic.

Suggested backend change (minimal, no “run id” yet):

```ts
// convex/public.ts (cancelGeneration)
export const cancelGeneration = mutation({
  args: { versionId: v.id("canvasVersions") },
  returns: v.null(),
  handler: async (ctx, { versionId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const version = await ctx.db.get(versionId)
    if (!version) throw new Error("Version not found")

    const canvas = await ctx.db.get(version.canvasId)
    if (!canvas || canvas.userId !== userId) throw new Error("Not authorized")

    // Always mark cancellation requested (idempotent)
    if (!version.generationCancelledAt) {
      await ctx.db.patch(versionId, {
        generationCancelledAt: Date.now(),
      })
    }

    // Do NOT clear activeWorkflowId here; let onWorkflowComplete handle it.
    // Also consider whether evalsStatus should be left alone vs reset.
    return null
  },
})
```

And on the frontend, treat “cancel requested” as a state (e.g., show “Cancelling…” and keep modules disabled until `responseStatus !== "generating"`).

### 2) Cron rules violation + naming mismatch
Your workspace Convex rules explicitly say **don’t use `crons.daily/hourly/weekly`**, only `crons.interval` or `crons.cron`. The PR uses `crons.daily(...)`.

Also: `syncAIGatewayModelsEvery15s` is configured as `{ seconds: 60 }`.

**Recommendation**
- Replace `crons.daily` with `crons.cron` (or `crons.interval` with `{ hours: 24 }`).
- Fix the name vs schedule mismatch.

### 3) `ModelCombobox` triggers `onChange` on mount (likely causing spurious backend writes)
`ModelCombobox` runs:

```ts
React.useEffect(() => {
  onChange?.(selected)
}, [selected])
```

In `EvalsContent`, `onChange` writes to Convex. This likely triggers **writes on initial render for every eval row**, even when nothing changed.

**Recommendation**: only call `onChange` from the explicit selection handler (or gate the effect so it doesn’t run on initial mount).

Minimal fix:

```tsx
const didMount = React.useRef(false)
React.useEffect(() => {
  if (!didMount.current) {
    didMount.current = true
    return
  }
  onChange?.(selected)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selected])
```

---

## Major (non-blocking, but high value)

### 4) Evals module should be disabled during response generation (determinism / purity)
Per your app summary: the compiled prompt context should be deterministic. Allowing eval edits while generation is running can create confusing mismatches (“response generated with old evals, UI shows new evals”).

In `EvalsContent`, `isDisabled` doesn’t include `responseStatus === "generating"`. Consider:

- disable when `canvasVersion?.responseStatus === "generating"` as well
- and/or when a cancellation is pending

### 5) Cancellation UX ambiguity: cancellation sets `responseStatus` → `complete`
`finalizeResponse` always sets `responseStatus: "complete"`, even if cancellation happened and no new chunks arrived (so you keep the old response). That can make the UI look like “generation completed” even though it was canceled before producing anything.

Consider a separate state (“canceled”) or setting `idle` when cancellation occurs before any new content is produced.

---

## Minor / polish

- **Shimmer overlay color**: current gradient uses a white highlight; will likely look wrong in dark theme. Consider using CSS variables (e.g. `rgba(var(--foreground), ...)` style approach) or separate dark-mode gradient.
- **Model label ambiguity**: showing only `modelName` in the button can collide across creators/providers. Consider `creator/modelName` (with truncation) for the trigger label.
- **Cron dev toggle**: `isLocalDev` uses `NODE_ENV !== "production"`; if you ever run “preview/staging” with non-prod env, you might unintentionally enable the once-per-restart behavior.

---

## Tests / scenarios I’d manually verify before merging

- **Immediate cancel**: click Submit, immediately click Stop (before mutation returns; before first chunk).
- **Cancel mid-stream**: ensure partial response is preserved and no further chunks arrive afterward.
- **Cancel then resubmit quickly**: ensure no chunk interleaving and the old workflow can’t overwrite the new run.
- **Evals determinism**: confirm eval edits are blocked during generation.
- **Model combobox**: confirm no backend writes happen on mount; only on user selection.

If you want, I can propose a “generationRunId” guard pattern (small schema change) that fully eliminates stale-workflow write corruption; you’d need Agent mode to apply it cleanly across actions/mutations.