/**
 * App.tsx — Comic Lab AI v4.0 (Local-first, no Firebase)
 *
 * Cosa è cambiato rispetto alla versione originale:
 * - Rimosso Firebase, Firestore, Google Auth completamente
 * - Dati persistiti in IndexedDB tramite useLocalDB + ComicsDB
 * - Immagini base64 salvate in IndexedDB nello store "images"
 * - Backup/Restore manuale come file .json
 * - Indicatore spazio disco usato
 * - Sistema toast per feedback operazioni
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Sparkles, BookOpen, Plus, Film, Trash2, Edit3, Music, Volume2,
  Headphones, Check, Wand2, Download, Upload, Database, HardDrive,
} from "lucide-react";

import { useLocalDB } from "./hooks/useLocalDB";
import { ToastProvider, useToast } from "./hooks/useToast";

// ─── Inner App ────────────────────────────────────────────────────────────────

function AppInner() {
  const { toast } = useToast();

  // ── Database locale ──
  const {
    comics, setComics,
    characters, setCharacters,
    isLoading,
    storageInfo,
    upsertComic, removeComic,
    upsertCharacter, removeCharacter,
    handleDownloadBackup,
    handleUploadBackup,
    handleClearDatabase,
    refreshStorageInfo,
  } = useLocalDB({
    onError: (msg) => toast.error(msg),
    onSuccess: (msg) => toast.success(msg),
  });

  // ── UI State ──
  const [activeComicId, setActiveComicId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isTheatreMode, setIsTheatreMode] = useState(false);
  const [isCharModalOpen, setIsCharModalOpen] = useState(false);
  const [charToEdit, setCharToEdit] = useState<Character | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<"comics" | "characters" | "voices">("comics");
  const [isDbPanelOpen, setIsDbPanelOpen] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);

  // ── AI Story generation ──
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [storyPrompt, setStoryPrompt] = useState("");
  const [storyStyle, setStoryStyle] = useState<ComicStyleName>("Watercolor");
  const [panelsToGen, setPanelsToGen] = useState(4);
  const [selectedCharsForStory, setSelectedCharsForStory] = useState<string[]>([]);

  // ── API Status ──
  const [apiStatus, setApiStatus] = useState({ hasGeminiKey: false });

  // ── Music ──
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isMusicControlOpen, setIsMusicControlOpen] = useState(false);
  const [selectedMusicPreset, setSelectedMusicPreset] = useState<"ambient" | "cyberpunk" | "drone" | "custom">("ambient");
  const [musicVolume, setMusicVolume] = useState(50);
  const [customMusicUrl, setCustomMusicUrl] = useState("");

  // ── PWA ──
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPwaBanner, setShowPwaBanner] = useState<boolean>(() => {
    try { return !(window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone); }
    catch { return true; }
  });

  // ── Set first comic as active once loaded ──
  useEffect(() => {
    if (!isLoading && comics.length > 0 && !activeComicId) {
      setActiveComicId(comics[0].id);
    }
  }, [isLoading, comics, activeComicId]);

  // ── API check ──
  useEffect(() => {
    fetch("/api/status").then(r => r.json()).then(d => setApiStatus({ hasGeminiKey: d.hasGeminiKey })).catch(() => {});
  }, []);

  // ── PWA ──
  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); setShowPwaBanner(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setShowPwaBanner(false);
      setDeferredPrompt(null);
    } else {
      alert("iOS/Safari: Condividi → Aggiungi alla schermata Home\nAndroid/Chrome: ⋮ → Installa app");
    }
  };

  // ── Music ──
  const handleToggleMusic = () => { setIsMusicPlaying(audioEngine.toggleMusic()); setSelectedMusicPreset(audioEngine.getCurrentPreset()); };
  const handleSelectMusicPreset = (p: "ambient" | "cyberpunk" | "drone") => { audioEngine.startAmbientMusic(p); setIsMusicPlaying(true); setSelectedMusicPreset(p); };
  const handleUploadCustomMusic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) { audioEngine.playCustomMusic(f); setIsMusicPlaying(true); setSelectedMusicPreset("custom"); }
  };

  // ── Characters ──
  const handleAddPresetCharacter = useCallback(async (preset: Character) => {
    if (characters.some(c => c.id === preset.id)) return;
    const char = { ...preset, avatarUrl: getCharacterAvatarSvg(preset) };
    await upsertCharacter(char);
  }, [characters, upsertCharacter]);

  const handleSaveCharacter = useCallback(async (char: Character) => {
    await upsertCharacter(char);
    setCharToEdit(null);
    toast.success("Personaggio salvato.");
  }, [upsertCharacter]);

  const handleDeleteCharacter = useCallback(async (id: string, name: string) => {
    if (!confirm(`Rimuovere ${name}?`)) return;
    await removeCharacter(id);
    toast.success("Personaggio eliminato.");
  }, [removeCharacter]);

  // ── Comics ──
  const handleCreateManualComic = useCallback(async () => {
    const newComic: Comic = {
      id: "comic-" + Date.now(),
      title: "Nuova Avventura " + (comics.length + 1),
      description: "Edita e crea la tua storia illustrata.",
      style: "Manga",
      characters: characters.map(c => c.id),
      panels: [{
        id: "panel-" + Date.now(),
        sceneDescription: "La scena principale in stile Manga",
        imageUrl: "", soundEffectPreset: "none", soundEffectText: "CRASH!",
        narrationText: "Descrivi la tua prima vignetta.",
        dialogs: [], charactersInPanel: [],
      }],
      createdAt: new Date().toLocaleDateString("it-IT"),
    };
    await upsertComic(newComic);
    setActiveComicId(newComic.id);
    setIsEditMode(true);
  }, [comics.length, characters, upsertComic]);

  const handleUpdateComic = useCallback(async (updated: Comic) => {
    await upsertComic(updated);
  }, [upsertComic]);

  const handleDeleteComic = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Eliminare questo fumetto definitivamente?")) return;
    await removeComic(id);
    setActiveComicId(prev => prev === id ? (comics.find(c => c.id !== id)?.id || null) : prev);
    toast.success("Fumetto eliminato.");
  }, [removeComic, comics]);

  // ── AI Story Generation ──
  const handleGenerateAIComic = useCallback(async () => {
    if (!storyPrompt.trim()) return;
    setIsGeneratingStory(true);
    try {
      const selectedCharsPayload = characters.filter(c => selectedCharsForStory.includes(c.id));
      const res = await fetch("/api/generate-storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: storyPrompt, currentStyle: storyStyle, characters: selectedCharsPayload, panelsCount: panelsToGen }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const resJson = await res.json();

      if (resJson.success && resJson.data) {
        const story = resJson.data;
        const panels: Panel[] = story.panels.map((p: any, idx: number) => ({
          id: `p-gen-${idx}-${Date.now()}`,
          sceneDescription: p.sceneDescription,
          imageUrl: "",
          soundEffectPreset: p.soundEffectPreset || "none",
          soundEffectText: p.soundEffectText || "",
          narrationText: p.narrationText || "",
          dialogs: (p.dialogs || []).map((d: any, di: number) => ({
            id: `d-${idx}-${di}-${Date.now()}`,
            characterId: selectedCharsPayload.find(sc => sc.name.toLowerCase().includes((d.characterName || "").toLowerCase()))?.id || "narrator",
            text: d.text,
            positionX: d.positionX || (di === 0 ? 30 : 70),
            positionY: d.positionY || 25,
          })),
          charactersInPanel: selectedCharsPayload.slice(0, 2).map((c, ci) => ({
            characterId: c.id, pose: ci === 0 ? "Happy" : "Neutral" as any,
            positionX: ci === 0 ? 30 : 70, scale: 1, animationType: "floating" as any,
          })),
        }));

        const newComic: Comic = {
          id: "comic-" + Date.now(),
          title: story.title || storyPrompt.substring(0, 40),
          description: story.description || "Generato con AI.",
          style: storyStyle,
          characters: selectedCharsPayload.map(c => c.id),
          panels,
          createdAt: new Date().toLocaleDateString("it-IT"),
        };

        await upsertComic(newComic);
        setActiveComicId(newComic.id);
        setStoryPrompt("");
        setIsEditMode(true);
        toast.success(resJson.isDemo ? "Storia demo generata!" : `"${newComic.title}" creato!`);
      } else {
        throw new Error(resJson.message || "Impossibile generare lo storyboard");
      }
    } catch (e) {
      toast.error("Errore generazione: " + (e instanceof Error ? e.message : ""));
      await handleCreateManualComic();
    } finally {
      setIsGeneratingStory(false);
    }
  }, [storyPrompt, storyStyle, panelsToGen, characters, selectedCharsForStory, upsertComic, handleCreateManualComic]);

  const activeComic = comics.find(c => c.id === activeComicId);

  // ── Loading screen ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center flex-col gap-4">
        <span className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-mono">Caricamento database locale...</p>
      </div>
    );
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">

      {/* PWA Banner */}
      {showPwaBanner && (
        <div className="bg-slate-900 border-b border-amber-500/30 px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 z-50">
          <p className="text-sm text-slate-300">
            <span className="font-bold text-white">Installa Comic Lab</span>
            <span className="ml-2 text-xs text-slate-400">Avvia come app nativa con supporto offline completo</span>
          </p>
          <div className="flex gap-2">
            <button onClick={handleInstallPwa} className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black px-4 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 uppercase">
              <Sparkles className="w-3.5 h-3.5" />Installa
            </button>
            <button onClick={() => setShowPwaBanner(false)} className="px-3 py-1.5 hover:bg-slate-800 rounded-lg text-slate-400 text-xs cursor-pointer">✕</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-amber-500/30 flex-shrink-0 bg-slate-950">
            <img src={appLogo} alt="Comic Lab" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tight text-white">
              Comic Lab <span className="text-amber-500 text-xs font-mono px-2 py-0.5 bg-yellow-500/10 rounded-full border border-yellow-500/20 ml-1">AI v4.0</span>
            </h1>
            <p className="text-xs text-slate-400">Progetta fumetti animati — dati salvati localmente</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* API status */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-full px-3 py-1.5 gap-2">
            <span className={`w-2 h-2 rounded-full animate-pulse ${apiStatus.hasGeminiKey ? "bg-emerald-500" : "bg-cyan-500"}`} />
            <span className={`font-mono text-[11px] ${apiStatus.hasGeminiKey ? "text-emerald-400" : "text-cyan-400"}`}>
              {apiStatus.hasGeminiKey ? "AI Pronti" : "Demo Attiva"}
            </span>
          </div>

          {/* DB Panel */}
          <div className="relative">
            <button onClick={() => { setIsDbPanelOpen(!isDbPanelOpen); refreshStorageInfo(); }}
              className="p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200 transition cursor-pointer flex items-center gap-1.5"
              title="Database locale">
              <Database className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Dati</span>
            </button>

            {isDbPanelOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl z-50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="font-black text-xs uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4" />Database Locale (IndexedDB)
                  </h4>
                  <button onClick={() => setIsDbPanelOpen(false)} className="text-[10px] text-slate-400 border border-slate-800 px-2 py-0.5 rounded font-mono">✕</button>
                </div>

                {/* Storage info */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Spazio utilizzato</p>
                  <p className="text-xs text-slate-300 font-medium">{storageInfo || "Calcolo..."}</p>
                  <div className="mt-2 flex gap-3 text-[11px] text-slate-400">
                    <span>📚 {comics.length} fumetti</span>
                    <span>👤 {characters.length} personaggi</span>
                  </div>
                </div>

                {/* Backup */}
                <div className="space-y-2">
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Backup</p>
                  <button onClick={handleDownloadBackup}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer">
                    <Download className="w-4 h-4 text-amber-500" />Scarica backup (.json)
                  </button>
                  <button onClick={() => backupInputRef.current?.click()}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer">
                    <Upload className="w-4 h-4 text-emerald-500" />Importa backup
                  </button>
                  <input ref={backupInputRef} type="file" accept=".json" className="hidden"
                    onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleUploadBackup(f); e.target.value = ""; }} />
                </div>

                {/* Danger zone */}
                <div className="border-t border-slate-800 pt-3">
                  <button onClick={handleClearDatabase}
                    className="w-full py-2 bg-rose-950/50 hover:bg-rose-950 border border-rose-900/40 text-rose-400 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />Cancella tutti i dati
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Music */}
          <div className="relative">
            <button onClick={() => setIsMusicControlOpen(!isMusicControlOpen)}
              className={`p-2.5 rounded-xl border flex items-center gap-1.5 transition cursor-pointer active:scale-95 ${isMusicPlaying ? "bg-amber-500/10 border-amber-500 text-amber-400" : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400"}`}>
              <Music className={`w-4 h-4 ${isMusicPlaying ? "animate-bounce" : ""}`} />
              <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Musica</span>
            </button>

            {isMusicControlOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl z-50 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <h4 className="font-black text-xs uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                    <Headphones className="w-4 h-4" />Musica
                  </h4>
                  <button onClick={() => setIsMusicControlOpen(false)} className="text-[10px] text-slate-400 border border-slate-800 px-2 py-0.5 rounded font-mono">✕</button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(["ambient", "cyberpunk", "drone"] as const).map((p) => (
                    <button key={p} onClick={() => handleSelectMusicPreset(p)}
                      className={`text-[10px] font-bold p-1.5 rounded-lg border transition capitalize cursor-pointer ${isMusicPlaying && selectedMusicPreset === p ? "bg-amber-500 text-slate-950 border-amber-500" : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"}`}>
                      {p === "ambient" ? "Ambient" : p === "cyberpunk" ? "Retro" : "Space"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input type="text" placeholder="URL mp3..." value={customMusicUrl} onChange={e => setCustomMusicUrl(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-amber-500" />
                  <button onClick={() => { if (customMusicUrl.trim()) { audioEngine.playCustomMusic(customMusicUrl.trim()); setIsMusicPlaying(true); setSelectedMusicPreset("custom"); } }}
                    className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] rounded-lg uppercase cursor-pointer">▶</button>
                </div>
                <label className="block border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950 rounded-xl p-3 text-center cursor-pointer transition">
                  <span className="text-[10px] text-slate-400">Carica file audio (.mp3 / .wav)</span>
                  <input type="file" accept="audio/*" onChange={handleUploadCustomMusic} className="hidden" />
                </label>
                <div className="flex items-center gap-2 bg-slate-950 p-2 border border-slate-800 rounded-xl">
                  <button onClick={handleToggleMusic} className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase cursor-pointer ${isMusicPlaying ? "bg-rose-950 text-rose-400 border border-rose-900/40" : "bg-emerald-950 text-emerald-400 border border-emerald-900/40"}`}>
                    {isMusicPlaying ? "Stop" : "Play"}
                  </button>
                  <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                  <input type="range" min="0" max="100" value={musicVolume} onChange={e => { const v = parseInt(e.target.value); setMusicVolume(v); audioEngine.setMusicVolume(v / 100); }}
                    className="flex-1 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500" />
                  <span className="text-[9px] font-mono text-slate-500 w-8 text-right">{musicVolume}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-8">

        {isTheatreMode && activeComic ? (
          <PlayComicTheatre comic={activeComic} charactersList={characters} onClose={() => setIsTheatreMode(false)} />

        ) : isEditMode && activeComic ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={() => setIsEditMode(false)} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white font-bold transition cursor-pointer">
                ← Torna ai fumetti
              </button>
              <div className="flex gap-2">
                <button onClick={() => setIsTheatreMode(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 uppercase cursor-pointer">
                  <Film className="w-4 h-4" />Teatro
                </button>
                <button onClick={() => setIsExportModalOpen(true)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 uppercase cursor-pointer">
                  <Download className="w-4 h-4" />Esporta
                </button>
              </div>
            </div>
            <StoryboardCreator comic={activeComic} onUpdateComic={handleUpdateComic} charactersList={characters}
              onOpenCharacterModal={() => { setCharToEdit(null); setIsCharModalOpen(true); }} />
          </div>

        ) : (
          <div className="space-y-8">
            {/* Tabs */}
            <div className="flex border-b border-slate-800 pb-1.5 gap-6">
              {(["comics", "characters", "voices"] as const).map((tab) => (
                <button key={tab} onClick={() => setDashboardTab(tab)}
                  className={`pb-3 font-black text-xs tracking-wider transition relative cursor-pointer ${dashboardTab === tab ? "text-amber-500" : "text-slate-400 hover:text-slate-200"}`}>
                  {tab === "comics" ? "I MIEI FUMETTI" :
                    tab === "characters" ? <span>PERSONAGGI <span className="font-mono text-[9px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded-full ml-1">{characters.length}</span></span> :
                      <span>VOCI <span className="font-mono text-[9px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded-full ml-1">{characters.filter(c => c.voiceAudioData || c.voiceSystemName).length}</span></span>}
                  {dashboardTab === tab && <span className="absolute bottom-0 inset-x-0 h-0.5 bg-amber-500 rounded-full" />}
                </button>
              ))}
            </div>

            {/* Voices Tab */}
            {dashboardTab === "voices" ? (
              <CharacterVoiceLibrary charactersList={characters} onUpdateCharacter={handleSaveCharacter}
                onOpenCreateModal={() => { setCharToEdit(null); setIsCharModalOpen(true); }} />

            ) : dashboardTab === "characters" ? (
              // Characters Tab
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                  <div>
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-200">Galleria Personaggi</h3>
                    <p className="text-xs text-slate-400 mt-1">Personaggi salvati localmente nel browser.</p>
                  </div>
                  <button onClick={() => { setCharToEdit(null); setIsCharModalOpen(true); }}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl transition flex items-center gap-1.5 uppercase cursor-pointer active:scale-95">
                    <Plus className="w-4 h-4" />Crea Personaggio
                  </button>
                </div>

                {characters.length === 0 ? (
                  <div className="p-12 text-center bg-slate-950 border border-slate-800 rounded-2xl">
                    <p className="text-xs text-slate-500">Nessun personaggio. Inizia creandone uno o caricando un preset.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {characters.map((char) => (
                      <div key={char.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between h-[290px] hover:border-slate-700 transition shadow">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-xl border bg-slate-950 flex-shrink-0 overflow-hidden" style={{ borderColor: char.accentColor }}>
                              <img src={char.avatarUrl || undefined} alt={char.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-black text-slate-100 truncate">{char.name}</h4>
                              <span className="inline-block text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full border mt-1"
                                style={{ color: char.accentColor, borderColor: char.accentColor + "40", backgroundColor: char.accentColor + "10" }}>
                                {char.role === "Hero" ? "Eroe" : char.role === "Villain" ? "Cattivo" : char.role === "Sidekick" ? "Spalla" : "Neutro"}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 italic line-clamp-3">"{char.description || "Nessuna biografia."}"</p>
                        </div>
                        <div className="pt-3 border-t border-slate-800 flex justify-end gap-2 mt-3">
                          <button onClick={() => { setCharToEdit(char); setIsCharModalOpen(true); }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer">
                            <Edit3 className="w-3.5 h-3.5 text-amber-500" />Modifica
                          </button>
                          <button onClick={() => handleDeleteCharacter(char.id, char.name)}
                            className="p-1.5 bg-slate-950 hover:bg-rose-950 text-slate-500 hover:text-rose-400 rounded-lg border border-slate-800 hover:border-rose-900 transition cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Preset loader */}
                <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-3">
                  <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest">Campioni Archetipali</span>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_CHARACTERS.map((char) => {
                      const exists = characters.some(c => c.id === char.id);
                      return (
                        <button key={char.id} onClick={() => handleAddPresetCharacter(char)} disabled={exists}
                          className="text-[11px] font-mono border border-slate-800 bg-slate-950 px-3 py-1.5 rounded-lg text-slate-400 hover:border-slate-700 disabled:opacity-40 disabled:text-emerald-500 transition cursor-pointer flex items-center gap-1">
                          {exists && <Check className="w-3 h-3 text-emerald-500" />}{char.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

            ) : (
              // Comics Tab
              <div className="space-y-8">
                {/* AI Generator */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-6 rounded-2xl space-y-4">
                    <div className="flex items-center gap-2 text-amber-500">
                      <Wand2 className="w-5 h-5" />
                      <h3 className="font-extrabold text-sm tracking-widest uppercase">Generatore AI di Storie</h3>
                    </div>
                    <textarea value={storyPrompt} onChange={e => setStoryPrompt(e.target.value)}
                      placeholder="Es: 'Un gattino pirata sbarca su un'isola galleggiante...'"
                      rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm transition resize-none" />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">Stile</label>
                        <select value={storyStyle} onChange={(e: any) => setStoryStyle(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500">
                          {["Watercolor", "DigitalArt", "Manga", "Superhero", "Noir", "Cartoon"].map(s =>
                            <option key={s} value={s}>{s}</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">Pannelli</label>
                        <select value={panelsToGen} onChange={e => setPanelsToGen(parseInt(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none">
                          <option value={3}>3 Vignette</option>
                          <option value={4}>4 Vignette</option>
                          <option value={5}>5 Vignette</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button onClick={handleGenerateAIComic} disabled={isGeneratingStory || !storyPrompt.trim()}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition active:scale-[0.98] cursor-pointer shadow-lg flex items-center justify-center gap-1">
                          <Sparkles className="w-4 h-4" />
                          {isGeneratingStory ? "Generando..." : "Genera AI"}
                        </button>
                      </div>
                    </div>
                    {characters.length > 0 && (
                      <div>
                        <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">Personaggi nel copione:</span>
                        <div className="flex flex-wrap gap-2">
                          {characters.map(c => {
                            const active = selectedCharsForStory.includes(c.id);
                            return (
                              <button key={c.id} onClick={() => setSelectedCharsForStory(active ? selectedCharsForStory.filter(id => id !== c.id) : [...selectedCharsForStory, c.id])}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition cursor-pointer ${active ? "bg-amber-500/10 border-amber-500 text-amber-400" : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"}`}>
                                <img src={c.avatarUrl || undefined} alt="" className="w-4 h-4 rounded object-cover" />
                                {c.name.split(" ")[0]}
                                {active && <Check className="w-3 h-3 text-amber-500" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Characters sidebar */}
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">Scuderia</h4>
                        <span className="font-mono text-xs px-2 py-0.5 bg-slate-950 border border-slate-800 rounded">{characters.length}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto">
                        {characters.map(char => (
                          <div key={char.id} className="p-2 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-2">
                            <img src={char.avatarUrl || undefined} alt={char.name} className="w-9 h-9 rounded-lg object-cover border border-slate-800" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-200 truncate">{char.name}</p>
                              <p className="text-[9px] font-mono uppercase text-slate-500">{char.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => setIsCharModalOpen(true)} className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer">
                      <Plus className="w-4 h-4 text-amber-500" />CREA PERSONAGGIO
                    </button>
                  </div>
                </div>

                {/* Comics grid */}
                <div className="space-y-4">
                  <h3 className="font-black text-lg text-slate-200 tracking-tight flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-amber-500" />I Tuoi Fumetti
                  </h3>
                  {comics.length === 0 ? (
                    <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl">
                      <p className="text-sm text-slate-400 mb-4">Nessun fumetto ancora. Inserisci una trama sopra o crea manualmente.</p>
                      <button onClick={handleCreateManualComic} className="px-5 py-2.5 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-amber-400 transition cursor-pointer">
                        CREA MANUALE
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {comics.map((comic) => (
                        <div key={comic.id} onClick={() => setActiveComicId(comic.id)}
                          className={`group bg-slate-900 border overflow-hidden rounded-2xl cursor-pointer select-none transition flex flex-col h-80 ${comic.id === activeComicId ? "border-amber-500 ring-1 ring-amber-500/20" : "border-slate-800 hover:border-slate-700"}`}>
                          <div className="h-44 bg-slate-950 relative overflow-hidden flex-shrink-0">
                            {comic.panels[0]?.imageUrl ? (
                              <img src={comic.panels[0].imageUrl} alt="Cover" referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
                                <BookOpen className="w-10 h-10 text-slate-700" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent pointer-events-none" />
                            <span className="absolute top-3 left-3 bg-slate-950/90 border border-slate-800 text-[9px] font-mono px-2 py-1 text-slate-300 rounded-full uppercase">{comic.style}</span>
                            <span className="absolute bottom-3 right-3 bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded uppercase">{comic.panels.length} VIG.</span>
                          </div>
                          <div className="p-4 flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="font-extrabold text-sm text-slate-100 group-hover:text-amber-400 transition truncate mb-1">{comic.title}</h4>
                              <p className="text-xs text-slate-400 line-clamp-2">{comic.description}</p>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-slate-800 mt-3">
                              <span className="text-[10px] text-slate-500 font-mono">{comic.createdAt}</span>
                              <div className="flex gap-1.5">
                                <button onClick={e => { e.stopPropagation(); setActiveComicId(comic.id); setIsEditMode(true); }}
                                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer">
                                  <Edit3 className="w-3 h-3 text-amber-500" />Modifica
                                </button>
                                <button onClick={e => { e.stopPropagation(); setActiveComicId(comic.id); setIsTheatreMode(true); }}
                                  className="px-2 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-[10px] font-black flex items-center gap-0.5 transition cursor-pointer">
                                  <Film className="w-3 h-3" />
                                </button>
                                <button onClick={e => handleDeleteComic(comic.id, e)}
                                  className="p-1.5 bg-slate-950 hover:bg-rose-950 text-slate-500 hover:text-rose-400 rounded-lg border border-slate-800 hover:border-rose-900 transition cursor-pointer">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <CharacterCreatorModal isOpen={isCharModalOpen} onClose={() => { setIsCharModalOpen(false); setCharToEdit(null); }}
        onSave={handleSaveCharacter} currentStyle={activeComic?.style || "Watercolor"} characterToEdit={charToEdit} />
      <ExportComicModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)}
        comic={activeComic || comics[0]} charactersList={characters} />
    </div>
  );
}

export default function App() {
  return <ToastProvider><AppInner /></ToastProvider>;
}
