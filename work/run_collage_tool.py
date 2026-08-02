import argparse

import uvicorn

from work.run_collage_batch import main as run_batch_main


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Unified launcher for the collage batch tool and local test web."
    )
    subparsers = parser.add_subparsers(dest="mode", required=True)

    web_parser = subparsers.add_parser("web")
    web_parser.add_argument("--host", default="127.0.0.1")
    web_parser.add_argument("--port", default=8000, type=int)

    batch_parser = subparsers.add_parser("batch")
    batch_parser.add_argument("--input-dir", required=True)
    batch_parser.add_argument("--template", required=True)
    batch_parser.add_argument("--output-root", default="outputs")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.mode == "web":
        uvicorn.run("work.collage_web.app:app", host=args.host, port=args.port)
        return 0

    run_batch_main(
        [
            "--input-dir",
            args.input_dir,
            "--template",
            args.template,
            "--output-root",
            args.output_root,
        ]
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
