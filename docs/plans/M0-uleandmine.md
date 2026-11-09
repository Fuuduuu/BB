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

## Ülesanne 2 · Domeenimudel

**2026-11-07 · Codex · teostus valmis arhitekti ülevaatuseks.** Alus ja HEAD on `12eeb631fb80af784f390a32c6fa2989fb48c6f7` (ülesande 1 vastuvõetud commit), haru `m0`, tööpuu `C:\Users\TRUMPIT\.codex\worktrees\bb-m0\BB`. Ülesande 2 commit'i, push'i ega `main`-i ühendamist pole tehtud. Ülesanne 3 on alustamata.

### Teostatud liidesed ja failid

- `BoardDocSchema`, kõik [04 tüübid](../04-andmemudel.md#tüübid) ja neile vastavad skeemid, sh valmiduse `ProgressSnapshot`. TypeScripti tüübid tuletatakse skeemidest, et neid ei peaks kahes kohas käsitsi muutma. Eksporditud on ka `DocKey = keyof BoardDoc`.
- `newBoardDoc(name)` loob dokumendi kõigi plaani vaikeväärtustega. Uuel dokumendil on oma massiivid, rollide objektid ja seaded; ühe projekti muutmine ei muuda teist projekti ega järgmise projekti vaikeväärtusi.
- `newId(prefix)` annab `<prefiks>_<nanoid(10)>`; `IdPrefix` sisaldab 04 entity-prefikseid ja jala eksemplari `pin`-prefiksit. Kutsuja annab prefiksi ilma alakriipsuta, näiteks `newId('cmp')`.
- `refPrefix` ja `nextRef` järgivad kogu plaani tabelit, täidavad väikseima vaba positiivse numbri ning võrdlevad tähiseid tõstutundetult.
- `defaultPinIds` järgib jalgade vaikejaotust, toetab määratud jalgade arvu ja keeldub vigasest arvust. `hole` jääb jalgadeta.
- `migrateDoc`, `Migration` ja tühi `MIGRATIONS`. Puuduv või mitmetähenduslik migratsioon, vigane lähteversioon või järgmise versioonini jõudmata samm annab vea.

| Failirühm | Muudatus |
|---|---|
| `packages/domain/src/model/` | `primitives.ts`, `component.ts`, `photo.ts`, `connection.ts`, `net.ts`, `measurement.ts`, `repair.ts`, `annotation.ts`, `progress.ts`, `board.ts`; sisemine kaardiabifunktsioon `record.ts` |
| Tehas ja põhiabilised | `packages/domain/src/{constants,ids,doc}.ts`, `components/{refs,pins}.ts`, `migrations/index.ts`, uuendatud `src/index.ts` |
| Testid | `src/doc.test.ts`, `src/ids.test.ts`, `src/components/helpers.test.ts`, `src/model/schema.test.ts`, `src/model/record.test.ts`, `src/migrations/migrations.test.ts` |
| Sõltuvused | `packages/domain/package.json` ja `pnpm-lock.yaml`: täpselt `zod@4.6.7`, `nanoid@6.0.2` |
| Üleandmine ja hetkeseis | see fail ning eraldi commit'imata põhikausta STATUS; kuus stardifaili jäid eraldi |

### Tegelikud kontrollid

| Käsk või katse | Tulemus |
|---|---|
| `pnpm.cmd test packages/domain` enne teostust | **43 testi kukkus**: API puudus; testid olid kogutud ja käivitati. |
| `pnpm.cmd test packages/domain` pärast teostust | **43/43 testi läbis**, viis faili. |
| `pnpm.cmd check` pärast ülevaatuse leiu parandust kell 22:42 | **72/72 testi läbis**, kümme faili (domeenis 48 testi kuues failis); mõlemad TypeScripti kontrollid, ESLint, sõltuvused ja failipikkus läbisid. Sõltuvuskontroll läbis 31 moodulit ja 64 sõltuvust. |
| `pnpm.cmd format:check` | **Läbis**. |
| `pnpm.cmd install --frozen-lockfile` | **Läbis**, 10 tööruumi projekti; lukufaili ümber ei lahendatud. |
| Tegeliku backendiprogrammi lisakatse koos Zodi ja Nano ID deklaratsioonidega | Virtuaalne mootori fail, mis kasutab `document`-i, `process`-i ja `window`-it, sai kõigi kolme kohta tüübivea. Faili kettale ei loodud. |
| Sõltumatu lugemisülevaatus ja sihitud regressioon | Leiti üks andmekao juhtum dünaamiliste kaartide parsimisel. Enne parandust kukkus neli regressioonitesti; pärast parandust läbivad kõik viis kaarditesti ja kogu 72 testi komplekt. Muid olulisi plaanirikkumisi ei leitud; Claude'i vastuvõttu see kontroll ei asenda. |
| BB dokumentide kontrollfunktsioon | **Läbis**: `m0` tööpuus 26 ja põhikaustas 25 Markdown-faili, probleeme ei leitud. |
| `git diff --check` ja Git-i lõppseis | **Läbis**. HEAD on `12eeb63`, ülesande 2 muudatused on commit'imata ning commit'iks lisatud sisu puudub. Kuus stardifaili on endiselt jälgimata. |

Testid katavad muu hulgas täieliku näidisdokumendi JSON-ülekande andmeid kaotamata, kummagi vaate paigutuste puudumise, ajaloolise mõõtmise säilimise, mõlema sondi `uid`-id, ühenduse otsa ühesuse, kõigi nelja remondimõju kuju, dioodi „OL“-näidu, vigased tüübid/piirid ning tundmatu dokumendivälja tagasilükkamise.

### Teostusvalikud ja piir

- Objektiskeemid on ranged: tundmatut välja ei eemaldata vaikides, vaid valideerimine ebaõnnestub. `BoardPlacement.params`, `padMap`, `customPads` ja `SymbolPlacement.pinMap` jäävad 04 järgi dünaamiliste võtmetega kaartideks. Ühine `stringRecord` keeldub enne Zodi parsijat oma võtmest `__proto__`, mille teek muidu veata eemaldaks. Tavalised võtmed, ka `constructor`, säilivad. See on andmekadu vältiv valideerimisvalik, mitte kaardi vaikne muutmine.
- ID-de genereerimine järgib prefiksit ja pikkust; skeem nõuab mittetühja ID-d. See lubab ka 04 fikseeritud vaikerollide ID-sid (`rol_gnd` jne). ID-de ja jalgade `uid`-de unikaalsuse ning viidete tervikluse kontroll kuulub plaani järgi mootori invariantidesse, mitte sellesse struktuuriskeemi ülesandesse.
- Mõõtmise kontakt võib olla kustutatud: skeem ei nõua selle aktiivse jala olemasolu. Selle aktiivsust, hinnangut ja mõju võrgule arvutab hilisem mootor; siin need funktsioonid ei lisandunud.
- `migrateDoc` töötleb `unknown`-andmeid ja tagastab `unknown`-andmed; täielik `BoardDocSchema` kontroll ning faili täisvarukoopia toimuvad hiljem projekti avamise voos. M0 vormingu 1 puhul testiti sammu 0 → 1; päris migratsioonide loend on plaani järgi tühi.
- 04 `referenceImageId` säilis valikulise viitena. Uut `attachments` loendit ei lisatud, sest seda pole autoriteetses `BoardDoc`-is. Andmemudelit, ADR-e ega teostusplaani selle ülesande käigus ei muudetud.
- Kasutajaliidest, salvestusadapterit, võrkude arvutust ega mõõtmise hinnangut ei teostatud. Ülesanne 2 ei ole kogu M0 vastuvõtt.

**Arhitektilt oodatav otsus:** „sobib“ või konkreetsed parandused. Ülesanne 3 ja ülesande 2 commit ootavad oma kokkulepitud luba.

### Ülesande 2 vastuvõtt ja ülesande 4 täpsustus

2026-11-07 edastas kasutaja arhitekti otsuse **„ülesanne 2 sobib“**. Tegelik Git-i kontroll näitab vastuvõetud teostust harus `m0` commitina `16d2330` (`feat(domain): board document model and helpers`); kuus stardifaili on endiselt jälgimata.

Arhitekti lisareeglid kanti [ülesande 4 plaani](M0-vundament.md#ülesanne-4-dokumendimootor-pcbkengine): `overload: true` välistab arvväärtuse ka nulli korral, `beep` tohib olla määratud ainult läbivusel ning objektide id-d peavad olema unikaalsed ja tüübile vastava prefiksiga. Prefiksile peab järgnema midagi, kuid täpselt kümmet märki ei nõuta; jala loetav `id` on erand ja `uid` kasutab `pin_` prefiksit.

`ImportCheck` prefiks on arhitekti otsusega `chk_`. `'chk'` lisamine `IdPrefix`-isse, vastav genereerimistest ja `chk_` lisamine dokumendi 04 prefiksite loendisse tehakse **ülesande 4 commit'is koos invariantidega**. Praegu täiendati ainult plaani ja üleandmist; domeenikoodi, dokumendi 04 ega mootori invariante ei muudetud.

## Ülesanne 3 · Leping

**2026-11-07 · Codex · valmis arhitekti ülevaatuseks.** Alus ja HEAD on `16d2330`, haru `m0`, tööpuu `C:\Users\TRUMPIT\.codex\worktrees\bb-m0\BB`. Ülesanne 3 on teostatud, commit'imata. Ülesande 4 käitusaegset koodi ei ole alustatud.

### Teostus ja failid

- `packages/contracts/src/result.ts`: `Result<T, E>` ning olekuta `ok` ja `err` abifunktsioonid. Need on paketi ainsad käitusaegsed teostused.
- `src/errors.ts`: täpselt ADR-003 `EngineError` variandid ja plaani `StorageReason`, sealhulgas `not_project` ja `too_new`.
- `src/snapshot.ts`: `Snapshot`, `Derived` ja rekursiivne `DeepReadonly`. Kirjutuskaitse ulatub valikuliste objektide, sõnastike, massiivide ja tupliteni. `Derived` sisaldab M0-s ainult `unplacedBoard` ja `unplacedSchematic` loendeid.
- `src/document-engine.ts`: sünkroonne `DocumentEngine`, `CommandOk`, `Unsubscribe`, käsutüübid ja sündmuse kuju.
- `src/project-service.ts`: asünkroonne `ProjectService` ning kõik ülesande 3 päringu-, vastuse-, vaate-, varukoopia- ja salvestusseisundi tüübid.
- `src/index.ts`: avalikud ekspordid; `src/contracts.test-d.ts`: Vitesti `expectTypeOf` ja TypeScripti negatiivsed tüübitestid.
- `packages/contracts/package.json` ja `pnpm-lock.yaml`: sõltuvused `@pcbk/domain: workspace:*` ja `zod: 4.6.7`. Tootmiskood impordib neist ainult tüüpe; Reacti, mootorit ega hosti API-t ei impordita.

### Plaanis lahtiseks jäetud toetavad tüübid

ADR nimetab `CommandId`, `ParamsOf`, `DomainEvent` ja `Unsubscribe`, kuid ei defineeri nende kuju. Teostus kasutab järgmisi väikseid täpsustusi:

- `CommandMap` on laiendatav liides. Tuumas on plaanis nõutud `items.delete: { ids: string[] }`; võimaluse enda `contract.ts` saab lisada oma käsutüübid [TypeScripti mooduliaugmentatsiooniga](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation). Keskne leping ei impordi võimaluse teostust ega vaja iga uue käsu jaoks käsitsi täiendamist.
- `CommandId` tuletatakse selle kaardi punktiga nimedest ning `ParamsOf<C>` säilitab käsu ja parameetrite seose. Tüübitestis tõendati avaliku `@pcbk/contracts` kaudu lisatud käsu kasutamist ning vale parameetri ja registreerimata käsu tagasilükkamist.
- `DomainEvent` on M0-s kirjutuskaitstud ümbris `{ type: \`${string}.${string}\`; sessionId: string; rev: number; payload: unknown }`. Seansi ja versiooni saab kontrollida ilma sisule oletusi tegemata. Võimaluse konkreetse sündmuse sisu tüübid lisanduvad selle lepingusse; M0 sündmuse käitusloogikat siin ei ole.
- `Unsubscribe = () => void`. `Snapshot` kirjutuskaitse on siin tüübi tasemel; tegelik sügav külmutamine tuleb plaani järgi ülesande 4 mootoris.

### Tegelikud kontrollid

| Käsk või katse | Tulemus |
|---|---|
| `pnpm.cmd typecheck` pärast tüübitestide kirjutamist, enne teostust | **Kukkus**: lepingu ekspordid puudusid, väljumiskood 2. |
| `pnpm.cmd typecheck` pärast teostust | **Läbis** nii üldise kui DOM-i ja Node'i tüüpideta backendikontrolli. |
| `pnpm.cmd check` kell 23:29 | **Läbis**: mõlemad TypeScripti kontrollid, ESLint, sõltuvused, failipikkus ning **72/72 käitustesti kümnes failis**. Sõltuvuskontrollis 37 moodulit ja 83 sõltuvust. |
| `pnpm.cmd format:check` | **Läbis**. |
| `pnpm.cmd install --frozen-lockfile` | **Läbis** kõigi 10 tööruumi projekti peal. |
| `ok`/`err` käitusaegne suitsukontroll | **Läbis** nullväärtuse, `undefined`-väärtusega edu ning vea haru kontrollid päris lähtekoodi peal. |
| Sõltumatu lugemisülevaatus ja failideta rikkekatsed | Olulisi vigu ei leitud. Katsed kinnitasid, et tüübitestid tabavad sügava kirjutuskaitse eemaldamise ning sünkroonse/asünkroonse lepingu muutmise. Claude'i vastuvõttu see ei asenda. |
| BB dokumentide kontrollfunktsioon | **Läbis**: tööpuus 26 ja põhikaustas 25 Markdown-faili, probleeme ei leitud. |
| `git diff --check` ja failipiir | **Läbis**: 11 faili, sealhulgas säilitatud plaanimuudatused; commit'iks lisatud sisu puudub, kuus stardifaili on endiselt jälgimata. |

`contracts.test-d.ts` kontrollitakse päriselt `tsc` abil ega käivitata Vitesti käitustestina. Negatiivsed `@ts-expect-error` kontrollid ebaõnnestuvad, kui keelatud muutmine või vigane käsk hakkab kompileeruma. Tüübitestide lisandumist ei loeta 72 käitustesti sisse. Testitud on ka meetodite tagastustüübid: dokumendikäsk on sünkroonne, failitoiming annab `Promise`-i ja tellimine annab katkestusfunktsiooni.

### Säilitatud varasem töö ja järgmine samm

Arhitekti kinnitatud ülesande 4 plaanitäpsustused olid alustamisel commit'imata ja jäid alles. Kasutaja suunise järgi lähevad need järgmise ülesande commit'i kaasa; selle ülesande 3 käigus ei muudetud nende sisu, `IdPrefix`-it ega dokumendi 04 prefiksite loendit. Kuus stardifaili jäävad eraldi. Ühine STATUS on põhikaustas.

**Arhitektilt oodatav otsus:** „sobib“ või konkreetsed parandused ülesandele 3. Käesolev töö ei ole commit'itud ega push'itud; ülesanne 4 ootab oma ülevaatuse piiri.

### Ülesande 3 lõpetamine

Kasutaja kinnitas ülesande 3 commiti `369276c` (`feat(contracts): engine and project service contracts`, 11 faili) ning lubas alustada ülesannet 4. Git-ist kontrolliti sama HEAD-i ja puhast jälgitavat tööpuud; kuus stardifaili jäid jälgimata. Commit sisaldab ka kinnitatud ülesande 4 plaanitäpsustusi.

## Ülesanne 4 · Dokumendimootor

**2026-11-08 · Codex · valmis arhitekti ülevaatuseks.** Alus ja HEAD on `369276c`, haru `m0`, tööpuu `C:\Users\TRUMPIT\.codex\worktrees\bb-m0\BB`. Ülesande 4 muudatused on commit'imata; ülesanne 5 on alustamata.

### Teostatud liidesed ja vastutused

- `createEngine` tagastab eraldi `DocumentEngine`-i ja `EngineHost`-i. `execute`, `undo` ja `redo` on sünkroonsed ning tagastavad lepingu `Result`-i. Käsu parameetrid ja `requestId` metadata valideeritakse enne muutmist.
- Omanikukontroll käib Immeri paikade järgi ning kehtib ka väljalaskes. `owns` ja `alsoWrites` ei anna õigust `reserved` väljadele ega tuuma `rev`/`format_version` väljadele. Tundmatu juurväli annab `validation`, mitte vale `DocKey`-ga omandivea.
- Ajalugu hoiab `patches`/`inversePatches`, maksimaalselt 200 sammu. Undo/redo taastavad sisu, kuid kasvatavad `rev`-i; edukas uus dokumenti muutev käsk lõpetab redo-haru. Tagasilükatud ega tühi käsk ei muuda olemasolevat ajalugu ega päevikut.
- Kõik plaani invariandid on olemas: objektide id-de projektisisene unikaalsus, liigipõhine prefiks koos mittetühja lõpuga, tähiste tõstutundetu unikaalsus, jala id unikaalsus komponendis ning `uid` unikaalsus projektis. Prefiksikaart katab tüübi tasemel kõik `BoardDoc` id-ga objektide loendid, et uue loendi lisamisel kontroll märkamata ei puuduks.
- Mõõtmise `overload: true` välistab `value`, ka nulli; `beep` saab olla määratud ainult läbivusel, nii `true` kui `false`. Ajalooline kontaktiviide ei ole uus jalaobjekt ega tekita unikaalsuskonflikti.
- Autoriteetne dokument, hetktõmmis, arvutatud loendid ja ajaloo paigad on sügavalt muutumatud. Lisaks Immeri sisse lülitatud automaatsele külmutusele läbib `sealTree` ka võõra pealt külmutatud objekti lapsed. WeakSet-vahemälu säilitab muutumata harude jagatud viited.
- Päevik saab ainult kinnitatud käigud koos süstitud kella, käsu id, `requestId` ja kokkuvõttega. Tagasipanek säilitab järjekorra ning ei dubleeri kirjeid. Eelmise seansi kirjed ei satu uue projekti päevikusse.
- `items.delete` kustutab M0-s komponente; mõõtmisajalugu säilib ja undo taastab samad jala `uid`-id. Paigutamata komponentide mõlemad loendid uuenevad koos käsu ning undo/redo versiooniga.

### Muudetud failid

| Rühm | Failid |
|---|---|
| Mootor ja avalik API | `packages/engine/src/{engine,types,index}.ts` |
| Eraldatud vastutused | `src/{registry,ownership,invariants,history,journal,items,events,derivation,immutability}.ts` |
| Testid | `src/{engine,invariants,lifecycle,robustness,noop}.test.ts`, `src/__tests__/helpers.ts` |
| Arhitekti prefiksiotsus | `packages/domain/src/ids.ts`, `ids.test.ts`, [04 põhimõtted](../04-andmemudel.md#põhimõtted): `chk_` ning genereerimise ja valideerimise erinevus |
| Sõltuvused | `packages/engine/package.json`, `pnpm-lock.yaml`: `@pcbk/domain`/`@pcbk/contracts` tööruumilingid, `immer@11.2.9`, `zod@4.6.7` |
| Üleandmine | see fail ning eraldi põhikausta STATUS; stardifailid jäävad eraldi |

### Tegelikud kontrollid

| Käsk või katse | Tulemus |
|---|---|
| `pnpm.cmd test packages/engine` enne teostust | **72 testi kukkus**, kolm faili; `createEngine` puudus. |
| Sama käsk pärast esmast teostust | **72/72 läbis**; seejärel lisati olemasoleva ajaloo/päeviku säilimise katse ja sõltumatu ülevaatuse regressioonid. |
| Esmane `pnpm.cmd check` | **145/145 testi läbis**; mõlemad TypeScripti kontrollid, ESLint, sõltuvused ja failipikkus läbisid. |
| Ülevaatuse regressioonid enne parandusi | **7 kukkus, 2 läbis**; kinnitati metadata osaline kinnitamine, muudetavad lapsed/accessorid, vale veakuju ja asünkroonse vaatleja erind. |
| `pnpm.cmd check` pärast parandusi, 01:17 | **154/154 testi läbis**, 14 faili (mootoris 82 testi neljas failis); kõik viis väravat läbisid. Sõltuvuskontrollis 53 moodulit ja 145 sõltuvust. |
| `pnpm.cmd format:check` | **Läbis**. |
| `pnpm.cmd install --frozen-lockfile` | **Läbis** kõigi 10 tööruumi projekti peal; sõltuvusi pärast seda ei muudetud. |
| Lõpu `pnpm.cmd typecheck` ja `format:check` | **Läbisid** ka pärast prefiksikaardi täielikkuse tüübi ja hostiliidese kommentaari lisamist; käituskoodi need täiendused ei muutnud. |
| BB dokumentide kontrollfunktsioon | **Läbis**: tööpuus 26 ja põhikaustas 25 Markdown-faili, probleeme ei leitud. |
| `git diff --check` ja lõppseis | **Läbis**; 23 muudetud/lisatud faili, HEAD endiselt `369276c`, commit'iks lisatud sisu puudub. Kuus stardifaili on endiselt jälgimata. |

### Sõltumatu ülevaatuse leiud ja parandused

| Leid | Parandus |
|---|---|
| P1: vigane `requestId` võis põhjustada päeviku külmutusvea pärast osalist kinnitamist | Metadata valideeritakse ning päevikurida valmistatakse koos muu tulevase olekuga ette enne avaldamist. Kolm vigase metadata regressiooni tõendavad täielikku tagasilükkamist. |
| P1: pealt külmutatud objekt peitis muudetavaid jalaobjekte, ka ajaloopaikades | Rekursiivne külmutaja ei usalda pelgalt `Object.isFrozen` tulemust. Dokumendipuu ja ajaloopaigad suletakse enne kinnitamist; accessorid ja mitteandmelised prototüübid ei saa käsu kaudu dokumendi osaks. Test kontrollib ka redo järel muutumatust ja muutumata harude viidete säilimist. |
| P2: omandivea `field` võis olla tundmatu string | Tundmatu juurväli tagastab `validation`; `ownership.field` jääb päris `DocKey`-ks. |
| P2: `async` vaatleja tagasilükatud Promise pääses välja | Teavitaja käsitleb ka tagastatud thenable'i erindit. Testis ei tekkinud pärast parandust ühtegi `unhandledRejection`-it. |

Kõik neli leidu parandati ühe testidega tõendatud vooruga; uut sõltumatut ülevaatust ei väideta. Claude'i arhitektuurne vastuvõtt on järgmine samm.

### Plaanis lahtiseks jäetud valikud ja piir

- Ilma avatud projektita on `host.current()` null ning `snapshot()` annab külmutatud neutraalse hetktõmmise `sessionId: ''` ja `rev: 0`. Käsud tagastavad `stale_session`. Laadimine/sulgemine teavitab tellijaid; vigane uus laadimine jätab olemasoleva projekti alles.
- `Clock.now(): string` järgib 03 lepingut. `CommandCtx` sisaldab eelnevaid arvutatud andmeid ja puhverdatud `emit`-i. `DeriveSpec` on M0-s `{ key, run }`, mille võtmed on kaks olemasolevat paigutamata komponentide loendit.
- Sündmused avaldatakse pärast uut hetktõmmist; draft-viited kopeeritakse ohutuks muutumatuks sisuks. Undo/redo teavitab hetktõmmise tellijaid ega käivita käsu keha uuesti. Teavitamise ajal korduv sisenev muutmiskäsk annab `validation(engine_busy)`; vaatleja erind ei võta kinnitatud käsku tagasi.
- Arhitekti täpsustuse järgi tekitab ajaloo- ja päevikusammu ainult dokumenti muutev käsk. Tühjade paikadega õnnestunud käsk tagastab senise `rev`-i, säilitab hetktõmmise viite ja redo-haru ega avalda teavitusi või puhverdatud sündmusi.
- `requeueJournal` ootab algseid `drainJournal`-ist saadud kirjeobjekte. See on samas protsessis olev hosti liides; algsete objektide identiteet võimaldab eristada vana seansi ja korduvaid kirjeid. Vastav märkus on ka avalikul hostiliidesel.
- Registris on M0 käsuotsingu turvakontrollid (kattuvad mooduli-/käsu-id-d, tuuma omand, kattuvad arvutused). Täielik `dependsOn`-i, omanike katvuse ja moodulite register ning päris `project`/`components` moodulid jäävad **ülesandesse 5**. Faili salvestamist, migratsioonide käivitamist ja `SaveCoordinator`-it pole siin teostatud.
- `EngineModule` heterogeenne `CommandSpec<any>[]` on plaani kohane ja ühes kohas kommentaariga põhjendatud; käivitus kasutab alati eduka zod-parsimise tulemust. Reacti, DOM-i ega Tauri sõltuvusi mootoris pole.

### Ülesanne 4 · tühja käsu parandus

**2026-11-08 · arhitekti ülevaatuse järel.** Tühjade Immeri paikadega õnnestunud käsk tagastab nüüd `ok({ rev: senine })` enne kinnitamist. Sama dokumendi ja hetktõmmise viide, ajalugu, päevik ja redo-haru säilivad; teavitusi ei lähe ning puhverdatud sündmused visatakse ära. Kokkuvõtet, arvutatud andmeid ega kellaaega uuesti ei arvutata.

- `engine.ts`: tühjade paikade korral varane tagastus.
- `items.ts`: olematu id kustutamine ei asenda komponentide loendit tarbetult uue massiiviga.
- `noop.test.ts`: kaks nõutud regressioonitesti, sh olemasoleva ajaloo/päeviku säilimine, redo pärast undo-d ja puhverdatud sündmuse mahajätmine. Mõlemad kukkusid enne parandust ning läbisid pärast seda.
- [03 § 6](../03-arhitektuur.md#6-käsud-tagasivõtmine-ja-logi), [04 `BoardDoc`](../04-andmemudel.md#tüübid) ja [M0 ülesanne 4](M0-vundament.md#ülesanne-4-dokumendimootor-pcbkengine) kajastavad arhitekti otsust. `rev` kasvab iga dokumenti muutva käsuga, ka tagasivõtmisel.

**Viimane kontroll, 02:16:** `pnpm.cmd check` läbis kõik viis väravat ja **156/156 testi 15 failis** (mootoris 84 testi). Sõltuvuskontroll läbis: 54 moodulit, 147 sõltuvust. `pnpm.cmd format:check` läbis.

Dokumendikontroll läbis tööpuus 26 ja põhikaustas 25 faili. Kogu ülesande 4 praegune diff hõlmab 26 faili; kuus stardifaili on endiselt jälgimata ja commit'iks lisatud sisu puudub. HEAD on `369276c`.

Mitteblokeerivad märkmed järgmisele plaanile: tühja ajaloo `undo` annab endiselt `not_found` (`id: 'undo'`); UI peab keelama kättesaamatu undo/redo. Ühenduste mooduli lisamisel tuleb lisada 03 § 6 viidete tervikluse invariandid (otsad ja sildi ankrud olemas, orbliitepunkte pole) ning laiendada `items.delete` dokumendi 04 seotud kirjete kustutamise reeglitega. M0 ei lisa ühenduste loogikat.

**Arhitektilt oodatav otsus:** „sobib“ või konkreetsed parandused ülesandele 4. Commit, push ja `main`-i ühendamine ootavad vastavat kasutaja luba; ülesannet 5 enne ülevaatuse otsust ei alustata.

### Ülesande 4 lõpetamine

Kasutaja kinnitas ülesande 4 commiti `0a532fa` (`feat(engine): synchronous document engine with ownership and invariants`) ning lubas alustada ülesannet 5. Git-ist kontrolliti sama HEAD-i ja puhast jälgitavat tööpuud; kuus stardifaili jäid jälgimata.

## Ülesanne 5 · Moodulite register ning project ja components

**2026-11-08 · Codex · valmis arhitekti ülevaatuseks.** Alus ja HEAD on `0a532fa`, haru `m0`, tööpuu `C:\Users\TRUMPIT\.codex\worktrees\bb-m0\BB`. Ülesanne 5 on commit'imata; ülesanne 6 on alustamata.

### Teostatud

- Register nõuab igale `BoardDoc` väljale täpselt üht omanikku: moodul, tuum või `reserved`. Ka valikulised väljad peavad olema kaetud. Topeltomanik, tundmatu väli ning puuduv või tsükliline sõltuvus annavad käivitusel `RegistryError`-i. Mooduli- ja käsu-id-d ei tohi korduda ning `alsoWrites` peab nimetama olemasoleva välja.
- Sõltuvused järjestatakse enne neist sõltuvaid mooduleid. Nii näeb arvutatud andmete tarbija oma sõltuvuse tulemust ka siis, kui moodulite sisendloend on teises järjekorras.
- `projectEngine` omab kõiki seitset plaanis määratud välja. `project.rename` trimmib nime ning nõuab 1–120 märki; `project.setInfo` muudab ainult antud seadme/probleemi välju.
- `componentsEngine` omab `components` välja. Olemas on lisamine, muutmine ning `addPin`, `renamePin`, `setNc` ja `removePin`. Automaatne tähis kasutab domeeni `nextRef`-i. Väärtus ja märgistus on vaikimisi tühjad; uus komponent on mõlemas vaates paigutamata.
- Feature-lepingud ekspordivad käskude zod-skeemid ja tüübid ning laiendavad `CommandMap`-i. `selectComponents` ja `selectComponent` tagastavad sama sügavalt kirjutuskaitstud hetktõmmise andmed. `makeAddComponent` kasutab kutsuja ID-loojat ja domeeni `defaultPinIds`-i; mootor uusi identiteete ei genereeri.
- Eemaldatud jala tagasivõtmine taastab sama `uid`-i. Sama numbriga uuele jalale annab kutsuja uue `uid`-i; vana mõõtmiskontakt säilib muutmata. Vigased käsud kasutavad olemasolevat atomaarset omandi-/invariantide kontrolli. Tühjad osalised muudatused säilitavad `rev`-i ja redo-haru.

### Muudetud failid

| Koht | Sisu |
|---|---|
| `packages/engine/src/registry.ts`, `registry.test.ts` | täielik omanikukatvus, sõltuvused, tsüklid ja käivituskontrollid |
| `packages/engine/src/__tests__/helpers.ts`, `lifecycle.test.ts` | varasemad tehingutestid kasutavad puuduvate väljade jaoks selgesõnalisi testomanikke; tootmiskontrolli ei lõdvendatud |
| `packages/features/project/{contract.ts,engine/index.ts}` | projekti käsud, skeemid ja omanikud |
| `packages/features/components/{contract.ts,engine/index.ts,engine/commands.ts}` | komponendi/jalgade käsud, selektorid ja ID-abifunktsioon |
| `packages/features/{__tests__/helpers.ts,components/components.test.ts,components/pins.test.ts,components/contract.test-d.ts,project/project.test.ts}` | päris mootori integratsioonitestid ja lepingu tüübikontroll |
| `packages/contracts/src/{ids.ts,index.ts}` | ühine `IdGen` tüüp, ilma mootori sõltuvuseta |
| `packages/features/package.json`, `pnpm-lock.yaml` | tööruumisõltuvused ja juba lukustatud `zod@4.6.7`; uusi väliseid versioone pole |
| Üleandmine ja põhikausta STATUS | see fail ning ühine jooksev seis; stardifailid jäävad eraldi |

### Tegelikud kontrollid

| Käsk või katse | Tulemus |
|---|---|
| Registri testid enne teostust | **15 kukkus, 2 läbis**: seni puudusid omanike katvuse, reservatsioonide ja sõltuvuste kontrollid ning sõltuvuspõhine järjestus. |
| `pnpm.cmd test packages/engine` pärast registri teostust | **101/101 läbis**, kuus faili, sh 17 registritesti ja kõik varasemad tehingutestid. |
| Feature-testid ja tüübikontroll enne teostust | Pärast deklareeritud tööruumisõltuvuste linkimist **33/33 testi kukkus** puuduvate moodulite/ID-abifunktsiooni tõttu. Tüübikontroll kukkus puuduvate eksportide ja käsukaardi kirjete tõttu. |
| `pnpm.cmd test packages/features` pärast teostust | **33/33 läbis**, kolm faili; lisaks kontrollib `contract.test-d.ts` käskude sisendit ja selektorite sügavat kirjutuskaitset TypeScriptiga. |
| `pnpm.cmd check`, 11:15 | **206/206 testi läbis**, 19 faili. Mõlemad TypeScripti kontrollid, ESLint, sõltuvusreeglid ja failipikkus läbisid. Sõltuvuskontroll: 66 moodulit, 186 sõltuvust, 0 rikkumist. |
| `pnpm.cmd install --frozen-lockfile --offline` | **Läbis** kõigi 10 tööruumi projekti peal. Keskkond kontrollitud: Node.js 26.13.0, pnpm 12.18.0. |
| `pnpm.cmd format:check` ja BB dokumentide kontrollfunktsioon | **Läbisid**. Dokumendikontrollis tööpuus 26 ja põhikaustas 25 Markdown-faili; probleeme ei leitud. |
| `git diff --check` ja esialgne seis enne arhitekti parandusi | **Läbis**; ülesandes 5 oli 19 muudetud/lisatud faili, HEAD `0a532fa`, commit'iks lisatud sisu puudus. Kuus stardifaili jäid jälgimata ja eraldi töösse. |

### Plaanis lahtiseks jäetud valikud ja piir

- `IdGen` oli plaanis nõutud, kuid selle asukoht oli määramata. Tüüp on `@pcbk/contracts`-is kujul `newId(prefix: string): string`, täpselt 03 lepingu järgi: feature-leping ei pea importima mootorit ning ülesande 6 pordid saavad kasutada sama tüüpi.
- Osalises muudatuses tähendab puuduv või `undefined` väli „jäta samaks“; tühi string on teadlik tühjendamine. `renamePin({ name: null })` eemaldab valikulise nimevälja. Puuduva komponendi või jala muutmine annab arhitekti paranduse järel `not_found` koos sihtmärgi tunnusega; varasem `validation` valik on asendatud alloleva otsusega.
- Uued jala tunnused loob kutsuja. Mootor kontrollib elavate jalgade `uid`-de unikaalsust; varem kustutatud tunnuse tahtliku taaskasutamise keelamiseks eraldi ajalookogumit ei lisatud. Õige ID-looja ja säilinud ajalooline kontakt on testitud.
- Ühenduste/siltide korrastamine ja paigutuste viidete täisvoog kuuluvad nende moodulite lisamise juurde. `removePin` muudab M0-s jalgade loendit ja jätab mõõtmised alles; tulevased viidete tervikluse ning seotud kirjete kustutamise reeglid jäävad ülesande 4 üleandmise märkme järgi järgmisse plaani. Nende valmimist siin ei väideta.
- Salvestust, `ProjectService`-i, kasutajaliidest ega inimese visuaalset vastuvõttu pole selles ülesandes teostatud. Neid ei asenda Node'is läbinud testid.

**Esialgne sõltumatu ülevaatus:** eraldi ülevaataja luges tegelikku `git diff HEAD` muudatust, seotud domeeni/mootori koodi ja teste ega tuvastanud leide. Ta faile ei muutnud ega teste uuesti käivitanud; kontrollitulemused ülal on ehitaja tegelikest käivitustest. Ülevaatus jättis hilisemate moodulite ühendus-/paigutuskoristuse, tahtliku ajaloolise UID taaskasutuse ning salvestuse/UI väljapoole seda ülesannet; nende piir on eespool selgelt kirjas. Seejärel leidis arhitekt allolevad kaks viga, mis esialgses ülevaatuses märkamata jäid.

### Ülesanne 5 · arhitekti parandused

**2026-11-08 · kaks leidu parandatud, ootab uut arhitekti ülevaatust.**

- **Puuduv sihtmärk:** mootori avalik API ekspordib `CommandTargetNotFound(id)` klassi (`packages/engine/src/errors.ts`). `locked` teisendab selle kujule `{ code: 'not_found', id }`; muud erindid jäävad `validation`-iks. Komponentide ja jalgade leidmise abifunktsioonid ning `removePin` kasutavad seda klassi. Komponendi tunnus jääb nt `cmp_absent`, jala tunnus on nt `cmp_a:7`.
- **Tähis:** lisamise ja muutmise skeemid trimmivad `ref`-i enne tühjuse kontrolli. Mootori invariant võrdleb `ref.trim().toUpperCase()`, mistõttu ka laaditud faili tühikutega duplikaat lükatakse tagasi. Domeeni `nextRef` kasutab sama võrdlust: laaditud `R1 ` kõrval saab uus takisti `R2`, mitte tagasilükatava `R1`.
- **Regressioonid:** kuus sihtmärgijuhtu kontrollivad täpset veakoodi/tunnust ning dokumendi, `rev`-i, ajaloo ja päeviku säilimist. Mootori eraldi test kontrollib ka erindi eel tehtud mustandimuudatuse ja puhverdatud sündmuse mahajätmist. Kuus tähisetesti katavad lisamise/muutmise trimmimise, tühikutega tõstutundetu duplikaadi, vigase faili laadimise ning automaatse nummerdamise.
- **Muudetud kohad selles paranduses:** `packages/engine/src/{errors,engine,index,invariants,target-error.test}.ts`, `packages/domain/src/components/refs.ts`, `packages/features/components/{contract.ts,engine/commands.ts,pins.test.ts,refs.test.ts}` ning M0 plaan/üleandmine. Sõltuvused ei muutunud.

Testitõend: enne parandusi **13 katset kukkus ja 8 varasemat läbis**. Pärast esimest parandust läbisid sihtmärgi-/erindikontrollid **25/25**; pärast tähiseparandust läbisid tähiste, invariantide ja domeeni abifunktsioonide katsed **62/62**. Lõplik `pnpm.cmd check`, 11:38: **218/218 testi 21 failis**; mõlemad TypeScripti kontrollid, ESLint, sõltuvusreeglid (69 moodulit, 194 sõltuvust) ja failipikkus läbisid. Need on ehitaja käivitatud kontrollid; uut sõltumatut ülevaatust pärast parandusi ei väideta.

Vormindus ja `git diff --check` läbisid. BB dokumentide kontrollfunktsioon läbis tööpuus 26 ja põhikaustas 25 faili, probleeme ei leitud. Kogu ülesande 5 praegune diff on 27 faili; commit'iks lisatud sisu puudub, kuus stardifaili on endiselt jälgimata ning haru `m0` HEAD on `0a532fa`.

**Arhitektile M1 plaani jaoks, praegu mitteblokeeriv:**
- Koos esimese teise mooduli lepinguimpordiga lisa `dependsOn` loendi ja tegeliku impordi kooskõla kontroll. M0-s selliseid importe veel pole; praegune kontroll seda tingimust ei taga.
- Plaadipaigutuse olemasolul peab käsitsi lisatud jala eemaldamine koristama `customPads`-i ning jalale viitavad `padMap`-i kirjed. M0 selles paranduses paigutuste loogikat ei lisa.

**Arhitektilt oodatav otsus:** „sobib“ või konkreetsed parandused ülesandele 5. Commit, push ja `main`-i ühendamine ootavad vastavat kasutaja luba; ülesannet 6 enne ülevaatuse otsust ei alustata.

### Ülesande 5 lõpetamine

Kasutaja kinnitas ülesande 5 commiti `a00e17f` (`feat(components): first engine module with registry checks`, 27 faili) ja lubas alustada ülesannet 6. Git-ist kontrolliti sama HEAD-i, haru `m0` ning puhast jälgitavat tööpuud; kuus stardifaili jäid jälgimata.

## Ülesanne 6 · Pordid, mälusalvesti ja projektihaldus

**2026-11-08 · Codex · osa A teostus valmis arhitekti ülevaatuseks.** Alus ja HEAD on `a00e17f`, haru `m0`, tööpuu `C:\Users\TRUMPIT\.codex\worktrees\bb-m0\BB`. Ülesanne 6 on commit'imata; ülesanne 7 on alustamata.

### Teostatud

- `ProjectRepository`, `PhotoStore`, `OpenedProject`, `SaveReq`, loomise/koopia sisemised päringud ning `StorageError`. `Clock` ja ühine `IdGen` kasutavad olemasolevaid tüüpe. Pordid ei tunne Reacti, DOM-i ega Taurit.
- `storage-memory` jagab kahe hoidlaeksemplari vahel faile ja eksklusiivseid lukke. Dokumendi ning päeviku kirjutus kontrollib `baseRev`-i ja on terviklik; ebaõnnestunud kirjutus ei muuda faili. Olemas on `failNext`, `setReadOnly`, edukate dokumendi-/vaatekirjutuste loendurid ning koopia, migratsioonieelne täisvarukoopia ja taastamine. Need on mälusimulatsioonid, mitte tõend päris failisüsteemi või SQLite'i töökindlusest.
- `SaveCoordinator` salvestab 1,5 s pärast viimast muudatust, hiljemalt 10 s pärast esimest. Dokument ja vaade käivad ühes järjekorras; poolelioleva kirjutuse ajal tekkinud uuem olek läheb faili kohe järgmise kirjutusega. `baseRev` muutub ainult eduka kirjutuse järel. Viga jätab päevikuread ja musta vaate alles ning punane olek püsib kuni eduni.
- `ProjectService` järjestab loomise, avamise, sulgemise, koopia, taastamise ja selgesõnalise `flush`-i. Avamine kontrollib versiooni, teeb enne migratsiooni täisvarukoopia, käivitab päris `migrateDoc`-i, valideerib skeemi/invariandid ja alles siis laeb dokumendi uue `sessionId`-ga. Uuem vorming ja vigane fail ei lae mootorit; ebaõnnestunud uus avamine jätab eelmise projekti alles.
- Sulgemine ja projektivahetus kontrollivad pärast `await flush()`-i samas jätkus veel kord salvestuse puhtust. Viimasesse Promise-vahemikku sattunud edukas käsk salvestatakse enne `unload/load`-i. Salvestuse tõrke korral jääb aktiivne dokument alles.
- Päästekoopia võib jätkata ka pärast algse faili salvestustõrget. Kutsuja annab kaasa uusima dokumendi, vaate ja logi; koopia tegemise ajal lisandunud käsud jäävad mällu ning salvestatakse uude faili. Kirjutatava koopia puhul säilivad mootoriseanss ja undo-ajalugu; kirjutuskaitstud lähtefaili koopia laeb sama dokumendi uude kirjutatavasse seanssi.
- Juba kirjutuskaitstuna avatud projekti vaadet võib mälus muuta ilma faili kirjutamata ja sulgemist blokeerimata. Kirjutatav päästekoopia saab selle vaate kaasa. Kui fail muutub kirjutuskaitstuks alles poolelioleva kirjutuse ajal, säilib õige salvestusviga ja projekt jääb sulgemata.

### Muudetud failid

| Koht | Sisu |
|---|---|
| `packages/engine/src/ports.ts`, `index.ts` | pordid, sisemised andmekujud ja avalikud ekspordid |
| `packages/engine/src/save-coordinator.ts` | ajastus, üks kirjutusjärjekord, logi/vaate korduskatse ja seansi kontroll |
| `packages/engine/src/project-service.ts` | elutsükkel, valideerimine, migratsioon, koopia ja vabastamata lukkude korduskatse |
| `packages/adapters/src/{storage-memory,index}.ts`, `package.json` ja lukufail | mälusalvesti, ühised lukud ja tööruumisõltuvused; uusi väliseid sõltuvusversioone pole |
| `packages/engine/src/{project-service,save-coordinator,project-lifecycle}.test.ts`, `__tests__/project-helpers.ts` | päris mootori/hoidla integratsioonid, blokeeritud I/O ning Promise-vahemike regressioonid |
| `packages/adapters/src/storage-memory.test.ts` | lukk, revisjonivõrdlus, tõrked, muutumatus, varukoopia/taastamine |
| See üleandmine ja põhikausta STATUS | jooksev seis; kuus stardifaili on eraldi töö |

### Tegelikud kontrollid

| Käsk või katse | Tulemus |
|---|---|
| Esmased testid enne teostust | **27/27 kukkus** puuduvate tehaste/teostuse tõttu; seejärel mälusalvesti **4/4** ja projektihalduse/salvestuse **23/23** läbisid. |
| Esmane `pnpm.cmd check`, 12:27 | **245/245 testi**, 24 faili; kõik viis väravat läbisid. |
| Sõltumatu ülevaatuse regressioonid enne parandusi | **7 kukkus, 1 läbis**. Kinnitati hiline andmekadu sulgemisel/avamisel, kaotatud luku vabastamise korduskatse ning kirjutuskaitstud vaate põhjustatud sulgemistõrge. |
| Samad regressioonid pärast parandusi | **8/8 läbis**. Promise-vahemiku katsed läbivad nii sulgemise kui avamise 13 ajastusega (0–12 jätku). |
| Vigase ajastuse seadistuse lisakontroll | Uus katse kukkus enne parandust; teenus valideerib ja kopeerib ajastuse nüüd juba loomisel, enne faili avamist. Elutsükli testifail läbis seejärel **9/9**. |
| Lõplik `pnpm.cmd check`, 12:52 | **254/254 testi**, 25 faili. Mõlemad TypeScripti kontrollid, ESLint, sõltuvusreeglid ja failipikkus läbisid; 78 moodulit, 243 sõltuvust, 0 rikkumist. |
| Osa A vastuvõtukäsk `pnpm.cmd test packages` | **230/230 testi**, 21 faili, Vitesti Node'i keskkonnas. Tootmise backend kompileerub eraldi ilma DOM-i ja Node'i globaalideta. |
| `pnpm.cmd install --frozen-lockfile --offline` | **Läbis** kõigi 10 tööruumi projekti peal; pärast seda sõltuvusi ei muudetud. |
| Vormindus, dokumendid ja tööpuu | `format:check` ja `git diff --check` läbisid; BB dokumentide kontrollfunktsioon läbis tööpuus 26 ja põhikaustas 25 faili. Ülesande diff on 14 faili, HEAD `a00e17f`, commit'iks lisatud sisu puudub ning kuus stardifaili on jälgimata. |

**Kasutaja kaks rõhutatud katset:**
- Poolelioleva esimese salvestuse ajal tehti **50 edukat käsku/tagasivõtmist**. Lõpuks on failis täpselt mootori dokument `rev: 51`, kõik 51 logirida (neist 16 undo), kirjutused kasutavad paare `baseRev/rev = 0/1` ja `1/51`, korraga kirjutab üks hoidlaoperatsioon.
- Poolelioleva salvestuse ajal käivitatud `close` ootab seda kirjutust. Faili muutmine kirjutuskaitstuks annab `storage/read_only`; mootoris jääb „Unsaved“ alles, failis on vana dokument. Kirjutuskaitse eemaldamisel õnnestub kordussulgemine koos säilinud logireaga.

### Sõltumatu ülevaatus ja parandusotsused

| Leid | Parandus ja tõend |
|---|---|
| P1: viimane edukas käsk võis `flush`-i ja `unload/load`-i vahel kaduda | `isClean` kontroll käib vahetult enne seansi lõpetamist samas jätkus; vajadusel korratakse salvestust. Sulgemise/avamise Promise-ajastused on regressiooniga kaetud. |
| P2: `repo.close` tõrke järel kadus luku vabastamiseks vajalik tunnus | Vabastamata hoidlatunnused säilivad eraldi kogumis. `close` ja `flush` proovivad neid uuesti ega teata ebaõnnestunud vabastamisest edu. Eduka projektivahetuse/koopia järel jääb uus projekt aktiivseks, vana luku tõrge on olekuteates kuni korduskatse eduni. Katsed katavad kõik kolm teed. |
| P2: kirjutuskaitstud projekti vaate muutmine takistas sulgemist | Sellise seansi vaade on mälus ega märgi faili mustaks; selle saab kirjutatavasse koopiasse kaasa võtta. Sulgemise, avamise ja koopia katsed läbivad. |

Ülevaataja ei muutnud faile ega indeksit. Ta kontrollis lisaks koopia ajal saabuvaid käske/vaadet 20 Promise-ajastusega ning tõrkuvat koopiat; andmed säilisid. Kõik kolm leidu parandati ühe RED→GREEN vooruga; uut sõltumatut ülevaatust pärast parandusi ei väideta.

### Plaanis lahtiseks jäetud valikud ja piir

- Hoidla `create` ja `copy` päringud laiendavad UI päringuid `projectId` ja dokumendiga, koopial ka vaate/päevikuga. Sisemised koondpäringud annavad edasi ülesannete 10/11 Rusti andmevoole vajalikud andmed; `projectId` loomine kutsuja ID-porti kasutades on teostusvalik, mis tuleb Rusti sisendiga sidumisel arvesse võtta. Avalikku `ProjectService` lepingut ei muudetud.
- `StorageError` kannab `reason`-it ja vajadusel `actualRev`-i. Revisjonikonflikt annab `flush`-i vastuses olemasoleva `stale_rev` vea, kuid olekuteates kasutatakse lepingus lubatud `unknown` põhjust. Võõrast revisjoni ei võeta automaatselt uueks `baseRev`-iks ega kirjutata sellest üle.
- Salvestuse tõrge jätab projekti mootorisse. Kui dokument on juba täielikult salvestatud, kuid hoidla käepideme vabastamine ebaõnnestub, on mootor suletud ja uued käsud keelatud; vabastamise tunnus säilib korduskatseks. See eristub salvestamata dokumendi sulgemistõrkest.
- Migratsioonikatses registreeritakse ajutiselt päris testmigratsioon domeeni `MIGRATIONS` tabelisse ja taastatakse tabel pärast katset. Tootmise tabelit ei muudetud; praegused moodulid migratsioone ei lisa. Vigaste tulevaste migratsioonifunktsioonide semantika, sealhulgas revisjoni muutmine, vajab oma migratsiooni testi/otsust.
- Mälusalvesti varukoopiad/koopia/taastamine ei ehita päris failide ajutise nime, ümbernimetamise, fotode, säilitustähtaja ega SQLite'i mehhanismi. Need kuuluvad ülesannetesse 10–11. UI ja inimese visuaalne vastuvõtt on alustamata.

**Vaate taastamise otsus:** arhitekt kinnitas `ProjectInfo.view: ViewState | null` lisamise. See on teostatud allolevas lepingutäpsustuses; eraldi laadimisteadet pole vaja.

### Ülesanne 6 · ProjectInfo.view lepingutäpsustus

**2026-11-08 · arhitekti otsus teostatud.** Arhitekt kinnitas salvestusloogika ja nõudis enne commiti laaditud vaate lisamist vastusesse.

- `packages/contracts/src/project-service.ts`: `ProjectInfo` sisaldab kohustuslikku `view: ViewState | null` välja. Tüübitest lukustab selle täpse kuju; M0 plaani ülesande 3 tüübirida on uuendatud.
- `create`, `open` ja `restore` tagastavad laaditud vaate või selle puudumisel `null`. Väärtus tuleb koordinaatori eraldatud koopiast, nii et vastuse muutmine ei muuda teenuse vaadet. Juba aktiivse faili avamine tagastab selle jooksva mälus oleva vaate.
- `copy` tagastab uusima mälus olnud vaate, ka siis, kui see muutus hoidlaoperatsiooni oodates. Koopiasse kaasa võetud vaade rakendatakse enne esimese olekuteate avaldamist; teate kuulaja tehtud veel uuemat muudatust ei kirjutata enam vana väärtusega üle. Poolelioleva koopia ajal tekkinud vaate eraldi salvestus säilib.
- Uus `project-view.test.ts` kontrollib loomist ilma vaateta, avamist/taastamist salvestatud vaatega, vaateta faili, juba aktiivset faili, mälus olnud uusimat koopia vaadet, asünkroonset koopiat ja olekukuulaja uuemat vaadet. Samuti kontrollitakse tagastusväärtuse eraldatust.

**Tegelik tõend:** enne muudatust kukkusid **8/8 uut testi** ja tüübitest (`ProjectInfo.view` puudus). Esmase väljalisa järel läbis 7 testi, üks kinnitas koopia olekukuulaja uuema vaate ülekirjutamist. Pärast teatejärjekorra parandust läbis **8/8**. Lõplik `pnpm.cmd check`, 16:51: **262/262 testi 26 failis**; mõlemad TS kontrollid, ESLint, sõltuvused (79 moodulit, 245 seost) ja failipikkus läbisid. Osa A `pnpm.cmd test packages` läbis **238/238 testi 22 failis Node'is**.

Vormindus, `git diff --check` ja dokumentide kontroll läbisid (tööpuus 26, põhikaustas 25 Markdown-faili). Kogu ülesande 6 diff on nüüd 18 faili; HEAD on `a00e17f`, commit'iks lisatud sisu puudub ja kuus stardifaili on endiselt jälgimata.

Sihitud sõltumatu lugemine kontrollis `ProjectInfo` kasutuskohti ja tuvastas koopia teatejärjekorra probleemi. Ülevaataja faile ei muutnud; paranduse tõend on eespool kirjeldatud regressioon.

**Arhitekti mitteblokeerivad märkmed hilisema plaani jaoks:**
- Vanem vorming kirjutuskaitstud kandjal annab praegu `read_only`. Koos esimese päris migratsiooniga tuleb otsustada mälus migreerimine ja kirjutuskaitstud avamine, äpi andmekausta tehtav varukoopia ning „Salvesta mujale…“ tee. M0-s pole tootmise migratsioone; praegust käitumist selles muudatuses ei muudeta.
- Vigase sisuga BB fail annab praegu `not_project`. Hiljem tuleb planeerida täpsem veateade ning taastamise tee: kirjutuskaitstud avamine koos vigade loendiga. Praegust valideerimist ei lõdvendata.

**Järgmine samm:** lepingutäpsustus on valmis kontrollimiseks ja kasutaja eraldi commit'i otsuseks. Commit, push ja `main`-i ühendamine pole tehtud; ülesanne 7 on alustamata.

### Ülesande 6 lõpetamine

Ülesande 7 alustamisel kinnitas Git ülesande 6 commiti `983e9c6` (`feat(engine): project service and save coordinator`). Haru on `m0`, jälgitav tööpuu oli puhas ja kuus stardifaili jäid jälgimata. Kasutaja lubas alustada ülesannet 7. STATUS-e varasem commiti ootel kirje asendati tegeliku Git-i seisuga.

## Ülesanne 7 · Kliendikiht

**2026-11-08 · Codex · valmis arhitekti ülevaatuseks.** Alus ja HEAD on `983e9c6`, haru `m0`, tööpuu `C:\Users\TRUMPIT\.codex\worktrees\bb-m0\BB`. Ülesanne 7 on commit'imata; ülesanne 8 on alustamata.

### Teostatud

- `EngineProvider` annab Reactile lepingu `DocumentEngine` ja `ProjectService` eksemplarid. `useEngine`/`useProjects` tagastavad süstitud teenused; puuduva provideri korral tekib tehniline `missing_engine_provider` erind.
- `useSnapshot(select)` tellib toorhetktõmmist React 18 `useSyncExternalStore` abil. Muutumatu viitega teavitus ei renderda tarbijat uuesti. Selektor arvutatakse pärast toorhetktõmmise lugemist ja memoiseeritakse hetktõmmise/selektori järgi, mistõttu objektina tagastatav valik ei tekita lugemis- ega renderdustsüklit.
- `session-filter.ts` eirab sama seansi sama või väiksema revisjoni hetktõmmist. Uus seanss võib alata väiksema revisjoniga; sulgemise tühi `sessionId` tühjendab vaate. Tellimuse payload ei kirjuta sünkroonset `engine.snapshot()` hetkeolekut üle.
- `useSaveStatus` võtab vastu ainult aktiivse mittetühja seansi teateid. Seansi/teenuse vahetus ei kanna vana viga kaasa; vana dokumendirevisjoni `saved` ei väida uuemat dokumenti salvestatuks. Enne tegelikku teadet ja avatud projektita tagastatakse `pending`; salvestusaega välja ei mõelda.
- Tellimused eemaldatakse unmount'il ja teenuseallikate vahetamisel, ka React StrictMode'i korral. Dokumendi sügav kirjutuskaitse säilib selektori tagastustüübis. Tootmiskliendis pole mootori, adapterite ega feature'i teostuse importi.

### Muudetud failid

| Koht | Sisu |
|---|---|
| `packages/client/src/{context,index}.ts` | provider, teenuste getter-hook'id ja paketi avalik API |
| `packages/client/src/{use-snapshot,use-save-status,session-filter}.ts` | välise oleku lugemine, olekuteated ja seansi/revisjoni filter |
| `packages/client/src/client.test.tsx`, `client.test-d.ts`, `__tests__/fakes.ts` | lepingu võltsallikatega Reacti testid ja kirjutuskaitse/geneerilise tüübi kontroll |
| `packages/client/package.json`, juure `package.json`, `pnpm-lock.yaml` | lepingu sõltuvus, React 18 peer ning lukustatud Reacti/DOM-i testivahendid |
| See üleandmine ja põhikausta STATUS | jooksev seis; kuus stardifaili jäävad eraldi |

### Tegelikud kontrollid

| Käsk või katse | Tulemus |
|---|---|
| `pnpm.cmd test packages/client` enne teostust | Pärast testide deklareeritud domeenisõltuvuse linkimist **17/17 testi kukkus**, kuna `EngineProvider` puudus. Varasemat lahendamata impordi viga ei loeta RED-tõendiks. |
| Sama käsk pärast teostust | **17/17 läbis** React 18 ja Testing Libraryga jsdom'is. Need on hook'i-/komponenditestid, mitte inimese visuaalne vastuvõtt. |
| `pnpm.cmd check`, 18:15 | **279/279 testi 27 failis**. Mõlemad TypeScripti kontrollid, ESLint, sõltuvusreeglid ja failipikkus läbisid; 88 moodulit, 270 sõltuvust, 0 rikkumist. `client.test-d.ts` kontrollib lepingut ja sügavalt readonly valikut päris `tsc` abil. |
| Sõltumatu ülevaatus | Luges tegelikku diffi ja teenuste avaldamisjärjekorda; parandamist nõudvaid vigu ei leidnud. Ülevaataja käivitas eraldi klienditestid **17/17** ning `git diff --check HEAD`; mõlemad läbisid. Faile/indeksit ei muutnud. |
| `format:check`, lukustatud paigaldus ja dokumendid | **Läbisid**: `pnpm.cmd install --frozen-lockfile --offline`, vormindus ning BB dokumentide kontrollfunktsioon (26 faili tööpuus, 25 põhikaustas). |
| Lõplik tööpuu | `git diff --check` läbis; 12 ülesande faili, HEAD `983e9c6`, commit'iks lisatud sisu puudub. Kuus stardifaili on endiselt jälgimata ja eraldi töös. |

Testid katavad muutumatu viitega teavituse, uue hetktõmmise, objektselektori, selektori vahetuse, sama/väiksema revisjoni, uue ja tühja seansi, vana teate, esialgse kordusteate, aegunud `saved`-revisjoni, StrictMode'i, unmount'i ja provideri allikavahetuse. Varasemad backend-testid on endiselt Node'i keskkonnas; ainult kliendi testifail valib jsdom'i.

### Teostusvalikud ja piir

- Pakett kasutab React **18.3.1** peer-sõltuvust; ReactDOM **18.3.1**, React 18 tüübid, Testing Library **16.3.3**/DOM **10.4.1** ja jsdom **31.0.0** on juure arendussõltuvustena täpselt lukustatud. Versioonide ja peer'ide sobivust kontrolliti ametlikust npm registrist. Eraldi selektori-shim'i ega uut transpordikihti ei lisatud.
- Selektori tulemuse võrdsusel põhinev täiendav renderduse vältimine pole M0 ülesande 7 nõue. Praegu lähtutakse hetktõmmise viitest; Reacti toorhetktõmmise lugemine ja selektori arvutamine on eraldi.
- Hiljem liituva staatuse tarbija saab algoleku praeguse `ProjectService.status()` sünkroonsest kordusteatest. Tüüpleping ise kordust/getter'it ei luba; teise teenuseteostuse lisamisel tuleb sama käitumine tagada või arhitektiga lepingut täpsustada. Kordusteateta jääb konservatiivne `pending` kuni tegeliku teateni.
- Avalikku lepingut, mootorit ega salvestusloogikat ei muudetud. SSR/hydration, kõik võimalikud katkestatud Concurrent Reacti järjestused ja päris brauseri visuaalne vastuvõtt pole selle üleandmisega tõendatud. Äpi ekraanid/disainisüsteem on järgmiste ülesannete töö.

### Kasutaja tellitud pluginaülevaatus

Plugin Managementi lugemispõhine ülevaatus ei tuvastanud BB praeguse töö jaoks vajalikku lisapluginat. Olemasolevad Superpowersi ja GitHubi võimalused toetavad ehitust/ülevaatust; Figma on saadaval visuaalse kavandi vajadusel, turvaülevaatuse vahendid eraldi kontrolliks ning Playwright/brauseri/arvuti tööriistad päris UI töövoogude katsetamiseks. Praegused hook'i-testid kasutavad kohalikku Vitesti ja Testing Libraryt. Pluginaid, ühendusi ega õigusi ei muudetud.

**Arhitektilt oodatav otsus:** „sobib“ või konkreetsed parandused ülesandele 7. Commit, push ja `main`-i ühendamine vajavad vastavat kasutaja luba; ülesannet 8 enne ülevaatuse otsust ei alustata.

## Ülesanne 8 · disainisüsteem ja kest

**Seis:** valmis arhitekti ülevaatuseks, commit'imata. Alus ja HEAD on `706651b`, haru `m0`; ülesande 7 vastuvõtu ja push'i kinnitas kasutaja. Ülesannet 9 ei alustatud.

### Teostatud

- `packages/ui/src/kit/`: `Button`, `Field`, `Panel`, native `Dialog`, kontrollitud `Toast`, tokenid, stiilid ja kohalikud Archivo/Martian Mono fondid. Toast kestab 2,5 s, korraga kuni kolm; väljatõrjutud teated eemaldatakse järjekorrast.
- `packages/ui/src/shell/`: `AppShell`, `TopBar`, `SaveStatus`, `ErrorBar`, `CloseDialog`, juure ja paneeli `ErrorBoundary`, klaviatuuriga/hiirega muudetavad paneelilaiused. Kõik selle ülesande kasutajale nähtavad tekstid on `shell/i18n/et.ts`-is; toorvea sisu ekraanile ei jõua.
- `UiRegistry` kontrollib moodulite ja iga toetatud laienduskoha id-de unikaalsust ning tagastab eraldatud koopiad. M0 liides toetab navigaatorit, kontekstisektsioone ning üla-/alariba. Tulevaste lõuenditööriistade jm lepinguid ette ei loodud.
- Zustandi `useSessionStore` hoiab valikut; `useViewStore` paneelide laiusi, vahekaarti, konteksti avatust ja teemat. Projektivahetusel valik nullitakse ning renderdamine filtreerib vana seansi valiku juba enne efekti käivitumist.
- `Ctrl+Z`, `Ctrl+Y` ja `Ctrl+Shift+Z` töötavad väljaspool vormivälju, muudetavat teksti ja avatud modaalakent. Ka Meta töötab. Vahekaardid toetavad nooli/Home/End ning vahekaardi vahetus ei muuda valikut.
- Hele/tume/süsteemi teema, põhitekst ja numbrifont, nähtav klaviatuurifookus. Kõrgused 52/48 px, paneelid 300/340 px koos 06 piiridega; alla 1280 px avaneb kontekst valikul ülekattena.
- Paketi ekspordid: `@pcbk/ui`, `@pcbk/ui/styles.css`, `@pcbk/ui/fonts`. Rakenduse koostekoht peab importima stiilid ja fondid. Lisandusid Zustand **5.1.0**, mõlemad Fontsource-paketid **5.3.0** ning otse määratud Vite **8.3.6** brauseri eelvaate jaoks; versioonid on lukustatud.

### Tegelikud kontrollid

| Kontroll | Tulemus |
|---|---|
| Testid enne teostust | Kit: **7/7** kogutud testi kukkus funktsionaalsuseta karkassi vastu. Olek/registrid/klahvid: **11/16** kukkus; ülejäänud juhtumid ei vajanud vastavat puuduvat käitumist. Kesta esimene käivitus peatus puuduval `AppShell`-i impordil, seega seda ei loeta kogutud käitumistestide arvuks. |
| Leitud vigade regressioonid | Vana valik uues seansis, nooleklahviga vahekaardivahetus ja modaalaknast lekkinud ajalooklahv: igaühel eraldi **RED → GREEN** tõend. |
| `pnpm.cmd check`, 2026-11-08 18:50 | **319/319 testi 33 failis**; mõlemad TypeScripti kontrollid, ESLint, sõltuvusreeglid ja failipikkus läbisid. 121 moodulit, 379 seost, 0 rikkumist. UI 40 testi on jsdom'is; backend jääb Node'i. |
| Sõltumatu lõppülevaatus | **40/40 UI-testi 6 failis**, diff kontroll puhas; uusi parandamist nõudvaid leide pole. Ülevaataja faile ei muutnud. |
| `pnpm.cmd format:check` | Läbis. |
| `pnpm.cmd install --frozen-lockfile --offline` | Läbis. |
| BB dokumendikontroll | **26 faili tööpuus, 25 põhikaustas**, probleeme ei leidnud. |
| Lõplik tööpuu | `git diff --check` läbis; **36 ülesande faili**, HEAD `706651b`, commit'iks lisatud sisu puudub. Kuus stardifaili jäävad sellest tööst välja. |
| Chromium, päris brauser | Kontrollitud hele/tume teema 1440 × 900 ja kitsas paigutus 1100 × 700; ribad 52/48 px, paneelid 300/340 px, horisontaalset ülevoolu pole. Kitsas vaates kattis 340 px kontekst lõuendit ega vähendanud selle laiust. Kohalikud WOFF2 fondid laadisid samalt päritolult. |
| Dialoog ja vead brauseris | Sulgemise tekstid/kolm tegevust, `Esc` katkestus ja fookuse tagastus avanupule; salvestusviga näitas püsivat riba, uuesti proovimine taastas salvestatud oleku. Tahtlik paneelikrahh jättis kesta kasutatavaks. |

Brauserikatse kasutas eraldatud arenduse eelvaadet ja lepingupõhiseid testandmeid kaustas `.superpowers/sdd/M0-vundament/ui-preview/`, mitte tulevase `apps/web`-i teostust ega päris projekte. Pildid on kohalikus ignoreeritud `output/playwright/` kaustas. See on ehitaja kontroll, **inimese visuaalne vastuvõtt on veel tegemata**.

### Ülevaatuse parandused ja piir

1. Vana valik ei jõua uue seansi kontekstilaiendusse; vastasel juhul võis uus paneel jääda veaseisu ka pärast valiku puhastamist. Parandus on regressioonitestiga ning ülevaataja kinnitas ka kitsas vaates ülekatte lähtestamise.
2. Heleda põhinupu teksti kontrast oli prototüübi `#fff8f2` korral 4,46 : 1; toetav `--accent-ink` on heledas teemas nüüd valge. Dokumendi 06 määratud `--accent` jäi samaks. Tumeda logo tekst kasutab `--ink`-i, roheline jääb ikoonile. Muudatuste eesmärk on 06 nõutud vähemalt 4,5 : 1 tekstikontrast.
3. Paneelieraldaja fookuses on 2 px aktsendivärvi joon; ülariba laiendused asuvad ülaribas. Dialoogi hõivatud toimingud on keelatud ning katkestamine ei käivita salvestamata sulgemist.

**Arhitektile enne ülesande 9 ühendustööd:**

- `DocumentEngine`/`Snapshot` ei avalda praegu ajaloo saadavust. Kest võtab `canUndo`/`canRedo` sisendina, et tühja ajaloo nupud saaks keelata; väärtusi ta ei mõtle välja. Ettepanek: kinnitada üks autoriteetne saadavuse allikas mootori avalikus lepingus või muu arhitekti valitud lahendus. Dokumenti, revisjoni ja mootorilepingut selle töö käigus ei muudetud.
- Praegune `ViewState` sisaldab ainult `navigatorWidth` ja `navigatorTab`. `restore()`/`getView()` kasutavad täpselt neid. Konteksti laius/avatus ja teema säilivad praegu UI mälus; nende püsimine pärast äpi sulgemist pole teostatud. Kui see on juba M0 vastuvõtu nõue, tuleb arhitektil täpsustada lepingu või üldseadete omanik; salaja uut salvestusteed ei lisatud.

Lõuend on plaani kohaselt tühi paneel. Komponentide päris vormid, projektiekraanid ja veebisalvestus kuuluvad ülesandesse 9; jalgu, mõõtmisi ega skeemi ei joonistata. Jalamarkerite visuaalset vastavust ei väideta enne vastava lõuenditöö teostust. Taaste-/failidialoogide tegelikud toimingud ühendab rakenduse koostekoht; siin on kontrollitud callback'ide käivitamine.

**Arhitektilt oodatav otsus:** „sobib“ või konkreetsed parandused ülesandele 8, lisaks eeltoodud ühenduskohtade täpsustus enne ülesannet 9. Commit, push ja `main`-i ühendamine vajavad kasutaja luba. Kuus stardifaili jäävad eraldi tööks.

## Ülesanne 9 · veebisalvestus ja esimese komponendi töövoog

**Seis:** valmis arhitekti ülevaatuseks, commit'imata. Alus ja HEAD on `82ef22e`, haru `m0`. Kasutaja kinnitas ülesande 8 commit'i/push'i ja lubas ülesandega 9 jätkata Gemini ülevaatust ootamata. Ülesannet 10 ei alustatud; `main` jäi muutmata.

### Teostatud ja muudetud kohad

- `packages/adapters/src/storage-web.ts` ja kaks testifaili: `idb-keyval`-il põhinev `ProjectRepository`. Projekt on üks `project:web://<projectId>` kirje (`meta`, `doc`, `rev`, `view`, `journal`). Loomine, CAS-salvestus ja vaate muutmine kasutavad atomaarset `update()` tehingut; dokumendi ja päeviku kirjutus õnnestuvad koos. Veakoodid vastavad olemasolevale pordile.
- `recents()`/`removeRecent()` kasutavad `localStorage`-i indeksit (kuni 20 kaarti). Indeksi tõrge ei muuda õnnestunud projekti salvestust ebaõnnestunuks. Eraldi `listProjects()` loeb **kõiki** sobivaid IDB projektikirjeid, et vanemad või viimaste indeksita projektid jääksid avatavaks. Vigaseid kirjeid ei kustutata. Veebikirje valikuline `meta.updated_at` säilitab tegeliku dokumendi muutmisaja; avamine ja vaate muutmine seda ei uuenda.
- `packages/ui/src/shell/{StartScreen,NewBoardDialog}.tsx`, stiilid ja testid: avaleht, viimaste projektide kaardid, brauserisse salvestatud projektide avamisloend, kohe kasutatav uue plaadi vorm. Vaikimisi nimi kasutab kohalikku kuupäeva; tühja nimega saab alustada. Fotoala/näidisprojekt ei kuulu M0-sse.
- `packages/features/components/ui/`: `createComponentsUi(ids)`, komponentide loend ja lisamine, omadused, jalgade nimed, NC, jala lisamine/eemaldamine. Tähis, tüüp, märgistus, väärtus, märkused, tuvastatud/DNP on muudetavad. Tekstimustand kinnitub blur/Enteriga ühe käsuna; `Esc` katkestab. Uue komponendi väärtus ja märgistus on päriselt tühjad, teegi vihje on ainult placeholder. Kõik uued tekstid on `et.ts`-is.
- `packages/features/project/ui/index.tsx`: projekti UI moodul, sh salvestust ootav avalehele naasmine. `apps/web/src/{engine,ui}.features.ts` loetlevad moodulid; `runtime.ts` on ainus mootori, adapteri ja UI kokku panemise koht. M1+ väljad on registris reserveeritud.
- `apps/web/`: päris Reacti rakendus, käivitamine/ehitamine ja kuus Playwrighti vastuvõtukatset. `EngineProvider` annab UI-le olemasolevad lepingud. Navigaatori laius/vahekaart salvestuvad `ProjectService.saveView` kaudu, avamisel taastub `ProjectInfo.view`.
- Toetuse puudumisel on koopia/taastamise nupud keelatud ja selgitusega. `Dialog.closeDisabled` väldib katkestamist ajal, kui pooleliolevat kirjutust ei saa tühistada. Ühine `useTheme()` hoiab teema ka avalehel; eraldi kasutatav `AppShell` haldab teemat vaikimisi ise.
- Manifestid/ekspordid, lukufail, Playwrighti veebiserveri seadistus ja Vitesti rakendustestide kaasamine. Vitesti korraga töötavate protsesside piir on nüüd 4: varasem 37 faili korraga käivitamine põhjustas ühe olemasoleva TypeScripti alamprotsessitesti ajalimiidi. Kontrolli sisu ega ajalimiiti ei nõrgendatud.

### Tegelikud kontrollid

| Kontroll | Tulemus |
|---|---|
| Kolm plaani e2e-testi enne rakenduse teostust | **3/3 kogutud testi kukkus** tühjal serveeritud lehel puuduva „Uus plaat“ tegevuse tõttu; mitte puuduva testimooduli impordi tõttu. |
| Üksuste TDD | Adapter 18 RED → 21 GREEN; kõigi projektide loend 3 RED → GREEN, ajatemplid veel 3 RED → GREEN; adapter kokku **26/26**. Projektiekraanid 10 RED → GREEN, lisaregressioonidega **12/12**. Komponendid 7 RED → **12/12 GREEN**. Ajalooümbris **3 RED → 3 GREEN** päris mootoriga. |
| `pnpm.cmd check`, 2026-11-08 22:42 | **373/373 testi 38 failis**; mõlemad TS kontrollid, ESLint, sõltuvusreeglid ja failipikkus läbisid. 156 moodulit, 501 seost, 0 rikkumist. Backend-testid jäävad Node'i; UI-testid valivad jsdom'i. |
| `pnpm.cmd e2e`, sama lõppkontroll | **6/6 Chromiumis**. Põhijada R1 → R7 → undo → R1 → redo → R7 → reload → avalehelt taasavamine; uue komponendi tühjad väljad; navigaatori laius säilib otse reload'i järel; salvestustõrke järel ühekordne teadlik loobumine; projektide leidmine puuduva viimaste indeksiga; tume teema säilib avalehele naastes. Laiusekatse lisakinnitus: undo jääb keelatuks ka enne reload'i (**eraldi kordus 1/1**). |
| `pnpm.cmd --filter @pcbk/web build` | Läbis; Vite 8 tootmisjärgu ehitis sisaldab kohalikke fonte. |
| Sõltumatud ülevaatused | Salvestuse/ühenduse ja UX-i eraldi lugemised. Ülevaataja kordas 21 projekti leidmisvea päris Chromiumis. Pärast kolme parandust integratsiooni kordusülevaatus puhas, **43/43 sihitud testi**. Viimane teema paranduse e2e-tõend on ehitaja oma. |
| Vormindus ja lukufail | `pnpm.cmd format:check`, `pnpm.cmd install --frozen-lockfile --offline` ja `git diff --check` läbisid. |
| BB dokumendikontroll ja tööpuu | Tööpuus **26** ning põhikaustas **25** faili: probleeme pole. Ülesande ulatus **48 faili**, HEAD `82ef22e`, commit'iks lisatud sisu pole; kuus stardifaili on eraldi töö. |
| Päris väljalaske ehitise vaatlus | Avaleht, loomine, lisamine, nimetamine, undo/redo, märgistus/väärtus, taasavamine, hele/tume ning 1100 × 700 ülekate. Horisontaalset ülevoolu ega väliseid ressursipäringuid ei olnud; brauseri konsoolis **0 viga, 0 hoiatust**. Kasutati ainult eraldi sünteetilist projekti. |

### Leitud vead ja parandused

1. Viimaste 20 projekti kasutamine ka avamisloendina muutis vanema salvestatud projekti kasutajale kättesaamatuks. Täielik IDB loend on nüüd sellest eraldi; ka `localStorage`-i indeksi kadumine ei peida projekti. Adapteri ja UI regressioonid olid enne parandust punased; ühendust kontrollib e2e.
2. „Sulge salvestamata“ jättis brauseri lahkumishoiatuse aktiivseks ja küsis teist kinnitust. Päris sünteetilise kvooditõrkega e2e näitas **RED (1 lisakinnitus) → GREEN (0)**; teadlik loobumine kasutab eraldi lippu. Salvestatud vana dokument jääb muutmata ja uus komponent kaob ainult kasutaja valitud loobumisel.
3. Poolelioleva loomise sai dialoogist katkestada, kuid hilisem vastus avas projekti ikkagi. Katkestamine on mittekatkestatava kirjutuse ajal keelatud; vea korral saab uuesti proovida. Kogutud regressioon kukkus enne parandust ja läbib nüüd.
4. Avalehele naasmine eemaldas tumeda teema, kuigi eelistus oli UI mälus alles. Teema rakendatakse nüüd UI juures, mitte üksnes töölauda kuvavas komponendis. E2e **RED → GREEN**. See ei lisa eelistuse kettale salvestamist.
5. Väärtuse väli kasutab monofonti, loendi numbrid vähemalt 10,5 px ning abitekstid kontrastsemat `--ink-2` värvi vastavalt 06 nõuetele.
6. Viimaste kaardi kuupäev muutus avamisajaks ka siis, kui dokument ei muutunud. Kaart kasutab nüüd sama püsivat muutmisaega nagu avamisloend. Täiendatud ajatesti **RED → GREEN**, adapteri lõppkordus **26/26** ja uus tootmisjärgu ehitus läbisid kell 22:46.

### Teostusvalikud, lepingupiir ja järgmine samm

- **Ajaloo saadavus:** avalikku `DocumentEngine`-i ei muudetud. `apps/web/src/history-availability.ts` on koostekoha delegeeriv ümbris: loendab ainult õnnestunud revisjoni kasvatavaid käske, undo/redo tulemusi ning arvestab `HISTORY_LIMIT`-iga. No-op ja vigane käsk säilitavad redo; uus seanss nullib loendurid. Kõik UI tarbijad ja projektiteenus saavad sama ümbrise, toormootor jääb koostekohta. Mootori sünkroonse snapshot'i järel avaldatakse saadavuse muutus eraldi, et nupud ei jääks sammu maha. M0-s on see testitud ühenduslahendus; käsugruppide või ajaloo poliitika muutmisel tuleb see asendada või arhitektiga lepingut täpsustada.
- **Vaate püsivus:** salvestatakse täpselt lepingu `navigatorWidth` ja `navigatorTab`. Konteksti laius/avatus ja teema püsivad selle äpiseansi UI mälus. Laiem 06 püsimisnõue vajab hilisemas plaanis omaniku/lepingu täpsustust; uut peidetud salvestusteed pole.
- **Veebi piir:** CAS väldib vana revisjoni ülekirjutamist, kuid pole eksklusiivne akendevaheline faililukk. Koopia, varukoopiad ja taastamine on adapteris toetamata (`unknown`) ning UI selgitab seda. Need on töölaua järgnevate ülesannete töö. Brauseri salvestus ei ole `.pcbk` fail kettal.
- **Sulgemine:** `ProjectService.close()` säilib muutmata ja tõrke korral ei minda avalehele. Veebis tähendab kasutaja „Sulge salvestamata“ kogu lehe taaslaadimist, mis lõpetab teenuse ja mäluseansi koos; eraldi `host.unload()`-i UI ei kutsu. Diagnostika allalaadimine annab praegu versiooni, aja ja revisjoni tehnilise kokkuvõtte, mitte töölaua tulevast vealogi.
- **UI piir:** lisamisdialoogi jalgade arv on 0–256 (täisarv), augu puhul 0; see on vormi praktiline piir, mitte domeeni uus invariant. Jalgu saab lisada käsitsi. Foto ja jalamarkerid/lõuenditööriistad tulevad M1-s, skeem M2-s.
- Sõltuvused on `idb-keyval` **6.3.0** ja testides `fake-indexeddb` **6.2.7**. Esmalt leitud 6.2.8 oli samal päeval avaldatud ja käivitas paigaldaja vanusepiiri; kasutusele võeti varasem versioon. Ühtegi vanusepiiri erandit ega turvapoliitika leevendust repo seadistusse ei jäetud.
- Osa B plaanitud teostus ja automatiseeritud vastuvõtt on valmis; inimese visuaalne vastuvõtt ja arhitekti otsus on veel tegemata. Kogu M0 pole valmis: Rust/Tauri osa C ja väljalase on järgmised.

Käivitamine arenduses: `pnpm --filter @pcbk/web dev`; kontrollid: `pnpm check`, `pnpm e2e`; ehitus: `pnpm --filter @pcbk/web build`.

**Arhitektilt oodatav otsus:** „sobib“ või konkreetsed parandused ülesandele 9. Commit, push ja `main`-i ühendamine ootavad kasutaja luba. Kuus stardifaili jäävad sellest commit'ist välja; ülesanne 10 on alustamata.

### Ülesanne 9 · arhitekti kolm parandust (2026-11-09)

**Seis:** parandused teostatud, uus ülevaatus ja inimese visuaalne vastuvõtt ootel. See jaotis asendab eespool kirjeldatud ajalooümbrise ning ainult kahe vaatevälja/mälus oleva teema lahenduse. Arhitekti otsused on dokumentides märgitud nõutud kujul „täpsustus 2026-11-08“; teostus ja kontrollid toimusid 2026-11-09. HEAD on endiselt `82ef22e`; commit'i, push'i ega ülesannet 10 pole tehtud.

1. **Ajaloo saadavus on mootoris.** `Snapshot.history` on sügavalt readonly/külmutatud `{ canUndo, canRedo }`. Käsk, undo/redo, laadimine ja mahalaadimine avaldavad õige oleku; tühi või tagasi lükatud käsk säilitab vana hetktõmmise ja redo. Mootor arvutab tulevase ajaloo oleku enne tõrkuda võivat ettevalmistust ning muudab ajalugu alles eduka commit'i osana. Kest loeb nupud ja klahvide saadavuse otse hetktõmmisest. `apps/web/src/history-availability.ts` ja selle test on eemaldatud; koostekohas teist loendurit enam pole.
2. **Mõlemad paneelid ja teema püsivad.** `ViewState` sisaldab nelja välja; `DEFAULT_VIEW_STATE` on `{ navigatorWidth: 300, navigatorTab: 'components', contextWidth: 340, contextOpen: true }`. Jagatud puhas `parseViewState` täidab puuduvad väljad, tagastab vigase vaate korral `null` ja eemaldab tundmatud väljad. Projekt avaneb ka vigase vaatega. UI, projektiteenus ja salvestuskoordinaator arvestavad kõiki nelja välja, ka ainult parema paneeli muutmist. Adapteri otsene vaatekirjutus eemaldab samuti lisaväljad/teema. Taastatud avatud paneel ei sulgu kitsas aknas automaatselt; valik saab ülekatte endiselt avada. Teema loetakse/kirjutatakse ainult UI `localStorage`-i võtmega `pcbk.theme`, `try/catch`-iga; puuduv/vigane eelistus annab `'system'` ning kirjutustõrge ei takista aktiivset valikut.
3. **Projektikaardi aeg on sekunditeta.** Kuupäev säilib ning kohalik aeg on `HH:MM`; masinloetav `datetime` jääb alles.

**Dokumendid ja tüübid:** uuendatud on `contracts`, tüübitestid, `03` § 6 (ja hetktõmmise kuju § 5), ADR-003 lepingu koodiplokk/reeglid ja M0 plaani ülesanne 3. Vaikeväärtused ja leebe parser asuvad ühes kohas; `format_version` ei muutunud.

| Tegelik kontroll | Tulemus |
|---|---|
| Ajaloo TDD ja atomaarne käitumine | **13 RED → GREEN**, lisaks sihitud ajaloo/tõrke regressioonid **48/48**. |
| Vaate TDD | Esmalt **31/44 RED**, otseste adapterikirjutuste lisatestid **2 RED**; backend'i lõppkontroll **133/133**. Vanad kaheväljalised ja vigased vaated avanevad nõutud kujul. |
| UI regressioonid | Teemamälu, denied-storage ja nelja välja taastamine RED → GREEN; kesta nuppude/taastatud kitsas paneeli regressioonid **2 RED → GREEN**. Sekunditeta kuupäeva test kukkus vana renderdusega ja läbib uuega. |
| `pnpm.cmd check`, 00:08 | **463/463 testi 43 failis**; mõlemad TypeScripti kontrollid, ESLint, sõltuvused **162 moodulit / 519 seost**, failipikkus läbisid. |
| `pnpm.cmd e2e`, lõppjooks | **8/8 Chromiumis**. Lisandusid teema püsimine täieliku reload'i järel ning parema paneeli laiuse/avatuse taastumine. Viimane kontroll loeb ka IDB-sse jõudnud nelja välja vaate. |
| Paneeli e2e kordus | **5/5**. Ühes varasemas koondjooksus alustas test reload'i enne asünkroonse sulgemise lõppu; test ootab nüüd avalehe valmimist ja kontrollib püsivat vaadet enne taaslaadimist. Katset ei muudetud leebemaks ega lisatud fikseeritud und. |
| Sõltumatu ülevaatus | Kolme otsuse ja nende ühenduste lugemine: uusi leide pole; **134/134 sihitud testi 10 failis**. Ülevaataja ei muutnud faile ega asendanud ehitaja e2e-kontrolli. |

Arhitekti mitteblokeeriv märkus salvestatud oleku avamisaja kohta jääb töölauasalvestusega täpsustamiseks; seda käitumist siin ei muudetud. Edasi: arhitekti kordusülevaatus ja kasutaja visuaalne vastuvõtt. Käivitamine repo juurest: **`pnpm --filter @pcbk/web dev`** (PowerShelli skriptipiirangu korral `pnpm.cmd --filter @pcbk/web dev`).


## M0-13 · CI ja Windowsi paigaldaja

Tööpuu `bb-m0`, haru `m0`, alus `92618f3`. Osa C on kohalikult kontrollitud ja arhitekti ülevaatusel.

- `.github/workflows/ci.yml` käivitab Windowsi kontrollid harude ja `v*` siltide pushidel ning PR-idel. `main` ja `v*` ehitavad pärast kontrolle artefakti `pcbk-msi`. Silt peab vastama Tauri versioonile. Sildi avaldamine on eraldi töö, sest GitHub Actions annab `contents: write` õiguse töö tasemel. `GH_TOKEN` antakse avaldamiskäsule, ülejäänud töövoo õigus on `contents: read`. [GitHub Actionsi õigused](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idpermissions)
- Ametlikud tegevused on lukustatud täispikkade commitiräsidega. `setup-node` automaatvahemälu on väljas, sest pnpm muutub kättesaadavaks pärast Corepacki seadistamist. Rusti sõltuvuste vahemälu võti sisaldab `Cargo.lock` räsi. [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0), [cache v5.0.5](https://github.com/actions/cache/releases/tag/v5.0.5), [upload-artifact v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2), [download-artifact v8.0.2](https://github.com/actions/download-artifact/releases/tag/v8.0.2)
- `apps/desktop/src-tauri/tauri.conf.json` ehitab `et-EE` MSI koos WebView2 võrguühenduseta paigaldajaga. `0.0.0` läbis ehituse ja jääb alles. `.gitignore` jätab töölaua ehitusväljundi ka juure vorminduskontrollist välja. [Tauri Windowsi paigaldaja](https://v2.tauri.app/distribute/windows-installer/)

| Kohalik kontroll | Tulemus |
| --- | --- |
| Node, Corepack, pnpm ja `pnpm install --frozen-lockfile` | Node `26.13.0`, Corepack `0.36.0`, pnpm `12.18.0`. Paigaldus läbis. |
| `pnpm check`, `pnpm test packages/engine` | **483/483** testi 47 failis ja **183/183** mootoritesti. Tüübikontroll, lint, sõltuvusreeglid, failipikkus ja API kontroll läbisid. |
| `pnpm format:check`, `pnpm exec prettier --check .github/workflows/ci.yml` | Läbisid. YAML parsimine ja tööde struktuurikontroll läbisid. `actionlint` puudus. |
| `pnpm exec playwright install chromium`, `CI=true pnpm e2e` | Chromium oli olemas. **8/8** kasutusvoogu uue kohaliku veebiserveriga. |
| `cargo fmt --check`, `cargo test --locked`, `cargo clippy --locked --features desktop -- -D warnings` | Kõik läbisid. **46/46** Rusti testi. Clippy jooksis kohalikult kahe paralleeltööga. |
| `pnpm tauri build` | Lõi `apps/desktop/src-tauri/target/release/bundle/msi/PCB Kaardistaja_0.0.0_x64_et-EE.msi` (**220 835 840 baiti**, **210,61 MiB**). Ehitus laadis alla WiX 3.14.1 ja Microsofti x64 WebView2 võrguühenduseta paigaldaja. |
| MSI andmebaasi lugemine | `ProductVersion=0.0.0`, `ProductLanguage=1061` (`et-EE`), pakendis `MicrosoftEdgeWebView2RuntimeInstaller.exe` ning `.pcbk` laiendi `open`-tegevus argumendiga `"%1"`. |

### M0 vastuvõtt · tingimus ja tõend

| Tingimus | Tõend ja seis |
| --- | --- |
| `pnpm check` | Kohalik kontroll läbis. GitHubi jooks ootab pushi. |
| UI ei impordi mootorit, mootoritestid Node’is | `depcruise.test.ts` ja sõltuvusreeglid läbisid koondkontrollis. Mootori testid Node’is **183/183**. |
| Uus plaat, komponent, nimetamine, undo/redo, sulgemine ja taasavamine | Veebi e2e **8/8**. Kasutaja proovis arendusäpis kahe komponendi loomist. Kogu paigaldatud töölaua voog ootab kasutuskatset. |
| Fail jääb kirjutuse katkestamisel avatavaks | Rusti `killed_writer_leaves_consistent_file` läbis. |
| Kirjutuskaitse või täis ketas, veariba, sulgemine ja „Salvesta mujale…“ | Salvestus- ja sulgemistõrke testid läbisid koondkontrollis. Töölaua visuaalne kontroll ootab kasutajat. |
| Sama faili teine avamine toob akna ette, teise protsessi lukk blokeerib avamise | `second_process_cannot_open_locked_file` läbis. MSI failiseos on pakendis. Exploreri topeltklõps ja fookus ootavad paigalduskatset. |
| `base_rev` ja vana `sessionId` | Rusti `save_rejects_wrong_base_rev` ja kliendi seansifiltri testid läbisid. |
| Omand ja invariandid | Mootori omandi- ja invariantide testid läbisid. |
| Undo kasvatab `rev`-i ning taastatud sisu salvestub | Mootori undo/redo ja salvestuskoordinaatori testid läbisid. |
| Vaade püsib ning salvestus hiljemalt 10 s | Salvestuskoordinaatori testid ja veebis vaate taastamise e2e läbisid. Töölaua visuaalne kontroll ootab kasutajat. |
| Täiskoopia enne migratsiooni ja taastamine uude faili | Projektiteenuse migratsioonitest ja Rusti `restore_creates_new_file_and_validates` läbisid. |
| CI loob MSI artefakti | Kohalik MSI on olemas. CI-d pole veel jooksutatud. |
| M0 kasutuskatse | Kasutaja paigaldab MSI, teeb komponendi töövoo, avab `.pcbk` faili Explorerist kaks korda ja kontrollib eemaldamist. Tulemus lisatakse pärast katset. |

Ülevaatuse järel ootab commit `ci: checks, rust tests and msi build` kasutaja luba. Kuus stardifaili jäävad commitist välja. Push ja GitHubi sisselogimine ootavad eraldi luba.
