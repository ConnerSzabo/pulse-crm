# School CRM

A HubSpot-style CRM application for managing schools/companies, contacts, call notes, and sales pipeline.

## Overview

This is a full-stack application built with:
- **Frontend**: React with TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: TanStack React Query

## Features

1. **Dashboard** (Home Page)
   - Searchable table of all schools
   - Filters: Location, Pipeline Stage, Academy Trust, Has IT Manager
   - Sortable columns: School Name, Location, Academy Trust, Stage, Last Contact, Next Action
   - Click any row to view school details

2. **Schools Management**
   - Card-based view of all schools with location and phone
   - Add new schools with full details (name, website, phone, location, academy trust, IT manager info, notes)
   - Delete schools

3. **School Detail View** (HubSpot-style layout)
   - Top banner with large school name, location, phone, website link
   - Left column: Contacts section with add contact form, Next Action input
   - Right column: Activity Timeline with call notes
   - Stage selector dropdown

4. **Pipeline Management**
   - Visual kanban-style board
   - Drag schools between stages
   - Stages: Not Contacted, Contacted, Follow-Up Scheduled, Proposal Sent, Closed Won, Closed Lost
   - Cards show school name, location, last contact date, next action

5. **CSV Import**
   - Upload CSV files with school data
   - Preview data before importing
   - Optionally assign to a pipeline stage during import
   - Supports both comma-delimited and tab-delimited files
   - Auto-creates IT Manager as first contact when importing
   - Maps columns: EstablishmentName, SchoolWebsite, SchoolPhoneNumber, Location, AcademyTrustName, Ext, Notes, IT Manager Name, IT Manager Email

## Project Structure

```
client/src/
├── components/
│   ├── ui/           # shadcn/ui components
│   ├── app-sidebar.tsx
│   └── theme-toggle.tsx
├── pages/
│   ├── dashboard.tsx     # Dashboard with searchable table (home page)
│   ├── companies.tsx     # Schools list (card view)
│   ├── company-detail.tsx # School detail with contacts & activity
│   ├── pipeline.tsx      # Pipeline board
│   └── import-csv.tsx    # CSV import
└── App.tsx

server/
├── db.ts           # Database connection
├── routes.ts       # API endpoints
└── storage.ts      # Data access layer

shared/
└── schema.ts       # Database schema and types
```

## Routes

- `/` - Dashboard (home page with searchable table)
- `/companies` - Schools list (card view)
- `/company/:id` - School detail page
- `/pipeline` - Pipeline kanban board
- `/import` - CSV import

## API Endpoints

- `GET /api/companies` - List all companies (with stage data)
- `GET /api/companies/:id` - Get company with contacts and notes
- `POST /api/companies` - Create company
- `PATCH /api/companies/:id` - Update company (including lastContactDate, nextAction)
- `DELETE /api/companies/:id` - Delete company
- `POST /api/companies/:id/contacts` - Add contact
- `DELETE /api/contacts/:id` - Delete contact
- `POST /api/companies/:id/notes` - Add call note (auto-updates lastContactDate)
- `DELETE /api/notes/:id` - Delete call note
- `GET /api/pipeline-stages` - List pipeline stages

## Database Schema

**Companies**: id, name, website, phone, location, academyTrustName, ext, notes, itManagerName, itManagerEmail, stageId, lastContactDate, nextAction, createdAt

**Contacts**: id, companyId, name, email, role, phone

**Call Notes**: id, companyId, note, loggedBy, createdAt

**Pipeline Stages**: id, name, order, color

## Running the Application

The application starts automatically with `npm run dev` which runs both frontend and backend on port 5000.

## Database

Uses PostgreSQL with Drizzle ORM. Schema is defined in `shared/schema.ts` and pushed with `npm run db:push`.

## Recent Changes

- Jan 30, 2026: Major HubSpot-style redesign
  - New Dashboard page with searchable/filterable table
  - Redesigned company detail with contacts section and activity timeline
  - Updated pipeline stages to: Not Contacted, Contacted, Follow-Up Scheduled, Proposal Sent, Closed Won, Closed Lost
  - Enhanced pipeline cards with location, last contact date, next action
  - CSV import auto-creates IT Manager as first contact
  - Added lastContactDate and nextAction fields to companies
  - Added phone field to contacts
