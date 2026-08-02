import { fetchTemplatePayload } from "./render-actions.js?v=20260729-03";

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

function orderOptions(options, order) {
  const optionMap = new Map((options || []).map((option) => [option.id, option]));
  const ordered = order.map((id) => optionMap.get(id)).filter(Boolean);
  const remainder = (options || []).filter((option) => !order.includes(option.id));
  return [...ordered, ...remainder];
}

function withPaperStylePreview(option) {
  if (!option) {
    return option;
  }

  const previewName = option.id === "none" ? "00" : option.id.replace("paper-", "");
  return {
    ...option,
    previewAssetRef: `/static/mock-assets/paper-style-thumbnails/${previewName}.png`,
  };
}

export async function loadCollageStyleRegistry() {
  const payload = await fetchTemplatePayload();
  return {
    templates: orderOptions(payload.templates, TEMPLATE_ORDER),
    borderSizes: orderOptions(payload.border_sizes, BORDER_SIZE_ORDER),
    paperStyles: orderOptions(payload.paper_styles, PAPER_STYLE_ORDER).map(
      withPaperStylePreview,
    ),
  };
}
