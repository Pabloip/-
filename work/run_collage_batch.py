import argparse
from pathlib import Path

from work.collage_batch.io_utils import (
    InvalidInputError,
    ensure_output_path,
    load_supported_transparent_image,
    scan_supported_inputs,
)
from work.collage_batch.pipeline import render_collage
from work.collage_batch.templates import list_templates


def run_batch(
    input_dir: Path,
    template_name: str,
    output_root: Path,
    fail_on: set[str] | None = None,
) -> dict[str, object]:
    fail_on = fail_on or set()
    output_root.mkdir(parents=True, exist_ok=True)
    summary = {
        "success_count": 0,
        "skipped_count": 0,
        "failed_count": 0,
        "skipped": [],
        "failed": [],
    }

    for path in scan_supported_inputs(input_dir):
        try:
            if path.name in fail_on:
                raise RuntimeError("forced render failure for test")
            image = load_supported_transparent_image(path)
            rendered = render_collage(image, template_name)
            output_path = ensure_output_path(output_root, template_name, path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            rendered.save(output_path)
            summary["success_count"] += 1
        except InvalidInputError as exc:
            summary["skipped_count"] += 1
            summary["skipped"].append({"file": path.name, "reason": str(exc)})
        except Exception as exc:
            summary["failed_count"] += 1
            summary["failed"].append({"file": path.name, "reason": str(exc)})

    return summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Batch-render collage outputs from transparent PNG inputs."
    )
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--template", required=True, choices=list_templates())
    parser.add_argument("--output-root", default=Path("outputs"), type=Path)
    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    summary = run_batch(args.input_dir, args.template, args.output_root)
    print(
        f"success={summary['success_count']} "
        f"skipped={summary['skipped_count']} "
        f"failed={summary['failed_count']}"
    )
    for item in summary["skipped"]:
        print(f"SKIPPED {item['file']}: {item['reason']}")
    for item in summary["failed"]:
        print(f"FAILED {item['file']}: {item['reason']}")


if __name__ == "__main__":
    main()
