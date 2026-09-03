# Security Policy

## What this project is

Danger Extension is a **demo-only** browser extension that
deliberately requests the full catalog of high-risk Chrome extension
permissions (including `debugger`, `nativeMessaging`, `management`,
`webRequest`, and `<all_urls>` host access) in order to demonstrate, live
and locally, what each permission actually unlocks. It is built for
security education and extension-review reference — not as software meant
for end users, and not as a template for a real, shipped extension.

## Intended use

- Load it **unpacked**, locally, in a browser profile you control, for the
  purpose of inspecting permission behavior.
- Do not package, publish, or distribute this extension (Chrome Web Store
  or otherwise) in its current form — its manifest is intentionally
  over-privileged.
- Do not point any panel at, or adapt this code for use against, systems,
  accounts, or data you do not own or do not have explicit authorization to
  test.
- The cookies panel can export live session/auth cookies, including an
  import-ready file for cookie-editor extensions. Moving those cookies into
  another browser (the "pass-the-cookie" technique) can impersonate a
  logged-in session without a password or MFA. Do this **only** for education
  or authorized testing, and **only** against accounts and systems you own or
  are explicitly permitted to test. Using another person's session cookies
  without authorization is unauthorized access and illegal in most
  jurisdictions.

## Reporting a vulnerability

If you find an issue where this extension does something beyond what its
README describes — e.g. any panel making a network call, exfiltrating data
off the local machine, or behaving differently from what a permission's
panel claims to do — please open a private report:

- Use GitHub's **[Report a vulnerability](../../security/advisories/new)**
  feature on this repository, or
- Email the maintainer at bjones@acium.io with a description and
  reproduction steps.

Please do not open a public issue for a suspected vulnerability until it
has been triaged.

## Out of scope

Reports about the *intended* behavior of this project — i.e. "this
extension requests a dangerous permission" or "this panel can read
[some local browser state]" — are expected and not a vulnerability; that is
the demo's purpose. In-scope reports are about behavior that deviates from
the documented, local-only, on-click design.
