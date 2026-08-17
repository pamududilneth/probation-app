import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine, SessionLocal
from .models import User, RoleEnum
from .routers import auth, admin, forms

app = FastAPI(title="Probation Progress Review API")

# TODO: replace with your actual frontend origin(s) once deployed
# (e.g. Azure Static Web App / App Service URL). Keep this tight — it's the
# only thing standing between a stolen token and cross-site use.
FRONTEND_ORIGINS = os.environ.get("FRONTEND_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(forms.router)


@app.on_event("startup")
def on_startup():
    # Dev convenience only — use Alembic migrations for real environments.
    Base.metadata.create_all(bind=engine)

    # In local dev mode, auto-provision one Admin so there's no manual SQL
    # step required just to get into the app. Sign in with this email on the
    # frontend's dev login screen (DEV_ADMIN_EMAIL, default below).
    if os.environ.get("AUTH_MODE", "dev") == "dev":
        admin_email = os.environ.get("DEV_ADMIN_EMAIL", "admin@local.dev")
        db = SessionLocal()
        try:
            existing = db.query(User).filter(User.email == admin_email).first()
            if existing is None:
                db.add(User(email=admin_email, display_name="Admin (dev)", role=RoleEnum.admin))
                db.commit()
            elif existing.role != RoleEnum.admin:
                existing.role = RoleEnum.admin
                db.commit()
        finally:
            db.close()


@app.get("/health")
def health():
    return {"status": "ok"}
