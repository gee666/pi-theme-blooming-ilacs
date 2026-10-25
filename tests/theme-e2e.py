"""Global CLI package-loading tests; stdin is always /dev/null, no model calls."""
import errno
import json
import os
from pathlib import Path
import pty
import select
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
BIN = os.environ.get("EVERGREEN_PI_BIN") or "pi"


def run(directory, mode, tty, enabled=True):
    directory.mkdir(parents=True)
    agent = directory / "agent"
    agent.mkdir()
    # Exercise the shipped package manifest, not a hardcoded extension path.
    (agent / "settings.json").write_text(json.dumps({
        "packages": [str(ROOT)] if enabled else [],
        "theme": "blooming-ilacs-pi" if enabled else "dark",
        "terminal": {"trueColor": True},
    }))
    events = directory / "events.jsonl"
    env = dict(os.environ, PI_CODING_AGENT_DIR=str(agent),
               PI_THEME_TEST_EVENTS=str(events), PI_TELEMETRY="0")
    args = [BIN, "--offline", "--no-mcp", "--no-skills", "--no-prompt-templates",
            "--no-context-files", "--no-approve",
            "--session-dir", str(directory / "sessions"),
            "-e", str(ROOT / "tests/fixtures/theme-observer.ts")]
    # If a future test makes a model call, use Evergreen's exact selection.
    if os.environ.get("EVERGREEN_E2E_MODEL"):
        args += ["--model", os.environ["EVERGREEN_E2E_MODEL"]]
    args += ["--print"] if mode == "print" else ["--mode", mode]
    master, slave = pty.openpty() if tty else (None, None)
    output = b""
    process = None
    try:
        process = subprocess.Popen(args, stdin=subprocess.DEVNULL,
                                   stdout=slave if tty else subprocess.PIPE,
                                   stderr=subprocess.STDOUT, env=env, cwd=directory)
        if tty:
            os.close(slave)
            slave = None
            deadline = time.monotonic() + 90
            while time.monotonic() < deadline:
                if select.select([master], [], [], 0.1)[0]:
                    try:
                        data = os.read(master, 65536)
                    except OSError as error:
                        if error.errno == errno.EIO:
                            break
                        raise
                    if not data:
                        break
                    output += data
            process.wait(timeout=max(1, deadline - time.monotonic()))
        else:
            output = process.communicate(timeout=90)[0]
        (directory / "terminal.bin").write_bytes(output)
        assert events.exists(), (process.returncode, output[-4000:])
        observed = [json.loads(line) for line in events.read_text().splitlines()]
        start = next(event for event in observed if event["event"] == "start")
        assert start["mode"] == mode, observed
        # The extension must stay inert even when stdout is a terminal (RPC has UI).
        for code in [10, 11, 12, 110, 111, 112]:
            assert f"\x1b]{code}".encode() not in output, (mode, tty, output)
        assert b"Extension Error" not in output and b"Failed to load" not in output, output
        assert process.returncode == 0, (process.returncode, output)
        print(f"PASS global Pi {mode}, tty={tty}, package={enabled}: lifecycle started, clean output")
        return start
    finally:
        if process is not None and process.poll() is None:
            process.kill()
            process.wait()
        if slave is not None:
            os.close(slave)
        if master is not None:
            os.close(master)


def main():
    (ROOT / "tmp").mkdir(exist_ok=True)
    directory = Path(tempfile.mkdtemp(prefix="theme-e2e-", dir=ROOT / "tmp"))
    for mode in ["rpc", "json", "print"]:
        for tty in [False, True]:
            run(directory / f"{mode}-{tty}", mode, tty)
    run(directory / "without-package", "rpc", False, enabled=False)
    print(f"CLI artifacts: {directory.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
