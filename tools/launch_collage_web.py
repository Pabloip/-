import argparse
import json
from pathlib import Path
import socket
import subprocess
import sys
import time
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen


APP_SERVICE = "collage-web"
APP_LAUNCH_MODE = "web-app"
PORT_CANDIDATES = [8123, 8124, 8125, 8126, 8127]


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def common_repo_root(root: Path) -> Path:
    git_file = root / ".git"
    if not git_file.exists() or git_file.is_dir():
        return root
    content = git_file.read_text(encoding="utf-8").strip()
    if not content.startswith("gitdir: "):
        return root
    git_dir = (root / content.removeprefix("gitdir: ").strip()).resolve()
    common_dir = git_dir.parents[2]
    return common_dir


def default_state_path() -> Path:
    return project_root() / "tmp" / "launcher_state.json"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Launch the local collage web tool.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--health-timeout", default=5.0, type=float)
    return parser


def load_state(path: Path) -> dict[str, object] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def save_state(path: Path, state: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def build_state_payload(host: str, port: int, pid: int) -> dict[str, object]:
    return {
        "app_id": APP_SERVICE,
        "pid": pid,
        "host": host,
        "port": port,
        "url": f"http://{host}:{port}/",
        "started_at": int(time.time()),
        "launcher_version": 1,
    }


def can_bind_port(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            return False
    return True


def choose_port(candidates: list[int]) -> int:
    for port in candidates:
        if can_bind_port(port):
            return port
    raise RuntimeError("No available port from candidates")


def fetch_health_payload(base_url: str, timeout_seconds: float) -> dict[str, Any]:
    health_url = f"{base_url.rstrip('/')}/api/health"
    with urlopen(health_url, timeout=timeout_seconds) as response:
        return json.loads(response.read().decode("utf-8"))


def probe_existing_instance(
    state: dict[str, object] | None,
    timeout_seconds: float = 0.5,
) -> str | None:
    if not state or not isinstance(state.get("url"), str):
        return None
    try:
        payload = fetch_health_payload(str(state["url"]), timeout_seconds)
    except URLError:
        return None
    if payload.get("service") != APP_SERVICE:
        return None
    if payload.get("launch_mode") != APP_LAUNCH_MODE:
        return None
    return str(state["url"])


def resolve_python_executable(root: Path) -> str:
    bundled = Path(
        "/Users/lipeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
    )
    if bundled.exists():
        return str(bundled)
    raise RuntimeError(f"No available python executable for {root}")


def resolve_dependency_pythonpath(root: Path, common_root: Path | None = None) -> str:
    dependency_root = root / ".codex-python-deps"
    if dependency_root.exists():
        return f"{root}:{dependency_root}"

    common_root = common_root or common_repo_root(root)
    fallback_root = common_root / ".codex-python-deps"
    if fallback_root.exists():
        return f"{root}:{fallback_root}"

    raise RuntimeError(f"No available dependency path for {root}")


def launch_server(
    project_root: Path,
    host: str,
    port: int,
    python_executable: str,
    pythonpath: str,
) -> subprocess.Popen[str]:
    env = {
        "PYTHONPATH": pythonpath,
    }
    return subprocess.Popen(
        [
            python_executable,
            "-m",
            "collage_tool.run_collage_tool",
            "web",
            "--host",
            host,
            "--port",
            str(port),
        ],
        cwd=project_root,
        env=env,
        text=True,
    )


def wait_for_health(base_url: str, timeout_seconds: float) -> dict[str, Any]:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            return fetch_health_payload(base_url, timeout_seconds)
        except (URLError, TimeoutError, json.JSONDecodeError):
            time.sleep(0.1)
    raise RuntimeError(f"Timed out waiting for health at {base_url}")


def open_browser(url: str) -> None:
    subprocess.run(["open", url], check=True)


def main(argv: list[str] | None = None) -> int:
    try:
        args = build_parser().parse_args(argv)
        state_path = default_state_path()
        existing_url = probe_existing_instance(
            load_state(state_path),
            timeout_seconds=args.health_timeout,
        )
        if existing_url:
            open_browser(existing_url)
            return 0

        root = project_root()
        pythonpath = resolve_dependency_pythonpath(root)
        python_executable = resolve_python_executable(root)
        port = choose_port(PORT_CANDIDATES)
        process = launch_server(root, args.host, port, python_executable, pythonpath)
        wait_for_health(f"http://{args.host}:{port}/", args.health_timeout)
        save_state(state_path, build_state_payload(args.host, port, process.pid))
        open_browser(f"http://{args.host}:{port}/")
        return 0
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
