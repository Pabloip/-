export function buildApiUrl(pathname) {
  return new URL(pathname, window.location.origin).toString();
}

export async function fetchTemplatePayload() {
  const response = await fetch(buildApiUrl("/api/templates"));
  if (!response.ok) {
    throw new Error("无法加载拼贴样式注册表。");
  }

  return response.json();
}

function guessMimeType(fileName) {
  const lowerName = String(fileName || "").toLowerCase();
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lowerName.endsWith(".heic")) {
    return "image/heic";
  }
  if (lowerName.endsWith(".heif")) {
    return "image/heif";
  }
  return "image/png";
}

function dataUrlToBlob(dataUrl, fileName) {
  const [header, encoded] = dataUrl.split(",", 2);
  const mimeType = header.match(/data:(.*?);base64/)?.[1] || guessMimeType(fileName);
  const raw = atob(encoded);
  const bytes = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function updateSelectedObjects(workspaceStore, objectIds, patch) {
  objectIds.forEach((objectId) => {
    workspaceStore.updateObject(objectId, patch);
  });
}

function wait(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

export async function renderWorkspaceSelection({
  workspaceStore,
  objectIds,
  template,
  borderSize,
  paperStyle,
}) {
  updateSelectedObjects(workspaceStore, objectIds, { status: "printing" });
  await wait(180);

  const formData = new FormData();
  formData.set("template", template);
  if (borderSize) {
    formData.set("border_size", borderSize);
  }
  if (paperStyle) {
    formData.set("paper_style", paperStyle);
  }

  objectIds.forEach((objectId) => {
    const object = workspaceStore.getObject(objectId);
    if (!object?.fileBlob) {
      return;
    }

    formData.append(
      "files",
      object.fileBlob,
      object.fileName || `${objectId}.${guessMimeType(object.fileName).split("/")[1]}`,
    );
  });

  // fetch(buildApiUrl("/api/render")) uses POST form data for the current selection.
  const response = await fetch(buildApiUrl("/api/render"), {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    updateSelectedObjects(workspaceStore, objectIds, { status: "failed" });
    throw new Error("拼贴生成请求失败。");
  }

  const payload = await response.json();
  payload.results.forEach((result, index) => {
    const objectId = objectIds[index];
    const currentObject = workspaceStore.getObject(objectId);
    if (!currentObject) {
      return;
    }

    workspaceStore.updateObject(objectId, {
      sourceKind: "collage-result",
      assetRef: result.preview_url,
      originalAssetRef: currentObject.originalAssetRef,
      fileBlob: dataUrlToBlob(result.preview_url, result.download_name),
      fileName: result.download_name,
      collageParams: {
        template,
        borderSize: borderSize || "none",
        paperStyle: paperStyle || "none",
      },
      status: "revealing",
    });
  });

  payload.failures.forEach((failure, index) => {
    const objectId = objectIds[payload.results.length + index];
    if (!objectId) {
      return;
    }

    workspaceStore.updateObject(objectId, {
      status: "failed",
      failureReason: failure.reason,
    });
  });

  return payload;
}
