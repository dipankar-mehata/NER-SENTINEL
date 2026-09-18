import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# NER-SENTINEL uses SQLite for deployment on Render free tier.
# Firebase handles all real-time data; SQLite is just for local seed/fallback data.
# We deliberately ignore DATABASE_URL if it's a postgres URL to prevent connection failures.
_raw_url = os.getenv("DATABASE_URL", "sqlite:///./logistics.db")

if _raw_url.startswith("postgres") or _raw_url.startswith("mysql"):
    # Override to SQLite - no Postgres server available on Render free tier
    SQLALCHEMY_DATABASE_URL = "sqlite:///./logistics.db"
else:
    SQLALCHEMY_DATABASE_URL = _raw_url

# SQLite engine with thread safety for FastAPI async context
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
