# Iterative Canvas – Application Overview (One-Pager)

## Purpose

This application is a workspace for **iteratively developing complex prompts and validating LLM responses against explicit, structured requirements**. It is designed for users who want to avoid chatbot-style context rot and manual response inspection by working on a **single prompt–response artifact** and using **LLM-powered evaluations** to assess quality.

The core value proposition is turning _implicit prompt requirements_ into _explicit, testable constraints_ and enabling fast iteration until the model reliably satisfies them.

---

## Core Mental Model

- Users are **not chatting** with an LLM.
- Users are **iterating on a single document** (the “canvas”).
- The system maintains a **mutable draft** and optional **manual snapshots (versions)**.
- Evaluation is automated via **LLM-as-judge**, not human scoring.

---

## Primary Concepts

### Canvas

- A **canvas** is the top-level workspace object.
- Each canvas contains three modules:
  1. **Prompt** – the main user-authored prompt
  2. **Evals** – structured requirements/criteria
  3. **Canvas Output** – the stored LLM response (user-editable, but typically purely model-generated)

Canvases are personal, organized optionally into folders, and do not inherit behavior from folders.

---

### Prompt

- The prompt is authored by the user.
- Requirements that would normally be embedded in a long prompt are instead split out into **structured evals**.
- When submitting, the system **purely and deterministically compiles**: `prompt + eval-derived requirements → final prompt sent to the LLM`
- The compilation process is guaranteed to be **pure** (same inputs → same compiled prompt).

---

### Evals (Requirements)

- Evals are **canvas-specific** and independent of each other.
- Two types:
  - **Pass/Fail** – model decides whether criteria were met
  - **Subjective** – model assigns a score ∈ [0, 1]
- Properties per eval:
  - required (boolean)
  - weight (default = 1)
  - success threshold (subjective only)
  - model selection (can differ from prompt model and from other evals)

Evals:

- Always run **against whatever response text is currently stored** as the LLM response
- Never reference or depend on other evals
- Are executed in parallel

---

### Scoring & Success

- After evals run, a **weighted aggregate score** is computed.
- A **global success threshold** is applied.
- Required evals override aggregate scoring:
- If any required eval fails, the overall result is considered failed, even if the aggregate score passes.
- It is valid for:
  - Some evals to fail while the run passes
  - A run to fail despite a high aggregate score

---

## Submission Modes

Users can choose between three actions:

1. **Save Prompt**

- Saves the prompt and eval definitions
- Does not call any model

2. **Submit Prompt**

- Saves prompt and evals
- Generates a new LLM response
- Automatically runs all evals against that response

3. **Submit Prompt Without Evaluating Requirements**

- Saves prompt and evals
- Generates a new LLM response
- Does not run evals

Additionally:

- Users can manually trigger **“Run All”** to re-run evals against the currently stored response.

---

## Model Execution

- Users select:
  - One model for prompt submission
  - One model per eval
- Models are chosen from those supported by the Vercel AI Gateway.
- Model execution is non-deterministic by nature; eval stability is not guaranteed.
- Advanced parameters (temperature, etc.) are not a current concern.

---

## Drafts & Versioning

- Users always work on a **mutable draft**.
- Versioning is:
  - **Manual**
  - **Linear**
  - Snapshot-based (prompt + evals + response at a point in time)
- Restoring an old version:
  - Makes it the active draft
  - Permanently deletes all versions that came after it
- Versions are view-only; only the draft is editable.
- There is no concept of “final” or “approved” states.

---

## Editing Semantics

- The stored LLM response can be manually edited by the user.
- Evals always run against the **stored response**, regardless of whether it originated from the model or manual edits.
- A canvas is considered “evaluated” only if evals were run after the current response state.

---

## Non-Goals (Intentional)

- No chatbot-style multi-turn history
- No automatic prompt optimization loops (human-in-the-loop only, for now)
- No CI, pipelines, or production integrations
- No collaboration, comments, or approvals (currently)
- No required artifact output (the goal is a high-quality response, though prompts can be exported)

---

## Exports

- Prompts, evals, and/or responses can be exported in formats such as:
  - Markdown
  - JSON

---

## Target Users

- People working on **complex prompts with many constraints**
- Users frustrated by:
- Context rot in chat-based tools
- Manual, error-prone evaluation of LLM outputs
- Likely more technical than average, but not exclusively developers

---

## Guiding Principle

**One prompt. One response. Many explicit requirements. Iterate until it passes.**
