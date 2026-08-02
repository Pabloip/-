import { createWorkspaceStore } from "./canvas-store.js?v=20260729-03";
import { createSelectionState } from "./selection-state.js?v=20260729-03";
import { scatterWorkspaceObjects } from "./scatter-layout.js?v=20260729-03";
import { renderWorkspace } from "./workspace-renderer.js?v=20260802-02";
import { renderWorkspaceSelection } from "./render-actions.js?v=20260729-03";
import { loadCollageStyleRegistry } from "./collage-styles.js?v=20260729-03";
import {
  openExportPanel,
  buildExportPayload,
  downloadExportPayload,
  buildPosterExportPayload,
  downloadPosterExport,
} from "./export-panel.js?v=20260729-03";
import { EXPORT_STYLE_OPTIONS } from "./poster-styles.js?v=20260729-03";
import { renderToolRail } from "./tool-rail.js?v=20260729-03";

function buildWorkspaceSnapshot(store, selectionState) {
  return {
    objects: store.getSnapshot(),
    selection: selectionState.getSelectionSummary(),
  };
}

function toSurfacePoint(surface, clientX, clientY) {
  const rect = surface.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

function pickFiles(fileList) {
  return Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
}

function createImportInput() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".png,.jpg,.jpeg,.heic,.heif,image/png,image/jpeg,image/heic,image/heif";
  input.multiple = true;
  input.hidden = true;
  document.body.append(input);
  return input;
}

function wait(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function measureContainRect(frameWidth, frameHeight, imageWidth, imageHeight) {
  if (
    frameWidth <= 0 ||
    frameHeight <= 0 ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    return {
      drawWidth: Math.max(0, frameWidth),
      drawHeight: Math.max(0, frameHeight),
    };
  }

  const scale = Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
  return {
    drawWidth: imageWidth * scale,
    drawHeight: imageHeight * scale,
  };
}

function buildPosterExportObjects(surfaceNode, objects) {
  return objects.map((object) => {
    const objectNode = surfaceNode.querySelector(`[data-workspace-object-id="${object.id}"]`);
    const imageNode = objectNode?.querySelector(".workspace-object__image");
    const frameWidth = objectNode?.clientWidth || object.width;
    const frameHeight = objectNode?.clientHeight || object.height;
    const { drawWidth, drawHeight } = measureContainRect(
      frameWidth,
      frameHeight,
      imageNode?.naturalWidth || frameWidth,
      imageNode?.naturalHeight || frameHeight,
    );

    return {
      ...object,
      drawX: object.x + (frameWidth - drawWidth) / 2,
      drawY: object.y + (frameHeight - drawHeight) / 2,
      drawWidth,
      drawHeight,
    };
  });
}

function shouldIgnoreGlobalSelectionResetEvent(event) {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
  return path.some(
    (node) =>
      node instanceof Element &&
      (node.matches("[data-object-dropzone]") ||
        node.matches("[data-tool-context]") ||
        node.matches("[data-assistant-band]") ||
        node.matches("button, input, select, textarea, label, a")),
  );
}

export function bootstrapCanvasWorkspace() {
  const surface = document.querySelector("[data-object-dropzone]");
  const contextNode = document.querySelector("[data-tool-context]");
  const assistantBand = document.querySelector("[data-assistant-band]");
  const importButton = document.querySelector("[data-import-action]");
  const exportPanelNode = document.querySelector("[data-export-panel]");
  const exportCountNode = document.querySelector("[data-export-count]");
  const exportStyleListNode = document.querySelector("[data-export-style-list]");
  const exportScaleListNode = document.querySelector("[data-export-scale-list]");
  const exportBackgroundListNode = document.querySelector("[data-export-background-list]");
  const exportPayloadNode = document.querySelector("[data-export-payload-preview]");
  const exportDownloadButton = document.querySelector("[data-export-download]");
  const deleteSelectionAction = document.querySelector("[data-delete-selection-action]");
  const exportSelectionAction =
    document.querySelector("[data-export-selection-action]") || exportDownloadButton;
  if (!surface) {
    return;
  }

  const workspaceStore = createWorkspaceStore();
  const selectionState = createSelectionState();
  const importInput = createImportInput();
  let dragState = null;
  let resizeState = null;
  let collageStyleRegistry = null;
  let selectedTemplateId = null;
  let selectedBorderSizeId = null;
  let selectedPaperStyleId = null;
  let renderActionState = "idle";
  let renderActionResetTimer = null;
  let posterRenderActionState = "idle";
  let posterRenderActionResetTimer = null;
  let selectedExportStyleId = EXPORT_STYLE_OPTIONS[0].id;
  let selectedExportScale = "2x";
  let selectedExportBackgroundMode = "transparent";

  if (assistantBand) {
    assistantBand.classList.add("assistant-band--entrance");
    window.setTimeout(() => {
      assistantBand.classList.remove("assistant-band--entrance");
    }, 900);
  }

  function setObjectsStatus(objectIds, status, extraPatch = {}) {
    objectIds.forEach((objectId) => {
      workspaceStore.updateObject(objectId, { status, ...extraPatch });
    });
  }

  function queueReadyReset(objectIds, delay = 860) {
    window.setTimeout(() => {
      setObjectsStatus(objectIds, "ready", { failureReason: null });
      syncWorkspace();
    }, delay);
  }

  function ensureCollageDefaults(registry) {
    if (!registry) {
      return;
    }

    selectedTemplateId ||= registry.templates?.[0]?.id || null;
    selectedBorderSizeId ||=
      registry.borderSizes?.find((item) => item.id === "medium")?.id ||
      registry.borderSizes?.[0]?.id ||
      null;
    selectedPaperStyleId ||=
      registry.paperStyles?.find((item) => item.id === "none")?.id ||
      registry.paperStyles?.[0]?.id ||
      null;
  }

  function setRenderActionState(nextState, { resetAfter = 0 } = {}) {
    renderActionState = nextState;
    if (renderActionResetTimer) {
      window.clearTimeout(renderActionResetTimer);
      renderActionResetTimer = null;
    }
    if (resetAfter > 0) {
      renderActionResetTimer = window.setTimeout(() => {
        renderActionState = "idle";
        renderActionResetTimer = null;
        syncWorkspace();
      }, resetAfter);
    }
    syncWorkspace();
  }

  function setPosterRenderActionState(nextState, { resetAfter = 0 } = {}) {
    posterRenderActionState = nextState;
    if (posterRenderActionResetTimer) {
      window.clearTimeout(posterRenderActionResetTimer);
      posterRenderActionResetTimer = null;
    }
    if (resetAfter > 0) {
      posterRenderActionResetTimer = window.setTimeout(() => {
        posterRenderActionState = "idle";
        posterRenderActionResetTimer = null;
        syncWorkspace();
      }, resetAfter);
    }
    syncWorkspace();
  }

  function syncWorkspace() {
    renderWorkspace(surface, buildWorkspaceSnapshot(workspaceStore, selectionState));
    if (contextNode) {
      renderToolRail(contextNode, selectionState.getSelectionSummary(), {
        hasObjects: workspaceStore.getSnapshot().length > 0,
        templates: collageStyleRegistry?.templates || [],
        borderSizes: collageStyleRegistry?.borderSizes || [],
        paperStyles: collageStyleRegistry?.paperStyles || [],
        selectedTemplateId,
        selectedBorderSizeId,
        selectedPaperStyleId,
        renderActionState,
        posterRenderActionState,
      });
    }
    syncExportPanel();
  }

  function insertFiles(files) {
    if (!files.length) {
      return;
    }

    const topZIndex = workspaceStore
      .getSnapshot()
      .reduce((highest, object) => Math.max(highest, object.zIndex), 0);
    const nextObjects = scatterWorkspaceObjects(
      files,
      surface.getBoundingClientRect(),
      topZIndex,
    );
    const nextObjectIds = nextObjects.map((object) => object.id);
    workspaceStore.appendObjects(nextObjects);
    selectionState.setSelectedIds(nextObjectIds);
    syncWorkspace();
    queueReadyReset(nextObjectIds, 920);
  }

  function getSelectedObjects() {
    const summary = selectionState.getSelectionSummary();
    return summary.selectedIds
      .map((objectId) => workspaceStore.getObject(objectId))
      .filter(Boolean);
  }

  function syncExportPanel() {
    const summary = selectionState.getSelectionSummary();
    const selectedObjects = getSelectedObjects();
    if (deleteSelectionAction) {
      deleteSelectionAction.hidden = !summary.count || !selectedObjects.length;
      deleteSelectionAction.toggleAttribute("disabled", !summary.count || !selectedObjects.length);
    }
    if (exportSelectionAction) {
      exportSelectionAction.hidden = !summary.count || !selectedObjects.length;
      exportSelectionAction.toggleAttribute("disabled", !summary.count || !selectedObjects.length);
    }
    if (exportDownloadButton) {
      exportDownloadButton.hidden = !summary.count || !selectedObjects.length;
    }
    if (!summary.count || !selectedObjects.length) {
      if (exportPanelNode) {
        exportPanelNode.hidden = true;
      }
      return null;
    }

    return openExportPanel({
      panelNode: exportPanelNode,
      countNode: exportCountNode,
      styleListNode: exportStyleListNode,
      scaleListNode: exportScaleListNode,
      backgroundListNode: exportBackgroundListNode,
      payloadNode: exportPayloadNode,
      summary,
      selectedObjects,
      posterStyleId: selectedExportStyleId,
      scale: selectedExportScale,
      backgroundMode: selectedExportBackgroundMode,
    });
  }

  async function renderCurrentSelection() {
    const summary = selectionState.getSelectionSummary();
    if (
      renderActionState === "rendering" ||
      !summary.selectedIds.length ||
      !collageStyleRegistry?.templates?.length
    ) {
      return;
    }

    setRenderActionState("rendering");
    try {
      await renderWorkspaceSelection({
        workspaceStore,
        objectIds: summary.selectedIds,
        template: selectedTemplateId,
        borderSize: selectedBorderSizeId,
        paperStyle: selectedPaperStyleId,
      });
      setRenderActionState("success", { resetAfter: 960 });
      queueReadyReset(summary.selectedIds, 1180);
    } catch (error) {
      setObjectsStatus(summary.selectedIds, "failed", {
        failureReason: error.message || "拼贴生成失败。",
      });
      setRenderActionState("failure", { resetAfter: 1280 });
    }
  }

  function deleteCurrentSelection() {
    const summary = selectionState.getSelectionSummary();
    if (!summary.count) {
      return;
    }

    workspaceStore.removeObjects(summary.selectedIds);
    selectionState.clearSelection();
    syncWorkspace();
  }

  async function exportCurrentSelection() {
    const selectedObjects = getSelectedObjects();
    const summary = selectionState.getSelectionSummary();
    if (!summary.count || !selectedObjects.length) {
      return;
    }

    setObjectsStatus(summary.selectedIds, "collected");
    syncWorkspace();

    const payload = buildExportPayload({
      objects: selectedObjects,
      posterStyleId: selectedExportStyleId,
      scale: selectedExportScale,
      backgroundMode: selectedExportBackgroundMode,
    });

    try {
      await wait(180);
      await downloadExportPayload(payload, selectedObjects);
      queueReadyReset(summary.selectedIds, 720);
    } catch (error) {
      setObjectsStatus(summary.selectedIds, "failed", {
        failureReason: error.message || "导出失败。",
      });
      syncWorkspace();
    }
  }

  async function exportCurrentPoster() {
    const objects = workspaceStore.getSnapshot();
    if (!objects.length || posterRenderActionState === "rendering") {
      return;
    }

    setPosterRenderActionState("rendering");
    try {
      const payload = buildPosterExportPayload({
        surfaceRect: surface.getBoundingClientRect(),
        objects: buildPosterExportObjects(surface, objects),
      });
      await wait(140);
      await downloadPosterExport(payload);
      setPosterRenderActionState("success", { resetAfter: 980 });
    } catch (error) {
      setPosterRenderActionState("failure", { resetAfter: 1320 });
    }
  }

  function beginWorkspaceDrag(objectId, point) {
    const object = workspaceStore.getObject(objectId);
    if (!object) {
      return;
    }

    dragState = {
      objectId,
      originX: point.x,
      originY: point.y,
      objectX: object.x,
      objectY: object.y,
    };
    selectionState.setDraggingObjectId(objectId);
  }

  function updateWorkspaceDrag(point) {
    if (!dragState) {
      return;
    }

    workspaceStore.updateObject(dragState.objectId, {
      x: dragState.objectX + (point.x - dragState.originX),
      y: dragState.objectY + (point.y - dragState.originY),
    });
    syncWorkspace();
  }

  function finishWorkspaceDrag() {
    dragState = null;
    selectionState.setDraggingObjectId(null);
    syncWorkspace();
  }

  function beginWorkspaceResize(objectId, handle, point) {
    const object = workspaceStore.getObject(objectId);
    if (!object) {
      return;
    }

    resizeState = {
      objectId,
      handle,
      originX: point.x,
      originY: point.y,
      startWidth: object.width,
      startHeight: object.height,
      aspectRatio: object.width / object.height,
    };
  }

  function updateWorkspaceResize(point) {
    if (!resizeState) {
      return;
    }

    const horizontalDirection =
      resizeState.handle === "ne" || resizeState.handle === "se" ? 1 : -1;
    const verticalDirection =
      resizeState.handle === "sw" || resizeState.handle === "se" ? 1 : -1;
    const deltaX = (point.x - resizeState.originX) * horizontalDirection;
    const deltaY = (point.y - resizeState.originY) * verticalDirection;
    const dominantDelta = Math.max(deltaX, deltaY);
    const nextWidth = Math.max(120, Math.round(resizeState.startWidth + dominantDelta));
    const nextHeight = Math.max(120, Math.round(nextWidth / resizeState.aspectRatio));

    workspaceStore.updateObject(resizeState.objectId, {
      width: nextWidth,
      height: nextHeight,
    });
    syncWorkspace();
  }

  function finishWorkspaceResize() {
    resizeState = null;
    syncWorkspace();
  }

  function beginMarqueeSelection(point) {
    selectionState.beginMarqueeSelection(point);
    selectionState.clearSelection();
    syncWorkspace();
  }

  function updateMarqueeSelection(point) {
    selectionState.updateMarqueeSelection(point);
    syncWorkspace();
  }

  function finishMarqueeSelection() {
    const marquee = selectionState.finishMarqueeSelection();
    if (!marquee) {
      syncWorkspace();
      return;
    }

    const selectedIds = workspaceStore
      .getSnapshot()
      .filter((object) => {
        const centerX = object.x + object.width / 2;
        const centerY = object.y + object.height / 2;
        return (
          centerX >= Math.min(marquee.startX, marquee.endX) &&
          centerX <= Math.max(marquee.startX, marquee.endX) &&
          centerY >= Math.min(marquee.startY, marquee.endY) &&
          centerY <= Math.max(marquee.startY, marquee.endY)
        );
      })
      .map((object) => object.id);

    selectionState.setSelectedIds(selectedIds);
    syncWorkspace();
  }

  function raiseWorkspaceObject(objectIds) {
    workspaceStore.raiseWorkspaceObject(objectIds);
    syncWorkspace();
  }

  function lowerWorkspaceObject(objectIds) {
    workspaceStore.lowerWorkspaceObject(objectIds);
    syncWorkspace();
  }

  importButton?.addEventListener("click", () => {
    importInput.click();
  });

  importInput.addEventListener("change", (event) => {
    insertFiles(pickFiles(event.target.files));
    importInput.value = "";
  });

  contextNode?.addEventListener("click", async (event) => {
    const templateButton = event.target.closest("[data-collage-template]");
    if (templateButton) {
      selectedTemplateId = templateButton.dataset.collageTemplate || selectedTemplateId;
      syncWorkspace();
      return;
    }

    const borderButton = event.target.closest("[data-collage-border-size]");
    if (borderButton) {
      selectedBorderSizeId = borderButton.dataset.collageBorderSize || selectedBorderSizeId;
      syncWorkspace();
      return;
    }

    const paperButton = event.target.closest("[data-collage-paper-style]");
    if (paperButton) {
      selectedPaperStyleId = paperButton.dataset.collagePaperStyle || selectedPaperStyleId;
      syncWorkspace();
      return;
    }

    const button = event.target.closest("[data-render-selection]");
    if (button) {
      await renderCurrentSelection();
      return;
    }

    const posterButton = event.target.closest("[data-render-poster]");
    if (posterButton) {
      await exportCurrentPoster();
      return;
    }

    const exportButton = event.target.closest("[data-open-export]");
    if (exportButton) {
      syncExportPanel();
    }
  });

  exportStyleListNode?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-export-style-id]");
    if (!button) {
      return;
    }

    selectedExportStyleId = button.dataset.exportStyleId || "none";
    const selectedObjects = getSelectedObjects();
    const summary = selectionState.getSelectionSummary();
    if (!summary.count || !selectedObjects.length) {
      return;
    }

    const payload = buildExportPayload({
      objects: selectedObjects,
      posterStyleId: selectedExportStyleId,
      scale: selectedExportScale,
      backgroundMode: selectedExportBackgroundMode,
    });
    openExportPanel({
      panelNode: exportPanelNode,
      countNode: exportCountNode,
      styleListNode: exportStyleListNode,
      scaleListNode: exportScaleListNode,
      backgroundListNode: exportBackgroundListNode,
      payloadNode: exportPayloadNode,
      summary,
      selectedObjects,
      posterStyleId: selectedExportStyleId,
      scale: selectedExportScale,
      backgroundMode: selectedExportBackgroundMode,
    });
    if (exportPayloadNode) {
      exportPayloadNode.textContent = JSON.stringify(payload, null, 2);
    }
  });

  exportScaleListNode?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-export-scale]");
    if (!button) {
      return;
    }

    selectedExportScale = button.dataset.exportScale || "2x";
    syncExportPanel();
  });

  exportBackgroundListNode?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-export-background-mode]");
    if (!button) {
      return;
    }

    selectedExportBackgroundMode = button.dataset.exportBackgroundMode || "transparent";
    syncExportPanel();
  });

  exportDownloadButton?.addEventListener("click", () => {
    exportCurrentSelection();
  });

  document.addEventListener("click", (event) => {
    const deleteSelectionButton = event.target.closest("[data-delete-selection-action]");
    if (!deleteSelectionButton) {
      return;
    }

    deleteCurrentSelection();
  });

  document.addEventListener("pointerdown", (event) => {
    if (shouldIgnoreGlobalSelectionResetEvent(event)) {
      return;
    }

    const summary = selectionState.getSelectionSummary();
    if (!summary.count) {
      return;
    }

    selectionState.clearSelection();
    syncWorkspace();
  });

  surface.addEventListener("dragenter", () => {
    surface.classList.add("canvas-surface--receiving");
  });

  surface.addEventListener("dragover", (event) => {
    event.preventDefault();
    surface.classList.add("canvas-surface--receiving");
  });

  surface.addEventListener("dragleave", (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    surface.classList.remove("canvas-surface--receiving");
  });

  surface.addEventListener("drop", (event) => {
    event.preventDefault();
    surface.classList.remove("canvas-surface--receiving");
    insertFiles(pickFiles(event.dataTransfer?.files));
  });

  surface.addEventListener("pointerdown", (event) => {
    const point = toSurfacePoint(surface, event.clientX, event.clientY);
    const resizeHandle = event.target.closest("[data-resize-handle]");
    const objectNode = event.target.closest("[data-workspace-object-id]");
    if (!objectNode) {
      beginMarqueeSelection(point);
      return;
    }

    selectionState.selectOnly(objectNode.dataset.workspaceObjectId);
    if (resizeHandle) {
      beginWorkspaceResize(
        objectNode.dataset.workspaceObjectId,
        resizeHandle.dataset.resizeHandle,
        point,
      );
      syncWorkspace();
      return;
    }
    beginWorkspaceDrag(objectNode.dataset.workspaceObjectId, point);
    raiseWorkspaceObject([objectNode.dataset.workspaceObjectId]);
    syncWorkspace();
  });

  surface.addEventListener("pointermove", (event) => {
    const point = toSurfacePoint(surface, event.clientX, event.clientY);
    if (resizeState) {
      updateWorkspaceResize(point);
      return;
    }

    if (dragState) {
      updateWorkspaceDrag(point);
      return;
    }

    if (selectionState.getSelectionSummary().marquee) {
      updateMarqueeSelection(point);
    }
  });

  surface.addEventListener("pointerup", () => {
    if (resizeState) {
      finishWorkspaceResize();
      return;
    }

    if (dragState) {
      finishWorkspaceDrag();
      return;
    }

    if (selectionState.getSelectionSummary().marquee) {
      finishMarqueeSelection();
    }
  });

  surface.addEventListener("dblclick", (event) => {
    const objectNode = event.target.closest("[data-workspace-object-id]");
    if (!objectNode) {
      return;
    }

    lowerWorkspaceObject([objectNode.dataset.workspaceObjectId]);
  });

  loadCollageStyleRegistry()
    .then((registry) => {
      collageStyleRegistry = registry;
      ensureCollageDefaults(registry);
      syncWorkspace();
    })
    .catch(() => {
      collageStyleRegistry = null;
    });

  syncWorkspace();
}
