# PCB Kaardistaja

Kohalik töölaua-äpp elektroonika parandajale: kui plaadi skeemi pole, kaardistad plaadi foto põhjal komponendid, jalad ja ühendused, annad võrkudele rolli (GND, 5V, 12V …), kirjutad üles mõõtmised ja saad lõpuks valmis skeemi ning remondiraporti.

**Seis:** dokumentatsioon ja veebiprototüüp. Töölaua-äpi ehitus algab verstapostist M0 ([teekaart](docs/07-teekaart.md)).

## Kaustad

| Kaust | Sisu |
|---|---|
| [docs/](docs/README.md) | ehituse dokumentatsioon: põhimõtted, kasutaja teekond, arhitektuur, andmemudel, moodulid, kasutajaliides, teekaart |
| [prototype/](prototype/) | veebiprototüüp (üks HTML-fail), mille põhjal töövoog on läbi proovitud |
| `src/`, `src-tauri/` | töölaua-äpp (TypeScript + React + Tauri 2), tuleb M0-s |

## Prototüübi kasutamine

Ava [prototype/PCB-Kaardistaja.html](prototype/PCB-Kaardistaja.html) brauseris (topeltklõps). Lähtekood on kaustas `prototype/src/`. Pärast muudatusi ehita uuesti:

```powershell
powershell -ExecutionPolicy Bypass -File prototype\build.ps1
```

## Tehnoloogia

TypeScript (strict), React 18, Vite, Zustand + Immer, zod, SVG-joonistus, Tauri 2 (Rust), projekti fail SQLite (`.pcbk`), testid Vitest + Playwright. Põhjendus: [ADR-002](docs/adr/ADR-002-typescript-tauri.md).
