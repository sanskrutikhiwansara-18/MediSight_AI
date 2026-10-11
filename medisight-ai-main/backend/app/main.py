from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.api import auth, me, patients, qr, risk, analytics, audit, consent, emergency, outbreaks, notifications, representative, access_requests
from app.core.dev_migrations import upgrade_for_patient_role

# Ensure all models are registered on Base before create_all
import app.models  # noqa: F401

app = FastAPI(
    title=settings.APP_NAME,
    description="Privacy-first patient health records & disease trend monitoring.",
    version="0.1.0-mvp",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # Dev convenience: create tables if they don't exist yet. In real
    # deployments, use Alembic migrations instead of create_all.
    Base.metadata.create_all(bind=engine)
    upgrade_for_patient_role(engine)


app.include_router(auth.router)
app.include_router(me.router)
app.include_router(patients.router)
app.include_router(qr.router)
app.include_router(risk.router)
app.include_router(analytics.router)
app.include_router(outbreaks.router)
app.include_router(audit.router)
app.include_router(consent.router)
app.include_router(emergency.router)
app.include_router(notifications.router)
app.include_router(representative.router)
app.include_router(access_requests.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}
