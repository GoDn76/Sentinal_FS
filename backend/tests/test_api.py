import os
import sys
import asyncio
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.main import app
from backend.database.connection import init_db

# Synchronously initialize SQLite DB tables for pytest TestClient
asyncio.run(init_db())

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "SentinelFS" in data["service"]

def test_auth_registration_and_login():
    unique_user = f"test_investigator_{os.urandom(4).hex()}"
    reg_payload = {
        "username": unique_user,
        "email": f"{unique_user}@forensics.gov",
        "password": "SecurePassword123!",
        "agency_name": "Federal Crime Lab",
        "badge_number": "#8890"
    }
    
    reg_res = client.post("/api/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    user_data = reg_res.json()
    assert user_data["username"] == unique_user
    assert user_data["badge_number"] == "#8890"

    # Login
    login_payload = {
        "username": unique_user,
        "password": "SecurePassword123!"
    }
    login_res = client.post("/api/auth/login", json=login_payload)
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"

@patch("backend.routers.cases.run_rust_carver.delay")
def test_case_creation_and_carve_dispatch(mock_celery_carver):
    # Mock Celery delay returns a mock object with id attribute
    mock_task = MagicMock()
    mock_task.id = "mock-task-carve-12345"
    mock_celery_carver.return_value = mock_task

    # 1. Register & get token
    unique_user = f"case_user_{os.urandom(4).hex()}"
    reg_payload = {
        "username": unique_user,
        "email": f"{unique_user}@lab.gov",
        "password": "CasePassword123!"
    }
    client.post("/api/auth/register", json=reg_payload)
    login_res = client.post("/api/auth/login", json={"username": unique_user, "password": "CasePassword123!"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Case
    case_num = f"CASE-{os.urandom(3).hex().upper()}"
    case_res = client.post("/api/cases", json={
        "case_number": case_num,
        "title": "State v. Thorne - Alley Incident",
        "description": "Commercial Burglary Investigation"
    }, headers=headers)
    assert case_res.status_code == 201
    case_data = case_res.json()
    case_id = case_data["id"]

    # 3. Dispatch Carve Job
    carve_res = client.post(
        f"/api/cases/{case_id}/carve?raw_disk_path=fake_disk.raw",
        headers=headers
    )
    assert carve_res.status_code == 200
    carve_data = carve_res.json()
    assert carve_data["task_id"] == "mock-task-carve-12345"
    assert carve_data["task_type"] == "carving"
    mock_celery_carver.assert_called_once()
