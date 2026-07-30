# Security Policy

## Reporting a Vulnerability

This is a client-side static HTML tool with no server component, no user data storage, and no authentication. All computation runs locally in your browser.

If you discover a security issue (e.g., XSS via URL hash parameter parsing), please report it by opening a GitHub issue at:

https://github.com/totalwindupflightsystems/inference-estimator/issues

## Supported Versions

Only the latest commit on `main` is supported.

## Scope

- **In scope:** DOM-based XSS, malicious URL hash injection, unsafe innerHTML usage
- **Out of scope:** Anything requiring physical device access, social engineering, or denial of service
