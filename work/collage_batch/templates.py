from dataclasses import dataclass
from pathlib import Path


TEMPLATE_NAMES = ("clean-cut", "print-warm", "magazine-dot", "cool-bw")
BORDER_SIZE_NAMES = ("none", "small", "medium", "large")
PAPER_STYLE_NAMES = ("none", "paper-01", "paper-02", "paper-03", "paper-04", "paper-05", "paper-06")
PAPER_STYLE_TEXTURE_FILES = {
    "paper-01": "01.png",
    "paper-02": "02.png",
    "paper-03": "03.png",
    "paper-04": "04.png",
    "paper-05": "05.png",
    "paper-06": "06.png",
}
PAPER_TEXTURE_DIR = Path(__file__).resolve().parent / "assets" / "paper_textures"
SEMIVECTOR_BORDER_BASELINE = {
    "small": 0.36,
    "medium": 1.0,
    "large": 1.5,
}
SEMIVECTOR_BORDER_MINIMUMS = {
    "small": 10,
    "medium": 18,
    "large": 26,
}


@dataclass(frozen=True)
class TemplateConfig:
    border_rgba: tuple[int, int, int, int]
    border_expand: int
    border_blur: float
    grain_scale: float
    warmth: tuple[float, float, float]
    tone_offset: tuple[float, float, float]
    dot_strength: float
    dot_spacing: int
    dot_radius_ratio: float


TEMPLATES: dict[str, TemplateConfig] = {
    "clean-cut": TemplateConfig(
        (242, 238, 228, 0),
        23,
        1.6,
        0.04,
        (1.0, 1.0, 0.98),
        (0.0, 0.0, 0.0),
        0.02,
        10,
        0.24,
    ),
    "print-warm": TemplateConfig(
        (239, 232, 218, 0),
        33,
        2.2,
        0.06,
        (1.04, 1.0, 0.96),
        (0.0, 0.0, 0.0),
        0.06,
        10,
        0.24,
    ),
    "magazine-dot": TemplateConfig(
        (236, 230, 216, 0),
        49,
        2.8,
        0.014,
        (0.992, 0.997, 1.03),
        (0.01, 0.01, 0.018),
        0.098,
        8,
        0.34,
    ),
    "cool-bw": TemplateConfig(
        (232, 236, 242, 0),
        27,
        1.9,
        0.02,
        (1.0, 1.0, 1.0),
        (0.0, 0.0, 0.0),
        0.0,
        10,
        0.24,
    ),
}


def list_templates() -> tuple[str, ...]:
    return TEMPLATE_NAMES


def list_paper_styles() -> tuple[str, ...]:
    return PAPER_STYLE_NAMES
