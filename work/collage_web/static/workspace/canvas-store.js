/**
 * @typedef {object} WorkspaceObject
 * @property {string} id
 * @property {string} type
 * @property {string} sourceKind
 * @property {string} assetRef
 * @property {string} originalAssetRef
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} rotation
 * @property {number} zIndex
 * @property {string} status
 * @property {string | null} groupId
 * @property {object | null} collageParams
 */

function cloneObject(record) {
  return { ...record };
}

function sortByZIndex(records) {
  return records.slice().sort((left, right) => left.zIndex - right.zIndex);
}

function findTopZIndex(records) {
  if (!records.length) {
    return 0;
  }

  return Math.max(...records.map((record) => record.zIndex));
}

export function createWorkspaceStore() {
  /** @type {WorkspaceObject[]} */
  let objects = [];

  return {
    getSnapshot() {
      return sortByZIndex(objects).map(cloneObject);
    },
    replaceObjects(nextObjects) {
      objects = sortByZIndex(nextObjects).map(cloneObject);
    },
    appendObjects(nextObjects) {
      objects = sortByZIndex(objects.concat(nextObjects)).map(cloneObject);
    },
    removeObjects(objectIds) {
      objects = objects.filter((object) => !objectIds.includes(object.id)).map(cloneObject);
    },
    updateObject(objectId, patch) {
      objects = objects.map((object) =>
        object.id === objectId ? { ...object, ...patch } : object,
      );
    },
    getObject(objectId) {
      const match = objects.find((object) => object.id === objectId);
      return match ? cloneObject(match) : null;
    },
    raiseWorkspaceObject(objectIds) {
      let topZIndex = findTopZIndex(objects);
      objectIds.forEach((objectId) => {
        topZIndex += 1;
        this.updateObject(objectId, { zIndex: topZIndex });
      });
    },
    lowerWorkspaceObject(objectIds) {
      objectIds.forEach((objectId) => {
        const object = this.getObject(objectId);
        if (!object) {
          return;
        }

        this.updateObject(objectId, { zIndex: Math.max(1, object.zIndex - 1) });
      });
    },
  };
}
