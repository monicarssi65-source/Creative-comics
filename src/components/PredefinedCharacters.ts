/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Character } from "../types";

export const PRESET_CHARACTERS: Character[] = [
  {
    id: "char-leo-hero",
    name: "Leonardo 'Scintilla'",
    role: "Hero",
    description: "Un giovane e intraprendente inventore dotato di un guanto fotonico che manipola la luce e l'elettricità. Sempre ottimista e coraggioso.",
    appearance: "Giovane con capelli biondi spettinati, occhi azzurri scintillanti, indossa un gilet arancione lucido e un grande guanto tecnologico luminescente di colore giallo sulla mano destra.",
    avatarUrl: "", // Handled programmatically via stylized placeholder canvas/SVG or AI
    accentColor: "#f59e0b", // Amber/Gold
    isPreset: true
  },
  {
    id: "char-kaelen-villain",
    name: "Comandante Kaelen",
    role: "Villain",
    description: "Ex-scienziato carismatico esiliato dalle province astrali. Vuole assorbire l'energia dei cristalli di stella per alimentare le sue fortezze volanti.",
    appearance: "Uomo slanciato e austero, lunghi capelli d'argento raccolti, occhi violetti freddi, indossa un mantello di velluto nero-viola con ricami metallici e un'armatura cibernetica futuristica.",
    avatarUrl: "",
    accentColor: "#8b5cf6", // Indigo/Purple
    isPreset: true
  },
  {
    id: "char-zoe-sidekick",
    name: "Zoe la Hacker",
    role: "Sidekick",
    description: "Genio dei computer e della meccanica quantistica. Può sintonizzarsi su qualsiasi frequenza e hackerare droni nemici con occhiali speciali.",
    appearance: "Ragazza vulcanica con occhiali tondi montatura verde fluo, capelli corti tinti di verde acqua, indossa stampati cybertech e cuffie al collo, sorriso arguto.",
    avatarUrl: "",
    accentColor: "#10b981", // Emerald/Teal
    isPreset: true
  },
  {
    id: "char-kronos-neutral",
    name: "A.R.E.S. 'Robo-900'",
    role: "Neutral",
    description: "Un droide custode risvegliatosi da un sonno millenario. Parla in modo formale ed è ossessionato dal riordinare l'universo e mantenere il tempo esatto.",
    appearance: "Un robot lucido in bronzo anticato e ottone, occhi a LED azzurri e rotondi, ingranaggi visibili sul petto trasparente protetto da vetro temperato, braccio telescopico.",
    avatarUrl: "",
    accentColor: "#06b6d4", // Cyan
    isPreset: true
  },
  {
    id: "char-luna-narrator",
    name: "Sacerdotessa Luna",
    role: "Narrator",
    description: "Saggia custode degli antichi codici della galassia. Vede passato, presente e futuro tessuti nelle stelle cadenti.",
    appearance: "Donna solenne avvolta in drappeggi blu notte costellati di punti luminosi, capelli lunghissimi blu argento fluttuanti come nell'acqua, indossa un copricapo d'oro a forma di mezzaluna.",
    avatarUrl: "",
    accentColor: "#ec4899", // Pink/Fuchsia
    isPreset: true
  }
];

// Helper to render beautiful vector-designed preset avatar in case AI generation is pending or key isn't provided
export function getCharacterAvatarSvg(character: Character): string {
  const color = character.accentColor;
  const initial = character.name.charAt(0);
  
  // Return an inline data URI SVG that matches the character's style
  let svgContent = "";
  if (character.id === "char-leo-hero") {
    svgContent = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="grad-leo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="100%" stop-color="#ea580c"/>
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#grad-leo)"/>
      <circle cx="50" cy="45" r="22" fill="#fff" opacity="0.9"/>
      <circle cx="45" cy="42" r="3" fill="#0ea5e9"/>
      <circle cx="55" cy="42" r="3" fill="#0ea5e9"/>
      <path d="M 40 52 Q 50 60 60 52" stroke="#ea580c" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M 33 28 L 50 40 L 67 28 L 50 20 Z" fill="#ef4444" opacity="0.8"/>
      <!-- Lightning hair -->
      <path d="M 35 28 L 45 15 L 50 28 L 60 12 L 65 30" stroke="#facc15" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="50" cy="45" r="25" stroke="#fff" stroke-width="2" fill="none" opacity="0.4"/>
    </svg>`;
  } else if (character.id === "char-kaelen-villain") {
    svgContent = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-kaelen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e1b4b"/>
          <stop offset="100%" stop-color="#6b21a8"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#grad-kaelen)"/>
      <polygon points="50,15 78,50 50,85 22,50" fill="#a21caf" opacity="0.3"/>
      <!-- Cyber hood/face -->
      <circle cx="50" cy="42" r="18" fill="#111827"/>
      <path d="M 45 42 L 48 45 L 42 45 Z" fill="#d946ef"/>
      <path d="M 55 42 L 52 45 L 58 45 Z" fill="#d946ef"/>
      <!-- Glowing mouth/line -->
      <path d="M 44 50 L 56 50" stroke="#d946ef" stroke-width="2" stroke-linecap="round"/>
      <path d="M 25 20 L 50 5 L 75 20" stroke="#c084fc" stroke-width="2" fill="none"/>
    </svg>`;
  } else if (character.id === "char-zoe-sidekick") {
    svgContent = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="grad-zoe" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#a7f3d0"/>
          <stop offset="100%" stop-color="#047857"/>
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#grad-zoe)"/>
      <!-- Face -->
      <circle cx="50" cy="45" r="20" fill="#fff" opacity="0.95"/>
      <!-- Glasses -->
      <circle cx="42" cy="44" r="7" stroke="#10b981" stroke-width="3" fill="none"/>
      <circle cx="58" cy="44" r="7" stroke="#10b981" stroke-width="3" fill="none"/>
      <line x1="49" y1="44" x2="51" y2="44" stroke="#10b981" stroke-width="3"/>
      <!-- Smile -->
      <path d="M 45 54 Q 50 60 55 54" stroke="#047857" stroke-width="2" fill="none"/>
      <!-- Green spiky hair -->
      <path d="M 30 40 Q 28 20 40 25 Q 50 15 60 25 Q 72 20 70 40" stroke="#059669" stroke-width="4" stroke-linecap="round" fill="none"/>
    </svg>`;
  } else if (character.id === "char-kronos-neutral") {
    svgContent = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-kronos" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#0891b2"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#grad-kronos)"/>
      <!-- Clockwork teeth -->
      <circle cx="50" cy="45" r="22" stroke="#e2e8f0" stroke-width="1" fill="#334155"/>
      <!-- Robot Head -->
      <rect x="36" y="32" width="28" height="26" rx="4" fill="#94a3b8" stroke="#cbd5e1" stroke-width="2"/>
      <circle cx="43" cy="42" r="4" fill="#22d3ee"/>
      <circle cx="57" cy="42" r="4" fill="#22d3ee"/>
      <rect x="42" y="50" width="16" height="3" rx="1" fill="#1e293b"/>
      <!-- Antenna -->
      <line x1="50" y1="32" x2="50" y2="22" stroke="#cbd5e1" stroke-width="2"/>
      <circle cx="50" cy="21" r="3" fill="#06b6d4"/>
    </svg>`;
  } else if (character.id === "char-luna-narrator") {
    svgContent = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="grad-luna" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fbcfe8"/>
          <stop offset="100%" stop-color="#db2777"/>
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#grad-luna)"/>
      <circle cx="50" cy="45" r="21" fill="#fff" opacity="0.9"/>
      <path d="M 43 45 Q 50 35 57 45" stroke="#db2777" stroke-width="2" fill="none"/>
      <!-- Golden Crescent -->
      <path d="M 40 22 Q 50 15 60 22 Q 50 25 40 22" fill="#fbbf24"/>
      <path d="M 33 55 Q 50 64 67 55" stroke="#db2777" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </svg>`;
  } else {
    // Generate lovely custom initial-based SVG with character identity colors
    svgContent = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-gen-${character.id}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${color}"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#grad-gen-${character.id})"/>
      <circle cx="50" cy="50" r="35" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.2"/>
      <text x="50" y="62" font-family="'Space Grotesk', system-ui, sans-serif" font-weight="bold" font-size="36" fill="#ffffff" text-anchor="middle">${initial}</text>
      <!-- Crown or symbol based on role -->
      ${character.role === "Hero" ? '<polygon points="50,15 55,27 68,27 57,35 61,47 50,39 39,47 43,35 32,27 45,27" fill="#fbbf24"/>' : ''}
      ${character.role === "Villain" ? '<path d="M 40 25 L 50 10 L 60 25 L 50 32 Z" fill="#ef4444"/>' : ''}
      ${character.role === "Sidekick" ? '<circle cx="50" cy="22" r="6" fill="#10b981"/>' : ''}
    </svg>`;
  }

  return "data:image/svg+xml;utf8," + encodeURIComponent(svgContent);
}
