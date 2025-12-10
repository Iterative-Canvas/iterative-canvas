## Project Overview

This project is intended to be similar in spirit to ChatGPT, in that you have a sidebar with all your different sessions. When you select an item in the sidebar, it then becomes active in the main content area.

However, instead of offering a UI that allows for turn-based chats, we take a completely different approach. Instead of "chats", the main primitive is what we refer to as a "canvas". A canvas, in turn, has 3 main components:

- The user prompt
- The response from the language model
- The user-defined evals

> Note: Since versioning is supported, the entities mentioned above are actually related to a canvas version, and canvas versions are owned by the parent canvas container.

These three things allow for an iterative workflow, in which the user types a prompt, generates a response, and then sees the response evaluated independently against each of the evals. If the response fails according to the configured evals settings, then the user can iteratively refine their prompt and continue working in this loop until a satisfactory response has been achieved.

This workflow is intended for users who routinely have complex prompts and are seeking a detailed response that must balance multiple variables at a time. You could view this as an evolution of the "LLM-as-judge" pattern, except in this case there are N number of judges (the evals) that are each independently grading a unique aspect of the response in parallel.

Benefits of this pattern over turn-based chat:\
Turn-based chat often leads to context rot, in which the chat grows longer and longer in length the more the user iterates, causing the language model to degrade in performance and lose the thread. Additionally, absent any structured and automated evals, it can be labor intensive for the user to quickly verify if the response satisfies their requirements.

Benefits of this pattern over the regular LLM-as-judge pattern:\
If the original model that generated the response struggled to balance all of the requirements in the user prompt, then it stands to reason that a single LLM-judge will also struggle to grade the response in a single pass.

## Repo Structure

todo

## Tech Stack

todo
