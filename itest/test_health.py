"""Health and connectivity integration tests."""

import requests


def test_api_keys_endpoint_responds(server):
    r = requests.get(f"{server}/api/v1/keys")
    assert r.status_code == 200


def test_api_returns_json_content_type(server):
    r = requests.get(f"{server}/api/v1/keys")
    assert "application/json" in r.headers["Content-Type"]


def test_spa_root_serves_html(server):
    r = requests.get(f"{server}/")
    assert r.status_code == 200
    assert "text/html" in r.headers["Content-Type"]


def test_spa_unknown_path_falls_back_to_index(server):
    r = requests.get(f"{server}/some/deep/client/route")
    assert r.status_code == 200
    assert "text/html" in r.headers["Content-Type"]
    # SPA fallback must return index.html
    assert "<!DOCTYPE html>" in r.text or "<html" in r.text.lower()


def test_cors_headers_on_keys_endpoint(server):
    r = requests.options(
        f"{server}/api/v1/keys",
        headers={"Origin": "http://example.com"},
    )
    assert r.headers.get("Access-Control-Allow-Origin") == "*"


def test_cors_headers_on_files_endpoint(server):
    r = requests.options(
        f"{server}/api/v1/files/",
        headers={"Origin": "http://example.com"},
    )
    assert r.headers.get("Access-Control-Allow-Origin") == "*"


def test_method_not_allowed_on_keys_root(server):
    r = requests.post(f"{server}/api/v1/keys", json={})
    assert r.status_code == 405
    body = r.json()
    assert "error" in body
