# M0: ehitaja üleandmised arhitektile

## Ülesanne 1 · Monorepo ja kvaliteediväravad

**2026-11-07 · Codex · valmis arhitekti ülevaatuseks.** Alus on `769930beb3e605c0961c1f22cf81fafa37504d3e`, haru `m0`. Ülesannet 2 ei ole alustatud. Commit'i ega push'i pole tehtud.

### Kus töö asub

Eraldatud tööpuu: `C:\Users\TRUMPIT\.codex\worktrees\bb-m0\BB`.

Arhitekt peab koodi ja käske kontrollima selles kaustas. Algne `C:\Users\TRUMPIT\Desktop\BB` jäi harule `main`; sealne pooleliolev dokumentatsioon säilis. Codexi üldine BB MCP seadistus osutab endiselt algsele kaustale, seega ei näita see automaatselt haru `m0` muudatusi. Selles ülesandes kasutati tööpuu faile ja Git-i otse.

### Mis valmis

- pnpm-tööruum: kaks rakendust ja seitse sisemist paketti. Koos juurega on 10 tööruumi projekti. Kuue aluspaketi `src/index.ts` sisaldab ainult `export {};`; domeeni, mootorit ega kasutajaliidest pole veel teostatud.
- Täpselt lukustatud `pnpm@12.18.0`, Node'i nõue `>=26 <27`, sõltuvuste lukufail ja TypeScript 5 range kontroll koos `noUncheckedIndexedAccess`-iga. Pakettide ekspordid viitavad lähtekoodile.
- Juurskriptid `check`, `typecheck`, `lint`, `depcruise`, `filelength`, `test`, `e2e`, `format` ja `format:check`. `check` käivitab viis plaanis nõutud kontrolli nõutud järjekorras.
- Kõik kaheksa plaanis nimetatud sõltuvusreeglit. Lisaks on eraldi kontrollid domeeni tüüpide ja käivitatava koodi eristamiseks, mooduli privaatse API ning jagatud koodi Node'i sõltuvuste piiramiseks. Need täpsustavad [03 sõltuvustabelit](../03-arhitektuur.md#sõltuvusreeglid-dependency-cruiser-ja-eslint-ci-s-kohustuslik), arhitektuuri ei muudetud.
- Failipikkuse kontroll: kuni 400 rida lubatud, 401–600 hoiatus, üle 600 viga. Genereeritud `*.gen.ts` ja `bindings/` on vabastatud; sõltuvusi, ehitusväljundeid ning tahtlikult vigaseid testandmeid ei kontrollita.
- Vitest kasutab praegu Node'i keskkonda. Playwrighti seadistus otsib ainult veebirakenduse e2e-teste ega korja üles Vitesti teste.

### Loodud ja muudetud failid

| Rühm | Failid |
|---|---|
| Tööruum ja sõltuvused | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` |
| Kvaliteedikontrollid | `tsconfig.base.json`, `tsconfig.json`, `eslint.config.js`, `.dependency-cruiser.cjs`, `.prettierrc`, `.prettierignore`, `.gitattributes`, `vitest.config.ts`, `playwright.config.ts` |
| Rakenduste kestad | `apps/{desktop,web}/package.json` |
| Pakettide kestad | `packages/{domain,contracts,engine,client,ui,adapters,features}/package.json`; kuue aluspaketi `src/index.ts` |
| Kontrollskript ja testid | `tooling/check-file-length.mjs`, `tooling/depcruise.test.ts`, `tooling/file-length.test.ts`, `tooling/typecheck.test.ts` |
| Testandmed | `tooling/fixtures/depcruise/tsconfig.json` ja selle all olevad lubatud ning keelatud importide näited |
| Üleandmine | see fail; tööpuu `docs/STATUS.md` ajakohastati |

Tööpuusse kopeeriti juhiste säilitamiseks kuus varem commit'imata stardifaili: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `docs/WORKFLOW.md`, `docs/SKILLS.md` ja `docs/STATUS.md`. Need on varasem eraldi dokumentatsioonitöö, mitte ülesande 1 uus rakenduskood. Originaalid jäid algsesse kausta alles.

### Tegelikud kontrollid

PowerShellis kasutati `pnpm.cmd`, sest selle arvuti skriptipoliitika blokeerib `pnpm.ps1`. Windowsi skriptipoliitikat ei muudetud.

| Käsk või katse | Tulemus |
|---|---|
| `pnpm.cmd install --frozen-lockfile` | Läbis; 10 tööruumi projekti |
| Esimene `pnpm.cmd test tooling` enne väravate teostust | Kukkus ootuspäraselt: 10 testi, väravate failid puudusid |
| Sihitud regressioonikatsed enne parandusi | Tõendasid TS-failide kaasamise, juurkausta genereeritud faili erandi ja rangemate sõltuvusreeglite puudujääke; pärast parandusi läbisid |
| Viimane `pnpm.cmd check` (18:47) | Läbis: TypeScript, ESLint, sõltuvused, failipikkus ja **18 testi kolmes failis** |
| `pnpm.cmd format:check` | Läbis |
| dependency-cruiser päris CLI vigaste testandmetega | Keeldus: väljumiskood 14, 14 keelatud sõltuvust; ka aliasest tehtud UI → mootor import tuvastati |
| BB dokumentide kontrollfunktsioon selle tööpuu failidel | Läbis: 26 Markdown-faili, probleeme ei leitud |
| `git diff --check` | Läbis |

18 testi kontrollivad kaheksat kihtide piiri, lubatud importide säilimist, aliaste ja privaatsete API-de piiranguid, CLI tegelikku ebaõnnestumist, failipikkuse piire ning seda, et range TypeScripti kontroll kaasab nii rakenduse kui paketi lähtekoodi. Tootmiskoodi sõltuvuskontrolli tulemus oli praegu kuus tühja moodulit ja null sõltuvust; väravate toimimist tõendavad tahtlikult vigased testandmed.

### Valikud, piirangud ja avatud kohad

- Plaan jättis tööriistade alaversioonid lahti. Valitud versioonid on täpselt lukus; ESLint on toetatud 10. põhiversioon, TypeScript 5.9.3. Reacti sõltuvust selles ülesandes veel ei lisatud; edaspidi jääb see plaani järgi 18. põhiversioonile.
- Olemasolevas `.gitattributes`-is täpsustati LF-reavahetused, et Windowsi checkout ei rikuks Prettieri kontrolli; Windowsi käsufailidele jääb CRLF ja senised binaarfailide reeglid säilisid.
- Mooduliregistri `dependsOn` metaandmete kontroll tuleb koos registri teostusega; see ei ole tühjas tööruumis veel olemas. Staatilised impordipiirid on olemas.
- Osa A sissejuhatuse käsk `pnpm test --filter "./packages/*"` vajab enne osa A lõppu arhitekti täpsustust: praegune juurskript edastaks `--filter` Vitestile. Võimalik kuju on `pnpm test packages`; paketipõhised testiskriptid lisanduvad vastavate ülesannetega. Teostusplaani ei muudetud.
- `pnpm e2e` skript ja seadistus on olemas, e2e-teste ega kasutajaliidest veel pole. Tauri rakenduse ehitamist ega M0 kasutajateekonda selles ülesandes ei kontrollitud.
- Plaani commit'i samm ootab arhitekti ülevaatust ja kasutaja commit'i luba vastavalt [töövõtetele](../WORKFLOW.md#rollid-ja-töö-üleandmine). Kavandatud sõnum: `chore: set up monorepo and quality gates`.

**Arhitektilt oodatav vastus:** „sobib“ või konkreetsed parandused ülesandele 1. Järgmine ehitusülesanne on [M0 ülesanne 2](M0-vundament.md#ülesanne-2-domeenimudel-pcbkdomain), kuid see ootab ülevaatuse otsust.

## Ülesanne 1 · parandused

**2026-11-07 · Codex · uus ülevaatus ootel.** Esimese ringi arhitekti otsus oli „veel ei sobi“. Allolev seis asendab eelmise lõigu lahtised küsimused ja kontrollitulemused. Haru on endiselt `m0`, HEAD `769930b`; commit'i ega push'i pole tehtud ning ülesanne 2 on alustamata.

### Arhitekti leidude lahendus

| Leid | Parandus ja tõend |
|---|---|
| 1. Backend nägi DOM-i ja Node'i globaale | Lisatud `tsconfig.backend.json`: `lib: ["ES2022"]`, `types: []`. See hõlmab domeeni, lepingute ja mootori lähtekoodi ning moodulite `contract.ts` ja `engine/` koodi; testifailid on välja jäetud. Juure `typecheck` käivitab senise kontrolli ja seejärel backendikontrolli. |
| Host-neutraalsed taimerid | `tooling/types/host-timers.d.ts` deklareerib ainult `setTimeout`-i, `clearTimeout`-i ja läbipaistmatu taimeritunnuse. Deklaratsioon laetakse ainult backendikontrolli; DOM-i ega Node'i tüüpe sellega kaasa ei tule. |
| 2. Domeeni `nanoid` | `domain-pure` lubab väljast `zod`-i ja `nanoid`-i. [03 sõltuvustabeli](../03-arhitektuur.md#sõltuvusreeglid-dependency-cruiser-ja-eslint-ci-s-kohustuslik) `domain`-rida muudeti arhitekti otsuse järgi. Testandmetes on `nanoid` lubatud ning `typescript` keelatud. `nanoid` tegelik sõltuvus lisandub koos ülesande 2 teostusega. |
| 3. Mootori avalik API | Reegel `engine-public-api-only` lubab moodulite mootoriosal ja adapteritel importida `packages/engine/` alt ainult `src/index.ts`-i. Mõlema kihi keelatud `history` süvaimport ja lubatud avalik import on testandmetes. |
| 4. `footprints` | Domeeni käivitatavast koodist on UI-le ja kliendile erandiks ainult `geometry`. `footprints`-import lükatakse katses tagasi. |
| 5. Testikäsud | [M0 plaanis](M0-vundament.md) asendati kõik viis nimetatud käsku: `pnpm test packages` (kahes kohas), `pnpm test packages/domain`, `pnpm test packages/engine` ja `pnpm typecheck`. Eraldi pakettide testiskripte ei lisatud. |
| 6. Commit'i piir | Commit'i ei tehtud. Kuus stardifaili jäävad sellest commit'ist välja. Ühine hetkeseis uuendati põhikausta `C:\Users\TRUMPIT\Desktop\BB\docs\STATUS.md`; tööpuu STATUS on nüüd viide sellele allikale. |
| Mitteblokeeriv CI märkus | Ülesande 13 plaani lisati `pnpm format:check`. CI teostust selles ülesandes ei alustatud. |

### Muudetud failid võrreldes esimese üleandmisega

- Seadistus: `package.json`, `tsconfig.json`, `.dependency-cruiser.cjs`; uus `tsconfig.backend.json` ja `tooling/types/host-timers.d.ts`.
- Testid: uus `tooling/backend-typecheck.test.ts`, täiendatud `tooling/depcruise.test.ts` ning üheksa uut importide testandmefaili kaustas `tooling/fixtures/depcruise/packages/`.
- Dokumendid: `docs/03-arhitektuur.md` üks tabelirida, `docs/plans/M0-vundament.md` testikäsud ja CI vorminduskontrolli nõue ning see üleandmine. STATUS-e muudatused on eraldi commit'imata stardikomplekti töö.
- Lukufail ja sõltuvuste versioonid ei muutunud.

### Tegelikud kontrollid

| Käsk või katse | Tulemus |
|---|---|
| Uued regressioonikatsed enne parandusi | **5 kukkus, 11 läbis**: tuvastati puuduv backendikontroll, mõlemad lubatud süvaimpordid, `footprints`-erand ja keelatud `nanoid`. Muu kolmanda osapoole keeld toimis juba enne parandust. |
| Täiendav TSX-katse ainult `.ts` faile kontrolliva seadistusega | Kukkus oodatult. Lõplik backendikontroll hõlmab lähtekoodi laiendusi, mitte ainult `.ts` faile. |
| `pnpm.cmd check` kell 19:55 | **Läbis**: mõlemad TypeScripti kontrollid, ESLint, sõltuvusreeglid, failipikkus ja **24/24 testi neljas failis**. |
| `pnpm.cmd format:check` | **Läbis**. |
| BB dokumentide kontrollfunktsioon | **Läbis** mõlemas kaustas: tööpuus 26, põhikaustas 25 Markdown-faili; probleeme ei leitud. |
| `git diff --check` ja commit'i sisu kontroll | **Läbis**. Commit'iks lisatud sisu puudub; kõik kuus stardifaili on endiselt jälgimata. Uued failid tehti ülevaatuse diffis nähtavaks täpse loendiga. |

Backendikatsed töötavad eraldi ajutistes projektides ning käivitavad päris `package.json`-i `typecheck`-käsu. `document`, `window` ja `process` annavad vea kõigis viies nõutud backendikohas ning eraldi `.tsx` failis. Teine katse tõendab, et taimeri loomine ja tühistamine kompileeruvad, samal ajal säilivad frontendil ja testifailidel nende hosti tüübid. Päris kasutajaprojekte ei muudetud.

**Järgmine samm:** arhitekti uus ülevaatus samas tööpuus. Otsust „sobib“ pole veel saadud; commit ootab kasutaja luba.

### Ülesande 1 vastuvõtt ja commit'i luba

2026-11-07 edastas kasutaja arhitekti otsuse **„ülesanne 1 sobib“** ning andis loa commit'iks `chore: set up monorepo and quality gates` harus `m0`, failide täpse loendiga ja kuue stardifailita. Push ja `main`-i ühendamine ootavad eraldi luba. Pärast seda võib alustada ülesannet 2; selle lõpus kehtib sama ülevaatuse piir.
