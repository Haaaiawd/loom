# Local Application Security

## Field identity and boundary

Application security for local files, browser/loopback communication, command injection, data minimization,
and least privilege. It does not own general architecture aesthetics or test methodology.

## Project decisions this field changes

Why the browser receives files through a user gesture; why no API accepts project paths; why project text
is inert data; why the service binds only loopback and requires a launch token for state writes; what may
be persisted; and how “offline” is proved despite permitted loopback HTTP.

## Project-specific diagnosis

Backlog and commit text are untrusted local input and may contain HTML, links, quotes, or command-looking
strings. A local service is not automatically trusted: other local pages or processes could attempt state
writes, and binding beyond loopback would expose the app. The safest prototype does not give the server
project filesystem authority at all.

## Principles, evidence, and sources

Apply least privilege, explicit user selection, data minimization, output escaping, deny-by-default APIs,
loopback-only binding, origin/Host checks, per-launch authorization, size limits, and no shell interpolation.
Constraints come from `ANSWERS.md`; no external security source was opened in this iteration.

## Distinctive stance and rejected defaults

Project content stays browser memory. Render it as text, never HTML. Persist no absolute path or raw source.
Allow loopback requests only; zero external requests. Reject `exec`, Git CLI, project link fetching,
dynamic Markdown HTML, broad CORS, `0.0.0.0`, arbitrary write/delete endpoints, and automatic cleanup of
user data.

## Consequences for design, implementation, and verification

`input-parsing.md` treats all content as inert and capped. `application-architecture-contracts.md` narrows
API/host/token rules. `local-state.md` minimizes data and path scope. `verification.md` includes hostile
text, origin/Host rejection, external-request trapping, and before/after project hashes.

## Questions that could change the stance

Real `.git` access would expand filesystem authority and needs a separate threat model. The prototype's
fixture assumption avoids silently taking that risk.

## Failure modes and proof signals

Failure: project text reaches a shell or `innerHTML`, server reads a supplied path, tokenless state writes,
remote font/API calls, absolute paths in state, or project hash changes. Proof: code search and negative
tests, hostile fixture rendering as literal text, loopback-only listener, denied forged requests, and zero
external-network records.

## Relationships without merger

Software architecture supplies component seams; software testing supplies adversarial proof; visual art
direction accepts the no-remote-asset constraint. Security owns permission and threat decisions.
