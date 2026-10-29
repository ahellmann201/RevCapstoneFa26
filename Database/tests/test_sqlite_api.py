import os
from pathlib import Path
import subprocess
import sys


def test_sqlite_api_end_to_end(tmp_path):
    path = tmp_path / "isolated.sqlite"
    path.touch()
    result = subprocess.run(
        [sys.executable, "-m", "Database.tests.sqlite_api_scenario"],
        cwd=Path(__file__).resolve().parents[2],
        env={**os.environ, "DB_TYPE": "sqlite", "DB_PATH": str(path),
             "JWT_SECRET": "temporary-integration-test-secret-" * 3},
        capture_output=True, text=True, timeout=60,
    )
    assert result.returncode == 0, result.stdout + result.stderr
