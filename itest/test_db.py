"""Integration tests for the KV database API (/api/v1/keys)."""

import uuid

import pytest
import requests


def make_key():
    """Return a unique key so tests do not interfere with each other."""
    return f"itest:{uuid.uuid4().hex}"


# ---------------------------------------------------------------------------
# List keys
# ---------------------------------------------------------------------------

def test_list_keys_returns_array(server):
    r = requests.get(f"{server}/api/v1/keys")
    assert r.status_code == 200
    body = r.json()
    assert "keys" in body
    assert isinstance(body["keys"], list)


def test_list_keys_with_unknown_prefix_returns_empty(server):
    prefix = f"itest:no-such-prefix:{uuid.uuid4().hex}"
    r = requests.get(f"{server}/api/v1/keys", params={"prefix": prefix})
    assert r.status_code == 200
    assert r.json()["keys"] == []


# ---------------------------------------------------------------------------
# Put (create / update)
# ---------------------------------------------------------------------------

def test_put_key_returns_key_name(server):
    key = make_key()
    r = requests.put(f"{server}/api/v1/keys/{key}", json={"hello": "world"})
    assert r.status_code == 200
    body = r.json()
    assert body["key"] == key


def test_put_key_object_value(server):
    key = make_key()
    payload = {"score": 42, "players": ["alice", "bob"], "active": True}
    r = requests.put(f"{server}/api/v1/keys/{key}", json=payload)
    assert r.status_code == 200


def test_put_key_string_value(server):
    key = make_key()
    r = requests.put(
        f"{server}/api/v1/keys/{key}",
        data='"just a string"',
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 200


def test_put_key_number_value(server):
    key = make_key()
    r = requests.put(
        f"{server}/api/v1/keys/{key}",
        data="99",
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 200


def test_put_key_null_value(server):
    key = make_key()
    r = requests.put(
        f"{server}/api/v1/keys/{key}",
        data="null",
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 200


def test_put_key_invalid_json_returns_400(server):
    key = make_key()
    r = requests.put(
        f"{server}/api/v1/keys/{key}",
        data="not json {{{",
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 400
    body = r.json()
    assert "error" in body
    assert "JSON" in body["error"] or "json" in body["error"]


# ---------------------------------------------------------------------------
# Get
# ---------------------------------------------------------------------------

def test_get_existing_key(server):
    key = make_key()
    payload = {"x": 1}
    requests.put(f"{server}/api/v1/keys/{key}", json=payload)

    r = requests.get(f"{server}/api/v1/keys/{key}")
    assert r.status_code == 200
    body = r.json()
    assert body["key"] == key
    assert body["value"] == payload


def test_get_nonexistent_key_returns_404(server):
    key = make_key()
    r = requests.get(f"{server}/api/v1/keys/{key}")
    assert r.status_code == 404
    body = r.json()
    assert "error" in body


def test_put_then_get_preserves_complex_value(server):
    key = make_key()
    payload = {"nested": {"a": [1, 2, 3]}, "flag": False, "count": 0}
    requests.put(f"{server}/api/v1/keys/{key}", json=payload)

    r = requests.get(f"{server}/api/v1/keys/{key}")
    assert r.status_code == 200
    assert r.json()["value"] == payload


def test_put_overwrites_existing_key(server):
    key = make_key()
    requests.put(f"{server}/api/v1/keys/{key}", json={"v": 1})
    requests.put(f"{server}/api/v1/keys/{key}", json={"v": 2})

    r = requests.get(f"{server}/api/v1/keys/{key}")
    assert r.json()["value"] == {"v": 2}


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

def test_delete_existing_key(server):
    key = make_key()
    requests.put(f"{server}/api/v1/keys/{key}", json={})

    r = requests.delete(f"{server}/api/v1/keys/{key}")
    assert r.status_code == 200
    body = r.json()
    assert body["key"] == key
    assert body["deleted"] is True


def test_delete_removes_key(server):
    key = make_key()
    requests.put(f"{server}/api/v1/keys/{key}", json={"data": 1})
    requests.delete(f"{server}/api/v1/keys/{key}")

    r = requests.get(f"{server}/api/v1/keys/{key}")
    assert r.status_code == 404


def test_delete_nonexistent_key_returns_404(server):
    key = make_key()
    r = requests.delete(f"{server}/api/v1/keys/{key}")
    assert r.status_code == 404
    assert "error" in r.json()


# ---------------------------------------------------------------------------
# Prefix filtering
# ---------------------------------------------------------------------------

def test_prefix_filter_returns_only_matching_keys(server):
    prefix = f"itest:pfx:{uuid.uuid4().hex}:"
    keys_with_prefix = [f"{prefix}a", f"{prefix}b", f"{prefix}c"]
    other_key = make_key()

    for k in keys_with_prefix:
        requests.put(f"{server}/api/v1/keys/{k}", json={})
    requests.put(f"{server}/api/v1/keys/{other_key}", json={})

    r = requests.get(f"{server}/api/v1/keys", params={"prefix": prefix})
    assert r.status_code == 200
    returned = set(r.json()["keys"])
    assert set(keys_with_prefix).issubset(returned)
    assert other_key not in returned


def test_prefix_filter_no_match_returns_empty(server):
    prefix = f"itest:nope:{uuid.uuid4().hex}:"
    r = requests.get(f"{server}/api/v1/keys", params={"prefix": prefix})
    assert r.json()["keys"] == []


def test_keys_appear_in_global_list_after_put(server):
    key = make_key()
    requests.put(f"{server}/api/v1/keys/{key}", json={})

    r = requests.get(f"{server}/api/v1/keys")
    assert key in r.json()["keys"]


def test_keys_disappear_from_list_after_delete(server):
    key = make_key()
    requests.put(f"{server}/api/v1/keys/{key}", json={})
    requests.delete(f"{server}/api/v1/keys/{key}")

    r = requests.get(f"{server}/api/v1/keys")
    assert key not in r.json()["keys"]
