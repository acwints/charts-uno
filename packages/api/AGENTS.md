# packages/api

Python FastAPI backend for chart persistence, team management, and branding.

## Commands

```bash
pip install -r requirements.txt
python run.py                     # Start server
python scripts/test_api.py         # Full suite, isolated temporary DB (safe with inherited env)
```

## Structure

- `main.py` -- FastAPI app, all route handlers
- `schemas.py` -- Pydantic models for request/response
- `dependencies.py` -- Auth, DB session, team resolution
