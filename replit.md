# Simple CRM

A lightweight CRM application for managing companies/schools, contacts, call notes, and sales pipeline.

## Overview

This is a full-stack application built with:
- **Frontend**: React with TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: TanStack React Query

## Features

1. **Companies Management**
   - View list of companies/schools with location, phone, and website
   - Add new companies with full details (name, website, phone, location, academy trust, IT manager info, notes)
   - Delete companies
   - Filter/search companies by name, location, or trust name

2. **Company Detail View**
   - View all company information (website link, location, academy trust, IT manager, notes)
   - Change pipeline stage
   - **Contacts Tab**: Add and manage email contacts for each company
   - **Call Notes Tab**: Log and track individual calls with timestamps

3. **Pipeline Management**
   - Visual kanban-style board
   - Drag companies between stages
   - Default stages: Lead, Contacted, Qualified, Proposal, Won, Lost

4. **CSV Import**
   - Upload CSV files with company/school names and phone numbers
   - Preview data before importing
   - Optionally assign to a pipeline stage during import
   - Supports both comma-delimited and tab-delimited files
   - Maps columns: EstablishmentName, Website, Phone, Location, AcademyTrustName, Ext, Notes, IT Manager Name, IT Manager Email

## Project Structure

```
client/src/
├── components/
│   ├── ui/           # shadcn/ui components
│   ├── app-sidebar.tsx
│   └── theme-toggle.tsx
├── pages/
│   ├── companies.tsx      # Companies list
│   ├── company-detail.tsx # Company detail with tabs
│   ├── pipeline.tsx       # Pipeline board
│   └── import-csv.tsx     # CSV import
└── App.tsx

server/
├── db.ts           # Database connection
├── routes.ts       # API endpoints
└── storage.ts      # Data access layer

shared/
└── schema.ts       # Database schema and types
```

## API Endpoints

- `GET /api/companies` - List all companies
- `GET /api/companies/:id` - Get company with contacts and notes
- `POST /api/companies` - Create company
- `PATCH /api/companies/:id` - Update company
- `DELETE /api/companies/:id` - Delete company
- `POST /api/companies/:id/contacts` - Add contact
- `DELETE /api/contacts/:id` - Delete contact
- `POST /api/companies/:id/notes` - Add call note
- `DELETE /api/notes/:id` - Delete call note
- `GET /api/pipeline-stages` - List pipeline stages

## Running the Application

The application starts automatically with `npm run dev` which runs both frontend and backend on port 5000.

## Database

Uses PostgreSQL with Drizzle ORM. Schema is defined in `shared/schema.ts` and pushed with `npm run db:push`.

## Recent Changes

- Initial implementation with all core CRM features
- PostgreSQL database with seed data
- Dark/light theme support
