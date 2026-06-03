# Creative Comics Lab AI — v4.0

Crea fumetti animati con AI. Dati salvati **localmente** nel browser via IndexedDB.

## Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4
- **Backend**: Express + Node.js (API Gemini)
- **Persistenza**: IndexedDB (nessun Firebase, nessun cloud)
- **AI**: Google Gemini (storyboard, immagini, TTS)

## Avvio rapido

```bash
npm install
cp .env.example .env        # Aggiungi la tua GEMINI_API_KEY
npm run dev                 # http://localhost:3000
```

## Build produzione

```bash
npm run build
npm start
```

## Struttura

```
src/
├── App.tsx                 # Componente principale
├── db/ComicsDB.ts          # Layer IndexedDB
├── hooks/
│   ├── useLocalDB.ts       # Hook CRUD + backup
│   └── useToast.ts         # Notifiche toast
├── components/             # UI components
└── types.ts                # TypeScript types
```

## Backup dati

Usa il pannello **"Dati"** nell'header per:
- Scaricare un backup `.json` (include immagini base64)
- Importare un backup precedente
- Vedere lo spazio usato
- Cancellare tutti i dati

## CI/CD

GitHub Actions esegue build + type check ad ogni push su `main`.
Vedi `.github/workflows/build.yml`.
