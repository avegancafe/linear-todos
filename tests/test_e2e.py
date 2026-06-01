"""Comprehensive end-to-end tests for the Linear Todos CLI.

This test suite verifies all CLI features using mocked API responses.

IMPORTANT: All tests use @responses.activate or responses.RequestsMock() to mock
HTTP requests to the Linear API. NO REAL API CALLS ARE MADE, so no cleanup is needed.
Test tickets are not actually created in Linear - all responses are simulated.

For real integration tests against the actual Linear API, you would need to:
1. Create a test ticket
2. Verify it was created
3. Clean up by canceling it (issueUpdate with state type "canceled")
4. Or update title to "[TEST - DELETE ME]" for manual cleanup
"""

import json
import os
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from click.testing import CliRunner
import pytest
import responses

from linear_todos.cli import cli
from linear_todos.config import Config


LINEAR_API_URL = "https://api.linear.app/graphql"


@pytest.fixture
def runner():
    """Create a CliRunner instance."""
    return CliRunner()


@pytest.fixture
def mock_config_file(tmp_path, monkeypatch):
    """Create a mock config file with test values."""
    config_dir = tmp_path / ".config" / "linear-todos"
    config_dir.mkdir(parents=True)
    config_file = config_dir / "config.json"
    config_file.write_text(json.dumps({
        "apiKey": "test_api_key",
        "teamId": "test_team_id",
        "stateId": "test_state_id",
        "doneStateId": "test_done_state_id"
    }))
    
    monkeypatch.setattr(Config, "CONFIG_FILE", config_file)
    return config_file


@pytest.fixture
def minimal_config_file(tmp_path, monkeypatch):
    """Create a minimal mock config file (no done state)."""
    config_dir = tmp_path / ".config" / "linear-todos"
    config_dir.mkdir(parents=True)
    config_file = config_dir / "config.json"
    config_file.write_text(json.dumps({
        "apiKey": "test_api_key",
        "teamId": "test_team_id"
    }))
    
    monkeypatch.setattr(Config, "CONFIG_FILE", config_file)
    return config_file


# =============================================================================
# SETUP & CONFIG TESTS
# =============================================================================

class TestSetupAndConfig:
    """Test configuration loading and validation."""
    
    def test_config_from_file(self, runner, mock_config_file):
        """Verify config loads correctly from file."""
        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                LINEAR_API_URL,
                json={
                    "data": {
                        "issueCreate": {
                            "success": True,
                            "issue": {"id": "1", "identifier": "TEST-1", "title": "Test", "url": "https://linear.app/TEST-1", "dueDate": None}
                        }
                    }
                }
            )
            result = runner.invoke(cli, ['create', 'Test'])
            assert result.exit_code == 0, f"Failed with: {result.output}"
    
    def test_config_from_env_vars(self, runner, tmp_path, monkeypatch):
        """Verify config loads from environment variables."""
        # Create empty config file
        config_dir = tmp_path / ".config" / "linear-todos"
        config_dir.mkdir(parents=True)
        config_file = config_dir / "config.json"
        config_file.write_text(json.dumps({}))
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)
        
        # Set env vars
        monkeypatch.setenv("LINEAR_API_KEY", "env_api_key")
        monkeypatch.setenv("LINEAR_TEAM_ID", "env_team_id")
        monkeypatch.setenv("LINEAR_STATE_ID", "env_state_id")
        monkeypatch.setenv("LINEAR_DONE_STATE_ID", "env_done_state_id")
        
        # Need to reload the module to pick up env vars
        with responses.RequestsMock() as rsps:
            rsps.add(
                responses.POST,
                LINEAR_API_URL,
                json={
                    "data": {
                        "issueCreate": {
                            "success": True,
                            "issue": {"id": "1", "identifier": "TEST-1", "title": "Test", "url": "https://linear.app/TEST-1", "dueDate": None}
                        }
                    }
                }
            )
            result = runner.invoke(cli, ['create', 'Test'])
            assert result.exit_code == 0, f"Failed with: {result.output}"
    
    def test_missing_api_key_shows_error(self, runner, tmp_path, monkeypatch):
        """Test that missing API key shows proper error."""
        config_dir = tmp_path / ".config" / "linear-todos"
        config_dir.mkdir(parents=True)
        config_file = config_dir / "config.json"
        config_file.write_text(json.dumps({"teamId": "test_team"}))
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)
        
        result = runner.invoke(cli, ['create', 'Test'])
        assert result.exit_code == 1
        # The API will fail when trying to make request without key
    
    def test_missing_team_id_shows_error(self, runner, tmp_path, monkeypatch):
        """Test that missing team ID shows proper error."""
        config_dir = tmp_path / ".config" / "linear-todos"
        config_dir.mkdir(parents=True)
        config_file = config_dir / "config.json"
        config_file.write_text(json.dumps({"apiKey": "test_key"}))
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)
        
        result = runner.invoke(cli, ['create', 'Test'])
        assert result.exit_code == 1
        assert 'Team ID not configured' in result.output


# =============================================================================
# CREATE COMMAND TESTS
# =============================================================================

class TestCreateCommand:
    """Test the create command with all combinations."""
    
    @responses.activate
    def test_create_basic(self, runner, mock_config_file):
        """Basic create: `create "Test ticket"`"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {
                            "id": "issue1",
                            "identifier": "TEST-1",
                            "title": "Test ticket",
                            "url": "https://linear.app/TEST-1",
                            "dueDate": None
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['create', 'Test ticket'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert '✓ Created: TEST-1' in result.output
    
    @responses.activate
    def test_create_with_when_day(self, runner, mock_config_file):
        """Create with --when day"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {
                            "id": "issue1",
                            "identifier": "TEST-1",
                            "title": "Test",
                            "url": "https://linear.app/TEST-1",
                            "dueDate": "2025-02-16T23:59:59.000Z"
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['create', 'Test', '--when', 'day'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert 'Due: Day' in result.output or 'Due:' in result.output
    
    @responses.activate
    def test_create_with_when_week(self, runner, mock_config_file):
        """Create with --when week"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {
                            "id": "issue1",
                            "identifier": "TEST-1",
                            "title": "Test",
                            "url": "https://linear.app/TEST-1",
                            "dueDate": "2025-02-23T23:59:59.000Z"
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['create', 'Test', '--when', 'week'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert 'Due: Week' in result.output or 'Due:' in result.output
    
    @responses.activate
    def test_create_with_when_month(self, runner, mock_config_file):
        """Create with --when month"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {
                            "id": "issue1",
                            "identifier": "TEST-1",
                            "title": "Test",
                            "url": "https://linear.app/TEST-1",
                            "dueDate": "2025-03-16T23:59:59.000Z"
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['create', 'Test', '--when', 'month'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert 'Due: Month' in result.output or 'Due:' in result.output
    
    @responses.activate
    def test_create_with_date_iso_format(self, runner, mock_config_file):
        """Create with --date ISO format: 2025-12-25"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {
                            "id": "issue1",
                            "identifier": "TEST-1",
                            "title": "Test",
                            "url": "https://linear.app/TEST-1",
                            "dueDate": "2025-12-25T23:59:59.000Z"
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['create', 'Test', '--date', '2025-12-25'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert '2025-12-25' in result.output
    
    @responses.activate
    def test_create_with_date_tomorrow(self, runner, mock_config_file):
        """Create with --date natural language: tomorrow"""
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {
                            "id": "issue1",
                            "identifier": "TEST-1",
                            "title": "Test",
                            "url": "https://linear.app/TEST-1",
                            "dueDate": f"{tomorrow}T23:59:59.000Z"
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['create', 'Test', '--date', 'tomorrow'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert 'Due:' in result.output
    
    @responses.activate
    def test_create_with_date_next_monday(self, runner, mock_config_file):
        """Create with --date natural language: next Monday"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {
                            "id": "issue1",
                            "identifier": "TEST-1",
                            "title": "Test",
                            "url": "https://linear.app/TEST-1",
                            "dueDate": "2025-02-24T23:59:59.000Z"
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['create', 'Test', '--date', 'next Monday'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert 'Due:' in result.output
    
    @pytest.mark.parametrize("priority,expected_label", [
        ("urgent", "Urgent"),
        ("high", "High"),
        ("normal", "Normal"),
        ("low", "Low"),
    ])
    @responses.activate
    def test_create_with_priority(self, runner, mock_config_file, priority, expected_label):
        """Create with --priority levels"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {
                            "id": "issue1",
                            "identifier": "TEST-1",
                            "title": f"{expected_label} Todo",
                            "url": "https://linear.app/TEST-1",
                            "dueDate": None
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['create', f'{expected_label} Todo', '--priority', priority])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert f'Priority: {expected_label}' in result.output
    
    @responses.activate
    def test_create_with_description(self, runner, mock_config_file):
        """Create with --desc"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {
                            "id": "issue1",
                            "identifier": "TEST-1",
                            "title": "Test with desc",
                            "url": "https://linear.app/TEST-1",
                            "dueDate": None
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['create', 'Test with desc', '--desc', 'This is a detailed description'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert '✓ Created: TEST-1' in result.output
    
    @responses.activate
    def test_create_combined_priority_date_description(self, runner, mock_config_file):
        """Create with priority + date + description combined"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {
                            "id": "issue1",
                            "identifier": "TEST-1",
                            "title": "Complex Todo",
                            "url": "https://linear.app/TEST-1",
                            "dueDate": "2025-03-15T23:59:59.000Z"
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, [
            'create', 'Complex Todo',
            '--priority', 'high',
            '--date', '2025-03-15',
            '--desc', 'A complex task with all options'
        ])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert '✓ Created: TEST-1' in result.output
        assert 'Priority: High' in result.output
    
    def test_create_conflicting_when_and_date(self, runner, mock_config_file):
        """Verify error on --when + --date conflict"""
        result = runner.invoke(cli, ['create', 'Test', '--when', 'day', '--date', 'tomorrow'])
        assert result.exit_code == 1
        assert 'Cannot use both --when and --date' in result.output
    
    def test_create_missing_title(self, runner, mock_config_file):
        """Verify error on missing title"""
        result = runner.invoke(cli, ['create'])
        assert result.exit_code != 0
        # Click will exit with code 2 for missing argument
        assert result.exit_code == 2 or 'Title is required' in result.output
    
    def test_create_invalid_date(self, runner, mock_config_file):
        """Test create fails with invalid date"""
        result = runner.invoke(cli, ['create', 'Test', '--date', 'invalid date'])
        assert result.exit_code == 1
        assert 'Could not parse date' in result.output


# =============================================================================
# LIST COMMAND TESTS
# =============================================================================

class TestListCommand:
    """Test the list command with various options."""
    
    @responses.activate
    def test_list_basic(self, runner, mock_config_file):
        """Basic list command"""
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
                                    "title": "First Todo",
                                    "priority": 2,
                                    "dueDate": "2025-02-20T23:59:59.000Z",
                                    "archivedAt": None,
                                    "state": {"name": "Todo"}
                                },
                                {
                                    "id": "issue2",
                                    "identifier": "TEST-2",
                                    "title": "Second Todo",
                                    "priority": 0,
                                    "dueDate": None,
                                    "archivedAt": None,
                                    "state": {"name": "In Progress"}
                                }
                            ]
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['list'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert 'TEST-1' in result.output
        assert 'TEST-2' in result.output
        assert 'First Todo' in result.output
    
    @responses.activate
    def test_list_json_output(self, runner, mock_config_file):
        """List with --json output"""
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
                                    "title": "Test Todo",
                                    "priority": 1,
                                    "dueDate": None,
                                    "archivedAt": None,
                                    "state": {"name": "Todo"}
                                }
                            ]
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['list', '--json'])
        assert result.exit_code == 0, f"Output: {result.output}"
        
        # Verify valid JSON
        data = json.loads(result.output)
        assert len(data) == 1
        assert data[0]["identifier"] == "TEST-1"
    
    @responses.activate
    def test_list_all(self, runner, mock_config_file):
        """List with --all (include completed)"""
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
                                    "title": "Active Todo",
                                    "priority": 0,
                                    "dueDate": None,
                                    "archivedAt": None,
                                    "state": {"name": "Todo"}
                                },
                                {
                                    "id": "issue2",
                                    "identifier": "TEST-2",
                                    "title": "Completed Todo",
                                    "priority": 0,
                                    "dueDate": None,
                                    "archivedAt": None,
                                    "state": {"name": "Done"}
                                }
                            ]
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['list', '--all'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert 'Active Todo' in result.output
    
    @responses.activate
    def test_list_empty(self, runner, mock_config_file):
        """Empty list handling"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "team": {
                        "issues": {
                            "nodes": []
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['list'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert 'No todos found' in result.output


# =============================================================================
# DONE COMMAND TESTS
# =============================================================================

class TestDoneCommand:
    """Test the done command."""
    
    @responses.activate
    def test_done_success(self, runner, mock_config_file):
        """Mark ticket as done"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueUpdate": {
                        "success": True,
                        "issue": {
                            "id": "issue1",
                            "identifier": "TEST-1",
                            "title": "Completed Todo",
                            "state": {"id": "done_state", "name": "Done"}
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['done', 'TEST-1'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert '✓ TEST-1 marked as Done' in result.output or 'Done' in result.output
    
    def test_done_no_state_configured(self, runner, minimal_config_file):
        """Verify error when done state not configured"""
        result = runner.invoke(cli, ['done', 'TEST-1'])
        assert result.exit_code == 1
        assert 'Done state ID not configured' in result.output
    
    @responses.activate
    def test_done_state_transition_verified(self, runner, mock_config_file):
        """Verify proper state transition"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueUpdate": {
                        "success": True,
                        "issue": {
                            "id": "issue1",
                            "identifier": "TEST-1",
                            "title": "Todo Title",
                            "state": {"id": "test_done_state_id", "name": "Done"}
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['done', 'TEST-1'])
        assert result.exit_code == 0, f"Output: {result.output}"
        # Verify the state was updated to "Done"
        assert 'Done' in result.output


# =============================================================================
# SNOOZE COMMAND TESTS
# =============================================================================

class TestSnoozeCommand:
    """Test the snooze command with various date formats."""
    
    @responses.activate
    def test_snooze_tomorrow(self, runner, mock_config_file):
        """Snooze to tomorrow"""
        tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueUpdate": {
                        "success": True,
                        "issue": {
                            "id": "issue1",
                            "identifier": "TEST-1",
                            "title": "Snoozed Todo",
                            "dueDate": f"{tomorrow}T23:59:59.000Z"
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['snooze', 'TEST-1', 'tomorrow'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert 'snoozed to' in result.output or 'snoozed' in result.output.lower()
    
    @responses.activate
    def test_snooze_next_friday(self, runner, mock_config_file):
        """Snooze to next Friday"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueUpdate": {
                        "success": True,
                        "issue": {
                            "id": "issue1",
                            "identifier": "TEST-1",
                            "title": "Snoozed Todo",
                            "dueDate": "2025-02-21T23:59:59.000Z"
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['snooze', 'TEST-1', 'next Friday'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert 'snoozed' in result.output.lower()
    
    @responses.activate
    def test_snooze_specific_date(self, runner, mock_config_file):
        """Snooze to specific date (ISO format)"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueUpdate": {
                        "success": True,
                        "issue": {
                            "id": "issue1",
                            "identifier": "TEST-1",
                            "title": "Snoozed Todo",
                            "dueDate": "2025-04-01T23:59:59.000Z"
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['snooze', 'TEST-1', '2025-04-01'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert 'snoozed' in result.output.lower()
        assert '2025-04-01' in result.output
    
    def test_snooze_invalid_date(self, runner, mock_config_file):
        """Snooze with invalid date shows error"""
        result = runner.invoke(cli, ['snooze', 'TEST-1', 'invalid date'])
        assert result.exit_code == 1
        assert 'Could not parse date' in result.output


# =============================================================================
# REVIEW COMMAND TESTS
# =============================================================================

class TestReviewCommand:
    """Test the review command output."""
    
    @responses.activate
    def test_review_categorization(self, runner, mock_config_file):
        """Generate daily review and verify categorization"""
        today = datetime.utcnow()
        today_str = today.strftime("%Y-%m-%d")
        
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
                                    "title": "Overdue Task",
                                    "priority": 1,
                                    "dueDate": "2024-01-01T23:59:59.000Z",  # Past date
                                    "archivedAt": None,
                                    "state": {"name": "Todo"}
                                },
                                {
                                    "id": "issue2",
                                    "identifier": "TEST-2",
                                    "title": "Due Today",
                                    "priority": 2,
                                    "dueDate": f"{today_str}T23:59:59.000Z",
                                    "archivedAt": None,
                                    "state": {"name": "Todo"}
                                },
                                {
                                    "id": "issue3",
                                    "identifier": "TEST-3",
                                    "title": "High Priority No Due",
                                    "priority": 2,  # High priority
                                    "dueDate": None,
                                    "archivedAt": None,
                                    "state": {"name": "Todo"}
                                },
                                {
                                    "id": "issue4",
                                    "identifier": "TEST-4",
                                    "title": "Normal Task",
                                    "priority": 3,
                                    "dueDate": None,
                                    "archivedAt": None,
                                    "state": {"name": "Todo"}
                                }
                            ]
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['review'])
        assert result.exit_code == 0, f"Output: {result.output}"
        # Verify output contains expected items
        assert 'TEST-1' in result.output  # Overdue
        assert 'TEST-2' in result.output  # Due today
    
    @responses.activate
    def test_review_empty(self, runner, mock_config_file):
        """Review with no todos"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "team": {
                        "issues": {
                            "nodes": []
                        }
                    }
                }
            }
        )

        result = runner.invoke(cli, ['review'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert 'Do Today' in result.output
        assert 'nothing to see here' in result.output
    
    @responses.activate
    def test_review_archived_skipped(self, runner, mock_config_file):
        """Review should skip archived items"""
        today = datetime.utcnow()
        today_str = today.strftime("%Y-%m-%d")
        
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
                                    "title": "Active Task",
                                    "priority": 0,
                                    "dueDate": None,
                                    "archivedAt": None,
                                    "state": {"name": "Todo"}
                                },
                                {
                                    "id": "issue2",
                                    "identifier": "TEST-2",
                                    "title": "Archived Task",
                                    "priority": 0,
                                    "dueDate": None,
                                    "archivedAt": f"{today_str}T12:00:00.000Z",
                                    "state": {"name": "Todo"}
                                }
                            ]
                        }
                    }
                }
            }
        )
        
        result = runner.invoke(cli, ['review'])
        assert result.exit_code == 0, f"Output: {result.output}"
        assert 'TEST-1' in result.output
        assert 'TEST-2' not in result.output  # Archived should be skipped


# =============================================================================
# ERROR HANDLING TESTS
# =============================================================================

class TestErrorHandling:
    """Test CLI error handling."""
    
    @responses.activate
    def test_api_error_handling(self, runner, mock_config_file):
        """Test CLI handles API errors gracefully"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "errors": [{"message": "Issue not found"}]
            },
            status=200
        )
        
        result = runner.invoke(cli, ['done', 'INVALID-123'])
        assert result.exit_code == 1
        assert 'Error' in result.output
    
    @responses.activate
    def test_network_error_handling(self, runner, mock_config_file):
        """Test CLI handles network errors"""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            body=Exception("Connection refused")
        )
        
        result = runner.invoke(cli, ['list'])
        assert result.exit_code == 1
