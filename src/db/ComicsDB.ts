/**
 * ComicsDB.ts
 * Layer di persistenza IndexedDB per Creative Comics Lab.
 * Sostituisce completamente Firebase/Firestore.
 *
 * Schema:
 *   DB: "comics-lab-db" v1
 *   ├── object store "characters"  — Character[]  (keyPath: "id")
 *   ├── object store "comics"      — Comic[]       (keyPath: "id")
 *   └── object store "images"      — ImageBlob[]   (keyPath: "id")
 *       └── id = panelId o characterId, value = { id, dataUrl, updatedAt }
 *
 * Le immagini sono separate dai documenti per evitare oggetti enormi
 * nelle operazioni di lettura normale. Si caricano on-demand.
 */

import { Comic, Character } from "../types";

const DB_NAME = "comics-lab-db";
const DB_VERSION = 1;

// ── Tipi interni ──────────────────────────────────────────────────────────────

interface ImageRecord {
  id: string;       // panelId o characterId
  dataUrl: string;  // base64 data URL
  updatedAt: number;
}

// ── Singleton DB ──────────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("characters")) {
        db.createObjectStore("characters", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("comics")) {
        db.createObjectStore("comics", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "id" });
      }
    };

    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;

      // Gestisci chiusura forzata (es. cambio versione in un altro tab)
      _db.onversionchange = () => {
        _db?.close();
        _db = null;
      };

      resolve(_db);
    };

    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB bloccato da un altro tab. Ricarica la pagina."));
  });
}

// ── Utility transazione ───────────────────────────────────────────────────────

function tx(
  db: IDBDatabase,
  stores: string | string[],
  mode: IDBTransactionMode = "readonly"
): IDBTransaction {
  return db.transaction(stores, mode);
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function promisifyTransaction(t: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(new Error("Transazione IndexedDB annullata."));
  });
}

// ── Characters ────────────────────────────────────────────────────────────────

export async function getAllCharacters(): Promise<Character[]> {
  const db = await openDB();
  const store = tx(db, "characters").objectStore("characters");
  return promisifyRequest<Character[]>(store.getAll());
}

export async function saveCharacter(char: Character): Promise<void> {
  const db = await openDB();

  // Separa l'avatarUrl se è un data URL (base64) — va in "images"
  const isDataUrl = char.avatarUrl?.startsWith("data:");
  const charToSave: Character = {
    ...char,
    avatarUrl: isDataUrl ? `__idb__${char.id}` : char.avatarUrl,
  };

  const t = tx(db, ["characters", "images"], "readwrite");
  t.objectStore("characters").put(charToSave);

  if (isDataUrl) {
    const imgRecord: ImageRecord = {
      id: char.id,
      dataUrl: char.avatarUrl,
      updatedAt: Date.now(),
    };
    t.objectStore("images").put(imgRecord);
  }

  return promisifyTransaction(t);
}

export async function deleteCharacter(id: string): Promise<void> {
  const db = await openDB();
  const t = tx(db, ["characters", "images"], "readwrite");
  t.objectStore("characters").delete(id);
  t.objectStore("images").delete(id);
  return promisifyTransaction(t);
}

// ── Comics ────────────────────────────────────────────────────────────────────

export async function getAllComics(): Promise<Comic[]> {
  const db = await openDB();
  const store = tx(db, "comics").objectStore("comics");
  return promisifyRequest<Comic[]>(store.getAll());
}

export async function saveComic(comic: Comic): Promise<void> {
  const db = await openDB();

  // Separa le imageUrl base64 dei panel nel store "images"
  const panelImagePairs: ImageRecord[] = [];
  const comicToSave: Comic = {
    ...comic,
    panels: comic.panels.map((p) => {
      const isDataUrl = p.imageUrl?.startsWith("data:");
      const isAudioUrl = p.speechAudioUrl?.startsWith("data:");

      if (isDataUrl) {
        panelImagePairs.push({
          id: `panel-img-${p.id}`,
          dataUrl: p.imageUrl,
          updatedAt: Date.now(),
        });
      }
      if (isAudioUrl) {
        panelImagePairs.push({
          id: `panel-audio-${p.id}`,
          dataUrl: p.speechAudioUrl!,
          updatedAt: Date.now(),
        });
      }

      return {
        ...p,
        imageUrl: isDataUrl ? `__idb__panel-img-${p.id}` : (p.imageUrl || ""),
        speechAudioUrl: isAudioUrl ? `__idb__panel-audio-${p.id}` : (p.speechAudioUrl || ""),
      };
    }),
  };

  const stores: string[] = ["comics"];
  if (panelImagePairs.length > 0) stores.push("images");

  const t = tx(db, stores, "readwrite");
  t.objectStore("comics").put(comicToSave);

  for (const img of panelImagePairs) {
    t.objectStore("images").put(img);
  }

  return promisifyTransaction(t);
}

export async function deleteComic(id: string): Promise<void> {
  const db = await openDB();

  // Prima leggi i panel IDs per eliminare anche le immagini associate
  const comicStore = tx(db, "comics").objectStore("comics");
  const comic = await promisifyRequest<Comic | undefined>(comicStore.get(id));

  const imageIds: string[] = [];
  if (comic) {
    for (const p of comic.panels) {
      imageIds.push(`panel-img-${p.id}`, `panel-audio-${p.id}`);
    }
  }

  const stores = imageIds.length > 0 ? ["comics", "images"] : ["comics"];
  const t = tx(db, stores, "readwrite");
  t.objectStore("comics").delete(id);
  for (const imgId of imageIds) {
    t.objectStore("images").delete(imgId);
  }

  return promisifyTransaction(t);
}

// ── Hydration: risolve i riferimenti __idb__ con i dati reali ─────────────────

/**
 * Carica un'immagine dallo store "images" dato il suo ID.
 * Restituisce la dataUrl o stringa vuota se non trovata.
 */
export async function loadImage(imageId: string): Promise<string> {
  const db = await openDB();
  const store = tx(db, "images").objectStore("images");
  const record = await promisifyRequest<ImageRecord | undefined>(store.get(imageId));
  return record?.dataUrl || "";
}

/**
 * Idrata un Character: sostituisce il placeholder __idb__<id> con la dataUrl reale.
 */
export async function hydrateCharacter(char: Character): Promise<Character> {
  if (!char.avatarUrl?.startsWith("__idb__")) return char;
  const imageId = char.avatarUrl.replace("__idb__", "");
  const dataUrl = await loadImage(imageId);
  return { ...char, avatarUrl: dataUrl };
}

/**
 * Idrata tutti i panel di un Comic sostituendo i placeholder con i dati reali.
 */
export async function hydrateComic(comic: Comic): Promise<Comic> {
  const hydratedPanels = await Promise.all(
    comic.panels.map(async (p) => {
      let imageUrl = p.imageUrl;
      let speechAudioUrl = p.speechAudioUrl;

      if (imageUrl?.startsWith("__idb__")) {
        imageUrl = await loadImage(imageUrl.replace("__idb__", ""));
      }
      if (speechAudioUrl?.startsWith("__idb__")) {
        speechAudioUrl = await loadImage(speechAudioUrl.replace("__idb__", ""));
      }

      return { ...p, imageUrl: imageUrl || "", speechAudioUrl: speechAudioUrl || "" };
    })
  );
  return { ...comic, panels: hydratedPanels };
}

/**
 * Carica tutti i comics con i dati media già idratati.
 * Da usare all'avvio dell'app o dopo un aggiornamento.
 */
export async function getAllComicsHydrated(): Promise<Comic[]> {
  const comics = await getAllComics();
  return Promise.all(comics.map(hydrateComic));
}

/**
 * Carica tutti i characters con avatar già idratati.
 */
export async function getAllCharactersHydrated(): Promise<Character[]> {
  const chars = await getAllCharacters();
  return Promise.all(chars.map(hydrateCharacter));
}

// ── Export / Import (backup) ──────────────────────────────────────────────────

export interface DBExport {
  version: number;
  exportedAt: string;
  characters: Character[];
  comics: Comic[];
  images: ImageRecord[];
}

/**
 * Esporta tutto il database come JSON scaricabile.
 * Include le immagini base64 per un backup completo.
 */
export async function exportDatabase(): Promise<DBExport> {
  const db = await openDB();

  const [characters, comics, images] = await Promise.all([
    promisifyRequest<Character[]>(tx(db, "characters").objectStore("characters").getAll()),
    promisifyRequest<Comic[]>(tx(db, "comics").objectStore("comics").getAll()),
    promisifyRequest<ImageRecord[]>(tx(db, "images").objectStore("images").getAll()),
  ]);

  return {
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    characters,
    comics,
    images,
  };
}

/**
 * Importa un backup JSON nel database (merge — non sovrascrive tutto).
 */
export async function importDatabase(data: DBExport): Promise<void> {
  const db = await openDB();
  const t = tx(db, ["characters", "comics", "images"], "readwrite");

  for (const char of data.characters || []) {
    t.objectStore("characters").put(char);
  }
  for (const comic of data.comics || []) {
    t.objectStore("comics").put(comic);
  }
  for (const img of data.images || []) {
    t.objectStore("images").put(img);
  }

  return promisifyTransaction(t);
}

/**
 * Scarica il database come file .json
 */
export async function downloadBackup(): Promise<void> {
  const data = await exportDatabase();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comics-lab-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Carica un backup da file .json
 */
export async function uploadBackup(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as DBExport;
        await importDatabase(data);
        resolve();
      } catch (err) {
        reject(new Error("File di backup non valido."));
      }
    };
    reader.onerror = () => reject(new Error("Errore nella lettura del file."));
    reader.readAsText(file);
  });
}

/**
 * Cancella tutto il database (usato per reset completo)
 */
export async function clearDatabase(): Promise<void> {
  const db = await openDB();
  const t = tx(db, ["characters", "comics", "images"], "readwrite");
  t.objectStore("characters").clear();
  t.objectStore("comics").clear();
  t.objectStore("images").clear();
  return promisifyTransaction(t);
}

/**
 * Stima dello spazio usato dal database in MB
 */
export async function estimateStorageUsage(): Promise<string> {
  try {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      const { usage, quota } = await navigator.storage.estimate();
      const usedMB = ((usage || 0) / 1024 / 1024).toFixed(1);
      const quotaMB = ((quota || 0) / 1024 / 1024 / 1024).toFixed(1);
      return `${usedMB} MB usati / ${quotaMB} GB disponibili`;
    }
  } catch { /* ignore */ }
  return "Stima non disponibile";
}
