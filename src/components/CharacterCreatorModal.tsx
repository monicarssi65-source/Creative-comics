/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Character } from "../types";
import { getCharacterAvatarSvg } from "./PredefinedCharacters";
import { Sparkles, X, Palette, User, PenTool, ShieldAlert, Volume2, Play, Square, Upload, Trash2, Headphones } from "lucide-react";

interface CharacterCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (character: Character) => void;
  currentStyle: string;
  characterToEdit?: Character | null;
}

export default function CharacterCreatorModal({
  isOpen,
  onClose,
  onSave,
  currentStyle,
  characterToEdit,
 }: CharacterCreatorModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Character["role"]>("Hero");
  const [description, setDescription] = useState("");
  const [appearance, setAppearance] = useState("");
  const [accentColor, setAccentColor] = useState("#3b82f6");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/jpg")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && typeof event.target.result === "string") {
          setAvatarUrl(event.target.result);
          setGenerationError("");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Custom Voice states
  const [voiceAudioData, setVoiceAudioData] = useState<string | undefined>(undefined);
  const [voiceFileName, setVoiceFileName] = useState<string | undefined>(undefined);
  const [voicePitch, setVoicePitch] = useState<number>(1.0);
  const [voiceRate, setVoiceRate] = useState<number>(1.0);
  const [voiceSystemName, setVoiceSystemName] = useState<string>("");
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlayingTestVoice, setIsPlayingTestVoice] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        const itVoices = voices.filter(v => v.lang.startsWith("it"));
        setSystemVoices(itVoices.length > 0 ? itVoices : voices);
      };
      
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (characterToEdit) {
        setName(characterToEdit.name);
        setRole(characterToEdit.role);
        setDescription(characterToEdit.description);
        setAppearance(characterToEdit.appearance || "");
        setAccentColor(characterToEdit.accentColor);
        setAvatarUrl(characterToEdit.avatarUrl);
        setVoiceAudioData(characterToEdit.voiceAudioData);
        setVoiceFileName(characterToEdit.voiceFileName);
        setVoicePitch(characterToEdit.voicePitch ?? 1.0);
        setVoiceRate(characterToEdit.voiceRate ?? 1.0);
        setVoiceSystemName(characterToEdit.voiceSystemName || "");
      } else {
        setName("");
        setRole("Hero");
        setDescription("");
        setAppearance("");
        setAccentColor("#3b82f6");
        setAvatarUrl("");
        setVoiceAudioData(undefined);
        setVoiceFileName(undefined);
        setVoicePitch(1.0);
        setVoiceRate(1.0);
        setVoiceSystemName("");
      }
      setGenerationError("");
    }
  }, [characterToEdit, isOpen]);

  if (!isOpen) return null;

  const handleGenerateAvatar = async () => {
    if (!name || !appearance) {
      setGenerationError("Inserisci un nome e una descrizione dell'aspetto visivo prima di generare l'immagine con l'AI!");
      return;
    }

    setIsGenerating(true);
    setGenerationError("");

    try {
      const response = await fetch("/api/generate-character-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, appearance, style: currentStyle }),
      });

      const resJson = await response.json();
      if (resJson.success && resJson.imageUrl) {
        setAvatarUrl(resJson.imageUrl);
      } else {
        throw new Error(resJson.message || "Errore sconosciuto nella generazione. Verrà utilizzata l'illustrazione procedurale.");
      }
    } catch (err: any) {
      console.warn("Avatar AI Gen error:", err);
      setGenerationError(
        "Non è stato possibile caricare l'immagine AI (chiave Gemini non impostata o limite raggiunto). Verrà generata una bellissima illustrazione vettoriale!"
      );
      // Construct beautiful standard preset/procedural vector SVG
      const mockChar: Character = {
        id: "temp-" + Date.now().toString(),
        name,
        role,
        description,
        appearance,
        avatarUrl: "",
        accentColor,
      };
      setAvatarUrl(getCharacterAvatarSvg(mockChar));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2.5 * 1024 * 1024) {
        alert("Il file audio è troppo grande per la memoria persistente. Consigliato sotto i 2MB (.mp3 o .wav).");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setVoiceAudioData(reader.result);
          setVoiceFileName(file.name);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveVoice = () => {
    setVoiceAudioData(undefined);
    setVoiceFileName(undefined);
  };

  const handlePlayVoiceTest = () => {
    if (voiceAudioData) {
      setIsPlayingTestVoice(true);
      const audio = new Audio(voiceAudioData);
      audio.onended = () => setIsPlayingTestVoice(false);
      audio.onerror = () => setIsPlayingTestVoice(false);
      audio.play().catch(() => setIsPlayingTestVoice(false));
    } else {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`Sono ${name || "un eroe"}. Questa è una prova della mia voce!`);
        utterance.lang = "it-IT";
        utterance.pitch = voicePitch;
        utterance.rate = voiceRate;
        if (voiceSystemName) {
          const matching = systemVoices.find(v => v.name === voiceSystemName);
          if (matching) utterance.voice = matching;
        }
        utterance.onend = () => setIsPlayingTestVoice(false);
        utterance.onerror = () => setIsPlayingTestVoice(false);
        setIsPlayingTestVoice(true);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const charId = characterToEdit ? characterToEdit.id : "char-" + Date.now().toString();

    const finalAvatar = avatarUrl || getCharacterAvatarSvg({
      id: charId,
      name,
      role,
      description,
      appearance,
      avatarUrl: "",
      accentColor,
    });

    onSave({
      id: charId,
      name,
      role,
      description,
      appearance,
      avatarUrl: finalAvatar,
      accentColor,
      voiceAudioData,
      voiceFileName,
      voicePitch,
      voiceRate,
      voiceSystemName,
    });

    // Reset fields
    setName("");
    setRole("Hero");
    setDescription("");
    setAppearance("");
    setAccentColor("#3b82f6");
    setAvatarUrl("");
    setVoiceAudioData(undefined);
    setVoiceFileName(undefined);
    setVoicePitch(1.0);
    setVoiceRate(1.0);
    setVoiceSystemName("");
    setGenerationError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto w-full">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-lg text-slate-100">
                {characterToEdit ? `Modifica Personaggio: ${characterToEdit.name}` : "Disegna Nuovo Personaggio"}
              </h3>
              <p className="text-xs text-slate-400">
                {characterToEdit ? "Aggiorna dettagli, ruolo e ritratto del tuo alleato o avversario" : "Crea una leggenda unica per il tuo roster di fumetti"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left side inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Nome Personaggio
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Es. Sargon il Guerriero"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Ruolo Narrativo
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Hero", "Sidekick", "Villain", "Neutral"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition ${
                        role === r
                          ? "bg-amber-500/10 border-amber-500 text-amber-400"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {r === "Hero" && "Eroe"}
                      {r === "Sidekick" && "Spalla"}
                      {r === "Villain" && "Cattivo"}
                      {r === "Neutral" && "Neutro"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Bio / Storia Personale
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Es. Ultimo custode del tempio dei fulmini, cerca vendetta..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 transition resize-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Colore Identificativo (Accento)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-10 h-10 rounded border-0 bg-transparent block cursor-pointer"
                  />
                  <div className="text-xs text-slate-400 font-mono">{accentColor}</div>
                </div>
              </div>

              {/* Custom Character Voice Selector & Upload */}
              <div className="border-t border-slate-800/80 pt-4 mt-4 space-y-4">
                <div className="flex items-center gap-2 text-amber-500 font-sans font-bold text-xs uppercase tracking-wider">
                  <Headphones className="w-4 h-4 text-amber-400" />
                  Voce del Personaggio
                </div>
                
                <p className="text-[11px] text-slate-400 leading-normal font-sans">
                  Carica un file audio personalizzato o calibra i parametri della sintesi vocale text-to-speech per questo personaggio!
                </p>

                {/* Method 1: File upload */}
                <div className="space-y-2">
                  <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest">Opzione 1: Carica Campione Voce</span>
                  
                  {voiceAudioData ? (
                    <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <Volume2 className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                        <span className="text-[11px] text-slate-300 font-mono truncate">{voiceFileName || "voce_personaggio.mp3"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handlePlayVoiceTest}
                          className="p-1.5 text-slate-400 hover:text-amber-400 bg-slate-900 border border-slate-850 rounded-lg hover:border-amber-500 transition cursor-pointer"
                          title="Ascolta Voce Caricata"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveVoice}
                          className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-850 rounded-lg hover:border-rose-900 transition cursor-pointer"
                          title="Elimina Voce"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="block border border-dashed border-slate-800 hover:border-slate-755 bg-slate-950 rounded-xl p-3 text-center cursor-pointer transition">
                      <Upload className="w-4 h-4 mx-auto text-amber-500/80 mb-1" />
                      <span className="text-[10px] text-slate-400 font-sans block">Carica file audio (es. .mp3, .wav)</span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleVoiceUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Method 2: System Speech synthesis calibration */}
                <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-slate-850">
                  <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest">Opzione 2: Parametri Sintesi Vocale (TTS)</span>

                  {/* Italian Custom Profiles */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-mono text-slate-500 uppercase">
                      <label className="text-amber-400 font-bold">Profilo Vocale Italiano (Predefiniti)</label>
                      <span className="text-emerald-500 text-[8px] font-bold">Seleziona</span>
                    </div>
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "uomo") {
                          setVoicePitch(0.85);
                          setVoiceRate(1.0);
                        } else if (val === "uomo_anziano") {
                          setVoicePitch(0.65);
                          setVoiceRate(0.82);
                        } else if (val === "donna_anziana") {
                          setVoicePitch(0.95);
                          setVoiceRate(0.85);
                        } else if (val === "bambino") {
                          setVoicePitch(1.50);
                          setVoiceRate(1.15);
                        } else if (val === "ragazzo") {
                          setVoicePitch(1.20);
                          setVoiceRate(1.05);
                        }
                      }}
                      value={
                        voicePitch === 0.85 && voiceRate === 1.0 ? "uomo" :
                        voicePitch === 0.65 && voiceRate === 0.82 ? "uomo_anziano" :
                        voicePitch === 0.95 && voiceRate === 0.85 ? "donna_anziana" :
                        voicePitch === 1.50 && voiceRate === 1.15 ? "bambino" :
                        voicePitch === 1.20 && voiceRate === 1.05 ? "ragazzo" : ""
                      }
                      className="w-full bg-slate-950 border border-emerald-500/30 hover:border-emerald-500/50 rounded-lg py-1 px-2 text-[11px] text-slate-250 font-sans font-bold cursor-pointer transition-colors"
                    >
                      <option value="">-- Nessun Preset Selezionato --</option>
                      <option value="uomo">Voce Uomo (Maschile, tono corposo)</option>
                      <option value="uomo_anziano">Voce Uomo Anziano (Profondo, saggio, lento)</option>
                      <option value="donna_anziana">Voce Donna Anziana (Maturo, saggio e calmo)</option>
                      <option value="bambino">Voce Bambina/o (Energetico, acuto, vivace)</option>
                      <option value="ragazzo">Voce Ragazzo/a (Fresco, dinamico, giovane)</option>
                    </select>
                  </div>
                  
                  {/* Select system voice */}
                  {systemVoices.length > 0 && (
                    <div className="space-y-1">
                      <label className="block text-[9px] font-mono text-slate-500 uppercase">Voce di Sistema Preferita</label>
                      <select
                        value={voiceSystemName}
                        onChange={(e) => setVoiceSystemName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 text-[11px] text-slate-300 focus:outline-none focus:border-amber-500 font-mono cursor-pointer"
                      >
                        <option value="">-- Voce Italiana Automatica --</option>
                        {systemVoices.map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Pitch and Rate sliders in grid */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1 bg-slate-950 p-2 border border-slate-900 rounded-xl">
                      <div className="flex justify-between text-[9px] font-mono text-slate-500 uppercase">
                        <span>Tono (Pitch)</span>
                        <span>{voicePitch.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={voicePitch}
                        onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 progress-bar-range"
                      />
                    </div>

                    <div className="space-y-1 bg-slate-950 p-2 border border-slate-900 rounded-xl">
                      <div className="flex justify-between text-[9px] font-mono text-slate-500 uppercase">
                        <span>Velocità (Rate)</span>
                        <span>{voiceRate.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={voiceRate}
                        onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 progress-bar-range"
                      />
                    </div>
                  </div>
                </div>

                {/* Test buttons */}
                <button
                  type="button"
                  onClick={handlePlayVoiceTest}
                  disabled={isPlayingTestVoice}
                  className="w-full py-2 px-3 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 text-slate-300 rounded-lg flex items-center justify-center gap-1.5 transition text-[10px] uppercase font-bold cursor-pointer"
                >
                  <Play className={`w-3.5 h-3.5 ${isPlayingTestVoice ? "animate-ping text-amber-500" : ""}`} />
                  {isPlayingTestVoice ? "Riproduzione in corso..." : "Prova Voce Personaggio"}
                </button>
              </div>
            </div>

            {/* Right side styling & avatar */}
            <div className="flex flex-col items-center justify-between bg-slate-950/40 border border-slate-800/80 p-5 rounded-2xl h-full space-y-4">
              <div className="w-full">
                <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Aspetto Fisico (Prompt AI Grafico)
                </label>
                <textarea
                  value={appearance}
                  onChange={(e) => setAppearance(e.target.value)}
                  placeholder="Es. Alto con armatura d'oro scintillante, mantello cremisi fluttuante, occhi di fuoco..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:border-amber-500 transition resize-none text-sm"
                />
              </div>

              {/* Avatar Preview */}
              <div className="flex flex-col items-center justify-center">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("char-portrait-file-input")?.click()}
                  className={`w-28 h-28 rounded-2xl border-2 flex flex-col items-center justify-center overflow-hidden bg-slate-950 shadow-lg relative cursor-pointer group transition-all duration-200 ${
                    isDraggingFile ? "scale-105 border-emerald-500 bg-emerald-950/20" : ""
                  }`}
                  style={{ borderColor: isDraggingFile ? undefined : accentColor }}
                  title="Trascina foto/JPG/PNG qui o fai click per sfogliare"
                >
                  {avatarUrl ? (
                    <>
                      <img
                        src={avatarUrl || undefined}
                        alt="Avatar character"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:opacity-30 transition-opacity"
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 bg-slate-950/70 transition-opacity text-slate-200">
                        <Upload className="w-5 h-5 text-amber-400 mb-1" />
                        <span className="text-[10px] font-mono text-center font-bold">Cambia JPG/PNG</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500 p-4 text-center group-hover:text-slate-350">
                      <Upload className="w-7 h-7 mb-1 text-slate-400 group-hover:text-amber-400 transition-colors" />
                      <span className="text-[9px] font-mono leading-tight">Click/Trascina JPG o PNG</span>
                    </div>
                  )}
                </div>
                <input
                  id="char-portrait-file-input"
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        if (event.target?.result && typeof event.target.result === "string") {
                          setAvatarUrl(event.target.result);
                          setGenerationError("");
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <p className="text-[10px] text-slate-400 mt-2 text-center uppercase tracking-wider font-mono">
                  Standard JPG/PNG o drag & drop
                </p>
              </div>

              {/* Action Buttons to Generate / Upload */}
              <div className="w-full space-y-2">
                <button
                  type="button"
                  onClick={handleGenerateAvatar}
                  disabled={isGenerating || !name || !appearance}
                  className="w-full py-2 px-3 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 flex items-center justify-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed uppercase"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGenerating ? "Generazione AI..." : "Genera Ritratto AI"}
                </button>

                <button
                  type="button"
                  onClick={() => document.getElementById("char-portrait-file-input")?.click()}
                  className="w-full py-2 px-3 text-xs font-bold rounded-xl border border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/20 hover:border-emerald-500/60 flex items-center justify-center gap-1.5 transition uppercase"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Carica Foto (JPG o PNG)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const mockChar: Character = {
                      id: "temp-" + Date.now().toString(),
                      name: name || "Eroe",
                      role,
                      description,
                      appearance,
                      avatarUrl: "",
                      accentColor,
                    };
                    setAvatarUrl(getCharacterAvatarSvg(mockChar));
                    setGenerationError("");
                  }}
                  disabled={!name}
                  className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800 flex items-center justify-center gap-1.5 transition disabled:opacity-40"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  Usa Disegno Vettoriale
                </button>
              </div>
            </div>
          </div>

          {/* Feedback Area */}
          {generationError && (
            <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-xl flex gap-2 items-start text-xs text-blue-300">
              <ShieldAlert className="w-4 h-4 block shrink-0 mt-0.5 text-blue-400" />
              <span>{generationError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-950">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-slate-800 text-slate-400 transition"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed transition uppercase"
          >
            Salva Personaggio
          </button>
        </div>
      </div>
    </div>
  );
}
