export function computeSelectionBounds(objects) {
  if (!objects.length) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const left = Math.min(...objects.map((object) => object.x));
  const top = Math.min(...objects.map((object) => object.y));
  const right = Math.max(...objects.map((object) => object.x + object.width));
  const bottom = Math.max(...objects.map((object) => object.y + object.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}
