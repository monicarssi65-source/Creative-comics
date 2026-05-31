/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Comic, Panel, Character, PanelDialog, PanelCharacterPlacement } from "../types";
import { audioEngine } from "./AudioEngine";
import { 
  Sparkles, Image, Play, Trash2, Plus, Volume2, UserPlus, 
  HelpCircle, Settings, Quote, Smile, Move, Sliders, AlertCircle, RefreshCw,
  ZoomIn, ZoomOut
} from "lucide-react";
import { motion } from "motion/react";

interface StoryboardCreatorProps {
  comic: Comic;
  onUpdateComic: (updated: Comic) => void;
  charactersList: Character[];
  onOpenCharacterModal: () => void;
}

export default function StoryboardCreator({
  comic,
  onUpdateComic,
  charactersList,
  onOpenCharacterModal,
}: StoryboardCreatorProps) {
  const [activePanelId, setActivePanelId] = useState<string | null>(
    comic.panels[0]?.id || null
  );
  
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingDialogIndexRef = useRef<number | null>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleZoomChange = (nextZoom: number) => {
    const clamped = Math.max(1, Math.min(4, nextZoom));
    setZoom(Number(clamped.toFixed(2)));
    if (clamped === 1) {
      setPan({ x: 0, y: 0 });
    }
  };

  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Zoom on wheel inside the preview
    // Prevents page scrolling to maintain clean UI focus
    e.preventDefault();
    const zoomFactor = 0.08;
    const direction = e.deltaY < 0 ? 1 : -1;
    const nextZoom = Math.max(1, Math.min(4, zoom + direction * zoomFactor));
    setZoom(Number(nextZoom.toFixed(2)));
    
    if (nextZoom === 1) {
      setPan({ x: 0, y: 0 });
    }
  };

  const handleBgPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only pan with primary mouse click or touch
    if (e.button !== 0) return;
    
    // Ignore clicks on buttons, inputs or items with .pointer-events-auto
    const targetElement = e.target as HTMLElement;
    if (targetElement.closest("button") || targetElement.closest("select") || targetElement.closest(".pointer-events-auto")) {
      return; 
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleBgPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    const nextX = e.clientX - panStartRef.current.x;
    const nextY = e.clientY - panStartRef.current.y;

    // Clamp the layout pan relative to scale
    const maxPanX = (zoom - 1) * 200;
    const maxPanY = (zoom - 1) * 150;
    
    const clampedX = Math.max(-maxPanX, Math.min(maxPanX, nextX));
    const clampedY = Math.max(-maxPanY, Math.min(maxPanY, nextY));

    setPan({ x: clampedX, y: clampedY });
  };

  const handleBgPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsPanning(false);
    }
  };

  const handleDialogPointerDown = (e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingDialogIndexRef.current = idx;
    e.stopPropagation();
  };

  const handleDialogPointerMove = (e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    if (draggingDialogIndexRef.current !== idx) return;
    if (!containerRef.current || !activePanel) return;

    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Calculate center of preview container
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    // Client coordinate relative to stable container top-left
    const p_outer_x = e.clientX - rect.left;
    const p_outer_y = e.clientY - rect.top;

    // Transform inverted coordinate matching: translate(pan) scale(zoom) around center
    const p_inner_x = cx + (p_outer_x - cx - pan.x) / zoom;
    const p_inner_y = cy + (p_outer_y - cy - pan.y) / zoom;

    let xPercent = (p_inner_x / rect.width) * 100;
    let yPercent = (p_inner_y / rect.height) * 100;

    // Clamp coordinates safely within the viewport layout bounds (leaving margins)
    xPercent = Math.max(5, Math.min(95, xPercent));
    yPercent = Math.max(5, Math.min(95, yPercent));

    handleUpdateDialogPosition(idx, Math.round(xPercent), Math.round(yPercent));
  };

  const handleDialogPointerUp = (e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    if (draggingDialogIndexRef.current === idx) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      draggingDialogIndexRef.current = null;
    }
  };

  const [isGeneratingPanel, setIsGeneratingPanel] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Drag and drop state for panels
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (idx: number) => {
    setDraggedIndex(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIndex !== idx) {
      setDragOverIndex(idx);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIdx) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const nextPanels = [...comic.panels];
    const [movedPanel] = nextPanels.splice(draggedIndex, 1);
    nextPanels.splice(targetIdx, 0, movedPanel);

    onUpdateComic({ ...comic, panels: nextPanels });
    
    // Auto sync selection to the moved panel
    setActivePanelId(movedPanel.id);
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const activePanelIndex = comic.panels.findIndex((p) => p.id === activePanelId);
  const activePanel = comic.panels[activePanelIndex];

  const handleUpdatePanel = (updatedPanel: Panel) => {
    const nextPanels = [...comic.panels];
    nextPanels[activePanelIndex] = updatedPanel;
    onUpdateComic({ ...comic, panels: nextPanels });
  };

  // Add clean blank panel
  const handleAddPanel = () => {
    const newPanel: Panel = {
      id: "panel-" + Date.now().toString(),
      sceneDescription: "Un nuovo magnifico scenario d'avventura per il tuo fumetto",
      imageUrl: "",
      soundEffectText: "BAM!",
      soundEffectPreset: "none",
      narrationText: "Inserisci qui il testo narrativo per descrivere l'azione...",
      dialogs: [],
      charactersInPanel: [],
    };

    const nextPanels = [...comic.panels, newPanel];
    onUpdateComic({ ...comic, panels: nextPanels });
    setActivePanelId(newPanel.id);
  };

  // Delete specific panel
  const handleDeletePanel = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (comic.panels.length <= 1) {
      alert("Il tuo fumetto deve contenere almeno una vignetta!");
      return;
    }

    const nextPanels = comic.panels.filter((p) => p.id !== id);
    onUpdateComic({ ...comic, panels: nextPanels });
    
    if (activePanelId === id) {
      setActivePanelId(nextPanels[0].id);
    }
  };

  // Trigger sound test synthesized live
  const handleTestSound = (preset: string) => {
    if (preset && preset !== "none") {
      audioEngine.playSoundEffect(preset);
    }
  };

  // Trigger Gemini layout/image generator endpoint for current vignette
  const handleGeneratePanelImage = async () => {
    if (!activePanel) return;
    setIsGeneratingPanel(true);
    setFeedbackMsg("Generazione dell'illustrazione in corso...");

    try {
      const response = await fetch("/api/generate-panel-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneDescription: activePanel.sceneDescription,
          style: comic.style,
        }),
      });

      const data = await response.json();
      if (data.success && data.imageUrl) {
        handleUpdatePanel({
          ...activePanel,
          imageUrl: data.imageUrl,
        });
        setFeedbackMsg("Illustrazione creata con successo!");
      } else {
        throw new Error(data.message || "Errore nella generazione dell'immagine.");
      }
    } catch (err: any) {
      console.warn("Panel Gen Exception:", err);
      // Fallback placeholder dynamically
      setFeedbackMsg("Modalità Demo: Chiave Gemini non trovata. Utilizzato segnaposto artistico!");
      setTimeout(() => {
        const seedValue = Math.floor(Math.random() * 1000);
        handleUpdatePanel({
          ...activePanel,
          imageUrl: `https://picsum.photos/seed/${seedValue}/800/600`,
        });
      }, 1000);
    } finally {
      setIsGeneratingPanel(false);
    }
  };

  // Speech dialog management
  const handleAddDialog = () => {
    if (!activePanel) return;
    if (activePanel.dialogs.length >= 2) {
      alert("Massimo 2 nuvolette per vignetta per mantenere la leggibilità!");
      return;
    }

    const newDialog: PanelDialog = {
      id: "dialog-" + Date.now().toString(),
      characterId: charactersList[0]?.id || "narrator",
      text: "Cosa dice il personaggio?",
      positionX: activePanel.dialogs.length === 0 ? 30 : 70, // Default distribute
      positionY: 25,
    };

    handleUpdatePanel({
      ...activePanel,
      dialogs: [...activePanel.dialogs, newDialog],
    });
  };

  const handleRemoveDialog = (dialogId: string) => {
    if (!activePanel) return;
    handleUpdatePanel({
      ...activePanel,
      dialogs: activePanel.dialogs.filter((d) => d.id !== dialogId),
    });
  };

  const handleUpdateDialog = (idx: number, key: keyof PanelDialog, value: any) => {
    if (!activePanel) return;
    const nextDialogs = [...activePanel.dialogs];
    nextDialogs[idx] = { ...nextDialogs[idx], [key]: value };
    handleUpdatePanel({ ...activePanel, dialogs: nextDialogs });
  };

  const handleUpdateDialogPosition = (idx: number, x: number, y: number) => {
    if (!activePanel) return;
    const nextDialogs = [...activePanel.dialogs];
    nextDialogs[idx] = { ...nextDialogs[idx], positionX: x, positionY: y };
    handleUpdatePanel({ ...activePanel, dialogs: nextDialogs });
  };

  // Character placement toggle
  const handleToggleCharacter = (charId: string) => {
    if (!activePanel) return;
    const isPresent = activePanel.charactersInPanel.some((c) => c.characterId === charId);

    let nextPlacements = [];
    if (isPresent) {
      nextPlacements = activePanel.charactersInPanel.filter((c) => c.characterId !== charId);
    } else {
      const placement: PanelCharacterPlacement = {
        characterId: charId,
        pose: "Neutral",
        positionX: activePanel.charactersInPanel.length === 0 ? 30 : 70,
        scale: 1.0,
        animationType: "none",
      };
      nextPlacements = [...activePanel.charactersInPanel, placement];
    }

    handleUpdatePanel({
      ...activePanel,
      charactersInPanel: nextPlacements,
    });
  };

  const handleUpdateCharacterPlacement = (charId: string, updatedField: Partial<PanelCharacterPlacement>) => {
    if (!activePanel) return;
    const nextPlacements = activePanel.charactersInPanel.map((placement) => {
      if (placement.characterId === charId) {
        return { ...placement, ...updatedField };
      }
      return placement;
    });

    handleUpdatePanel({
      ...activePanel,
      charactersInPanel: nextPlacements,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Side Vignettes List / Timeline - 3 Cols */}
      <div className="lg:col-span-3 space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3.5">
            <h4 className="font-sans font-extrabold text-xs text-slate-400 uppercase tracking-widest">
              Story Board
            </h4>
            <span className="font-mono text-xs text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
              {comic.panels.length} vignette
            </span>
          </div>

          {/* Draggable/Selectable Panels Scrollable Area */}
          <p className="text-[9px] font-mono text-slate-500 mb-2 uppercase tracking-widest text-center">
            Trascina le vignette per riordinarle
          </p>
          <div className="space-y-2.5 max-h-[58vh] overflow-y-auto pr-1">
            {comic.panels.map((panel, idx) => {
              const active = panel.id === activePanelId;
              const isDragOver = dragOverIndex === idx;
              const isDragging = draggedIndex === idx;

              return (
                <div
                  key={panel.id}
                  onClick={() => setActivePanelId(panel.id)}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`group relative p-3 rounded-xl border cursor-pointer select-none transition flex items-center gap-3 ${
                    active
                      ? "bg-slate-800/80 border-amber-500 shadow"
                      : "bg-slate-950/40 border-slate-800/70 hover:border-slate-700"
                  } ${isDragOver ? "border-dashed border-amber-500 bg-slate-900 scale-[0.98]" : ""} ${
                    isDragging ? "opacity-30 border-dashed border-slate-800/60" : ""
                  }`}
                >
                  {/* Grip handler */}
                  <div className="text-slate-600 hover:text-amber-500 cursor-grab shrink-0 transition">
                    <Move className="w-3.5 h-3.5" />
                  </div>

                  <div className="flex-shrink-0 w-12 h-10 rounded-lg bg-slate-900 overflow-hidden border border-slate-800">
                    {panel.imageUrl ? (
                      <img
                        src={panel.imageUrl || null}
                        alt="Preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-950 font-mono text-[9px] font-bold">
                        VNL {idx + 1}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-300">Vignetta {idx + 1}</p>
                    <p className="text-[10px] text-slate-500 truncate">{panel.sceneDescription}</p>
                  </div>

                  {/* Delete panel badge */}
                  <button
                    onClick={(e) => handleDeletePanel(panel.id, e)}
                    disabled={comic.panels.length <= 1}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded-md hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition disabled:opacity-0"
                    title="Elimina Vignetta"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleAddPanel}
            className="w-full mt-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            AGGIUNGI VIGNETTA
          </button>
        </div>

        {/* Informative block */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-2">
          <p className="font-mono font-bold text-[10px] text-slate-500 uppercase tracking-wider">
            Consigli di Creazione
          </p>
          <p className="leading-relaxed">
            Assegna alle vignette brevi scenari suggestivi. Puoi testare gli effetti sonori o sintonizzare l'aspetto dei personaggi nel pannello di destra.
          </p>
        </div>
      </div>

      {/* Primary Workspace Editor Area - 9 cols */}
      <div className="lg:col-span-9 space-y-6">
        {activePanel ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            {/* Split Panel header and actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-mono text-amber-500 font-bold uppercase tracking-widest">
                  In Fase di Modifica
                </span>
                <h3 className="font-sans font-bold text-lg text-slate-100">
                  Vignetta {activePanelIndex + 1} dello Storyboard
                </h3>
              </div>

              {/* Generate button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGeneratePanelImage}
                  disabled={isGeneratingPanel}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow"
                >
                  {isGeneratingPanel ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>CREAZIONE AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>GENERA SCENA AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Layout Workspace Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Side: Illustrative Preview with active balloons */}
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                    Anteprima Live Vignetta
                  </p>
                  {activePanel.dialogs && activePanel.dialogs.length > 0 && (
                    <span className="text-[10px] text-indigo-400 font-medium flex items-center gap-1 bg-indigo-950/40 border border-indigo-900/50 px-2 py-0.5 rounded-full select-none animate-pulse">
                      <Move className="w-3 h-3 text-indigo-400" /> Trascina le nuvolette per spostarle
                    </span>
                  )}
                </div>                <div 
                  ref={containerRef} 
                  className="aspect-[4/3] bg-slate-950 rounded-2xl border border-slate-800/80 shadow-md relative overflow-hidden flex flex-col justify-end group select-none touch-none"
                  onWheel={handleWheel}
                >
                  {/* Zoom/Pan viewport wrapper */}
                  <div 
                    className="absolute inset-0 select-none cursor-grab active:cursor-grabbing"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: "center center",
                      transition: isPanning ? "none" : "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)"
                    }}
                    onPointerDown={handleBgPointerDown}
                    onPointerMove={handleBgPointerMove}
                    onPointerUp={handleBgPointerUp}
                    onPointerCancel={handleBgPointerUp}
                  >
                    {activePanel.imageUrl ? (
                      <img
                        src={activePanel.imageUrl || null}
                        alt="Full representation"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover select-none z-0"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-850 flex flex-col items-center justify-center p-6 text-center select-none">
                        <Image className="w-12 h-12 text-slate-700 mb-2 animate-bounce" />
                        <p className="text-xs font-medium text-slate-500 max-w-xs">{activePanel.sceneDescription}</p>
                      </div>
                    )}

                    {/* Gradient shadow */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent pointer-events-none z-10" />

                    {/* Character overlays */}
                    <div className="absolute inset-x-0 bottom-12 top-10 flex pointer-events-none px-8 z-20">
                      {activePanel.charactersInPanel?.map((placement) => {
                        const character = charactersList.find((c) => c.id === placement.characterId);
                        if (!character) return null;

                        // Simulated animation preview styles mapping
                        let classes = "absolute bottom-3 flex flex-col items-center transform -translate-x-1/2";
                        let style: React.CSSProperties = { left: `${placement.positionX}%` };

                        return (
                          <div key={placement.characterId} className={`${classes} scale-[0.85]`} style={style}>
                            <div 
                              className={`w-14 h-14 rounded-xl border-2 overflow-hidden bg-slate-900 flex items-center justify-center shadow-lg ${
                                placement.animationType === "shaking" ? "animate-bounce" : ""
                              } ${placement.animationType === "pulse" ? "scale-105" : ""}`}
                              style={{ borderColor: character.accentColor }}
                            >
                              <img
                                src={character.avatarUrl || null}
                                alt={character.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-0 inset-x-0 bg-slate-950/90 text-[7px] text-center font-mono py-0.5">
                                {placement.pose}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Draggable/Position dialogue balloons mock view */}
                    <div className="absolute inset-0 z-35 pointer-events-none">
                      {activePanel.dialogs?.map((dialog, idx) => {
                        const speaker = charactersList.find((c) => c.id === dialog.characterId);
                        const isNarrator = dialog.characterId === "narrator" || !speaker;

                        // Bubble shape / style calculations
                        let bubbleStyleClass = "rounded-xl border-2 border-slate-950 bg-white";
                        if (dialog.bubbleType === "thought") {
                          bubbleStyleClass = "rounded-[20px] border-2 border-slate-950 border-dashed bg-white shadow-sm";
                        } else if (dialog.bubbleType === "shout") {
                          bubbleStyleClass = "rounded-none border-2 border-red-650 outline outline-2 outline-slate-950 font-bold skew-x-1 shadow-md bg-yellow-50 text-slate-950";
                        } else if (dialog.bubbleType === "whisper") {
                          bubbleStyleClass = "rounded-lg border-2 border-dashed border-slate-400 bg-slate-50 text-slate-650 italic";
                        }

                        // Tailwind classes for the pointer tail depending on direction and bubbleType
                        const tailDir = dialog.bubbleTail || "bottom";
                        const isThought = dialog.bubbleType === "thought";
                        const isShout = dialog.bubbleType === "shout";
                        
                        const tailBg = isShout ? "bg-yellow-50" : (dialog.bubbleType === "whisper" ? "bg-slate-50" : "bg-white");
                        const tailBorder = isShout ? "border-red-650" : (dialog.bubbleType === "whisper" ? "border-slate-400 border-dashed" : "border-slate-950");

                        return (
                          <div
                            key={dialog.id}
                            className={`absolute ${bubbleStyleClass} p-2 text-[10px] font-sans font-medium max-w-[120px] shadow select-none touch-none cursor-move active:scale-105 active:shadow-lg transition-transform duration-75 pointer-events-auto`}
                            style={{ 
                              left: `${dialog.positionX}%`, 
                              top: `${dialog.positionY}%`,
                              transform: "translate(-50%, -50%)" 
                            }}
                            onPointerDown={(e) => handleDialogPointerDown(e, idx)}
                            onPointerMove={(e) => handleDialogPointerMove(e, idx)}
                            onPointerUp={(e) => handleDialogPointerUp(e, idx)}
                            onPointerCancel={(e) => handleDialogPointerUp(e, idx)}
                          >
                            {isNarrator ? (
                              <div className="bg-amber-600 text-slate-950 px-1 py-0.5 rounded mb-0.5 text-[8px] font-bold">NARRATORE</div>
                            ) : (
                              <div className="text-[8px] font-bold" style={{ color: speaker?.accentColor }}>{speaker?.name.split(" ")[0]}</div>
                            )}
                            <p className="truncate">{dialog.text}</p>

                            {/* Render tail pointers */}
                            {!isNarrator && tailDir !== "none" && (
                              <>
                                {isThought ? (
                                  // Little cloud circles for thought bubbles
                                  <div className={`absolute pointer-events-none flex flex-col items-center gap-1 ${
                                    tailDir === "left" ? "right-full -translate-y-1/2 top-1/2 mr-1 flex-row" :
                                    tailDir === "right" ? "left-full -translate-y-1/2 top-1/2 ml-1 flex-row-reverse" :
                                    tailDir === "top" ? "bottom-full -translate-x-1/2 left-1/2 mb-1 flex-col-reverse" :
                                    "top-full -translate-x-1/2 left-1/2 mt-1 flex-col"
                                  }`}>
                                    <div className="w-2 h-2 rounded-full bg-white border border-slate-950" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-white border border-slate-950" />
                                  </div>
                                ) : (
                                  // Triangle pointer
                                  <div 
                                    className={`absolute w-2.5 h-2.5 rotate-45 border-r border-b ${tailBg} ${tailBorder} ${
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
                      })}
                    </div>
                  </div>

                  {/* FIXED non-zoomed overlays on top of the zoom viewport */}
                  {/* Floating Zoom Controls bar */}
                  <div className="absolute bottom-14 left-4 z-45 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-850 p-1.5 rounded-2xl shadow-xl pointer-events-auto select-none opacity-90 hover:opacity-100 transition duration-150 group-hover:scale-102">
                    <button
                      type="button"
                      onClick={() => handleZoomChange(zoom - 0.25)}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
                      title="Zoom Out (-)"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="0.1"
                      value={zoom}
                      onChange={(e) => handleZoomChange(Number(e.target.value))}
                      className="w-16 h-1 accent-amber-500 bg-slate-800 rounded-lg cursor-pointer"
                    />

                    <span className="text-[10px] select-none font-mono font-medium text-slate-300 pr-1 min-w-[34px] text-right">
                      {Math.round(zoom * 100)}%
                    </span>
                    
                    <button
                      type="button"
                      onClick={() => handleZoomChange(zoom + 0.25)}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
                      title="Zoom In (+)"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>

                    {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
                      <button
                        type="button"
                        onClick={handleZoomReset}
                        className="p-1.5 hover:bg-amber-950/50 hover:text-amber-400 rounded-lg text-amber-500 border-l border-slate-800 pl-2 transition"
                        title="Resetta Visuale"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Sound visual text overlay */}
                  {activePanel.soundEffectText && (
                    <div className="absolute top-4 right-4 z-40 bg-yellow-400 text-slate-950 font-black text-xs px-2.5 py-1.5 border-2 border-slate-950 rounded rotate-12 shadow transform scale-110 select-none">
                      {activePanel.soundEffectText}
                    </div>
                  )}

                  {/* Narrative text caption bar */}
                  <div className="caption-strip bg-slate-950/90 z-40 border-t border-slate-800 p-2.5 text-center">
                    <p className="text-[11px] text-slate-300 italic truncate">
                      "{activePanel.narrationText}"
                    </p>
                  </div>
                </div>

                {/* Display prompt instructions / helper status */}
                {feedbackMsg && (
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-amber-500 font-medium">
                    {feedbackMsg}
                  </div>
                )}
              </div>

              {/* Right Side: Primary parameter controls */}
              <div className="space-y-5">
                {/* Visual prompt setting */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">
                    Descrizione Scena (Prompt AI di Disegno)
                  </label>
                  <textarea
                    value={activePanel.sceneDescription}
                    onChange={(e) => handleUpdatePanel({ ...activePanel, sceneDescription: e.target.value })}
                    placeholder="Descrivi cosa deve mostrare la vignetta..."
                    rows={2.5}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 transition resize-none"
                  />
                </div>

                {/* Narrative Caption */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">
                    Testo di Narrazione della Vignetta (Audio Narratore)
                  </label>
                  <textarea
                    value={activePanel.narrationText}
                    onChange={(e) => handleUpdatePanel({ ...activePanel, narrationText: e.target.value })}
                    placeholder="Il testo che descrive l'atmosfera o l'azione..."
                    rows={2.5}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 transition resize-none"
                  />
                </div>

                {/* Sound effect presets config */}
                <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-3.5 border border-slate-800/60 rounded-xl">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                      Effetto Sonoro Preset
                    </label>
                    <div className="flex gap-1.5 items-center">
                      <select
                        value={activePanel.soundEffectPreset}
                        onChange={(e: any) => handleUpdatePanel({ ...activePanel, soundEffectPreset: e.target.value })}
                        className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-amber-500"
                      >
                        <option value="none">Nessun suono</option>
                        <option value="laser">Laser Fantascientifico</option>
                        <option value="explosion">Esplosione Caotica</option>
                        <option value="magic-chime">Magia Chime</option>
                        <option value="dramatic-hit">Low Dramatic Hit</option>
                        <option value="retro-jump">Retro Jump</option>
                      </select>
                      
                      <button
                        type="button"
                        onClick={() => handleTestSound(activePanel.soundEffectPreset)}
                        disabled={activePanel.soundEffectPreset === "none"}
                        className="p-1 px-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 disabled:opacity-30 transition"
                        title="Ascolta suono"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                      Testo Onomatopea
                    </label>
                    <input
                      type="text"
                      value={activePanel.soundEffectText}
                      onChange={(e) => handleUpdatePanel({ ...activePanel, soundEffectText: e.target.value })}
                      placeholder="Es. POW! BAM!"
                      className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Interactive Tabs for Character Placement & Dialogue Balloon details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-800/80">
              
              {/* Panel Character placements toggle and customizations */}
              <div className="space-y-3.5">
                <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-xl">
                  <h4 className="font-sans font-bold text-xs text-slate-300 flex items-center gap-1.5">
                    <Smile className="w-3.5 h-3.5 text-amber-500" />
                    <span>Personaggi Presenti</span>
                  </h4>
                  <button
                    onClick={onOpenCharacterModal}
                    type="button"
                    className="text-[10px] font-mono text-amber-500 hover:underline flex items-center gap-0.5"
                  >
                    <UserPlus className="w-3 h-3" />
                    Personaggi++
                  </button>
                </div>

                {/* Character roster list */}
                {charactersList.length === 0 ? (
                  <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl text-center text-xs text-slate-500">
                    Nessun personaggio creato. Clicca su Personaggi per crearne uno!
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                    {charactersList.map((char) => {
                      const placement = activePanel.charactersInPanel?.find((c) => c.characterId === char.id);
                      const isPresent = !!placement;

                      return (
                        <div key={char.id} className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isPresent}
                                onChange={() => handleToggleCharacter(char.id)}
                                className="rounded text-amber-500 border-slate-800 focus:ring-0 bg-slate-950 h-3.5 w-3.5"
                              />
                              <img
                                src={char.avatarUrl || null}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="w-5 h-5 rounded object-cover"
                              />
                              <span className="text-xs font-bold text-slate-300">{char.name}</span>
                            </span>
                            <span 
                              className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full border"
                              style={{ color: char.accentColor, borderColor: char.accentColor + '50' }}
                            >
                              {char.role}
                            </span>
                          </label>

                          {/* Render placements settings only when character toggle is checked */}
                          {isPresent && placement && (
                            <div className="pl-5 pt-1 space-y-2 border-l border-slate-800/80">
                              <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div>
                                  <span className="text-[9px] text-slate-500 font-mono block">ESPRESSIONE / POSA:</span>
                                  <select
                                    value={placement.pose}
                                    onChange={(e: any) => handleUpdateCharacterPlacement(char.id, { pose: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300"
                                  >
                                    <option value="Neutral">Neutro</option>
                                    <option value="Happy">Felice</option>
                                    <option value="Angry">Arrabbiato</option>
                                    <option value="Fighting">Combattivo</option>
                                    <option value="Scared">Spaventato</option>
                                    <option value="Surprised">Sorpreso</option>
                                  </select>
                                </div>

                                <div>
                                  <span className="text-[9px] text-slate-500 font-mono block">ANIMAZIONE IN-GAME:</span>
                                  <select
                                    value={placement.animationType}
                                    onChange={(e: any) => handleUpdateCharacterPlacement(char.id, { animationType: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300"
                                  >
                                    <option value="none">Nessuna</option>
                                    <option value="floating">Fluttuante</option>
                                    <option value="bouncing">Saltellante</option>
                                    <option value="pulse">Pulsante</option>
                                    <option value="shaking">Scuotimento</option>
                                  </select>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <div className="flex justify-between text-[8px] font-mono text-slate-500">
                                  <span>POSIZIONE ORIZZONTALE (X):</span>
                                  <span>{placement.positionX}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="5"
                                  max="95"
                                  value={placement.positionX}
                                  onChange={(e) => handleUpdateCharacterPlacement(char.id, { positionX: parseInt(e.target.value) })}
                                  className="w-full h-1 bg-slate-800 accent-amber-500 rounded cursor-pointer"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Speech balloon dialogues customization */}
              <div className="space-y-3.5">
                <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-xl">
                  <h4 className="font-sans font-bold text-xs text-slate-300 flex items-center gap-1.5">
                    <Quote className="w-3.5 h-3.5 text-amber-500" />
                    <span>Nuvolette di Dialogo (Balloons)</span>
                  </h4>
                  <button
                    onClick={handleAddDialog}
                    type="button"
                    className="text-[10px] font-mono text-amber-500 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aggiungi Nuvoletta
                  </button>
                </div>

                {activePanel.dialogs.length === 0 ? (
                  <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl text-center text-xs text-slate-500">
                    Nessun dialogo impostato in questa vignetta. Clicca su Aggiungi Nuvoletta per introdurne una!
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                    {activePanel.dialogs.map((dialog, dIdx) => {
                      return (
                        <div key={dialog.id} className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2 relative group-dialog">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono text-slate-500 uppercase">PARLA:</span>
                            <button
                              onClick={() => handleRemoveDialog(dialog.id)}
                              className="text-rose-400 hover:text-rose-500 text-[10px] font-mono"
                            >
                              Rimuovi
                            </button>
                          </div>                           <div className="grid grid-cols-3 gap-2">
                            {/* Choose speaker */}
                            <select
                              value={dialog.characterId}
                              onChange={(e) => handleUpdateDialog(dIdx, "characterId", e.target.value)}
                              className="col-span-1 text-xs bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-300"
                            >
                              <option value="narrator">Off-Screen</option>
                              {charactersList.map((c) => (
                                <option key={c.id} value={c.id}>{c.name.split(" ")[0]}</option>
                              ))}
                            </select>

                            {/* Dialogue content text */}
                            <input
                              type="text"
                              value={dialog.text}
                              onChange={(e) => handleUpdateDialog(dIdx, "text", e.target.value)}
                              className="col-span-2 text-xs bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200"
                            />
                          </div>

                          {/* Choose bubble type and tail direction */}
                          <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                            <div className="space-y-1">
                              <span className="text-[8px] font-mono text-slate-500 uppercase block">Tipo di Nuvoletta:</span>
                              <select
                                value={dialog.bubbleType || "round"}
                                onChange={(e) => handleUpdateDialog(dIdx, "bubbleType", e.target.value)}
                                className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-slate-300"
                              >
                                <option value="round">💬 Tonda (Standard)</option>
                                <option value="thought">💭 Pensiero (Cloud)</option>
                                <option value="shout">💥 Urlo (Spikey)</option>
                                <option value="whisper">✉️ Sussurro (Dashed)</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[8px] font-mono text-slate-500 uppercase block">Direzione Punta:</span>
                              <select
                                value={dialog.bubbleTail || "bottom"}
                                onChange={(e) => handleUpdateDialog(dIdx, "bubbleTail", e.target.value)}
                                className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-slate-300"
                              >
                                <option value="bottom">👇 Giù (Basso)</option>
                                <option value="left">👈 Sinistra</option>
                                <option value="right">👉 Destra</option>
                                <option value="top">👆 Su (Alto)</option>
                                <option value="none">❌ Nessuna</option>
                              </select>
                            </div>
                          </div>

                          {/* Coordinates adjustment sliders */}
                          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/60">
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-[8px] font-mono text-slate-500">
                                <span>POSIZIONE X:</span>
                                <span>{dialog.positionX}%</span>
                              </div>
                              <input
                                type="range"
                                min="10"
                                max="90"
                                value={dialog.positionX}
                                onChange={(e) => handleUpdateDialog(dIdx, "positionX", parseInt(e.target.value))}
                                className="w-full h-1 bg-slate-850 accent-amber-550 rounded cursor-pointer"
                              />
                            </div>

                            <div className="space-y-0.5">
                              <div className="flex justify-between text-[8px] font-mono text-slate-500">
                                <span>POSIZIONE Y:</span>
                                <span>{dialog.positionY}%</span>
                              </div>
                              <input
                                type="range"
                                min="10"
                                max="90"
                                value={dialog.positionY}
                                onChange={(e) => handleUpdateDialog(dIdx, "positionY", parseInt(e.target.value))}
                                className="w-full h-1 bg-slate-850 accent-amber-550 rounded cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <p className="text-sm text-slate-400">Seleziona una vignetta nel menù di sinistra per sbloccare la postazione di disegno.</p>
          </div>
        )}
      </div>
    </div>
  );
}
