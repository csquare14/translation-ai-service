"""Start the local job API and CloudQuery frontend from one Windows terminal."""

import argparse
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent


def stop_process(process):
    if process is not None and process.poll() is None:
        if os.name == "nt":
            # Windows virtual-environment launchers can create another Python process.
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        else:
            process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--demo", action="store_true", help="Explicit single-user local mode without sign-in")
    parser.add_argument("--streamlit", action="store_true", help="Use the original Streamlit interface")
    args = parser.parse_args()
    load_dotenv(ROOT / ".env.local")
    load_dotenv(ROOT / ".env")
    from backend.jobs.config import CLERK_ISSUER, CLERK_PUBLISHABLE_KEY

    environment = os.environ.copy()
    environment["CLERK_PUBLISHABLE_KEY"] = CLERK_PUBLISHABLE_KEY
    environment["CLERK_ISSUER"] = CLERK_ISSUER
    environment["LOCAL_AUTH_MODE"] = "demo" if args.demo else "clerk"
    environment["LOCAL_API_URL"] = "http://127.0.0.1:8000"
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    if not args.demo and not all(environment.get(name) for name in ["CLERK_PUBLISHABLE_KEY", "CLERK_ISSUER"]):
        parser.exit(1, "Pull Clerk development keys into .env.local, or configure Clerk in .env first.\n"
                    "For a single-user demonstration, run this command with --demo.\n")
    web_root = ROOT / "frontend" / "web"
    if args.streamlit:
        ui_command = [sys.executable, "-m", "streamlit", "run", "main.py", "--server.address",
                      "127.0.0.1", "--server.port", "8501", "--server.headless", "true"]
        ui_directory = ROOT
    else:
        node = shutil.which("node")
        vite = web_root / "node_modules" / "vite" / "bin" / "vite.js"
        if not node or not vite.exists():
            parser.exit(1, "Install Node.js, then run npm install inside frontend/web before starting the frontend.\n")
        ui_command = [node, str(vite), "--host", "127.0.0.1", "--port", "8501", "--strictPort"]
        ui_directory = web_root
    for port in (8000, 8501):
        with socket.socket() as connection:
            try:
                connection.bind(("127.0.0.1", port))
            except OSError:
                parser.exit(1, f"Port {port} is already in use. Stop the previous local server and retry.\n")

    data_dir = Path(environment.get("LOCAL_DATA_DIR", ROOT / ".local-data"))
    data_dir.mkdir(parents=True, exist_ok=True)
    creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    api = None
    ui = None
    try:
        with (data_dir / "api.log").open("a", encoding="utf-8") as api_log, \
                (data_dir / "ui.log").open("a", encoding="utf-8") as ui_log:
            api = subprocess.Popen(
                [sys.executable, "-m", "uvicorn", "backend.jobs.apis:app", "--host", "127.0.0.1",
                 "--port", "8000", "--workers", "1", "--no-proxy-headers"],
                cwd=ROOT, env=environment, stdout=api_log, stderr=subprocess.STDOUT,
                creationflags=creation_flags,
            )
            for _ in range(80):
                if api.poll() is not None:
                    raise RuntimeError(f"API startup failed. See {data_dir / 'api.log'}")
                try:
                    requests.get("http://127.0.0.1:8000/health", timeout=1).raise_for_status()
                    break
                except requests.RequestException:
                    time.sleep(0.25)
            else:
                raise RuntimeError("The API did not become ready in time.")
            ui = subprocess.Popen(
                ui_command,
                cwd=ui_directory, env=environment, stdout=ui_log, stderr=subprocess.STDOUT,
                creationflags=creation_flags,
            )
            for _ in range(80):
                if ui.poll() is not None:
                    raise RuntimeError(f"Frontend startup failed. See {data_dir / 'ui.log'}")
                try:
                    requests.get("http://127.0.0.1:8501", timeout=1).raise_for_status()
                    break
                except requests.RequestException:
                    time.sleep(0.25)
            else:
                raise RuntimeError("The frontend did not become ready in time.")
            print("Open http://localhost:8501", flush=True)
            print("API documentation is at http://127.0.0.1:8000/docs", flush=True)
            if args.demo:
                print("DEMO MODE: sign-in is disabled. All jobs belong to local-demo.", flush=True)
            print("Keep this terminal open. Press Ctrl+C to stop both servers.", flush=True)
            while api.poll() is None and ui.poll() is None:
                time.sleep(1)
            raise RuntimeError(f"A local server stopped. Check logs in {data_dir}")
    except KeyboardInterrupt:
        print("Stopping local servers.")
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1
    finally:
        stop_process(ui)
        stop_process(api)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
