# Probation Progress Review — Workflow App

Converts the static form UI into a multi-step, role-based workflow: Admin creates a
form instance and assigns a user to each of the four roles; the form then moves
sequentially — HR Division → Employee → Supervisor → SBU HR — like a digital baton.

## Architecture

```
Azure Entra ID (SSO) ──▶ React (MSAL) ──▶ FastAPI (JWT-verified) ──▶ PostgreSQL
```

- **Auth**: Frontend uses `@azure/msal-react` to sign in with the company's Azure
  Entra ID tenant and obtain an access token. Every API call sends that token as a
  Bearer header. The backend verifies the token's signature against Azure's JWKS
  endpoint (no shared secret needed) and reads `email`/`oid` claims to identify the
  user — it never re-implements login itself.
- **Roles are global, per-user** (`admin`, `hr_division`, `employee`, `supervisor`,
  `sbu_hr`), managed by an Admin. A user's role decides what they're eligible to be
  assigned as on any given form instance.
- **Form instance ≠ role**. `form_assignments` maps *this specific form* to *this
  specific person* per role, so the same person can be "Employee" on one form and
  "Supervisor" on another.
- **One JSON blob + section rows**. `form_instances.data` holds every field value
  (mirrors the flat `form` state object the React component already used).
  `form_sections` tracks status/owner/timestamp per section — this is what drives
  the baton logic and the dashboard.

## Data model

```
users
  id (uuid, pk)
  email (unique)
  display_name
  azure_oid (unique, nullable)      -- populated on first login
  role (enum, nullable)             -- null until Admin assigns one
  created_at

form_instances
  id (uuid, pk)
  created_by (fk users.id)
  status (enum: in_progress | completed | cancelled)
  current_step (enum: hr_division | employee | supervisor | sbu_hr | done)
  data (jsonb)                      -- all field values, flat
  created_at, updated_at

form_assignments
  id (pk)
  form_instance_id (fk)
  role (enum: hr_division | employee | supervisor | sbu_hr)
  user_id (fk users.id)
  unique(form_instance_id, role)

form_sections
  id (pk)
  form_instance_id (fk)
  section_key (enum: hr_division | employee | supervisor | sbu_hr)
  status (enum: not_started | in_progress | completed)
  completed_by (fk users.id, nullable)
  completed_at (nullable)
  unique(form_instance_id, section_key)
```

## Baton logic (enforced server-side, not just in the UI)

1. A section is editable only if: the requester is `admin`, **or** the requester is
   the user assigned to that section's role **and** `form_instances.current_step`
   equals that section.
2. Saving with `submit=false` writes a draft into `data` without changing status.
3. Saving with `submit=true` marks that `form_sections` row `completed`, merges the
   data, and advances `current_step` to the next role in the fixed order
   `hr_division → employee → supervisor → sbu_hr → done`. Reaching `done` sets
   `form_instances.status = completed`.
4. Every other section is always readable by every assigned user (and Admin) —
   `GET /forms/{id}` returns the whole `data` blob regardless of role, the frontend
   just disables inputs outside the caller's editable section.

## Repo layout

```
backend/
  app/
    main.py            FastAPI app, CORS, router registration
    database.py         SQLAlchemy engine/session
    models.py            ORM models + enums
    schemas.py            Pydantic request/response models
    auth.py                 Azure AD token verification + role dependencies
    routers/
      auth.py                GET /me
      admin.py                 Admin dashboard + form creation + role assignment
      forms.py                   Per-user dashboard + section save (the baton)
  requirements.txt

frontend/
  src/
    auth/
      msalConfig.js        MSAL client config (fill in tenant/client IDs)
      AuthContext.jsx        Wraps MSAL, exposes {user, role, token}
      ProtectedRoute.jsx        Route guard, optional role allow-list
    api/client.js               Axios instance with auth header injection
    pages/
      Login.jsx
      Dashboard.jsx               "My forms"
      AdminDashboard.jsx            Create form, assign users, manage roles
      FormPage.jsx                    Fetches one instance, drives the form
    components/
      ProbationProgressReview.jsx       Now prop-driven, not self-contained
      ProbationProgressReview.css
    App.jsx
```

## Before this runs

- **Azure App Registration**: register the SPA (redirect URI) and the API
  (expose an API scope, e.g. `api://<api-client-id>/access_as_user`). Fill in
  `frontend/src/auth/msalConfig.js` and `backend/app/auth.py` (`TENANT_ID`,
  `API_CLIENT_ID`).
- **Database**: run the FastAPI app once against a real Postgres instance — it
  creates tables via `Base.metadata.create_all` for convenience, but production
  should use Alembic migrations instead (not included here).
- **New users have `role = null`** until an Admin assigns one via the Admin
  Dashboard's "Manage Users" table — that's how you seed your first Admin too
  (seed it directly in the DB once, then manage everyone else from the UI).
- **CORS** origin in `main.py` needs to match wherever the frontend is hosted
  (Azure App Service / static web app URL).

This is a working scaffold, not a hardened production build — error handling,
input validation depth, rate limiting, and audit logging are intentionally kept
minimal so the architecture stays readable. Flagged with `# TODO` where you'll
want to harden before go-live.
