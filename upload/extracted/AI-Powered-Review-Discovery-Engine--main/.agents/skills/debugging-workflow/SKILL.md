---
name: debugging-workflow
description: Describe what this skill does and when to use it. Include keywords that help agents identify relevant tasks.
---

<!-- Tip: Use /create-skill in chat to generate content with agent assistance -->

Define the functionality provided by this skill, including detailed instructions and examples

---
name: debugging-workflow
description: Use when troubleshooting a bug, error, or unexpected behavior in any project.
---

# Debugging Workflow

1. Reproduce first — don't guess at a fix before confirming the actual failure
2. Read the full error/stack trace, not just the last line
3. Isolate: binary-search the code path (add logging/print, narrow the suspect range) rather than rewriting broad sections speculatively
4. State the root cause found before proposing the fix
5. After fixing, check for the same bug pattern elsewhere in the codebase