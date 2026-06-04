/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Comic, Panel } from "../types";
import { audioEngine } from "./AudioEngine";
import { apiFetch } from "../lib/api";
import { 
  Play, Pause, ArrowLeft, ArrowRight, Volume2, VolumeX, RotateCcw, 
  HelpCircle, Sparkles, AlertCircle, Headphones, Star
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PlayComicTheatreProps {
  comic: Comic;
  onExit: () => void;
  charactersList: any[];
}

export default function PlayComicTheatre({
  comic,
  onExit,
  charactersList,
}: PlayComicTheatreProps) {
  const [currentPanelIndex, setCurrentPanelIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isPlayingNarration, setIsPlayingNarration] = useState(false);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);
  const [ttsStatus, setTtsStatus] = useState<"unused" | "loading" | "custom_tts" | "browser_tts">("unused");
  const playTimerRef = useRef<any>(null);

  const currentPanel: Panel | undefined = comic.panels[currentPanelIndex];

  const activeSpeakPanelIdRef = useRef<string | null>(null);

  // Helper to retrieve character info
  const getCharacter = (id: string) => {
    return charactersList.find((c) => c.id === id);
  };

  // Trigger sound effect and speech voice narration for current panel (Sequentially reads Narration first, then Balloons!)
  const runPanelAudio = async (panel: Panel) => {
    // 1. Cancel previous HTML5 synth
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (isAudioMuted) {
      setCurrentlySpeakingId(null);
      setIsPlayingNarration(false);
      return;
    }

    activeSpeakPanelIdRef.current = panel.id;

    // 2. Play Synthesized Sound Effect
    if (panel.soundEffectPreset && panel.soundEffectPreset !== "none") {
      audioEngine.playSoundEffect(panel.soundEffectPreset);
    }

    // Build speech queue items
    interface SpeechQueueItem {
      id: string; // "narration" or dialog.id
      text: string;
      role: string;
      characterId?: string;
    }

    const queue: SpeechQueueItem[] = [];

    // First item is the main narrator row
    if (panel.narrationText && panel.narrationText.trim() !== "") {
      queue.push({
        id: "narration",
        text: panel.narrationText,
        role: "narrator",
        characterId: "narrator",
      });
    }

    // Subsequent items are balloon dialogs
    if (panel.dialogs && panel.dialogs.length > 0) {
      panel.dialogs.forEach((dialog) => {
        if (dialog.text && dialog.text.trim() !== "") {
          const s = getCharacter(dialog.characterId);
          queue.push({
            id: dialog.id,
            text: dialog.text,
            role: dialog.characterId === "narrator" ? "narrator" : (s?.role || "Neutral"),
            characterId: dialog.characterId,
          });
        }
      });
    }

    if (queue.length === 0) {
      setCurrentlySpeakingId(null);
      setIsPlayingNarration(false);
      return;
    }

    setIsPlayingNarration(true);
    let queueIdx = 0;

    const playNextQueueItem = async () => {
      // Abort if our panel is no longer active, or sounds are muted
      if (activeSpeakPanelIdRef.current !== panel.id || isAudioMuted) {
        setCurrentlySpeakingId(null);
        setIsPlayingNarration(false);
        return;
      }

      if (queueIdx >= queue.length) {
        // Sequencer complete!
        setCurrentlySpeakingId(null);
        setIsPlayingNarration(false);
        return;
      }

      const item = queue[queueIdx];
      setCurrentlySpeakingId(item.id);
      setTtsStatus("loading");

      // Retrieve full character info if applicable
      const character = item.characterId ? getCharacter(item.characterId) : undefined;

      // Check if custom uploaded voice clip exists
      if (character?.voiceAudioData && !isAudioMuted) {
        setTtsStatus("custom_tts");
        const audio = new Audio(character.voiceAudioData);
        audio.onended = () => {
          speakSynthesisText();
        };
        audio.onerror = () => {
          speakSynthesisText();
        };
        audio.play().catch(() => {
          speakSynthesisText();
        });
        return;
      }

      // Standard speech flows
      speakSynthesisText();

      async function speakSynthesisText() {
        if (activeSpeakPanelIdRef.current !== panel.id || isAudioMuted) {
          setCurrentlySpeakingId(null);
          setIsPlayingNarration(false);
          return;
        }

        try {
          // If user specifically customized synthesis sliders, bypass generic server synth and use customized local browser engine!
          if (character && (character.voiceSystemName || character.voicePitch !== undefined || character.voiceRate !== undefined)) {
            setTtsStatus("browser_tts");
            audioEngine.speakText(
              item.text,
              {
                pitch: character.voicePitch,
                rate: character.voiceRate,
                systemVoiceName: character.voiceSystemName,
                role: character.role,
              },
              () => {
                queueIdx++;
                playNextQueueItem();
              }
            );
            return;
          }

          // Otherwise, check Gemini narrative generation
          let apiVoice = "Kore";
          if (item.role === "Villain") apiVoice = "Fenrir";
          if (item.role === "Sidekick") apiVoice = "Puck";

          const response = await apiFetch("/api/narrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: item.text, voice: apiVoice }),
          });
          const data = await response.json();

          if (data.success && data.audioUrl && !isAudioMuted && activeSpeakPanelIdRef.current === panel.id) {
            setTtsStatus("custom_tts");
            audioEngine.playSpeechAudioBase64(data.audioUrl, () => {
              queueIdx++;
              playNextQueueItem();
            });
          } else {
            setTtsStatus("browser_tts");
            audioEngine.speakText(item.text, { role: item.role }, () => {
              queueIdx++;
              playNextQueueItem();
            });
          }
        } catch (err) {
          setTtsStatus("browser_tts");
          audioEngine.speakText(
            item.text,
            {
              pitch: character?.voicePitch,
              rate: character?.voiceRate,
              systemVoiceName: character?.voiceSystemName,
              role: character?.role || item.role,
            },
            () => {
              queueIdx++;
              playNextQueueItem();
            }
          );
        }
      }
    };

    // Begin sequence execution
    playNextQueueItem();
  };

  // Trigger audio on panel index change
  useEffect(() => {
    if (currentPanel) {
      runPanelAudio(currentPanel);
    } else if (currentPanelIndex === -1) {
      if (!isAudioMuted && comic.description && comic.description.trim() !== "") {
        setIsPlayingNarration(true);
        setCurrentlySpeakingId("cover-synopsis");
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(comic.description);
          utterance.lang = "it-IT";
          utterance.rate = 0.95;
          utterance.onend = () => {
            setIsPlayingNarration(false);
            setCurrentlySpeakingId(null);
          };
          utterance.onerror = () => {
            setIsPlayingNarration(false);
            setCurrentlySpeakingId(null);
          };
          window.speechSynthesis.speak(utterance);
        }
      } else {
        setCurrentlySpeakingId(null);
        setIsPlayingNarration(false);
      }
    } else {
      setCurrentlySpeakingId(null);
      setIsPlayingNarration(false);
    }

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [currentPanelIndex, isAudioMuted]);

  // Handle Autoplay timer
  useEffect(() => {
    if (isPlaying) {
      const currentTextLength = currentPanel ? (currentPanel.narrationText.length + 30) : 100;
      const delayMs = Math.max(5000, currentTextLength * 70); // Adaptive length delay

      playTimerRef.current = setTimeout(() => {
        if (currentPanelIndex < comic.panels.length - 1) {
          setCurrentPanelIndex((prev) => prev + 1);
        } else {
          setIsPlaying(false); // Stop when comic ends
        }
      }, delayMs);
    } else {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
      }
    }

    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [isPlaying, currentPanelIndex, comic.panels.length]);

  const handleNext = () => {
    if (currentPanelIndex < comic.panels.length - 1) {
      setCurrentPanelIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentPanelIndex > -1) {
      setCurrentPanelIndex((prev) => prev - 1);
    }
  };

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    setCurrentPanelIndex(-1);
    setIsPlaying(true);
  };

  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-100 z-50 flex flex-col justify-between overflow-hidden">
      {/* Header Bar */}
      <div className="h-16 px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (typeof window !== "undefined" && "speechSynthesis" in window) {
                window.speechSynthesis.cancel();
              }
              onExit();
            }}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded-xl transition"
            title="Esci dal Teatro"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-sans font-extrabold text-sm text-slate-200 tracking-wider uppercase">
              Teatro dei Fumetti Animato
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-sans text-amber-500 font-bold">{comic.title}</span>
              <span>•</span>
              <span className="font-mono">Stile: {comic.style}</span>
            </div>
          </div>
        </div>

        {/* Audio Indicators */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-950 border border-slate-800 rounded-full text-[10px] font-mono text-slate-400">
            <Headphones className="w-3.5 h-3.5 text-cyan-500" />
            {ttsStatus === "loading" && <span className="animate-pulse">AI Narration loading...</span>}
            {ttsStatus === "custom_tts" && <span className="text-emerald-400">Voce Gemini TTS Attiva</span>}
            {ttsStatus === "browser_tts" && <span className="text-sky-400">Sintesi Vocale Locale</span>}
            {ttsStatus === "unused" && <span>In attesa di riproduzione...</span>}
          </div>

          <button
            onClick={() => setIsAudioMuted(!isAudioMuted)}
            className="p-2 hover:bg-slate-800 text-slate-300 hover:text-slate-100 rounded-xl transition"
            title={isAudioMuted ? "Attiva Suoni" : "Silenzia Suoni"}
          >
            {isAudioMuted ? (
              <VolumeX className="w-5 h-5 text-rose-500" />
            ) : (
              <Volume2 className="w-5 h-5 text-emerald-500" />
            )}
          </button>
        </div>
      </div>

      {/* Main Theatre Screen Canvas */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
        
        {comic.panels.length === 0 ? (
          <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-2xl max-w-md">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <p className="text-sm text-slate-300">Non ci sono vignette create in questo fumetto. Clicca su Modifica per arricchire lo storyboard!</p>
          </div>
        ) : (
          <div className="w-full max-w-3xl aspect-[4/3] bg-slate-900/40 rounded-3xl border border-slate-800/80 shadow-2xl relative overflow-hidden flex flex-col justify-end">
            
            {/* Slide and Animation Panel view wrapper */}
            <AnimatePresence mode="wait">
              {currentPanelIndex === -1 ? (
                <motion.div
                  key="cover-page-theatre"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.04, y: -10 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10 text-slate-100 z-10"
                >
                  {/* Background poster blurred or custom styling */}
                  <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
                    {comic.panels[0]?.imageUrl && (
                      <img 
                        src={comic.panels[0].imageUrl} 
                        alt="bg blurred" 
                        className="absolute inset-0 w-full h-full object-cover opacity-15 blur-xl scale-125"
                      />
                    )}
                    <div className="absolute inset-0 bg-radial-gradient(ellipse_at_center,_var(--tw-gradient-stops)) from-[#020617]/40 via-[#0f172a]/90 to-[#020617]/100" />
                  </div>

                  <div className="text-center relative z-10 space-y-2 mt-4">
                    <span className="text-[9px] font-mono text-amber-400 font-extrabold uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full inline-block">
                      OPERA EDITORIALE • STILE {comic.style}
                    </span>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-100 uppercase font-sans drop-shadow leading-tight">
                      {comic.title}
                    </h1>
                    <div className="w-12 h-1 bg-amber-500 mx-auto rounded-full mt-2" />
                  </div>

                  <div className="max-w-xl mx-auto flex flex-col sm:flex-row gap-5 items-center relative z-10 my-4 bg-slate-950/70 p-5 rounded-2xl border border-slate-800/85 backdrop-blur-sm">
                    {comic.panels[0]?.imageUrl && (
                      <div className="w-32 h-24 rounded-lg overflow-hidden border border-slate-700/60 flex-shrink-0 shadow-lg">
                        <img src={comic.panels[0].imageUrl} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="text-left space-y-1 min-w-0">
                      <p className="text-slate-400 font-mono text-[8px] uppercase tracking-widest font-black text-amber-500">CANOVACCIO TRAMA</p>
                      <p className="text-xs text-slate-200 leading-relaxed italic line-clamp-4">
                        "{comic.description || "Nessuna introduzione testuale inserita in questa sceneggiatura."}"
                      </p>
                    </div>
                  </div>

                  {/* Cast section inside Play screen cover */}
                  {charactersList.length > 0 && (
                    <div className="relative z-10 text-center space-y-2 mb-2">
                      <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest font-bold font-semibold">I Protagonisti dell'Opera</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {charactersList
                          .filter(char => comic.characters?.includes(char.id) || charactersList.length <= 4)
                          .slice(0, 5)
                          .map((char) => (
                            <div key={char.id} className="flex items-center gap-1.5 bg-slate-950/85 px-2 py-0.5 rounded-md border border-slate-800 shadow-inner">
                              <div className="w-5 h-5 rounded-md border overflow-hidden flex-shrink-0" style={{ borderColor: char.accentColor }}>
                                <img src={char.avatarUrl} alt={char.name} className="w-full h-full object-cover animate-pulse" />
                              </div>
                              <span className="text-[9.5px] text-slate-300 font-extrabold max-w-[80px] truncate">{char.name}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Introductory voice-narration play option */}
                  <div className="flex flex-col items-center gap-2 relative z-10 pb-4">
                    <button
                      type="button"
                      onClick={() => setCurrentPanelIndex(0)}
                      className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-450 hover:from-amber-400 hover:to-yellow-350 text-slate-950 font-black tracking-wider text-[11px] rounded-xl flex items-center gap-1.5 shadow-lg active:scale-95 transition cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-slate-950" />
                      <span>AVVIA LO SPETTACOLO</span>
                    </button>
                    <span className="text-[8.5px] text-slate-400 font-mono tracking-wide">
                      {isPlayingNarration ? "🔊 NARRATORE STA RECITANDO LA SINOSSI..." : "Ascolta l'introduzione dello show"}
                    </span>
                  </div>
                </motion.div>
              ) : currentPanel ? (
                <motion.div
                  key={currentPanelIndex}
                  initial={{ opacity: 0, scale: 0.98, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 1.02, x: -20 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="absolute inset-0 flex flex-col"
                >
                  {/* Backdrop Scene Illustration */}
                  <div className="absolute inset-0 z-0 bg-slate-950">
                    {currentPanel.imageUrl ? (
                      <img
                        src={currentPanel.imageUrl || null}
                        alt="Comic panel illustration"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover select-none"
                      />
                    ) : (
                      // Creative placeholder backdrop with layout styles
                      <div className="w-full h-full bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-8">
                        <div className="text-center opacity-30 select-none max-w-md">
                          <Star className="w-16 h-16 text-slate-400 mx-auto mb-2 animate-spin duration-1000" />
                          <p className="font-mono text-[10px] uppercase text-slate-500 tracking-wider">
                            SCENE PROMPT: {currentPanel.sceneDescription}
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Shadow overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent pointer-events-none" />
                  </div>

                  {/* Character Position Overlays */}
                  <div className="absolute inset-x-0 bottom-16 top-12 z-20 flex pointer-events-none px-12">
                    {currentPanel.charactersInPanel?.map((placement) => {
                      const charData = getCharacter(placement.characterId);
                      if (!charData) return null;

                      // Character animations preset triggers using motion
                      let animVariants = {};
                      if (placement.animationType === "floating") {
                        animVariants = {
                          animate: { y: [0, -12, 0] },
                          transition: { repeat: Infinity, duration: 3, ease: "easeInOut" }
                        };
                      } else if (placement.animationType === "bouncing") {
                        animVariants = {
                          animate: { y: [0, -18, 0] },
                          transition: { repeat: Infinity, duration: 1.2, ease: "easeOut" }
                        };
                      } else if (placement.animationType === "pulse") {
                        animVariants = {
                          animate: { scale: [1, 1.05, 1] },
                          transition: { repeat: Infinity, duration: 2, ease: "easeInOut" }
                        };
                      } else if (placement.animationType === "shaking") {
                        animVariants = {
                          animate: { x: [-3, 3, -3, 3, 0] },
                          transition: { repeat: Infinity, duration: 0.5 }
                        };
                      }

                      return (
                        <motion.div
                          key={placement.characterId}
                          className="absolute bottom-4 flex flex-col items-center"
                          style={{ 
                            left: `${placement.positionX}%`, 
                            transform: `translateX(-50%) scale(${placement.scale || 1})`
                          }}
                          {...animVariants}
                        >
                          {/* Face Avatar */}
                          <div 
                            className="bg-slate-900 border-2 rounded-2xl w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shadow-lg overflow-hidden relative"
                            style={{ borderColor: charData.accentColor }}
                          >
                            <img
                              src={charData.avatarUrl || null}
                              alt={charData.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            {/* Pose Label */}
                            <span className="absolute bottom-0 inset-x-0 bg-slate-950/90 text-[8px] font-mono text-center py-0.5 border-t border-slate-800">
                              {placement.pose}
                            </span>
                          </div>
                          
                          {/* Name tag */}
                          <span 
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md mt-1.5 shadow" 
                            style={{ backgroundColor: `${charData.accentColor}cc`, color: "#000" }}
                          >
                            {charData.name.split(" ")[0]}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>                  {/* Speech Bubbles/Dialogue Balloons with Active Focus Highlighting */}
                  <div className="absolute inset-0 z-30 pointer-events-none">
                    {currentPanel.dialogs?.map((dialog) => {
                      const speaker = getCharacter(dialog.characterId);
                      const isNarrator = dialog.characterId === "narrator" || !speaker;
                      
                      // Highlight checking
                      const isItemSpeaking = currentlySpeakingId === dialog.id;
                      const isAnyItemSpeaking = currentlySpeakingId !== null;
                      
                      // Dynamic opacity and scaling classes
                      let bubbleOpacityClass = "opacity-100 scale-100";
                      if (isAnyItemSpeaking) {
                        bubbleOpacityClass = isItemSpeaking 
                          ? "opacity-100 scale-105 ring-4 ring-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.5)]" 
                          : "opacity-40 scale-95 transition-all duration-300 pointer-events-none";
                      }

                      return (
                        <motion.div
                          key={dialog.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 }}
                          className={`absolute pointer-events-auto transition-all duration-300 ${bubbleOpacityClass}`}
                          style={{ 
                            left: `${dialog.positionX}%`, 
                            top: `${dialog.positionY}%`,
                            transform: "translate(-50%, -50%)"
                          }}
                        >
                          {isNarrator ? (
                            // Narrator box - sleek yellow label
                            <div className="bg-amber-600/95 border-2 border-amber-400 text-slate-950 font-sans font-semibold text-xs px-3 py-2 rounded-lg max-w-[200px] shadow-lg">
                              <p className="text-[9px] uppercase tracking-wider font-mono opacity-80 mb-0.5">Narratore</p>
                              {dialog.text}
                            </div>
                          ) : (
                            // Comic speech balloon
                            (() => {
                              const isThought = dialog.bubbleType === "thought";
                              const isShout = dialog.bubbleType === "shout";
                              const isWhisper = dialog.bubbleType === "whisper";

                              let bubbleStyleClass = "bg-white text-slate-950 p-3 rounded-2xl max-w-[180px] shadow-xl border-2 border-slate-950 text-xs font-medium relative";
                              if (isThought) {
                                bubbleStyleClass = "bg-white text-slate-950 p-3.5 rounded-[22px] max-w-[180px] shadow-xl border-2 border-dashed border-slate-950 text-xs font-medium relative";
                              } else if (isShout) {
                                bubbleStyleClass = "bg-yellow-50 text-slate-950 p-3.5 rounded-none max-w-[180px] shadow-2xl border-2 border-red-650 outline outline-2 outline-slate-950 text-xs font-bold uppercase tracking-wide skew-x-1 relative";
                              } else if (isWhisper) {
                                bubbleStyleClass = "bg-slate-50 text-slate-650 p-3 rounded-xl max-w-[180px] shadow-lg border-2 border-dashed border-slate-400 text-xs italic relative";
                              }

                              const tailDir = dialog.bubbleTail || "bottom";
                              const tailBg = isShout ? "bg-yellow-50" : (isWhisper ? "bg-slate-50" : "bg-white");
                              const tailBorder = isShout ? "border-red-650" : (isWhisper ? "border-slate-400 border-dashed" : "border-slate-950");

                              return (
                                <div className={bubbleStyleClass}>
                                  <p className="text-[8px] font-bold uppercase tracking-wider mb-0.5" style={{ color: speaker?.accentColor }}>
                                    {speaker?.name.split(" ")[0]}
                                  </p>
                                  {dialog.text}
                                  
                                  {/* Speech bubble tail pointer or cloud dots */}
                                  {tailDir !== "none" && (
                                    <>
                                      {isThought ? (
                                        <div className={`absolute pointer-events-none flex items-center gap-1.5 ${
                                          tailDir === "left" ? "right-full -translate-y-1/2 top-1/2 mr-1 flex-row" :
                                          tailDir === "right" ? "left-full -translate-y-1/2 top-1/2 ml-1 flex-row-reverse" :
                                          tailDir === "top" ? "bottom-full -translate-x-1/2 left-1/2 mb-1 flex-col-reverse" :
                                          "top-full -translate-x-1/2 left-1/2 mt-1 flex-col"
                                        }`}>
                                          <div className="w-2.5 h-2.5 rounded-full bg-white border border-slate-950" />
                                          <div className="w-1.5 h-1.5 rounded-full bg-white border border-slate-950" />
                                        </div>
                                      ) : (
                                        <div 
                                          className={`absolute w-3 h-3 rotate-45 border-r border-b ${tailBg} ${tailBorder} ${
                                            tailDir === "left" ? "-left-1.5 top-1/2 -translate-y-1/2 rotate-135" :
                                            tailDir === "right" ? "-right-1.5 top-1/2 -translate-y-1/2 -rotate-45" :
                                            tailDir === "top" ? "-top-1.5 left-1/2 -translate-x-1/2 -rotate-135" :
                                            "-bottom-1.5 left-1/2 -translate-x-1/2" // bottom default
                                          }`} 
                                        />
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })()
                          )}
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Onomatopoeia Sound FX overlay */}
                  {currentPanel.soundEffectText && (
                    <motion.div
                      initial={{ scale: 0, rotate: -20, opacity: 0 }}
                      animate={{ scale: [0, 1.2, 1], rotate: [-20, 15, 10], opacity: 1 }}
                      transition={{ duration: 0.35, delay: 0.1 }}
                      className="absolute top-12 right-12 z-40 select-none pointer-events-none"
                    >
                      <div className="bg-yellow-400 text-slate-950 font-black text-2xl sm:text-3xl px-4 py-2 border-3 border-slate-950 rounded-lg shadow-2xl relative transform skew-x-3 skew-y-3 skew-y select-none">
                        <div className="absolute -inset-1 bg-red-600 -z-10 rounded border border-slate-950" />
                        <span className="tracking-tighter block">{currentPanel.soundEffectText}</span>
                      </div>
                    </motion.div>
                  )}

                  {/* Panel Caption / Narration Strip with Glowing Highlight when speaking */}
                  {currentPanel.narrationText && (
                    <div className={`absolute bottom-0 inset-x-0 z-40 bg-slate-950/95 border-t p-4 transition-all duration-300 ${
                      currentlySpeakingId === "narration" 
                        ? "border-amber-500 bg-slate-900 shadow-[0_-8px_20px_rgba(245,158,11,0.18)]" 
                        : "border-slate-800"
                    }`}>
                      <p className={`text-xs sm:text-sm font-sans italic text-center max-w-2xl mx-auto block leading-relaxed select-text transition-colors duration-300 ${
                        currentlySpeakingId === "narration" ? "text-amber-300 font-semibold" : "text-slate-300"
                      }`}>
                        "{currentPanel.narrationText}"
                      </p>
                    </div>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        )}

        {/* Panel Stepper status */}
        <div className="mt-4 text-xs font-mono text-slate-500 uppercase tracking-wider">
          {currentPanelIndex === -1 ? "COPERTINA INIZIALE" : `VIGNETTA ${currentPanelIndex + 1} DI ${comic.panels.length}`}
        </div>
      </div>

      {/* Playback Controls Footer */}
      <div className="h-20 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-between">
        
        {/* Left indicators */}
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            onClick={() => {
              if (isPlaying) {
                setIsPlaying(false);
              }
              handleRestart();
            }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            title="Ricomincia"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Playback Buttons */}
        <div className="flex items-center gap-3 mx-auto sm:mx-0">
          <button
            onClick={handlePrev}
            disabled={currentPanelIndex === -1}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            onClick={handleTogglePlay}
            className="px-6 py-2.5 bg-amber-500 text-slate-950 font-bold rounded-xl flex items-center gap-2 hover:bg-amber-400 font-sans cursor-pointer shadow-lg active:scale-95 transition"
          >
            {isPlaying ? (
              <>
                <Pause className="w-5 h-5 fill-slate-950" />
                <span>PAUSA</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-slate-950" />
                <span>AVVIA</span>
              </>
            )}
          </button>

          <button
            onClick={handleNext}
            disabled={currentPanelIndex === comic.panels.length - 1}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Right side page info */}
        <div className="text-right text-xs text-slate-400 hidden sm:block">
          Usa le frecce per sfogliare la storia
        </div>
      </div>
    </div>
  );
}
