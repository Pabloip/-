let workspaceObjectSeed = 0;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function scatterWorkspaceObjects(files, surfaceRect, baseZIndex = 0) {
  const centerX = surfaceRect.width / 2;
  const centerY = surfaceRect.height / 2;
  const width = clamp(surfaceRect.width * 0.28, 240, 320);
  const height = clamp(surfaceRect.height * 0.34, 240, 340);
  const rotations = [-4, 3, -2, 5];

  return files.map((file, index) => {
    workspaceObjectSeed += 1;

    return {
      id: `workspace-object-${workspaceObjectSeed}`,
      type: "image",
      sourceKind: "original",
      assetRef: URL.createObjectURL(file),
      originalAssetRef: URL.createObjectURL(file),
      fileName: file.name,
      fileBlob: file,
      x: centerX + (index % 3) * 42 - 56,
      y: centerY + Math.floor(index / 3) * 36 - 48,
      width,
      height,
      rotation: rotations[index % rotations.length],
      zIndex: baseZIndex + index + 1,
      status: "landing",
      groupId: null,
      collageParams: null,
    };
  });
}
