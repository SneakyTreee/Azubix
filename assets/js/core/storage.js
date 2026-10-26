// Speicher: IndexedDB (viel Platz, auch für mehrere Ausbildungsjahre und Logos)
// mit einem Zwischenspeicher im Arbeitsspeicher, damit Lesen synchron bleibt.
// Ist IndexedDB nicht verfügbar (z.B. privater Modus), wird localStorage genutzt.

const DB_NAME = "azubix";
const DB_STORE = "kv";
const storageCache = new Map();
let storageDb = null;

function openStorageDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readAllFromDb(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readonly");
    const store = transaction.objectStore(DB_STORE);
    const keys = store.getAllKeys();
    const values = store.getAll();
    transaction.oncomplete = () =>
      resolve(keys.result.map((key, index) => [key, values.result[index]]));
    transaction.onerror = () => reject(transaction.error);
  });
}

// Einmalig alles aus localStorage übernehmen (Daten aus älteren Versionen)
function migrateFromLocalStorage() {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (/^(bh-|azubix-)/.test(key)) {
        writeStorage(key, JSON.parse(localStorage.getItem(key)));
      }
    }
  } catch {
    // localStorage gesperrt: nichts zu übernehmen
  }
}

async function initStorage() {
  try {
    storageDb = await openStorageDb();
    const entries = await readAllFromDb(storageDb);
    entries.forEach(([key, value]) => storageCache.set(key, value));
    if (entries.length === 0) {
      migrateFromLocalStorage();
    }
  } catch {
    storageDb = null;
  }
}

function readStorage(key) {
  if (storageDb) {
    return storageCache.has(key) ? structuredClone(storageCache.get(key)) : null;
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  if (storageDb) {
    const snapshot = structuredClone(value);
    storageCache.set(key, snapshot);
    try {
      const transaction = storageDb.transaction(DB_STORE, "readwrite");
      transaction.objectStore(DB_STORE).put(snapshot, key);
      transaction.onerror = () => setSaveIndicator("Speichern fehlgeschlagen");
      return true;
    } catch {
      return false;
    }
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeStorage(key) {
  storageCache.delete(key);
  if (storageDb) {
    try {
      storageDb.transaction(DB_STORE, "readwrite").objectStore(DB_STORE).delete(key);
    } catch {
      // Löschen ist nicht kritisch
    }
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // Löschen ist nicht kritisch
  }
}
