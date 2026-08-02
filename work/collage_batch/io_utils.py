from pathlib import Path
import subprocess
import tempfile

from PIL import Image


class InvalidInputError(ValueError):
    pass


SUPPORTED_INPUT_SUFFIXES = (".png", ".heic", ".heif")


def scan_png_inputs(input_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in input_dir.iterdir()
        if path.is_file() and path.suffix.lower() == ".png"
    )


def scan_supported_inputs(input_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_INPUT_SUFFIXES
    )


def _validate_transparent_image(image: Image.Image, label: str) -> Image.Image:
    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    if alpha.getbbox() is None:
        raise InvalidInputError(f"{label}: alpha channel is empty")
    if alpha.getextrema() == (255, 255):
        raise InvalidInputError(f"{label}: image is missing transparent pixels")
    return image


def load_transparent_png(path: Path) -> Image.Image:
    return _validate_transparent_image(Image.open(path), path.name)


def _convert_heic_to_png(source_path: Path) -> Path:
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        target_path = Path(tmp.name)

    try:
        subprocess.run(
            ["sips", "-s", "format", "png", str(source_path), "--out", str(target_path)],
            check=True,
            capture_output=True,
            text=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        target_path.unlink(missing_ok=True)
        raise InvalidInputError(f"{source_path.name}: unable to decode HEIC image") from exc

    return target_path


def load_supported_transparent_image(path: Path) -> Image.Image:
    suffix = path.suffix.lower()
    if suffix == ".png":
        return load_transparent_png(path)
    if suffix not in {".heic", ".heif"}:
        raise InvalidInputError(f"{path.name}: unsupported input format")

    converted_path = _convert_heic_to_png(path)
    try:
        return _validate_transparent_image(Image.open(converted_path), converted_path.name)
    except InvalidInputError as exc:
        message = str(exc).split(": ", 1)[1]
        raise InvalidInputError(
            f"{path.name}: HEIC converted successfully, but {message}"
        ) from exc
    finally:
        converted_path.unlink(missing_ok=True)


def optimize_image_for_render(image: Image.Image, max_side: int = 1800) -> Image.Image:
    width, height = image.size
    longest_side = max(width, height)
    if longest_side <= max_side:
        return image

    scale = max_side / longest_side
    resized = (
        max(1, int(width * scale)),
        max(1, int(height * scale)),
    )
    return image.resize(resized, Image.Resampling.LANCZOS)


def ensure_output_path(root: Path, template_name: str, source_path: Path) -> Path:
    return root / template_name / f"{source_path.stem}-collage.png"
