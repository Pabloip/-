let hasRenderedEmptyWorkspaceEntrance = false;

function resolveStatusClassName(status) {
  if (status === "landing") {
    return "workspace-object--landing";
  }
  if (status === "printing") {
    return "workspace-object--printing";
  }
  if (status === "revealing") {
    return "workspace-object--revealing";
  }
  if (status === "collected") {
    return "workspace-object--collected";
  }
  if (status === "failed") {
    return "workspace-object--failed";
  }
  return "";
}

function resolveStatusLabel(object) {
  if (object.status === "landing") {
    return "纸片落入册页";
  }
  if (object.status === "printing") {
    return "纸感显影中";
  }
  if (object.status === "revealing") {
    return "图像浮现";
  }
  if (object.status === "collected") {
    return "成品已收录";
  }
  if (object.status === "failed") {
    return object.failureReason || "生成失败";
  }
  return "";
}

function renderResizeHandles(isSelected) {
  if (!isSelected) {
    return "";
  }

  return `
    <button type="button" class="workspace-object__resize-handle workspace-object__resize-handle--nw" data-resize-handle="nw" aria-label="缩放左上角"></button>
    <button type="button" class="workspace-object__resize-handle workspace-object__resize-handle--ne" data-resize-handle="ne" aria-label="缩放右上角"></button>
    <button type="button" class="workspace-object__resize-handle workspace-object__resize-handle--sw" data-resize-handle="sw" aria-label="缩放左下角"></button>
    <button type="button" class="workspace-object__resize-handle workspace-object__resize-handle--se" data-resize-handle="se" aria-label="缩放右下角"></button>
  `;
}

function renderWorkspaceObject(object, selectedIds, draggingObjectId) {
  const isSelected = selectedIds.includes(object.id);
  const isDragging = draggingObjectId === object.id;
  const statusClassName = resolveStatusClassName(object.status);
  const statusLabel = resolveStatusLabel(object);
  const className = [
    "workspace-object",
    isSelected ? "workspace-object--selected" : "",
    isDragging ? "workspace-object--dragging" : "",
    statusClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <article
      class="${className}"
      data-workspace-object-id="${object.id}"
      data-workspace-object-status="${object.status}"
      tabindex="-1"
      style="
        left:${object.x}px;
        top:${object.y}px;
        width:${object.width}px;
        height:${object.height}px;
        z-index:${object.zIndex};
        transform: rotate(${object.rotation}deg);
      "
    >
      <img
        class="workspace-object__image"
        src="${object.assetRef}"
        alt="${object.fileName || "拼贴素材"}"
        draggable="false"
      />
      ${renderResizeHandles(isSelected)}
      ${
        statusLabel
          ? `<span class="workspace-object__status">${statusLabel}</span>`
          : ""
      }
    </article>
  `;
}

function renderEmptyWorkspaceState() {
  const className = hasRenderedEmptyWorkspaceEntrance
    ? "workspace-empty-state"
    : "workspace-empty-state workspace-empty-state--entrance";
  hasRenderedEmptyWorkspaceEntrance = true;

  return `
    <section class="${className}">
      <div class="workspace-empty-state__copy">
        <p class="workspace-empty-state__eyebrow">CANVAS READY</p>
        <h2>开始“万物皆可拼贴”之旅</h2>
        <p>导入 1 到 6 张图片，让它们先落进拼贴画布，然后开始拼贴DIY。</p>
      </div>
      <div class="workspace-empty-state__markers">
        <span class="workspace-empty-state__marker" data-step="01">拖入图片进来</span>
        <span class="workspace-empty-state__marker" data-step="02">材质先显，图像后出</span>
        <span class="workspace-empty-state__marker" data-step="03">成品直接收录下载</span>
      </div>
    </section>
  `;
}

function renderMarquee(marquee) {
  if (!marquee) {
    return "";
  }

  const left = Math.min(marquee.startX, marquee.endX);
  const top = Math.min(marquee.startY, marquee.endY);
  const width = Math.abs(marquee.endX - marquee.startX);
  const height = Math.abs(marquee.endY - marquee.startY);

  return `
    <div
      class="workspace-marquee"
      style="left:${left}px;top:${top}px;width:${width}px;height:${height}px;"
    ></div>
  `;
}

function syncEmptyWorkspaceMarquee(surfaceNode, marquee) {
  const existingMarquee = surfaceNode.querySelector(".workspace-marquee");
  if (existingMarquee) {
    existingMarquee.remove();
  }

  if (!marquee) {
    return;
  }

  surfaceNode.insertAdjacentHTML("beforeend", renderMarquee(marquee));
}

export function renderWorkspace(surfaceNode, state) {
  const selectedIds = state.selection.selectedIds || [];
  const draggingObjectId = state.selection.draggingObjectId || null;
  if (!state.objects.length) {
    const existingEmptyState = surfaceNode.querySelector(".workspace-empty-state");
    if (!existingEmptyState) {
      surfaceNode.innerHTML = renderEmptyWorkspaceState();
    }
    syncEmptyWorkspaceMarquee(surfaceNode, state.selection.marquee);
    return;
  }

  const objectMarkup = state.objects
    .map((object) => renderWorkspaceObject(object, selectedIds, draggingObjectId))
    .join("");

  surfaceNode.innerHTML = objectMarkup + renderMarquee(state.selection.marquee);
}
