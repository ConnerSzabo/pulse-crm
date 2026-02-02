# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wave Systems CRM - A full-stack TypeScript sales pipeline management application for an IT hardware reselling business. Manages schools/companies, contacts, activity tracking, and sales pipelines.

## Technology Stack

- **Frontend:** React 18, Vite 7, Tailwind CSS, shadcn/ui, TanStack React Query, Wouter routing
- **Backend:** Express.js 5, Node.js 20
- **Database:** PostgreSQL 16 with Drizzle ORM
- **Auth:** Passport.js with express-session (PostgreSQL store)

## Commands

```bash
npm run dev       # Start development server (port 5000)
npm run build     # Production build (client + server)
npm run start     # Run production server
npm run check     # TypeScript type checking
npm run db:push   # Push Drizzle schema changes to database
```

## Architecture

```
client/src/
├── pages/          # Route components (dashboard, companies, pipeline, tasks)
├── components/ui/  # shadcn/ui components
├── hooks/          # Custom hooks (use-auth, use-toast)
└── lib/            # Utilities (queryClient, auth-utils)

server/
├── index.ts        # Express app setup, session config, middleware
├── routes.ts       # All API endpoints
├── storage.ts      # Data access layer (IStorage interface)
└── db.ts           # Drizzle ORM connection

shared/
└── schema.ts       # Drizzle schema definitions + Zod types
```

## Database Schema

Eight tables defined in `shared/schema.ts`:
- **users** - Authentication
- **companies** - Schools/businesses with Wave Systems-specific fields
- **contacts** - Company contacts
- **activities** - Call/email/quote/follow-up/deal tracking
- **tasks** - Task management with priorities and due dates
- **pipelineStages** - Pipeline stages (Future Pipeline → Closed Won/Lost)
- **dailyStats** - Daily call counter tracking
- **callNotes** - Legacy call notes

## API Routes

All routes in `server/routes.ts`. Authentication required except `/api/login`, `/api/logout`, `/api/auth/me`.

Key endpoints:
- `/api/companies` - CRUD operations
- `/api/companies/:id/contacts` - Contact management
- `/api/companies/:id/activities` - Activity logging
- `/api/tasks` - Task management
- `/api/pipeline-stages` - Pipeline configuration
- `/api/dashboard/*` - Statistics

## Path Aliases

Configured in `tsconfig.json`:
- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`

## Environment Variables

Required: `DATABASE_URL`, `SESSION_SECRET`

## Key Patterns

- Session-based auth with 1-week duration
- Activities auto-update company fields (lastContactDate, lastQuoteValue, etc.)
- TanStack Query for server state caching
- Drizzle ORM with Zod schema validation
