# Security decisions log

## 2026-05-17: axios override via npm overrides

**Decision:** Override axios to ^1.15.1 across the snaptrade-typescript-sdk subtree.

**Why:** SnapTrade SDK 9.0.199 hard-pins axios to 1.14.0, which has two HIGH-severity CVEs:
- CVE-2025-62718 (NO_PROXY hostname normalization SSRF)
- CVE-2026-40175 (cloud metadata exfiltration via header injection chain)

Both fixed in axios 1.15.1.

**Alternatives considered:**
- Wait for SnapTrade to update: blocked indefinitely; SDK 9.0.199 is latest
- Accept risk: vulnerabilities, while not directly exploitable in our current usage (SnapTrade SDK uses fixed API URLs, no user-controlled redirects), are still real
- Override (chosen): forces a patched axios into the SnapTrade dependency tree

**Risk:** SnapTrade SDK was QA'd against axios 1.14.0. Behavior in 1.15.1 is expected to be compatible (minor version, additive changes only), but should be smoke-tested with each new SnapTrade integration phase. If brokerage connect or sync breaks, suspect this first.

**Remediation triggers:**
- When SnapTrade publishes a release that pins axios >= 1.15.1, remove this override.
- Re-check axios advisories at least monthly via `npm audit`.

**DO NOT** pin or override to axios 1.14.1 or 0.30.4 — both were malicious releases (March 2026 supply-chain attack) and have been pulled from npm. Stay on 1.15.1+.
