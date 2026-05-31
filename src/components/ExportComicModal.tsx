/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Comic, Character, Panel } from "../types";
import { 
  X, FileText, Download, Printer, Image, CheckCircle, 
  HelpCircle, Sparkles, Loader2, Play, Flame, AlertCircle,
  Smartphone, Share2, BookOpen
} from "lucide-react";

interface ExportComicModalProps {
  isOpen: boolean;
  onClose: () => void;
  comic: Comic;
  charactersList: Character[];
}

export default function ExportComicModal({
  isOpen,
  onClose,
  comic,
  charactersList,
}: ExportComicModalProps) {
  const [activeTab, setActiveTab] = useState<"options" | "pdf" | "jpg" | "social">("options");
  const [isRenderingJpg, setIsRenderingJpg] = useState(false);
  const [renderedPanels, setRenderedPanels] = useState<{ id: string; url: string }[]>([]);
  const [stripJpgUrl, setStripJpgUrl] = useState<string | null>(null);
  const [jpgError, setJpgError] = useState<string | null>(null);
  const [pdfLayoutMode, setPdfLayoutMode] = useState<"visual" | "script">("visual");

  // Cover Page configuration states
  const [includeCover, setIncludeCover] = useState(true);
  const [coverStyle, setCoverStyle] = useState<"classic" | "manga" | "noir" | "modern" | "minimal">("classic");
  const [coverSubtitle, setCoverSubtitle] = useState("Un'opera grafica originale di Comic-Lab");
  const [coverAuthor, setCoverAuthor] = useState("omarmalagrida@gmail.com");
  const [coverImageIndex, setCoverImageIndex] = useState<number>(0);

  // Social Mobile states
  const [isRenderingSocial, setIsRenderingSocial] = useState(false);
  const [socialPanels, setSocialPanels] = useState<{ id: string; url: string }[]>([]);
  const [webtoonStripUrl, setWebtoonStripUrl] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. WORD (.DOC) EXPORTER
  const handleExportToWord = () => {
    let html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>${comic.title}</title>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            line-height: 1.6; 
            color: #1e293b; 
            padding: 30px; 
          }
          h1 { 
            color: #d97706; 
            font-size: 26pt; 
            border-bottom: 3px solid #f59e0b; 
            padding-bottom: 8px; 
            margin-bottom: 8px; 
          }
          .subtitle {
            font-size: 11pt;
            color: #64748b;
            margin-bottom: 30px;
          }
          h2 { 
            color: #334155; 
            font-size: 16pt; 
            margin-top: 25px; 
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
          }
          .synopsis { 
            font-style: italic; 
            color: #475569; 
            font-size: 12pt; 
            margin-bottom: 25px; 
            border-left: 4px solid #f59e0b; 
            padding-left: 15px; 
            background: #fdfbf7;
            padding-top: 10px;
            padding-bottom: 10px;
          }
          .panel { 
            border: 1px solid #cbd5e1; 
            border-radius: 8px; 
            padding: 18px; 
            margin-bottom: 25px; 
            background-color: #f8fafc; 
          }
          .panel-header { 
            font-weight: bold; 
            font-size: 13pt; 
            color: #1e3a8a; 
            border-bottom: 1.5px solid #cbd5e1; 
            padding-bottom: 5px; 
            margin-bottom: 12px; 
          }
          .metadata { 
            font-size: 9.5pt; 
            color: #64748b; 
            margin-bottom: 12px; 
          }
          .description { 
            font-size: 11pt; 
            margin-bottom: 10px; 
          }
          .narration { 
            font-style: italic; 
            background-color: #f1f5f9; 
            padding: 10px 14px; 
            border-radius: 6px; 
            border-left: 3px solid #64748b;
            margin-bottom: 12px; 
            font-size: 10.5pt; 
            color: #334155; 
          }
          .dialogue-item { 
            margin-bottom: 8px; 
            font-size: 11pt; 
            padding-left: 10px;
          }
          .speaker { 
            font-weight: bold; 
            color: #b45309; 
          }
          .onomatopoeia { 
            font-weight: bold; 
            color: #dc2626; 
            font-size: 11pt; 
            text-transform: uppercase; 
            background-color: #fee2e2;
            padding: 1px 5px;
            border-radius: 3px;
          }
          .char-section {
            padding: 10px;
            background: #f1f5f9;
            border-radius: 6px;
            margin-bottom: 15px;
          }
        </style>
      </head>
      <body>
        <h1>${comic.title}</h1>
        <div class="subtitle">
          <b>Data Creazione:</b> ${comic.createdAt} &bull; 
          <b>Stile Grafico:</b> ${comic.style} &bull; 
          <b>Numero Vignette:</b> ${comic.panels.length}
        </div>
        
        <h2>Sinossi e Canovaccio della Storia</h2>
        <div class="synopsis">${comic.description}</div>

        <h2>Cast Personaggi in Scena</h2>
        <div style="margin-bottom: 30px;">
          ${comic.characters.map(charId => {
            const char = charactersList.find(c => c.id === charId);
            if (!char) return "";
            return `
              <div class="char-section">
                <b>${char.name}</b> (${char.role === "Hero" ? "Eroe" : char.role === "Villain" ? "Cattivo" : char.role === "Sidekick" ? "Spalla" : "Neutro"})<br>
                <i>Ruolo & Descrizione di Aspetto:</i> ${char.appearance || char.description || "Nessuno"}
              </div>
            `;
          }).join("")}
        </div>
        
        <h2>Sceneggiatura e Sequenza Vignette</h2>
        ${comic.panels.map((panel, idx) => {
          const dialogsHtml = panel.dialogs.map(d => {
            const char = charactersList.find(c => c.id === d.characterId);
            const speakerName = d.characterId === "narrator" ? "Narratore" : (char?.name || "Personaggio");
            return `<div class="dialogue-item"><span class="speaker">${speakerName}:</span> "${d.text}"</div>`;
          }).join("");

          return `
            <div class="panel">
              <div class="panel-header">VIGNETTA #${idx + 1}</div>
              <div class="metadata">
                <b>Effetto Sonoro Preset:</b> ${panel.soundEffectPreset !== "none" ? panel.soundEffectPreset : "Nessuno"} 
                ${panel.soundEffectText ? `&bull; <b>Onomatopea:</b> ${panel.soundEffectText}` : ""}
              </div>
              <div class="description"><b>Composizione Visiva d'Ambiente:</b> ${panel.sceneDescription}</div>
              ${panel.narrationText ? `<div class="narration"><b>Didascalia del Narratore:</b> "${panel.narrationText}"</div>` : ""}
              ${panel.soundEffectText ? `<div><b>Effetto Grafico:</b> <span class="onomatopoeia">${panel.soundEffectText}</span></div>` : ""}
              ${panel.dialogs.length > 0 ? `
                <div style="margin-top: 12px;">
                  <b>Battute e Dialoghi dei Personaggi:</b>
                  ${dialogsHtml}
                </div>
              ` : ""}
            </div>
          `;
        }).join("")}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${comic.title.replace(/\s+/g, "_")}_sceneggiatura.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper to load image securely into canvas (resolves crossOrigin seamlessly)
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  };

  // 2. COMIC GRID/CELL CANVAS JPG GENERATION (Stitching)
  const handleRenderJpgs = async () => {
    setIsRenderingJpg(true);
    setJpgError(null);
    const tempRendered: { id: string; url: string }[] = [];

    try {
      // Set up individual panel canvases
      for (let idx = 0; idx < comic.panels.length; idx++) {
        const panel = comic.panels[idx];
        const canvas = document.createElement("canvas");
        canvas.width = 960;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        // a) Draw Background Gradient or base fallback first
        const gradient = ctx.createLinearGradient(0, 0, 960, 720);
        if (comic.style === "Noir") {
          gradient.addColorStop(0, "#1e293b");
          gradient.addColorStop(1, "#020617");
        } else if (comic.style === "Superhero") {
          gradient.addColorStop(0, "#b45309");
          gradient.addColorStop(1, "#7c2d12");
        } else if (comic.style === "Watercolor") {
          gradient.addColorStop(0, "#fef3c7");
          gradient.addColorStop(1, "#fde68a");
        } else if (comic.style === "DigitalArt") {
          gradient.addColorStop(0, "#4f46e5");
          gradient.addColorStop(1, "#18181b");
        } else {
          gradient.addColorStop(0, "#0f172a");
          gradient.addColorStop(1, "#020617");
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 960, 720);

        // b) Try loading underlying panel image
        if (panel.imageUrl) {
          try {
            const loadedImg = await loadImage(panel.imageUrl);
            ctx.drawImage(loadedImg, 0, 0, 960, 720);
          } catch (e) {
            console.warn("Could not download cross-origin panel image for canvas render, using styled gradient fallback.", e);
            // Draw cross-border mock overlay
            ctx.lineWidth = 15;
            ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
            ctx.strokeRect(0, 0, 960, 720);
            
            // Text to show styled scenario
            ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
            ctx.font = "italic bold 28px 'Segoe UI', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`[${comic.style} Scene: ${panel.sceneDescription.slice(0, 50)}...]`, 480, 360);
          }
        }

        // c) Draw border of panel in cell comics style
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 14;
        ctx.strokeRect(0, 0, 960, 720);

        // d) Draw characters overlay
        if (panel.charactersInPanel && panel.charactersInPanel.length > 0) {
          for (const placement of panel.charactersInPanel) {
            const char = charactersList.find(c => c.id === placement.characterId);
            if (!char) continue;

            const charPosPercent = placement.positionX || 50;
            const xCoord = (charPosPercent / 100) * 960;
            const yCoord = 420; // Lower third

            // Try loading avatar image
            if (char.avatarUrl && !char.avatarUrl.includes("<svg")) {
              try {
                const charImg = await loadImage(char.avatarUrl);
                ctx.save();
                
                // Draw circular frame or rounded border
                ctx.strokeStyle = char.accentColor || "#f59e0b";
                ctx.lineWidth = 8;
                ctx.shadowColor = "rgba(0,0,0,0.5)";
                ctx.shadowBlur = 15;
                
                // Rounded rect
                const boxW = 140;
                const boxH = 140;
                const boxX = xCoord - 70;
                const boxY = yCoord - 70;
                
                // Draw background box
                ctx.fillStyle = "#1e293b";
                ctx.beginPath();
                ctx.roundRect(boxX, boxY, boxW, boxH, 16);
                ctx.fill();
                ctx.stroke();
                
                // Clip and draw image
                ctx.beginPath();
                ctx.roundRect(boxX, boxY, boxW, boxH, 16);
                ctx.clip();
                ctx.drawImage(charImg, boxX, boxY, boxW, boxH);
                
                ctx.restore();
              } catch (e) {
                // Procedural avatar text circle
                drawProceduralAvatar(ctx, xCoord, yCoord, char);
              }
            } else {
              // Procedural draw for SVG or empty avatar
              drawProceduralAvatar(ctx, xCoord, yCoord, char);
            }

            // Draw character name tag beneath them
            ctx.fillStyle = "#000000";
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 4;
            ctx.font = "bold 20px sans-serif";
            ctx.textAlign = "center";
            const tagX = xCoord;
            const tagY = yCoord + 110;

            ctx.strokeText(char.name, tagX, tagY);
            ctx.fillText(char.name, tagX, tagY);
          }
        }

        // e) Draw Speech bubble dialogs
        if (panel.dialogs && panel.dialogs.length > 0) {
          panel.dialogs.forEach((dialog, dIdx) => {
            const spkPercentX = dialog.positionX || (dIdx === 0 ? 30 : 70);
            const spkPercentY = dialog.positionY || 25;
            
            const balloonX = (spkPercentX / 100) * 960;
            const balloonY = (spkPercentY / 100) * 720;

            const speaker = charactersList.find(c => c.id === dialog.characterId);
            const speakerName = dialog.characterId === "narrator" ? "NARRATORE" : (speaker?.name || "PERSONAGGIO");

            // Measure text
            ctx.font = "bold 16px sans-serif";
            const titleWidth = ctx.measureText(speakerName).width;
            
            ctx.font = "18px sans-serif";
            const words = dialog.text.split(" ");
            const lines: string[] = [];
            let currentLine = "";
            
            // wrap words
            for (let w = 0; w < words.length; w++) {
              let testLine = currentLine + words[w] + " ";
              let testWidth = ctx.measureText(testLine).width;
              if (testWidth > 220 && w > 0) {
                lines.push(currentLine);
                currentLine = words[w] + " ";
              } else {
                currentLine = testLine;
              }
            }
            lines.push(currentLine);

            const balloonW = 260;
            const balloonH = 40 + (lines.length * 24);

            // Draw balloon background & border with multi-style options
            const isThought = dialog.bubbleType === "thought";
            const isShout = dialog.bubbleType === "shout";
            const isWhisper = dialog.bubbleType === "whisper";
            const tailDir = dialog.bubbleTail || "bottom";

            ctx.save();
            ctx.shadowColor = isShout ? "rgba(220,38,38,0.2)" : "rgba(0,0,0,0.25)";
            ctx.shadowBlur = isShout ? 14 : 10;

            if (isShout) {
              ctx.fillStyle = "#fffbeb";
              ctx.strokeStyle = "#dc2626";
              ctx.lineWidth = 5;
            } else if (isWhisper) {
              ctx.fillStyle = "#f8fafc";
              ctx.strokeStyle = "#94a3b8";
              ctx.lineWidth = 3;
              ctx.setLineDash([6, 6]);
            } else {
              ctx.fillStyle = "#ffffff";
              ctx.strokeStyle = "#000000";
              ctx.lineWidth = 4;
            }

            ctx.beginPath();
            if (isThought) {
              ctx.roundRect(balloonX - balloonW / 2, balloonY - balloonH / 2, balloonW, balloonH, 22);
            } else if (isShout) {
              ctx.roundRect(balloonX - balloonW / 2, balloonY - balloonH / 2, balloonW, balloonH, 0); // sharp
            } else {
              ctx.roundRect(balloonX - balloonW / 2, balloonY - balloonH / 2, balloonW, balloonH, 14);
            }
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // Draw pointing tail arrow or cloud thought bubblets
            if (tailDir !== "none") {
              ctx.save();
              ctx.shadowColor = "rgba(0,0,0,0.15)";
              ctx.shadowBlur = 4;

              if (isShout) {
                ctx.fillStyle = "#fffbeb";
                ctx.strokeStyle = "#dc2626";
                ctx.lineWidth = 5;
              } else if (isWhisper) {
                ctx.fillStyle = "#f8fafc";
                ctx.strokeStyle = "#94a3b8";
                ctx.lineWidth = 3;
                ctx.setLineDash([4, 4]);
              } else {
                ctx.fillStyle = "#ffffff";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 4;
              }

              if (isThought) {
                ctx.setLineDash([]);
                ctx.fillStyle = "#ffffff";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 3.5;

                let dot1X = balloonX;
                let dot1Y = balloonY + balloonH / 2 + 10;
                let dot2X = balloonX - 12;
                let dot2Y = balloonY + balloonH / 2 + 20;

                if (tailDir === "left") {
                  dot1X = balloonX - balloonW / 2 - 10;
                  dot1Y = balloonY;
                  dot2X = balloonX - balloonW / 2 - 20;
                  dot2Y = balloonY + 6;
                } else if (tailDir === "right") {
                  dot1X = balloonX + balloonW / 2 + 10;
                  dot1Y = balloonY;
                  dot2X = balloonX + balloonW / 2 + 20;
                  dot2Y = balloonY - 6;
                } else if (tailDir === "top") {
                  dot1X = balloonX;
                  dot1Y = balloonY - balloonH / 2 - 10;
                  dot2X = balloonX + 12;
                  dot2Y = balloonY - balloonH / 2 - 20;
                }

                ctx.beginPath();
                ctx.arc(dot1X, dot1Y, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(dot2X, dot2Y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              } else {
                ctx.beginPath();
                if (tailDir === "left") {
                  ctx.moveTo(balloonX - balloonW / 2 + 3, balloonY - 12);
                  ctx.lineTo(balloonX - balloonW / 2 + 3, balloonY + 12);
                  ctx.lineTo(balloonX - balloonW / 2 - 16, balloonY);
                } else if (tailDir === "right") {
                  ctx.moveTo(balloonX + balloonW / 2 - 3, balloonY - 12);
                  ctx.lineTo(balloonX + balloonW / 2 - 3, balloonY + 12);
                  ctx.lineTo(balloonX + balloonW / 2 + 17, balloonY);
                } else if (tailDir === "top") {
                  ctx.moveTo(balloonX - 12, balloonY - balloonH / 2 + 3);
                  ctx.lineTo(balloonX + 12, balloonY - balloonH / 2 + 3);
                  ctx.lineTo(balloonX, balloonY - balloonH / 2 - 16);
                } else {
                  ctx.moveTo(balloonX - 12, balloonY + balloonH / 2 - 3);
                  ctx.lineTo(balloonX + 12, balloonY + balloonH / 2 - 3);
                  ctx.lineTo(balloonX, balloonY + balloonH / 2 + 16);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
              }
              ctx.restore();
            }

            // Draw speaker name
            ctx.fillStyle = speaker?.accentColor || "#1e3a8a";
            ctx.font = "extrabold 13px sans-serif";
            ctx.fillText(speakerName.toUpperCase(), balloonX - balloonW / 2 + 15, balloonY - balloonH / 2 + 22);

            // Draw dialog lines
            ctx.fillStyle = "#000055";
            ctx.font = "500 16px sans-serif";
            lines.forEach((line, lIdx) => {
              ctx.fillText(line, balloonX - balloonW / 2 + 15, balloonY - balloonH / 2 + 45 + (lIdx * 24));
            });
          });
        }

        // f) Draw rotating Sound Effect flashing label
        if (panel.soundEffectText) {
          ctx.save();
          ctx.translate(800, 100);
          ctx.rotate((15 * Math.PI) / 180);

          // Starburst or flashy yellow box
          ctx.fillStyle = "#facc15"; // Yellow
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 5;
          ctx.fillRect(-100, -35, 200, 70);
          ctx.strokeRect(-100, -35, 200, 70);

          // Onomatopoeia text
          ctx.fillStyle = "#000000";
          ctx.font = "black 32pxImpact, Arial Black, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(panel.soundEffectText.toUpperCase(), 0, 12);
          ctx.restore();
        }

        // g) Draw Narrator bottom caption strip
        if (panel.narrationText) {
          ctx.fillStyle = "rgba(2, 6, 23, 0.95)";
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 4;
          ctx.fillRect(40, 620, 880, 80);
          ctx.strokeRect(40, 620, 880, 80);

          ctx.fillStyle = "#fef08a"; // Soft yellow text
          ctx.font = "italic 500 20px 'Georgia', serif";
          ctx.textAlign = "center";
          ctx.fillText(`"${panel.narrationText}"`, 480, 666);
        }

        // Save data URL of compiled JPEG
        tempRendered.push({
          id: panel.id,
          url: canvas.toDataURL("image/jpeg", 0.95),
        });
      }

      setRenderedPanels(tempRendered);

      // Now create aggregated multi-panel vertical Comic Strip
      const singleStripCanvas = document.createElement("canvas");
      singleStripCanvas.width = 960;
      singleStripCanvas.height = 720 * comic.panels.length + 140; // Space for Header Title card
      const stripCtx = singleStripCanvas.getContext("2d");
      
      if (stripCtx) {
        // Draw Header Title Card at top
        stripCtx.fillStyle = "#020617";
        stripCtx.fillRect(0, 0, 960, 140);

        // Frame
        stripCtx.strokeStyle = "#000000";
        stripCtx.lineWidth = 14;
        stripCtx.strokeRect(0, 0, 960, singleStripCanvas.height);

        // Title text
        stripCtx.fillStyle = "#f59e0b";
        stripCtx.font = "bold 38px 'Segoe UI', sans-serif";
        stripCtx.textAlign = "center";
        stripCtx.fillText(comic.title.toUpperCase(), 480, 60);

        // Description
        stripCtx.fillStyle = "#94a3b8";
        stripCtx.font = "italic 18px 'Segoe UI', sans-serif";
        stripCtx.fillText(comic.description, 480, 105);

        // Stitch rendered panels sequentially
        for (let i = 0; i < tempRendered.length; i++) {
          const loadedPanelImg = await loadImage(tempRendered[i].url);
          stripCtx.drawImage(loadedPanelImg, 0, 140 + (i * 720));
        }

        setStripJpgUrl(singleStripCanvas.toDataURL("image/jpeg", 0.90));
      }

      setActiveTab("jpg");
    } catch (err: any) {
      console.error(err);
      setJpgError("Si è verificato un errore nel caricamento dinamico delle risorse delle vignette. Assicurati che le scene abbiano dei layout validi.");
    } finally {
      setIsRenderingJpg(false);
    }
  };

  // Quick procedural avatar sketch helper
  const drawProceduralAvatar = (ctx: CanvasRenderingContext2D, x: number, y: number, char: Character) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 65, 0, Math.PI * 2);
    ctx.fillStyle = char.accentColor || "#1e3a8a";
    ctx.fill();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 6;
    ctx.stroke();

    // Initials text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char.name.charAt(0).toUpperCase(), x, y);
    ctx.restore();
  };

  const handleDownloadSingleJpg = (url: string, index: number) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${comic.title.replace(/\s+/g, "_")}_Vignetta_${index + 1}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadFullStrip = () => {
    if (!stripJpgUrl) return;
    const a = document.createElement("a");
    a.href = stripJpgUrl;
    a.download = `${comic.title.replace(/\s+/g, "_")}_Striscia_Fumetto_Completa.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadSingleSocialJpg = (url: string, index: number) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${comic.title.replace(/\s+/g, "_")}_Story_Social_Scena_${index + 1}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadWebtoonStrip = () => {
    if (!webtoonStripUrl) return;
    const a = document.createElement("a");
    a.href = webtoonStripUrl;
    a.download = `${comic.title.replace(/\s+/g, "_")}_Striscia_Webtoon_Verticale.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRenderSocialFormat = async () => {
    setIsRenderingSocial(true);
    setSocialError(null);
    const tempSocialStories: { id: string; url: string }[] = [];

    try {
      // Create IG / TikTok Story (9:16) panels
      for (let idx = 0; idx < comic.panels.length; idx++) {
        const panel = comic.panels[idx];
        const canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        // 1. Draw beautiful dark futuristic gradient background
        const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1920);
        bgGrad.addColorStop(0, "#090d16");
        bgGrad.addColorStop(0.5, "#0f172a");
        bgGrad.addColorStop(1, "#020617");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1080, 1920);

        // Grid lines background for tech/creative look
        ctx.strokeStyle = "rgba(245, 158, 11, 0.04)";
        ctx.lineWidth = 1;
        for (let x = 0; x < 1080; x += 60) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 1920);
          ctx.stroke();
        }
        for (let y = 0; y < 1920; y += 60) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(1080, y);
          ctx.stroke();
        }

        // 2. Beautiful Header Card (at top)
        ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
        ctx.fillRect(40, 60, 1000, 140);
        ctx.strokeStyle = "rgba(245, 158, 11, 0.3)";
        ctx.lineWidth = 2;
        ctx.strokeRect(40, 60, 1000, 140);

        // Header Title
        ctx.fillStyle = "#f59e0b";
        ctx.font = "bold 32px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(comic.title.toUpperCase(), 540, 115);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "italic 18px sans-serif";
        ctx.fillText(`Capitolo 1 • Stile ${comic.style}`, 540, 160);

        // Vignetta indicator badge
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.roundRect(470, 220, 140, 40, 8);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText(`SCENA ${idx + 1}/${comic.panels.length}`, 540, 246);

        // 3. Middle region: Panel image drawing (scaled to 1000x750)
        const panelX = 40;
        const panelY = 290;
        const panelW = 1000;
        const panelH = 750;

        // Draw background gradient for panel slot
        const panelBg = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
        panelBg.addColorStop(0, "#1e293b");
        panelBg.addColorStop(1, "#0f172a");
        ctx.fillStyle = panelBg;
        ctx.fillRect(panelX, panelY, panelW, panelH);

        if (panel.imageUrl) {
          try {
            const loadedImg = await loadImage(panel.imageUrl);
            ctx.drawImage(loadedImg, panelX, panelY, panelW, panelH);
          } catch (e) {
            console.warn("CORS error on social panel load, using fallback", e);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.lineWidth = 4;
            ctx.strokeRect(panelX, panelY, panelW, panelH);
          }
        }

        // Draw hard comic frame for panel
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 14;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        // Draw characters overlay (scaled from relative coordinates within 1000x750)
        if (panel.charactersInPanel && panel.charactersInPanel.length > 0) {
          for (const placement of panel.charactersInPanel) {
            const char = charactersList.find(c => c.id === placement.characterId);
            if (!char) continue;

            const charPosPercent = placement.positionX || 50;
            const xCoord = panelX + (charPosPercent / 100) * panelW;
            const yCoord = panelY + 450; // lower half of the panel segment

            // Draw circular avatar with styling
            ctx.save();
            ctx.strokeStyle = char.accentColor || "#f59e0b";
            ctx.lineWidth = 8;
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 15;

            const boxW = 150;
            const boxH = 150;
            const boxX = xCoord - 75;
            const boxY = yCoord - 75;

            ctx.fillStyle = "#1e293b";
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, 18);
            ctx.fill();
            ctx.stroke();

            if (char.avatarUrl && !char.avatarUrl.includes("<svg")) {
              try {
                const charImg = await loadImage(char.avatarUrl);
                ctx.beginPath();
                ctx.roundRect(boxX, boxY, boxW, boxH, 18);
                ctx.clip();
                ctx.drawImage(charImg, boxX, boxY, boxW, boxH);
              } catch (e) {
                // simple procedural backup inside clipping
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 42px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(char.name.charAt(0).toUpperCase(), xCoord, yCoord);
              }
            } else {
              // Procedural initial code
              ctx.fillStyle = "#ffffff";
              ctx.font = "bold 42px sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(char.name.charAt(0).toUpperCase(), xCoord, yCoord);
            }
            ctx.restore();

            // Name label text
            ctx.fillStyle = "#000000";
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 4;
            ctx.font = "bold 22px sans-serif";
            ctx.textAlign = "center";
            ctx.strokeText(char.name, xCoord, yCoord + 115);
            ctx.fillText(char.name, xCoord, yCoord + 115);
          }
        }

        // Draw Dialogue Speech bubbles
        if (panel.dialogs && panel.dialogs.length > 0) {
          panel.dialogs.forEach((dialog, dIdx) => {
            const spkPercentX = dialog.positionX || (dIdx === 0 ? 30 : 70);
            const spkPercentY = dialog.positionY || 25;

            const balloonX = panelX + (spkPercentX / 100) * panelW;
            const balloonY = panelY + (spkPercentY / 100) * panelH;

            const speaker = charactersList.find(c => c.id === dialog.characterId);
            const speakerName = dialog.characterId === "narrator" ? "NARRATORE" : (speaker?.name || "PERSONAGGIO");

            ctx.font = "bold 16px sans-serif";
            const words = dialog.text.split(" ");
            const lines: string[] = [];
            let currentLine = "";

            for (let w = 0; w < words.length; w++) {
              let testLine = currentLine + words[w] + " ";
              let testWidth = ctx.measureText(testLine).width;
              if (testWidth > 220 && w > 0) {
                lines.push(currentLine);
                currentLine = words[w] + " ";
              } else {
                currentLine = testLine;
              }
            }
            lines.push(currentLine);

            const balloonW = 270;
            const balloonH = 45 + (lines.length * 24);

            // Draw balloon background & border with multi-style options
            const isThought = dialog.bubbleType === "thought";
            const isShout = dialog.bubbleType === "shout";
            const isWhisper = dialog.bubbleType === "whisper";
            const tailDir = dialog.bubbleTail || "bottom";

            ctx.save();
            ctx.shadowColor = isShout ? "rgba(220,38,38,0.2)" : "rgba(0,0,0,0.25)";
            ctx.shadowBlur = isShout ? 14 : 10;

            if (isShout) {
              ctx.fillStyle = "#fffbeb";
              ctx.strokeStyle = "#dc2626";
              ctx.lineWidth = 5;
            } else if (isWhisper) {
              ctx.fillStyle = "#f8fafc";
              ctx.strokeStyle = "#94a3b8";
              ctx.lineWidth = 3;
              ctx.setLineDash([6, 6]);
            } else {
              ctx.fillStyle = "#ffffff";
              ctx.strokeStyle = "#000000";
              ctx.lineWidth = 4;
            }

            ctx.beginPath();
            if (isThought) {
              ctx.roundRect(balloonX - balloonW / 2, balloonY - balloonH / 2, balloonW, balloonH, 22);
            } else if (isShout) {
              ctx.roundRect(balloonX - balloonW / 2, balloonY - balloonH / 2, balloonW, balloonH, 0); // sharp
            } else {
              ctx.roundRect(balloonX - balloonW / 2, balloonY - balloonH / 2, balloonW, balloonH, 16);
            }
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // Draw pointing tail arrow or cloud thought bubblets
            if (tailDir !== "none") {
              ctx.save();
              ctx.shadowColor = "rgba(0,0,0,0.15)";
              ctx.shadowBlur = 4;

              if (isShout) {
                ctx.fillStyle = "#fffbeb";
                ctx.strokeStyle = "#dc2626";
                ctx.lineWidth = 5;
              } else if (isWhisper) {
                ctx.fillStyle = "#f8fafc";
                ctx.strokeStyle = "#94a3b8";
                ctx.lineWidth = 3;
                ctx.setLineDash([4, 4]);
              } else {
                ctx.fillStyle = "#ffffff";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 4;
              }

              if (isThought) {
                ctx.setLineDash([]);
                ctx.fillStyle = "#ffffff";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 3.5;

                let dot1X = balloonX;
                let dot1Y = balloonY + balloonH / 2 + 10;
                let dot2X = balloonX - 12;
                let dot2Y = balloonY + balloonH / 2 + 20;

                if (tailDir === "left") {
                  dot1X = balloonX - balloonW / 2 - 10;
                   dot1Y = balloonY;
                   dot2X = balloonX - balloonW / 2 - 20;
                   dot2Y = balloonY + 6;
                } else if (tailDir === "right") {
                  dot1X = balloonX + balloonW / 2 + 10;
                  dot1Y = balloonY;
                  dot2X = balloonX + balloonW / 2 + 20;
                  dot2Y = balloonY - 6;
                } else if (tailDir === "top") {
                  dot1X = balloonX;
                  dot1Y = balloonY - balloonH / 2 - 10;
                  dot2X = balloonX + 12;
                  dot2Y = balloonY - balloonH / 2 - 20;
                }

                ctx.beginPath();
                ctx.arc(dot1X, dot1Y, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(dot2X, dot2Y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              } else {
                ctx.beginPath();
                if (tailDir === "left") {
                  ctx.moveTo(balloonX - balloonW / 2 + 3, balloonY - 12);
                  ctx.lineTo(balloonX - balloonW / 2 + 3, balloonY + 12);
                  ctx.lineTo(balloonX - balloonW / 2 - 16, balloonY);
                } else if (tailDir === "right") {
                  ctx.moveTo(balloonX + balloonW / 2 - 3, balloonY - 12);
                  ctx.lineTo(balloonX + balloonW / 2 - 3, balloonY + 12);
                  ctx.lineTo(balloonX + balloonW / 2 + 17, balloonY);
                } else if (tailDir === "top") {
                  ctx.moveTo(balloonX - 12, balloonY - balloonH / 2 + 3);
                  ctx.lineTo(balloonX + 12, balloonY - balloonH / 2 + 3);
                  ctx.lineTo(balloonX, balloonY - balloonH / 2 - 16);
                } else {
                  ctx.moveTo(balloonX - 12, balloonY + balloonH / 2 - 3);
                  ctx.lineTo(balloonX + 12, balloonY + balloonH / 2 - 3);
                  ctx.lineTo(balloonX, balloonY + balloonH / 2 + 16);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
              }
              ctx.restore();
            }

            // Speak label
            ctx.fillStyle = speaker?.accentColor || "#1e3a8a";
            ctx.font = "extrabold 14px sans-serif";
            ctx.fillText(speakerName.toUpperCase(), balloonX - balloonW / 2 + 15, balloonY - balloonH / 2 + 24);

            // Dialog text lines
            ctx.fillStyle = "#020617";
            ctx.font = "500 17px sans-serif";
            lines.forEach((line, lIdx) => {
              ctx.fillText(line, balloonX - balloonW / 2 + 15, balloonY - balloonH / 2 + 48 + (lIdx * 24));
            });
          });
        }

        // Draw Sound Effect overlay
        if (panel.soundEffectText) {
          ctx.save();
          ctx.translate(panelX + panelW - 140, panelY + 120);
          ctx.rotate((15 * Math.PI) / 180);

          ctx.fillStyle = "#fbbf24";
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 6;
          ctx.fillRect(-110, -40, 220, 80);
          ctx.strokeRect(-110, -40, 220, 80);

          ctx.fillStyle = "#000000";
          ctx.font = "900 36px Impact, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(panel.soundEffectText.toUpperCase(), 0, 14);
          ctx.restore();
        }

        // 4. Narration text: Bottom section formatted for smartphone scrolling
        if (panel.narrationText) {
          const narrBoxY = 1100;
          const narrBoxW = 1000;
          const narrBoxH = 400;

          // Transparent charcoal bubble box
          ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
          ctx.strokeStyle = "rgba(245, 158, 11, 0.25)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(40, narrBoxY, narrBoxW, narrBoxH, 24);
          ctx.fill();
          ctx.stroke();

          // Heading label
          ctx.fillStyle = "#fbbf24";
          ctx.font = "bold 20px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("DIDASCALIA SCENARIO", 540, narrBoxY + 50);

          // Word wrap for Narration Text (up to 860px width)
          ctx.fillStyle = "#f8fafc";
          ctx.font = "italic 32px Georgia, serif";
          const narrWords = panel.narrationText.split(" ");
          const narrLines: string[] = [];
          let currentNarrLine = "";

          for (let w = 0; w < narrWords.length; w++) {
            let testLine = currentNarrLine + narrWords[w] + " ";
            let testWidth = ctx.measureText(testLine).width;
            if (testWidth > 860 && w > 0) {
              narrLines.push(currentNarrLine);
              currentNarrLine = narrWords[w] + " ";
            } else {
              currentNarrLine = testLine;
            }
          }
          narrLines.push(currentNarrLine);

          narrLines.forEach((nLine, nIdx) => {
            ctx.fillText(nLine, 540, narrBoxY + 130 + (nIdx * 48));
          });
        }

        // 5. Very Bottom of Story layout: Social credits
        ctx.fillStyle = "rgba(30, 41, 59, 0.6)";
        ctx.beginPath();
        ctx.roundRect(300, 1560, 480, 160, 16);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SCORRI PER CONTINUARE ➔", 540, 1612);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "16px sans-serif";
        ctx.fillText("Creato con Comic Lab • @omarmalagrida", 540, 1656);

        ctx.fillStyle = "#e2e8f0";
        ctx.font = "14px monospace";
        ctx.fillText("#DigitalComic #SocialStories", 540, 1690);

        tempSocialStories.push({
          id: panel.id,
          url: canvas.toDataURL("image/jpeg", 0.90),
        });
      }

      setSocialPanels(tempSocialStories);

      // Webtoon Vertical Continuous scrolling strip (seamless panels, optimized compact spacing)
      const webtoonCanvas = document.createElement("canvas");
      const gap = 30; // compact padding optimized for mobile scrolling swipe of webtoon
      webtoonCanvas.width = 1000;
      webtoonCanvas.height = (750 + gap) * comic.panels.length + 220; // with of elegant slim header
      const wtCtx = webtoonCanvas.getContext("2d");

      if (wtCtx) {
        // Background
        wtCtx.fillStyle = "#0c111d";
        wtCtx.fillRect(0, 0, 1000, webtoonCanvas.height);

        // Render sleek webtoon title header
        wtCtx.fillStyle = "#000000";
        wtCtx.fillRect(0, 0, 1000, 180);

        wtCtx.textAlign = "center";
        wtCtx.fillStyle = "#ffa116";
        wtCtx.font = "bold 34px sans-serif";
        wtCtx.fillText(comic.title.toUpperCase(), 500, 70);

        wtCtx.fillStyle = "#667085";
        wtCtx.font = "italic 16px sans-serif";
        wtCtx.fillText(`Webtoon Vertical Edition • ${comic.panels.length} Episode Panels`, 500, 115);

        wtCtx.strokeStyle = "rgba(255,161,22,0.15)";
        wtCtx.lineWidth = 1;
        wtCtx.beginPath();
        wtCtx.moveTo(100, 140);
        wtCtx.lineTo(900, 140);
        wtCtx.stroke();

        // Sequential panels
        let currentY = 180;
        for (let i = 0; i < comic.panels.length; i++) {
          const panel = comic.panels[i];
          const canvasSingle = document.createElement("canvas");
          canvasSingle.width = 1000;
          canvasSingle.height = 750;
          const sCtx = canvasSingle.getContext("2d");
          if (sCtx) {
            // Draw background
            sCtx.fillStyle = "#111827";
            sCtx.fillRect(0, 0, 1000, 750);
            
            if (panel.imageUrl) {
              try {
                const img = await loadImage(panel.imageUrl);
                sCtx.drawImage(img, 0, 0, 1000, 750);
              } catch (e) {
                // backup image gradient representation
                const grad = sCtx.createLinearGradient(0, 0, 1000, 750);
                grad.addColorStop(0, "#1f2937");
                grad.addColorStop(1, "#111827");
                sCtx.fillStyle = grad;
                sCtx.fillRect(0, 0, 1000, 750);
              }
            }

            // Draw border
            sCtx.strokeStyle = "#000000";
            sCtx.lineWidth = 12;
            sCtx.strokeRect(0, 0, 1000, 750);

            // Overlay characters
            if (panel.charactersInPanel && panel.charactersInPanel.length > 0) {
              for (const placement of panel.charactersInPanel) {
                const char = charactersList.find(c => c.id === placement.characterId);
                if (!char) continue;
                const xc = (placement.positionX || 50) / 100 * 1000;
                
                // Draw circle avatar placeholder
                sCtx.save();
                sCtx.beginPath();
                sCtx.arc(xc, 500, 65, 0, Math.PI * 2);
                sCtx.fillStyle = char.accentColor || "#f59e0b";
                sCtx.fill();
                sCtx.strokeStyle = "#000000";
                sCtx.lineWidth = 6;
                sCtx.stroke();

                if (char.avatarUrl && !char.avatarUrl.includes("<svg")) {
                  try {
                    const avatar = await loadImage(char.avatarUrl);
                    sCtx.beginPath();
                    sCtx.arc(xc, 500, 65, 0, Math.PI * 2);
                    sCtx.clip();
                    sCtx.drawImage(avatar, xc - 65, 435, 130, 130);
                  } catch (e) {}
                } else {
                  sCtx.fillStyle = "#ffffff";
                  sCtx.font = "bold 32px sans-serif";
                  sCtx.textAlign = "center";
                  sCtx.textBaseline = "middle";
                  sCtx.fillText(char.name.charAt(0).toUpperCase(), xc, 500);
                }
                sCtx.restore();

                sCtx.fillStyle = "#000000";
                sCtx.strokeStyle = "#ffffff";
                sCtx.lineWidth = 4;
                sCtx.font = "bold 20px sans-serif";
                sCtx.textAlign = "center";
                sCtx.strokeText(char.name, xc, 595);
                sCtx.fillText(char.name, xc, 595);
              }
            }

            // Text balloons and narration strip
            if (panel.narrationText) {
              sCtx.fillStyle = "rgba(0, 0, 0, 0.85)";
              sCtx.strokeStyle = "#ffa116";
              sCtx.lineWidth = 3;
              sCtx.fillRect(40, 640, 920, 90);
              sCtx.strokeRect(40, 640, 920, 90);

              sCtx.fillStyle = "#ffeb3b";
              sCtx.font = "italic 500 20px Georgia, serif";
              sCtx.textAlign = "center";
              sCtx.fillText(`"${panel.narrationText}"`, 500, 692);
            }

            // Dialogue balloons
            if (panel.dialogs && panel.dialogs.length > 0) {
              panel.dialogs.forEach((dialog, dIdx) => {
                const bPercentX = dialog.positionX || (dIdx === 0 ? 30 : 70);
                const bPercentY = dialog.positionY || 20;

                const bx = (bPercentX / 100) * 1000;
                const by = (bPercentY / 100) * 750;

                const s = charactersList.find(c => c.id === dialog.characterId);
                const sName = dialog.characterId === "narrator" ? "NARRATORE" : (s?.name || "CHAR");

                sCtx.font = "bold 15px sans-serif";
                const words = dialog.text.split(" ");
                const lines: string[] = [];
                let currLine = "";
                for (let w = 0; w < words.length; w++) {
                  let testL = currLine + words[w] + " ";
                  let testW = sCtx.measureText(testL).width;
                  if (testW > 200 && w > 0) {
                    lines.push(currLine);
                    currLine = words[w] + " ";
                  } else {
                    currLine = testL;
                  }
                }
                lines.push(currLine);

                const bw = 240;
                const bh = 40 + (lines.length * 22);

                // Draw speech bubble background with multi-style options
                const isThought = dialog.bubbleType === "thought";
                const isShout = dialog.bubbleType === "shout";
                const isWhisper = dialog.bubbleType === "whisper";
                const tailDir = dialog.bubbleTail || "bottom";

                sCtx.save();
                sCtx.shadowColor = isShout ? "rgba(220,38,38,0.2)" : "rgba(0,0,0,0.25)";
                sCtx.shadowBlur = isShout ? 14 : 10;

                if (isShout) {
                  sCtx.fillStyle = "#fffbeb";
                  sCtx.strokeStyle = "#dc2626";
                  sCtx.lineWidth = 5;
                } else if (isWhisper) {
                  sCtx.fillStyle = "#f8fafc";
                  sCtx.strokeStyle = "#94a3b8";
                  sCtx.lineWidth = 3;
                  sCtx.setLineDash([5, 5]);
                } else {
                  sCtx.fillStyle = "#ffffff";
                  sCtx.strokeStyle = "#000000";
                  sCtx.lineWidth = 4;
                }

                sCtx.beginPath();
                if (isThought) {
                  sCtx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 22);
                } else if (isShout) {
                  sCtx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 0); // sharp corner
                } else {
                  sCtx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 14);
                }
                sCtx.fill();
                sCtx.stroke();
                sCtx.restore();

                // Draw pointing tail arrow or cloud thought bubblets
                if (tailDir !== "none") {
                  sCtx.save();
                  sCtx.shadowColor = "rgba(0,0,0,0.15)";
                  sCtx.shadowBlur = 4;

                  if (isShout) {
                    sCtx.fillStyle = "#fffbeb";
                    sCtx.strokeStyle = "#dc2626";
                    sCtx.lineWidth = 5;
                  } else if (isWhisper) {
                    sCtx.fillStyle = "#f8fafc";
                    sCtx.strokeStyle = "#94a3b8";
                    sCtx.lineWidth = 3;
                    sCtx.setLineDash([4, 4]);
                  } else {
                    sCtx.fillStyle = "#ffffff";
                    sCtx.strokeStyle = "#000000";
                    sCtx.lineWidth = 4;
                  }

                  if (isThought) {
                    sCtx.setLineDash([]);
                    sCtx.fillStyle = "#ffffff";
                    sCtx.strokeStyle = "#000000";
                    sCtx.lineWidth = 3.5;

                    let dot1X = bx;
                    let dot1Y = by + bh / 2 + 10;
                    let dot2X = bx - 12;
                    let dot2Y = by + bh / 2 + 20;

                    if (tailDir === "left") {
                      dot1X = bx - bw / 2 - 10;
                      dot1Y = by;
                      dot2X = bx - bw / 2 - 20;
                      dot2Y = by + 6;
                    } else if (tailDir === "right") {
                      dot1X = bx + bw / 2 + 10;
                      dot1Y = by;
                      dot2X = bx + bw / 2 + 20;
                      dot2Y = by - 6;
                    } else if (tailDir === "top") {
                      dot1X = bx;
                      dot1Y = by - bh / 2 - 10;
                      dot2X = bx + 12;
                      dot2Y = by - bh / 2 - 20;
                    }

                    sCtx.beginPath();
                    sCtx.arc(dot1X, dot1Y, 8, 0, Math.PI * 2);
                    sCtx.fill();
                    sCtx.stroke();

                    sCtx.beginPath();
                    sCtx.arc(dot2X, dot2Y, 5, 0, Math.PI * 2);
                    sCtx.fill();
                    sCtx.stroke();
                  } else {
                    sCtx.beginPath();
                    if (tailDir === "left") {
                      sCtx.moveTo(bx - bw / 2 + 3, by - 12);
                      sCtx.lineTo(bx - bw / 2 + 3, by + 12);
                      sCtx.lineTo(bx - bw / 2 - 16, by);
                    } else if (tailDir === "right") {
                      sCtx.moveTo(bx + bw / 2 - 3, by - 12);
                      sCtx.lineTo(bx + bw / 2 - 3, by + 12);
                      sCtx.lineTo(bx + bw / 2 + 17, by);
                    } else if (tailDir === "top") {
                      sCtx.moveTo(bx - 12, by - bh / 2 + 3);
                      sCtx.lineTo(bx + 12, by - bh / 2 + 3);
                      sCtx.lineTo(bx, by - bh / 2 - 16);
                    } else {
                      sCtx.moveTo(bx - 12, by + bh / 2 - 3);
                      sCtx.lineTo(bx + 12, by + bh / 2 - 3);
                      sCtx.lineTo(bx, by + bh / 2 + 16);
                    }
                    sCtx.closePath();
                    sCtx.fill();
                    sCtx.stroke();
                  }
                  sCtx.restore();
                }

                sCtx.fillStyle = s?.accentColor || "#1e3a8a";
                sCtx.font = "extrabold 12px sans-serif";
                sCtx.fillText(sName.toUpperCase(), bx - bw / 2 + 15, by - bh / 2 + 20);

                sCtx.fillStyle = "#020617";
                sCtx.font = "500 15px sans-serif";
                lines.forEach((l, li) => {
                  sCtx.fillText(l, bx - bw / 2 + 15, by - bh / 2 + 40 + (li * 22));
                });
              });
            }

            // Draw sound effect
            if (panel.soundEffectText) {
              sCtx.save();
              sCtx.translate(850, 110);
              sCtx.rotate(15 * Math.PI / 180);
              sCtx.fillStyle = "#facc15";
              sCtx.strokeStyle = "#000000";
              sCtx.lineWidth = 4;
              sCtx.fillRect(-80, -25, 160, 50);
              sCtx.strokeRect(-80, -25, 160, 50);
              sCtx.fillStyle = "#000000";
              sCtx.font = "900 24px Impact, sans-serif";
              sCtx.textAlign = "center";
              sCtx.fillText(panel.soundEffectText.toUpperCase(), 0, 8);
              sCtx.restore();
            }

            const panelImg = await loadImage(canvasSingle.toDataURL("image/jpeg", 0.95));
            wtCtx.drawImage(panelImg, 0, currentY);
            currentY += 750 + gap;
          }
        }

        // Draw webtoon footer
        wtCtx.fillStyle = "#000000";
        wtCtx.fillRect(0, currentY - gap, 1000, 100);
        wtCtx.fillStyle = "#667085";
        wtCtx.font = "bold 16px sans-serif";
        wtCtx.textAlign = "center";
        wtCtx.fillText("FINISH STORY • SHARE WITH YOUR FRIENDS", 500, currentY + 30);
        wtCtx.fillText("Mangled by Comic Lab Platform", 500, currentY + 60);

        setWebtoonStripUrl(webtoonCanvas.toDataURL("image/jpeg", 0.90));
      }

      setActiveTab("social");
    } catch (err: any) {
      console.error(err);
      setSocialError("Errore durante la compilazione del formato social. Assicurati che le risorse delle vignette siano caricate correttamente.");
    } finally {
      setIsRenderingSocial(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto w-full">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col my-6">
        
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-yellow-500/10 rounded-xl text-yellow-500 border border-yellow-500/10">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-sans font-black text-lg text-slate-100">Esporta la tua Opera</h3>
              <p className="text-xs text-slate-400">Salva il tuo fumetto nei formati standard per lo studio artistico, la stampa o la condivisione</p>
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

        {/* Tab Controls */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-850 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("options")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "options" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Opzioni Esportazione
          </button>
          <button
            onClick={() => setActiveTab("pdf")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "pdf" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Anteprima & Stampa PDF
          </button>
          {renderedPanels.length > 0 && (
            <button
              onClick={() => setActiveTab("jpg")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "jpg" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Galleria JPG Tradizionali ({renderedPanels.length})
            </button>
          )}
          <button
            onClick={() => {
              if (socialPanels.length === 0) {
                handleRenderSocialFormat();
              } else {
                setActiveTab("social");
              }
            }}
            disabled={isRenderingSocial}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "social" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-slate-400 hover:text-white"
            }`}
          >
            {isRenderingSocial ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Elaborazione Social...
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                Striscia Social Mobile ({socialPanels.length > 0 ? socialPanels.length : "Genera"})
              </>
            )}
          </button>
        </div>

        {/* Content Tabs */}
        <div className="p-6 overflow-y-auto max-h-[64vh] space-y-6">
          
          {activeTab === "options" && (
            <div className="space-y-6">
              <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl flex items-center gap-4">
                <div className="flex-1">
                  <span className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-widest block mb-0.5">STATISTICHE PROGETTO</span>
                  <h4 className="text-sm font-bold text-slate-200">{comic.title}</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Stile grafico <strong>{comic.style}</strong> basato su <strong>{comic.panels.length} vignette</strong> di avventura e storie personalizzate.
                  </p>
                </div>
              </div>

              {/* Grid export types selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. PDF PRINT BUTTON CARD */}
                <div className="bg-slate-950 border border-slate-850 hover:border-slate-800 p-5 rounded-xl flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-lg flex items-center justify-center">
                      <Printer className="w-5 h-5" />
                    </div>
                    <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider">Esporta in PDF</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Genera una stupenda impaginazione pronta per essere salvata come PDF o stampata direttamente su carta ordinata in formato A4.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("pdf")}
                    type="button"
                    className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 capitalize"
                  >
                    <Play className="w-3 h-3 text-amber-500" />
                    Anteprima PDF
                  </button>
                </div>

                {/* 2. WORDS / DOC BUTTON CARD */}
                <div className="bg-slate-950 border border-slate-850 hover:border-slate-800 p-5 rounded-xl flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider">Esporta in Word</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Scarica il canovaccio testuale, le onomatopee e i singoli dialoghi trascritti in un file .DOC editabile in Microsoft Word.
                    </p>
                  </div>
                  <button
                    onClick={handleExportToWord}
                    type="button"
                    className="w-full py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg text-xs font-bold transition border border-blue-500/20 flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Scarica File .DOC
                  </button>
                </div>

                {/* 3. JPG STITCH BUTTON CARD */}
                <div className="bg-slate-950 border border-slate-850 hover:border-slate-800 p-5 rounded-xl flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center">
                      <Image className="w-5 h-5" />
                    </div>
                    <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider">Esporta in JPG</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Elabora le tue vignette e uniscile in una striscia grafica composita unica ad alta risoluzione pronta per la stampa o file d'archivio.
                    </p>
                  </div>
                  <button
                    onClick={handleRenderJpgs}
                    disabled={isRenderingJpg}
                    type="button"
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-slate-950 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5"
                  >
                    {isRenderingJpg ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Rendering...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Compila & Sblocca JPG
                      </>
                    )}
                  </button>
                </div>

                {/* 4. SOCIAL & STORIES COMPILER CARD */}
                <div className="bg-slate-950 border border-[#b45309]/30 hover:border-[#b45309]/50 p-5 rounded-xl flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-lg flex items-center justify-center">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider">Striscia Social & Story (9:16)</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Genera pannelli personalizzati in formato verticale 9:16 per Instagram, TikTok o WhatsApp, e un formato Webtoon a scorrimento verticale.
                    </p>
                  </div>
                  <button
                    onClick={handleRenderSocialFormat}
                    disabled={isRenderingSocial}
                    type="button"
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5"
                  >
                    {isRenderingSocial ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Generazione...
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-3.5 h-3.5" />
                        Compila Formato Social
                      </>
                    )}
                  </button>
                </div>

              </div>

              {/* Support info note */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex gap-3 items-start text-xs text-slate-400 leading-relaxed">
                <HelpCircle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <h6 className="font-bold text-slate-300">Come funziona la conversione d'immagini?</h6>
                  <p className="mt-0.5">
                    Il compilatore grafico di Comic Lab analizza i metadati descrittivi, le posizioni dei personaggi, le nuvolette dei fumetti, i raccordi onomatopeici e i didascalici del narratore e genera dei dipinti JPG rasterizzati completi direttamente in memoria.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PDF Tab Preview & Browser Native Print triggers */}
          {activeTab === "pdf" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-950 p-4 rounded-xl border border-slate-850 gap-4">
                <div className="text-xs text-slate-400">
                  Scegli il layout ideale, poi premi <strong>"Avvia Stampa"</strong>. Se desideri un file locale, seleziona la stampante virtuale <strong>"Salva come PDF"</strong> nelle opzioni di stampa del browser.
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg transition uppercase flex items-center gap-1.5 shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Avvia Stampa / PDF
                </button>
              </div>

              {/* Layout Mode Switcher */}
              <div className="flex gap-4 p-2 bg-slate-950/60 rounded-xl border border-slate-850 justify-center select-none">
                <button
                  type="button"
                  onClick={() => setPdfLayoutMode("visual")}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition border flex items-center justify-center gap-1.5 ${
                    pdfLayoutMode === "visual"
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30 font-extrabold"
                      : "text-slate-400 hover:text-white border-transparent"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Tavola Grafica (Formato Fumetto)
                </button>
                <button
                  type="button"
                  onClick={() => setPdfLayoutMode("script")}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition border flex items-center justify-center gap-1.5 ${
                    pdfLayoutMode === "script"
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30 font-extrabold"
                      : "text-slate-400 hover:text-white border-transparent"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  Sceneggiatura (Formato Script)
                </button>
              </div>

              {/* Opzioni Copertina d'Inizio (Pagina 1) */}
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-slate-200">Opzioni Copertina d'Inizio (Pagina 1)</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Abilita Copertina</span>
                    <input
                      type="checkbox"
                      checked={includeCover}
                      onChange={(e) => setIncludeCover(e.target.checked)}
                      className="rounded border-slate-800 focus:ring-0 focus:ring-offset-0 accent-amber-500 cursor-pointer"
                    />
                  </label>
                </div>

                {includeCover && (
                  <div className="grid grid-cols-1 md:grid-cols-10 gap-3 pt-2.5 border-t border-slate-800">
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Stile Grafico Cover</label>
                      <select
                        value={coverStyle}
                        onChange={(e) => setCoverStyle(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-amber-500/40 cursor-pointer"
                      >
                        <option value="classic">Classico Moderno</option>
                        <option value="manga">Manga Accent</option>
                        <option value="noir">Vintage Noir</option>
                        <option value="modern">Minimal Tech</option>
                        <option value="minimal">Solo Testo Elegante</option>
                      </select>
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Sottotitolo / Didascalia</label>
                      <input
                        type="text"
                        value={coverSubtitle}
                        onChange={(e) => setCoverSubtitle(e.target.value)}
                        placeholder="Es: Un'opera grafica originale di Comic-Lab"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:border-amber-500/40"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Autore / Firma</label>
                      <input
                        type="text"
                        value={coverAuthor}
                        onChange={(e) => setCoverAuthor(e.target.value)}
                        placeholder="Inserisci il tuo nome"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:border-amber-500/40"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Tavola per Poster</label>
                      <select
                        value={coverImageIndex}
                        onChange={(e) => setCoverImageIndex(parseInt(e.target.value))}
                        disabled={comic.panels.length === 0}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-amber-500/40 cursor-pointer disabled:opacity-45"
                      >
                        {comic.panels.map((p, idx) => (
                          <option key={p.id} value={idx}>
                            Tavola #{idx + 1}
                          </option>
                        ))}
                        {comic.panels.length === 0 && <option value={0}>Nessuna Tavola</option>}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Actual paper layout rendering preview */}
              <div id="print-storyboard-layout" className="bg-white text-slate-950 p-8 rounded-xl space-y-6 max-h-[46vh] overflow-y-auto shadow-inner">
                
                {/* Copertina iniziale reale (Cover Page) */}
                {includeCover && (
                  <div className="print-page-break print-avoid-break mb-12 pb-12 border-b-4 border-slate-950 flex flex-col justify-between min-h-[640px] bg-slate-55 p-6 sm:p-10 rounded-3xl relative overflow-hidden shadow-sm">
                    {/* Artistic pattern overlays depending on style */}
                    {coverStyle === "manga" && (
                      <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:12px_12px] opacity-25 pointer-events-none" />
                    )}
                    {coverStyle === "noir" && (
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/5 to-transparent pointer-events-none border-l-8 border-slate-950" />
                    )}
                    {coverStyle === "modern" && (
                      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                    )}

                    <div className="text-center relative z-10">
                      <div className="inline-block bg-slate-900 text-amber-400 font-mono text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-slate-950">
                        {coverStyle === "manga" ? "MANGA GRAPHIC NOVEL" : 
                         coverStyle === "noir" ? "DETECTIVE NOIR CLASSIC" : 
                         coverStyle === "modern" ? "MODERN COMICS INDIE SPECIAL" : "OPERA GRAFICA EDITORIALE"}
                      </div>
                      
                      {/* Stylized Title based on coverStyle */}
                      <h1 className={`mt-6 font-black tracking-tight text-slate-950 uppercase block transition-all duration-300 break-words ${
                        coverStyle === "manga" ? "text-5xl font-mono border-4 border-double border-slate-950 p-4 inline-block bg-white shadow-md mx-auto" :
                        coverStyle === "noir" ? "text-4xl font-serif tracking-normal text-left pl-4 border-l-8 border-slate-950" :
                        coverStyle === "modern" ? "text-5xl font-sans tracking-tighter text-slate-950 font-black leading-tight" :
                        coverStyle === "minimal" ? "text-4xl font-serif text-slate-900 border-b border-t border-slate-900 py-6 my-4 tracking-widest font-light" :
                        "text-4xl font-serif text-slate-900 border-b-2 border-slate-950 pb-3"
                      }`}>
                        {comic.title}
                      </h1>

                      <p className="text-xs font-semibold text-slate-500 italic mt-3 font-mono">
                        {coverSubtitle}
                      </p>
                    </div>

                    {/* Central Hero/Poster Artwork */}
                    {coverStyle !== "minimal" && comic.panels[coverImageIndex]?.imageUrl ? (
                      <div className={`my-6 max-w-sm mx-auto aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl relative border-4 ${
                        coverStyle === "manga" ? "border-slate-950 rounded-none shadow-none grayscale" :
                        coverStyle === "noir" ? "border-slate-900 rounded-lg sepia" :
                        "border-white shadow-xl"
                      }`}>
                        <img 
                          src={comic.panels[coverImageIndex]?.imageUrl} 
                          alt="Cover Poster Artwork" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-2 text-center pointer-events-none">
                          <span className="text-[9px] text-yellow-400 font-mono font-bold uppercase tracking-widest block">
                            Tavola Illustrativa Poster
                          </span>
                        </div>
                      </div>
                    ) : (
                      // Minimal elegant decorative symbol
                      <div className="my-10 flex flex-col items-center justify-center space-y-4">
                        <div className="w-12 h-0.5 bg-slate-950" />
                        <Sparkles className="w-8 h-8 text-amber-500" />
                        <div className="w-12 h-0.5 bg-slate-950" />
                        <p className="text-xs text-slate-600 font-serif max-w-sm text-center leading-relaxed italic px-4">
                          "{comic.description || "Nessun canovaccio inserito in questa sceneggiatura."}"
                        </p>
                      </div>
                    )}

                    {/* CAST GALLERY: Meet characters included in this comic */}
                    {charactersList.length > 0 && (
                      <div className="border-t border-slate-300 pt-5 mt-4 relative z-10">
                        <span className="text-[10px] font-mono font-black uppercase text-slate-400 text-center block mb-3 tracking-wider">
                          IL CAST DEI PROTAGONISTI
                        </span>
                        <div className="flex flex-wrap justify-center gap-4">
                          {charactersList
                            .filter(char => comic.characters?.includes(char.id) || charactersList.length <= 4)
                            .slice(0, 6)
                            .map((char) => (
                              <div key={char.id} className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                                <div 
                                  className="w-7 h-7 rounded-lg border-2 overflow-hidden bg-slate-100 flex-shrink-0"
                                  style={{ borderColor: char.accentColor }}
                                >
                                  <img src={char.avatarUrl} alt={char.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="text-left">
                                  <p className="text-[10px] font-black text-slate-800 leading-none">{char.name}</p>
                                  <span className="text-[7.5px] text-slate-500 font-mono uppercase tracking-tight block mt-0.5">
                                    {char.role === "Hero" ? "Eroe" : char.role === "Villain" ? "Cattivo" : char.role === "Sidekick" ? "Spalla" : "Cast"}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Footer Meta Credits block */}
                    <div className="border-t-2 border-slate-950 pt-3.5 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 font-mono mt-6 relative z-10 text-center gap-2 uppercase">
                      <div>
                        <span>AUTORE/DOPPIATORE: </span>
                        <strong className="text-slate-950 font-black">{coverAuthor || "AUTORE SCRITTORE"}</strong>
                      </div>
                      <div className="flex gap-3">
                        <span>DATA: {comic.createdAt || "MAGGIO 2026"}</span>
                        <span>•</span>
                        <span>STILE: {comic.style} ({comic.panels.length} TAVOLE)</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-b-4 border-slate-950 pb-3 text-center">
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#d97706]">
                    {pdfLayoutMode === "visual" ? "LIBRO A FUMETTI (OPERA GRAFICA)" : "STORYBOARD OPERA COMPLETA"}
                  </span>
                  <h2 className="text-3xl font-serif font-black tracking-tight text-slate-900 mt-1 uppercase">{comic.title}</h2>
                  <div className="flex justify-center gap-4 text-xs text-slate-500 font-mono mt-2">
                    <span>Creato: {comic.createdAt}</span>
                    <span>•</span>
                    <span>Stile: {comic.style}</span>
                    <span>•</span>
                    <span>Vignette: {comic.panels.length}</span>
                  </div>
                </div>

                <div className="p-4 bg-amber-50/50 border border-amber-200 italic text-sm text-slate-700 leading-relaxed rounded-lg">
                  <strong>Canovaccio Trama:</strong> {comic.description}
                </div>

                {pdfLayoutMode === "script" ? (
                  <>
                    <h3 className="font-serif font-black text-lg text-slate-900 border-b-2 border-slate-900 pb-1 mt-6">SEQUENZA DELLE TAVOLE E SCENEGGIATURA</h3>
                    <div className="space-y-6">
                      {comic.panels.map((p, idx) => {
                        return (
                          <div key={p.id} className="border-2 border-slate-300 p-5 rounded-lg space-y-3 bg-slate-50 print-avoid-break">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                              <span className="text-sm font-bold text-blue-900 tracking-wider">VIGNETTA #{idx + 1}</span>
                              {p.soundEffectPreset !== "none" && (
                                <span className="text-xs font-mono text-slate-500 px-2 py-0.5 bg-slate-200 rounded">Effetto: {p.soundEffectPreset}</span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                              {p.imageUrl && (
                                <div className="md:col-span-4 w-full aspect-[4/3] bg-slate-200 rounded overflow-hidden border">
                                  <img src={p.imageUrl || null} alt="Illustration" className="w-full h-full object-cover" />
                                </div>
                              )}
                              <div className={`${p.imageUrl ? "md:col-span-8" : "md:col-span-12"} space-y-2.5 text-xs text-slate-800`}>
                                <p><strong>Descrizione Immagine:</strong> <span className="text-slate-600 font-mono text-[11px] block bg-white p-1.5 border rounded mt-0.5">{p.sceneDescription}</span></p>
                                
                                {p.narrationText && (
                                  <p className="italic bg-amber-50 p-2 border-l-4 border-amber-400 text-slate-900">
                                    <strong>Voce Fuori Campo:</strong> "{p.narrationText}"
                                  </p>
                                )}

                                {p.soundEffectText && (
                                  <p><strong>Onomatopea:</strong> <span className="bg-red-100 text-red-700 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">{p.soundEffectText}</span></p>
                                )}

                                {p.dialogs && p.dialogs.length > 0 && (
                                  <div className="pt-1.5">
                                    <p className="font-bold text-slate-900 mb-1">Dialoghi:</p>
                                    <div className="space-y-1 bg-white p-2 border rounded">
                                      {p.dialogs.map((dg) => {
                                        const char = charactersList.find(c => c.id === dg.characterId);
                                        const spk = dg.characterId === "narrator" ? "Narratore" : (char?.name || "Personaggio");
                                        return (
                                          <p key={dg.id} className="text-[11px] text-slate-700">
                                            <span className="font-bold text-amber-700" style={{ color: char?.accentColor }}>{spk}:</span> "{dg.text}"
                                          </p>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="font-serif font-black text-lg text-slate-900 border-b-2 border-slate-900 pb-1 mt-6 mb-4">TAVOLE E DISEGNI DEL FUMETTO</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {comic.panels.map((p, idx) => {
                        return (
                          <div key={p.id} className="print-avoid-break flex flex-col space-y-2 border-2 border-slate-950 p-4 rounded-2xl bg-white">
                            <div className="flex justify-between items-center bg-slate-100 p-1.5 px-3 rounded-lg border border-slate-250">
                              <span className="text-xs font-black text-slate-900 tracking-wider">TAVOLA #{idx + 1}</span>
                              <span className="text-[10px] font-mono text-slate-600 italic">Pagina {Math.floor(idx / 2) + 1}</span>
                            </div>

                            {/* Relative canvas container Mock preview */}
                            <div className="aspect-[4/3] bg-slate-950 rounded-xl border-4 border-slate-950 shadow-md relative overflow-hidden select-none">
                              {p.imageUrl ? (
                                <img
                                  src={p.imageUrl || null}
                                  alt="Full representation"
                                  referrerPolicy="no-referrer"
                                  className="absolute inset-0 w-full h-full object-cover select-none z-0"
                                />
                              ) : (
                                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4 text-center select-none">
                                  <span className="text-[11.5px] font-medium text-slate-400 max-w-[150px]">{p.sceneDescription}</span>
                                </div>
                              )}

                              {/* Gradient shadow overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent pointer-events-none z-10" />

                              {/* Character overlays */}
                              <div className="absolute inset-x-0 bottom-10 top-8 flex pointer-events-none px-6 z-20">
                                {p.charactersInPanel?.map((placement) => {
                                  const character = charactersList.find((c) => c.id === placement.characterId);
                                  if (!character) return null;

                                  let classes = "absolute bottom-2 flex flex-col items-center transform -translate-x-1/2";
                                  let style: React.CSSProperties = { left: `${placement.positionX}%` };

                                  return (
                                    <div key={placement.characterId} className={`${classes} scale-[0.8]`} style={style}>
                                      <div 
                                        className={`w-12 h-12 rounded-xl border-2 overflow-hidden bg-slate-900 flex items-center justify-center shadow-md`}
                                        style={{ borderColor: character.accentColor }}
                                      >
                                        <img
                                          src={character.avatarUrl || null}
                                          alt={character.name}
                                          referrerPolicy="no-referrer"
                                          className="w-full h-full object-cover"
                                        />
                                        <span className="absolute bottom-0 inset-x-0 bg-slate-950/90 text-[6px] text-center font-mono py-0.5">
                                          {placement.pose}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Speech balloons inside panel overlay */}
                              <div className="absolute inset-0 z-35 pointer-events-none">
                                {p.dialogs?.map((dialog) => {
                                  const speaker = charactersList.find((c) => c.id === dialog.characterId);
                                  const isNarrator = dialog.characterId === "narrator" || !speaker;

                                  let bubbleStyleClass = "rounded-xl border border-slate-950 bg-white text-slate-950";
                                  if (dialog.bubbleType === "thought") {
                                    bubbleStyleClass = "rounded-[18px] border border-slate-950 border-dashed bg-white shadow-xs text-slate-950";
                                  } else if (dialog.bubbleType === "shout") {
                                    bubbleStyleClass = "rounded-none border border-red-650 outline outline-[1px] outline-slate-950 font-bold skew-x-1 shadow-xs bg-yellow-50 text-slate-950";
                                  } else if (dialog.bubbleType === "whisper") {
                                    bubbleStyleClass = "rounded-md border border-dashed border-slate-400 bg-slate-50 text-slate-650 italic";
                                  }

                                  const tailDir = dialog.bubbleTail || "bottom";
                                  const isThought = dialog.bubbleType === "thought";
                                  const isShout = dialog.bubbleType === "shout";
                                  
                                  const tailBg = isShout ? "bg-yellow-505" : (dialog.bubbleType === "whisper" ? "bg-slate-50" : "bg-white");
                                  const tailBorder = isShout ? "border-red-650" : (dialog.bubbleType === "whisper" ? "border-slate-400 border-dashed" : "border-slate-950");

                                  return (
                                    <div
                                      key={dialog.id}
                                      className={`absolute ${bubbleStyleClass} p-1 text-[8px] font-sans font-medium max-w-[90px] shadow-xs select-none pointer-events-auto leading-tight`}
                                      style={{ 
                                        left: `${dialog.positionX}%`, 
                                        top: `${dialog.positionY}%`,
                                        transform: "translate(-50%, -50%)" 
                                      }}
                                    >
                                      {isNarrator ? (
                                        <div className="bg-amber-600 text-slate-950 px-1 py-0.2 rounded mb-0.5 text-[5px] font-extrabold text-center uppercase tracking-wide">NARRATORE</div>
                                      ) : (
                                        <div className="text-[6px] font-bold text-center block mb-0.5 truncate" style={{ color: speaker?.accentColor }}>
                                          {speaker?.name.split(" ")[0]}
                                        </div>
                                      )}
                                      <p className="truncate block max-w-full text-center text-[7.5px] font-semibold">{dialog.text}</p>

                                      {/* Render tail pointers */}
                                      {!isNarrator && tailDir !== "none" && (
                                        <>
                                          {isThought ? (
                                            <div className={`absolute pointer-events-none flex flex-col items-center gap-0.5 ${
                                              tailDir === "left" ? "right-full -translate-y-1/2 top-1/2 mr-0.5 flex-row" :
                                              tailDir === "right" ? "left-full -translate-y-1/2 top-1/2 ml-0.5 flex-row-reverse" :
                                              tailDir === "top" ? "bottom-full -translate-x-1/2 left-1/2 mb-0.5 flex-col-reverse" :
                                              "top-full -translate-x-1/2 left-1/2 mt-0.5 flex-col"
                                            }`}>
                                              <div className="w-1 h-1 rounded-full bg-white border border-slate-950" />
                                              <div className="w-0.5 h-0.5 rounded-full bg-white border border-slate-950" />
                                            </div>
                                          ) : (
                                            <div 
                                              className={`absolute w-1.5 h-1.5 rotate-45 border-r border-b ${tailBg} ${tailBorder} ${
                                                tailDir === "left" ? "-left-1 top-1/2 -translate-y-1/2 rotate-135" :
                                                tailDir === "right" ? "-right-1 top-1/2 -translate-y-1/2 -rotate-45" :
                                                tailDir === "top" ? "-top-1 left-1/2 -translate-x-1/2 -rotate-135" :
                                                "-bottom-1 left-1/2 -translate-x-1/2"
                                              }`} 
                                            />
                                          )}
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Onomatopoeias */}
                              {p.soundEffectText && (
                                <div 
                                  className="absolute z-40 bg-yellow-400 text-slate-950 font-black px-1.5 py-0.5 text-center border border-black rounded shadow-xs uppercase text-[10px]"
                                  style={{
                                    top: "14%",
                                    right: "12%",
                                    transform: "rotate(12deg)",
                                    fontFamily: "Impact, sans-serif"
                                  }}
                                >
                                  {p.soundEffectText}
                                </div>
                              )}

                              {/* Narration Overlay Bottom bar */}
                              {p.narrationText && (
                                <div className="absolute inset-x-0 bottom-0 bg-slate-950/90 text-[#fef08a] p-1 px-2.5 text-center border-t border-slate-850 pointer-events-none z-20 text-[8px] italic font-serif">
                                  "{p.narrationText}"
                                </div>
                              )}
                            </div>

                            <p className="text-[10px] text-slate-650 italic pl-1 leading-normal pt-1 select-none">
                              <strong>Regia:</strong> {p.sceneDescription.slice(0, 95)}{p.sceneDescription.length > 95 ? "..." : ""}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* JPG Gallery Rendered View */}
          {activeTab === "jpg" && (
            <div className="space-y-6">
              {jpgError && (
                <div className="p-3.5 bg-rose-950/30 border border-rose-900/60 rounded-xl flex gap-2.5 items-start text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{jpgError}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="p-4 bg-emerald-950/20 border border-emerald-900/50 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 block tracking-widest uppercase">STAMPATORE DI STRISCE</span>
                    <h5 className="text-xs font-bold text-slate-200 mt-0.5">La Striscia è Completa ed Elaborata</h5>
                  </div>
                  {stripJpgUrl && (
                    <button
                      onClick={handleDownloadFullStrip}
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-1.5 uppercase tracking-wide"
                    >
                      <Download className="w-4 h-4" />
                      Scarica Striscia Unica JPG
                    </button>
                  )}
                </div>

                {/* Grid of individually downloadable panel images */}
                <h5 className="font-sans font-bold text-xs text-slate-400 tracking-wider uppercase">Vignette Individuali (.jpg)</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderedPanels.map((p, pIdx) => (
                    <div key={p.id} className="bg-slate-950 border border-slate-850 p-3 rounded-xl space-y-3 flex flex-col justify-between">
                      <div className="aspect-[4/3] bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
                        <img src={p.url || null} alt={`Panel ${pIdx + 1}`} className="w-full h-full object-cover hover:scale-105 transition duration-300" />
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1.5">
                        <span className="font-mono text-slate-500 uppercase">Vignetta #{pIdx + 1}</span>
                        <button
                          onClick={() => handleDownloadSingleJpg(p.url, pIdx)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-md hover:text-white transition flex items-center gap-1 text-[11px] font-bold"
                        >
                          <Download className="w-3 h-3" />
                          Scarica JPG
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SOCIAL MOBILE RENDERED VIEW */}
          {activeTab === "social" && (
            <div className="space-y-6">
              {socialError && (
                <div className="p-3.5 bg-rose-950/30 border border-rose-900/60 rounded-xl flex gap-2.5 items-start text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{socialError}</span>
                </div>
              )}

              {/* Title and summary header */}
              <div className="p-4 bg-amber-955/20 border border-amber-900/50 rounded-2xl relative">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-amber-500 block tracking-widest uppercase">FORMATO SMARTPHONE SOCIAL</span>
                    <h4 className="text-sm font-bold text-slate-200 mt-1">Anteprima & Condivisione Mobile</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Ottimizzato per lo scorrimento digitale verticale e proporzioni Story 9:16 ad alto impatto.
                    </p>
                  </div>
                  {webtoonStripUrl && (
                    <button
                      onClick={handleDownloadWebtoonStrip}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg transition uppercase flex items-center gap-1.5 shrink-0 shadow"
                    >
                      <Download className="w-4 h-4" />
                      Download Webtoon Strip
                    </button>
                  )}
                </div>
              </div>

              {/* Visual Split Screen: Smartphone Mockup / Stories Download */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Simulated Smartphone Shell */}
                <div className="md:col-span-5 flex flex-col items-center justify-center">
                  <span className="text-xs text-slate-500 mb-2 font-mono">Simulatore Smartphone (Scorri l'episodio)</span>
                  <div className="w-[280px] h-[520px] bg-slate-950 rounded-[38px] border-[8px] border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
                    
                    {/* Speaker capsule & camera notch notch */}
                    <div className="absolute top-0 inset-x-0 h-5 bg-black z-20 flex justify-center items-center">
                      <div className="w-16 h-3 bg-slate-900 rounded-full flex gap-1 items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-slate-850 rounded-full"></div>
                        <div className="w-6 h-0.5 bg-slate-800 rounded"></div>
                      </div>
                    </div>

                    {/* Time & Battery Status Overlay under notch */}
                    <div className="pt-5 px-5 flex justify-between text-[9px] font-mono text-slate-500 bg-slate-950 select-none z-10 shrink-0">
                      <span>12:00</span>
                      <div className="flex items-center gap-1">
                        <span>● LTE</span>
                        <div className="w-5 h-2.5 border border-slate-700 rounded-sm relative flex items-center px-0.5">
                          <div className="w-full h-full bg-emerald-500 rounded-2xs"></div>
                          <div className="absolute right-[-2.5px] top-[2px] w-0.5 h-1 bg-slate-700 rounded-r-xs"></div>
                        </div>
                      </div>
                    </div>

                    {/* Webtoon Content Window Scrollable stream */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#0c111d] custom-scrollbar scroll-smooth p-2 space-y-2">
                      <div className="text-center py-4 bg-black/60 rounded-md border border-amber-500/10 mb-2 mt-1">
                        <h6 className="text-[11px] font-black tracking-tight text-amber-500 uppercase">{comic.title}</h6>
                        <span className="text-[8px] text-slate-500 uppercase">Capitolo Social</span>
                      </div>

                      {comic.panels.map((p, idx) => {
                        const speakerObj = p.dialogs && p.dialogs[0]?.characterId ? charactersList.find(c => c.id === p.dialogs[0].characterId) : undefined;
                        return (
                          <div key={p.id} className="border border-slate-900 rounded-lg overflow-hidden bg-slate-950 relative">
                            <div className="aspect-[4/3] bg-slate-900 relative">
                              <img src={p.imageUrl || undefined} alt="Panel" className="w-full h-full object-cover" />
                              <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/80 rounded text-[7px] text-white font-mono uppercase">Vignetta #{idx + 1}</span>
                              
                              {p.soundEffectText && (
                                <span className="absolute top-1.5 right-1.5 px-1 py-0.5 bg-yellow-500 text-slate-950 text-[8px] font-black uppercase tracking-wider rounded rotate-6 scale-95 border border-black">
                                  {p.soundEffectText}
                                </span>
                              )}
                            </div>

                            {/* Dialogue list summary on mobile */}
                            {p.dialogs && p.dialogs.length > 0 && (
                              <div className="p-1 px-1.5 bg-slate-900/90 text-[8px] text-slate-300 border-t border-slate-850 space-y-0.5 max-h-[46px] overflow-hidden">
                                {p.dialogs.slice(0, 2).map(dlg => {
                                  const char = charactersList.find(c => c.id === dlg.characterId);
                                  const name = dlg.characterId === "narrator" ? "Narratore" : (char?.name || "Eroe");
                                  return (
                                    <p key={dlg.id} className="truncate">
                                      <span className="font-bold text-amber-500" style={{ color: char?.accentColor }}>{name}:</span> "{dlg.text}"
                                    </p>
                                  );
                                })}
                              </div>
                            )}

                            {/* Narration caption strip */}
                            {p.narrationText && (
                              <div className="p-1 bg-black text-[#fef08a] italic font-serif text-[8.5px] border-t border-slate-900 text-center">
                                "{p.narrationText.slice(0, 48)}..."
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="text-center py-5 text-[8px] text-slate-600 font-mono uppercase">
                        Fine dell'Episodio
                      </div>
                    </div>

                    {/* Bottom pill home bar */}
                    <div className="h-4 bg-black flex justify-center items-center shrink-0 z-10">
                      <div className="w-20 h-1 bg-slate-800 rounded-full"></div>
                    </div>

                  </div>
                </div>

                {/* IG/TikTok Vertical Stories Formato list */}
                <div className="md:col-span-7 space-y-4">
                  <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-850">
                    <div>
                      <h5 className="text-xs font-bold text-slate-100 uppercase tracking-wide">Pannelli Verticali 9:16 per Instagram Stories</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">Le vignette sono state convertite in file video-story pronti per lo swipe.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {socialPanels.map((sp, spIdx) => (
                      <div key={sp.id} className="bg-slate-950 border border-slate-850 p-2.5 rounded-xl space-y-3 flex flex-col justify-between">
                        <div className="aspect-[9/16] max-h-[300px] bg-slate-900 rounded-lg overflow-hidden border border-slate-850 flex items-center justify-center">
                          <img src={sp.url || undefined} alt={`Story slide ${spIdx + 1}`} className="w-full h-full object-contain" />
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="font-mono text-amber-500 font-bold">Story Scena #{spIdx + 1}</span>
                          <button
                            onClick={() => handleDownloadSingleSocialJpg(sp.url, spIdx)}
                            className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 rounded-md transition flex items-center gap-1 text-[10px] font-bold"
                          >
                            <Download className="w-3 h-3" />
                            Scarica
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tips Box */}
                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
                    <span className="font-bold text-slate-200">💡 Suggerimenti per la pubblicazione Social:</span>
                    <p>1. <strong>Webtoon</strong>: Carica la "Striscia Webtoon" verticale sulle piattaforme dedicate Webtoon Canvas o Tapas per lettori mobile.</p>
                    <p>2. <strong>Instagram & TikTok Stories</strong>: Usa le storie 9:16 native del cellulare trascinando i pannelli singoli sfogliabili per creare un carosello avvincente.</p>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-850 flex justify-end gap-3">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 text-xs font-semibold rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            Annulla
          </button>
        </div>

      </div>

      {/* Embedded print container for window.print stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-storyboard-layout, #print-storyboard-layout * {
            visibility: visible;
          }
          #print-storyboard-layout {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0c111d !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Prevent page cutoffs */
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
          .border-2 {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

    </div>
  );
}
