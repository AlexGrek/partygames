"""
Integration test fixtures.

The `server` fixture builds the backend binary and the frontend, starts the
server against a temporary database + files directory, waits until it is
ready, and tears everything down after the session.
"""

import os
import subprocess
import time

import pytest
import requests

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_PORT = 18080
BASE_URL = f"http://localhost:{TEST_PORT}"


@pytest.fixture(scope="session")
def built_backend(tmp_path_factory):
    """Compile the Go binary once for the whole test session."""
    binary = tmp_path_factory.mktemp("bin") / "server"
    subprocess.run(
        ["go", "build", "-o", str(binary), "."],
        cwd=os.path.join(PROJECT_ROOT, "backend"),
        check=True,
    )
    return str(binary)


@pytest.fixture(scope="session")
def built_frontend():
    """Build the React SPA once for the whole test session."""
    subprocess.run(
        ["npm", "run", "build"],
        cwd=os.path.join(PROJECT_ROOT, "frontend"),
        check=True,
    )
    return os.path.join(PROJECT_ROOT, "frontend", "build", "client")


@pytest.fixture(scope="session")
def server(built_backend, built_frontend, tmp_path_factory):
    """
    Start the backend server with the built frontend and a temporary database.

    Yields the base URL string, e.g. ``http://localhost:18080``.
    """
    tmp = tmp_path_factory.mktemp("data")
    db_path = tmp / "data.db"
    files_dir = tmp / "files"
    files_dir.mkdir()

    proc = subprocess.Popen(
        [
            built_backend,
            "-addr", f":{TEST_PORT}",
            "-db", str(db_path),
            "-static", built_frontend,
            "-files", str(files_dir),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    deadline = time.time() + 15
    while time.time() < deadline:
        try:
            r = requests.get(f"{BASE_URL}/api/v1/keys", timeout=1)
            if r.status_code < 500:
                break
        except requests.exceptions.ConnectionError:
            time.sleep(0.1)
    else:
        proc.kill()
        stdout = proc.stdout.read().decode()
        stderr = proc.stderr.read().decode()
        raise RuntimeError(
            f"Server did not start within 15 s.\nstdout: {stdout}\nstderr: {stderr}"
        )

    yield BASE_URL

    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
