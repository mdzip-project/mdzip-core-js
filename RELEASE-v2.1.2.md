## Fixed

- Image syntax shown inside inline code, fenced code blocks and indented code
  blocks no longer counts as a real image reference.
- Removes false missing-image warnings and unresolved references caused by code
  examples, and correctly identifies images mentioned only in code as unused.

Fixes #8. No API changes.

## Validation

99 tests passed; 3 optional tests skipped. Includes regression coverage for
Markdown and HTML examples, matching fence lengths, multiline code spans,
escaped/unmatched backticks, validation and orphan analysis.
