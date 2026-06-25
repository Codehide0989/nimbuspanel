# Contributing to NimbusPanel

## Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Copy `.env.example` to `.env.local` and configure
5. Run database: `npx prisma db push`
6. Start dev server: `npm run dev`

## Pull Requests

- Create a feature branch from `main`
- Write clear commit messages
- Ensure `npm run build` passes with zero errors
- Test your changes locally

## Code Style

- TypeScript strict mode
- Functional components with hooks
- Server Components by default, `"use client"` only when needed
- Zod validation for all inputs
- Error handling with try/catch in server actions
