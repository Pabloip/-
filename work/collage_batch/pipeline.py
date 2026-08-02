from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter

from work.collage_batch.templates import (
    BORDER_SIZE_NAMES,
    PAPER_STYLE_NAMES,
    PAPER_STYLE_TEXTURE_FILES,
    PAPER_TEXTURE_DIR,
    SEMIVECTOR_BORDER_BASELINE,
    SEMIVECTOR_BORDER_MINIMUMS,
    TEMPLATES,
)


def _threshold_alpha(image: Image.Image) -> Image.Image:
    return image.getchannel("A").point(lambda p: 255 if p > 10 else 0)


def _adaptive_filter_size(requested: int, image: Image.Image) -> int:
    min_dim = min(image.size)
    capped = min(requested, max(3, min_dim // 2 + 1))
    if capped % 2 == 0:
        capped -= 1
    return max(capped, 3)


def _border_margins(border: Image.Image) -> tuple[int, int, int, int] | None:
    bbox = border.getbbox()
    if bbox is None:
        return None
    return (
        bbox[0],
        bbox[1],
        border.size[0] - bbox[2],
        border.size[1] - bbox[3],
    )


def _fit_border_with_safe_margin(
    requested_size: int,
    render_border,
) -> Image.Image:
    safe_margin = 4
    best_border = render_border(requested_size)
    margins = _border_margins(best_border)
    if margins is None or min(margins) >= safe_margin:
        return best_border

    current = requested_size - 2
    while current >= 3:
        candidate = render_border(current)
        margins = _border_margins(candidate)
        if margins is None or min(margins) >= safe_margin:
            return candidate
        best_border = candidate
        current -= 2

    return best_border


def _alpha_subject_margins(alpha: Image.Image) -> tuple[int, int, int, int] | None:
    bbox = alpha.getbbox()
    if bbox is None:
        return None
    return (
        bbox[0],
        bbox[1],
        alpha.size[0] - bbox[2],
        alpha.size[1] - bbox[3],
    )


def _pad_canvas_for_semivector_border(
    rgba: Image.Image,
    alpha: Image.Image,
    expand: int,
) -> tuple[Image.Image, Image.Image]:
    margins = _alpha_subject_margins(alpha)
    if margins is None:
        return rgba, alpha

    required_margin = max(24, int(round(max(rgba.size) * 0.09)), expand + 4)
    extra_left = max(0, required_margin - margins[0])
    extra_top = max(0, required_margin - margins[1])
    extra_right = max(0, required_margin - margins[2])
    extra_bottom = max(0, required_margin - margins[3])
    if max(extra_left, extra_top, extra_right, extra_bottom) == 0:
        return rgba, alpha

    padded = Image.new(
        "RGBA",
        (
            rgba.size[0] + extra_left + extra_right,
            rgba.size[1] + extra_top + extra_bottom,
        ),
        (0, 0, 0, 0),
    )
    padded.alpha_composite(rgba, (extra_left, extra_top))
    return padded, _threshold_alpha(padded)


def _build_border(alpha: Image.Image, expand: int, blur: float) -> Image.Image:
    filter_size = _adaptive_filter_size(expand, alpha)
    max_blur = min(blur, max(0.8, min(alpha.size) / 12.0))

    def render_border(current_filter_size: int) -> Image.Image:
        current_blur = max(0.8, max_blur * (current_filter_size / filter_size))
        expanded = alpha.filter(ImageFilter.MaxFilter(current_filter_size)).filter(
            ImageFilter.GaussianBlur(current_blur)
        )
        border_alpha = np.clip(
            (
                np.asarray(expanded, dtype=np.float32)
                - np.asarray(alpha, dtype=np.float32)
            )
            / 255.0,
            0.0,
            1.0,
        )
        return Image.fromarray((border_alpha * 255.0).astype(np.uint8), "L")

    return _fit_border_with_safe_margin(filter_size, render_border)


def _build_semivector_border(alpha: Image.Image, expand: int) -> Image.Image:
    filter_size = _adaptive_filter_size(expand, alpha)

    def render_border(current_filter_size: int) -> Image.Image:
        blur_scale = current_filter_size / filter_size
        expanded = alpha.filter(ImageFilter.MaxFilter(current_filter_size))
        outer = expanded.filter(ImageFilter.GaussianBlur(max(0.45, 0.9 * blur_scale)))
        border = ImageChops.subtract(outer, alpha)
        border = border.point(lambda p: 255 if p > 20 else 0)
        border = border.filter(ImageFilter.GaussianBlur(max(0.35, 0.75 * blur_scale)))
        return border.point(lambda p: 255 if p > 118 else (190 if p > 34 else 0))

    return _fit_border_with_safe_margin(filter_size, render_border)


def _cover_texture(texture: Image.Image, size: tuple[int, int]) -> Image.Image:
    scale = max(size[0] / texture.width, size[1] / texture.height)
    resized = texture.resize(
        (
            max(1, int(round(texture.width * scale))),
            max(1, int(round(texture.height * scale))),
        ),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


@lru_cache(maxsize=len(PAPER_STYLE_TEXTURE_FILES))
def _load_paper_texture(paper_style: str) -> Image.Image:
    texture_name = PAPER_STYLE_TEXTURE_FILES[paper_style]
    return Image.open(PAPER_TEXTURE_DIR / texture_name).convert("RGB")


def _build_textured_border(border_mask: Image.Image, paper_style: str) -> Image.Image:
    texture = _cover_texture(_load_paper_texture(paper_style), border_mask.size)
    paper = texture.convert("RGBA")
    paper.putalpha(border_mask.point(lambda p: 255 if p > 0 else 0))
    return paper


def _build_paper_shadow(alpha: Image.Image, border_mask: Image.Image) -> Image.Image:
    shadow_rgb = (64, 46, 34)
    full_alpha = ImageChops.lighter(alpha, border_mask)
    outer_alpha = full_alpha.filter(ImageFilter.GaussianBlur(1.45)).point(
        lambda p: int(p * 0.24)
    )
    inner_alpha = alpha.filter(ImageFilter.MinFilter(7)).filter(
        ImageFilter.GaussianBlur(0.7)
    ).point(lambda p: int(p * 0.14))

    outer_shadow = Image.new("RGBA", alpha.size, shadow_rgb + (0,))
    outer_shadow.putalpha(outer_alpha)
    inner_shadow = Image.new("RGBA", alpha.size, shadow_rgb + (0,))
    inner_shadow.putalpha(inner_alpha)

    shadow = Image.new("RGBA", alpha.size, (0, 0, 0, 0))
    shadow.alpha_composite(outer_shadow, (4, 1))
    shadow.alpha_composite(inner_shadow, (2, 1))
    return shadow


@lru_cache(maxsize=12)
def _build_circular_dot_tile(spacing: int, radius_ratio: float) -> np.ndarray:
    axis = np.arange(spacing, dtype=np.float32) - (spacing - 1) / 2.0
    yy, xx = np.meshgrid(axis, axis, indexing="ij")
    radius = spacing * radius_ratio
    return ((xx * xx + yy * yy) <= radius * radius).astype(np.float32)


def _build_circular_dot_mask(
    height: int,
    width: int,
    spacing: int,
    radius_ratio: float,
) -> np.ndarray:
    tile = _build_circular_dot_tile(spacing, radius_ratio)
    repeat_y = (height + spacing - 1) // spacing
    repeat_x = (width + spacing - 1) // spacing
    return np.tile(tile, (repeat_y, repeat_x))[:height, :width]


def _apply_classic_dot_overlay(
    warmed: np.ndarray,
    yy: np.ndarray,
    xx: np.ndarray,
    config,
) -> np.ndarray:
    dots = (np.sin(xx / 10.0) * np.sin(yy / 10.0) + 1.0) * 0.5
    dots = np.clip((dots - 0.5) * config.dot_strength, 0.0, config.dot_strength)
    return np.clip(warmed + dots[..., None], 0.0, 1.0)


def _apply_magazine_dot_overlay(
    warmed: np.ndarray,
    config,
) -> np.ndarray:
    luma = warmed[..., 0] * 0.2126 + warmed[..., 1] * 0.7152 + warmed[..., 2] * 0.0722
    dots = _build_circular_dot_mask(
        warmed.shape[0],
        warmed.shape[1],
        config.dot_spacing,
        config.dot_radius_ratio,
    )
    visibility = np.clip((0.97 - luma) * 0.82 + 0.42, 0.30, 0.86)
    dot_alpha = dots * visibility
    printed = warmed + dot_alpha[..., None] * config.dot_strength
    printed = printed * 0.985 + 0.015
    return np.clip(printed, 0.0, 1.0)


def _apply_cool_blackwhite_treatment(
    rgb: np.ndarray,
    grain: np.ndarray,
) -> np.ndarray:
    luma = rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722
    grayscale = np.stack(
        [
            np.clip(luma * 0.93 + 0.028, 0.0, 1.0),
            np.clip(luma * 0.97 + 0.034, 0.0, 1.0),
            np.clip(luma * 1.03 + 0.05, 0.0, 1.0),
        ],
        axis=-1,
    )
    return np.clip(grayscale + grain * 0.45, 0.0, 1.0)


def calculate_semivector_expand(image: Image.Image, border_size: str) -> int:
    if border_size not in SEMIVECTOR_BORDER_BASELINE:
        raise ValueError(f"unknown border size: {border_size}")

    longest_side = max(image.size)
    medium_expand = max(
        SEMIVECTOR_BORDER_MINIMUMS["medium"],
        int(round(longest_side * 0.0155)),
    )
    scaled = int(round(medium_expand * SEMIVECTOR_BORDER_BASELINE[border_size]))
    return max(SEMIVECTOR_BORDER_MINIMUMS[border_size], scaled)


def render_collage(
    image: Image.Image,
    template_name: str,
    border_size: str | None = None,
    paper_style: str | None = None,
) -> Image.Image:
    disable_border = border_size == "none"

    if template_name not in TEMPLATES:
        raise ValueError(f"unknown template: {template_name}")
    if border_size is not None and border_size not in BORDER_SIZE_NAMES:
        raise ValueError(f"unknown border size: {border_size}")
    if paper_style is not None and paper_style not in PAPER_STYLE_NAMES:
        raise ValueError(f"unknown paper style: {paper_style}")

    config = TEMPLATES[template_name]
    rgba = image.convert("RGBA")
    alpha = _threshold_alpha(rgba)
    semivector_expand = None
    if border_size is not None and not disable_border:
        semivector_expand = calculate_semivector_expand(alpha, border_size)
        rgba, alpha = _pad_canvas_for_semivector_border(rgba, alpha, semivector_expand)

    rgb = np.asarray(rgba, dtype=np.float32)[..., :3] / 255.0
    a = np.asarray(rgba.getchannel("A"), dtype=np.float32) / 255.0
    h, w = a.shape
    yy, xx = np.mgrid[0:h, 0:w]
    grain = np.random.default_rng(7).normal(0.0, config.grain_scale, (h, w, 1))

    warmed = np.stack(
        [
            np.clip(rgb[..., 0] * config.warmth[0] + config.tone_offset[0], 0.0, 1.0),
            np.clip(rgb[..., 1] * config.warmth[1] + config.tone_offset[1], 0.0, 1.0),
            np.clip(rgb[..., 2] * config.warmth[2] + config.tone_offset[2], 0.0, 1.0),
        ],
        axis=-1,
    )
    printed_base = np.clip(warmed + grain, 0.0, 1.0)
    if template_name == "cool-bw":
        printed = _apply_cool_blackwhite_treatment(rgb, grain)
    elif template_name == "magazine-dot":
        printed = _apply_magazine_dot_overlay(printed_base, config)
    else:
        printed = _apply_classic_dot_overlay(printed_base, yy, xx, config)
    subject = Image.fromarray(
        (np.dstack([printed, a[..., None]]) * 255.0).astype(np.uint8),
        "RGBA",
    )

    if disable_border:
        return subject

    border = Image.new("RGBA", rgba.size, config.border_rgba)
    if border_size is None:
        border.putalpha(_build_border(alpha, config.border_expand, config.border_blur))
        return Image.alpha_composite(border, subject)

    border_mask = _build_semivector_border(
        alpha,
        semivector_expand,
    )
    if paper_style is None or paper_style == "none":
        border = Image.new("RGBA", rgba.size, (255, 255, 255, 0))
        border.putalpha(border_mask)
        return Image.alpha_composite(border, subject)

    textured_border = _build_textured_border(border_mask, paper_style)
    shadow = _build_paper_shadow(alpha, border_mask)
    composite = Image.alpha_composite(shadow, textured_border)
    return Image.alpha_composite(composite, subject)
