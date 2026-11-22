import {v4 as uuidv4} from 'uuid';
import {getStoredItem, setStoredItem} from './lib/safeStorage';

const idKey = 'dfac-id';

function genId() {
  return uuidv4();
}

function genAnonId() {
  return `anon${genId()}`;
}

let cachedId = null;
function getLocalId() {
  if (cachedId) return cachedId;
  const stored = getStoredItem(idKey);
  if (stored) {
    cachedId = stored;
    return cachedId;
  }
  const id = genId();
  if (setStoredItem(idKey, id)) {
    cachedId = id;
    return id;
  }
  // Storage is blocked: fall back to an id that lives for this page load.
  console.log('local storage not detected , unable to assign dfac-id');
  cachedId = genAnonId();
  return cachedId;
}

export default getLocalId;
