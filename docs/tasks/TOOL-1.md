# TOOL-1 · Genereeritud liideste kokkuvõte (`pnpm api`)

**Olek:** vastu võetud `bbd3f09` · **Haru:** m0 · **Alus:** `7f1213c`

## Eesmärk
Ehitaja ja arhitekt saavad iga paketi avaliku liidese ühest lühikesest Markdown-failist ega pea lähtekoodi lugema. Fail tehakse koodist automaatselt. Kui keegi muudab avalikku liidest ja kokkuvõtet uuesti ei genereeri, kukub `pnpm check`. Seepärast ei saa kokkuvõte vananeda nagu käsitsi peetav koodikaart.

## Loe (ainult need)
- `docs/tasks/README.md#reeglid`: reegel 6 (miks see on vaja)
- `tooling/check-file-length.mjs` (m0 tööpuus): olemasoleva tööriistaskripti stiil ja CLI kuju

## Muuda
- Loo: `tooling/api-digest.mjs`, `tooling/api-digest.test.ts`, `tooling/fixtures/api-digest/…`, genereeritud `docs/api/*.md`
- Muuda: juure `package.json` skriptid (`api`, `api:check`; `check` lõppu lisandub `api:check`)

## Ära puutu
- Pakettide koodi ega avalikku API-t ei muudeta. See on ainult lugemistööriist.
- Rusti poolt ei loeta; Rusti DTO-d on juba TS-ina `packages/adapters/src/bindings/` kaustas ja lähevad kokkuvõttesse adapterite kaudu.

## Otsused ja liidesed
- **Sisendid** (sisenemispunktid; muud faile ei loeta):
  - `packages/<nimi>/src/index.ts` iga paketi kohta;
  - `packages/features/<moodul>/contract.ts`, `…/engine/index.ts` ja `…/ui/index.tsx`.
- **Väljund** on üks fail sisenemispunkti kohta: `docs/api/<pakett>.md`, moodulitel `docs/api/features-<moodul>-<osa>.md`.
  - Faili algus: `<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->`, pealkiri `# @pcbk/<pakett>` ja üks rida sisenemispunkti teega.
  - Iga eksporditud sümbol on eraldi jaotis `### \`nimi\``, et `bb_read_section` saaks tuua ühe sümboli.
  - Jaotise sisu on `ts`-koodiplokk ainult deklaratsiooniga, ilma funktsioonide kehadeta:
    - funktsioonil allkiri;
    - liidesel ja tüübil terve kuju;
    - konstandil tüüp;
    - klassil avalikud liikmed.
  - Deklaratsiooni kohal on JSDoc'i esimene lause, kui see on olemas.
  - Sümbolid on tähestiku järjekorras, et diff oleks stabiilne.
- **Teostus:** TypeScripti kompilaatori API (`ts.createProgram` + `TypeChecker`) ja juure `tsconfig.json`. Uusi sõltuvusi ei lisata.
- **CLI:**
  - `node tooling/api-digest.mjs` kirjutab failid;
  - `node tooling/api-digest.mjs --check` ei kirjuta midagi ja väljub koodiga 1, kui mõni fail erineb või puudub. Väljund nimetab erinevad failid ja ütleb „käivita pnpm api“.
  - Üleliigne vana fail kaustas `docs/api/` on samuti erinevus.
- **Maht:** kui mõni väljundfail ületab 400 rida, prinditakse hoiatus. See ei ole viga, aga viitab liiga laiale avalikule API-le.

## Tõend
- Testid (`tooling/api-digest.test.ts`, testandmetega ajutises kaustas):
  - `digest lists exported function signatures without bodies`;
  - `digest is sorted and stable across runs`;
  - `check fails when an exported signature changes and passes after regenerate`;
  - `check fails for a stale extra file in docs/api`;
  - `jsdoc first sentence is included`.
- Käsud:
  - `pnpm api` → `docs/api/` tekib;
  - `pnpm check` → läbib;
  - pärast suvalise eksporditud signatuuri muutmist kukub `pnpm api:check` (kontrolli käsitsi ja võta muudatus tagasi).

## Valmis kui
- [x] `docs/api/` sisaldab kõiki praeguseid sisenemispunkte ja `pnpm check` hõlmab `api:check`-i.
- [x] `docs/api/engine.md` sisaldab `createEngine`, `createProjectService` ja `EngineModule` allkirju.
- [x] Üleandmine on allpool, kuni 25 rida.

## Üleandmine
- Harus `m0` lisasin `tooling/api-digest.mjs`, viis CLI testi failis `tooling/api-digest.test.ts`, testprojekti kaustas `tooling/fixtures/api-digest/` ning 12 kokkuvõtet kaustas `docs/api/`.
- Juure `package.json` sisaldab käske `api` ja `api:check`. `pnpm check` käivitab lõpus `api:check`-i.
- Generaator kasutab kaardi sisenemispunkte ja TypeScripti kompilaatori deklaratsioone. Kompilaator lahendab edasi eksporditud sümbolid ja nende tüübiviited.
- `pnpm api` genereeris kuue paketi ja kuue mooduliosa kokkuvõtted. `engine.md` sisaldab kõiki kolme nõutud deklaratsiooni.
- `pnpm check` läbis 468/468 testi ja värskuskontrolli. Ka generaatori ja testifaili vormingukontroll läbis.
- Ajutises testprojektis andis muudetud signatuur käsule `pnpm api:check` veakoodi 1 ja faili nimi ilmus veateates. Kokkuvõtte sisu säilis. Algse signatuuri taastamisel läbis kontroll.
- `domain.md` (1435 rida) ja `ui.md` (485 rida) annavad üle 400 rea hoiatuse.
- Adapterite kokkuvõte kajastab avalikku eksporti. Rusti DTO-d jõuavad sinna siis, kui adapter neid oma sisenemispunktist ekspordib.
- Arhitekti parandusega on Zodi skeemid üherealised `ZodType<T>` deklaratsioonid ja `z.infer`-i objektitüübid näitavad välju. `pnpm api` andis `domain.md` mahuks 586 rida ja `ui.md` mahuks 448 rida. Zodi regressioonitest kordas viga ja läbib parandusega. `pnpm check` läbis 469/469 testi koos värskuskontrolliga.
- Kordusülevaatuse parandusega jätab Prettier `packages/adapters/src/bindings/` vahele ning generaator jaguneb CLI-ks (159 rida) ja `tooling/api-digest/render.mjs` failiks (339 rida). `pnpm format:check` ja `pnpm check` (469/469) läbisid. Pärast `pnpm api` kattusid kõigi 12 kokkuvõtte SHA-256 räsid ja Git-seis algsega, kus failid olid juba jälgimata.

## Arhitekti ülevaatus (2026-11-09)
Kontrollitud: `pnpm check` 468/468 koos `api:check`-iga läbib; skriptid, sisenemispunktid, sorteerimine ja värskuskontroll vastavad kaardile. **Vajab üht parandust, sest kokkuvõte peab olema loetav:**

1. **Zod-skeemid ja nende tüübid.** Praegu on `domain.md` 1435 rida, millest 580 rida on Zodi sisemisi tüüpe (`z.ZodObject<{ … z.ZodOptional<z.ZodString> … }>`). Samas näitab `BoardDoc` ainult `z.infer<typeof BoardDocSchema>`, mis ei ütle lugejale midagi. Tee vastupidi:
   - Zodi skeemi konstant on üks rida: `export const BoardDocSchema: ZodType<BoardDoc>` (väljundtüüp nimega, kui see on eksporditud);
   - `z.infer`-ist tuletatud tüüp näidatakse lahtikirjutatud struktuurina (`TypeChecker.typeToString` ilma kärpimiseta, mitmerealiselt vormindatud), nii et väljad on näha.
   - Test: `zod schema renders as one line and inferred type as its fields` (testandmetes väike skeem ja `type X = z.infer<…>`).
   - Oodatav tulemus: `domain.md` alla 600 rea. `ui.md` hoiatus (tekstid `et`) on lubatud.

Pärast parandust muuda olek `ülevaatusel` ja lisa üleandmisse üks rida.

### Kordusülevaatus (2026-11-09)
Zodi parandus on õige: `BoardDoc` ja `Measurement` näitavad nüüd oma välju, skeemid on ühel real ja `domain.md` on 586 rida. `pnpm check` 469/469 läbib. Kaks väikest asja enne vastuvõttu:

1. **`pnpm format:check` kukub** neljal ts-rs failil `packages/adapters/src/bindings/*.ts`, mis tulid M0-10 commitiga (arhitekt jättis selle M0-10 ülevaatusel kontrollimata). Need on genereeritud failid: lisa `packages/adapters/src/bindings/` faili `.prettierignore`. Ära vorminda neid käsitsi, sest `cargo test` kirjutaks need tagasi.
2. **`tooling/api-digest.mjs` on 489 rida** ja annab failipikkuse hoiatuse. Jaga kaheks failiks: näiteks `tooling/api-digest/render.mjs` (deklaratsioonide vormindus) ja õhuke CLI `tooling/api-digest.mjs`. Käitumine ja väljund jäävad samaks; `pnpm api` ei tohi `docs/api/` sisu muuta.

Tõend: `pnpm check`, `pnpm format:check` ja `pnpm api` (`git status docs/api` puhas). Siis olek `ülevaatusel` ja üks üleandmisrida.
- Arhitekti lõppkontroll (2026-11-09): `.prettierignore` jätab `bindings/` vahele; generaator on 159 + 339 rida (failipikkuse hoiatust pole); `pnpm api` väljund jäi baidipealt samaks; `pnpm check` 469/469 ja `pnpm format:check` läbivad. Lubatud hoiatused: `domain.md` 586 ja `ui.md` 448 rida. **Otsus: sobib.** Commit ootab kasutaja luba.
