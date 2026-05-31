/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Character } from "../types";
import { audioEngine } from "./AudioEngine";
import { 
  Headphones, Play, Square, Mic, Volume2, Trash2, Upload, 
  Sparkles, Save, Check, RefreshCw, AudioLines, AlertCircle, HelpCircle, AlertTriangle
} from "lucide-react";

interface CharacterVoiceLibraryProps {
  charactersList: Character[];
  onUpdateCharacter: (updated: Character) => Promise<void> | void;
  onOpenCreateModal: () => void;
}

export default function CharacterVoiceLibrary({
  charactersList,
  onUpdateCharacter,
  onOpenCreateModal,
}: CharacterVoiceLibraryProps) {
  const [selectedCharId, setSelectedCharId] = useState<string>("");
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [customTestPhrase, setCustomTestPhrase] = useState<string>("");
  
  // Voice attributes (mirrored from the selected character)
  const [voicePitch, setVoicePitch] = useState<number>(1.0);
  const [voiceRate, setVoiceRate] = useState<number>(1.0);
  const [voiceSystemName, setVoiceSystemName] = useState<string>("");
  const [voiceAudioData, setVoiceAudioData] = useState<string | undefined>(undefined);
  const [voiceFileName, setVoiceFileName] = useState<string | undefined>(undefined);
  
  // Saved alert bubble
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Equalizer animation
  const [equalizerBars, setEqualizerBars] = useState<number[]>([15, 15, 15, 15, 15, 15, 15, 15, 15, 15]);
  const animationFrameRef = useRef<any>(null);

  // Load standard native TTS voices upon mount
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        // Prefer Italian but display all as fallback
        const itVoices = voices.filter(v => v.lang.startsWith("it"));
        setSystemVoices(itVoices.length > 0 ? itVoices : voices);
      };
      
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // When selected character shifts, synchronize state
  const activeChar = charactersList.find(c => c.id === selectedCharId) || charactersList[0];

  useEffect(() => {
    if (activeChar) {
      setSelectedCharId(activeChar.id);
      setVoicePitch(activeChar.voicePitch ?? 1.0);
      setVoiceRate(activeChar.voiceRate ?? 1.0);
      setVoiceSystemName(activeChar.voiceSystemName || "");
      setVoiceAudioData(activeChar.voiceAudioData);
      setVoiceFileName(activeChar.voiceFileName);

      // Supply a characteristic default phrase depending on narrative role
      const defaultPhrases: Record<string, string> = {
        Hero: "Non tradirò la fiducia dei miei compagni! La mappa di luce ci salverà!",
        Villain: "Futili espedienti! L'universo intero si prostrerà davanti alla mia fortezza astrale!",
        Sidekick: "Ehi, aspetta un momento! Controlliamo prima gli schemi cibernetici prima di saltare là dentro!",
        Neutral: "Protocollo orario impostato al millisecondo esatto. Si raccomanda di non alterare l'asse temporale.",
        Narrator: "Sotto un firmamento scintillante di costellazioni perdute, destini incrociati stavano per scontrarsi...",
      };
      setCustomTestPhrase(defaultPhrases[activeChar.role] || "Questa è una prova generale del mio profilo vocale!");
    }
  }, [selectedCharId, charactersList]);

  // Audio Equalizer visual dancing generator logic
  useEffect(() => {
    if (isPlaying) {
      const updateBars = () => {
        setEqualizerBars(prev => prev.map(() => Math.floor(Math.random() * 65) + 12));
        animationFrameRef.current = setTimeout(updateBars, 85);
      };
      updateBars();
    } else {
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
      }
      setEqualizerBars([12, 12, 12, 12, 12, 12, 12, 12, 12, 12]);
    }
    return () => {
      if (animationFrameRef.current) clearTimeout(animationFrameRef.current);
    };
  }, [isPlaying]);

  if (charactersList.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center max-w-2xl mx-auto space-y-4">
        <Headphones className="w-16 h-16 text-amber-500 mx-auto animate-pulse" />
        <h3 className="font-sans font-black text-lg text-slate-100">La galleria è vuota</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Crea prima almeno un personaggio nella tabella "Galleria Personaggi" per sbloccare la calibrazione e sintonizzazione della tua libreria voci!
        </p>
        <button
          onClick={onOpenCreateModal}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition uppercase active:scale-95 cursor-pointer"
        >
          Crea Personaggio Custom
        </button>
      </div>
    );
  }

  // Handle local voice tests
  const handlePlayVoiceTest = () => {
    if (!activeChar) return;

    if (voiceAudioData) {
      setIsPlaying(true);
      const audio = new Audio(voiceAudioData);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      audio.play().catch(() => setIsPlaying(false));
    } else {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setIsPlaying(true);
        const utterance = new SpeechSynthesisUtterance(customTestPhrase || "Prova test.");
        utterance.lang = "it-IT";
        utterance.pitch = voicePitch;
        utterance.rate = voiceRate;
        if (voiceSystemName) {
          const matching = systemVoices.find(v => v.name === voiceSystemName);
          if (matching) utterance.voice = matching;
        }
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const handleStopVoiceTest = () => {
    if (voiceAudioData) {
      // Small trick: to halt normal standard instance requires cache, standard cancel works for Web Speech
      setIsPlaying(false);
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    }
  };

  // Upload customized file
  const handleVoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Il file audio supera il limite raccomandato di 2MB per la stabilità locale. Carica un file più compresso.");
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

  // Start micro recording
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            setVoiceAudioData(reader.result);
            setVoiceFileName(`Registrazione_Custom_${Date.now().toString().slice(-4)}.wav`);
          }
        };
        reader.readAsDataURL(audioBlob);
        
        // Stops capturing mic stream immediately to respect user trust
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      
      setRecordingSeconds(0);
      setIsRecording(true);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.warn("Media capture rejected or failed:", err);
      alert("Permesso del microfono rifiutato. Abilita l'accesso per registrare campioni reali di voce.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  // Remove completely
  const handleRemoveVoiceFile = () => {
    setVoiceAudioData(undefined);
    setVoiceFileName(undefined);
  };

  // Fast voice cloning parameters preset
  const handleApplySpeechPreset = (presetName: "hero" | "villain" | "sidekick" | "robot" | "whisper") => {
    if (presetName === "hero") {
      setVoicePitch(1.05);
      setVoiceRate(1.02);
      // Attempt to assign default
      setVoiceSystemName("");
      setVoiceAudioData(undefined);
    } else if (presetName === "villain") {
      setVoicePitch(0.72);
      setVoiceRate(0.88);
      // Try finding male Italian voice name
      const itMale = systemVoices.find(v => v.lang.startsWith("it") && (v.name.toLowerCase().includes("luca") || v.name.toLowerCase().includes("cosimo") || v.name.toLowerCase().includes("elena") === false));
      if (itMale) setVoiceSystemName(itMale.name);
      setVoiceAudioData(undefined);
    } else if (presetName === "sidekick") {
      setVoicePitch(1.35);
      setVoiceRate(1.15);
      const itFemale = systemVoices.find(v => v.lang.startsWith("it") && (v.name.toLowerCase().includes("alice") || v.name.toLowerCase().includes("elsa")));
      if (itFemale) setVoiceSystemName(itFemale.name);
      setVoiceAudioData(undefined);
    } else if (presetName === "robot") {
      setVoicePitch(1.85);
      setVoiceRate(0.82);
      setVoiceSystemName("");
      setVoiceAudioData(undefined);
    } else if (presetName === "whisper") {
      setVoicePitch(0.60);
      setVoiceRate(0.95);
      setVoiceSystemName("");
      setVoiceAudioData(undefined);
    }
    
    // Play instant confirmation signal
    setTimeout(() => {
      handlePlayVoiceTest();
    }, 100);
  };

  // Fire update event back to global app state and firestore
  const handleSaveVoiceToCharacter = async () => {
    if (!activeChar) return;
    
    const updatedChar: Character = {
      ...activeChar,
      voicePitch,
      voiceRate,
      voiceSystemName,
      voiceAudioData,
      voiceFileName,
    };

    await onUpdateCharacter(updatedChar);

    setSaveBanner(`Configurazione vocale salvata con successo per ${activeChar.name}!`);
    setTimeout(() => setSaveBanner(null), 4000);
  };

  const formattedTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Intro Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-850 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <Volume2 className="w-5 h-5 text-amber-400" />
            <h3 className="font-sans font-extrabold text-sm uppercase tracking-wider text-slate-100">
              Libreria Voci e Doppiaggio dei Personaggi
            </h3>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Sintonizza le onde sonore dei tuoi fumetti. Scegli voci native TTS per ciascuno dei tuoi eroi o cattivi, calibra i toni, oppure registra e carica file audio per un'interpretazione da oscar!
          </p>
        </div>
        <div className="text-xs bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-850 font-mono text-slate-400 flex items-center gap-2">
          <AudioLines className="w-4 h-4 text-emerald-400" />
          <span>{charactersList.filter(c => c.voiceAudioData || c.voiceSystemName).length} / {charactersList.length} Vocati</span>
        </div>
      </div>

      {/* Save Success Banner */}
      {saveBanner && (
        <div className="bg-emerald-950/20 border border-emerald-800/40 text-emerald-400 p-4 rounded-xl flex items-center gap-2 text-xs">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{saveBanner}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column: Characters Directory list select */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow">
          <div className="p-4 bg-slate-950 border-b border-slate-850">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-1">Rubrica Cast</span>
            <span className="text-xs font-bold text-slate-350">Seleziona un personaggio per l'intonazione</span>
          </div>

          <div className="p-3 divide-y divide-slate-850 max-h-[450px] overflow-y-auto pr-1">
            {charactersList.map((char) => {
              const speakConfigured = !!char.voiceAudioData || !!char.voiceSystemName;
              const isSelected = char.id === selectedCharId;

              return (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharId(char.id)}
                  type="button"
                  className={`w-full p-3 flex items-center justify-between text-left transition rounded-xl mt-1 first:mt-0 cursor-pointer ${
                    isSelected 
                      ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                      : "bg-transparent hover:bg-slate-950/40 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-10 h-10 rounded-lg border flex-shrink-0 overflow-hidden shadow-inner bg-slate-950"
                      style={{ borderColor: char.accentColor }}
                    >
                      <img src={char.avatarUrl || null} alt={char.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black truncate">{char.name}</h4>
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wide block">
                        {char.role === "Hero" ? "Eroe" : char.role === "Villain" ? "Cattivo" : char.role === "Sidekick" ? "Spalla" : "Neutro"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {speakConfigured ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Audio custom configurato" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-700" title="Voce predefinita di sistema" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column: Selected character voice parameters editing booth */}
        <div className="lg:col-span-8 space-y-6">
          {activeChar && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow">
              
              {/* Selected character overview header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-14 h-14 rounded-xl border bg-slate-950 flex-shrink-0 overflow-hidden shadow-md"
                    style={{ borderColor: activeChar.accentColor }}
                  >
                    <img src={activeChar.avatarUrl || null} alt={activeChar.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-sans font-black text-sm text-slate-100 flex items-center gap-2">
                      Studio di Doppiaggio: {activeChar.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {activeChar.role === "Hero" ? "Eroe Primario" : activeChar.role === "Villain" ? "Cattivo Principale" : activeChar.role === "Sidekick" ? "Spalla d'Azione" : "Personaggio Neutro"} • "{activeChar.description?.slice(0, 75)}..."
                    </p>
                  </div>
                </div>

                {/* Equalizer Wave design representation */}
                <div className="flex items-end gap-1 px-4 py-2 bg-slate-950 rounded-2xl border border-slate-850 select-none w-40 justify-center h-16 shrink-0 relative overflow-hidden">
                  {equalizerBars.map((val, idx) => (
                    <div 
                      key={idx}
                      className="w-1 rounded-sm bg-gradient-to-t from-amber-500 to-yellow-450 transition-all duration-75 block"
                      style={{ height: `${val}%` }}
                    />
                  ))}
                  <div className="absolute top-1 inset-x-0 text-center text-[7.5px] font-mono tracking-widest text-slate-500 select-none uppercase">
                    {isPlaying ? "ONDA VOCALE REALE" : "CONSOLLE SILENTE"}
                  </div>
                </div>
              </div>

              {/* SECTION A: FAST VOICES QUICK SELECT CLONING PRESET BLOCKET */}
              <div className="space-y-2">
                <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest">A) Applica Impronta Vocale Preimpostata</span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    onClick={() => handleApplySpeechPreset("hero")}
                    className="py-2 px-1 text-[10.5px] font-bold rounded-xl border border-slate-800 bg-slate-950/60 text-slate-350 hover:text-amber-400 hover:border-amber-500/40 transition flex flex-col items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-4.5 h-4.5 text-amber-500 shrink-0" />
                    <span>Eroe Temerario</span>
                  </button>
                  <button
                    onClick={() => handleApplySpeechPreset("villain")}
                    className="py-2 px-1 text-[10.5px] font-bold rounded-xl border border-slate-800 bg-slate-950/60 text-slate-350 hover:text-purple-400 hover:border-purple-500/40 transition flex flex-col items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-4.5 h-4.5 text-purple-500 shrink-0" />
                    <span>Cattivo Lord</span>
                  </button>
                  <button
                    onClick={() => handleApplySpeechPreset("sidekick")}
                    className="py-2 px-1 text-[10.5px] font-bold rounded-xl border border-slate-800 bg-slate-950/60 text-slate-350 hover:text-emerald-400 hover:border-emerald-500/40 transition flex flex-col items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                    <span>Spalla Vivace</span>
                  </button>
                  <button
                    onClick={() => handleApplySpeechPreset("robot")}
                    className="py-2 px-1 text-[10.5px] font-bold rounded-xl border border-slate-800 bg-slate-950/60 text-slate-350 hover:text-cyan-400 hover:border-cyan-500/40 transition flex flex-col items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-4.5 h-4.5 text-cyan-500 shrink-0" />
                    <span>Automa Robot</span>
                  </button>
                  <button
                    onClick={() => handleApplySpeechPreset("whisper")}
                    className="py-2 px-1 text-[10.5px] font-bold rounded-xl border border-slate-800 bg-slate-950/60 text-slate-350 hover:text-rose-450 hover:border-rose-500/40 transition flex flex-col items-center gap-1.5 col-span-2 sm:col-span-1 cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-4.5 h-4.5 text-rose-500 shrink-0" />
                    <span>Sussurro Oscuro</span>
                  </button>
                </div>
              </div>

              {/* RECORD AND FILE UPLOADS BLOCK */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Method 1: Upload Existing File */}
                <div className="space-y-3 p-4 bg-slate-950/60 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest">B) Carica Clip Audio</span>
                  
                  {voiceAudioData ? (
                    <div className="flex flex-col justify-between bg-slate-950 p-3 rounded-xl border border-slate-850 gap-2 h-24">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <Volume2 className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                        <span className="text-[11px] text-slate-300 font-mono truncate">{voiceFileName || "campione_voce.mp3"}</span>
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={handlePlayVoiceTest}
                          className="px-3 py-1 text-slate-400 hover:text-amber-500 bg-slate-900 border border-slate-850 rounded-lg hover:border-amber-500 transition cursor-pointer text-[10px] font-bold uppercase flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" /> Play
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveVoiceFile}
                          className="px-3 py-1 text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-850 rounded-lg hover:border-rose-900 transition cursor-pointer text-[10px] font-bold uppercase flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Rimuovi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="block border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950 rounded-2xl p-6 text-center cursor-pointer transition h-24 flex flex-col justify-center items-center">
                      <Upload className="w-5 h-5 text-amber-500/80 mb-1" />
                      <span className="text-[10px] text-slate-400 font-sans block font-semibold leading-tight">Trascina o scegli un file musicale vocale</span>
                      <span className="text-[8px] text-slate-500 font-mono mt-0.5 block">Format limitato a 2MB max</span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleVoiceUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Method 2: Micro Voice Registrar */}
                <div className="space-y-3 p-4 bg-slate-950/60 rounded-2xl border border-slate-850">
                  <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest">C) Registra la tua voce (Live Mic)</span>
                  
                  <div className="flex flex-col justify-center items-center bg-slate-950 rounded-2xl border border-slate-900 h-24 p-3 gap-2">
                    {isRecording ? (
                      <div className="flex items-center justify-between w-full px-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block" />
                          <span className="text-[11px] font-mono text-slate-200">Registrazione: {formattedTime(recordingSeconds)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleStopRecording}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-slate-100 font-bold text-[10px] rounded-lg transition uppercase flex items-center gap-1 tracking-wide shadow"
                        >
                          <Square className="w-3 h-3 text-slate-100" /> Stop
                        </button>
                      </div>
                    ) : (
                      <div className="text-center w-full">
                        <button
                          type="button"
                          onClick={handleStartRecording}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-650 hover:from-emerald-500 hover:to-teal-600 text-slate-950 font-black text-[11px] rounded-xl transition uppercase flex items-center gap-1.5 tracking-wide shadow-md mx-auto cursor-pointer"
                        >
                          <Mic className="w-4 h-4 text-slate-950 animate-pulse" />
                          Attiva Registratore
                        </button>
                        <span className="text-[8.5px] text-slate-500 font-mono block mt-1.5">Acquisisci un campione teatrale dal vivo per questo personaggio</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* NATIVE SPEECH SYNTHESIS CALIBRATOR BLOCK */}
              <div className="space-y-4 bg-slate-950 p-4 rounded-2xl border border-slate-850">
                <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                  <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest">D) Parametri Doppiaggio di Sintesi (Web Speech TTS)</span>
                  {voiceAudioData && (
                    <span className="text-[8.5px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-mono uppercase font-semibold">
                      Parzialmente bypassato da clip audio custom
                    </span>
                  )}
                </div>

                {/* Custom Italian speech support profiles */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9.5px] font-mono text-slate-500 uppercase">
                    <label className="text-amber-400 font-extrabold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      Supporto Lingua Italiana (Predefiniti)
                    </label>
                    <span className="text-emerald-500 font-semibold text-[8px] uppercase">Ottimizzato per TTS</span>
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
                      
                      // Auto preview play
                      setTimeout(() => {
                        handlePlayVoiceTest();
                      }, 100);
                    }}
                    value={
                      voicePitch === 0.85 && voiceRate === 1.0 ? "uomo" :
                      voicePitch === 0.65 && voiceRate === 0.82 ? "uomo_anziano" :
                      voicePitch === 0.95 && voiceRate === 0.85 ? "donna_anziana" :
                      voicePitch === 1.50 && voiceRate === 1.15 ? "bambino" :
                      voicePitch === 1.20 && voiceRate === 1.05 ? "ragazzo" : ""
                    }
                    className="w-full bg-slate-950 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-sans font-bold cursor-pointer transition-colors"
                  >
                    <option value="">-- Seleziona un Profilo Vocale Italiano --</option>
                    <option value="uomo">Voce Uomo (Maschile, tono corposo)</option>
                    <option value="uomo_anziano">Voce Uomo Anziano (Profondo, saggio, lento)</option>
                    <option value="donna_anziana">Voce Donna Anziana (Maturo, saggio e calmo)</option>
                    <option value="bambino">Voce Bambina/o (Energetico, acuto, vivace)</option>
                    <option value="ragazzo">Voce Ragazzo/a (Fresco, dinamico, giovane)</option>
                  </select>
                </div>

                {/* Dropdown speech selection web native */}
                {systemVoices.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9.5px] font-mono text-slate-500 uppercase">
                      <label>Seleziona Voce Fisica del Dispositivo</label>
                      <span className="text-slate-550 text-[8.5px]">Seleziona una voce installata</span>
                    </div>
                    <select
                      value={voiceSystemName}
                      onChange={(e) => setVoiceSystemName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none focus:border-amber-500 font-mono cursor-pointer"
                    >
                      <option value="">-- Voce Italiana Standard Automatica --</option>
                      {systemVoices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Grid Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-950/80 p-3 border border-slate-900 rounded-xl space-y-2">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400 uppercase font-semibold">
                      <span>Altezza Tono (Pitch)</span>
                      <span className="text-amber-400">{voicePitch.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.05"
                      value={voicePitch}
                      onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 progress-bar-range"
                    />
                    <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                      <span>Profondo (0.5x)</span>
                      <span>Normale (1.0x)</span>
                      <span>Acuto (2.0x)</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 p-3 border border-slate-900 rounded-xl space-y-2">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400 uppercase font-semibold">
                      <span>Velocità Eloquio (Rate)</span>
                      <span className="text-amber-400">{voiceRate.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.05"
                      value={voiceRate}
                      onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 progress-bar-range"
                    />
                    <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                      <span>Lento (0.5x)</span>
                      <span>Normale (1.0x)</span>
                      <span>Rapido (2.0x)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TEST BOOTH / SANDBOX WORKSPACE */}
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl space-y-3">
                <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest">E) Prova Doppiaggio su Frase Custom</span>
                
                <textarea
                  value={customTestPhrase}
                  onChange={(e) => setCustomTestPhrase(e.target.value)}
                  placeholder="Scrivi una battuta per ascoltare come recita il personaggio..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition resize-none leading-relaxed"
                />

                <div className="flex gap-2 justify-end">
                  {isPlaying ? (
                    <button
                      type="button"
                      onClick={handleStopVoiceTest}
                      className="px-4 py-2 bg-rose-950 border border-rose-900/40 hover:bg-rose-900 text-rose-400 text-xs font-bold rounded-lg transition uppercase flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" /> Stop Preview
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePlayVoiceTest}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 text-xs font-bold rounded-lg transition uppercase flex items-center justify-center gap-1.5 cursor-pointer leading-tight"
                    >
                      <Play className="w-3.5 h-3.5" /> Ascolta Battuta
                    </button>
                  )}
                </div>
              </div>

              {/* SAVE / UPDATE TRIGGER FOOTER BUTTON */}
              <div className="pt-4 border-t border-slate-800/80 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveVoiceToCharacter}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 font-extrabold text-slate-950 text-xs rounded-xl flex items-center gap-1.5 transition uppercase active:scale-95 shadow font-sans tracking-wide cursor-pointer"
                >
                  <Save className="w-4 h-4 text-slate-950" />
                  Salva Impronta Vocale
                </button>
              </div>

            </div>
          )}
        </div>

      </div>

    </div>
  );
}
