# TrainIt

A web app for marine animal training teams. Track the animals in your facility, write step-by-step training plans, and log each training session as it happens.

## What it does

- **Organizations and roles:** every account belongs to one organization, and each organization only sees its own data. See [Roles](#roles).
- **Animals:** name, species, sex, birth date (age is calculated and goes up on the birthday), and location. Animals are grouped by location.
- **Training plans:** a plan has a cue, success criteria, a category, and ordered steps with an estimated number of sessions each. Steps can be named, and you can edit a plan, add or delete steps, mark a step complete or reopen it, and delete the plan.
- **Session log:** log a session against a step with a date, a time, and a note. Sessions on the same day sort by time.
- **Two views of a plan:** a status table (each step shows Not started, In progress or Complete, with progress and an expandable session log) and a calendar timeline showing when sessions happened.
- **Profiles:** first and last name, department, bio, and changing your own email and password.
- **Light and dark themes:** the picker is in the sidebar and defaults to your system setting.

## Roles

| | Trainer | Supervisor | Curator |
|---|:-:|:-:|:-:|
| View animals and plans | yes | yes | yes |
| Create plans, add sessions, mark steps complete | yes | yes | yes |
| Edit or delete a plan and its steps and sessions | own plans only | any plan | any plan |
| Add, edit, delete animals | | yes | yes |
| Approve or reject join requests | | yes | yes |
| Give the curator role, change members' roles | | | yes |
| Remove a member, or restore one | | | yes |

Signing up with a new organization name creates the organization and makes you its curator. Signing up with an existing name creates a pending request that a supervisor or curator has to approve. An organization always keeps at least one curator.

Removing a member ends their access immediately but keeps everything they created, including the "Created by" name on their plans. A curator can restore them later. An animal that still has training plans can't be deleted until its plans are.

## Tech stack

- **Backend:** FastAPI, SQLAlchemy, Pydantic. SQLite locally, PostgreSQL in production.
- **Auth:** JWT bearer tokens, bcrypt password hashing.
- **Frontend:** React 19, TypeScript, Vite, React Router. Plain CSS with design tokens; no component library.
- **Hosting:** Render (see `render.yaml`).

## Running it locally

You need Python 3.12 and Node 20.19 or newer (Node 22 works well).

1. Install dependencies once:

   ```bash
   pip install -r backend/requirements.txt
   cd frontend && npm install
   ```

2. Start the backend from the repository root. Using a separate database file keeps your test data out of the tracked files:

   ```powershell
   $env:DATABASE_URL = "sqlite:///./local.db"
   python run_backend.py
   ```

   The API is at http://localhost:8000 and interactive docs at http://localhost:8000/docs.

3. Start the frontend in a second terminal:

   ```bash
   cd frontend
   npm run dev
   ```

   Open http://localhost:5173. In development the frontend talks to http://localhost:8000 automatically.

On Windows, `start_app.bat` does steps 2 and 3 for you.

The first account you create becomes a curator. To try the approval flow, sign up again from a private window using the same organization name.

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `SECRET_KEY` | backend | Signs login tokens. **Required whenever the database is not local SQLite**; the app refuses to start without it. Locally, a clearly labeled development key is used. |
| `DATABASE_URL` | backend | Database connection. Defaults to `sqlite:///./app.db`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | backend | How long a login lasts. Defaults to 480 (8 hours). |
| `VITE_API_URL` | frontend build | Base URL of the API. Set by `render.yaml` and `frontend/.env.production` for deployed builds. |

## Deploying to Render

`render.yaml` defines the backend web service, the PostgreSQL database, and the frontend static site. Render generates `SECRET_KEY` for you the first time.

Tables and new columns are created automatically when the backend starts, through `run_migrations()` in `backend/app/database.py`. There is no separate migration tool, so back up the database before deploying a version that changes the schema.

## Project layout

```
backend/app/
  main.py         app setup, CORS, routers
  models.py       database tables and role constants
  schemas.py      request and response shapes, input validation
  crud.py         all database operations and permission checks
  auth_utils.py   tokens and the login and role dependencies
  database.py     connection and startup migrations
  routes/         auth, animals, plans, plan_steps, team
frontend/src/
  App.tsx         pages and components
  App.css         component styles
  index.css       colors, spacing and other design tokens (light and dark)
  theme.ts        light / dark / system preference
run_backend.py    starts the backend with auto-reload
start_app.bat     starts backend and frontend together on Windows
render.yaml       Render deployment
```

## API overview

Everything except signup and login needs an `Authorization: Bearer <token>` header. Interactive documentation is at `/docs` on a running backend.

- `POST /auth/signup`, `POST /auth/login`
- `GET /auth/me`, `PUT /auth/me`, `PUT /auth/me/email`, `PUT /auth/me/password`
- `GET /team/members`, `GET /team/requests`, `POST /team/requests/{id}/approve`, `DELETE /team/requests/{id}`, `PUT /team/members/{id}/role`
- `DELETE /team/members/{id}`, `GET /team/removed`, `POST /team/members/{id}/restore`
- `GET`, `POST`, `PUT`, `DELETE` on `/animals/`
- `POST /plans/animal/{id}`, `GET /plans/animal/{id}`, and `GET`, `PUT`, `DELETE` on `/plans/{id}`; `POST /plans/{id}/steps`
- `PUT`, `DELETE` on `/steps/{id}`; `POST /steps/{id}/complete`; `GET`, `POST` on `/steps/{id}/notes`; `PUT`, `DELETE` on `/steps/notes/{id}`

## Security notes

- Passwords must be 8 to 72 bytes. Emails and organization names are matched without regard to case.
- Changing your password logs out every other device.
- Changing an animal, plan, step or session outside your organization returns a 404, and plan edits by someone who is not the creator (or a supervisor or curator) return a 403.
- CORS only allows the deployed frontend origins and localhost. Update `allow_origins` in `backend/app/main.py` if you add a domain.
