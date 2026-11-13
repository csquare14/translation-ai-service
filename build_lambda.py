"""Build a Linux x86_64 / Python 3.12 worker ZIP from Windows."""

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "dist" / "translation-worker.zip"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", action="store_true", help="Build the API instead of the worker")
    args = parser.parse_args()
    output = ROOT / "dist" / ("translation-api.zip" if args.api else "translation-worker.zip")
    output.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="translation-lambda-") as temporary:
        target = Path(temporary)
        subprocess.run([
            sys.executable, "-m", "pip", "install", "--target", str(target),
            "--platform", "manylinux2014_x86_64", "--implementation", "cp",
            "--python-version", "3.12", "--only-binary=:all:", "--no-compile",
            "-r", str(ROOT / ("requirements-api-lambda.txt" if args.api else "requirements-lambda.txt")),
        ], check=True)
        # Explicit source allowlist excludes credentials, databases and local jobs.
        sources = [ROOT / ("api_handler.py" if args.api else "worker_handler.py")]
        sources += list((ROOT / ("backend/jobs" if args.api else "ai_core")).glob("*.py"))
        sources += list((ROOT / "backend" / "aws").glob("*.py"))
        if args.api:
            sources += [ROOT / "backend/app/security" / name for name in
                        ("routes.py", "engine.py", "rules.py", "resource_graph.py", "attack_paths.py")]
        if (ROOT / "backend" / "__init__.py").exists():
            sources.append(ROOT / "backend" / "__init__.py")
        for source in sources:
            destination = target / source.relative_to(ROOT)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(source.read_bytes())
        files = sorted(path for path in target.rglob("*") if path.is_file())
        uncompressed = sum(path.stat().st_size for path in files)
        if uncompressed > 250 * 1024 * 1024:
            raise RuntimeError("Package exceeds Lambda's extracted-size limit.")
        with ZipFile(output, "w", ZIP_DEFLATED) as archive:
            for path in files:
                archive.write(path, path.relative_to(target).as_posix())
        with ZipFile(output) as archive:
            names = archive.namelist()
            assert ("api_handler.py" if args.api else "worker_handler.py") in names
            assert ("backend/jobs/apis.py" if args.api else "ai_core/pipeline.py") in names
            assert "backend/aws/clients.py" in names
            assert any(name.startswith("pydantic_core/") and name.endswith(".so") for name in names)
            assert not any(Path(name).name.startswith(".env") or name.endswith((".db", ".pyd")) for name in names)
            assert archive.testzip() is None
    print(f"Created {output}")
    print(f"ZIP: {output.stat().st_size / 1024 / 1024:.1f} MB; extracted: {uncompressed / 1024 / 1024:.1f} MB")
    print("Target: Python 3.12, Linux x86_64. Handler: " + ("api_handler.handler" if args.api else "worker_handler.handler"))


if __name__ == "__main__":
    main()
