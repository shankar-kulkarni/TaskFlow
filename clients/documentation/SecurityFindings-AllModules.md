# Security Findings — All Modules

- Date: 2026-02-16
- Scope: `clients/web`, `clients/mobile`, `services/task-service`, `infrastructure/pulumi`, root deployment assets
- Method: Static code review (repository evidence only)
- Overall Maturity: **Medium-Low**
- Confidence: **Medium**

## Severity Summary

| Severity | Count | Notes |
|---|---:|---|
| Critical | 0 | No direct RCE/credential dump in reviewed code paths |
| High | 6 | AuthZ and tenant-boundary issues with high abuse potential |
| Medium | 14 | Hardening, token storage, CORS, validation and ops gaps |
| Low | 9 | Hygiene/documentation/defense-in-depth improvements |

---

## Module Inventory

| Module | Path | Role | Primary Risk Surface |
|---|---|---|---|
| Backend API | [services/task-service](../../services/task-service) | Multi-tenant REST API | AuthZ, tenant isolation, token/session, data exposure |
| Web Client | [clients/web](../web) | Browser SPA | Token storage, API auth handling, XSS blast radius |
| Mobile Client | [clients/mobile](../mobile) | React Native app | Tenant handling, endpoint consistency, auth transport |
| Infra AWS | [infrastructure/pulumi/aws](../../infrastructure/pulumi/aws) | IaaC compute + network | Public exposure, secret handling, ingress policy |
| Infra Azure | [infrastructure/pulumi/azure](../../infrastructure/pulumi/azure) | IaaC compute + network | NSG exposure, image pull/push auth model |
| Infra GCP | [infrastructure/pulumi/gcp](../../infrastructure/pulumi/gcp) | IaaC compute + network | Tokenized registry push model, startup secret injection |
| Deployment Artifact | [web/Dockerfile](../../web/Dockerfile) | Web image build/runtime | Runtime hardening baseline |
| Documentation/Specs | [clients/documentation](.) | Security requirements context | Drift risk vs implementation |

---

## Findings by Module (Detailed Controls)

## 1) Backend API — services/task-service

### Implemented Controls

- Password hashing with bcrypt cost factor exists in [services/task-service/src/services/auth.service.ts](../../services/task-service/src/services/auth.service.ts#L13-L19).
- Access token and refresh token expiry are configured in [services/task-service/src/services/auth.service.ts](../../services/task-service/src/services/auth.service.ts#L8-L9).
- Verification/reset tokens use CSPRNG in [services/task-service/src/services/auth.service.ts](../../services/task-service/src/services/auth.service.ts#L67) and [services/task-service/src/services/auth.service.ts](../../services/task-service/src/services/auth.service.ts#L199).
- Validation framework with strict-mode flag exists in [services/task-service/src/middleware/validate.ts](../../services/task-service/src/middleware/validate.ts#L43-L47) and [services/task-service/src/config/flags.ts](../../services/task-service/src/config/flags.ts#L1-L2).

### Gaps and Risks

| Severity | Control Area | Finding | Evidence | Risk |
|---|---|---|---|---|
| High | Secrets | JWT secrets have insecure defaults (`dev-secret-key`, `dev-refresh-secret`) | [auth.service.ts](../../services/task-service/src/services/auth.service.ts#L6-L7) | Token forgery if env misconfigured |
| High | AuthZ | Many stateful/business routes are not protected by `requireAuth` | [tasks.ts](../../services/task-service/src/routes/tasks.ts#L24), [projects.ts](../../services/task-service/src/routes/projects.ts#L14), [workflows.ts](../../services/task-service/src/routes/workflows.ts#L14), [assignments.ts](../../services/task-service/src/routes/assignments.ts#L13) | Unauthorized read/write operations |
| High | Session Authorization | Session delete endpoint deletes by session ID only | [account.ts](../../services/task-service/src/routes/account.ts#L95) | IDOR: revoking other users’ sessions |
| High | Tenant Isolation | Audit activity query omits tenant filter | [audit.service.ts](../../services/task-service/src/services/audit.service.ts#L47-L49) | Cross-tenant audit data leakage |
| High | Tenant Identity | `tenant-default` fallback in auth/search/audit paths | [auth.ts](../../services/task-service/src/routes/auth.ts#L29), [search.ts](../../services/task-service/src/routes/search.ts#L19), [audit.ts](../../services/task-service/src/routes/audit.ts#L12) | Tenant confusion/misrouting |
| Medium | Transport Security | CORS reflects arbitrary origin header | [server.ts](../../services/task-service/src/server.ts#L42-L43) | Origin abuse and weaker browser boundary |
| Medium | Edge Protection | No visible `helmet` / rate limiting / brute-force controls | [server.ts](../../services/task-service/src/server.ts#L30-L49) | Increased abuse and attack surface |
| Medium | Error Disclosure | Error internals returned/logged broadly (`error.message`, stack/meta/details) | [tasks.ts](../../services/task-service/src/routes/tasks.ts#L186-L194), [server.ts](../../services/task-service/src/server.ts#L123) | Information leakage for attackers |
| Medium | Credential Policy | Password policy is minimal (length-only at register, no strong reset policy) | [auth.ts](../../services/task-service/src/routes/auth.ts#L21), [auth.ts](../../services/task-service/src/routes/auth.ts#L125-L133) | Weaker credential strength |
| Medium | Session Lifecycle | Refresh token rotation and replay protection not evident | [auth.service.ts](../../services/task-service/src/services/auth.service.ts#L165-L184) | Stolen refresh token longevity |
| Medium | Logging Hygiene | Verbose task logs print request body/error internals | [tasks.ts](../../services/task-service/src/routes/tasks.ts#L114-L190) | PII/metadata leakage |
| Low | Secure Defaults | Non-production placeholders remain (`user-uuid` TODOs) | [tasks.ts](../../services/task-service/src/routes/tasks.ts#L314), [projects.ts](../../services/task-service/src/routes/projects.ts#L53) | Inconsistent actor attribution |

---

## 2) Web Client — clients/web

### Implemented Controls

- API client sends bearer token and tenant header consistently in [clients/web/src/api/client.ts](../web/src/api/client.ts#L24-L29).

### Gaps and Risks

| Severity | Control Area | Finding | Evidence | Risk |
|---|---|---|---|---|
| High | Token Storage | Access and refresh tokens stored in `localStorage` | [client.ts](../web/src/api/client.ts#L2-L3), [client.ts](../web/src/api/client.ts#L74-L75) | XSS token theft and account takeover |
| Medium | Tenant Integrity | Tenant ID sourced from browser storage with default fallback | [client.ts](../web/src/api/client.ts#L14), [client.ts](../web/src/api/client.ts#L66) | Client-side tenant spoofing pressure |
| Medium | Error Handling | Raw API error details logged to console | [client.ts](../web/src/api/client.ts#L40-L47) | Internal data exposure in browser logs |
| Low | Defensive Defaults | No evidence of secure cookie/BFF token strategy | [client.ts](../web/src/api/client.ts#L73-L84) | Elevated browser threat model |

---

## 3) Mobile Client — clients/mobile

### Implemented Controls

- Tenant header is consistently added in mobile API calls | [clients/mobile/src/api/client.ts](../mobile/src/api/client.ts#L88).

### Gaps and Risks

| Severity | Control Area | Finding | Evidence | Risk |
|---|---|---|---|---|
| Medium | Tenant Identity | Tenant ID falls back to static `tenant-uuid` | [clients/mobile/src/api/client.ts](../mobile/src/api/client.ts#L76) | Tenant confusion/misrouting risk |
| Medium | Auth Transport | No bearer/auth token handling in mobile API client | [clients/mobile/src/api/client.ts](../mobile/src/api/client.ts#L82-L90) | Reliance on header-only tenancy; weak user auth posture |
| Medium | Endpoint Consistency | Mixed `/api/...` and `/api/v1/...` usage in same client | [clients/mobile/src/api/client.ts](../mobile/src/api/client.ts#L112), [clients/mobile/src/api/client.ts](../mobile/src/api/client.ts#L204) | Misrouted requests and inconsistent policy enforcement |
| Low | Logging | API request failures logged directly | [clients/mobile/src/api/client.ts](../mobile/src/api/client.ts#L100) | Potential telemetry leakage |

---

## 4) Infrastructure as Code — Pulumi (AWS/Azure/GCP)

### Implemented Controls

- Secret configs are used for DB password in all clouds: [infrastructure/pulumi/README.md](../../infrastructure/pulumi/README.md#L21), [aws/Program.cs](../../infrastructure/pulumi/aws/Program.cs#L19), [azure/Program.cs](../../infrastructure/pulumi/azure/Program.cs#L25), [gcp/Program.cs](../../infrastructure/pulumi/gcp/Program.cs#L22).
- Azure VM uses managed identity for pull path in code comments/role assignment paths: [azure/Program.cs](../../infrastructure/pulumi/azure/Program.cs#L329-L345).

### Gaps and Risks

| Severity | Control Area | Finding | Evidence | Risk |
|---|---|---|---|---|
| High | Network Exposure | API port is publicly open (`0.0.0.0/0`) in AWS and Azure examples | [aws/Program.cs](../../infrastructure/pulumi/aws/Program.cs#L119-L124), [azure/Program.cs](../../infrastructure/pulumi/azure/Program.cs#L87-L96) | Direct internet attack surface |
| Medium | SSH Hardening | README default allows broad SSH CIDR if not constrained | [infrastructure/pulumi/README.md](../../infrastructure/pulumi/README.md#L18) | Admin plane exposure |
| Medium | Registry Push Model | GCP uses access-token config for image push | [infrastructure/pulumi/README.md](../../infrastructure/pulumi/README.md#L75), [gcp/Program.cs](../../infrastructure/pulumi/gcp/Program.cs#L27) | Token handling risk in operator workflow |
| Medium | Runtime Secret Injection | DB credentials injected into compose environment/user-data | [aws/Program.cs](../../infrastructure/pulumi/aws/Program.cs#L295-L305), [azure/Program.cs](../../infrastructure/pulumi/azure/Program.cs#L230-L240), [gcp/Program.cs](../../infrastructure/pulumi/gcp/Program.cs#L168-L178) | Secret exposure via host/process/config artifacts |
| Medium | TLS/Posture | Notes explicitly list HTTPS and API port restriction as pending work | [infrastructure/pulumi/notes](../../infrastructure/pulumi/notes#L16-L17) | Incomplete production hardening |
| Low | Supply Chain Hardening | No evidence of image signing/SBOM/attestation pipeline in IaC docs | [infrastructure/pulumi/README.md](../../infrastructure/pulumi/README.md) | Integrity and provenance gaps |

---

## 5) Deployment Artifact — Root web Dockerfile

### Implemented Controls

- Multi-stage build reduces final artifact size | [web/Dockerfile](../../web/Dockerfile#L1-L16).

### Gaps and Risks

| Severity | Control Area | Finding | Evidence | Risk |
|---|---|---|---|---|
| Low-Medium | Runtime Hardening | No explicit non-root user or hardened nginx config in Dockerfile | [web/Dockerfile](../../web/Dockerfile#L10-L16) | Broader container runtime permissions |

---

## 6) Cross-Module Findings

| Severity | Finding | Evidence | Risk |
|---|---|---|---|
| High | Tenant is mostly caller/header-derived rather than strongly server-derived from identity | [middleware/auth.ts](../../services/task-service/src/middleware/auth.ts#L18-L20), [utils/tenant.ts](../../services/task-service/src/utils/tenant.ts), [clients/web/api](../web/src/api/client.ts#L27), [clients/mobile/api](../mobile/src/api/client.ts#L88) | Tenant impersonation pressure and boundary drift |
| Medium | Validation exists but strict mode is opt-in and may remain disabled | [config/flags.ts](../../services/task-service/src/config/flags.ts#L1-L2), [middleware/validate.ts](../../services/task-service/src/middleware/validate.ts#L47) | Inconsistent input enforcement in production |
| Medium | Error and debug logging patterns can leak internals across services/clients | [server.ts](../../services/task-service/src/server.ts#L123), [tasks.ts](../../services/task-service/src/routes/tasks.ts#L186-L194), [clients/web/api](../web/src/api/client.ts#L40-L47) | Reconnaissance and sensitive metadata leakage |

---

## Prioritized Top 10 Remediations

1. **Enforce auth middleware** for all write/read-sensitive routes in `tasks/projects/workflows/assignments` and add role checks where required.
2. **Remove JWT fallback secrets** and fail service startup when required secrets are absent.
3. **Fix IDOR in session deletion** by scoping delete to `{ id, userId }` and return 404 on mismatch.
4. **Enforce tenant-scoped audit activity** by requiring tenantId in `getEntityActivity` and route call sites.
5. **Remove `tenant-default` from runtime request paths** (allow only in local dev bootstrap with explicit guard).
6. **Harden CORS + add helmet + rate limiting** at API edge/server level.
7. **Move web auth tokens from localStorage to httpOnly secure cookies** (or BFF pattern).
8. **Standardize error handling**: generic client errors, structured internal logs, no stack/message leaks to users.
9. **Strengthen password policy and reset lifecycle** (complexity checks, breached-password check, rotate/revoke sessions on reset/change).
10. **Harden IaC network policy**: restrict API ingress, tighten SSH CIDR, add HTTPS termination and cert automation.

---

## Module-by-Module Remediation Checklist

## A) services/task-service

- [ ] Remove fallback secrets in [services/task-service/src/services/auth.service.ts](../../services/task-service/src/services/auth.service.ts#L6-L7) and enforce startup validation.
- [ ] Add `requireAuth` to unauthenticated critical routes in [tasks.ts](../../services/task-service/src/routes/tasks.ts), [projects.ts](../../services/task-service/src/routes/projects.ts), [workflows.ts](../../services/task-service/src/routes/workflows.ts), [assignments.ts](../../services/task-service/src/routes/assignments.ts).
- [ ] Implement role/permission checks for project/workflow/task mutations.
- [ ] Change session delete query in [account.ts](../../services/task-service/src/routes/account.ts#L95) to include `userId` owner scope.
- [ ] Update [audit.service.ts](../../services/task-service/src/services/audit.service.ts#L47-L49) to require tenant-scoped query.
- [ ] Remove `tenant-default` runtime fallback in [auth.ts](../../services/task-service/src/routes/auth.ts), [search.ts](../../services/task-service/src/routes/search.ts), [audit.ts](../../services/task-service/src/routes/audit.ts).
- [ ] Add `helmet`, strict CORS allowlist, and route-specific rate limiting in [server.ts](../../services/task-service/src/server.ts).
- [ ] Replace client-facing `error.message` responses with standardized error codes/messages.
- [ ] Remove verbose request/error debug logs in [tasks.ts](../../services/task-service/src/routes/tasks.ts#L114-L194).
- [ ] Enable strict validation mode by default in production and add CI guard.

## B) clients/web

- [ ] Replace localStorage token persistence in [clients/web/src/api/client.ts](../web/src/api/client.ts#L74-L75) with secure cookie/BFF model.
- [ ] Remove tenant fallback behavior in [clients/web/src/api/client.ts](../web/src/api/client.ts#L14) and rely on server-derived tenant.
- [ ] Sanitize/limit browser error logging in [clients/web/src/api/client.ts](../web/src/api/client.ts#L40-L47).
- [ ] Add session refresh failure handling and token replay mitigation UX.

## C) clients/mobile

- [ ] Introduce authenticated user token flow (secure storage) in [clients/mobile/src/api/client.ts](../mobile/src/api/client.ts).
- [ ] Remove hardcoded tenant fallback in [clients/mobile/src/api/client.ts](../mobile/src/api/client.ts#L76).
- [ ] Normalize endpoint versioning (`/api/v1/...`) across mobile API methods.
- [ ] Reduce production error log verbosity and add structured telemetry redaction.

## D) infrastructure/pulumi/aws

- [ ] Restrict `taskPort` ingress from `0.0.0.0/0` to trusted sources/load balancer in [aws/Program.cs](../../infrastructure/pulumi/aws/Program.cs#L119-L124).
- [ ] Restrict SSH CIDR defaults and enforce explicit non-public admin source ranges.
- [ ] Move runtime DB secret handling from user-data/compose env to secret manager retrieval at runtime.
- [ ] Add HTTPS termination (ALB/reverse proxy + cert management).

## E) infrastructure/pulumi/azure

- [ ] Restrict API NSG rule in [azure/Program.cs](../../infrastructure/pulumi/azure/Program.cs#L87-L96) to trusted front-door/LB or private network.
- [ ] Keep managed identity pull model; remove broad fallback auth paths where present.
- [ ] Move DB secret injection to managed secret retrieval at runtime.
- [ ] Enforce TLS-only external entry and disable direct API public exposure.

## F) infrastructure/pulumi/gcp

- [ ] Replace operator access-token push flow in [gcp/Program.cs](../../infrastructure/pulumi/gcp/Program.cs#L27) with workload identity/OIDC CI push.
- [ ] Restrict public ingress for API port and require HTTPS edge.
- [ ] Move DB secret from startup script/env to secret manager retrieval.
- [ ] Add artifact integrity controls (image signing/provenance).

## G) deployment/web image

- [ ] Add non-root runtime user and hardened nginx config in [web/Dockerfile](../../web/Dockerfile).
- [ ] Add image scanning and CVE gates in CI before deploy.

## H) cross-module governance and verification

- [ ] Add security regression tests for authz/tenant isolation in `services/task-service/tests`.
- [ ] Add CI security jobs: dependency audit, static analysis, secret scanning, container scanning.
- [ ] Add release gate requiring all High findings to be resolved or formally waived.
- [ ] Add a quarterly threat-model and security review workflow tied to changelog updates.

---

## Validation Checklist for This Report

- [x] All modules in scope are covered.
- [x] Each high-severity issue has code evidence links.
- [x] Remediation actions are implementation-ready by module.
- [ ] Runtime controls outside repository (WAF/API gateway/IdP policies) need operational confirmation.

---

## Known Unknowns (Require Operational Verification)

- API gateway/WAF policy and rate-limit configuration outside code.
- Secret vault integration and rotation policy in deployment environments.
- TLS termination architecture and certificate lifecycle in production.
- SOC logging/monitoring alert rules and incident response playbooks.
- CI/CD supply-chain controls (SBOM, signing, attestations) not represented in this repo.
