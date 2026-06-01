"""Cron job management for Linear Todos using Hermes/NemoClaw cron system."""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
from zoneinfo import ZoneInfo


class CronManager:
    """Manages scheduled cron jobs for Linear Todos via Hermes cron system."""

    # Job names used by this skill
    MORNING_DIGEST_NAME = "linear-todos-morning-digest"
    EVENING_REVIEW_NAME = "linear-todos-evening-review"

    # Default schedule times in local timezone (will be converted to UTC)
    DEFAULT_MORNING_HOUR = 8  # 8 AM
    DEFAULT_EVENING_HOUR = 17  # 5 PM

    def __init__(self, timezone: Optional[str] = None):
        """Initialize cron manager.

        Args:
            timezone: Timezone string (e.g., 'America/New_York'). If None, uses UTC.
        """
        self.timezone_str = timezone or "UTC"
        self.tz = ZoneInfo(self.timezone_str) if timezone else ZoneInfo("UTC")

    def _run_hermes_cron(self, args: List[str]) -> Dict[str, Any]:
        """Run hermes cron CLI command and parse output.

        Args:
            args: Command arguments (e.g., ['list'] or ['create', '--help'])

        Returns:
            Parsed response or raises error on failure.
        """
        cmd = ["hermes", "cron"] + args
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )

            # Try to parse JSON output first
            if result.stdout:
                try:
                    return json.loads(result.stdout)
                except json.JSONDecodeError:
                    # Return raw output for text-based commands like 'list'
                    return {
                        "raw_output": result.stdout,
                        "success": result.returncode == 0,
                        "stdout": result.stdout
                    }
            return {"success": result.returncode == 0, "stderr": result.stderr}
        except FileNotFoundError:
            # hermes CLI not available
            return {"error": "hermes CLI not found", "success": False}
        except subprocess.TimeoutExpired:
            return {"error": "Command timed out", "success": False}
        except Exception as e:
            return {"error": str(e), "success": False}

    def _parse_jobs_from_output(self, output: str) -> List[Dict[str, Any]]:
        """Parse job list from hermes cron list text output.

        The output looks like:
          job_id [status]
            Name:      job-name
            Schedule:  schedule
            ...
        """
        jobs = []
        lines = output.split('\n')
        current_job = None

        for line in lines:
            line = line.strip()

            # Look for job ID line: "  job_id [status]"
            if line and not line.startswith(('Name:', 'Schedule:', 'Repeat:', 'Next run:', 'Deliver:', 'Skills:')):
                # Check if it looks like a job ID line
                parts = line.split()
                if len(parts) >= 2 and '[' in parts[1]:
                    if current_job:
                        jobs.append(current_job)
                    current_job = {
                        'job_id': parts[0],
                        'status': parts[1].strip('[]'),
                    }
            elif current_job and line.startswith('Name:'):
                current_job['name'] = line.split(':', 1)[1].strip()
            elif current_job and line.startswith('Schedule:'):
                current_job['schedule'] = line.split(':', 1)[1].strip()
            elif current_job and line.startswith('Repeat:'):
                current_job['repeat'] = line.split(':', 1)[1].strip()
            elif current_job and line.startswith('Next run:'):
                current_job['next_run_at'] = line.split(':', 1)[1].strip()
            elif current_job and line.startswith('Deliver:'):
                current_job['deliver'] = line.split(':', 1)[1].strip()
            elif current_job and line.startswith('Skills:'):
                current_job['skills'] = line.split(':', 1)[1].strip()
                current_job['enabled'] = current_job.get('status') == 'active'

        if current_job:
            jobs.append(current_job)

        return jobs

    def list_jobs(self) -> List[Dict[str, Any]]:
        """List all Hermes cron jobs for this skill.

        Returns:
            List of job dictionaries.
        """
        result = self._run_hermes_cron(["list"])

        if result.get("error"):
            return []

        # Parse from text output
        stdout = result.get("stdout", "")
        jobs = self._parse_jobs_from_output(stdout)

        # Filter to only our jobs
        return [j for j in jobs if self._is_linear_todos_job(j)]

    def _is_linear_todos_job(self, job: Dict[str, Any]) -> bool:
        """Check if a job belongs to linear-todos."""
        name = job.get("name", "")
        return name.startswith("linear-todos-")

    def _local_time_to_utc_iso(self, hour: int, minute: int = 0) -> str:
        """Convert local time to UTC ISO timestamp for today's date.

        Args:
            hour: Hour in local timezone (0-23)
            minute: Minute in local timezone (0-59)

        Returns:
            ISO 8601 timestamp string in UTC.
        """
        # Get current time in local timezone
        now_local = datetime.now(self.tz)

        # Create target time in local timezone
        target_local = now_local.replace(hour=hour, minute=minute, second=0, microsecond=0)

        # If target time already passed today, schedule for tomorrow
        if target_local <= now_local:
            from datetime import timedelta
            target_local = target_local + timedelta(days=1)

        # Convert to UTC
        target_utc = target_local.astimezone(ZoneInfo("UTC"))

        return target_utc.strftime("%Y-%m-%dT%H:%M:%S")

    def create_morning_digest(self, hour: int = None, deliver: str = "origin") -> Dict[str, Any]:
        """Create the morning digest cron job.

        Args:
            hour: Hour in local timezone (default: 8 AM)
            deliver: Delivery target ('origin', 'local', or platform-specific)

        Returns:
            Result dictionary with job info or error.
        """
        hour = hour or self.DEFAULT_MORNING_HOUR

        # Convert local time to UTC timestamp
        schedule_time = self._local_time_to_utc_iso(hour, 0)

        # Find the skill path for the command
        skill_path = self._get_skill_path()
        uv_path = self._get_uv_path()

        cmd_args = [
            "create",
            schedule_time,
            f"Run Linear Todos morning digest at {hour}:00 {self.timezone_str}",
            "--name", self.MORNING_DIGEST_NAME,
            "--deliver", deliver,
            "--repeat", "-1",  # Repeat forever
        ]

        result = self._run_hermes_cron(cmd_args)

        # If successful, update the job to add the command context
        if result.get("success"):
            job_id = result.get("job", {}).get("job_id") or result.get("job_id")
            if job_id:
                self._update_job_with_context(job_id, skill_path, uv_path, "digest")

        return result

    def create_evening_review(self, hour: int = None, deliver: str = "origin") -> Dict[str, Any]:
        """Create the evening review cron job.

        Args:
            hour: Hour in local timezone (default: 5 PM)
            deliver: Delivery target ('origin', 'local', or platform-specific)

        Returns:
            Result dictionary with job info or error.
        """
        hour = hour or self.DEFAULT_EVENING_HOUR

        # Convert local time to UTC timestamp
        schedule_time = self._local_time_to_utc_iso(hour, 0)

        # Find the skill path for the command
        skill_path = self._get_skill_path()
        uv_path = self._get_uv_path()

        cmd_args = [
            "create",
            schedule_time,
            f"Run Linear Todos evening review at {hour}:00 {self.timezone_str}",
            "--name", self.EVENING_REVIEW_NAME,
            "--deliver", deliver,
            "--repeat", "-1",  # Repeat forever
        ]

        result = self._run_hermes_cron(cmd_args)

        # If successful, update the job to add the command context
        if result.get("success"):
            job_id = result.get("job", {}).get("job_id") or result.get("job_id")
            if job_id:
                self._update_job_with_context(job_id, skill_path, uv_path, "review")

        return result

    def _get_skill_path(self) -> str:
        """Get the path to the linear-todos skill directory."""
        # Try to find the skill directory
        possible_paths = [
            Path.home() / ".hermes" / "skills" / "linear-todos",
            Path.home() / ".openclaw" / "skills" / "linear-todos",
            Path.home() / ".clawhub" / "skills" / "linear-todos",
            Path(__file__).parent.parent.parent,  # src/linear_todos/ -> skill root
        ]

        for path in possible_paths:
            if path.exists() and (path / "main.py").exists():
                return str(path)

        # Fallback: return current working directory assumption
        return str(Path.home() / ".hermes" / "skills" / "linear-todos")

    def _get_uv_path(self) -> str:
        """Get the path to the uv executable."""
        # Try to find uv
        possible_paths = [
            Path.home() / ".local" / "bin" / "uv",
            Path("/usr") / "local" / "bin" / "uv",
            Path("/usr") / "bin" / "uv",
        ]

        for path in possible_paths:
            if path.exists():
                return str(path)

        # Try which command
        try:
            result = subprocess.run(["which", "uv"], capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception:
            pass

        return "uv"  # Fallback to just 'uv'

    def _update_job_with_context(self, job_id: str, skill_path: str, uv_path: str, command: str):
        """Update a job with proper working directory and command context.

        This modifies the job to ensure it runs with correct paths.
        """
        # Store job metadata for execution context
        # Note: Hermes cron doesn't directly support working_dir, so we
        # store this info in the job name/prompt for the agent to use
        pass  # Placeholder - actual implementation depends on Hermes capabilities

    def remove_job(self, name: str) -> Dict[str, Any]:
        """Remove a cron job by name.

        Args:
            name: Job name to remove

        Returns:
            Result dictionary.
        """
        # First find the job
        jobs = self.list_jobs()
        for job in jobs:
            if job.get("name") == name:
                job_id = job.get("job_id") or job.get("id")
                if job_id:
                    return self._run_hermes_cron(["remove", job_id])

        return {"error": f"Job '{name}' not found", "success": False}

    def remove_all_jobs(self) -> List[Dict[str, Any]]:
        """Remove all Linear Todos cron jobs.

        Returns:
            List of results for each removal.
        """
        results = []
        jobs = self.list_jobs()

        for job in jobs:
            job_id = job.get("job_id") or job.get("id")
            if job_id:
                result = self._run_hermes_cron(["remove", job_id])
                results.append(result)

        return results

    def setup_default_jobs(self, deliver: str = "origin", timezone: str = None) -> Dict[str, Any]:
        """Setup default morning and evening cron jobs.

        Args:
            deliver: Delivery target
            timezone: Timezone string (overrides instance timezone)

        Returns:
            Summary of setup results.
        """
        if timezone:
            self.timezone_str = timezone
            self.tz = ZoneInfo(timezone)

        # Remove existing jobs first
        self.remove_all_jobs()

        # Create new jobs
        morning_result = self.create_morning_digest(deliver=deliver)
        evening_result = self.create_evening_review(deliver=deliver)

        return {
            "success": morning_result.get("success") and evening_result.get("success"),
            "morning": morning_result,
            "evening": evening_result,
            "timezone": self.timezone_str,
            "note": f"Jobs scheduled in {self.timezone_str} timezone"
        }

    def get_status(self) -> Dict[str, Any]:
        """Get status of all Linear Todos cron jobs.

        Returns:
            Dictionary with job status info.
        """
        jobs = self.list_jobs()

        morning_job = None
        evening_job = None

        for job in jobs:
            name = job.get("name", "")
            if name == self.MORNING_DIGEST_NAME:
                morning_job = job
            elif name == self.EVENING_REVIEW_NAME:
                evening_job = job

        return {
            "morning_digest": morning_job,
            "evening_review": evening_job,
            "total_jobs": len(jobs),
            "configured": morning_job is not None or evening_job is not None,
        }


def setup_cron_interactive(timezone: str = None, deliver: str = "origin"):
    """Interactive setup for cron jobs.

    This can be called from the setup wizard or CLI.

    Args:
        timezone: Timezone string (e.g., 'America/New_York')
        deliver: Delivery target for notifications
    """
    import click

    click.echo()
    click.echo("📅 Cron Job Setup")
    click.echo("================")
    click.echo()

    # Check if hermes CLI is available
    manager = CronManager(timezone=timezone)
    test_result = manager._run_hermes_cron(["--help"])

    if "error" in test_result and "not found" in test_result["error"]:
        click.echo("❌ Hermes CLI not found!")
        click.echo()
        click.echo("Cron jobs require the Hermes/NemoClaw CLI to be available.")
        click.echo("You can manually add cron jobs using your system crontab instead:")
        click.echo()
        click.echo("  crontab -e")
        click.echo()
        skill_path = manager._get_skill_path()
        uv_path = manager._get_uv_path()
        click.echo(f"  # Morning digest (8 AM {timezone or 'UTC'})")
        click.echo(f"  0 8 * * * cd {skill_path} && {uv_path} run python main.py digest")
        click.echo()
        click.echo(f"  # Evening review (5 PM {timezone or 'UTC'})")
        click.echo(f"  0 17 * * * cd {skill_path} && {uv_path} run python main.py review")
        click.echo()
        return False

    # Show current status
    status = manager.get_status()

    if status["configured"]:
        click.echo("Current cron jobs:")
        if status["morning_digest"]:
            click.echo(f"  ✓ Morning digest: {status['morning_digest'].get('schedule', 'unknown')}")
        if status["evening_review"]:
            click.echo(f"  ✓ Evening review: {status['evening_review'].get('schedule', 'unknown')}")
        click.echo()

        if not click.confirm("Would you like to reconfigure cron jobs?"):
            click.echo("Keeping existing cron configuration.")
            return True

        click.echo("Removing existing jobs...")
        manager.remove_all_jobs()

    # Timezone confirmation
    tz = timezone or "UTC"
    click.echo(f"Using timezone: {tz}")
    click.echo()

    # Ask for schedule preferences
    morning_hour = click.prompt(
        "What hour for morning digest? (24-hour format)",
        type=int,
        default=8
    )

    evening_hour = click.prompt(
        "What hour for evening review? (24-hour format)",
        type=int,
        default=17
    )

    deliver_target = click.prompt(
        "Where should notifications be delivered?",
        type=click.Choice(["origin", "local", "telegram"], case_sensitive=False),
        default="origin"
    )

    click.echo()
    click.echo("Creating cron jobs...")

    # Create jobs with custom hours
    manager.DEFAULT_MORNING_HOUR = morning_hour
    manager.DEFAULT_EVENING_HOUR = evening_hour

    result = manager.setup_default_jobs(deliver=deliver_target, timezone=tz)

    if result["success"]:
        click.echo("✓ Cron jobs created successfully!")
        click.echo()
        click.echo("Schedule:")
        click.echo(f"  Morning digest: {morning_hour}:00 {tz}")
        click.echo(f"  Evening review: {evening_hour}:00 {tz}")
        click.echo(f"  Deliver to: {deliver_target}")
        click.echo()
        click.echo("You can manage these jobs with: hermes cron list")
    else:
        click.echo("❌ Failed to create some cron jobs:")
        if "morning" in result and not result["morning"].get("success"):
            click.echo(f"  Morning: {result['morning'].get('error', 'Unknown error')}")
        if "evening" in result and not result["evening"].get("success"):
            click.echo(f"  Evening: {result['evening'].get('error', 'Unknown error')}")

    return result["success"]


if __name__ == "__main__":
    # Simple CLI for testing
    import click

    @click.group()
    def cli():
        """Cron management for Linear Todos."""
        pass

    @cli.command()
    @click.option("--timezone", "-t", default="America/New_York", help="Timezone (e.g., America/New_York)")
    @click.option("--deliver", "-d", default="origin", help="Delivery target")
    def setup(timezone, deliver):
        """Setup default cron jobs."""
        setup_cron_interactive(timezone=timezone, deliver=deliver)

    @cli.command()
    @click.option("--timezone", "-t", default="America/New_York")
    def status(timezone):
        """Show cron job status."""
        manager = CronManager(timezone=timezone)
        status_info = manager.get_status()
        click.echo(json.dumps(status_info, indent=2))

    @cli.command()
    def remove():
        """Remove all Linear Todos cron jobs."""
        manager = CronManager()
        results = manager.remove_all_jobs()
        click.echo(f"Removed {len(results)} job(s)")

    cli()
