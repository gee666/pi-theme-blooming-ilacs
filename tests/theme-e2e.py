"""Real global Pi + PTY regression tests. No credentials or model calls needed."""
import errno
import fcntl
import json
import os
from pathlib import Path
import pty
import select
import struct
import subprocess
import termios
import time

ROOT = Path(__file__).resolve().parents[1]
ST = b"\x1b\\"
APPLY = b"\x1b]11;rgb:11/11/11" + ST + b"\x1b]10;rgb:BD/AE/9D" + ST + b"\x1b]12;rgb:EA/21/75" + ST
RESET = b"\x1b]111" + ST + b"\x1b]110" + ST + b"\x1b]112" + ST
BIN = os.environ["PI_EVERGREEN_PI_BIN"]


class Session:
    def __init__(self, directory, mode, enabled=True):
        self.directory = directory
        directory.mkdir(parents=True)
        (directory / "agent").mkdir()
        (directory / "agent/settings.json").write_text(json.dumps({
            "theme": "dark", "terminal": {"trueColor": True}
        }))
        self.events_path = directory / "events.jsonl"
        self.output = b""
        self.master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 32, 120, 0, 0))
        env = dict(os.environ, PI_CODING_AGENT_DIR=str(directory / "agent"),
                   PI_THEME_TEST_EVENTS=str(self.events_path), TERM="xterm-256color", PI_TELEMETRY="0")
        args = [BIN, "--offline", "--no-extensions", "--no-mcp", "--no-skills",
                "--no-prompt-templates", "--no-context-files", "--no-approve", "--no-themes",
                "--theme", str(ROOT / "blooming-ilacs-pi.json"), "--use-theme", "blooming-ilacs-pi",
                "--session-dir", str(directory / "sessions"), "--tui-mode", mode,
                "--provider", os.getenv("PI_EVERGREEN_E2E_PROVIDER", "openai"),
                "--model", os.getenv("PI_EVERGREEN_E2E_MODEL", "gpt-6-luna"),
                "--thinking", os.getenv("PI_EVERGREEN_E2E_REASONING", "medium")]
        if enabled:
            args += ["-e", str(ROOT / "extensions/blooming-ilacs-background.ts")]
        args += ["-e", str(ROOT / "tests/fixtures/theme-observer.ts")]
        self.process = subprocess.Popen(args, cwd=ROOT, env=env, stdin=slave, stdout=slave, stderr=slave)
        os.close(slave)

    def pump(self, seconds=0.6):
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            if select.select([self.master], [], [], 0.05)[0]:
                try:
                    data = os.read(self.master, 65536)
                except OSError as error:
                    if error.errno == errno.EIO:
                        break
                    raise
                self.output += data

    def events(self):
        if not self.events_path.exists():
            return []
        return [json.loads(line) for line in self.events_path.read_text().splitlines()]

    def wait(self, predicate):
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            self.pump(0.1)
            if predicate():
                self.pump()
                return
            if self.process.poll() is not None:
                assert predicate(), self.output[-4000:]
                self.pump()
                return
        raise AssertionError(f"Timed out; events={self.events()}; output={self.output[-4000:]!r}")

    def command(self, text, predicate):
        os.write(self.master, text.encode() + b"\r")
        self.wait(predicate)

    def close(self):
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
        self.pump(0.1)
        (self.directory / "terminal.bin").write_bytes(self.output)
        os.close(self.master)


def applied(output):
    assert APPLY in output, "Blooming OSC defaults were not applied by the real CLI"


def lifecycle(directory, mode):
    session = Session(directory, mode)
    try:
        session.wait(lambda: len(session.events()) >= 1)
        assert session.events()[0] == {"event": "start", "mode": "tui", "theme": "blooming-ilacs-pi"}
        applied(session.output)
        assert session.output.count(APPLY) == 1
        session.command("/evergreen-colors", lambda: any(event["event"] == "colors" for event in session.events()))
        assert b"\x1b[38;2;189;174;157mEVERGREEN_THEME_TEXT" in session.output, "terminal.trueColor must render exact theme RGB"
        for name, expected in [("dark", RESET), ("blooming-ilacs-pi", APPLY),
                               ("light", RESET), ("blooming-ilacs-pi", APPLY)]:
            offset = len(session.output)
            count = len(session.events())
            session.command("/evergreen-theme " + name, lambda: len(session.events()) > count)
            assert session.events()[-1]["success"] is True
            assert session.events()[-1]["active"] == name
            assert expected in session.output[offset:]
        # Pi 1.4 falls back to system even when setTheme reports failure.
        # Follow the effective theme, not the operation's success flag.
        offset = len(session.output)
        count = len(session.events())
        session.command("/evergreen-theme evergreen-missing", lambda: len(session.events()) > count)
        assert session.events()[-1]["success"] is False
        assert session.events()[-1]["active"] != "blooming-ilacs-pi"
        assert RESET in session.output[offset:] and APPLY not in session.output[offset:]
        count = len(session.events())
        session.command("/evergreen-theme blooming-ilacs-pi", lambda: len(session.events()) > count)
        for command in ["/new", "/reload"]:
            offset = len(session.output)
            count = sum(event["event"] == "start" for event in session.events())
            session.command(command, lambda: sum(event["event"] == "start" for event in session.events()) > count)
            data = session.output[offset:]
            assert RESET in data and APPLY in data and data.index(RESET) < data.index(APPLY)
            assert data.count(APPLY) == 1, "Duplicate pollers or failed cleanup on session replacement"
        offset = len(session.output)
        os.write(session.master, b"/evergreen-exit\r")
        session.wait(lambda: session.process.poll() is not None)
        assert session.process.returncode == 0
        assert RESET in session.output[offset:]
        assert session.events()[-1]["event"] == "shutdown"
        print(f"PASS real CLI {mode}: startup, theme switch, invalid selection, /new, /reload, shutdown")
    finally:
        session.close()


def noninteractive(directory):
    directory.mkdir()
    for mode in ["rpc", "json", "print"]:
        events = directory / f"{mode}.jsonl"
        master, slave = pty.openpty()
        env = dict(os.environ, PI_CODING_AGENT_DIR=str(directory / "agent"),
                   PI_THEME_TEST_EVENTS=str(events), PI_TELEMETRY="0")
        args = [BIN, "--offline", "--no-extensions", "--no-mcp", "--no-skills",
                "--no-prompt-templates", "--no-context-files", "--no-approve",
                "-e", str(ROOT / "extensions/blooming-ilacs-background.ts"),
                "-e", str(ROOT / "tests/fixtures/theme-observer.ts"),
                "--theme", str(ROOT / "blooming-ilacs-pi.json"), "--use-theme", "blooming-ilacs-pi",
                "--session-dir", str(directory / "sessions")]
        args += ["--provider", os.getenv("PI_EVERGREEN_E2E_PROVIDER", "openai"),
                 "--model", os.getenv("PI_EVERGREEN_E2E_MODEL", "gpt-6-luna"),
                 "--thinking", os.getenv("PI_EVERGREEN_E2E_REASONING", "medium")]
        args += ["--print"] if mode == "print" else ["--mode", mode]
        try:
            # stdout really is a TTY: this isolates the context-mode guard.
            result = subprocess.run(args, input=b"", stdout=slave, stderr=slave, env=env,
                                    cwd=ROOT, timeout=15)
            os.close(slave)
            slave = None
            output = b""
            while select.select([master], [], [], 0.1)[0]:
                try:
                    output += os.read(master, 65536)
                except OSError as error:
                    if error.errno == errno.EIO:
                        break
                    raise
            assert events.exists(), (mode, result.returncode, output)
            observed = [json.loads(line) for line in events.read_text().splitlines()]
            assert observed[0]["mode"] == mode, observed
            assert APPLY not in output and RESET not in output, (mode, output)
            (directory / f"{mode}.bin").write_bytes(output)
        finally:
            if slave is not None:
                os.close(slave)
            os.close(master)
    print("PASS real CLI RPC/JSON/print with TTY stdout: no color OSC pollution")


def main():
    # Keep artifacts within the repository, including isolated Pi settings/sessions.
    import tempfile
    directory = Path(tempfile.mkdtemp(prefix="theme-e2e-", dir=ROOT / "tmp"))
    for mode in ["regular", "fullscreen"]:
        lifecycle(directory / mode, mode)
    noninteractive(directory / "noninteractive")
    session = Session(directory / "exit-fallback", "regular")
    try:
        session.wait(lambda: len(session.events()) >= 1)
        applied(session.output)
        offset = len(session.output)
        os.write(session.master, b"/evergreen-process-exit\r")
        session.wait(lambda: session.process.poll() is not None)
        assert session.process.returncode == 0
        assert RESET in session.output[offset:]
        assert not any(event["event"] == "shutdown" for event in session.events())
        print("PASS process exit fallback: restores without session_shutdown")
    finally:
        session.close()
    session = Session(directory / "negative-control", "regular", enabled=False)
    try:
        session.wait(lambda: len(session.events()) >= 1)
        try:
            applied(session.output)
        except AssertionError:
            print("PASS negative control: removing local extension is detected")
        else:
            raise AssertionError("Negative control did not detect missing extension")
    finally:
        session.close()
    print(f"PTY and lifecycle artifacts: {directory.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
