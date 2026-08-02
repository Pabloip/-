export function createSelectionState() {
  /** @type {string[]} */
  let selectedIds = [];
  let marquee = null;
  let draggingObjectId = null;

  function uniqueIds(ids) {
    return Array.from(new Set(ids));
  }

  return {
    selectOnly(objectId) {
      selectedIds = objectId ? [objectId] : [];
    },
    setSelectedIds(objectIds) {
      selectedIds = uniqueIds(objectIds);
    },
    clearSelection() {
      selectedIds = [];
    },
    setDraggingObjectId(objectId) {
      draggingObjectId = objectId;
    },
    beginMarqueeSelection(point) {
      marquee = {
        startX: point.x,
        startY: point.y,
        endX: point.x,
        endY: point.y,
      };
    },
    updateMarqueeSelection(point) {
      if (!marquee) {
        return;
      }

      marquee = {
        ...marquee,
        endX: point.x,
        endY: point.y,
      };
    },
    finishMarqueeSelection() {
      const finishedMarquee = marquee;
      marquee = null;
      return finishedMarquee;
    },
    getSelectedIds() {
      return selectedIds.slice();
    },
    getSelectionSummary() {
      return {
        count: selectedIds.length,
        selectedIds: selectedIds.slice(),
        draggingObjectId,
        mode:
          selectedIds.length === 0
            ? "empty"
            : selectedIds.length === 1
              ? "single"
              : "multi",
        marquee,
      };
    },
  };
}
