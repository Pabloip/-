const TEMPLATE_ORDER = ["clean-cut", "print-warm", "magazine-dot", "cool-bw"];
const BORDER_SIZE_ORDER = ["none", "small", "medium", "large"];
const PAPER_STYLE_ORDER = [
  "none",
  "paper-01",
  "paper-02",
  "paper-03",
  "paper-04",
  "paper-05",
  "paper-06",
];

const TEMPLATE_CAPTIONS = {
  "clean-cut": "Clean Layout",
  "print-warm": "Warm Print",
  "magazine-dot": "Magazine Dot",
  "cool-bw": "Cool Monochrome",
};

const TEMPLATE_SWATCH_STYLES = {
  "clean-cut":
    "--swatch-paper: linear-gradient(180deg, #fbf7ef, #f0e7d7); --swatch-ink: rgba(36, 29, 22, 0.42);",
  "print-warm":
    "--swatch-paper: linear-gradient(180deg, #f7ecdf, #e7d4bc); --swatch-ink: rgba(134, 82, 52, 0.44);",
  "magazine-dot":
    "--swatch-paper: linear-gradient(180deg, #f8f2e8, #eee0cd); --swatch-ink: rgba(184, 92, 54, 0.42);",
  "cool-bw":
    "--swatch-paper: linear-gradient(180deg, #f3f1ed, #d8d5d0); --swatch-ink: rgba(58, 58, 58, 0.46);",
};

function resolveRenderActionCopy(renderActionState = "idle") {
  if (renderActionState === "rendering") {
    return "生成中...";
  }
  if (renderActionState === "success") {
    return "拼贴已生成";
  }
  if (renderActionState === "failure") {
    return "重试生成";
  }
  return "生成拼贴";
}

function resolvePosterRenderActionCopy(renderActionState = "idle") {
  if (renderActionState === "rendering") {
    return "生成中...";
  }
  if (renderActionState === "success") {
    return "海报已生成";
  }
  if (renderActionState === "failure") {
    return "重试生成";
  }
  return "生成拼贴海报";
}

function renderEmptyTools() {
  return `
    <div class="assistant-band__empty">
      <p class="assistant-band__label">等待选择</p>
    </div>
    <button
      type="button"
      class="assistant-primary-action assistant-primary-action--button"
      data-render-selection
      disabled
    >
      <span class="assistant-primary-action__label">生成拼贴</span>
    </button>
  `;
}

function renderStyleSwatches(options, selectedId) {
  return (options || [])
    .map((option, index) => {
      const swatchClass = [
        "style-swatch",
        option.id === selectedId ? "style-swatch--selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const marker = String(index + 1).padStart(2, "0");
      const caption = TEMPLATE_CAPTIONS[option.id] || option.label;
      const style = TEMPLATE_SWATCH_STYLES[option.id] || "";
      return `
        <button
          type="button"
          class="${swatchClass}"
          data-collage-template="${option.id}"
        >
          <span class="style-swatch__marker">${marker}</span>
          <span class="style-swatch__sample" style="${style}"></span>
          <span class="style-swatch__meta">
            <span class="style-swatch__title">${option.label}</span>
            <span class="style-swatch__caption">${caption}</span>
          </span>
        </button>
      `;
    })
    .join("");
}

function renderBorderSizeChips(options, selectedId) {
  return (options || [])
    .map((option) => {
      const chipClass = [
        "border-size-chip",
        option.id === selectedId ? "border-size-chip--selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <button
          type="button"
          class="${chipClass}"
          data-collage-border-size="${option.id}"
        >
          ${option.label}
        </button>
      `;
    })
    .join("");
}

function renderTexturePills(options, selectedId) {
  return (options || [])
    .map((option) => {
      const pillClass = [
        "texture-pill",
        option.id === selectedId ? "texture-pill--selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const label = option.id === "none" ? "无纸张" : option.label;
      return `
        <button
          type="button"
          class="${pillClass}"
          data-collage-paper-style="${option.id}"
        >
          <span
            class="texture-pill__swatch"
            style="background-image: url('${option.previewAssetRef || ""}');"
          ></span>
          <span class="texture-pill__label">${label}</span>
        </button>
      `;
    })
    .join("");
}

function renderActionButton({
  actionAttribute,
  renderActionState = "idle",
  disabled = false,
  labelResolver = resolveRenderActionCopy,
} = {}) {
  const buttonClass = [
    "assistant-primary-action",
    "assistant-primary-action--button",
    renderActionState !== "idle" ? `assistant-primary-action--${renderActionState}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const label = labelResolver(renderActionState);
  const isDisabled = disabled || renderActionState === "rendering";
  return `
    <button
      type="button"
      class="${buttonClass}"
      ${actionAttribute}
      data-render-state="${renderActionState}"
      ${isDisabled ? "disabled" : ""}
    >
      <span class="assistant-primary-action__label">${label}</span>
    </button>
  `;
}

function renderRenderAction(renderActionState = "idle", disabled = false) {
  return renderActionButton({
    actionAttribute: "data-render-selection",
    renderActionState,
    disabled,
    labelResolver: resolveRenderActionCopy,
  });
}

function renderPosterExportAction(renderActionState = "idle", disabled = false) {
  return renderActionButton({
    actionAttribute: "data-render-poster",
    renderActionState,
    disabled,
    labelResolver: resolvePosterRenderActionCopy,
  });
}

function renderPosterExportMode(collageControls) {
  return `
    <section class="assistant-section assistant-section--poster-export">
      <p class="assistant-section__label">拼贴海报</p>
      <p class="assistant-band__description">导出当前画布，生成可分享的拼贴成图。</p>
    </section>
    ${renderPosterExportAction(collageControls.posterRenderActionState, false)}
  `;
}

function renderCollageControls(collageControls) {
  const templates = orderOptions(collageControls.templates, TEMPLATE_ORDER);
  const borderSizes = orderOptions(collageControls.borderSizes, BORDER_SIZE_ORDER);
  const paperStyles = orderOptions(collageControls.paperStyles, PAPER_STYLE_ORDER);
  const shouldShowPaperStyles = collageControls.selectedBorderSizeId !== "none";
  const templateOptions = renderStyleSwatches(templates, collageControls.selectedTemplateId);
  const borderSizeOptions = renderBorderSizeChips(
    borderSizes,
    collageControls.selectedBorderSizeId,
  );
  const paperStyleOptions = renderTexturePills(
    paperStyles,
    collageControls.selectedPaperStyleId,
  );

  return `
    <section class="assistant-section">
      <p class="assistant-section__label">拼贴风格</p>
      <div class="style-swatch-list" data-collage-template-list>${templateOptions}</div>
    </section>
    <section class="assistant-section">
      <p class="assistant-section__label">描边粗细</p>
      <div class="border-size-strip" data-collage-border-size-list>${borderSizeOptions}</div>
    </section>
    ${
      shouldShowPaperStyles
        ? `
    <section class="assistant-section">
      <p class="assistant-section__label">描边纹理</p>
      <div class="texture-pill-rail" data-collage-paper-style-list>${paperStyleOptions}</div>
    </section>`
        : ""
    }
    ${renderRenderAction(collageControls.renderActionState, false)}
  `;
}

function orderOptions(options, order) {
  const optionMap = new Map((options || []).map((option) => [option.id, option]));
  const ordered = order.map((id) => optionMap.get(id)).filter(Boolean);
  const remainder = (options || []).filter((option) => !order.includes(option.id));
  return [...ordered, ...remainder];
}

function renderSingleSelection(summary, collageControls) {
  return renderCollageControls(collageControls);
}

function renderMultiSelection(summary, collageControls) {
  return renderCollageControls(collageControls);
}

export function renderToolRail(contextNode, summary, collageControls = {}) {
  if (!summary.count && collageControls.hasObjects) {
    contextNode.innerHTML = renderPosterExportMode(collageControls);
    return;
  }

  if (!summary.count) {
    contextNode.innerHTML = renderEmptyTools();
    return;
  }

  contextNode.innerHTML =
    summary.count === 1
      ? renderSingleSelection(summary, collageControls)
      : renderMultiSelection(summary, collageControls);
}
