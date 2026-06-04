/**
 * useLocalDB.ts
 * Hook principale che sostituisce useFirebaseSync.
 * Gestisce init, load, save su IndexedDB — zero Firebase.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Comic, Character } from "../types";
import {
  getAllComicsHydrated,
  getAllCharactersHydrated,
  saveComic,
  saveCharacter,
  deleteComic,
  deleteCharacter,
  downloadBackup,
  uploadBackup,
  estimateStorageUsage,
  clearDatabase,
} from "../db/ComicsDB";
import { PRESET_CHARACTERS, getCharacterAvatarSvg } from "../components/PredefinedCharacters";

// ── Comic di default ──────────────────────────────────────────────────────────

const createDefaultComic = (): Comic => ({
  id: "comic-initial",
  title: "La Prima Scintilla",
  description: "Crea una leggenda unica per il tuo storyboard",
  style: "Watercolor",
  characters: ["char-leo-hero", "char-kronos-neutral"],
  panels: [
    {
      id: "p-1",
      sceneDescription:
        "Un tramonto spaziale su un canyon alieno, colori viola e arancione, stile acquerello",
      imageUrl: "https://picsum.photos/seed/comic1/1000/700",
      soundEffectPreset: "magic-chime",
      soundEffectText: "BZZ-GLOW!",
      narrationText:
        "I confini dello spazio celavano antichi segreti pronti a risvegliarsi...",
      dialogs: [
        {
          id: "d-1",
          characterId: "char-leo-hero",
          text: "Guarda quel tramonto! La mappa ci guida qui...",
          positionX: 30,
          positionY: 30,
        },
      ],
      charactersInPanel: [
        { characterId: "char-leo-hero", pose: "Happy", positionX: 35, scale: 1, animationType: "floating" },
        { characterId: "char-kronos-neutral", pose: "Neutral", positionX: 70, scale: 0.9, animationType: "pulse" },
      ],
    },
    {
      id: "p-2",
      sceneDescription: "Una porta di bronzo antico intagliata nella roccia brilla di luce cobalto.",
      imageUrl: "https://picsum.photos/seed/comic2/1000/700",
      soundEffectPreset: "laser",
      soundEffectText: "ZAAAAPP!",
      narrationText: "Un raggio improvviso rivelò la serratura cosmica millenaria.",
      dialogs: [
        {
          id: "d-2",
          characterId: "char-kronos-neutral",
          text: "Attenzione! Livelli energetici oltre la soglia!",
          positionX: 65,
          positionY: 25,
        },
      ],
      charactersInPanel: [
        { characterId: "char-leo-hero", pose: "Surprised", positionX: 25, scale: 1, animationType: "shaking" },
        { characterId: "char-kronos-neutral", pose: "Angry", positionX: 75, scale: 0.9, animationType: "none" },
      ],
    },
  ],
  createdAt: new Date().toLocaleDateString("it-IT"),
});

const DEFAULT_CHARACTERS = () => [
  { ...PRESET_CHARACTERS[0], avatarUrl: getCharacterAvatarSvg(PRESET_CHARACTERS[0]) },
  { ...PRESET_CHARACTERS[3], avatarUrl: getCharacterAvatarSvg(PRESET_CHARACTERS[3]) },
];

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseLocalDBReturn {
  comics: Comic[];
  characters: Character[];
  isLoading: boolean;
  storageInfo: string;

  // Comics
  upsertComic: (comic: Comic) => Promise<void>;
  removeComic: (id: string) => Promise<void>;

  // Characters
  upsertCharacter: (char: Character) => Promise<void>;
  removeCharacter: (id: string) => Promise<void>;

  // Backup
  handleDownloadBackup: () => Promise<void>;
  handleUploadBackup: (file: File) => Promise<void>;
  handleClearDatabase: () => Promise<void>;
  refreshStorageInfo: () => Promise<void>;

  // Setters locali (per aggiornamenti ottimistici immediati senza round-trip IDB)
  setComics: React.Dispatch<React.SetStateAction<Comic[]>>;
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
}

export function useLocalDB(options: {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}): UseLocalDBReturn {
  const { onError, onSuccess } = options;

  const [comics, setComics] = useState<Comic[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageInfo, setStorageInfo] = useState("");

  // ── Caricamento iniziale ──
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setIsLoading(true);

        const [storedComics, storedChars] = await Promise.all([
          getAllComicsHydrated(),
          getAllCharactersHydrated(),
        ]);

        if (cancelled) return;

        // Prima volta: popola con dati di default
        if (storedChars.length === 0) {
          const defaults = DEFAULT_CHARACTERS();
          await Promise.all(defaults.map((c) => saveCharacter(c)));
          setCharacters(defaults);
        } else {
          setCharacters(storedChars);
        }

        if (storedComics.length === 0) {
          const defaultComic = createDefaultComic();
          await saveComic(defaultComic);
          setComics([defaultComic]);
        } else {
          setComics(storedComics);
        }

        // Stima spazio
        const info = await estimateStorageUsage();
        if (!cancelled) setStorageInfo(info);
      } catch (e) {
        if (!cancelled) onError("Errore apertura database locale: " + (e instanceof Error ? e.message : String(e)));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, []);

  // ── Comics CRUD ──

  const upsertComic = useCallback(
    async (comic: Comic) => {
      // Aggiornamento ottimistico UI
      setComics((prev) => {
        const exists = prev.some((c) => c.id === comic.id);
        return exists ? prev.map((c) => (c.id === comic.id ? comic : c)) : [comic, ...prev];
      });
      try {
        await saveComic(comic);
      } catch (e) {
        onError("Errore salvataggio fumetto: " + (e instanceof Error ? e.message : ""));
        // Rollback non implementato per semplicità — il dato resta in memoria
      }
    },
    [onError]
  );

  const removeComic = useCallback(
    async (id: string) => {
      setComics((prev) => prev.filter((c) => c.id !== id));
      try {
        await deleteComic(id);
      } catch (e) {
        onError("Errore eliminazione fumetto: " + (e instanceof Error ? e.message : ""));
      }
    },
    [onError]
  );

  // ── Characters CRUD ──

  const upsertCharacter = useCallback(
    async (char: Character) => {
      setCharacters((prev) => {
        const exists = prev.some((c) => c.id === char.id);
        return exists ? prev.map((c) => (c.id === char.id ? char : c)) : [...prev, char];
      });
      try {
        await saveCharacter(char);
      } catch (e) {
        onError("Errore salvataggio personaggio: " + (e instanceof Error ? e.message : ""));
      }
    },
    [onError]
  );

  const removeCharacter = useCallback(
    async (id: string) => {
      setCharacters((prev) => prev.filter((c) => c.id !== id));
      try {
        await deleteCharacter(id);
      } catch (e) {
        onError("Errore eliminazione personaggio: " + (e instanceof Error ? e.message : ""));
      }
    },
    [onError]
  );

  // ── Backup ──

  const handleDownloadBackup = useCallback(async () => {
    try {
      await downloadBackup();
      onSuccess("Backup scaricato!");
    } catch (e) {
      onError("Errore export backup: " + (e instanceof Error ? e.message : ""));
    }
  }, [onError, onSuccess]);

  const handleUploadBackup = useCallback(
    async (file: File) => {
      try {
        await uploadBackup(file);
        // Ricarica tutto dopo l'import
        const [newComics, newChars] = await Promise.all([
          getAllComicsHydrated(),
          getAllCharactersHydrated(),
        ]);
        setComics(newComics);
        setCharacters(newChars);
        onSuccess(`Backup importato: ${newComics.length} fumetti, ${newChars.length} personaggi.`);
      } catch (e) {
        onError("Errore import backup: " + (e instanceof Error ? e.message : ""));
      }
    },
    [onError, onSuccess]
  );

  const handleClearDatabase = useCallback(async () => {
    if (!confirm("Eliminare TUTTI i dati? Questa operazione non può essere annullata.")) return;
    try {
      await clearDatabase();
      setComics([]);
      setCharacters([]);
      onSuccess("Database svuotato.");
    } catch (e) {
      onError("Errore pulizia database: " + (e instanceof Error ? e.message : ""));
    }
  }, [onError, onSuccess]);

  const refreshStorageInfo = useCallback(async () => {
    const info = await estimateStorageUsage();
    setStorageInfo(info);
  }, []);

  return {
    comics,
    characters,
    isLoading,
    storageInfo,
    upsertComic,
    removeComic,
    upsertCharacter,
    removeCharacter,
    handleDownloadBackup,
    handleUploadBackup,
    handleClearDatabase,
    refreshStorageInfo,
    setComics,
    setCharacters,
  };
}
