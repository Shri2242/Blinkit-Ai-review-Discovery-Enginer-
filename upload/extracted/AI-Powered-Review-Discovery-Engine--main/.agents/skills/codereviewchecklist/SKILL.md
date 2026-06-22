---
name: codereviewchecklist
description: Describe what this skill does and when to use it. Include keywords that help agents identify relevant tasks.
---

<!-- Tip: Use /create-skill in chat to generate content with agent assistance -->

Define the functionality provided by this skill, including detailed instructions and examples

---
name: code-review-checklist
description: Use when reviewing a diff, PR, or asked to "review this code" in any language/project.
---

# Code Review Checklist

- Correctness: does it do what it claims, including edge cases (empty input, null, max size)?
- Types: anything untyped/`any` that shouldn't be?
- Error handling: failures surfaced or silently swallowed?
- Security: unsanitized input, hardcoded secrets, missing auth checks?
- Scope: does the diff do only what it claims, or sneak in unrelated changes?
- Tests: does new logic have test coverage, if the project has a test suite?
Output as a checklist-style comment, don't auto-fix unless asked.