# V0 Build Prompts for Re-New Platform

Use these prompts sequentially in V0 (v0.dev) to build the core application.

---

## Prompt 1: Project Setup + Auth

```
Create a Next.js app with Supabase integration for an internal CRM called "Re-New Platform".

Setup:
- Supabase for database and authentication
- Email/password auth (no self-registration, users created manually in Supabase)
- Protected routes - redirect to login if not authenticated
- Clean sidebar navigation with: Dashboard, Repreneurs, Pipeline, Offers
- Use shadcn/ui components and Tailwind

After login, show a simple dashboard placeholder. The app is for 3 internal team members managing "repreneurs" (entrepreneurs looking to acquire businesses).
```

---

## Prompt 2: Database Schema

```
Add the database schema for Re-New Platform.

Tables needed:

1. repreneurs
- id (uuid, primary key)
- email (unique, required)
- first_name (required)
- last_name (required)
- phone
- company_background (text)
- investment_capacity (text)
- sector_preferences (text array)
- target_location (text)
- target_acquisition_size (text)
- lifecycle_status (enum: 'lead', 'qualified', 'client')
- source (text)
- created_at, updated_at
- created_by (references auth.users)

2. offers
- id, name, description, price (number)
- duration_days, acceptance_deadline_days
- includes_hours (number), includes_resources (boolean)
- is_active (boolean), created_at

3. repreneur_offers (junction table)
- id, repreneur_id, offer_id
- status (enum: 'offered', 'accepted', 'active', 'completed', 'expired')
- offered_at, accepted_at, expires_at
- created_by

4. notes
- id, repreneur_id, content (text)
- created_at, created_by

Generate the SQL and set up Row Level Security so authenticated users can CRUD all data.
```

---

## Prompt 3: Repreneur List + Detail Views

```
Build the Repreneurs section:

1. List View (/repreneurs)
- Table showing: Name, Email, Status (Lead/Qualified/Client), Created Date
- Search bar to filter by name or email
- Filter dropdown for lifecycle_status
- Sortable columns
- Click row to go to detail page
- "Add Repreneur" button top right

2. Detail View (/repreneurs/[id])
- Show all repreneur fields in a clean card layout
- Editable fields (inline edit or edit mode)
- Lifecycle status dropdown to change status
- Notes section at bottom:
  - List of notes (newest first) showing content, author name, timestamp
  - Text input to add new note
- Back button to list

3. Add/Edit Form
- Form with all fields, email/first_name/last_name required
- Default lifecycle_status to 'lead' for new repreneurs
- After save, redirect to detail view

Wire everything to Supabase. Track created_by using the logged-in user.
```

---

## Prompt 4: Kanban Pipeline + Dashboard

```
Add Pipeline and Dashboard views:

1. Pipeline View (/pipeline)
- Kanban board with 3 columns: Lead | Qualified | Client
- Cards show: repreneur name, email, created date
- Drag and drop cards between columns to change lifecycle_status
- Click card to open repreneur detail page
- Show count of repreneurs in each column header

2. Dashboard (/)
- Stats cards showing:
  - Total repreneurs
  - Count per status (Lead, Qualified, Client)
- Recent activity: last 5 notes added (showing repreneur name, note snippet, author, time)
- Quick links to Pipeline and Repreneurs list

Use react-beautiful-dnd or similar for drag-drop. Update Supabase on drop.
```

---

## After V0

Once the core app is built in V0:
1. Export to GitHub
2. Clone locally
3. Use Claude Code for:
   - Offer management features
   - Flatchr data import script
   - Bug fixes and polish
   - Deployment to Vercel
