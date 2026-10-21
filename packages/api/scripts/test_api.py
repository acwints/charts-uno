#!/usr/bin/env python3
"""Run API tests in a subprocess bound to a fresh, disposable SQLite database.

Usage: packages/api/.venv/bin/python packages/api/scripts/test_api.py
Never imports application/test modules in the parent process. Inherited database
URLs and provider secrets are excluded, and repository .env loading is disabled.
"""
from pathlib import Path
import os
import secrets
import subprocess
import sys
import tempfile

API_ROOT = Path(__file__).resolve().parents[1]
WORKER = r'''
import sys
from pathlib import Path
import dotenv
# Keep local developer .env files out of test configuration, including older
# python-dotenv releases that do not support PYTHON_DOTENV_DISABLED.
dotenv.load_dotenv = lambda *args, **kwargs: False
import unittest
api_root = Path(sys.argv[1])
sys.path.insert(0, str(api_root))
suite = unittest.defaultTestLoader.discover(str(api_root / "tests"))
result = unittest.TextTestRunner(verbosity=2).run(suite)
raise SystemExit(0 if result.wasSuccessful() else 1)
'''


def main() -> int:
    # Only OS/runtime settings reach the worker. Database/provider credentials
    # from an interactive shell or CI configuration cannot leak into the tests.
    allowed = {"PATH", "HOME", "TMPDIR", "TEMP", "TMP", "SYSTEMROOT", "WINDIR",
               "PATHEXT", "LANG", "LC_ALL", "TZ", "VIRTUAL_ENV", "PYTHONUTF8"}
    env = {key: value for key, value in os.environ.items() if key in allowed}
    with tempfile.TemporaryDirectory(prefix="chartsuno_api_test_") as directory:
        env.update({
            "DATABASE_URL": "sqlite:///" + str(Path(directory) / "test.db"),
            "ENVIRONMENT": "development",
            "JWT_SECRET_KEY": secrets.token_urlsafe(48),
            "PYTHON_DOTENV_DISABLED": "1",
            "PYTHONUNBUFFERED": "1",
        })
        return subprocess.run(
            [sys.executable, "-c", WORKER, str(API_ROOT)],
            cwd=directory, env=env, check=False,
        ).returncode


if __name__ == "__main__":
    raise SystemExit(main())
