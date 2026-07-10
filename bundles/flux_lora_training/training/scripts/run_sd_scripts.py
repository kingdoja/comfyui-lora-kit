import runpy
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("Usage: run_sd_scripts.py <sd-scripts-root> <script-name> [args...]")

    root = Path(sys.argv[1]).resolve()
    script = sys.argv[2]
    script_path = root / script
    if not script_path.exists():
        raise SystemExit(f"sd-scripts entry not found: {script_path}")

    sys.path.insert(0, str(root))
    sys.argv = [str(script_path), *sys.argv[3:]]
    runpy.run_path(str(script_path), run_name="__main__")


if __name__ == "__main__":
    main()
