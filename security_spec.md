# Storage Model: Comic Studio (IndexedDB locale)

L'app usa **IndexedDB** nel browser come unico layer di persistenza.
Non ci sono server di autenticazione, database cloud, né API keys per la persistenza.

## Store IndexedDB

| Store       | KeyPath | Contenuto                              |
|-------------|---------|----------------------------------------|
| `characters`| `id`    | Character (avatar come placeholder)    |
| `comics`    | `id`    | Comic (imageUrl panel come placeholder)|
| `images`    | `id`    | DataURL base64 (immagini e audio TTS)  |

## Sicurezza

- Tutti i dati sono **locali al browser** dell'utente.
- Nessun dato viene trasmesso a server esterni (eccetto le chiamate API Gemini).
- Il backup/restore avviene tramite file `.json` scaricato/caricato dall'utente.
- L'isolamento è garantito dall'origin policy del browser (same-origin).

## Limiti

- Spazio tipico disponibile: 1–10 GB (dipende dal browser e dallo spazio disco).
- I dati sono persi se l'utente cancella i dati del browser — usare il backup.
