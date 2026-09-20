"""Support tool for TrainIt accounts. Run it from your own computer, never from the web app.

    python -m backend.admin --help

It connects to whatever database DATABASE_URL points at (for production, the external
connection URL from the Render dashboard) and makes every change through the same tables
the app uses. Each change is written to the admin_audit_log table in the same transaction,
so a change and its log entry either both happen or neither does. Passwords are never logged.
"""
import argparse
import getpass
import os
import secrets
import sys

# The database URL is read when the app's database module is imported, so check it first.
# Render's dashboard hands out "postgres://" URLs, which SQLAlchemy 2 rejects.
_database_url = os.environ.get("DATABASE_URL", "").strip()
if not _database_url:
    sys.exit(
        "DATABASE_URL is not set. Set it to the database you mean to change, for example:\n"
        '  PowerShell:  $env:DATABASE_URL = "postgresql://..."\n'
        '  local test:  $env:DATABASE_URL = "sqlite:///./local.db"'
    )
if _database_url.startswith("postgres://"):
    _database_url = "postgresql://" + _database_url[len("postgres://"):]
os.environ["DATABASE_URL"] = _database_url

from datetime import datetime  # noqa: E402
from sqlalchemy import Column, DateTime, Integer, String, Text, func  # noqa: E402
from backend.app import crud, models, schemas  # noqa: E402
from backend.app.database import Base, SessionLocal, engine  # noqa: E402


class AuditLog(Base):
    """Kept in this file, not models.py, so the web app never creates or touches it."""
    __tablename__ = "admin_audit_log"
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    operator = Column(String, nullable=False)  # The operating-system user who ran the tool
    action = Column(String, nullable=False)
    target_email = Column(String, nullable=True)
    organization = Column(String, nullable=True)
    details = Column(Text, nullable=True)


# No foreign keys on purpose: an entry has to outlive the account it describes
class Fail(Exception):
    """A problem to report to the operator without a traceback."""


PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # No 0/O, 1/l/I


def record(db, action, user=None, organization=None, details=None, email=None):
    org_name = organization.name if organization else (user.organization.name if user else None)
    db.add(AuditLog(
        operator=getpass.getuser(),
        action=action,
        target_email=email or (user.email if user else None),
        organization=org_name,
        details=details,
    ))


def confirm(summary, skip):
    print(summary)
    if skip:
        return
    try:
        answer = input("Type yes to continue: ")
    except EOFError:
        answer = ""
    if answer.strip().lower() != "yes":
        raise Fail("Cancelled. Nothing was changed.")


def find_user(db, email):
    user = crud.get_user_by_email(db, email)
    if not user:
        raise Fail(f"No account with the email {email!r}. Try: find {email.split('@')[0]}")
    return user


def find_org(db, name):
    organization = crud.get_organization_by_name(db, name)
    if not organization:
        raise Fail(f"No organization named {name!r}. Try: orgs")
    return organization


def active_curators(db, organization_id):
    return db.query(models.User).filter(
        models.User.organization_id == organization_id,
        models.User.status == models.STATUS_ACTIVE,
        models.User.role == models.ROLE_CURATOR,
    ).all()


def is_last_curator(db, user):
    curators = active_curators(db, user.organization_id)
    return user.status == models.STATUS_ACTIVE and user.role == models.ROLE_CURATOR and len(curators) <= 1


def full_name(user):
    return " ".join(part for part in (user.first_name, user.last_name) if part) or "(no name)"


def describe(user):
    return f"{user.email} ({full_name(user)}), {user.role}/{user.status}, {user.organization.name}"


def print_table(rows, headers):
    widths = [max(len(str(row[i])) for row in [headers] + rows) for i in range(len(headers))]
    for row in [headers] + rows:
        print("  ".join(str(cell).ljust(widths[i]) for i, cell in enumerate(row)).rstrip())


def member_rows(users):
    order = {models.STATUS_PENDING: 0, models.STATUS_ACTIVE: 1, models.STATUS_REMOVED: 2}
    users = sorted(users, key=lambda u: (order.get(u.status, 9), u.email))
    return [[u.id, u.email, full_name(u), u.role, u.status] for u in users]


# ---- Looking things up (these never change anything) ----

def cmd_find(db, args):
    like = f"%{args.text.strip().lower()}%"
    users = db.query(models.User).join(models.Organization).filter(
        func.lower(models.User.email).like(like)
        | func.lower(func.coalesce(models.User.first_name, "")).like(like)
        | func.lower(func.coalesce(models.User.last_name, "")).like(like)
        | func.lower(models.Organization.name).like(like)
    ).order_by(models.User.email).all()
    if not users:
        print("No matches.")
        return
    print_table([[u.id, u.email, full_name(u), u.organization.name, u.role, u.status] for u in users],
                ["id", "email", "name", "organization", "role", "status"])


def cmd_orgs(db, args):
    rows = []
    for organization in db.query(models.Organization).order_by(models.Organization.name).all():
        counts = {status: 0 for status in (models.STATUS_ACTIVE, models.STATUS_PENDING, models.STATUS_REMOVED)}
        for member in organization.users:
            counts[member.status] = counts.get(member.status, 0) + 1
        curators = len(active_curators(db, organization.id))
        flag = "NO CURATOR" if curators == 0 and counts[models.STATUS_ACTIVE] + counts[models.STATUS_PENDING] > 0 else ""
        rows.append([organization.id, organization.name, counts["active"], counts["pending"], counts["removed"], curators, flag])
    if not rows:
        print("No organizations.")
        return
    print_table(rows, ["id", "organization", "active", "pending", "removed", "curators", ""])


def cmd_org(db, args):
    organization = find_org(db, args.name)
    print(f"{organization.name} (id {organization.id}), created {organization.created_at:%Y-%m-%d}")
    print(f"Animals: {len(organization.animals)}")
    print()
    if organization.users:
        print_table(member_rows(organization.users), ["id", "email", "name", "role", "status"])
    else:
        print("No members.")


def cmd_user(db, args):
    user = find_user(db, args.email)
    animals = db.query(models.Animal).filter(models.Animal.owner_id == user.id).count()
    plans = db.query(models.TrainingPlan).filter(models.TrainingPlan.created_by_id == user.id).count()
    logs = db.query(models.TimeLog).filter(models.TimeLog.user_id == user.id).count()
    print(f"id:            {user.id}")
    print(f"email:         {user.email}")
    print(f"name:          {full_name(user)}")
    print(f"department:    {user.department or '-'}")
    print(f"organization:  {user.organization.name} (id {user.organization_id})")
    print(f"role / status: {user.role} / {user.status}")
    print(f"created:       {animals} animals, {plans} plans, {logs} time logs")


def cmd_pending(db, args):
    users = db.query(models.User).join(models.Organization).filter(
        models.User.status == models.STATUS_PENDING
    ).order_by(models.Organization.name, models.User.email).all()
    if not users:
        print("No pending join requests.")
        return
    print_table([[u.id, u.email, full_name(u), u.organization.name] for u in users],
                ["id", "email", "name", "organization"])


def cmd_audit(db, args):
    entries = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(args.limit).all()
    if not entries:
        print("The audit log is empty.")
        return
    print_table([[e.created_at.strftime("%Y-%m-%d %H:%M:%S"), e.operator, e.action, e.target_email or "-",
                  e.organization or "-", e.details or ""] for e in reversed(entries)],
                ["when (UTC)", "operator", "action", "account", "organization", "details"])


# ---- Changing things ----

def cmd_set_password(db, args):
    user = find_user(db, args.email)
    confirm(f"Set a new temporary password for {describe(user)} and sign out all their devices.", args.yes)
    temporary = "".join(secrets.choice(PASSWORD_ALPHABET) for _ in range(14))
    schemas.check_password_rules(temporary)
    # The same steps as crud.update_password, without its commit, so the log entry lands in the same transaction
    user.hashed_password = crud.pwd_context.hash(temporary)
    user.token_version = (user.token_version or 0) + 1
    record(db, "set-password", user)
    db.commit()
    print(f"\nTemporary password for {user.email}:  {temporary}")
    print("Send it privately and ask them to change it under Profile after signing in. It is not stored anywhere else.")


def cmd_restore(db, args):
    user = find_user(db, args.email)
    if user.status != models.STATUS_REMOVED:
        raise Fail(f"{user.email} is {user.status}, not removed.")
    confirm(f"Restore {describe(user)} to active.", args.yes)
    user.status = models.STATUS_ACTIVE
    record(db, "restore", user)
    db.commit()
    print("Done. They can sign in again.")


def cmd_remove(db, args):
    user = find_user(db, args.email)
    if user.status != models.STATUS_ACTIVE:
        raise Fail(f"{user.email} is {user.status}; only active members can be removed.")
    if is_last_curator(db, user):
        raise Fail("That is the organization's only curator. Give someone else the curator role first (set-role).")
    confirm(f"Remove {describe(user)}. Their access ends now; everything they created is kept.", args.yes)
    user.status = models.STATUS_REMOVED
    user.token_version = (user.token_version or 0) + 1
    record(db, "remove", user)
    db.commit()
    print("Done.")


def cmd_set_role(db, args):
    user = find_user(db, args.email)
    if user.status != models.STATUS_ACTIVE:
        raise Fail(f"{user.email} is {user.status}. Use approve for pending requests or restore for removed members.")
    if user.role == args.role:
        raise Fail(f"{user.email} is already a {args.role}.")
    if args.role != models.ROLE_CURATOR and is_last_curator(db, user):
        raise Fail("That is the organization's only curator, and an organization must keep one. Promote someone else first.")
    confirm(f"Change the role of {describe(user)} to {args.role}.", args.yes)
    old_role = user.role
    user.role = args.role
    record(db, "set-role", user, details=f"{old_role} -> {args.role}")
    db.commit()
    print("Done.")


def cmd_approve(db, args):
    user = find_user(db, args.email)
    if user.status != models.STATUS_PENDING:
        raise Fail(f"{user.email} is {user.status}, not a pending request.")
    confirm(f"Approve {describe(user)} as a {args.role}.", args.yes)
    user.role = args.role
    user.status = models.STATUS_ACTIVE
    record(db, "approve", user, details=f"as {args.role}")
    db.commit()
    print("Done.")


def cmd_reject(db, args):
    user = find_user(db, args.email)
    if user.status != models.STATUS_PENDING:
        raise Fail(f"{user.email} is {user.status}, not a pending request.")
    confirm(f"Reject {describe(user)}. The pending account is deleted.", args.yes)
    record(db, "reject", user)
    db.delete(user)
    db.commit()
    print("Done.")


def cmd_change_email(db, args):
    user = find_user(db, args.email)
    try:
        new_email = crud.normalize_email(schemas.check_email_format(args.new_email))
    except ValueError as error:
        raise Fail(str(error))
    if new_email == user.email:
        raise Fail("That is already their email.")
    other = crud.get_user_by_email(db, new_email)
    if other and other.id != user.id:
        raise Fail(f"{new_email} already belongs to another account.")
    confirm(f"Change the email of {describe(user)} to {new_email}.", args.yes)
    old_email = user.email
    user.email = new_email
    # Login tokens are tied to the email, so the old ones stop working anyway; this makes it explicit
    user.token_version = (user.token_version or 0) + 1
    record(db, "change-email", user, details=f"{old_email} -> {new_email}", email=old_email)
    db.commit()
    print("Done. They sign in with the new email and their existing password.")


def cmd_rename_org(db, args):
    organization = find_org(db, args.name)
    new_name = crud.normalize_organization_name(args.new_name)
    if not new_name:
        raise Fail("The new name can't be empty.")
    other = crud.get_organization_by_name(db, new_name)
    if other and other.id != organization.id:
        raise Fail(f"An organization called {other.name!r} already exists.")
    if new_name == organization.name:
        raise Fail("That is already its name.")
    confirm(f"Rename organization {organization.name!r} to {new_name!r}.", args.yes)
    old_name = organization.name
    organization.name = new_name
    record(db, "rename-org", organization=organization, details=f"{old_name} -> {new_name}")
    db.commit()
    print("Done.")


def cmd_delete_user(db, args):
    user = find_user(db, args.email)
    owned = {
        "animals": db.query(models.Animal).filter(models.Animal.owner_id == user.id).count(),
        "plans": db.query(models.TrainingPlan).filter(models.TrainingPlan.created_by_id == user.id).count(),
        "time logs": db.query(models.TimeLog).filter(models.TimeLog.user_id == user.id).count(),
    }
    owned = {name: count for name, count in owned.items() if count}
    if owned:
        listing = ", ".join(f"{count} {name}" for name, count in owned.items())
        raise Fail(f"{user.email} created {listing}, and deleting them would break those records. Use remove instead; it ends access and keeps their work.")
    if is_last_curator(db, user):
        raise Fail("That is the organization's only curator. Give someone else the curator role first (set-role).")
    print(f"Permanently delete {describe(user)}. This cannot be undone.")
    try:
        typed = input(f"Type the email ({user.email}) to confirm: ")
    except EOFError:
        typed = ""
    if crud.normalize_email(typed) != user.email:
        raise Fail("Cancelled. Nothing was changed.")
    record(db, "delete-user", user)
    db.delete(user)
    db.commit()
    print("Done.")


def build_parser():
    parser = argparse.ArgumentParser(
        prog="python -m backend.admin",
        description="Support tool for TrainIt accounts. Uses the database in DATABASE_URL.",
    )
    commands = parser.add_subparsers(dest="command", required=True, metavar="command")

    def add(name, function, help_text, writes=False):
        sub = commands.add_parser(name, help=help_text, description=help_text)
        sub.set_defaults(function=function)
        if writes:
            sub.add_argument("--yes", action="store_true", help="skip the yes/no question")
        return sub

    add("find", cmd_find, "Search accounts by email, name or organization").add_argument("text")
    add("orgs", cmd_orgs, "List organizations, their member counts, and any with no curator")
    add("org", cmd_org, "Show one organization and all its members").add_argument("name")
    add("user", cmd_user, "Show one account").add_argument("email")
    add("pending", cmd_pending, "List join requests waiting for approval, in every organization")
    audit = add("audit", cmd_audit, "Show the most recent admin changes")
    audit.add_argument("--limit", type=int, default=25)

    add("set-password", cmd_set_password, "Give an account a random temporary password and sign out its devices", True).add_argument("email")
    add("restore", cmd_restore, "Restore a removed member", True).add_argument("email")
    add("remove", cmd_remove, "Remove a member: ends access, keeps their work", True).add_argument("email")
    role = add("set-role", cmd_set_role, "Change an active member's role", True)
    role.add_argument("email")
    role.add_argument("role", choices=list(models.ROLE_RANK))
    approve = add("approve", cmd_approve, "Approve a pending join request", True)
    approve.add_argument("email")
    approve.add_argument("--role", choices=list(models.ROLE_RANK), default=models.ROLE_TRAINER)
    add("reject", cmd_reject, "Reject a pending join request (deletes the pending account)", True).add_argument("email")
    change = add("change-email", cmd_change_email, "Fix the email on an account", True)
    change.add_argument("email")
    change.add_argument("new_email")
    rename = add("rename-org", cmd_rename_org, "Fix an organization's name", True)
    rename.add_argument("name")
    rename.add_argument("new_name")
    add("delete-user", cmd_delete_user, "Permanently delete an account that has created nothing yet")\
        .add_argument("email")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    print(f"Database: {engine.url.render_as_string(hide_password=True)}\n")
    # Only the audit table; the app's own tables and migrations are not touched
    AuditLog.__table__.create(bind=engine, checkfirst=True)
    db = SessionLocal()
    try:
        args.function(db, args)
    except Fail as problem:
        db.rollback()
        print(f"Error: {problem}", file=sys.stderr)
        return 1
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
