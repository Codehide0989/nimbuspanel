# Changelog

## 3.0.0 — Production Release

### Added
- Complete authentication system (login, sessions, password reset)
- Role-based access control (5 roles, 17 permissions)
- Real SSH terminal via browser (xterm.js + node-ssh backend)
- Server auto-detection (OS, CPU, RAM, disk, kernel via SSH)
- Start/Stop/Reboot servers via SSH
- Team invitation system via Resend email
- In-app notification center with real-time updates
- Activity audit logging with IP tracking
- S3 file storage with upload/download/delete
- PEM key validation and encrypted storage
- Rate limiting and brute force protection
- AES-256-GCM credential encryption
- HTTP security headers (CSP, HSTS, X-Frame-Options)
- Premium collapsible sidebar with persistent state
- Loading skeletons for every page
- Debounced search
- Dynamic imports for code splitting
- Self-hosted fonts via next/font
- SVG favicon with PWA manifest

### Security
- Argon2id password hashing
- Session rotation on login
- Account lockout after failed attempts
- Server-side RBAC enforcement
- Data masking for unauthorized roles
