# PCB Kaardistaja

Kohalik töölaua-äpp elektroonika parandajale: kui plaadi skeemi pole, kaardistad plaadi foto põhjal komponendid, jalad ja ühendused, annad võrkudele rolli (GND, 5V, 12V …), kirjutad üles mõõtmised ja saad lõpuks valmis skeemi ning remondiraporti.

**Jooksev seis ja järgmine samm:** [docs/STATUS.md](docs/STATUS.md). Töölaua-äpi verstapostid on [teekaardil](docs/07-teekaart.md).

**AI töö algus:** [AGENTS.md](AGENTS.md) → [STATUS](docs/STATUS.md) → [WORKFLOW](docs/WORKFLOW.md) → [SKILLS](docs/SKILLS.md), seejärel ainult ülesandega seotud materjal. Claude'i ja Gemini sisenemisfailid juhatavad samade reeglite juurde. Vestlus-AI-le, kes repo faile ei näe, anna need neli faili ja ülesandega seotud väljavõtted.

Arhitekti, ehitaja ja kasutaja vastutused on kirjas [teekaardi rollijaotuses](docs/07-teekaart.md#rollid).

## Kaustad

| Kaust | Sisu |
|---|---|
| [docs/](docs/README.md) | ehituse dokumentatsioon: põhimõtted, kasutaja teekond, arhitektuur, andmemudel, moodulid, kasutajaliides, teekaart |
| [prototype/](prototype/) | veebiprototüüp (üks HTML-fail), mille põhjal töövoog on läbi proovitud |
| [tools/mcp-bb/](tools/mcp-bb/README.md) | ühised repo lugemis- ja dokumendikontrolli tööriistad AI-dele; kasutus [WORKFLOW-s](docs/WORKFLOW.md#bb-mcp-ühised-repo-tööriistad) |
| `apps/desktop/`, `apps/web/`, `packages/` | töölauarakendus (Tauri), brauseriversioon ja ühispaketid; [ADR-003 v2](docs/adr/ADR-003-frontend-backend.md) ja [ADR-004](docs/adr/ADR-004-kaks-vaadet-ja-uhendused.md) järgi. M0 on avaldatud versioonina `v0.1.0` (GitHubi Release koos `.msi`-ga) |

## Rakenduse käivitamine arenduses

Eeldused (Node 26, pnpm 12, Rust) on [STATUS-e arenduskeskkonna jaotises](docs/STATUS.md#arenduskeskkond). PowerShellis kasuta `pnpm.cmd`, kui skriptipoliitika blokeerib `pnpm`-i.

```powershell
pnpm.cmd install
pnpm.cmd --filter @pcbk/web dev     # brauseriversioon, projektid salvestuvad brauserisse
pnpm.cmd tauri dev                  # töölauaversioon, projektid on .pcbk failid
pnpm.cmd check                      # kõik testid ja koodikontrollid
pnpm.cmd e2e                        # brauseri vastuvõtukatsed
```

## Prototüübi kasutamine

Ava [prototype/PCB-Kaardistaja.html](prototype/PCB-Kaardistaja.html) brauseris (topeltklõps). Lähtekood on kaustas `prototype/src/`. Pärast muudatusi ehita uuesti:

```powershell
powershell -ExecutionPolicy Bypass -File prototype\build.ps1
```

## Tehnoloogia

TypeScript (strict), React 18, Vite, Zustand + Immer, zod, SVG-joonistus, Tauri 2 (Rust), projekti fail SQLite (`.pcbk`), testid Vitest + Playwright. Põhjendus: [ADR-002](docs/adr/ADR-002-typescript-tauri.md).
