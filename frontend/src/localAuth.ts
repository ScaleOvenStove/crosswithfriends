const idKey = 'dfac-id';

function genId(): string {
  return Math.floor(Math.random() * 1000000000).toString(16);
}

function genAnonId(): string {
  return `anon${genId()}`;
}

let cachedId: string | null = null;
function getLocalId(): string {
  if (cachedId) return cachedId;
  if (localStorage) {
    const stored = localStorage.getItem(idKey);
    if (stored) {
      cachedId = stored;
      return cachedId;
    }
    const id = genId();
    localStorage.setItem(idKey, id);
    cachedId = id;
    return id;
  }
  console.log('local storage not detected , unable to assign dfac-id');
  cachedId = genAnonId();
  return cachedId;
}

export default getLocalId;
