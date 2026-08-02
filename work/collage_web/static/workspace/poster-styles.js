export const EXPORT_STYLE_OPTIONS = [
  { id: "none", label: "无" },
  { id: "poster-grid", label: "海报样式 A" },
  { id: "poster-edge", label: "海报样式 B" },
];

export function applyPosterStyle(context, canvas, styleId, bounds) {
  if (styleId === "poster-grid") {
    const backgroundGradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    backgroundGradient.addColorStop(0, "#f5f1e8");
    backgroundGradient.addColorStop(1, "#ece5d6");
    context.fillStyle = backgroundGradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "rgba(24, 28, 36, 0.92)";
    context.font = '700 18px "Helvetica Neue", "PingFang SC", sans-serif';
    context.fillText("COLLAGE MATERIAL POSTER", 24, 34);
    context.font = '500 11px "Helvetica Neue", "PingFang SC", sans-serif';
    context.fillStyle = "rgba(24, 28, 36, 0.56)";
    context.fillText("GRID STUDY / LOCAL EXPORT", 24, 52);

    context.strokeStyle = "rgba(34, 40, 52, 0.14)";
    context.lineWidth = 1;
    for (let x = 24; x < canvas.width; x += 24) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 24; y < canvas.height; y += 24) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }

    context.fillStyle = "rgba(24, 28, 36, 0.82)";
    context.fillRect(0, canvas.height - 34, canvas.width, 34);
    context.fillStyle = "rgba(245, 241, 232, 0.92)";
    context.font = '500 11px "Helvetica Neue", "PingFang SC", sans-serif';
    context.fillText(`SELECTION ${Math.round(bounds.width)} x ${Math.round(bounds.height)}`, 24, canvas.height - 13);
    return;
  }

  if (styleId === "poster-edge") {
    const paperGradient = context.createLinearGradient(0, 0, 0, canvas.height);
    paperGradient.addColorStop(0, "#fdf9f1");
    paperGradient.addColorStop(1, "#f2eadc");
    context.fillStyle = paperGradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "rgba(24, 28, 36, 0.92)";
    context.fillRect(0, 0, 26, canvas.height);
    context.fillStyle = "rgba(24, 28, 36, 0.92)";
    context.font = '700 18px "Helvetica Neue", "PingFang SC", sans-serif';
    context.fillText("EDGE", 42, 38);
    context.font = '500 11px "Helvetica Neue", "PingFang SC", sans-serif';
    context.fillStyle = "rgba(24, 28, 36, 0.56)";
    context.fillText("COLLAGE EXPORT EDITION", 42, 56);

    context.strokeStyle = "#1f2430";
    context.lineWidth = 14;
    context.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);
    context.lineWidth = 2;
    context.strokeStyle = "rgba(31, 36, 48, 0.25)";
    context.strokeRect(
      Math.max(18, bounds.x - 12),
      Math.max(18, bounds.y - 12),
      Math.min(canvas.width - 36, bounds.width + 24),
      Math.min(canvas.height - 36, bounds.height + 24),
    );

    context.fillStyle = "rgba(24, 28, 36, 0.84)";
    context.font = '500 11px "Helvetica Neue", "PingFang SC", sans-serif';
    context.fillText("PRINT BORDER / LOCAL PNG", 42, canvas.height - 22);
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
}
