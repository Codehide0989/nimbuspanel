# ⚡ NimbusPanel

Enterprise cloud infrastructure management platform. Manage VPS servers via SSH with real-time monitoring, team collaboration, and role-based access control.

## Features

- **Server Management** — Add, monitor, start, stop, reboot VPS servers via SSH
- **Auto-Detection** — Automatically collects OS, CPU, RAM, disk, kernel info via SSH
- **Real SSH Console** — Browser-based terminal executing real commands on your servers
- **Team Management** — Invite users with granular RBAC (Owner, Admin, Operator, SSH User, Read Only)
- **File Storage** — S3-backed file manager for PEM keys, configs, backups
- **Activity Audit** — Complete audit trail of all actions with IP logging
- **Notifications** — Real-time in-app notification center
- **Security** — Argon2id passwords, AES-256 encryption, rate limiting, session management

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL + Prisma ORM
- **Storage**: AWS S3
- **SSH**: node-ssh
- **Email**: Resend
- **Auth**: Custom session-based with Argon2id
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- AWS S3 bucket
- Resend API key

### Installation

```bash
git clone https://github.com/Codehide0989/nimbuspanel.git
cd nimbuspanel
npm install
```

### Environment Setup

```bash
cp .env.example .env.local
```

Fill in all required values. See `.env.example` for details.

### Database Setup

```bash
npx prisma db push
```

### Create Admin Account

```bash
npm run create:admin
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment (Vercel)

1. Push to GitHub
2. Import project in Vercel
3. Set all environment variables from `.env.example`
4. Deploy

Build command: `npm run build`
Output directory: `.next`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `APP_SECRET` | Yes | 32+ char encryption key |
| `AWS_REGION` | Yes | AWS region (e.g., eu-central-1) |
| `AWS_ACCESS_KEY_ID` | Yes | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS IAM secret key |
| `AWS_S3_BUCKET_NAME` | Yes | S3 bucket name |
| `SMTP_HOST` | Yes | SMTP server (smtp-relay.brevo.com) |
| `SMTP_PORT` | Yes | SMTP port (587) |
| `SMTP_LOGIN` | Yes | SMTP login |
| `SMTP_PASSWORD` | Yes | SMTP password |
| `EMAIL_FROM` | Yes | Sender email address |
| `NEXT_PUBLIC_APP_URL` | Yes | Public application URL |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run create:admin` | Create owner account |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Prisma Studio |

## License

MIT
