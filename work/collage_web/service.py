from base64 import b64encode
from io import BytesIO
from pathlib import Path
import tempfile

from PIL import Image

from work.collage_batch.io_utils import (
    InvalidInputError,
    _convert_heic_to_png,
    load_supported_transparent_image,
    optimize_image_for_render,
)
from work.collage_batch.pipeline import render_collage
from work.collage_batch.templates import (
    BORDER_SIZE_NAMES,
    list_paper_styles,
    list_templates,
)


TEMPLATE_LABELS = {
    "clean-cut": "简洁拼贴",
    "print-warm": "暖印拼贴",
    "magazine-dot": "杂志点彩",
    "cool-bw": "冷调黑白",
}
BORDER_SIZE_LABELS = {
    "none": "无",
    "small": "小",
    "medium": "中",
    "large": "大",
}
PAPER_STYLE_LABELS = {
    "none": "无纸张",
    "paper-01": "纸张 01",
    "paper-02": "纸张 02",
    "paper-03": "纸张 03",
    "paper-04": "纸张 04",
    "paper-05": "纸张 05",
    "paper-06": "纸张 06",
}


def get_template_options() -> list[dict[str, str]]:
    return [{"id": name, "label": TEMPLATE_LABELS[name]} for name in list_templates()]


def get_border_size_options() -> list[dict[str, str]]:
    return [{"id": name, "label": BORDER_SIZE_LABELS[name]} for name in BORDER_SIZE_NAMES]


def get_paper_style_options() -> list[dict[str, str]]:
    return [{"id": name, "label": PAPER_STYLE_LABELS[name]} for name in list_paper_styles()]


def encode_png_data_url(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    encoded = b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def load_web_upload_image(path: Path) -> Image.Image:
    suffix = path.suffix.lower()
    try:
        return load_supported_transparent_image(path)
    except InvalidInputError as exc:
        message = str(exc)
        if suffix == ".png" and "missing transparent pixels" in message:
            return Image.open(path).convert("RGBA")
        if suffix in {".jpg", ".jpeg"} and "unsupported input format" in message:
            return Image.open(path).convert("RGBA")
        if suffix in {".heic", ".heif"} and "converted successfully" in message:
            converted_path = _convert_heic_to_png(path)
            try:
                return Image.open(converted_path).convert("RGBA")
            finally:
                converted_path.unlink(missing_ok=True)
        raise


def render_uploaded_files(
    files: list[tuple[str, bytes]],
    template_name: str,
    border_size: str | None = None,
    paper_style: str | None = None,
) -> dict[str, object]:
    results: list[dict[str, str]] = []
    failures: list[dict[str, str]] = []

    for filename, raw_bytes in files:
        try:
            with tempfile.NamedTemporaryFile(suffix=Path(filename).suffix or ".png") as tmp:
                tmp.write(raw_bytes)
                tmp.flush()
                image = load_web_upload_image(Path(tmp.name))

            image = optimize_image_for_render(image)
            rendered = render_collage(
                image,
                template_name,
                border_size=border_size,
                paper_style=paper_style,
            )
            results.append(
                {
                    "file": filename,
                    "preview_url": encode_png_data_url(rendered),
                    "download_name": f"{Path(filename).stem}-collage.png",
                }
            )
        except Exception as exc:
            failures.append({"file": filename, "reason": str(exc)})

    return {
        "success_count": len(results),
        "failure_count": len(failures),
        "results": results,
        "failures": failures,
    }
