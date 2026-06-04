/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Comic, Character, ComicStyleName, Panel } from "./types";
import { PRESET_CHARACTERS, getCharacterAvatarSvg } from "./components/PredefinedCharacters";
import { audioEngine } from "./components/AudioEngine";
import CharacterCreatorModal from "./components/CharacterCreatorModal";
import StoryboardCreator from "./components/StoryboardCreator";
import PlayComicTheatre from "./components/PlayComicTheatre";
import ExportComicModal from "./components/ExportComicModal";
import CharacterVoiceLibrary from "./components/CharacterVoiceLibrary";
// @ts-ignore
import appLogo from "./assets/images/app_icon_comic_lab_1780193039364.png";
import { 
  Sparkles, BookOpen, User as UserIcon, Plus, Film, Trash2, Edit3, Music, Volume2, 
  VolumeX, Headphones, Check, HelpCircle, Key, ChevronRight, Wand2, Info, Download, Cloud, LogOut
} from "lucide-react";
import { apiFetch, CUSTOM_KEY_STORAGE_NAME } from "./lib/api";
import { auth, db, googleProvider, OperationType, handleFirestoreError } from "./firebase";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { collection, doc, getDocs, setDoc, deleteDoc, query, where, getDocFromServer } from "firebase/firestore";

// Helper database functions
const fetchCharactersFromFirestore = async (uid: string) => {
  const path = "characters";
  try {
    const q = query(collection(db, path), where("userId", "==", uid));
    const snapshot = await getDocs(q);
    const chars: Character[] = [];
    snapshot.forEach((doc) => {
      chars.push(doc.data() as Character);
    });
    return chars;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

const fetchComicsFromFirestore = async (uid: string) => {
  const path = "comics";
  try {
    const q = query(collection(db, path), where("userId", "==", uid));
    const snapshot = await getDocs(q);
    const result: Comic[] = [];
    snapshot.forEach((doc) => {
      result.push(doc.data() as Comic);
    });
    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

const saveCharacterToFirestore = async (char: Character, uid: string) => {
  const path = `characters`;
  try {
    const charWithUid = { ...char, userId: uid };
    await setDoc(doc(db, path, char.id), charWithUid);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${char.id}`);
  }
};

const deleteCharacterFromFirestore = async (charId: string) => {
  const path = `characters`;
  try {
    await deleteDoc(doc(db, path, charId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${path}/${charId}`);
  }
};

const saveComicToFirestore = async (comic: Comic, uid: string) => {
  const path = `comics`;
  try {
    const comicWithUid = { ...comic, userId: uid };
    await setDoc(doc(db, path, comic.id), comicWithUid);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${comic.id}`);
  }
};

const deleteComicFromFirestore = async (comicId: string) => {
  const path = `comics`;
  try {
    await deleteDoc(doc(db, path, comicId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${path}/${comicId}`);
  }
};

const syncLocalDataToFirestore = async (uid: string) => {
  const localCharsStr = localStorage.getItem("comic-studio-characters");
  const localComicsStr = localStorage.getItem("comic-studio-comics");

  let localChars: Character[] = [];
  let localComics: Comic[] = [];

  if (localCharsStr) {
    try {
      localChars = JSON.parse(localCharsStr);
    } catch {}
  }
  if (localComicsStr) {
    try {
      localComics = JSON.parse(localComicsStr);
    } catch {}
  }

  let changesCount = 0;

  if (localChars.length > 0) {
    for (const char of localChars) {
      await saveCharacterToFirestore(char, uid);
      changesCount++;
    }
  }

  if (localComics.length > 0) {
    for (const comic of localComics) {
      if (comic.id === "comic-initial" && localComics.length > 1) continue;
      await saveComicToFirestore(comic, uid);
      changesCount++;
    }
  }

  if (changesCount > 0) {
    localStorage.removeItem("comic-studio-characters");
    localStorage.removeItem("comic-studio-comics");
    return changesCount;
  }
  return 0;
};

export default function App() {
  // Application Modes and State
  const [comics, setComics] = useState<Comic[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeComicId, setActiveComicId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isTheatreMode, setIsTheatreMode] = useState(false);
  
  // Custom Firebase Authentication and Sync State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [syncCount, setSyncCount] = useState<number | null>(null);
  
  // Modals / Helpers
  const [isCharModalOpen, setIsCharModalOpen] = useState(false);
  const [charToEdit, setCharToEdit] = useState<Character | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<"comics" | "characters" | "voices">("comics");
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [storyPrompt, setStoryPrompt] = useState("");
  const [storyStyle, setStoryStyle] = useState<ComicStyleName>("Watercolor");
  const [panelsToGen, setPanelsToGen] = useState(4);
  const [selectedCharsForStory, setSelectedCharsForStory] = useState<string[]>([]);

  // Sound and API Key Status
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isMusicControlOpen, setIsMusicControlOpen] = useState(false);
  const [selectedMusicPreset, setSelectedMusicPreset] = useState<"ambient" | "cyberpunk" | "drone" | "custom">("ambient");
  const [musicVolume, setMusicVolume] = useState(50);
  const [customMusicUrl, setCustomMusicUrl] = useState("");
  const [apiStatus, setApiStatus] = useState({
    hasGeminiKey: false,
    message: "Verifica stato API in corso..."
  });
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");

  const fetchStatus = async () => {
    try {
      const response = await apiFetch("/api/status");
      const data = await response.json();
      setApiStatus({
        hasGeminiKey: data.hasGeminiKey,
        message: data.message
      });
    } catch (e) {
      console.warn("Unable to check live API status:", e);
    }
  };

  // Check status and prefill api key state on launch
  useEffect(() => {
    fetchStatus();
    const stored = localStorage.getItem(CUSTOM_KEY_STORAGE_NAME);
    if (stored) {
      setTempApiKey(stored);
    }
  }, []);

  // Progressive Web App (PWA) installation states and triggers
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPwaBanner, setShowPwaBanner] = useState<boolean>(() => {
    try {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
      return !isStandalone;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPwaBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPwaBanner(false);
      }
      setDeferredPrompt(null);
    } else {
      alert("Su iOS/iPhone/Safari:\n1. Premi il pulsante 'Condividi' (in basso o in alto, icona con freccia verso l'alto)\n2. Scorri l'elenco e tocca 'Aggiungi alla schermata Home'\n\nSu Android/Chrome:\nTocca i tre puntini in alto a destra e seleziona 'Aggiungi a schermata Home' o 'Installa app'.");
    }
  };

  // Firebase auth & Connection status flow
  useEffect(() => {
    // Validate Connection to Firestore (Skill Mandatory Check)
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, "test", "connection"));
      } catch (error) {
        if (error instanceof Error && error.message.includes("offline")) {
          console.error("Please check your Firebase configuration or network status.");
        }
      }
    };
    testConnection();

    // Default Starting Comic in case no databases present
    const defaultComic: Comic = {
      id: "comic-initial",
      title: "La Prima Scintilla",
      description: "Crea una leggenda unica per il tuo storyboard",
      style: "Watercolor",
      characters: ["char-leo-hero", "char-kronos-neutral"],
      panels: [
        {
          id: "p-1",
          sceneDescription: "Un suggestivo tramonto spaziale su un canyon roccioso alieno, colori viola caldo e arancione luminoso, stile acquerello poetico, pianeti visibili in cielo",
          imageUrl: "https://picsum.photos/seed/comic1/1000/700",
          soundEffectPreset: "magic-chime",
          soundEffectText: "BZZ-GLOW!",
          narrationText: "I confini dello spazio conosciuto celavano antichi segreti pronti a risvegliarsi...",
          dialogs: [
            { id: "d-1", characterId: "char-leo-hero", text: "Guarda quel tramonto! Sento che la mappa ci sta guidando qui...", positionX: 30, positionY: 30 }
          ],
          charactersInPanel: [
            { characterId: "char-leo-hero", pose: "Happy", positionX: 35, scale: 1, animationType: "floating" },
            { characterId: "char-kronos-neutral", pose: "Neutral", positionX: 70, scale: 0.9, animationType: "pulse" }
          ]
        },
        {
          id: "p-2",
          sceneDescription: "Una misteriosa porta di bronzo antico intagliata nella roccia brilla di una luce cobalto energetica.",
          imageUrl: "https://picsum.photos/seed/comic2/1000/700",
          soundEffectPreset: "laser",
          soundEffectText: "ZAAAAPP!",
          narrationText: "Un raggio improvviso rivelò la serratura cosmica della porta millenaria.",
          dialogs: [
            { id: "d-2", characterId: "char-kronos-neutral", text: "Attenzione Leonardo! Livelli energetici oltre la soglia di sicurezza!", positionX: 65, positionY: 25 }
          ],
          charactersInPanel: [
            { characterId: "char-leo-hero", pose: "Surprised", positionX: 25, scale: 1, animationType: "shaking" },
            { characterId: "char-kronos-neutral", pose: "Angry", positionX: 75, scale: 0.9, animationType: "none" }
          ]
        }
      ],
      createdAt: new Date().toLocaleDateString("it-IT")
    };

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(true);

      if (currentUser) {
        // Sync items created offline to Firestore securely
        try {
          const syncedItemsCount = await syncLocalDataToFirestore(currentUser.uid);
          if (syncedItemsCount > 0) {
            setSyncCount(syncedItemsCount);
            setTimeout(() => setSyncCount(null), 6000);
          }
        } catch (e) {
          console.warn("Unable to sync offline items to Firestore:", e);
        }

        // Retrieve cloud synced collections
        const cloudChars = await fetchCharactersFromFirestore(currentUser.uid);
        const cloudComics = await fetchComicsFromFirestore(currentUser.uid);

        let finalChars = cloudChars;
        if (cloudChars.length === 0) {
          const defaultChars = [
            { ...PRESET_CHARACTERS[0], avatarUrl: getCharacterAvatarSvg(PRESET_CHARACTERS[0]) },
            { ...PRESET_CHARACTERS[3], avatarUrl: getCharacterAvatarSvg(PRESET_CHARACTERS[3]) }
          ];
          for (const char of defaultChars) {
            await saveCharacterToFirestore(char, currentUser.uid);
          }
          finalChars = defaultChars;
        }

        let finalComics = cloudComics;
        if (cloudComics.length === 0) {
          await saveComicToFirestore(defaultComic, currentUser.uid);
          finalComics = [defaultComic];
        }

        setCharacters(finalChars);
        setComics(finalComics);
        setActiveComicId(finalComics[0]?.id || null);
      } else {
        // Load characters from local storage or set defaults for Guest
        const savedChars = localStorage.getItem("comic-studio-characters");
        let initialCharacters = [
          { ...PRESET_CHARACTERS[0], avatarUrl: getCharacterAvatarSvg(PRESET_CHARACTERS[0]) },
          { ...PRESET_CHARACTERS[3], avatarUrl: getCharacterAvatarSvg(PRESET_CHARACTERS[3]) }
        ];
        if (savedChars) {
          try {
            const parsed = JSON.parse(savedChars);
            if (Array.isArray(parsed) && parsed.length > 0) {
              initialCharacters = parsed;
            }
          } catch (e) {
            console.warn("Failed to load saved characters", e);
          }
        }
        setCharacters(initialCharacters);

        // Load comics from local storage or set defaults
        const savedComics = localStorage.getItem("comic-studio-comics");
        let initialComics = [defaultComic];
        if (savedComics) {
          try {
            const parsed = JSON.parse(savedComics);
            if (Array.isArray(parsed) && parsed.length > 0) {
              initialComics = parsed;
            }
          } catch (e) {
            console.warn("Failed to load saved comics", e);
          }
        }
        setComics(initialComics);
        setActiveComicId(initialComics[0]?.id || null);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Autosave when in guest mode
  useEffect(() => {
    if (!user && characters.length > 0) {
      localStorage.setItem("comic-studio-characters", JSON.stringify(characters));
    }
  }, [characters, user]);

  useEffect(() => {
    if (!user && comics.length > 0) {
      localStorage.setItem("comic-studio-comics", JSON.stringify(comics));
    }
  }, [comics, user]);

  // Auth Action Handlers
  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.warn("User canceled login or network failure:", e);
    }
  };

  const handleSignOut = async () => {
    if (confirm("Vuoi disconnetterti da Comic Lab Cloud? La tua sessione tornerà offline.")) {
      try {
        await signOut(auth);
      } catch (e) {
        console.error("Signout error:", e);
      }
    }
  };

  // Handle music play/pause toggle
  const handleToggleMusic = () => {
    const isPlaying = audioEngine.toggleMusic();
    setIsMusicPlaying(isPlaying);
    setSelectedMusicPreset(audioEngine.getCurrentPreset());
  };

  const handleSelectMusicPreset = (preset: "ambient" | "cyberpunk" | "drone") => {
    audioEngine.startAmbientMusic(preset);
    setIsMusicPlaying(true);
    setSelectedMusicPreset(preset);
  };

  const handleUploadCustomMusic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      audioEngine.playCustomMusic(file);
      setIsMusicPlaying(true);
      setSelectedMusicPreset("custom");
    }
  };

  const handlePlayCustomUrl = () => {
    if (customMusicUrl.trim()) {
      audioEngine.playCustomMusic(customMusicUrl.trim());
      setIsMusicPlaying(true);
      setSelectedMusicPreset("custom");
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setMusicVolume(val);
    audioEngine.setMusicVolume(val / 100);
  };

  // Add Preset character
  const handleAddPresetCharacter = async (preset: Character) => {
    // Avoid duplication
    if (characters.some((c) => c.id === preset.id)) return;

    // Inject accurate inline SVG avatar representing character
    const charWithAvatar = {
      ...preset,
      avatarUrl: getCharacterAvatarSvg(preset)
    };

    setCharacters([...characters, charWithAvatar]);
    if (user) {
      await saveCharacterToFirestore(charWithAvatar, user.uid);
    }
  };

  // Save custom character (supports both creation and update!)
  const handleSaveCustomCharacter = async (savedChar: Character) => {
    const exists = characters.some((c) => c.id === savedChar.id);
    let nextChars: Character[] = [];
    if (exists) {
      nextChars = characters.map((c) => (c.id === savedChar.id ? savedChar : c));
    } else {
      nextChars = [...characters, savedChar];
    }
    setCharacters(nextChars);
    setCharToEdit(null);
    if (user) {
      await saveCharacterToFirestore(savedChar, user.uid);
    }
  };

  // Delete comic project
  const handleDeleteComic = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Sei sicuro di voler eliminare definitivamente questa storia a fumetti? Questa operazione non può essere annullata.")) {
      return;
    }
    const remain = comics.filter((c) => c.id !== id);
    setComics(remain);
    if (activeComicId === id) {
      setActiveComicId(remain[0]?.id || null);
    }
    if (user) {
      await deleteComicFromFirestore(id);
    }
  };

  // Create manual raw comic project
  const handleCreateManualComic = async () => {
    const newComic: Comic = {
      id: "comic-" + Date.now().toString(),
      title: "Nuova Avventura " + (comics.length + 1),
      description: "Edita e crea la tua nuova storia illustrata a fumetti.",
      style: "Manga",
      characters: characters.map((c) => c.id),
      panels: [
        {
          id: "panel-" + Date.now().toString(),
          sceneDescription: "La scena principale d'ingresso in stile Manga",
          imageUrl: "",
          soundEffectPreset: "none",
          soundEffectText: "CRASH!",
          narrationText: "Inizia a scrivere la descrizione della tua prima favolosa vignetta di fumetto.",
          dialogs: [],
          charactersInPanel: []
        }
      ],
      createdAt: new Date().toLocaleDateString("it-IT")
    };

    setComics([newComic, ...comics]);
    setActiveComicId(newComic.id);
    setIsEditMode(true);
    if (user) {
      await saveComicToFirestore(newComic, user.uid);
    }
  };

  // AI Storyboard Generator
  const handleGenerateAIComic = async () => {
    if (!storyPrompt.trim()) return;

    setIsGeneratingStory(true);
    try {
      const selectedCharsPayload = characters.filter((c) => 
        selectedCharsForStory.includes(c.id)
      );

      const response = await apiFetch("/api/generate-storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: storyPrompt,
          currentStyle: storyStyle,
          characters: selectedCharsPayload,
          panelsCount: panelsToGen
        })
      });

      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        const generatedStory = resJson.data;

        // Transform panels from Gemini JSON output into local Comic instances
        const panelsTransformed: Panel[] = generatedStory.panels.map((p: any, idx: number) => {
          // Attempt placing 1 or 2 characters dynamically
          const charactersPlacement: any[] = [];
          
          if (selectedCharsPayload.length > 0) {
            // First character placement
            charactersPlacement.push({
              characterId: selectedCharsPayload[0].id,
              pose: idx % 2 === 0 ? "Happy" : "Neutral",
              positionX: 30,
              scale: 1,
              animationType: idx === 1 ? "bouncing" : "floating"
            });
            // Second character placement if exists and this panel should have two
            if (selectedCharsPayload.length > 1 && (idx === 1 || idx === 3)) {
              charactersPlacement.push({
                characterId: selectedCharsPayload[1].id,
                pose: idx === 1 ? "Surprised" : "Angry",
                positionX: 70,
                scale: 0.95,
                animationType: "shaking"
              });
            }
          }

          const dialogsFilled = p.dialogs?.map((d: any, dIdx: number) => ({
            id: `d-${idx}-${dIdx}-${Date.now()}`,
            // Bind speech bubble to character list ID or narrator
            characterId: selectedCharsPayload.find(sc => sc.name.toLowerCase().includes(d.characterName.toLowerCase()))?.id || "narrator",
            text: d.text,
            positionX: d.positionX || (dIdx === 0 ? 30 : 70),
            positionY: d.positionY || 25
          })) || [];

          return {
            id: `p-gen-${idx}-${Date.now()}`,
            sceneDescription: p.sceneDescription,
            imageUrl: "", // Generated dynamically in the storyboard workspace later!
            soundEffectPreset: p.soundEffectPreset || "none",
            soundEffectText: p.soundEffectText || "",
            narrationText: p.narrationText || "",
            dialogs: dialogsFilled,
            charactersInPanel: charactersPlacement
          };
        });

        const newComic: Comic = {
          id: "comic-" + Date.now().toString(),
          title: generatedStory.title || storyPrompt.substring(0, 20),
          description: generatedStory.description || "Generato con l'AI di Gemini.",
          style: storyStyle,
          characters: selectedCharsPayload.map((c) => c.id),
          panels: panelsTransformed,
          createdAt: new Date().toLocaleDateString("it-IT")
        };

        setComics([newComic, ...comics]);
        setActiveComicId(newComic.id);
        setStoryPrompt("");
        setIsEditMode(true);
        if (user) {
          await saveComicToFirestore(newComic, user.uid);
        }
      } else {
        throw new Error(resJson.message || "Impossibile generare lo storyboard");
      }
    } catch (e) {
      console.error(e);
      alert("Errore durante la creazione guidata della storia. Verrà creato uno storyboard manuale.");
      handleCreateManualComic();
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const activeComic = comics.find((c) => c.id === activeComicId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Dynamic PWA Install Banner (Option 2 - Installable Mobile App) */}
      {showPwaBanner && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-b border-amber-500/30 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in z-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500/20 to-yellow-600/20 text-amber-400 rounded-xl border border-amber-500/30 flex-shrink-0 animate-pulse">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white flex items-center gap-1.5 leading-tight">
                Installa Comic Lab sul tuo Smartphone
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 uppercase tracking-widest font-mono px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Novità PWA
                </span>
              </p>
              <p className="text-xs text-slate-400">
                Installa l'app direttamente sulla tua schermata Home per avviarla come un'app nativa (APK), con caricamento istantaneo e supporto offline!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallPwa}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black px-4 py-2 rounded-xl transition shadow-lg active:scale-95 cursor-pointer flex items-center gap-1.5 uppercase tracking-wide"
            >
              <Sparkles className="w-4 h-4 text-slate-900" />
              Installa Ora (APK Web)
            </button>
            <button
              onClick={() => setShowPwaBanner(false)}
              className="px-3.5 py-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition text-xs font-medium cursor-pointer"
            >
              Nascondi
            </button>
          </div>
        </div>
      )}

      {/* 1. Global Navigation Header */}
      <header className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg border-2 border-amber-500/30 flex-shrink-0 bg-slate-950 flex items-center justify-center">
            <img 
              src={appLogo} 
              alt="Comic Lab Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="font-sans font-black text-xl tracking-tight text-white mb-0.5">
              Comic Lab <span className="text-amber-500 text-xs uppercase font-mono px-2 py-0.5 bg-yellow-500/10 rounded-full border border-yellow-500/20 ml-1">AI v3.1</span>
            </h1>
            <p className="text-xs text-slate-400">Progetta fumetti animati completi con storie d'avanguardia</p>
          </div>
        </div>

        {/* Action Controls & API info indicators */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="flex items-center bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition rounded-full px-4 py-1.5 gap-2 text-xs cursor-pointer active:scale-95 text-slate-300 hover:text-white"
            title="Gestisci la chiave API Gemini"
          >
            {apiStatus.hasGeminiKey ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-emerald-400 text-[11px] font-bold">AI ATTIVA</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                <span className="font-mono text-cyan-400 text-[11px]">AI DEMO (click)</span>
              </>
            )}
            <Key className="w-3.5 h-3.5 text-slate-500 ml-1" />
          </button>

          <div className="relative">
            <button
              onClick={() => setIsMusicControlOpen(!isMusicControlOpen)}
              className={`p-2.5 rounded-xl border flex items-center justify-center transition cursor-pointer active:scale-95 ${
                isMusicPlaying 
                  ? "bg-amber-500/10 border-amber-500 text-amber-400 font-extrabold" 
                  : "bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400"
              }`}
              title="Gestisci e Inserisci Musica"
            >
              <Music className={`w-4 h-4 mr-1.5 ${isMusicPlaying ? 'animate-bounce text-amber-400' : ''}`} />
              <span className="text-xs font-bold uppercase tracking-wider">Musica</span>
            </button>
            
            {isMusicControlOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2.5xl z-50 text-slate-100 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="font-sans font-black text-xs uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                    <Headphones className="w-4 h-4" />
                    Inserimento Musica
                  </h4>
                  <button 
                    onClick={() => setIsMusicControlOpen(false)}
                    className="text-[10px] text-slate-400 hover:text-slate-200 uppercase font-mono border border-slate-800 bg-slate-950 px-2.5 py-0.5 rounded"
                  >
                    Chiudi
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  Scegli colonne sonore sintetizzate ad acquerello o inserisci un brano personalizzato tramite URL o file audio!
                </p>

                {/* Preset synthesis selections */}
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">A) Sintesi Procedurale</span>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => handleSelectMusicPreset("ambient")}
                      className={`text-[10px] font-bold p-1.5 rounded-lg border transition capitalize ${
                        isMusicPlaying && selectedMusicPreset === "ambient"
                          ? "bg-amber-500 text-slate-950 border-amber-500 font-extrabold shadow"
                          : "bg-slate-950 border-slate-850 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      Ambient
                    </button>
                    <button
                      onClick={() => handleSelectMusicPreset("cyberpunk")}
                      className={`text-[10px] font-bold p-1.5 rounded-lg border transition capitalize ${
                        isMusicPlaying && selectedMusicPreset === "cyberpunk"
                          ? "bg-amber-500 text-slate-950 border-amber-500 font-extrabold shadow"
                          : "bg-slate-950 border-slate-850 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      Retro Arp
                    </button>
                    <button
                      onClick={() => handleSelectMusicPreset("drone")}
                      className={`text-[10px] font-bold p-1.5 rounded-lg border transition capitalize ${
                        isMusicPlaying && selectedMusicPreset === "drone"
                          ? "bg-amber-500 text-slate-950 border-amber-500 font-extrabold shadow"
                          : "bg-slate-950 border-slate-850 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      Deep Space
                    </button>
                  </div>
                </div>

                {/* Custom URL insertion */}
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">B) Incolla link audio online (mp3)</span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="https://esempio.com/musica.mp3"
                      value={customMusicUrl}
                      onChange={(e) => setCustomMusicUrl(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    <button
                      onClick={handlePlayCustomUrl}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] rounded-lg transition uppercase"
                    >
                      Play
                    </button>
                  </div>
                </div>

                {/* File upload insertion */}
                <div className="space-y-1.5">
                  <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">C) Carica tuo file musicale locale</span>
                  <label className="block border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950 rounded-xl p-3.5 text-center cursor-pointer transition">
                    <Plus className="w-4 h-4 mx-auto text-amber-500 mb-1" />
                    <span className="text-[10px] text-slate-400 font-sans block">Scegli file da inserire (.mp3 / .wav)</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleUploadCustomMusic}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Status and Volume controls */}
                <div className="pt-3.5 border-t border-slate-800 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleToggleMusic}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition uppercase tracking-wider ${
                        isMusicPlaying
                          ? "bg-rose-950 hover:bg-rose-900 border border-rose-900/40 text-rose-400"
                          : "bg-emerald-950 hover:bg-emerald-900 border border-emerald-900/40 text-emerald-400"
                      }`}
                    >
                      {isMusicPlaying ? "Spegni Musica" : "Accendi Musica"}
                    </button>
                    {isMusicPlaying && (
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-950 border border-slate-850 text-[9px] uppercase font-mono text-amber-500 tracking-widest font-black">
                        {selectedMusicPreset}
                      </span>
                    )}
                  </div>

                  {/* Volume Slider */}
                  <div className="flex items-center gap-2 bg-slate-950 p-2 border border-slate-850 rounded-xl">
                    <Volume2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={musicVolume}
                      onChange={handleVolumeChange}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 progress-bar-range"
                    />
                    <span className="text-[9px] font-mono text-slate-500 shrink-0 w-8 text-right">{musicVolume}%</span>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Cloud Synchronization Status / Authentication Controls */}
          {isAuthLoading ? (
            <div className="w-8 h-8 rounded-xl bg-slate-955 border border-slate-800 flex items-center justify-center shrink-0">
              <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : user ? (
            <div className="flex items-center gap-2 bg-slate-950/40 border border-slate-800 p-1 pl-2.5 rounded-xl">
              <div className="flex flex-col items-end shrink-0 hidden sm:flex">
                <span className="text-[10px] font-bold text-slate-200 leading-tight">{user.displayName || "Creatore"}</span>
                <span className="text-[8px] font-mono text-emerald-400 leading-tight">Database Cloud Attivo</span>
              </div>
              {user.photoURL ? (
                <img referrerPolicy="no-referrer" src={user.photoURL} alt="Avatar" className="w-7 h-7 rounded-lg border border-slate-700 object-cover shrink-0" />
              ) : (
                <div className="w-7 h-7 bg-emerald-500/15 border border-emerald-500/30 rounded-lg flex items-center justify-center text-emerald-400 font-bold text-[10px] uppercase shrink-0">
                  {user.displayName?.charAt(0) || "U"}
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="p-1.5 bg-slate-900 hover:bg-rose-950 border border-slate-800 hover:border-rose-900 text-slate-400 hover:text-rose-400 rounded-lg transition shrink-0 cursor-pointer active:scale-95"
                title="Disconnetti Account"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition uppercase active:scale-95 cursor-pointer shadow-md shrink-0"
              title="Salva i tuoi fumetti sul database cloud"
            >
              <Cloud className="w-4 h-4" />
              Salva nel Cloud
            </button>
          )}
        </div>
      </header>

      {/* Cloud Sync Successful Integration Alert Notification */}
      {syncCount !== null && (
        <div className="mx-6 mt-6 p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h5 className="text-xs font-bold text-emerald-300">Sincronizzazione Cloud Eseguita!</h5>
              <p className="text-xs text-slate-300 font-sans mt-0.5 leading-relaxed">
                Siamo riusciti a caricare e associare <strong>{syncCount} elementi</strong> creati offline al tuo nuovo profilo database cloud protetto.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Secondary Context Header Bar for Workspace selection */}
      {activeComic && (
        <div className="px-6 py-3 bg-slate-950 border-b border-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-500">PROGETTO:</span>
            <span className="text-sm font-bold text-slate-200">{activeComic.title}</span>
            <span className="text-xs px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 rounded">
              {activeComic.style}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsEditMode(false);
                setIsTheatreMode(false);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                !isEditMode && !isTheatreMode
                  ? "bg-slate-800 text-slate-100"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              Panoramica
            </button>
            <button
              onClick={() => {
                setIsEditMode(true);
                setIsTheatreMode(false);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                isEditMode && !isTheatreMode
                  ? "bg-slate-800 text-slate-100"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              Edita Storyboard ({activeComic.panels.length})
            </button>
            
            <button
              onClick={() => setIsTheatreMode(true)}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition uppercase"
            >
              <Film className="w-3.5 h-3.5" />
              Recita Fumetto!
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-755 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-amber-500" />
              Esporta Progetto
            </button>
          </div>
        </div>
      )}

      {/* 3. Global Information Info card if Gemini Key is absent */}
      {!apiStatus.hasGeminiKey && (
        <div className="mx-6 mt-6 p-4 bg-cyan-950/20 border border-cyan-800/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-bold text-slate-200">Suggerimento per Creatori AI professionisti</h5>
              <p className="text-xs text-slate-400 font-sans mt-0.5 leading-relaxed">
                Hai sbloccato la <strong>Modalità Demo Intelligente</strong>! Per sperimentare illustrazioni personalizzate generate all'istante con <strong>Gemini 2.5 Image</strong> e sintesi vocale dinamica, configura il tuo segreto <code>GEMINI_API_KEY</code> nel pannello laterale <strong>Settings &gt; Secrets</strong>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500 shrink-0">
            <span>AMBIENTE CERTIFICATO CLOUD RUN</span>
          </div>
        </div>
      )}

      {/* 4. MAIN CENTRAL WORKSPACE CONTAINER */}
      <main className="flex-1 p-6 z-10">

        {isTheatreMode && activeComic ? (
          // Active Fullscreen Theatre Screen
          <PlayComicTheatre
            comic={activeComic}
            charactersList={characters}
            onExit={() => setIsTheatreMode(false)}
          />
        ) : isEditMode && activeComic ? (
          // Active Storyboard Canvas
          <StoryboardCreator
            comic={activeComic}
            charactersList={characters}
             onUpdateComic={async (updated) => {
               const nextComics = comics.map((c) => (c.id === updated.id ? updated : c));
               setComics(nextComics);
               if (user) {
                 await saveComicToFirestore(updated, user.uid);
               }
             }}
            onOpenCharacterModal={() => setIsCharModalOpen(true)}
          />
        ) : (
          // Standard Overview & Creation Dashboard
          <div className="space-y-8 font-sans">
            
            {/* Tab navigation buttons */}
            <div className="flex border-b border-slate-800 pb-1.5 gap-6">
              <button
                onClick={() => setDashboardTab("comics")}
                type="button"
                className={`pb-3 font-sans font-black text-xs tracking-wider transition relative cursor-pointer ${
                  dashboardTab === "comics" ? "text-amber-500" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                I MIEI FUMETTI & SCENEGGIATURE
                {dashboardTab === "comics" && (
                  <span className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => setDashboardTab("characters")}
                type="button"
                className={`pb-3 font-sans font-black text-xs tracking-wider transition relative flex items-center gap-1.5 cursor-pointer ${
                  dashboardTab === "characters" ? "text-amber-500" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                GALLERIA PERSONAGGI IN MEMORIA
                <span className="font-mono text-[9px] bg-slate-900 border border-slate-800 text-slate-300 px-1.5 py-0.5 rounded-full">
                  {characters.length}
                </span>
                {dashboardTab === "characters" && (
                  <span className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => setDashboardTab("voices")}
                type="button"
                className={`pb-3 font-sans font-black text-xs tracking-wider transition relative flex items-center gap-1.5 cursor-pointer ${
                  dashboardTab === "voices" ? "text-amber-500" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                LIBRERIA DELLE VOCI
                <span className="font-mono text-[9px] bg-slate-900 border border-slate-800 text-slate-300 px-1.5 py-0.5 rounded-full">
                  {characters.filter(c => c.voiceAudioData || c.voiceSystemName).length}
                </span>
                {dashboardTab === "voices" && (
                  <span className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full" />
                )}
              </button>
            </div>

            {dashboardTab === "voices" ? (
              <CharacterVoiceLibrary
                charactersList={characters}
                onUpdateCharacter={handleSaveCustomCharacter}
                onOpenCreateModal={() => {
                  setCharToEdit(null);
                  setIsCharModalOpen(true);
                }}
              />
            ) : dashboardTab === "characters" ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-850 p-6 rounded-2xl">
                  <div>
                    <h3 className="font-sans font-extrabold text-sm uppercase tracking-wider text-slate-200">Galleria Personaggi In Memoria</h3>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      Gestisci e sintonizza un roster illimitato di personaggi. Modifica dettagli, biografie storiche o rinfresca i ritratti AI con Gemini.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCharToEdit(null);
                      setIsCharModalOpen(true);
                    }}
                    type="button"
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black rounded-xl transition flex items-center gap-1.5 uppercase shadow-md active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-slate-950 font-bold" />
                    Crea Personaggio Custom
                  </button>
                </div>

                {characters.length === 0 ? (
                  <div className="p-12 text-center bg-slate-950 border border-slate-850 rounded-2xl">
                    <p className="text-xs text-slate-500">Nessun personaggio salvato nel database locale. Inizia creandone uno personalizzato o caricando un campione preset.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {characters.map((char) => {
                      return (
                        <div key={char.id} className="bg-slate-900 border border-slate-800/85 rounded-2xl p-4.5 flex flex-col justify-between h-[300px] transition hover:border-slate-700 select-none shadow">
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="w-14 h-14 rounded-xl border bg-slate-950 flex-shrink-0 overflow-hidden shadow" style={{ borderColor: char.accentColor }}>
                                <img src={char.avatarUrl || null} alt={char.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-black text-slate-100 truncate">{char.name}</h4>
                                <span 
                                  className="inline-block text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full border mt-1"
                                  style={{ color: char.accentColor, borderColor: char.accentColor + '40', backgroundColor: char.accentColor + '10' }}
                                >
                                  {char.role === "Hero" ? "Eroe" : char.role === "Villain" ? "Cattivo" : char.role === "Sidekick" ? "Spalla" : "Neutro"}
                                </span>
                              </div>
                            </div>
                            <div className="text-xs text-slate-400 leading-relaxed space-y-2">
                              {char.appearance && (
                                <p className="line-clamp-2">
                                  <strong>Aspetto AI:</strong> {char.appearance}
                                </p>
                              )}
                              <p className="font-sans italic text-slate-500 text-[11px] line-clamp-3">
                                "{char.description || "Nessuna biografia impostata per questo archetipo."}"
                              </p>
                            </div>
                          </div>

                          <div className="pt-3.5 border-t border-slate-800/80 flex justify-end gap-2 mt-4">
                            <button
                              onClick={() => {
                                setCharToEdit(char);
                                setIsCharModalOpen(true);
                              }}
                              type="button"
                              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                              Modifica
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Sei sicuro di voler rimuovere definitivamente ${char.name} dalla galleria in memoria?`)) {
                                  setCharacters(characters.filter((c) => c.id !== char.id));
                                  if (user) {
                                    await deleteCharacterFromFirestore(char.id);
                                  }
                                }
                              }}
                              type="button"
                              className="p-1.5 bg-slate-950 hover:bg-rose-950 text-slate-500 hover:text-rose-400 rounded-lg border border-slate-850 hover:border-rose-900 transition cursor-pointer"
                              title="Rimuovi Personaggio"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Preset Character Loader Section */}
                <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl space-y-3">
                  <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest">Inietta Campioni Archetipali nel Database</span>
                  <div className="flex flex-wrap gap-2.5">
                    {PRESET_CHARACTERS.map((char) => {
                      const exists = characters.some((c) => c.id === char.id);
                      return (
                        <button
                          key={char.id}
                          onClick={() => handleAddPresetCharacter(char)}
                          disabled={exists}
                          className="text-[11px] font-mono border border-slate-805 bg-slate-950 px-3.5 py-1.5 rounded-lg text-slate-350 hover:border-slate-700 disabled:opacity-35 disabled:border-emerald-900/20 disabled:text-emerald-500 transition cursor-pointer flex items-center gap-1"
                        >
                          {char.name} ({char.role})
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Story Prompt Generator Setup banner */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Creator Box: Let Gemini Write the script */}
              <div className="lg:col-span-2 bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/80 p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-amber-500">
                  <Wand2 className="w-5 h-5" />
                  <h3 className="font-sans font-extrabold text-sm tracking-widest uppercase">
                    Generatore Guidato di Storie e Copioni AI
                  </h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                      Spunto / Trama Principale del Fumetto
                    </label>
                    <textarea
                      value={storyPrompt}
                      onChange={(e) => setStoryPrompt(e.target.value)}
                      placeholder="Es: 'Un gattino pirata sbarca su un'isola galleggiante alla ricerca del pesce dorato leggendario...'"
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-250 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                        Stile Grafico
                      </label>
                      <select
                        value={storyStyle}
                        onChange={(e: any) => setStoryStyle(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                      >
                        <option value="Watercolor">Watercolor (Acquerello)</option>
                        <option value="DigitalArt">Digital Art (Arte Digitale)</option>
                        <option value="Manga">Manga Giapponese</option>
                        <option value="Superhero">Superhero (Marvel/DC)</option>
                        <option value="Noir">Noir Retrò Monocromatico</option>
                        <option value="Cartoon">Cartoon (Animazione)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                        Pannelli Richiesti
                      </label>
                      <select
                        value={panelsToGen}
                        onChange={(e) => setPanelsToGen(parseInt(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                      >
                        <option value={3}>3 Vignette (Striscia Breve)</option>
                        <option value={4}>4 Vignette (Standard)</option>
                        <option value={5}>5 Vignette (Dettagliato)</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={handleGenerateAIComic}
                        disabled={isGeneratingStory || !storyPrompt.trim()}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition active:scale-[0.98] cursor-pointer shadow-lg flex items-center justify-center gap-1"
                      >
                        <Sparkles className="w-4 h-4" />
                        {isGeneratingStory ? "Studio Sceneggiatura..." : "Genera Storia AI"}
                      </button>
                    </div>
                  </div>

                  {characters.length > 0 && (
                    <div className="pt-2">
                      <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                        Coinvolgi i tuoi Personaggi nel copione:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {characters.map((c) => {
                          const active = selectedCharsForStory.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              onClick={() => {
                                if (active) {
                                  setSelectedCharsForStory(selectedCharsForStory.filter((id) => id !== c.id));
                                } else {
                                  setSelectedCharsForStory([...selectedCharsForStory, c.id]);
                                }
                              }}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition ${
                                active 
                                  ? "bg-amber-500/10 border-amber-500 text-amber-400 text-slate-100" 
                                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                              }`}
                            >
                              <img src={c.avatarUrl || null} alt="" className="w-4 h-4 rounded object-cover" />
                              {c.name.split(" ")[0]}
                              {active && <Check className="w-3.5 h-3.5 text-amber-500" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Character Sidebox Roster controls */}
              <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-sans font-extrabold text-xs text-slate-400 tracking-wider uppercase">
                      Scuderia Personaggi
                    </h4>
                    <span className="font-mono text-xs px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-300">
                      {characters.length} Custodi
                    </span>
                  </div>

                  {/* Character visual bubbles list */}
                  {characters.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-500">
                      Nessun personaggio creato nel roster.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-1">
                      {characters.map((char) => (
                        <div 
                          key={char.id} 
                          className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-2 relative overflow-hidden group"
                        >
                          <img 
                            src={char.avatarUrl || null} 
                            alt={char.name} 
                            className="w-10 h-10 rounded-lg object-cover border border-slate-800"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-200 truncate">{char.name}</p>
                            <p className="text-[9px] font-mono uppercase text-slate-500 truncate">{char.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800/80 mt-4 space-y-2">
                  <button
                    onClick={() => setIsCharModalOpen(true)}
                    className="w-full py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-amber-500" />
                    CREA NUOVO PERSONAGGIO
                  </button>

                  {/* Add prebuilt template character templates to inject */}
                  <div className="pt-1.5">
                    <span className="block text-[8px] font-mono text-slate-500 uppercase text-center mb-1.5">Aggiungi Campioni Pre-Rollati</span>
                    <div className="flex justify-center gap-1.5">
                      {PRESET_CHARACTERS.map((char) => {
                        const exists = characters.some((c) => c.id === char.id);
                        return (
                          <button
                            key={char.id}
                            onClick={() => handleAddPresetCharacter(char)}
                            disabled={exists}
                            className="text-[10px] font-mono border border-slate-800/80 hover:border-slate-700 bg-slate-950 px-2 py-0.5 rounded text-slate-400 disabled:opacity-35 disabled:border-emerald-900/30 disabled:text-emerald-500 transition"
                            title={`Aggiungi ${char.name}`}
                          >
                            {char.name.split(" ")[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* List/Grid representation of Comic Books stories - "Fumetti Completi" */}
            <div className="space-y-4">
              <h3 className="font-sans font-black text-lg text-slate-200 tracking-tight flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" />
                <span>I Tuoi Fumetti Completi</span>
              </h3>

              {comics.length === 0 ? (
                <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl">
                  <p className="text-sm text-slate-450">Non hai ancora creato alcun fumetto. Inserisci una trama sopra o clicca su Crea Manualmente per cominciare.</p>
                  <button
                    onClick={handleCreateManualComic}
                    className="mt-4 px-5 py-2.5 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs tracking-wide hover:bg-amber-450 transition"
                  >
                    CREA MANUALE
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {comics.map((comic) => {
                    const isActive = comic.id === activeComicId;
                    const coverPanel = comic.panels[0];

                    return (
                      <div
                        key={comic.id}
                        onClick={() => setActiveComicId(comic.id)}
                        className={`group bg-slate-900 border overflow-hidden rounded-2xl cursor-pointer select-none transition flex flex-col justify-between h-80 ${
                          isActive
                            ? "border-amber-500 shadow-lg ring-1 ring-amber-500/20"
                            : "border-slate-800/80 hover:border-slate-700"
                        }`}
                      >
                        {/* Cover Picture */}
                        <div className="h-44 bg-slate-950 relative overflow-hidden flex-shrink-0">
                          {coverPanel?.imageUrl ? (
                            <img
                              src={coverPanel.imageUrl}
                              alt="Comic Cover"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-6 text-center">
                              <BookOpen className="w-10 h-10 text-slate-750 mb-1" />
                            </div>
                          )}

                          {/* Gradient and Badge overlays */}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent pointer-events-none" />
                          
                          <span className="absolute top-3 left-3 bg-slate-950/90 border border-slate-800 text-[9px] font-mono px-2.5 py-1 text-slate-300 rounded-full tracking-wider uppercase">
                            Stile: {comic.style}
                          </span>

                          <span className="absolute bottom-3 right-3 bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                            {comic.panels.length} VIGNETTE
                          </span>
                        </div>

                        {/* Title details metadata card */}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="font-sans font-extrabold text-sm text-slate-100 group-hover:text-amber-400 transition truncate mb-1">
                              {comic.title}
                            </h4>
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                              {comic.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-800/50 mt-3.5">
                            <span className="text-[10px] text-slate-500 font-mono">Creato: {comic.createdAt}</span>
                            
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveComicId(comic.id);
                                  setIsEditMode(true);
                                }}
                                className="p-1 px-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition"
                                title="Edita"
                              >
                                <Edit3 className="w-3 h-3 text-amber-500" />
                                Modifica
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveComicId(comic.id);
                                  setIsTheatreMode(true);
                                }}
                                className="p-1 px-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-[10px] font-black flex items-center gap-0.5 transition"
                                title="Play"
                              >
                                <Film className="w-3 h-3" />
                                Avvia
                              </button>

                              <button
                                onClick={(e) => handleDeleteComic(comic.id, e)}
                                className="p-1.5 bg-slate-950 hover:bg-rose-950 text-slate-500 hover:text-rose-400 rounded-lg border border-slate-850 hover:border-rose-900 transition"
                                title="Elimina Storia"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
        )}
      </main>

      {/* 5. Floating Character Modal workspace */}
      <CharacterCreatorModal
        isOpen={isCharModalOpen}
        onClose={() => {
          setIsCharModalOpen(false);
          setCharToEdit(null);
        }}
        onSave={handleSaveCustomCharacter}
        currentStyle={activeComic?.style || "Watercolor"}
        characterToEdit={charToEdit}
      />

      {/* 6. Dynamic PDF, Word, and JPG Storyboard Exporter */}
      <ExportComicModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        comic={activeComic || comics[0]}
        charactersList={characters}
      />

      {/* 7. Gemini API Key Configuration Fallback Modal */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in animate-duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-orange-600 to-yellow-500" />
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
                <Key className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Chiave Gemini API</h3>
                <p className="text-[11px] text-slate-450">Inserisci la tua chiave per sbloccare l'AI generativa.</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-350 leading-relaxed font-sans mb-4">
              L'app utilizza <strong>Gemini 3.5 Flash</strong> e <strong>Gemini 2.5 Image</strong> per creare capitoli di storie coerenti, disegnare illustrazioni ad alta definizione in tempo reale e sintetizzare file audio dei dialoghi.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest font-mono">
                  Chiave API (GEMINI_API_KEY)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-600 font-mono transition outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 font-mono leading-relaxed">
                  * Verrà salvata in modo sicuro nel localStorage locale del tuo browser per tutte le richieste future.
                </p>
              </div>

              {tempApiKey.trim() !== "" && (
                <div className="text-[10px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 p-2.5 rounded-xl font-mono leading-snug">
                  ✓ Nuova chiave inserita. Fai clic su 'Salva Chiave' per autenticare i sistemi.
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(CUSTOM_KEY_STORAGE_NAME, tempApiKey.trim());
                    fetchStatus();
                    setIsKeyModalOpen(false);
                  }}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black py-2.5 rounded-xl transition uppercase cursor-pointer"
                >
                  Salva Chiave
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(CUSTOM_KEY_STORAGE_NAME);
                    setTempApiKey("");
                    fetchStatus();
                    setIsKeyModalOpen(false);
                  }}
                  className="px-3.5 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-800 transition uppercase cursor-pointer"
                  title="Cancella la chiave salvata"
                >
                  Rimuovi
                </button>
                <button
                  type="button"
                  onClick={() => setIsKeyModalOpen(false)}
                  className="px-3.5 py-2.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition text-xs font-semibold uppercase cursor-pointer"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
