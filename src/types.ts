/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ComicStyleName = "Manga" | "Superhero" | "Cartoon" | "Noir" | "Watercolor" | "DigitalArt";

export interface Character {
  id: string;
  name: string;
  role: "Hero" | "Sidekick" | "Villain" | "Narrator" | "Neutral";
  description: string;
  appearance: string; // Detail explanation for visual generator
  avatarUrl: string; // URL path or base64 data
  accentColor: string; // hex representation
  isPreset?: boolean;
  voiceAudioData?: string; // base64 encoded custom audio clip representing the character voice
  voiceFileName?: string; // name of the uploaded voice clip
  voicePitch?: number; // custom speech pitch
  voiceRate?: number; // custom speech speed rate
  voiceSystemName?: string; // Web Speech voice name
}

export interface PanelCharacterPlacement {
  characterId: string;
  pose: "Neutral" | "Happy" | "Angry" | "Fighting" | "Scared" | "Surprised";
  positionX: number; // 0 to 100 percentage layout position
  scale: number; // e.g., 0.8, 1.0, 1.2
  animationType: "floating" | "bouncing" | "pulse" | "shaking" | "none";
}

export interface PanelDialog {
  id: string;
  characterId: string; // Character ID or "narrator"
  text: string;
  positionX: number; // 0 to 100 percentage layout
  positionY: number; // 0 to 100 percentage layout
  bubbleType?: "round" | "thought" | "shout" | "whisper";
  bubbleTail?: "left" | "right" | "bottom" | "top" | "none";
}

export interface Panel {
  id: string;
  sceneDescription: string; // Prompt for the visual panel
  imageUrl: string; // Resulting panel illustration url or base64
  soundEffectText: string; // Onomatopoeia text, e.g. "SBANG!", "ZAP!"
  soundEffectPreset: "none" | "laser" | "explosion" | "magic-chime" | "dramatic-hit" | "retro-jump";
  narrationText: string; // Off-screen narrator description
  dialogs: PanelDialog[];
  charactersInPanel: PanelCharacterPlacement[];
  speechAudioUrl?: string; // Text to speech base64/URL
}

export interface Comic {
  id: string;
  title: string;
  description: string;
  style: ComicStyleName;
  characters: string[]; // List of character IDs linked to this comic
  panels: Panel[];
  createdAt: string;
}
