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
