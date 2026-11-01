"""Punto de entrada que Vercel detecta para la función de FastAPI."""
from app.main import app

__all__ = ["app"]
