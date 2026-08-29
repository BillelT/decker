# Security Policy

Decker is developed and maintained by a solo developer. This document
describes how to report a security issue, and summarizes the security
measures already in place in the backend service.

## Reporting a vulnerability

If you find a security issue in Decker (the Figma plugin or its backend
at `decker-gamma.vercel.app`), please report it privately
rather than opening a public GitHub issue:

- **Email:** b.tighidet0@gmail.com
- **What to include:** steps to reproduce, affected endpoint/component,
  and impact if known.
- **Response time:** acknowledgement within a few business days.
  Confirmed issues are prioritized and patched as quickly as practical
  given this is a solo-maintained project — there is no fixed SLA, but
  security fixes take priority over feature work.

Please do not publicly disclose a vulnerability until it has been
addressed.

## Security measures already in place

- **OAuth 2.0 with PKCE** for Google sign-in — no client secret or
  password ever touches the plugin UI or the user's browser.
- **Minimal OAuth scopes**: `drive.file` (access limited to files the app
  itself creates — never full Drive access, and never the broader
  `presentations` scope) and the non-sensitive `userinfo.email`.
- **Refresh tokens encrypted at rest** (AES-256-GCM) before being stored
  server-side; never stored in plaintext.
- **Session cookie** is `HttpOnly`, `Secure`, `SameSite=None` — not
  readable from client-side JavaScript.
- **Time-limited storage**: exported design data kept only long enough to
  retry a failed export (24h), temporary asset URLs expire after 1 hour,
  and uploaded assets are deleted from storage once an export completes.
- **No third-party network access**: the plugin's `networkAccess` in
  `manifest.json` only allows requests to Decker's own backend — no
  analytics, trackers, or third-party services.

## Scope

This policy covers the Decker Figma plugin and its backend service. It
does not cover Figma itself or Google's APIs, which have their own
security reporting channels.
