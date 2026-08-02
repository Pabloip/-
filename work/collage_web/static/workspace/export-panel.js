import { computeSelectionBounds } from "./export-bounds.js?v=20260729-03";
import { EXPORT_STYLE_OPTIONS, applyPosterStyle } from "./poster-styles.js?v=20260729-03";

// EXPORT_STYLE_OPTIONS starts with { id: "none", label: "无" } as a real export style.
export const EXPORT_SCALE_OPTIONS = [
  { id: "1x", label: "1x" },
  { id: "2x", label: "2x" },
];
export const EXPORT_BACKGROUND_OPTIONS = [
  { id: "transparent", label: "透明背景" },
  { id: "paper", label: "纸底背景" },
];
// Default export quality keeps scale: "2x" and backgroundMode: "transparent".

function renderExportStyleOptions(listNode, selectedStyleId) {
  listNode.innerHTML = EXPORT_STYLE_OPTIONS.map(
    (option) => `
      <button
        type="button"
        class="export-style-option${
          option.id === selectedStyleId ? " export-style-option--active" : ""
        }"
        data-export-style-id="${option.id}"
      >
        ${option.label}
      </button>
    `,
  ).join("");
}

function renderToggleOptions(listNode, options, selectedOptionId, dataAttribute) {
  listNode.innerHTML = options
    .map(
      (option) => `
        <button
          type="button"
          class="export-style-option${
            option.id === selectedOptionId ? " export-style-option--active" : ""
          }"
          ${dataAttribute}="${option.id}"
        >
          ${option.label}
        </button>
      `,
    )
    .join("");
}

export function buildExportPayload({
  objects,
  posterStyleId,
  scale = "2x",
  backgroundMode = "transparent",
}) {
  return {
    bounds: computeSelectionBounds(objects),
    objectIds: objects.map((object) => object.id),
    posterStyleId,
    scale,
    backgroundMode,
  };
}

export function buildPosterExportPayload({ surfaceRect, objects }) {
  return {
    width: Math.max(1, Math.round(surfaceRect.width)),
    height: Math.max(1, Math.round(surfaceRect.height)),
    objects: objects.map((object) => ({
      id: object.id,
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      rotation: object.rotation,
      assetRef: object.assetRef,
      drawX: object.drawX ?? object.x,
      drawY: object.drawY ?? object.y,
      drawWidth: object.drawWidth ?? object.width,
      drawHeight: object.drawHeight ?? object.height,
    })),
  };
}

function loadImage(sourceUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法加载导出素材：${sourceUrl}`));
    image.src = sourceUrl;
  });
}

function fitImageContain(frameWidth, frameHeight, imageWidth, imageHeight) {
  if (
    frameWidth <= 0 ||
    frameHeight <= 0 ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    return {
      width: Math.max(0, frameWidth),
      height: Math.max(0, frameHeight),
    };
  }

  const scale = Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
  return {
    width: imageWidth * scale,
    height: imageHeight * scale,
  };
}

function computeImageRenderScale(image, object) {
  const widthScale =
    (object.drawWidth || object.width) > 0
      ? image.naturalWidth / (object.drawWidth || object.width)
      : 1;
  const heightScale =
    (object.drawHeight || object.height) > 0
      ? image.naturalHeight / (object.drawHeight || object.height)
      : 1;
  return Math.max(1, widthScale || 1, heightScale || 1);
}

function traceRoundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

async function renderExportCanvas(payload, objects) {
  const bounds = payload.bounds;
  const exportScale = payload.scale === "2x" ? 2 : 1;
  const usePosterBackground =
    payload.backgroundMode === "paper" || payload.posterStyleId !== "none";
  const padding = usePosterBackground ? 40 : 0;
  const loadedObjects = await Promise.all(
    objects.map(async (object) => ({
      object,
      image: await loadImage(object.assetRef),
    })),
  );
  const renderScale = Math.max(
    exportScale,
    ...loadedObjects.map(({ image, object }) => computeImageRenderScale(image, object)),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil((bounds.width + padding * 2) * renderScale));
  canvas.height = Math.max(1, Math.ceil((bounds.height + padding * 2) * renderScale));
  const context = canvas.getContext("2d");
  if (usePosterBackground) {
    context.save();
    context.scale(renderScale, renderScale);
    applyPosterStyle(context, canvas, payload.posterStyleId, {
      x: padding,
      y: padding,
      width: bounds.width,
      height: bounds.height,
    });
    context.restore();
  } else {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  context.save();
  context.scale(renderScale, renderScale);
  for (const { object, image } of loadedObjects) {
    const drawX = object.x - bounds.x + padding;
    const drawY = object.y - bounds.y + padding;
    const containSize = fitImageContain(
      object.width,
      object.height,
      image.naturalWidth || image.width,
      image.naturalHeight || image.height,
    );
    context.save();
    context.translate(drawX + object.width / 2, drawY + object.height / 2);
    context.rotate((object.rotation * Math.PI) / 180);
    context.drawImage(
      image,
      -containSize.width / 2,
      -containSize.height / 2,
      containSize.width,
      containSize.height,
    );
    context.restore();
  }
  context.restore();

  return canvas;
}

function drawPosterGrid(context, width, height) {
  context.save();
  context.fillStyle = "rgba(104, 90, 70, 0.074)";
  for (let y = 27; y < height; y += 28) {
    context.fillRect(0, y, width, 1);
  }
  context.fillStyle = "rgba(104, 90, 70, 0.068)";
  for (let x = 27; x < width; x += 28) {
    context.fillRect(x, 0, 1, height);
  }
  context.restore();
}

function drawPosterFrame(context, width, height) {
  const insetLeft = 18;
  const insetTop = 18;
  const insetRight = 22;
  const insetBottom = 20;
  const frameX = insetLeft;
  const frameY = insetTop;
  const frameWidth = Math.max(0, width - insetLeft - insetRight);
  const frameHeight = Math.max(0, height - insetTop - insetBottom);
  const frameRadius = 24;

  context.save();
  context.strokeStyle = "rgba(104, 90, 70, 0.14)";
  context.lineWidth = 1;
  traceRoundedRect(context, frameX, frameY, frameWidth, frameHeight, frameRadius);
  context.stroke();

  context.strokeStyle = "rgba(104, 90, 70, 0.1)";
  context.beginPath();
  context.moveTo(frameX, frameY + 54);
  context.lineTo(frameX + frameWidth, frameY + 54);
  context.stroke();

  context.beginPath();
  context.moveTo(frameX + 68, frameY);
  context.lineTo(frameX + 68, frameY + frameHeight);
  context.stroke();

  context.strokeStyle = "rgba(176, 122, 83, 0.32)";
  const cornerLength = 20;
  const cornerInset = 16;
  const corners = [
    { x: frameX + cornerInset, y: frameY + cornerInset, dx: 1, dy: 1 },
    { x: frameX + frameWidth - cornerInset, y: frameY + cornerInset, dx: -1, dy: 1 },
    { x: frameX + cornerInset, y: frameY + frameHeight - cornerInset, dx: 1, dy: -1 },
    {
      x: frameX + frameWidth - cornerInset,
      y: frameY + frameHeight - cornerInset,
      dx: -1,
      dy: -1,
    },
  ];

  corners.forEach((corner) => {
    context.beginPath();
    context.moveTo(corner.x, corner.y);
    context.lineTo(corner.x + corner.dx * cornerLength, corner.y);
    context.stroke();

    context.beginPath();
    context.moveTo(corner.x, corner.y);
    context.lineTo(corner.x, corner.y + corner.dy * cornerLength);
    context.stroke();
  });
  context.restore();
}

function drawPosterBackground(context, width, height) {
  const outerRadius = 34;
  context.save();
  traceRoundedRect(context, 0, 0, width, height, outerRadius);
  context.clip();

  const baseGradient = context.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, "#fbf8f0");
  baseGradient.addColorStop(0.52, "#f4ede1");
  baseGradient.addColorStop(1, "#efe6d8");
  context.fillStyle = baseGradient;
  context.fillRect(0, 0, width, height);

  context.save();
  const paperWash = context.createLinearGradient(0, 0, 0, height);
  paperWash.addColorStop(0, "rgba(255, 255, 255, 0.82)");
  paperWash.addColorStop(1, "rgba(255, 255, 255, 0.56)");
  context.fillStyle = paperWash;
  context.fillRect(0, 0, width, height);

  const topGlow = context.createRadialGradient(
    width * 0.14,
    height * 0.1,
    0,
    width * 0.14,
    height * 0.1,
    Math.max(width, height) * 0.2,
  );
  topGlow.addColorStop(0, "rgba(255, 255, 255, 0.34)");
  topGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = topGlow;
  context.fillRect(0, 0, width, height);

  const rightGlow = context.createRadialGradient(
    width * 0.82,
    height * 0.14,
    0,
    width * 0.82,
    height * 0.14,
    Math.max(width, height) * 0.19,
  );
  rightGlow.addColorStop(0, "rgba(236, 231, 220, 0.42)");
  rightGlow.addColorStop(1, "rgba(236, 231, 220, 0)");
  context.fillStyle = rightGlow;
  context.fillRect(0, 0, width, height);

  const lowerGlow = context.createRadialGradient(
    width * 0.18,
    height * 0.84,
    0,
    width * 0.18,
    height * 0.84,
    Math.max(width, height) * 0.25,
  );
  lowerGlow.addColorStop(0, "rgba(214, 202, 184, 0.18)");
  lowerGlow.addColorStop(1, "rgba(214, 202, 184, 0)");
  context.fillStyle = lowerGlow;
  context.fillRect(0, 0, width, height);

  drawPosterGrid(context, width, height);
  context.restore();

  context.save();
  context.strokeStyle = "rgba(255, 255, 255, 0.44)";
  context.lineWidth = 1;
  traceRoundedRect(context, 0.5, 0.5, width - 1, height - 1, outerRadius);
  context.stroke();
  context.restore();

  drawPosterFrame(context, width, height);
}

async function renderPosterExportCanvas(payload) {
  const loadedObjects = await Promise.all(
    payload.objects.map(async (object) => ({
      object,
      image: await loadImage(object.assetRef),
    })),
  );
  const renderScale = Math.max(
    2,
    ...loadedObjects.map(({ image, object }) => computeImageRenderScale(image, object)),
  );

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(payload.width * renderScale));
  canvas.height = Math.max(1, Math.ceil(payload.height * renderScale));
  const context = canvas.getContext("2d");
  context.scale(renderScale, renderScale);

  drawPosterBackground(context, payload.width, payload.height);

  for (const { object, image } of loadedObjects) {
    const drawX = object.drawX ?? object.x;
    const drawY = object.drawY ?? object.y;
    const drawWidth = object.drawWidth ?? object.width;
    const drawHeight = object.drawHeight ?? object.height;
    context.save();
    context.translate(object.x + object.width / 2, object.y + object.height / 2);
    context.rotate((object.rotation * Math.PI) / 180);
    context.drawImage(
      image,
      drawX - (object.x + object.width / 2),
      drawY - (object.y + object.height / 2),
      drawWidth,
      drawHeight,
    );
    context.restore();
  }

  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("导出图片失败，未生成文件内容。"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

async function downloadCanvasBlob(canvas, fileName) {
  const blob = await canvasToBlob(canvas);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadExportPayload(payload, objects) {
  const canvas = await renderExportCanvas(payload, objects);
  await downloadCanvasBlob(canvas, `collage-export-${payload.posterStyleId || "none"}.png`);
}

export async function downloadPosterExport(payload) {
  const canvas = await renderPosterExportCanvas(payload);
  await downloadCanvasBlob(canvas, "collage-poster.png");
}

export function openExportPanel({
  panelNode,
  countNode,
  styleListNode,
  scaleListNode,
  backgroundListNode,
  payloadNode,
  summary,
  selectedObjects,
  posterStyleId = "none",
  scale = "2x",
  backgroundMode = "transparent",
}) {
  if (
    !panelNode ||
    !countNode ||
    !styleListNode ||
    !scaleListNode ||
    !backgroundListNode ||
    !payloadNode
  ) {
    return null;
  }

  panelNode.hidden = false;
  countNode.textContent = `${summary.count} 个对象`;
  renderExportStyleOptions(styleListNode, posterStyleId);
  renderToggleOptions(scaleListNode, EXPORT_SCALE_OPTIONS, scale, "data-export-scale");
  renderToggleOptions(
    backgroundListNode,
    EXPORT_BACKGROUND_OPTIONS,
    backgroundMode,
    "data-export-background-mode",
  );

  const payload = buildExportPayload({
    objects: selectedObjects,
    posterStyleId,
    scale,
    backgroundMode,
  });
  payloadNode.textContent = JSON.stringify(payload, null, 2);
  return payload;
}
