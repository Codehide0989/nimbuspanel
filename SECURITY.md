# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. Do NOT open a public issue
2. Email: security@nimbuspanel.com
3. Include: description, reproduction steps, impact assessment

## Security Measures

- Argon2id password hashing (64MB memory, 3 iterations)
- AES-256-GCM encryption for stored credentials
- HttpOnly Secure SameSite=Lax session cookies
- Rate limiting on login (5/15min), uploads (5/min), API (60/min)
- Account lockout after 5 failed attempts
- RBAC enforced server-side on every action
- PEM keys stored encrypted in S3, never exposed to browser
- CSP, HSTS, X-Frame-Options headers
- Input validation via Zod on all endpoints
