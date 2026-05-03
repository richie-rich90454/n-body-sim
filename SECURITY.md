# Security Policy

## Supported Versions

The following versions of **N-Body Gravitational Dynamics** are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

> Only the latest stable release on the `main` branch is actively maintained. Older versions are not guaranteed to receive patches.

---

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

### How to Report

- **Email:** richie.rich90454@gmail.com  
- **GitHub:** Open a *private* security advisory via GitHub (preferred if available)

Please include as much detail as possible:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested mitigation (if known)

---

### What to Expect

- **Acknowledgement:** within 5 days
- **Initial assessment:** within 5–10 days  
- **Resolution timeline:** depends on severity and complexity

You will be kept informed of progress throughout the process.

---

### Disclosure Policy

- Do **not** publicly disclose the vulnerability until it has been reviewed and patched.
- Once resolved, a security advisory may be published with credit (if desired).

---

### Scope

This project is a **client-side browser simulation**, so most relevant security concerns include:

- WebGPU / browser API misuse
- Denial-of-service via extreme input parameters
- Memory issues involving `SharedArrayBuffer`
- Supply chain risks (dependencies)

Issues outside the project codebase (e.g., browser engine bugs) should be reported to the appropriate vendors.

---

## Security Best Practices

Users and developers should:

- Use a modern, up-to-date browser
- Avoid running untrusted builds or forks
- Keep dependencies up to date (`npm audit`)
- Serve the app over HTTPS when deployed

---

## Acknowledgements

Responsible disclosures are appreciated and help improve the project for everyone.
