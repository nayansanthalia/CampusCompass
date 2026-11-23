"""Compatibility launcher for the CampusCompass server with local inference."""

import argparse
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True)
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    script = Path(__file__).with_name("server.js")
    command = [
        "node", str(script), "--model", args.model, "--port", str(args.port),
        "--python", sys.executable,
    ]
    try:
        return subprocess.call(command)
    except KeyboardInterrupt:
        return 130
    except FileNotFoundError:
        parser.exit(1, "Node.js 18 or later is required.\n")


if __name__ == "__main__":
    raise SystemExit(main())
