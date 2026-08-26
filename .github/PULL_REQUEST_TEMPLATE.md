## What does this change?

<!-- Describe the change and which panel(s)/permission(s) it touches. -->

## Why?

<!-- What gap, inaccuracy, or missing capability does this address? -->

## Checklist

- [ ] `manifest.json` still declares only permissions actually exercised by a panel.
- [ ] Any new panel reads local browser state only — no network calls.
- [ ] Any ChromeOS-only / enterprise-managed API that can't run here says so plainly, rather than faking a result.
- [ ] Tested by loading the extension unpacked (`chrome://extensions` → Developer mode → Load unpacked) and exercising the affected panel(s).
- [ ] README/SECURITY updated if this changes what the extension does or requests.
