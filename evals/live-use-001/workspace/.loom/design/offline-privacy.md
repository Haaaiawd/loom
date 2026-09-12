# Offline storage and privacy contract

The deliverable is one HTML file with inline CSS/JS and no external requests. It must function from a file URL. Draft text is stored only in browser localStorage under an app-specific key so refresh does not erase work; the UI exposes Clear local note, which removes it. No analytics, cookies, remote APIs, fonts, or embedded network assets are allowed.

Verification inspects source for network primitives and exercises persistence plus clearing in a browser context.
