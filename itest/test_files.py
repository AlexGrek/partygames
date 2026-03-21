"""Integration tests for the WebDAV file storage API (/api/v1/files)."""

import uuid

import requests


def fname():
    """Return a unique filename so tests do not interfere with each other."""
    return f"itest-{uuid.uuid4().hex}.txt"


def put_file(server, name, content=b"hello integration test"):
    return requests.put(
        f"{server}/api/v1/files/{name}",
        data=content,
        headers={"Content-Type": "application/octet-stream"},
    )


# ---------------------------------------------------------------------------
# List files
# ---------------------------------------------------------------------------

def test_list_files_returns_files_array(server):
    r = requests.get(f"{server}/api/v1/files")
    assert r.status_code == 200
    body = r.json()
    assert "files" in body
    assert isinstance(body["files"], list)


def test_list_files_json_content_type(server):
    r = requests.get(f"{server}/api/v1/files")
    assert "application/json" in r.headers["Content-Type"]


# ---------------------------------------------------------------------------
# Upload (WebDAV PUT)
# ---------------------------------------------------------------------------

def test_upload_file_succeeds(server):
    r = put_file(server, fname())
    assert r.status_code in (200, 201, 204)


def test_uploaded_file_appears_in_listing(server):
    name = fname()
    put_file(server, name)

    r = requests.get(f"{server}/api/v1/files")
    names = [f["name"] for f in r.json()["files"]]
    assert name in names


def test_uploaded_file_has_correct_size(server):
    name = fname()
    content = b"size check content"
    put_file(server, name, content)

    r = requests.get(f"{server}/api/v1/files")
    entry = next(f for f in r.json()["files"] if f["name"] == name)
    assert entry["size"] == len(content)


def test_uploaded_file_is_not_a_directory(server):
    name = fname()
    put_file(server, name)

    r = requests.get(f"{server}/api/v1/files")
    entry = next(f for f in r.json()["files"] if f["name"] == name)
    assert entry["isDir"] is False


def test_uploaded_file_has_mod_time(server):
    name = fname()
    put_file(server, name)

    r = requests.get(f"{server}/api/v1/files")
    entry = next(f for f in r.json()["files"] if f["name"] == name)
    assert entry["modTime"]  # non-empty RFC3339 string


# ---------------------------------------------------------------------------
# Download (WebDAV GET)
# ---------------------------------------------------------------------------

def test_download_returns_uploaded_content(server):
    name = fname()
    content = b"round-trip content check"
    put_file(server, name, content)

    r = requests.get(f"{server}/api/v1/files/{name}")
    assert r.status_code == 200
    assert r.content == content


def test_download_nonexistent_file_returns_404(server):
    r = requests.get(f"{server}/api/v1/files/{fname()}")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Delete (WebDAV DELETE)
# ---------------------------------------------------------------------------

def test_delete_file_succeeds(server):
    name = fname()
    put_file(server, name)

    r = requests.delete(f"{server}/api/v1/files/{name}")
    assert r.status_code in (200, 204)


def test_deleted_file_no_longer_in_listing(server):
    name = fname()
    put_file(server, name)
    requests.delete(f"{server}/api/v1/files/{name}")

    r = requests.get(f"{server}/api/v1/files")
    names = [f["name"] for f in r.json()["files"]]
    assert name not in names


def test_deleted_file_no_longer_downloadable(server):
    name = fname()
    put_file(server, name)
    requests.delete(f"{server}/api/v1/files/{name}")

    r = requests.get(f"{server}/api/v1/files/{name}")
    assert r.status_code == 404


def test_delete_nonexistent_file_returns_404(server):
    r = requests.delete(f"{server}/api/v1/files/{fname()}")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# WebDAV PROPFIND
# ---------------------------------------------------------------------------

def test_propfind_root_returns_207_multistatus(server):
    r = requests.request(
        "PROPFIND",
        f"{server}/api/v1/files/",
        headers={"Depth": "1"},
    )
    assert r.status_code == 207


def test_propfind_root_returns_xml(server):
    r = requests.request(
        "PROPFIND",
        f"{server}/api/v1/files/",
        headers={"Depth": "1"},
    )
    ct = r.headers.get("Content-Type", "")
    assert "xml" in ct


def test_propfind_uploaded_file_appears_in_response(server):
    name = fname()
    put_file(server, name)

    r = requests.request(
        "PROPFIND",
        f"{server}/api/v1/files/",
        headers={"Depth": "1"},
    )
    assert r.status_code == 207
    assert name in r.text


# ---------------------------------------------------------------------------
# Overwrite
# ---------------------------------------------------------------------------

def test_upload_overwrites_existing_file(server):
    name = fname()
    put_file(server, name, b"original")
    put_file(server, name, b"updated")

    r = requests.get(f"{server}/api/v1/files/{name}")
    assert r.content == b"updated"
