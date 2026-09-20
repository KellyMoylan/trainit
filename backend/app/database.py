import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./app.db")

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

def run_migrations():
    # create_all never alters existing tables; existing users predate roles, so they become active curators
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    with engine.begin() as conn:
        if "users" in tables:
            columns = {c["name"] for c in inspector.get_columns("users")}
            for profile_column, column_type in (("first_name", "VARCHAR"), ("last_name", "VARCHAR"), ("department", "VARCHAR"), ("bio", "TEXT")):
                if profile_column not in columns:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {profile_column} {column_type}"))
            if "token_version" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0"))
            if "role" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR NOT NULL DEFAULT 'curator'"))
            if "status" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN status VARCHAR NOT NULL DEFAULT 'active'"))
        if "step_session_notes" in tables:
            columns = {c["name"] for c in inspector.get_columns("step_session_notes")}
            if "performed_time" not in columns:
                conn.execute(text("ALTER TABLE step_session_notes ADD COLUMN performed_time TIME"))
        if "animals" in tables:
            columns = {c["name"] for c in inspector.get_columns("animals")}
            if "birth_date" not in columns:
                conn.execute(text("ALTER TABLE animals ADD COLUMN birth_date DATE"))
        if "training_plans" in tables:
            columns = {c["name"] for c in inspector.get_columns("training_plans")}
            if "created_by_id" not in columns:
                # Plans made before creators were recorded were dummy data, so they are removed rather than left ownerless
                conn.execute(text("DELETE FROM step_session_notes"))
                conn.execute(text("DELETE FROM plan_steps"))
                conn.execute(text("DELETE FROM training_plans"))
                conn.execute(text("ALTER TABLE training_plans ADD COLUMN created_by_id INTEGER REFERENCES users(id)"))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()