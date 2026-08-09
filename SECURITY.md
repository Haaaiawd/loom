# Security policy

Please do not publish exploitable details in a public issue.

Report a vulnerability through [GitHub private vulnerability reporting](https://github.com/Haaaiawd/loom/security/advisories/new).
Include the affected version, reproduction steps, impact, and any suggested mitigation. If private reporting
is unavailable, open a minimal issue asking for a private contact channel without including the vulnerability.

LOOM reads and writes project-local state and may be used by Agents with broad command-line permissions.
Security reports involving path traversal, unintended workspace mutation, command construction, stale Keeper
authorization, or untrusted project content are especially relevant.
