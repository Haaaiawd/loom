# Local Application Software Architecture

## Field identity and boundary

Software architecture for a small Node-served browser application: component boundaries, pure core,
contracts, state ownership, process lifecycle, and evolvability. Security threats belong to application
security; proof depth belongs to software testing.

## Project decisions this field changes

Whether project files are read by the browser or server; how parsing, recommendation, UI, persistence,
and launch stay separable; where JSON contracts live; how a double-click startup discovers a free port;
and how later real-Git support could add an adapter without corrupting the prototype contract.

## Project-specific diagnosis

A desktop shell would add packaging cost that the user explicitly excluded. A Node server that accepts
arbitrary paths would unnecessarily expand filesystem authority. Browser directory selection plus pure
core modules and a tiny loopback state service is the smallest complete shape that satisfies the sample
and keeps the unsafe boundary narrow.

## Principles, evidence, and sources

The architecture uses separation of concerns, dependency inversion around evidence adapters, deterministic
pure transformations, versioned contracts, explicit state ownership, and fail-closed boundaries. Sources
are the local constraints in `ANSWERS.md`; no external technical source was opened.

## Distinctive stance and rejected defaults

Read project File objects in the browser; send no project content to the state service. Keep parser and
recommendation free of DOM, filesystem, clock, network, and randomness. Reject Electron/package scope,
server-side arbitrary-path APIs, runtime package installation, database/state frameworks, and a monolithic
UI script where policy cannot be tested independently.

## Consequences for design, implementation, and verification

`application-architecture-contracts.md` fixes layout and APIs; `input-parsing.md` and
`evidence-recommendation.md` expose pure functions; `local-state.md` owns the only write. Contract tests
precede implementation. Server binds to an OS-assigned loopback port and emits structured readiness.

## Questions that could change the stance

Supporting arbitrary real `.git` repositories or installed-app distribution would require a new trusted
adapter/process boundary. Neither belongs to the prototype.

## Failure modes and proof signals

Failure: parser coupled to UI, server reads arbitrary paths, Git command execution, state mixed with
project data, hardcoded fixture output, or startup bound to a fixed public port. Proof: pure module tests,
contract fixtures, narrow API inspection, mutation response, and independent state/launch tests.

## Relationships without merger

Application security constrains permissions and request handling; testing proves behavior; UI/UX consumes
contracts. Architecture coordinates these interfaces without claiming their professional judgments.
