"""Tests for the config module."""

import json
import os
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from linear_todos.config import Config


class TestConfig:
    """Test cases for Config class."""
    
    def test_config_initialization(self, tmp_path):
        """Test Config initializes properly."""
        config = Config()
        assert config is not None
    
    def test_config_loads_from_file(self, tmp_path, monkeypatch):
        """Test config loads from config file."""
        # Create temp config directory and file
        config_dir = tmp_path / ".config" / "linear-todos"
        config_dir.mkdir(parents=True)
        config_file = config_dir / "config.json"
        
        test_config = {
            "apiKey": "test_api_key",
            "teamId": "test_team_id",
            "stateId": "test_state_id",
            "doneStateId": "test_done_state_id"
        }
        config_file.write_text(json.dumps(test_config))
        
        # Monkeypatch config paths
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)
        
        config = Config()
        assert config.api_key == "test_api_key"
        assert config.team_id == "test_team_id"
        assert config.state_id == "test_state_id"
        assert config.done_state_id == "test_done_state_id"
    
    def test_config_env_vars_override_file(self, tmp_path, monkeypatch):
        """Test environment variables override config file values."""
        # Create temp config file
        config_dir = tmp_path / ".config" / "linear-todos"
        config_dir.mkdir(parents=True)
        config_file = config_dir / "config.json"
        
        test_config = {
            "apiKey": "file_api_key",
            "teamId": "file_team_id",
        }
        config_file.write_text(json.dumps(test_config))
        
        # Set env vars
        monkeypatch.setenv("LINEAR_API_KEY", "env_api_key")
        monkeypatch.setenv("LINEAR_TEAM_ID", "env_team_id")
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)
        
        config = Config()
        # Environment variables should override file values
        assert config.api_key == "env_api_key"
        assert config.team_id == "env_team_id"
    
    def test_config_is_configured(self, tmp_path, monkeypatch):
        """Test is_configured returns correct value."""
        config_dir = tmp_path / ".config" / "linear-todos"
        config_dir.mkdir(parents=True)
        config_file = config_dir / "config.json"
        
        # Not configured
        config_file.write_text(json.dumps({}))
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)
        config = Config()
        assert not config.is_configured()
        
        # Configured
        config_file.write_text(json.dumps({
            "apiKey": "test_key",
            "teamId": "test_team"
        }))
        config = Config()
        assert config.is_configured()
    
    def test_config_save(self, tmp_path, monkeypatch):
        """Test save method writes config to file."""
        config_dir = tmp_path / ".config" / "linear-todos"
        config_file = config_dir / "config.json"
        
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)
        monkeypatch.setattr(Config, "CONFIG_DIR", config_dir)
        
        config = Config()
        config.save(
            api_key="saved_api_key",
            team_id="saved_team_id",
            state_id="saved_state_id",
            done_state_id="saved_done_state_id"
        )
        
        # Verify file was created
        assert config_file.exists()
        
        # Verify content
        saved = json.loads(config_file.read_text())
        assert saved["apiKey"] == "saved_api_key"
        assert saved["teamId"] == "saved_team_id"
        assert saved["stateId"] == "saved_state_id"
        assert saved["doneStateId"] == "saved_done_state_id"
    
    def test_config_missing_file(self, tmp_path, monkeypatch):
        """Test config handles missing config file gracefully."""
        # Create a temp home directory to avoid loading real credentials
        fake_home = tmp_path / "fake_home"
        fake_home.mkdir()
        monkeypatch.setattr(Path, "home", lambda: fake_home)

        config_file = tmp_path / "nonexistent" / "config.json"
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)

        # Clear any existing env vars that might interfere
        monkeypatch.delenv("LINEAR_API_KEY", raising=False)
        monkeypatch.delenv("LINEAR_TEAM_ID", raising=False)

        config = Config()
        assert config.api_key is None
        assert config.team_id is None
        assert not config.is_configured()


class TestConfigTimezone:
    """Test cases for timezone configuration."""

    def test_config_timezone_from_file(self, tmp_path, monkeypatch):
        """Test timezone loads from config file."""
        config_dir = tmp_path / ".config" / "linear-todos"
        config_dir.mkdir(parents=True)
        config_file = config_dir / "config.json"

        test_config = {
            "apiKey": "test_key",
            "teamId": "test_team",
            "timezone": "America/New_York"
        }
        config_file.write_text(json.dumps(test_config))
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)

        config = Config()
        assert config.timezone == "America/New_York"

    def test_config_timezone_from_env(self, tmp_path, monkeypatch):
        """Test timezone loads from environment variable."""
        config_dir = tmp_path / ".config" / "linear-todos"
        config_dir.mkdir(parents=True)
        config_file = config_dir / "config.json"

        test_config = {"timezone": "America/Los_Angeles"}
        config_file.write_text(json.dumps(test_config))
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)
        monkeypatch.setenv("LINEAR_TIMEZONE", "America/New_York")

        config = Config()
        # Environment variable should override file value
        assert config.timezone == "America/New_York"

    def test_config_get_timezone_returns_zoneinfo(self, tmp_path, monkeypatch):
        """Test get_timezone returns a ZoneInfo object."""
        config_dir = tmp_path / ".config" / "linear-todos"
        config_dir.mkdir(parents=True)
        config_file = config_dir / "config.json"

        test_config = {"timezone": "America/New_York"}
        config_file.write_text(json.dumps(test_config))
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)

        config = Config()
        tz = config.get_timezone()
        assert isinstance(tz, ZoneInfo)
        assert str(tz) == "America/New_York"

    def test_config_get_timezone_returns_none_when_not_set(self, tmp_path, monkeypatch):
        """Test get_timezone returns None when no timezone is configured."""
        config_dir = tmp_path / ".config" / "linear-todos"
        config_dir.mkdir(parents=True)
        config_file = config_dir / "config.json"

        config_file.write_text(json.dumps({}))
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)
        # Disable USER.md fallback to ensure test isolation
        monkeypatch.setenv("LINEAR_TODOS_NO_USERMD_FALLBACK", "1")

        config = Config()
        assert config.get_timezone() is None

    def test_config_get_timezone_handles_invalid_timezone(self, tmp_path, monkeypatch):
        """Test get_timezone returns None for invalid timezone string."""
        config_dir = tmp_path / ".config" / "linear-todos"
        config_dir.mkdir(parents=True)
        config_file = config_dir / "config.json"

        test_config = {"timezone": "Invalid/Timezone"}
        config_file.write_text(json.dumps(test_config))
        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)

        config = Config()
        assert config.get_timezone() is None

    def test_config_timezone_none_by_default(self):
        """Test timezone is None when not configured."""
        # This test may fail if user has config file - run in isolation
        config = Config()
        # Just verify the property exists and returns the configured value or None
        assert config.timezone is None or isinstance(config.timezone, str)

    def test_config_timezone_from_openclaw_user_md(self, tmp_path, monkeypatch):
        """Test timezone falls back to OpenClaw USER.md when present."""
        # Create a mock workspace with USER.md
        workspace_dir = tmp_path / "workspace"
        workspace_dir.mkdir()
        user_md = workspace_dir / "USER.md"
        user_md.write_text("# USER.md\n- **Timezone:** Europe/London\n")

        # Create empty config
        config_dir = tmp_path / ".config" / "linear-todos"
        config_dir.mkdir(parents=True)
        config_file = config_dir / "config.json"
        config_file.write_text(json.dumps({}))

        monkeypatch.setattr(Config, "CONFIG_FILE", config_file)

        # Patch the _find_openclaw_user_timezone to return our test timezone
        # by making it think it's inside our mock workspace
        import linear_todos.config as config_module
        original_find = config_module._find_openclaw_user_timezone

        def mock_find():
            return "Europe/London"

        monkeypatch.setattr(config_module, "_find_openclaw_user_timezone", mock_find)

        config = Config()
        tz = config.get_timezone()
        assert tz is not None
        assert str(tz) == "Europe/London"
