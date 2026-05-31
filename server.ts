/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = 3000;

// Serve the stunning Comic Lab PWA logo dynamically at the root URL
app.get("/app_icon.png", (req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), "src/assets/images/app_icon_comic_lab_1780193039364.png"));
});

// Lazy initialization of GoogleGenAI to prevent crashing at startup if the key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

// 1. STORYTELLING BOARD GENERATION ENDPOINT
app.post("/api/generate-storyboard", async (req: Request, res: Response): Promise<void> => {
  const { prompt, currentStyle, characters, panelsCount } = req.body;
  const client = getGeminiClient();

  if (!client) {
    // Graceful fallback when the user has not configured the key
    res.json({
      success: false,
      isDemo: true,
      message: "API Key Gemini non trovata nei Segreti. Utilizzo della modalità Demo locale con generazione ad-hoc.",
      data: generateDemoStoryboard(prompt || "Avventura Spaziale", currentStyle || "Cartoon", characters || [], panelsCount || 4)
    });
    return;
  }

  try {
    const panelsRequested = panelsCount || 4;
    const styleDescription = getStyleInstruction(currentStyle);
    const charactersSummary = characters && characters.length > 0 
      ? characters.map((c: any) => `- ${c.name} (${c.role}): Apparenza: ${c.appearance}. ${c.description}`).join("\n") 
      : "- Nessun personaggio personalizzato fornito (utilizza archetipi adatti alla storia).";

    const systemInstruction = `Sei un esperto sceneggiatore di fumetti. Devi creare una storia coerente in esattamente ${panelsRequested} vignette.
Stile grafico da assecondare: ${currentStyle} (${styleDescription}).

Dati i personaggi messi a disposizione:
${charactersSummary}

Genera la sceneggiatura suddivisa in vignette (panels) in formato JSON rispettando esattamente lo schema richiesto.
Per ogni vignetta (panel) inventa:
1. Una descrizione visiva e suggestiva della scena (da usare come prompt di disegno, es. "Un primo piano del gatto astronauta sorpreso, con stelle fluttuanti e la Terra sullo sfondo").
2. Un testo narrativo (narratore fuorocampo) che descriva l'azione o l'atmosfera.
3. Un preset di effetto sonoro appropriato tra: "none", "laser", "explosion", "magic-chime", "dramatic-hit", "retro-jump".
4. Un breve testo dell'onomatopea correlata (es. "SWOOSH", "ZAP", "BOOM", "DONG" o vuoto se none).
5. Massimi 2 dialoghi tra i personaggi coinvolti. Ciascuno deve contenere l'ID o nome del personaggio (o "narratore") e il testo esatto.

Nota: Fornisci SOLO il JSON corrispondente allo schema indicato, niente frasi di contorno o tag markdown markdown differenti da application/json.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Crea una storia basata su questo spunto: "${prompt}". Crea precisamente e coerentemente ${panelsRequested} vignette collegate.`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "description", "panels"],
          properties: {
            title: { type: Type.STRING, description: "Titolo dinamico della storia creata" },
            description: { type: Type.STRING, description: "Breve descrizione riassuntiva del fumetto" },
            panels: {
              type: Type.ARRAY,
              description: `Lista di esattamente ${panelsRequested} vignette`,
              items: {
                type: Type.OBJECT,
                required: ["sceneDescription", "narrationText", "soundEffectPreset", "soundEffectText", "dialogs"],
                properties: {
                  sceneDescription: { type: Type.STRING, description: "Dettaglio visivo per l'illustrazione della vignetta" },
                  narrationText: { type: Type.STRING, description: "Testo di narrazione/voce fuori campo" },
                  soundEffectPreset: { 
                    type: Type.STRING, 
                    description: "Preset audio associato",
                    enum: ["none", "laser", "explosion", "magic-chime", "dramatic-hit", "retro-jump"]
                  },
                  soundEffectText: { type: Type.STRING, description: "Onomatopea visiva da mostrare, es. CRASH, POW o stringa vuota se nessuno" },
                  dialogs: {
                    type: Type.ARRAY,
                    description: "Dialoghi dei fumetti (max 2)",
                    items: {
                      type: Type.OBJECT,
                      required: ["characterName", "text", "positionX", "positionY"],
                      properties: {
                        characterName: { type: Type.STRING, description: "Nome o ID del personaggio che parla" },
                        text: { type: Type.STRING, description: "Testo racchiuso nella nuvoletta" },
                        positionX: { type: Type.NUMBER, description: "Posizione percentuale orizzontale raccomandata (es. 25 o 75)" },
                        positionY: { type: Type.NUMBER, description: "Posizione percentuale verticale raccomandata (es. 20 o 45)" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text.trim());
    res.json({ success: true, data: parsedData });
  } catch (err: any) {
    console.error("Errore generazione storia:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      demoFallback: generateDemoStoryboard(prompt || "Avventura Spaziale", currentStyle || "Cartoon", characters || [], panelsCount || 4)
    });
  }
});

// 2. CHARACTER AVATAR GENERATION
app.post("/api/generate-character-image", async (req: Request, res: Response): Promise<void> => {
  const { name, appearance, style } = req.body;
  const client = getGeminiClient();

  if (!client) {
    res.json({
      success: false,
      isDemo: true,
      message: "API Key Gemini non trovata. Utilizzo di una bellissima silhouette vettoriale colorata."
    });
    return;
  }

  try {
    const styleInstruction = getStyleInstruction(style);
    const prompt = `Un primo piano del volto/busto del personaggio '${name}'. Apparenza: ${appearance}. Stile del personaggio: ${style} (${styleInstruction}). Icona per fumetto, sfondo neutro pulito a tinta piatta o semplice, colori ricchi, alta qualità artistica.`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    let base64Image = "";
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        base64Image = part.inlineData.data;
        break;
      }
    }

    if (base64Image) {
      res.json({ success: true, imageUrl: `data:image/png;base64,${base64Image}` });
    } else {
      res.json({ success: false, message: "Nessun dato immagine restituito dal modello." });
    }
  } catch (err: any) {
    console.error("Errore generazione avatar personaggio:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. COMIC PANEL GENERATION
app.post("/api/generate-panel-image", async (req: Request, res: Response): Promise<void> => {
  const { sceneDescription, style } = req.body;
  const client = getGeminiClient();

  if (!client) {
    res.json({
      success: false,
      isDemo: true,
      message: "API Key Gemini non trovata. Utilizzo di illustrazioni dinamiche preimpostate."
    });
    return;
  }

  try {
    const styleInstruction = getStyleInstruction(style);
    const prompt = `Una vignetta di un fumetto. Scena descritta: ${sceneDescription}. Stile grafico: ${style} (${styleInstruction}). Inquadratura adatta ad una vignetta di fumetto, composizione cinematografica, colori evocativi del genere, dettagli definiti, NO testi o balloon disegnati.`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "4:3" // Standard comic panel card ratio
        }
      }
    });

    let base64Image = "";
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        base64Image = part.inlineData.data;
        break;
      }
    }

    if (base64Image) {
      res.json({ success: true, imageUrl: `data:image/png;base64,${base64Image}` });
    } else {
      res.json({ success: false, message: "Nessun dato immagine restituito per la vignetta." });
    }
  } catch (err: any) {
    console.error("Errore generazione vignetta:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. TEXT TO SPEECH AUDIO NARRATION
app.post("/api/narrate", async (req: Request, res: Response): Promise<void> => {
  const { text, voice } = req.body; // voice can be Puck, Charon, Kore, Fenrir, Zephyr
  const client = getGeminiClient();

  if (!client) {
    res.json({
      success: false,
      isDemo: true,
      message: "API Key Gemini non configurata per la sintesi vocale."
    });
    return;
  }

  try {
    const selectedVoice = voice || "Kore";
    const prompt = `Leggi espressamente in italiano, in modo coinvolgente da narratore di fumetti: "${text}"`;

    const response = await client.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (base64Audio) {
      res.json({ success: true, audioUrl: `data:audio/wav;base64,${base64Audio}` });
    } else {
      res.json({ success: false, message: "Impossibile ottenere i dati audio." });
    }
  } catch (err: any) {
    console.error("Errore sintesi vocale:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. GET CONFIG/STATUS
app.get("/api/status", (req: Request, res: Response) => {
  const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
  res.json({
    active: true,
    hasGeminiKey: hasKey,
    environment: process.env.NODE_ENV || "development",
    message: hasKey 
      ? "Sistemi AI pronti all'uso per creazioni personalizzate!" 
      : "In esecuzione in modalità dimostrativa intelligente. Per sbloccare la generazione grafica AI ed esperimenti audio con Gemini, configura il segreto GEMINI_API_KEY nei Segreti."
  });
});

// Helper functions for styles
function getStyleInstruction(style: string): string {
  switch (style) {
    case "Manga":
      return "Bianco e nero o colori desaturati con retini tipici dei fumetti giapponesi, forti linee dinamiche, grandi occhi dettagliati ed espressivi, stile anime/manga.";
    case "Superhero":
      return "Linee di contorno nere erculee, ombreggiature piene e decise (stile inchiostrazione americana), colori accesi e saturi di impatto, pose eroiche, stile Marvel/DC moderno.";
    case "Cartoon":
      return "Stile animazione ludico, bordi arrotondati e amichevoli, colori caldi, forme espressive, pulito, divertente ed estremamente colorato.";
    case "Noir":
      return "Forte contrasto chiaroscuro, toni drammatici di grigio o monocromatici, ombre misteriose e pesanti, atmosfere retrò anni '40, angoli di ripresa obliqui.";
    case "Watercolor":
      return "Bordi sfumati ad acquerello artistico, texture della carta da disegno visibile, tonalità pastello rilassanti, tocco caldo, poetico ed editoriale.";
    case "DigitalArt":
      return "Stile concept art digitale moderno, pittura digitale dettagliata 2D/3D con ricche sfumature di colore, effetti di illuminazione soffusa e bagliori luminosi neon vibranti.";
    default:
      return "Stile grafico illustrato pulito e moderno ad alta risoluzione.";
  }
}

// Fallback demo static data generators so the app works instantly with beautiful templates
function generateDemoStoryboard(prompt: string, style: string, characters: any[], panelsCount: number) {
  const actualStyle = style || "Cartoon";
  const char1Name = characters[0]?.name || "Gek il Viaggiatore";
  const char2Name = characters[1]?.name || "Robo-900";

  const presetStories = [
    {
      title: `L'Incredibile Destino di: ${char1Name}`,
      description: `Un racconto avvincente sul superamento dei propri limiti, reso in stile ${actualStyle}.`,
      panels: [
        {
          sceneDescription: `Un'ambientazione misteriosa in stile ${actualStyle} con ${char1Name} che guarda una mappa luccicante sotto una cupola di cristallo.`,
          narrationText: `Tutto ebbe inizio quando ${char1Name} trovò l'antico manufatto nel cuore delle rovine perdute...`,
          soundEffectPreset: "magic-chime",
          soundEffectText: "BZZZ-SHINE!",
          dialogs: [
            { characterName: char1Name, text: "Incredibile... Questa mappa risponde al battito del mio cuore!", positionX: 20, positionY: 20 }
          ]
        },
        {
          sceneDescription: `Una creatura fantastica sbuca improvvisamente da un cespuglio o portale. ${char1Name} indietreggia spaventato.`,
          narrationText: "Ma i segreti della cupola erano protetti da minacce inaspettate.",
          soundEffectPreset: "dramatic-hit",
          soundEffectText: "ROOOAAR!",
          dialogs: [
            { characterName: "Guardiano", text: "Chi osa disturbare la sacra quiete cosmica?!", positionX: 65, positionY: 15 },
            { characterName: char1Name, text: "Ehi, vengo in pace! O quasi...", positionX: 20, positionY: 70 }
          ]
        },
        {
          sceneDescription: `${char1Name} impugna uno strumento magico inventato o tecnologico ed emette un raggio luminoso d'energia.`,
          narrationText: "Senza alcuna via di fuga, decise di affidarsi all'antico caricatore d'energia.",
          soundEffectPreset: "laser",
          soundEffectText: "ZAP!!!",
          dialogs: [
            { characterName: char1Name, text: "Fermati! Guarda la luce della mappa!", positionX: 30, positionY: 25 }
          ]
        },
        {
          sceneDescription: `Il Guardiano e ${char1Name} che camminano insieme sorridenti verso un orizzonte radioso e luminoso.`,
          narrationText: "Invece di combattere, il bagliore illuminò la verità: erano entrambi custodi della stessa missione. Un nuovo capitolo ebbe inizio.",
          soundEffectPreset: "retro-jump",
          soundEffectText: "YEAH!",
          dialogs: [
            { characterName: "Guardiano", text: "La tua determinazione ti fa onore, viaggiamo insieme.", positionX: 55, positionY: 30 },
            { characterName: char1Name, text: "Verso l'infinito!", positionX: 15, positionY: 20 }
          ]
        }
      ]
    }
  ];

  return presetStories[0];
}

// Integrated Vite setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Comic Creator Studio] Server running behind proxy on http://localhost:${PORT}`);
  });
}

startServer();
