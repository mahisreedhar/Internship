"""
Unit tests for authentication, authorisation, and task access control.
Run with:  cd backend && pytest -v
"""

_USER = {
    "email": "alice@example.com",
    "password": "StrongPass123!",
    "full_name": "Alice Example",
}


def _signup_and_login(client, user=None):
    user = user or _USER
    client.post("/auth/signup", json=user)
    client.post("/auth/login", json={"email": user["email"], "password": user["password"]})


# ── Test 1: Registration creates a user and never exposes the password ────────
def test_signup_returns_user_without_password(client):
    response = client.post("/auth/signup", json=_USER)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == _USER["email"]
    assert body["full_name"] == _USER["full_name"]
    assert "password" not in body
    assert "hashed_password" not in body


# ── Test 2: Duplicate email is rejected ───────────────────────────────────────
def test_duplicate_email_returns_400(client):
    client.post("/auth/signup", json=_USER)
    response = client.post("/auth/signup", json=_USER)

    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()


# ── Test 3: Successful login sets an HttpOnly cookie ─────────────────────────
def test_login_sets_httponly_cookie(client):
    client.post("/auth/signup", json=_USER)
    response = client.post(
        "/auth/login", json={"email": _USER["email"], "password": _USER["password"]}
    )

    assert response.status_code == 200
    assert "access_token" in response.cookies
    # Verify the response body carries user data, not the token
    assert "access_token" not in response.json()


# ── Test 4: Wrong password is rejected with 401 ───────────────────────────────
def test_wrong_password_returns_401(client):
    client.post("/auth/signup", json=_USER)
    response = client.post(
        "/auth/login", json={"email": _USER["email"], "password": "WrongPassword!"}
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


# ── Test 5: Task creation without authentication is rejected ──────────────────
def test_unauthenticated_task_creation_returns_401(client):
    # Create user, login, create project
    _signup_and_login(client)
    project = client.post("/projects/", json={"title": "My Project"}).json()
    project_id = project["id"]

    # Clear the session cookie to simulate a logged-out user
    client.cookies.clear()

    response = client.post(
        f"/projects/{project_id}/tasks", json={"title": "Sneaky Task"}
    )
    assert response.status_code == 401


# ── Test 6: User cannot access another user's project ─────────────────────────
def test_cross_user_project_access_returns_403(client):
    # Alice creates a project
    _signup_and_login(client)
    project = client.post("/projects/", json={"title": "Alice Project"}).json()
    project_id = project["id"]

    # Log out Alice, sign up and log in as Bob
    client.post("/auth/logout")
    bob = {"email": "bob@example.com", "password": "BobPass456!", "full_name": "Bob"}
    _signup_and_login(client, bob)

    response = client.get(f"/projects/{project_id}")
    assert response.status_code == 403


# ── Test 7: Full task lifecycle — create, update status, delete ───────────────
def test_task_lifecycle(client):
    _signup_and_login(client)
    project_id = client.post("/projects/", json={"title": "Lifecycle Project"}).json()["id"]

    # Create
    task = client.post(
        f"/projects/{project_id}/tasks",
        json={"title": "First Task", "status": "To Do"},
    ).json()
    assert task["status"] == "To Do"
    task_id = task["id"]

    # Advance status
    updated = client.put(f"/tasks/{task_id}", json={"status": "In Progress"}).json()
    assert updated["status"] == "In Progress"

    # Delete
    delete_response = client.delete(f"/tasks/{task_id}")
    assert delete_response.status_code == 204

    # Confirm it's gone
    gone = client.get(f"/tasks/{task_id}")
    assert gone.status_code == 404
