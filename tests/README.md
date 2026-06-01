# Testing

This directory contains tests for the linear-todos skill using pytest.

## Quick Start

```bash
# Run all tests
uv run pytest tests/ -v

# Run with coverage report
uv run pytest tests/ --cov

# Run specific test file
uv run pytest tests/test_e2e.py -v
uv run pytest tests/test_cli.py -v

# Run specific test
uv run pytest tests/test_dates.py::TestDateParser::test_parse_tomorrow -v
```

## Test Files

| File | Tests | Purpose |
|------|-------|---------|
| `test_api.py` | 16 | Linear API client tests |
| `test_cli.py` | 20+ | CLI command tests (create, list, done, snooze, review) |
| `test_config.py` | 7 | Configuration loading tests |
| `test_dates.py` | 20+ | Date parsing tests |
| `test_e2e.py` | 36 | End-to-end workflow tests |
| `conftest.py` | - | Shared pytest fixtures |

**Total: 106 tests**

## Test Coverage

### API Tests (`test_api.py`)

- API initialization with key/config
- GraphQL query execution
- Issue creation and updates
- Priority conversions
- Error handling

### CLI Tests (`test_cli.py`)

- Command help text
- Create with all options (when, date, priority, desc)
- List with JSON and --all flags
- Done command state transitions
- Snooze date parsing
- Review output format
- Error handling

### Config Tests (`test_config.py`)

- File loading
- Environment variable overrides
- Legacy credential fallback
- Save functionality

### Date Tests (`test_dates.py`)

- Natural language parsing
- Relative dates (today, tomorrow, in X days)
- Weekday parsing (next Monday, Friday)
- ISO format dates
- Date to datetime conversion

### E2E Tests (`test_e2e.py`)

- Full workflow tests with mocked API
- All create combinations
- List variations
- Done and snooze workflows
- Review categorization

## CI/CD

Tests run automatically on GitHub Actions for every push and PR.

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
- pytest with coverage
- All 106 tests must pass
- Coverage report generated
```

### Local CI Simulation

```bash
cd skills/linear-todos

# Install dependencies
uv sync

# Run tests
uv run pytest tests/ -v --cov

# Check coverage report
open htmlcov/index.html
```

## Adding Tests

### Test Pattern

```python
def test_my_feature(self, runner, mock_config):
    """Test description."""
    with responses.RequestsMock() as rsps:
        # Mock API response
        rsps.add(
            responses.POST,
            LINEAR_API_URL,
            json={"data": {...}},
            status=200
        )
        
        # Run command
        result = runner.invoke(cli, ['command', 'args'])
        
        # Assert
        assert result.exit_code == 0
        assert 'expected' in result.output
```

### Fixtures

- `runner` — Click CliRunner instance
- `mock_config` — Config file with test values
- `mock_config_file` — Config file path

## Mocking

All tests use the `responses` library to mock HTTP calls to the Linear API. No real API calls are made during testing.
