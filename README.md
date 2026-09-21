# TrainIt

A web app for marine animal training teams. Track the animals in your facility, write step-by-step training plans, and log each training session as it happens.

## What it does

- **Organizations and roles:** every account belongs to one organization, and each organization only sees its own data. See [Roles](#roles).
- **Animals:** name, species, sex, birth date (age is calculated and goes up on the birthday), and location. Animals are grouped by location.
- **Locations and species lists:** each organization keeps its own lists, and animals are picked from them, so one place can't turn into several spellings. See [Locations and species](#locations-and-species).
- **Training plans:** a plan has a cue, success criteria, a category, and ordered steps, each with an optional estimate of how many sessions it will take. Without an estimate a step just counts its sessions, and only steps with one feed the plan's overall percentage. Steps can be named, and you can edit a plan, add or delete steps, mark a step complete or reopen it, and delete the plan.
- **Session log:** log a session against a step with a date, a time, and a note. Sessions on the same day sort by time.
- **Step comments:** supervisors and curators can leave feedback on any step of any plan, including plans they didn't create. Comments are on the step, not on individual sessions. Everyone in the organization can read them, and a step with comments shows a count in the plan list.
- **Two views of a plan:** a status table (each step shows Not started, In progress or Complete, with progress and an expandable session log) and a calendar timeline showing when sessions happened.
- **Profiles:** first and last name, department, bio, and changing your own email and password.
- **Light and dark themes:** the picker is in the sidebar and defaults to your system setting.

## Roles

| | Trainer | Supervisor | Curator |
|---|:-:|:-:|:-:|
| View animals and plans | yes | yes | yes |
| Create plans, add sessions, mark steps complete | yes | yes | yes |
| Edit or delete a plan and its steps and sessions | own plans only | any plan | any plan |
| Read comments on a plan's steps | yes | yes | yes |
| Comment on any plan's steps | | yes | yes |
| Add, edit, delete animals | | yes | yes |
| Manage the locations and species lists | | yes | yes |
| Approve or reject join requests | | yes | yes |
| Give the curator role, change members' roles | | | yes |
| Remove a member, or restore one | | | yes |

Signing up with a new organization name creates the organization and makes you its curator. Signing up with an existing name creates a pending request that a supervisor or curator has to approve. An organization always keeps at least one curator.

Comments belong to whoever wrote them: only the author edits a comment, and the author or any curator can delete it. A trainer, even the plan's own creator, reads comments but doesn't write them. A supervisor who is later made a trainer keeps their old comments but can no longer add or change any.

Removing a member ends their access immediately but keeps everything they created, including the "Created by" name on their plans. A curator can restore them later. An animal that still has training plans can't be deleted until its plans are.

## Locations and species

Supervisors and curators manage these under **Locations & species** in the sidebar. Everyone in the organization can pick from them, and the animal form offers nothing else. The API enforces this too, so a typo can't get in some other way.

- A new organization starts with a standard list of marine species and no locations. Remove the species you don't use, add your own, or use the one-click buttons to bring back a standard one you removed.
- Names are compared without regard to case or extra spaces, so "lagoon a" is the same location as "Lagoon A".
- **Rename** changes the name on every animal that uses it.
- **Delete** an unused entry straight away. If animals use it, you choose where they go first: another entry, or (for locations) no location. Deleting one and moving its animals into the other is how you merge two spellings of the same place.
- An animal's location is optional; its species is required.

Organizations that existed before these lists were built their lists automatically the first time the backend started: every species and location already on an animal was added, and spellings that differed only by case or spacing were merged into the most common one. Genuine typos (say "Lagon A") show up as separate entries with their animal counts, so you can merge them.

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

## Admin tool

`backend/admin.py` is a command-line tool for fixing accounts and helping customers. It runs on your own computer against the database directly. There is deliberately no admin login inside the web app, and no way to sign in as someone else.

**Connecting to production.** In the Render dashboard, open the database and copy its **External Database URL**. That URL contains the database password, so treat it like one: paste it into your terminal only, never into the repository, a chat, a ticket or a screenshot. Set it for the current terminal window only:

```powershell
$env:DATABASE_URL = "postgresql://..."     # the External Database URL
python -m backend.admin orgs
```

Closing the terminal forgets it. The tool refuses to run if `DATABASE_URL` is unset, and prints the database it is connected to (password hidden) before doing anything, so check that line before a change. Use `sqlite:///./local.db` to practice on a local database first.

| Command | What it does |
|---|---|
| `find <text>` | Search by email, name or organization |
| `orgs` | List organizations; flags any with no curator |
| `org <name>` | One organization and all its members |
| `user <email>` | One account and how much it has created |
| `pending` | Join requests waiting for approval, in every organization |
| `audit [--limit N]` | The most recent admin changes |
| `set-password <email>` | Random temporary password, and signs out their devices |
| `set-role <email> <trainer\|supervisor\|curator>` | Change an active member's role |
| `approve <email> [--role ...]` / `reject <email>` | Settle a stuck join request |
| `remove <email>` / `restore <email>` | End or give back access; their work is kept |
| `change-email <email> <new email>` | Fix a mistyped email |
| `rename-org <name> <new name>` | Fix an organization's name |
| `delete-user <email>` | Delete an account that has created nothing |

Safe habits:

- Look first (`user`, `org`), then change. Every change shows what it will do and waits for you to type `yes`. `--yes` skips that; leave it off when working on production.
- Confirm who is asking before `set-password`, and send the temporary password privately. Ask them to change it under Profile. It is shown once and stored nowhere else.
- Prefer `remove` to `delete-user`. Deleting is refused for anyone who has created animals, plans or sessions, and for an organization's only curator. To hand an organization to someone else, `set-role` them to curator first.
- Every change is written to the `admin_audit_log` table (time, your computer username, the account, and what changed) in the same transaction as the change. Passwords are never logged. Read it with `audit`.
- Back up before anything unusual. The tool changes live data with no undo.

## Project layout

```
backend/app/
  main.py         app setup, CORS, routers
  models.py       database tables and role constants
  schemas.py      request and response shapes, input validation
  crud.py         all database operations and permission checks
  auth_utils.py   tokens and the login and role dependencies
  database.py     connection and startup migrations
  routes/         auth, animals, options, plans, plan_steps, team
backend/admin.py  support tool run from your own computer (see Admin tool)
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
- `GET`, `POST` on `/options/locations` and `/options/species`; `PUT`, `DELETE` on `/options/{locations|species}/{id}` (`DELETE` takes `?move_to=<id>` or, for locations, `?unassign=true`); `GET /options/species/suggestions`
- `POST /plans/animal/{id}`, `GET /plans/animal/{id}`, and `GET`, `PUT`, `DELETE` on `/plans/{id}`; `POST /plans/{id}/steps`
- `PUT`, `DELETE` on `/steps/{id}`; `POST /steps/{id}/complete`; `GET`, `POST` on `/steps/{id}/notes`; `PUT`, `DELETE` on `/steps/notes/{id}`; `GET`, `POST` on `/steps/{id}/comments`; `PUT`, `DELETE` on `/steps/comments/{id}`

## Security notes

- Passwords must be 8 to 72 bytes. Emails and organization names are matched without regard to case.
- Changing your password logs out every other device.
- Changing an animal, plan, step or session outside your organization returns a 404, and plan edits by someone who is not the creator (or a supervisor or curator) return a 403.
- CORS only allows the deployed frontend origins and localhost. Update `allow_origins` in `backend/app/main.py` if you add a domain.
