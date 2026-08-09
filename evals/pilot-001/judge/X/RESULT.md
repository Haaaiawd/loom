# Condition B Experiment Result

## Engineering start record

- Actual engineering began on 2026-08-09 after the on-disk Keeper handoff reported `passed` and LOOM reported `build_ready`.
- Active milestone at start: `TASK-001` — executable evidence and recommendation contracts.
- Scope boundary: work is confined to this condition directory; `sample-project` is read-only; no publishing, network access, real `.git` parsing, parser, recommendation engine, UI, server, persistence, or launcher is part of this first milestone.
- Consequential assumption carried from the Work Map: `sample-project/GIT_LOG.txt` is the Git-history fixture; arbitrary real `.git` repositories are not supported by this prototype.

## Completion evidence

- Runnable vertical prototype implemented under `prototype/`: strict JSON contracts, pure input parser, deterministic role-sensitive recommendations, browser UI, narrow loopback state service, and Windows launch entry.
- `npm test --prefix prototype`: exit 0; 21 passed, 0 failed.
- `node prototype/scripts/verify-readonly.mjs sample-project`: exit 0; before/after SHA-256 both `3e56ef730cd38618c3ab8cec406f4bb2011a9592c0a057ce6bcca48da00ee482`.
- `node prototype/scripts/verify-offline.mjs`: exit 0; 5 loopback requests, 0 external requests.
- `powershell -NoProfile -ExecutionPolicy Bypass -File prototype/scripts/smoke-launch.ps1`: exit 0; Node v22.16.0, assigned `127.0.0.1` URL, state round trip, and graceful shutdown recorded in `prototype/evidence/smoke-launch.txt`.
- Real Chromium review at a 1280 x 720 viewport passed for idle, programmer, and artist states. See `prototype/evidence/visual-review.md` and the three screenshots.
- LOOM metadata was repaired from directory-level Task reads to exact test-file reads; final pre-delivery `loom check` was healthy with no errors or warnings.

## Start and use

1. On Windows 11, double-click `prototype/start-prototype.cmd` (Node.js must be on PATH).
2. The console reports the Node version and assigned loopback URL, then opens the default browser. Keep the console open; Ctrl+C stops the service started by that launcher.
3. Select a folder containing `BACKLOG.md` and `GIT_LOG.txt`; `sample-project` is the acceptance fixture.
4. Choose Producer / designer, Programmer, or Artist, then select **Read project**.
5. Inspect recent changes separately from the supported candidates. Accept any candidate or choose **Skip for now**; only the minimal choice snapshot is stored locally.

Developer verification commands are the four commands listed under Completion evidence.

## Unimplemented boundaries and required guesses

- Not implemented by design: arbitrary real `.git` parsing, non-Chromium support, multiplayer/shared state, engine-specific parsing, installation/package lifecycle, cloud sync, external trackers, free-text daily goals, or arbitrary project formats.
- The required prototype assumption remains that `GIT_LOG.txt` represents Git history. Commit recency is context only, never standalone unfinished work or priority.
- Role relevance is a deterministic, reversible rule-set inferred from the sparse sample vocabulary. The sources do not establish owners, deadlines, dependencies, verified severity, or completion state; the UI keeps those unknown.
- Visual verification is incomplete: shortfall, input-error, accepted, and restored screenshots; actual keyboard-only completion; and 200 percent browser zoom were not completed. The mistakenly captured non-transitioned `accepted.png` was removed rather than mislabelled.
- The automated smoke proves service readiness, loopback URL, state round trip, and graceful shutdown. Actual double-click browser opening and interactive Ctrl+C handling of the wrapper were not visually exercised in this run.
- `TASK-004` must remain incomplete until the missing visual/interactive checks are run and recorded; the implementation and all non-visual automated proof are complete.
