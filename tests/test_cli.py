"""Tests for the CLI module."""

import json
from click.testing import CliRunner
import pytest
import responses

from linear_todos.cli import cli
from linear_todos.config import Config


LINEAR_API_URL = "https://api.linear.app/graphql"


class TestCLI:
    """Test cases for CLI commands."""
    
    @pytest.fixture
    def runner(self):
        """Create a CliRunner instance."""
        return CliRunner()
    
    @pytest.fixture
    def mock_config(self, tmp_path, monkeypatch):
        """Create a mock config with test values."""
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
    
    def test_cli_help(self, runner):
        """Test CLI help output."""
        result = runner.invoke(cli, ['--help'])
        assert result.exit_code == 0
        assert 'Linear Todo CLI' in result.output
    
    def test_create_help(self, runner):
        """Test create command help."""
        result = runner.invoke(cli, ['create', '--help'])
        assert result.exit_code == 0
        assert 'Create a new todo' in result.output
    
    def test_list_help(self, runner):
        """Test list command help."""
        result = runner.invoke(cli, ['list', '--help'])
        assert result.exit_code == 0
        assert 'List all todos' in result.output
    
    def test_done_help(self, runner):
        """Test done command help."""
        result = runner.invoke(cli, ['done', '--help'])
        assert result.exit_code == 0
        assert 'Mark a todo as done' in result.output
    
    def test_snooze_help(self, runner):
        """Test snooze command help."""
        result = runner.invoke(cli, ['snooze', '--help'])
        assert result.exit_code == 0
        assert 'Snooze a todo' in result.output
    
    def test_create_no_title(self, runner, mock_config):
        """Test create fails without title."""
        result = runner.invoke(cli, ['create'])
        assert result.exit_code != 0
        assert 'Title is required' in result.output or result.exit_code == 2
    
    def test_create_no_team(self, runner, tmp_path, monkeypatch):
        """Test create fails without team configuration."""
        # Create config without team
        config_dir = tmp_path / ".config" / "linear-todos"
        config_dir.mkdir(parents=True)
        config_file = config_dir / "config.json"
        config_file.write_text(json.dumps({"apiKey": "test_key"}))
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)
        
        result = runner.invoke(cli, ['create', 'Test Todo'])
        assert result.exit_code == 1
        assert 'Team ID not configured' in result.output
    
    @responses.activate
    def test_create_success(self, runner, mock_config):
        """Test creating a todo successfully."""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {
                            "id": "issue123",
                            "identifier": "TEST-1",
                            "title": "Test Todo",
                            "url": "https://linear.app/issue/TEST-1",
                            "dueDate": None
                        }
                    }
                }
            },
            status=200
        )
        
        result = runner.invoke(cli, ['create', 'Test Todo'])
        assert result.exit_code == 0
        assert 'Creating todo: Test Todo' in result.output
        assert '✓ Created: TEST-1' in result.output
    
    @responses.activate
    def test_create_with_priority(self, runner, mock_config):
        """Test creating a todo with priority."""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {
                            "id": "issue123",
                            "identifier": "TEST-1",
                            "title": "Urgent Todo",
                            "url": "https://linear.app/issue/TEST-1",
                            "dueDate": None
                        }
                    }
                }
            },
            status=200
        )
        
        result = runner.invoke(cli, ['create', 'Urgent Todo', '--priority', 'urgent'])
        assert result.exit_code == 0
        assert 'Priority: Urgent' in result.output
    
    @responses.activate
    def test_create_with_when(self, runner, mock_config):
        """Test creating a todo with --when option."""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {
                            "id": "issue123",
                            "identifier": "TEST-1",
                            "title": "Test Todo",
                            "url": "https://linear.app/issue/TEST-1",
                            "dueDate": "2025-02-22T23:59:59.000Z"
                        }
                    }
                }
            },
            status=200
        )
        
        result = runner.invoke(cli, ['create', 'Test Todo', '--when', 'week'])
        assert result.exit_code == 0
        assert 'Due: Week' in result.output
    
    @responses.activate
    def test_create_with_date(self, runner, mock_config):
        """Test creating a todo with --date option."""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "issueCreate": {
                        "success": True,
                        "issue": {
                            "id": "issue123",
                            "identifier": "TEST-1",
                            "title": "Test Todo",
                            "url": "https://linear.app/issue/TEST-1",
                            "dueDate": "2025-04-15T23:59:59.000Z"
                        }
                    }
                }
            },
            status=200
        )
        
        result = runner.invoke(cli, ['create', 'Test Todo', '--date', '2025-04-15'])
        assert result.exit_code == 0
        assert 'Due: Due: 2025-04-15' in result.output
    
    def test_create_conflicting_options(self, runner, mock_config):
        """Test create fails with both --when and --date."""
        result = runner.invoke(cli, ['create', 'Test', '--when', 'day', '--date', 'tomorrow'])
        assert result.exit_code == 1
        assert 'Cannot use both --when and --date' in result.output
    
    def test_create_invalid_date(self, runner, mock_config):
        """Test create fails with invalid date."""
        result = runner.invoke(cli, ['create', 'Test', '--date', 'invalid date'])
        assert result.exit_code == 1
        assert 'Could not parse date' in result.output
    
    @responses.activate
    def test_list_success(self, runner, mock_config):
        """Test listing todos."""
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
                                    "dueDate": "2025-04-15T23:59:59.000Z",
                                    "state": {"name": "Todo"}
                                },
                                {
                                    "id": "issue2",
                                    "identifier": "TEST-2",
                                    "title": "Second Todo",
                                    "priority": 0,
                                    "dueDate": None,
                                    "state": {"name": "In Progress"}
                                }
                            ]
                        }
                    }
                }
            },
            status=200
        )
        
        result = runner.invoke(cli, ['list'])
        assert result.exit_code == 0
        assert 'TEST-1' in result.output
        assert 'TEST-2' in result.output
        assert 'First Todo' in result.output
        assert 'High' in result.output  # Priority label
    
    @responses.activate
    def test_list_json_output(self, runner, mock_config):
        """Test listing todos with JSON output."""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={
                "data": {
                    "team": {
                        "issues": {
                            "nodes": [{"id": "issue1", "identifier": "TEST-1", "title": "Test"}]
                        }
                    }
                }
            },
            status=200
        )
        
        result = runner.invoke(cli, ['list', '--json'])
        assert result.exit_code == 0
        # Should be valid JSON
        data = json.loads(result.output)
        assert len(data) == 1
        assert data[0]["identifier"] == "TEST-1"
    
    @responses.activate
    def test_list_empty(self, runner, mock_config):
        """Test listing with no todos."""
        responses.add(
            responses.POST,
            LINEAR_API_URL,
            json={"data": {"team": {"issues": {"nodes": []}}}},
            status=200
        )
        
        result = runner.invoke(cli, ['list'])
        assert result.exit_code == 0
        assert 'No todos found' in result.output
    
    @responses.activate
    def test_done_success(self, runner, mock_config):
        """Test marking a todo as done."""
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
                            "title": "Completed Todo",
                            "state": {"name": "Done"}
                        }
                    }
                }
            },
            status=200
        )
        
        result = runner.invoke(cli, ['done', 'TEST-1'])
        assert result.exit_code == 0
        assert '✓ TEST-1 marked as Done' in result.output
    
    def test_done_no_state_configured(self, runner, tmp_path, monkeypatch):
        """Test done fails without done state configured."""
        config_dir = tmp_path / ".config" / "linear-todos"
        config_dir.mkdir(parents=True)
        config_file = config_dir / "config.json"
        config_file.write_text(json.dumps({
            "apiKey": "test_key",
            "teamId": "test_team"
        }))
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)
        
        result = runner.invoke(cli, ['done', 'TEST-1'])
        assert result.exit_code == 1
        assert 'Done state ID not configured' in result.output
    
    @responses.activate
    def test_snooze_success(self, runner, mock_config):
        """Test snoozing a todo."""
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
                            "title": "Snoozed Todo"
                        }
                    }
                }
            },
            status=200
        )
        
        result = runner.invoke(cli, ['snooze', 'TEST-1', 'tomorrow'])
        assert result.exit_code == 0
        assert 'snoozed to' in result.output
    
    def test_snooze_invalid_date(self, runner, mock_config):
        """Test snooze fails with invalid date."""
        result = runner.invoke(cli, ['snooze', 'TEST-1', 'invalid date'])
        assert result.exit_code == 1
        assert 'Could not parse date' in result.output
    
    @responses.activate
    def test_review_success(self, runner, mock_config):
        """Test review command."""
        from datetime import datetime
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
                                    "title": "Overdue Todo",
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
                                }
                            ]
                        }
                    }
                }
            },
            status=200
        )
        
        result = runner.invoke(cli, ['review'])
        assert result.exit_code == 0
        # The output format uses markdown-style formatting
        assert 'TEST-1' in result.output or 'All caught up' in result.output
    
    @responses.activate
    def test_digest_success_with_tasks(self, runner, mock_config):
        """Test digest command with today's tasks."""
        from datetime import datetime
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
                                    "title": "Due Today Task",
                                    "priority": 1,
                                    "dueDate": f"{today_str}T23:59:59.000Z",
                                    "archivedAt": None,
                                    "state": {"name": "Todo"}
                                }
                            ]
                        }
                    }
                }
            },
            status=200
        )

        result = runner.invoke(cli, ['digest'])
        assert result.exit_code == 0
        # Should have a greeting and the task
        assert 'TEST-1' in result.output
        assert 'Due Today Task' in result.output

    @responses.activate
    def test_digest_success_empty(self, runner, mock_config):
        """Test digest command with no tasks due today."""
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
                                    "title": "Future Task",
                                    "priority": 1,
                                    "dueDate": "2099-12-31T23:59:59.000Z",  # Far future
                                    "archivedAt": None,
                                    "state": {"name": "Todo"}
                                }
                            ]
                        }
                    }
                }
            },
            status=200
        )

        result = runner.invoke(cli, ['digest'])
        assert result.exit_code == 0
        # Should show a "no tasks" greeting
        assert 'no fires to put out' in result.output or 'chill day' in result.output or 'free' in result.output or 'Clear skies' in result.output

    @responses.activate
    def test_digest_includes_overdue(self, runner, mock_config):
        """Test digest includes overdue tasks."""
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
                                }
                            ]
                        }
                    }
                }
            },
            status=200
        )

        result = runner.invoke(cli, ['digest'])
        assert result.exit_code == 0
        assert 'TEST-1' in result.output
        assert 'Overdue Task' in result.output

    @responses.activate
    def test_digest_skips_archived(self, runner, mock_config):
        """Test digest skips archived items."""
        from datetime import datetime
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
                                    "title": "Archived Task",
                                    "priority": 1,
                                    "dueDate": f"{today_str}T23:59:59.000Z",
                                    "archivedAt": "2024-01-01T00:00:00.000Z",  # Archived
                                    "state": {"name": "Todo"}
                                }
                            ]
                        }
                    }
                }
            },
            status=200
        )

        result = runner.invoke(cli, ['digest'])
        assert result.exit_code == 0
        # Should show no tasks greeting since archived is skipped
        assert 'TEST-1' not in result.output

    def test_digest_help(self, runner):
        """Test digest command help."""
        result = runner.invoke(cli, ['digest', '--help'])
        assert result.exit_code == 0
        assert "morning digest" in result.output.lower() or "today's todos" in result.output.lower()

    @responses.activate
    def test_api_error_handling(self, runner, mock_config):
        """Test CLI handles API errors gracefully."""
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
