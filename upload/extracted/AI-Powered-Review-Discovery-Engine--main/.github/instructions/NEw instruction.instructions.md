---
description: Describe when these instructions should be loaded by the agent based on task context
# applyTo: 'Describe when these instructions should be loaded by the agent based on task context' # when provided, instructions will automatically be added to the request context when the pattern matches an attached file
---

<!-- Tip: Use /create-instructions in chat to generate content with agent assistance -->

Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

# Default Instructions

## General principles
- Correctness over speed. If a request is ambiguous, ask rather than assume — especially for anything destructive (deletes, migrations, force-pushes, overwrites).
- No dead code, no commented-out blocks left behind, no placeholder/TODO logic presented as finished.
- Match the existing codebase's conventions (naming, file structure, formatting) before introducing new patterns. Don't impose a personal style on an existing project.
- If a library/framework/API is unfamiliar or its current behavior is uncertain, verify rather than guess from training data — APIs change.

## Code quality
- Strong typing wherever the language supports it. No `any`/untyped escape hatches without a comment explaining why.
- Functions/methods do one thing; split anything doing two unrelated things.
- Errors are handled explicitly, not swallowed silently. Never catch-and-ignore without a comment explaining why it's safe to ignore.
- No magic numbers/strings — name them as constants.

## Git
- Conventional commits: `type(scope): description` — feat/fix/chore/refactor/docs/test
- One logical change per commit. Don't bundle unrelated changes.
- Never force-push to a shared branch without explicit confirmation.

## Security / safety defaults
- Never commit secrets, API keys, or credentials. Flag if one is about to be hardcoded.
- Validate and sanitize any external input (user input, API responses, file uploads) before use.
- Flag any change that affects auth, permissions, or data access scope.

## Before doing anything irreversible
- Schema/migration changes, force-pushes, file deletions, prod config changes, dependency major-version bumps — confirm first, don't just execute.