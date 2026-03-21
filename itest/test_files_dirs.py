"""Integration tests for directory management in the WebDAV file storage API."""

import uuid

import requests


def dname():
    """Return a unique directory name so tests do not interfere with each other."""
    return f"itest-dir-{uuid.uuid4().hex}"


def fname():
    return f"itest-{uuid.uuid4().hex}.txt"


def mkcol(server, *path_segments):
    url = f"{server}/api/v1/files/" + "/".join(path_segments)
    return requests.request("MKCOL", url)


def put_file(server, content=b"hello", *path_segments):
    url = f"{server}/api/v1/files/" + "/".join(path_segments)
    return requests.put(url, data=content, headers={"Content-Type": "application/octet-stream"})


def list_dir(server, *path_segments):
    """Fetch the JSON listing for a given path (empty = root)."""
    if path_segments:
        path = "/".join(path_segments)
        return requests.get(f"{server}/api/v1/files", params={"path": path})
    return requests.get(f"{server}/api/v1/files")


# ---------------------------------------------------------------------------
# MKCOL — create directory
# ---------------------------------------------------------------------------

def test_mkcol_returns_success(server):
    r = mkcol(server, dname())
    assert r.status_code in (200, 201, 204)


def test_created_dir_appears_in_root_listing(server):
    name = dname()
    mkcol(server, name)

    r = list_dir(server)
    names = [f["name"] for f in r.json()["files"]]
    assert name in names


def test_created_dir_has_isdir_true(server):
    name = dname()
    mkcol(server, name)

    r = list_dir(server)
    entry = next(f for f in r.json()["files"] if f["name"] == name)
    assert entry["isDir"] is True


def test_created_dir_has_mod_time(server):
    name = dname()
    mkcol(server, name)

    r = list_dir(server)
    entry = next(f for f in r.json()["files"] if f["name"] == name)
    assert entry["modTime"]


# ---------------------------------------------------------------------------
# ?path= listing of subdirectory
# ---------------------------------------------------------------------------

def test_list_subdir_returns_200(server):
    name = dname()
    mkcol(server, name)

    r = list_dir(server, name)
    assert r.status_code == 200


def test_list_subdir_returns_files_array(server):
    name = dname()
    mkcol(server, name)

    r = list_dir(server, name)
    body = r.json()
    assert "files" in body
    assert isinstance(body["files"], list)


def test_list_empty_subdir_returns_empty_array(server):
    name = dname()
    mkcol(server, name)

    r = list_dir(server, name)
    assert r.json()["files"] == []


def test_file_uploaded_into_subdir_appears_in_subdir_listing(server):
    dir_name = dname()
    file_name = fname()
    mkcol(server, dir_name)
    put_file(server, b"subdir file", dir_name, file_name)

    r = list_dir(server, dir_name)
    names = [f["name"] for f in r.json()["files"]]
    assert file_name in names


def test_file_uploaded_into_subdir_not_in_root_listing(server):
    dir_name = dname()
    file_name = fname()
    mkcol(server, dir_name)
    put_file(server, b"subdir file", dir_name, file_name)

    r = list_dir(server)
    names = [f["name"] for f in r.json()["files"]]
    assert file_name not in names


# ---------------------------------------------------------------------------
# Upload / download inside subdirectory
# ---------------------------------------------------------------------------

def test_upload_into_subdir_succeeds(server):
    dir_name = dname()
    mkcol(server, dir_name)

    r = put_file(server, b"content", dir_name, fname())
    assert r.status_code in (200, 201, 204)


def test_download_file_from_subdir(server):
    dir_name = dname()
    file_name = fname()
    content = b"download from subdir"
    mkcol(server, dir_name)
    put_file(server, content, dir_name, file_name)

    r = requests.get(f"{server}/api/v1/files/{dir_name}/{file_name}")
    assert r.status_code == 200
    assert r.content == content


def test_download_nonexistent_file_in_subdir_returns_404(server):
    dir_name = dname()
    mkcol(server, dir_name)

    r = requests.get(f"{server}/api/v1/files/{dir_name}/{fname()}")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Delete directory
# ---------------------------------------------------------------------------

def test_delete_empty_dir_succeeds(server):
    name = dname()
    mkcol(server, name)

    r = requests.delete(f"{server}/api/v1/files/{name}")
    assert r.status_code in (200, 204)


def test_deleted_dir_not_in_listing(server):
    name = dname()
    mkcol(server, name)
    requests.delete(f"{server}/api/v1/files/{name}")

    r = list_dir(server)
    names = [f["name"] for f in r.json()["files"]]
    assert name not in names


def test_delete_dir_with_file_inside_succeeds(server):
    dir_name = dname()
    mkcol(server, dir_name)
    put_file(server, b"content", dir_name, fname())

    r = requests.delete(f"{server}/api/v1/files/{dir_name}")
    assert r.status_code in (200, 204)


# ---------------------------------------------------------------------------
# Nested directories
# ---------------------------------------------------------------------------

def test_create_nested_dir(server):
    parent = dname()
    child = dname()
    mkcol(server, parent)
    r = mkcol(server, parent, child)
    assert r.status_code in (200, 201, 204)


def test_nested_dir_appears_in_parent_listing(server):
    parent = dname()
    child = dname()
    mkcol(server, parent)
    mkcol(server, parent, child)

    r = list_dir(server, parent)
    names = [f["name"] for f in r.json()["files"]]
    assert child in names


def test_file_in_nested_dir_downloadable(server):
    parent = dname()
    child = dname()
    file_name = fname()
    content = b"deeply nested"
    mkcol(server, parent)
    mkcol(server, parent, child)
    put_file(server, content, parent, child, file_name)

    r = requests.get(f"{server}/api/v1/files/{parent}/{child}/{file_name}")
    assert r.status_code == 200
    assert r.content == content


def test_list_nested_subdir(server):
    parent = dname()
    child = dname()
    file_name = fname()
    mkcol(server, parent)
    mkcol(server, parent, child)
    put_file(server, b"x", parent, child, file_name)

    r = list_dir(server, parent, child)
    assert r.status_code == 200
    names = [f["name"] for f in r.json()["files"]]
    assert file_name in names


# ---------------------------------------------------------------------------
# Path traversal protection
# ---------------------------------------------------------------------------

def test_path_traversal_dotdot_rejected(server):
    r = list_dir(server, "..", "etc")
    assert r.status_code in (400, 403, 404)


def test_path_traversal_encoded_dotdot_rejected(server):
    r = requests.get(f"{server}/api/v1/files", params={"path": "../../etc/passwd"})
    assert r.status_code in (400, 403, 404)
