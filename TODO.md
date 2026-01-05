Just some scattered thoughts:

- When creating a new canvas, we need to initialize the model being used...
  - Allow the user to set default models for prompting, evals, and refining the canvas
  - Pick the user's preferred model if it is still available in the AI Gateway
  - If a default is not set, or it's no longer available, pick a model for them
- On the frontend, we will populate the model picker with the dynamic model list from the AI Gateway
  - If the model is no longer available (not in the list) merge it into the list/dropdown with a warning icon
  - Additionally, disable prompting, evals, or refinements until a new model is picked
  - Once a new model is picked, the deprecated model should disappear

Note: Likely need to add a new field to the canvasVersions table for `refinementModel`
Note: Make the prompt submit button a split-button with a secondary option of `Save withouout generating`
Note: Add a new user setting: `Automatically run evals after generating, refining, or manually editing the canvas?`
Note: Restrict evals to models that support structured outputs
Note: Two sparkle options for evals... - Improve existing evals - Generate evals from prompt

---

- implement pseudo structured responses to patch old models like gpt-3.5-turbo
- clear/reset state button
- change the default models and add a user settings page
- attempt to alleviate race conditions
- re-evaluate exactly when modules should or should not be disabled
- update default models
- don't disable evals if clicking "submit w/o evals"
- add an empty state for the evals list when there are no evals
- keyboard shortcuts
- when click on "Add Requirement", focus the textarea
- review the system prompts
- migrate actions out of the actions folder so we can remove the "use node" directive
  - ✖ actions/runSingleEval.ts is in /actions subfolder but has no "use node"; directive. You can now define actions in any folder and indicate they should run in node by adding "use node" directive. /actions is a deprecated way to choose Node.js environment, and we require "use node" for all files within that folder to avoid unexpected errors during the migration. See https://docs.convex.dev/functions/actions for more details
