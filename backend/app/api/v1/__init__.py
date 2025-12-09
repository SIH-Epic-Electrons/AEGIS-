"""
API v1 Router
Aggregates all API endpoints
"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, cases, dashboard, officers, teams, atms, predictions, graph, freeze, reports, public
from app.federated_learning.server.api import router as fl_router
from app.reinforcement_learning.api import router as rl_router

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(cases.router, prefix="/cases", tags=["Cases"])
api_router.include_router(officers.router, prefix="/officers", tags=["Officers"])
api_router.include_router(teams.router, prefix="/teams", tags=["Teams"])
api_router.include_router(atms.router, prefix="/atms", tags=["ATMs"])
api_router.include_router(predictions.router, prefix="/predictions", tags=["AI Predictions"])
api_router.include_router(graph.router, prefix="/graph", tags=["Graph Visualization"])
api_router.include_router(freeze.router, prefix="/freeze", tags=["Account Freeze"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(public.router, prefix="/public", tags=["Public (No Auth)"])
api_router.include_router(fl_router, tags=["Federated Learning"])
api_router.include_router(rl_router, tags=["Reinforcement Learning"])

