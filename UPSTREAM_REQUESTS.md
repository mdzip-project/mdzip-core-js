# Upstream requests

## Baseline fixtures and conditional extension profiles

Requested 2026-10-25; scope revised to separate mandatory operations from extras.
Owner: `mdzip-spec`. Request: https://github.com/mdzip-project/mdzip-spec/issues/9

- Dependency: a versioned baseline R1-R7 contract/fixture schema and sync path is
  required for shared baseline acceptance and CI adapters. Local implementation
  and regression tests can proceed before the shared suite lands.
- Required baseline API mapping/adapters are covered by the shared fixture request. Built-in ZIP-bomb limits ([#10](https://github.com/mdzip-project/mdzip-core-js/issues/10), R7) are local required work that doesn't wait on the suite; making them configurable (superseded #9) stays optional.
- Optional profiles are conditional on advertised capabilities. Unsupported is
  not applicable, not failed baseline parity. Do not wait for all libraries to
  implement all extensions; do not silently skip failing advertised behavior.
- Run profiles for existing JS image/workspace capabilities; preserve code-example exclusion and lazy workspace behavior. No requirement to copy every Python policy or .NET filesystem API.
- Reference: hub `.github/docs/core-contract.md` (draft 0.1) and
  `.github/docs/core-parity.md`. Format spec requirements remain separate from
  first-party library operations and optional extension contracts.

Close the baseline request when the shared baseline adapter is running in CI.
Optional profile adoption follows its own supported capability/consumer work;
it is not a universal completion prerequisite.
