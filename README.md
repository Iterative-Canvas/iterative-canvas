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
