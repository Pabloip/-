from work.run_collage_tool import main as base_main


def main(argv: list[str] | None = None) -> int:
    return base_main(argv)


if __name__ == "__main__":
    raise SystemExit(main())
