import argparse
import shutil
from pathlib import Path

from huggingface_hub import hf_hub_download


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--file", required=True)
    parser.add_argument("--dest", required=True)
    args = parser.parse_args()

    dest = Path(args.dest).resolve()
    dest.parent.mkdir(parents=True, exist_ok=True)

    downloaded = Path(
        hf_hub_download(
            repo_id=args.repo,
            filename=args.file,
            local_dir=str(dest.parent),
            local_dir_use_symlinks=False,
        )
    )

    if downloaded.resolve() != dest:
        shutil.move(str(downloaded), str(dest))

    print(dest)


if __name__ == "__main__":
    main()
