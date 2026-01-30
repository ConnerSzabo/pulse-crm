# Wave Systems CRM

A customized CRM application for Wave Systems, an IT hardware reselling business. Manages schools/companies, contacts, comprehensive activity tracking, and sales pipeline.

## Overview

This is a full-stack application built with:
- **Frontend**: React with TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: TanStack React Query

## Features

1. **Dashboard** (Home Page)
   - Business intelligence widgets: Pipeline Value, GP This Month, Calls Today, Deals Needing Follow-up
   - Task widgets: Tasks Due Today, Overdue Tasks, Next 5 Upcoming Tasks
   - Searchable table of all schools
   - Filters: Location, Pipeline Stage, Academy Trust, Has IT Manager
   - Sortable columns: School Name, Location, Academy Trust, Stage, Last Contact, Next Action

2. **Schools Management**
   - Card-based view of all schools with location and phone
   - Add new schools with full details
   - Delete schools

3. **School Detail View** (HubSpot-style layout)
   - Top banner with school name, location, phone, website link
   - Left column: Contacts section, Next Action input, Tasks
   - Right column: Deal Information card, Activity Timeline
   - Stage selector dropdown
   - Deal Information: Budget Status, Decision Timeline, Decision Maker, Trade-in Interest, Last Quote, Total GP, Buyer Honesty Score, Next Budget Cycle

4. **Activity Tracking**
   - Multi-type activity logging: Call, Email, Quote, Follow-up, Deal Won, Deal Lost
   - Call/Email outcomes: Answered, Voicemail, No Answer, Busy, Wrong Number, Sent, Replied
   - Quote value tracking
   - Gross profit recording for won/lost deals
   - Activity notes
   - Timeline view with color-coded activity types

5. **Pipeline Management**
   - Visual kanban-style board
   - Drag schools between stages
   - **Wave Systems Stages**: Future Pipeline, Quote Presented, Decision Maker Brought In, Awaiting Order, Closed Won, Closed Lost, Recycled
   - Cards show school name, location, last contact date, next action

6. **Task Management**
   - Tasks with due dates and priorities (High, Medium, Low)
   - Task types: General, Follow-up Quote, Check Budget
   - Status: Todo, In Progress, Completed

7. **CSV Import**
   - Upload CSV files with school data
   - Preview data before importing
   - Optionally assign to a pipeline stage during import
   - Auto-creates IT Manager as first contact

## Project Structure

```
client/src/
├── components/
│   ├── ui/           # shadcn/ui components
│   ├── app-sidebar.tsx
│   └── theme-toggle.tsx
├── pages/
│   ├── dashboard.tsx     # Dashboard with BI widgets
│   ├── companies.tsx     # Schools list (card view)
│   ├── company-detail.tsx # School detail with activities
│   ├── pipeline.tsx      # Pipeline board
│   ├── tasks.tsx         # Task management
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

- `/` - Dashboard (home page with BI widgets)
- `/companies` - Schools list (card view)
- `/company/:id` - School detail page
- `/pipeline` - Pipeline kanban board
- `/tasks` - Task management
- `/import` - CSV import

## API Endpoints

### Companies
- `GET /api/companies` - List all companies (with stage data)
- `GET /api/companies/:id` - Get company with contacts, activities, and notes
- `POST /api/companies` - Create company
- `PATCH /api/companies/:id` - Update company
- `DELETE /api/companies/:id` - Delete company

### Contacts
- `POST /api/companies/:id/contacts` - Add contact
- `DELETE /api/contacts/:id` - Delete contact

### Activities
- `POST /api/companies/:id/activities` - Log activity (auto-updates lastContactDate, lastQuoteDate, grossProfit)
- `DELETE /api/activities/:id` - Delete activity

### Legacy Call Notes
- `POST /api/companies/:id/notes` - Add call note
- `DELETE /api/notes/:id` - Delete call note

### Tasks
- `GET /api/tasks` - List all tasks
- `GET /api/tasks/due-today` - Tasks due today
- `GET /api/tasks/overdue` - Overdue tasks
- `POST /api/companies/:companyId/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Dashboard Statistics
- `GET /api/dashboard/pipeline-value` - Total pipeline value (sum of active quotes)
- `GET /api/dashboard/gp-this-month` - Gross profit from won deals this month
- `GET /api/dashboard/deals-needing-followup` - Companies quoted 3+ days ago without contact
- `GET /api/stats/today` - Daily stats (calls made)
- `POST /api/stats/increment-calls` - Increment call counter

### Pipeline
- `GET /api/pipeline-stages` - List pipeline stages

## Database Schema

**Companies**: id, name, website, phone, location, academyTrustName, ext, notes, itManagerName, itManagerEmail, stageId, lastContactDate, nextAction, budgetStatus, decisionTimeline, decisionMakerName, decisionMakerRole, lastQuoteDate, lastQuoteValue, grossProfit, tradeInInterest, buyerHonestyScore, nextBudgetCycle, createdAt

**Contacts**: id, companyId, name, email, role, phone

**Activities**: id, companyId, type (call/email/quote/follow_up/deal_won/deal_lost), note, outcome, quoteValue, grossProfit, loggedBy, createdAt

**Call Notes** (legacy): id, companyId, note, loggedBy, createdAt

**Tasks**: id, companyId, name, dueDate, priority, status, taskType (general/follow_up_quote/check_budget), createdAt

**Daily Stats**: id, date, callsMade

**Pipeline Stages**: id, name, order, color

## Running the Application

The application starts automatically with `npm run dev` which runs both frontend and backend on port 5000.

## Database

Uses PostgreSQL with Drizzle ORM. Schema is defined in `shared/schema.ts` and pushed with `npm run db:push`.

## Authentication

The CRM uses a custom username/password authentication system:

- **Credentials**: Username `connerszabo` with bcrypt-hashed password
- **Session**: express-session with PostgreSQL store, 1-week duration
- **Protection**: All API endpoints require authentication except login/logout/auth-check

### Auth API Endpoints

- `POST /api/login` - Login with username/password
- `POST /api/logout` - Logout and destroy session
- `GET /api/auth/me` - Check current auth status

## Recent Changes

- Jan 30, 2026: Wave Systems customization
  - Renamed to Wave Systems CRM
  - Added business intelligence dashboard widgets (Pipeline Value, GP This Month, Calls Today, Deals Needing Follow-up)
  - New pipeline stages: Future Pipeline, Quote Presented, Decision Maker Brought In, Awaiting Order, Closed Won, Closed Lost, Recycled
  - Added company fields: budgetStatus, decisionTimeline, decisionMakerName, decisionMakerRole, lastQuoteDate, lastQuoteValue, grossProfit, tradeInInterest, buyerHonestyScore, nextBudgetCycle
  - Comprehensive activity tracking system with multiple types (Call, Email, Quote, Follow-up, Deal Won, Deal Lost)
  - Activities auto-update company fields (lastContactDate for calls/emails, lastQuoteDate/Value for quotes, grossProfit for deals)
  - Task types support: General, Follow-up Quote, Check Budget
  - Daily stats tracking for calls made
  - Deal Information card on company detail page

- Jan 30, 2026: Added authentication system
  - Custom username/password login with bcrypt password hashing
  - Session-based authentication with PostgreSQL session store

- Jan 30, 2026: Major HubSpot-style redesign
  - Dashboard with searchable/filterable table
  - Company detail with contacts section and activity timeline
  - Pipeline kanban board
  - CSV import with duplicate detection
