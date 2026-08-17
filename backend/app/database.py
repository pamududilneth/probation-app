import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()  # reads backend/.env if present

# Defaults to a local SQLite file — nothing to install, nothing to run.
# For a real deployment, set DATABASE_URL to Postgres instead, e.g.
#   postgresql://<user>:<password>@<server>.postgres.database.azure.com:5432/<db>?sslmode=require
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./probation_app.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
