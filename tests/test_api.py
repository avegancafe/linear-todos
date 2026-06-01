"""Tests for the API module."""

import json
from pathlib import Path

import pytest
import responses

from linear_todos.api import LinearAPI, LinearError, LinearAPIError
from linear_todos.config import Config


LINEAR_API_URL = "https://api.linear.app/graphql"


class TestLinearAPI:
    """Test cases for LinearAPI class."""
    
    @pytest.fixture
    def mock_config(self, tmp_path, monkeypatch):
        """Create a mock config with test API key."""
        config_dir = tmp_path / ".config" / "linear-todos"
        config_dir.mkdir(parents=True)
        config_file = config_dir / "config.json"
        config_file.write_text(json.dumps({
            "apiKey": "test_api_key",
            "teamId": "test_team_id"
        }))
        
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)
        return Config()
    
    def test_api_initialization_with_key(self):
        """Test API initialization with explicit key."""
        api = LinearAPI(api_key="test_key")
        assert api.api_key == "test_key"
    
    def test_api_initialization_with_config(self, mock_config):
        """Test API initialization with config."""
        api = LinearAPI(config=mock_config)
        assert api.api_key == "test_api_key"
    
    def test_api_initialization_no_key(self, tmp_path, monkeypatch):
        """Test API initialization fails without key."""
        # Create a fake home to avoid loading real credentials
        fake_home = tmp_path / "fake_home"
        fake_home.mkdir()
        monkeypatch.setattr(Path, "home", lambda: fake_home)
        
        config_file = tmp_path / "nonexistent" / "config.json"
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)
        
        # Clear env vars
        monkeypatch.delenv("LINEAR_API_KEY", raising=False)
        
        with pytest.raises(LinearError, match="No Linear API key found"):
            LinearAPI()
    
    @responses.activate
    def test_get_viewer(self, mock_config):
        """Test get_viewer returns user info."""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "viewer": {
                        "id": "user123",
                        "name": "Test User",
                        "email": "test@example.com"
                    }
                }
            },
            status=200
        )
        
        api = LinearAPI(config=mock_config)
        viewer = api.get_viewer()
        
        assert viewer["id"] == "user123"
        assert viewer["name"] == "Test User"
        assert viewer["email"] == "test@example.com"
    
    @responses.activate
    def test_get_teams(self, mock_config):
        """Test get_teams returns list of teams."""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "teams": {
                        "nodes": [
                            {"id": "team1", "name": "Team One", "key": "ONE"},
                            {"id": "team2", "name": "Team Two", "key": "TWO"}
                        ]
                    }
                }
            },
            status=200
        )
        
        api = LinearAPI(config=mock_config)
        teams = api.get_teams()
        
        assert len(teams) == 2
        assert teams[0]["key"] == "ONE"
        assert teams[1]["name"] == "Team Two"
    
    @responses.activate
    def test_get_team_states(self, mock_config):
        """Test get_team_states returns workflow states."""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "team": {
                        "states": {
                            "nodes": [
                                {"id": "state1", "name": "Todo", "type": "unstarted"},
                                {"id": "state2", "name": "Done", "type": "completed"}
                            ]
                        }
                    }
                }
            },
            status=200
        )
        
        api = LinearAPI(config=mock_config)
        states = api.get_team_states("team123")
        
        assert len(states) == 2
        assert states[0]["name"] == "Todo"
        assert states[1]["type"] == "completed"
    
    @responses.activate
    def test_get_team_issues(self, mock_config):
        """Test get_team_issues returns list of issues."""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "team": {
                        "issues": {
                            "nodes": [
                                {
                                    "id": "issue1",
                                    "identifier": "TEST-1",
                                    "title": "Test Issue",
                                    "priority": 2,
                                    "state": {"name": "Todo", "type": "unstarted"}
                                }
                            ]
                        }
                    }
                }
            },
            status=200
        )
        
        api = LinearAPI(config=mock_config)
        issues = api.get_team_issues("team123")
        
        assert len(issues) == 1
        assert issues[0]["identifier"] == "TEST-1"
    
    @responses.activate
    def test_create_issue(self, mock_config):
        """Test create_issue creates a new issue."""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {
                            "id": "new_issue_id",
                            "identifier": "TEST-42",
                            "title": "New Issue",
                            "url": "https://linear.app/issue/TEST-42"
                        }
                    }
                }
            },
            status=200
        )
        
        api = LinearAPI(config=mock_config)
        result = api.create_issue(
            team_id="team123",
            title="New Issue",
            priority=2
        )
        
        assert result["success"] is True
        assert result["issue"]["identifier"] == "TEST-42"
    
    @responses.activate
    def test_update_issue(self, mock_config):
        """Test update_issue updates an existing issue."""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueUpdate": {
                        "success": True,
                        "issue": {
                            "id": "issue123",
                            "identifier": "TEST-1",
                            "title": "Updated Title",
                            "state": {"name": "Done"}
                        }
                    }
                }
            },
            status=200
        )
        
        api = LinearAPI(config=mock_config)
        result = api.update_issue(
            issue_id="TEST-1",
            title="Updated Title",
            state_id="done_state"
        )
        
        assert result["success"] is True
        assert result["issue"]["title"] == "Updated Title"
    
    @responses.activate
    def test_api_error_handling(self, mock_config):
        """Test API errors are properly raised."""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "errors": [
                    {"message": "Invalid API key", "extensions": {"code": "UNAUTHORIZED"}}
                ]
            },
            status=200
        )
        
        api = LinearAPI(config=mock_config)
        
        with pytest.raises(LinearAPIError) as exc_info:
            api.get_viewer()
        
        assert "Invalid API key" in str(exc_info.value)
        assert exc_info.value.errors[0]["message"] == "Invalid API key"
    
    @responses.activate
    def test_http_error_handling(self, mock_config):
        """Test HTTP errors are properly raised."""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            body="Server Error",
            status=500
        )
        
        api = LinearAPI(config=mock_config)
        
        with pytest.raises(Exception):  # requests.HTTPError
            api.get_viewer()
    
    def test_priority_to_label(self):
        """Test priority_to_label returns correct labels."""
        assert LinearAPI.priority_to_label(0) == "None"
        assert LinearAPI.priority_to_label(1) == "Urgent"
        assert LinearAPI.priority_to_label(2) == "High"
        assert LinearAPI.priority_to_label(3) == "Normal"
        assert LinearAPI.priority_to_label(4) == "Low"
        assert LinearAPI.priority_to_label(99) == "None"  # Invalid
    
    def test_priority_to_number(self):
        """Test priority_to_number returns correct numbers."""
        assert LinearAPI.priority_to_number("urgent") == 1
        assert LinearAPI.priority_to_number("high") == 2
        assert LinearAPI.priority_to_number("normal") == 3
        assert LinearAPI.priority_to_number("low") == 4
        assert LinearAPI.priority_to_number("none") == 0
        assert LinearAPI.priority_to_number("URGENT") == 1  # Case insensitive
        assert LinearAPI.priority_to_number("1") == 1
        assert LinearAPI.priority_to_number("invalid") is None
    
    def test_priority_icon(self):
        """Test priority_icon returns correct icons."""
        assert LinearAPI.priority_icon(0) == "📋"
        assert LinearAPI.priority_icon(1) == "🔥"
        assert LinearAPI.priority_icon(2) == "⚡"
        assert LinearAPI.priority_icon(3) == "📌"
        assert LinearAPI.priority_icon(4) == "💤"
    
    def test_update_issue_no_fields(self, mock_config):
        """Test update_issue fails with no fields."""
        api = LinearAPI(config=mock_config)
        
        with pytest.raises(LinearError, match="No update fields provided"):
            api.update_issue("TEST-1")
