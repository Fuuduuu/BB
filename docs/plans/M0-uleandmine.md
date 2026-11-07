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
