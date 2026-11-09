# M0 · Vundament ja esimene komponent: teostusplaan

> **Ehitajale (Codex):** täida see plaan ülesande kaupa oskusega `superpowers:executing-plans` (või `superpowers:subagent-driven-development`). Sammud on märkeruutudega (`- [ ]`). Iga ülesande lõpus anna töö üle arhitektile (Claude). Järgmist ülesannet alusta alles pärast arhitekti otsust „sobib“. Plaan on otsuste kogum: kus plaan jätab valiku lahti, tee mõistlik valik ja kirjuta see üleandmisse.

**Eesmärk:** paigaldatav töölauaäpp, kus saab luua projekti, lisada ja nimetada komponendi, tagasi võtta ja uuesti teha, sulgeda ja uuesti avada, ilma andmekaota ka vigade ja katkestuste korral.

**Arhitektuur:**
- Frontend (React) ja backend (sünkroonne TypeScripti mootor + Rusti host) on eraldi pakettides. UI näeb mootorit ainult lepingu kaudu.
- Dokument on Immeri külmutatud puu. Käsud kontrollitakse skeemi, omandi ja invariantide järgi.
- Salvestab ainult `SaveCoordinator` ühte SQLite-faili, millel on eksklusiivne lukk.
- Esimene päris moodul on `components`.

**Tehnoloogia:** Node.js 26 LTS, pnpm (corepack), TypeScript 5 strict, React 18, Vite, Zustand, Immer, zod, Vitest, Testing Library, Playwright, ESLint, Prettier, dependency-cruiser, Tauri 2, Rust (rusqlite `bundled`, ts-rs).

**Spetsifikatsioon:**
- [ADR-002](../adr/ADR-002-typescript-tauri.md), [ADR-003](../adr/ADR-003-frontend-backend.md), [ADR-004](../adr/ADR-004-kaks-vaadet-ja-uhendused.md);
- [03 arhitektuur](../03-arhitektuur.md) (§ 2–6, 9–12, 14), [04 andmemudel](../04-andmemudel.md), [05 moodulid](../05-moodulid.md), [07 › M0](../07-teekaart.md#m0--vundament-ja-esimene-komponent).

Kui plaan ja need dokumendid lähevad lahku, kehtivad dokumendid ja ehitaja küsib arhitektilt.

## Globaalsed piirangud

- **Keel ja tüübid:** TypeScript `strict: true` ja `noUncheckedIndexedAccess: true` kõigis pakettides; `any` ainult kommentaariga põhjendatud kohas.
- **Failipikkus:** üle 400 rea annab hoiatuse, üle 600 rea vea (`tooling/check-file-length.mjs`); erand ainult genereeritud failidele (`*.gen.ts`, `bindings/`).
- **Sõltuvusreeglid:** täpselt [03 § 2](../03-arhitektuur.md#sõltuvusreeglid-dependency-cruiser-ja-eslint-ci-s-kohustuslik) tabeli järgi. `features/*/ui` ei impordi `engine`-it ega `features/*/engine`-it.
- **Paketinimed:** `@pcbk/domain`, `@pcbk/contracts`, `@pcbk/engine`, `@pcbk/client`, `@pcbk/ui`, `@pcbk/adapters`, `@pcbk/features`. Rakendused on `apps/desktop` ja `apps/web`.
- **Pakettide ehitus:** paketid on sisemised lähtekoodi paketid (`"exports"` viitab `.ts` failile); eraldi ehitussammu pole.
- **Versioonid:** `package.json` välja `"packageManager"` jaoks lukusta täpne pnpm versioon, mille corepack paigaldab. Kõik sõltuvused lukustatakse (`pnpm-lock.yaml`, `Cargo.lock`). React jääb 18. majoriks.
- **Id-d:** `<prefiks>_<nanoid(10)>` ([04 › Põhimõtted](../04-andmemudel.md#põhimõtted)); jala eksemplar on `pin_…`. Uue objekti id loob kutsuja, mitte käsu `run`.
- **Tekstid:**
  - kõik kasutajale nähtavad tekstid on failis `packages/ui/src/shell/i18n/et.ts`;
  - mootor tagastab ainult veakoode;
  - numbrid kümnendkomaga;
  - kellaaeg on kujul `HH:MM` kohaliku aja järgi.
- **Konstandid** (failis `packages/domain/src/constants.ts`):
  - `HISTORY_LIMIT = 200`;
  - `SAVE_DEBOUNCE_MS = 1500`, `SAVE_MAX_WAIT_MS = 10000`;
  - `DOC_BACKUP_INTERVAL_MS = 1_800_000`, `BACKUP_KEEP = 5`;
  - `CURRENT_FORMAT_VERSION = 1`.
- **Asukohad:**
  - projektifailid vaikimisi `%USERPROFILE%\Documents\PCB Kaardistaja\`;
  - äpi andmed `%APPDATA%\PCB Kaardistaja\` (alamkaustad `backups\<project_id>\`, `logs\`; fail `recent.json`).
- **Tauri:**
  - `productName` on „PCB Kaardistaja“ ja `identifier` on `ee.pcbkaardistaja.desktop`;
  - võrguõigust pole, CSP keelab välised skriptid;
  - failisüsteemi õigus on ainult kasutaja valitud failidele ja äpi andmekaustale;
  - fondid Archivo ja Martian Mono on kaasa pakitud (`@fontsource`).
- **Arendusaegne vorming:** kuni v1.0 väljalaseni on `format_version` 1 ja skeem võib kasvada ilma migratsioonita; arendusfailid ei pea omavahel ühilduma. Migratsioonimehhanism ehitatakse siiski M0-s ja seda testitakse testmigratsiooniga.
- **Git:**
  - töö käib harus `m0`, mille kasutaja M0 alguses lubab;
  - iga ülesanne on üks commit (Conventional Commits) pärast ehitaja enda kontrolle;
  - `main`-i ühendamine ja push toimub ainult pärast arhitekti „sobib“ ja kasutaja luba;
  - teise tegija pooleliolevaid faile ei muudeta.
- **Ülevaatus:** üleandmine on `docs/plans/M0-uleandmine.md` lõppu lisatav lõik:
  - ülesande number;
  - muudetud failid;
  - jooksutatud käsud ja nende tegelik väljund (läbis või kukkus);
  - kõrvalekalded plaanist ja nende põhjus;
  - avatud küsimused.

## Ülevaatuse fookus

Need viis olukorda on spetsifikatsiooniga kaudselt nõutud, kuid muidu ühegi ülesande testis ei esineks. Igaüks on lisatud vastava ülesande testidesse.

1. **Täpitähtede ja tühikutega teed** (`…\Documents\PCB Kaardistaja\Plaat õäöü (2).pcbk`, kasutajanimi „Kasutaja“) peavad looma, avama, salvestama ja koopiat tegema nagu tavaline tee (Ülesanne 10, test `opens_and_saves_path_with_estonian_letters_and_spaces`).
2. **Fail, mis pole BB projekt** (suvaline fail nimega `.pcbk`, katkine SQLite), annab selge vea `storage(not_project)` ning faili ei kirjutata ega lukustata jäädavalt (Ülesanne 10, test `rejects_non_project_file_without_writing`).
3. **Kiire käskude ja tagasivõtmiste jada salvestuse ajal:** 50 käsku ja tagasivõtmist, mille vahel üks kirjutus on pooleli. Lõpuks on kettal sama `rev` ja sisu mis mootoris (Ülesanne 6, test `burst during in-flight save ends with disk equal to engine`).
4. **Sulgemine salvestuse ajal**, kui samal hetkel muutub fail kirjutuskaitstuks: aken ei sulgu, tuleb dialoog ja andmed on mälus alles (Ülesanne 6, test `close during in-flight save waits and reports read_only`; Ülesanne 12 suitsukontroll).
5. **Päevavahetus kohaliku aja järgi:** päeva esimese avamise täiskoopia arvestab kohalikku kuupäeva, mitte UTC-d (Ülesanne 11, test `daily_backup_uses_local_date_across_midnight`).

## Failide struktuur

```
package.json  pnpm-workspace.yaml  tsconfig.base.json  eslint.config.js  .prettierrc  .dependency-cruiser.cjs
tooling/check-file-length.mjs  tooling/depcruise.test.ts  tooling/fixtures/depcruise/…
packages/domain/src/      constants.ts  ids.ts  model/*.ts (zod-skeemid 04 järgi)  components/refs.ts
                          components/pins.ts  doc.ts (newBoardDoc)  migrations/index.ts
packages/contracts/src/   result.ts  errors.ts  snapshot.ts  document-engine.ts  project-service.ts  index.ts
packages/engine/src/      engine.ts  history.ts  ownership.ts  invariants.ts  journal.ts  registry.ts
                          items.ts  ports.ts  project-service.ts  save-coordinator.ts  index.ts
packages/client/src/      use-snapshot.ts  use-save-status.ts  session-filter.ts  index.ts
packages/ui/src/kit/      Button.tsx Field.tsx Panel.tsx Dialog.tsx Toast.tsx tokens.css fonts.ts
packages/ui/src/shell/    AppShell.tsx TopBar.tsx SaveStatus.tsx ErrorBar.tsx CloseDialog.tsx StartScreen.tsx
                          NewBoardDialog.tsx ErrorBoundary.tsx UiRegistry.ts session-store.ts view-store.ts
                          keymap.ts i18n/et.ts
packages/adapters/src/    storage-memory.ts  storage-web.ts  storage-tauri.ts
packages/features/project/    contract.ts  engine/index.ts  ui/index.tsx
packages/features/components/ contract.ts  engine/index.ts  engine/commands.ts  ui/index.tsx  ui/ComponentList.tsx
                              ui/ComponentSection.tsx  components.test.ts
apps/web/       index.html  src/main.tsx  src/engine.features.ts  src/ui.features.ts  e2e/m0.spec.ts
apps/desktop/   index.html  src/main.tsx  src/engine.features.ts  src/ui.features.ts
apps/desktop/src-tauri/  Cargo.toml  tauri.conf.json  capabilities/default.json  src/main.rs  src/ipc.rs
                         src/storage/{mod,db,schema,copy,backup,restore,recent}.rs  src/logging.rs
                         tests/{storage,lock,copy_backup}.rs  src/bin/test_writer.rs
.github/workflows/ci.yml
docs/plans/M0-uleandmine.md
```

---

## Osa A · Mootor ilma kasutajaliideseta

Osa lõpus jooksevad kõik mootori ja domeeni testid Node'is ilma DOM-ita: `pnpm test packages`.

### Ülesanne 1: Monorepo ja kvaliteediväravad

**Failid:**
- Loo: juurfailid ülaltoodud struktuuri järgi, `tooling/check-file-length.mjs`, `tooling/depcruise.test.ts`, `tooling/fixtures/depcruise/packages/features/demo/ui/bad.ts`, `tooling/fixtures/depcruise/packages/engine/src/index.ts`.

**Liidesed:**
- Toodab: juurskriptid `pnpm check` (järjest `typecheck`, `lint`, `depcruise`, `filelength`, `test`), `pnpm test`, `pnpm e2e`.
- `.dependency-cruiser.cjs` reeglid on nimedega `domain-pure`, `contracts-no-impl`, `engine-no-ui`, `ui-not-engine`, `feature-ui-not-engine`, `feature-engine-no-ui`, `client-no-engine`, `adapters-no-ui`.

- [ ] **Samm 1: kirjuta kukkuv test** `tooling/depcruise.test.ts`:
  ```ts
  test('feature UI importing engine is a violation', async () => {
    const r = await cruiseFixture('tooling/fixtures/depcruise');
    expect(r.violations.map(v => v.rule.name)).toContain('feature-ui-not-engine');
  });
  test('file length gate', () => {
    expect(checkLength(lines(401))).toBe('warn');
    expect(checkLength(lines(601))).toBe('error');
    expect(checkLength(lines(400))).toBe('ok');
  });
  ```
- [ ] **Samm 2:** `pnpm test tooling` → KUKUB (reeglid ja skript puuduvad).
- [ ] **Samm 3:** loo workspace, `tsconfig.base.json`, ESLint (flat config), Prettier, dependency-cruiser reeglid (`baseDir` toetab fixture'it) ja `checkLength(lineCount): 'ok'|'warn'|'error'`.
- [ ] **Samm 4:** `pnpm test tooling` → LÄBIB; `pnpm check` → LÄBIB (tühjad paketid).
- [ ] **Samm 5:** commit `chore: set up monorepo and quality gates`; üleandmine.

### Ülesanne 2: Domeenimudel (`@pcbk/domain`)

**Failid:**
- Loo: `packages/domain/src/{constants,ids,doc}.ts`, `model/*.ts`, `components/refs.ts`, `components/pins.ts`, `migrations/index.ts`.
- Test: `packages/domain/src/**/*.test.ts`.

**Liidesed:**
- Toodab:
  - `BoardDocSchema` ja kõik tüübid [04 › Tüübid](../04-andmemudel.md#tüübid) järgi (terve skeem, ka veel ehitamata osad);
  - `type DocKey = keyof BoardDoc`;
  - `newBoardDoc(name: string): BoardDoc`;
  - `refPrefix(kind: ComponentKind): string`;
  - `nextRef(doc: BoardDoc, kind: ComponentKind): string`;
  - `defaultPinIds(kind: ComponentKind, pinCount?: number): string[]`;
  - `newId(prefix: IdPrefix): string`;
  - `migrateDoc(raw: unknown, from: number, migrations?: Migration[]): unknown`, kus `Migration = { from: number; up(doc: unknown): unknown }`;
  - `MIGRATIONS: Migration[]`, mis on M0-s tühi.
- **`newBoardDoc` vaikeväärtused:**
  - `format_version: 1`, `rev: 0`, `status: 'mapping'`;
  - `scale: { pxPerMm: 10, calibrated: false }`;
  - `roles` = 04 vaikerollid;
  - `measureSettings: { voltageTolerancePct: 10, voltageToleranceMinV: 0.1 }`;
  - kõik loendid tühjad, `guide: { skipped: [] }`.
- **Tähise prefiksid:**

  | Tüüp | Prefiks |
  |---|---|
  | `resistor` | R |
  | `capacitor`, `capacitor_polarized` | C |
  | `inductor` | L |
  | `diode`, `led`, `zener` | D |
  | `npn`, `pnp`, `nmos`, `pmos` | Q |
  | `regulator`, `ic` | U |
  | `connector` | J |
  | `crystal` | Y |
  | `switch` | SW |
  | `fuse` | F |
  | `testpoint` | TP |
  | `via` | VIA |
  | `pad` | PAD |
  | `wire_point` | W |
  | `hole` | H |
  | `other` | X |

  `nextRef` annab väikseima vaba positiivse numbri (tähised võrreldakse tõstutundetult).
- **Vaikimisi jalad** (kui `pinCount` puudub):
  - kahejalgsed passiivsed ja `crystal`: `["1","2"]`;
  - `npn`, `pnp`, `nmos`, `pmos`, `regulator`: `["1","2","3"]`;
  - `testpoint`, `via`, `pad`, `wire_point`: `["1"]`;
  - `hole`: `[]`;
  - `ic`, `connector`, `switch`, `other`: `pinCount` järgi, vaikimisi `[]`.

- [ ] **Samm 1: kirjuta kukkuvad testid**:
  ```ts
  test('new doc is valid', () => expect(BoardDocSchema.safeParse(newBoardDoc('Plaat 2026-11-07')).success).toBe(true));
  test('nextRef fills the smallest gap', () => {
    const doc = withComponents(['R1', 'r3']);              // abifunktsioon testis
    expect(nextRef(doc, 'resistor')).toBe('R2');
    expect(nextRef(doc, 'capacitor_polarized')).toBe('C1');
  });
  test('default pins', () => {
    expect(defaultPinIds('resistor')).toEqual(['1', '2']);
    expect(defaultPinIds('ic', 8)).toHaveLength(8);
    expect(defaultPinIds('hole')).toEqual([]);
  });
  test('schema rejects component without pins array', () => { /* kustuta pins → success false */ });
  test('migrateDoc runs chained test migration', () => {
    const m: Migration[] = [{ from: 0, up: d => ({ ...(d as object), format_version: 1, upgraded: true }) }];
    expect(migrateDoc({ format_version: 0 }, 0, m)).toMatchObject({ format_version: 1, upgraded: true });
  });
  ```
- [ ] **Samm 2:** `pnpm test packages/domain` → KUKUB.
- [ ] **Samm 3:** kirjuta skeemid ja funktsioonid. `Component.board` ja `Component.schematic` on valikulised; `Measurement.at/ref` on `MeasuredPin`.
- [ ] **Samm 4:** testid → LÄBIVAD.
- [ ] **Samm 5:** commit `feat(domain): board document model and helpers`; üleandmine.

### Ülesanne 3: Leping (`@pcbk/contracts`)

**Failid:**
- Loo: `packages/contracts/src/{result,errors,snapshot,document-engine,project-service,index}.ts`.
- Test: `packages/contracts/src/contracts.test-d.ts` (Vitest `expectTypeOf`).

**Liidesed:**
- Toodab [ADR-003 › Leping](../adr/ADR-003-frontend-backend.md#leping) liidesed täpselt sealsete nimedega: `DocumentEngine`, `Snapshot`, `ProjectService`, `EngineError`.
- **Abitüübid:**
  - `Result<T, E> = { ok: true; value: T } | { ok: false; error: E }` koos `ok()` ja `err()`;
  - `CommandOk = { rev: number }`;
  - `StorageReason = 'disk_full' | 'read_only' | 'missing' | 'locked' | 'not_project' | 'too_new' | 'unknown'`;
  - `SaveStatus = { state: 'saved'; rev: number; at: string } | { state: 'pending' } | { state: 'saving' } | { state: 'error'; reason: StorageReason }`;
  - `ViewState = { navigatorWidth: number; navigatorTab: string; contextWidth: number; contextOpen: boolean }` (M0; täpsustus 2026-11-08), vaikeväärtused `300`, `'components'`, `340`, `true`;
  - `ProjectInfo = { projectId: string; sessionId: string; name: string; path: string; readOnly: boolean; view: ViewState | null }`;
  - `CreateReq = { name: string; device?: string; problem?: string; path?: string }`;
  - `OpenReq = { path: string }`;
  - `CopyReq = { dest: string; identity: 'same' | 'new' }`;
  - `BackupInfo = { file: string; kind: 'full' | 'doc'; at: string; base?: string }`;
  - `RestoreReq = { backup: string; dest: string }`.
- `Snapshot.doc` ja `Snapshot.derived` on tüübiga `DeepReadonly<…>` (rekursiivne, sh massiivid).
- `Snapshot.history: DeepReadonly<{ canUndo: boolean; canRedo: boolean }>` pärineb mootorist pärast käsku, undo/redo-d, laadimist ja mahalaadimist; tühi käsk jätab hetktõmmise samaks (täpsustus 2026-11-08).
- `DEFAULT_VIEW_STATE` ja puhas `parseViewState(unknown): ViewState | null` ühtlustavad leebe lugemise: puuduvad väljad saavad vaikeväärtused, vigane vaade annab `null` ega peata projekti avamist. Teema on UI `localStorage`-is võtmega `pcbk.theme`, `try/catch`-iga ja vaikimisi `'system'`; projekti faili ei lähe.
- `Derived` on M0-s `{ unplacedBoard: string[]; unplacedSchematic: string[] }` (komponentide id-d).

- [ ] **Samm 1: kirjuta tüübitest**:
  ```ts
  expectTypeOf<Snapshot['doc']['components'][number]['pins']>().toMatchTypeOf<readonly unknown[]>();
  // @ts-expect-error doc on sügavalt kirjutuskaitstud
  (null as unknown as Snapshot).doc.components[0]!.pins.push({} as never);
  expectTypeOf<DocumentEngine['execute']>().returns.toEqualTypeOf<Result<CommandOk, EngineError>>();
  ```
- [ ] **Samm 2:** `pnpm typecheck` → KUKUB.
- [ ] **Samm 3:** kirjuta liidesed. Pakett ei sisalda olekut; puhtad abifunktsioonid on `ok()`, `err()` ja vaate leebe parser ning vaate vaikeväärtused (täpsustus 2026-11-08).
- [ ] **Samm 4:** typecheck → LÄBIB.
- [ ] **Samm 5:** commit `feat(contracts): engine and project service contracts`; üleandmine.

### Ülesanne 4: Dokumendimootor (`@pcbk/engine`)

**Failid:**
- Loo: `packages/engine/src/{engine,history,ownership,invariants,journal,registry,items,index}.ts`.
- Test: `packages/engine/src/engine.test.ts`.
- Muuda selles ülesandes: `packages/domain/src/ids.ts` (`IdPrefix` saab `'chk'`), `packages/domain/src/ids.test.ts` (`newId('chk')`) ja [04 prefiksite loend](../04-andmemudel.md#põhimõtted) (`chk_` lisatakse `txt_` järele). Need muudatused kuuluvad ülesande 4 commit'i koos invariantidega, mitte ülesande 2 parandusse.

**Liidesed:**
- Tarbib: `@pcbk/domain` (skeemid, `DocKey`), `@pcbk/contracts`.
- **Toodab:**
  - `createEngine(opts: { modules: EngineModule[]; clock: Clock; reserved?: DocKey[] }): { engine: DocumentEngine; host: EngineHost }`;
  - `interface EngineModule { id: string; dependsOn?: string[]; owns?: DocKey[]; commands?: CommandSpec<any>[]; derive?: DeriveSpec[]; migrations?: Migration[] }`;
  - `interface CommandSpec<P> { id: \`${string}.${string}\`; title: string; params: z.ZodType<P>; run(draft: Draft<BoardDoc>, params: P, ctx: CommandCtx): void; alsoWrites?: DocKey[]; summary?(params: P, doc: BoardDoc): string }`;
  - `interface EngineHost { load(sessionId: string, doc: BoardDoc, readOnly: boolean): void; unload(): void; current(): { sessionId: string; rev: number; doc: BoardDoc } | null; drainJournal(): JournalEntry[]; requeueJournal(entries: JournalEntry[]): void }`;
  - `JournalEntry = { at: string; kind: 'command' | 'undo' | 'redo'; commandId: string; requestId?: string; source: 'user'; summary: string }`.
- **`execute` järjekord** on täpselt [03 § 6](../03-arhitektuur.md#6-käsud-tagasivõtmine-ja-logi) järgi:
  1. zod (viga `validation`);
  2. kirjutuskaitse (viga `read_only`);
  3. `produceWithPatches`;
  4. omand (viga `ownership`);
  5. invariandid (viga `validation`);
  6. avaldamine ja ajalugu;
  7. logi;
  8. `rev + 1`;
  9. teavitus;
  10. sündmused.

  Undo ja redo suurendavad samuti `rev`-i.
- **Tühi käsk ei loo versiooni (arhitekti otsus):** kui õnnestunud käsu Immeri paigad on tühjad, tagastatakse `ok({ rev: senine })`. Dokument, ajalugu ja päevik ei muutu, redo-haru säilib, tellijaid ei teavitata ja puhverdatud sündmused visatakse ära.
- **Omandi kontroll:** iga paiga `path[0]` peab olema käsu mooduli `owns` või käsu `alsoWrites` hulgas. `reserved` väljad (veel ehitamata moodulite omad) on kõigile keelatud. `rev` ja `format_version` on tuuma omad ja käsk neid ei muuda. Kontroll **ei sõltu** `NODE_ENV`-ist.
- **M0 invariandid:**
  - dokumendi objektikirjete id-d on unikaalsed kõigis loendites, mitte ainult komponentidel; viite kordumine ei ole uus objekt ega duplikaat;
  - objekti id algab alloleva tüübile vastava prefiksiga ja selle järel on vähemalt üks märk. Täpselt kümmet nanoid-märki ei nõuta: fikseeritud vaikerollide id-d ja muu pikkusega imporditud id-d jäävad lubatuks. `newId` genereerib endiselt kümne märgiga juhuosa;
  - `ref` on mittetühi ja tõstutundetult unikaalne;
  - jala id on komponendi sees unikaalne;
  - jala `uid` on projektis unikaalne ja prefiksiga `pin_` koos mittetühja lõpuga. Jala inimesele loetav `id` (`"1"`, `"EP"`, `"x1"` jne) ei vaja prefiksit ning võib eri komponentides korduda;
  - mõõtmisel `overload === true` välistab `value` olemasolu, ka `value: 0`. See reegel ei lisa nõuet, et kõigil teistel mõõtmistel peab arvväärtus olema;
  - `beep` võib olla määratud ainult režiimis `continuity`; see kehtib nii `true` kui ka `false` kohta.

  | Objekt / loend | Prefiks |
  |---|---|
  | `components` | `cmp_` |
  | `junctions` | `jun_` |
  | `connections` | `con_` |
  | `netLabels` | `lbl_` |
  | `roles` | `rol_` |
  | `measurements` | `msr_` |
  | `repairs` | `rep_` |
  | `photos` | `pho_` |
  | `dimensions` | `dim_` |
  | `areas` | `are_` |
  | `textNotes` | `txt_` |
  | `importChecks` | `chk_` |
  | jala `uid` | `pin_` |

  `att_` jääb manuse prefiksiks, kui manus hiljem dokumenti lisandub; ülesanne 4 ei lisa puuduvat andmetüüpi. Mõõtmiste ajaloolised kontaktiviited võivad endiselt viidata kustutatud jalale; need ei ole uued jalaobjektid.

  **Lisakontrollid sammule 1 (arhitekti otsus pärast ülesande 2 vastuvõttu):**
  - `overload: true` koos `value: 0` ja muu arvväärtusega lükatakse tagasi; `overload: true` ilma `value`-ta on lubatud;
  - `beep: true` ja `beep: false` lükatakse tagasi kõigis kolmes muus režiimis; läbivusrežiimis on mõlemad lubatud;
  - iga objektitüübi vale prefiks ning tühi lõpp (nt `cmp_`) lükatakse tagasi; lühike mittetühi lõpp ja fikseeritud vaikerollide id-d on lubatud;
  - korduvad objektide id-d, komponendi sees korduv jala id ning projektis korduv jala `uid` lükatakse tagasi; sama jala id eri komponentides ja korduvad viited samale jalale on lubatud;
  - iga tagasilükatud invariant tagastab `validation` ning jätab dokumendi, `rev`-i, ajaloo ja päeviku muutmata;
  - `newId('chk')` toodab `chk_` prefiksi ja kümne märgiga juhuosa; invariant ise ei seo imporditud id-sid selle pikkusega.
- **Üldkäsk `items.delete({ ids: string[] })`** kustutab M0-s ainult komponente. See on registreeritud tuumas koos `alsoWrites: ['components']`.

- [ ] **Samm 1: kirjuta kukkuvad testid** (testmoodul `demo` omab välja `name`, kahjulik moodul `evil` proovib muuta `components`-i):
  ```ts
  test('invalid params → validation, nothing changes', …expect(res).toEqual({ ok: false, error: expect.objectContaining({ code: 'validation' }) }); expect(engine.snapshot().rev).toBe(0));
  test('ownership violation is rejected in production too', () => {
    process.env.NODE_ENV = 'production';
    const res = engine.execute('evil.touch', {});
    expect(res.ok).toBe(false); expect(res.ok || res.error.code).toBe('ownership');
    expect(engine.snapshot().doc.components).toHaveLength(0); expect(host.drainJournal()).toHaveLength(0);
  });
  test('duplicate ref breaks invariant → rejected', …);
  test('undo and redo raise rev', () => { exec(); exec(); engine.undo(); engine.redo(); expect(engine.snapshot().rev).toBe(4); });
  test('history keeps 200 steps', () => { for (210×) exec(); let n = 0; while (engine.undo().ok) n++; expect(n).toBe(200); });
  test('subscribers get the same frozen reference', () => {
    let seen: Snapshot | undefined; engine.subscribe(s => (seen = s)); exec();
    expect(seen).toBe(engine.snapshot());
    expect(() => { (seen!.doc.components as any).push({}); }).toThrow();
  });
  test('read-only session rejects commands with read_only', …);
  test('journal entry per command with requestId', …);
  test('items.delete with absent id preserves rev, history and journal', …);
  test('empty command after undo preserves redo and discards buffered events', …);
  ```
- [ ] **Samm 2:** `pnpm test packages/engine` → KUKUB.
- [ ] **Samm 3:** teosta mootor. Immeri `autoFreeze` peab olema sees. Ajalugu hoiab paiku (`patches`, `inversePatches`), mitte koopiaid.
- [ ] **Samm 4:** testid → LÄBIVAD.
- [ ] **Samm 5:** commit `feat(engine): synchronous document engine with ownership and invariants`; üleandmine.

### Ülesanne 5: Moodulite register ning moodulid `project` ja `components` (mootori pool)

**Failid:**
- Loo: `packages/engine/src/registry.ts` (kui ülesandes 4 puudus), `packages/features/project/{contract.ts,engine/index.ts}`, `packages/features/components/{contract.ts,engine/index.ts,engine/commands.ts,components.test.ts}`.

**Liidesed:**
- **Registri kontrollid** ([03 § 4](../03-arhitektuur.md#4-moodulisüsteem)):
  - unikaalsed id-d;
  - `dependsOn` moodulid on olemas ja tsükleid pole;
  - käskude id-d ei kattu;
  - iga `BoardDoc` väli on täpselt ühe mooduli `owns`, tuuma või `reserved` all;
  - `alsoWrites` viitab olemasolevatele väljadele.

  Viga visatakse käivitusel klassina `RegistryError`.
- **`project`** omab välju `name`, `device`, `problem`, `status`, `mappedAt`, `mappedSnapshot` ja `importChecks`. Käsud:
  - `project.rename({ name: string })` (`name` tühjendatud tühikutest, 1–120 märki);
  - `project.setInfo({ device?: string; problem?: string })`.
- **`components`** omab välja `components`. Käsud:
  - `components.add({ id, kind, ref?, pins: { id: string; uid: string }[], marking?, value? })`; kui `ref` puudub, on `ref = nextRef`. `marking` ja `value` on vaikimisi `''`, `identified: false`, `dnp: false`, `note: ''`;
  - `components.update({ id, ref?, kind?, marking?, value?, note?, dnp?, identified? })`;
  - `components.addPin({ id, pin: { id: string; uid: string } })`;
  - `components.renamePin({ id, pinId, name: string | null })`;
  - `components.setNc({ id, pinId, nc: boolean })`;
  - `components.removePin({ id, pinId })`.
- **Sihtmärk ja tähis (arhitekti ülevaatuse otsus):** mootor ekspordib `CommandTargetNotFound(id)` klassi ning teisendab selle veaks `{ code: 'not_found', id }`; muud erindid jäävad `validation`-iks. Puuduva jala tunnus on `<komponendi id>:<jala id>`. Lisamise ja muutmise `ref` skeem on `z.string().trim().min(1)`; invariant ja automaatne tähise leidmine võrdlevad tähiseid kujul `ref.trim().toUpperCase()`.
- **Leping (`features/components/contract.ts`):**
  - `selectComponents(s: Snapshot)`, `selectComponent(s, id)`;
  - `makeAddComponent(ids: IdGen, kind: ComponentKind, pinCount?: number): AddComponentParams`, mis loob `cmp_` id ja iga jala jaoks `pin_` uid.
- **Reserveeritud väljad M0-s:** `photos`, `activePhotoId`, `scale`, `junctions`, `connections`, `netLabels`, `roles`, `measurements`, `measureSettings`, `repairs`, `areas`, `dimensions`, `outline`, `textNotes`, `guide`.

- [ ] **Samm 1: kirjuta kukkuvad testid**:
  ```ts
  test('registry rejects a field with two owners', () => expect(() => buildRegistry([a, b])).toThrow(RegistryError));
  test('registry rejects unowned, unreserved field', …);
  test('add without ref gets R1 then R2', …expect(refs()).toEqual(['R1', 'R2']));
  test('add keeps value and marking empty', …expect(c.value).toBe(''); expect(c.marking).toBe(''));
  test('update to an existing ref is rejected', …code 'validation');
  test('items.delete then undo restores same pin uids', () => {
    const before = uids(); engine.execute('items.delete', { ids: [id] }); engine.undo(); expect(uids()).toEqual(before);
  });
  test('removePin then addPin with same number gets a new uid', …expect(newUid).not.toBe(oldUid));
  test('rename project trims and rejects empty', …);
  test('missing component or pin → not_found with target id, document and rev unchanged', …);
  test('add and update trim refs and reject a spaced case-insensitive duplicate', …);
  test('loading rejects duplicate refs ignoring spaces; automatic refs skip spaced legacy values', …);
  ```
- [ ] **Samm 2:** testid → KUKUVAD.
- [ ] **Samm 3:** teosta register ja mõlema mooduli mootori pool.
- [ ] **Samm 4:** testid → LÄBIVAD; `pnpm depcruise` → 0 viga.
- [ ] **Samm 5:** commit `feat(components): first engine module with registry checks`; üleandmine.

**M1 plaanimärkmed (ei blokeeri M0):**
- Koos esimese moodulitevahelise lepinguimpordiga lisa kontroll, et imporditav moodul on `dependsOn` loendis. Praegune sõltuvuskontroll seda tingimust veel ei kontrolli; M0 moodulite vahel sellist importi pole.
- Kui plaadipaigutus on olemas, peab käsitsi lisatud jala eemaldamine koristama ka selle `customPads`-i ning jalale viitavad `padMap`-i kirjed.
- **Stseeni pööre ja peegeldus ning uus komponent (M1.2):** kui stseenile on rakendatud `PhotoRef.transform`, peab uus komponent ekraanil ilmuma püstiselt ja loetavalt. Paigutustööriist kompenseerib uue komponendi algse `rotationDeg` stseeni pöördega; peegelduse korral valib algse `side`-i nii, et jalg 1 on ekraanil vasakul üleval. Juba paigutatud komponendid peegelduvad ja pöörduvad koos fotoga, sest need peavad päris korpusega kohakuti jääma. EXIF-pööret pikslitesse ei küpsetata, sest koordinaadid on originaalfoto pikslites. Test: kõigi 8 teisenduse korral on uue SOIC-8 jalg 1 ekraanil vasakul üleval.
- **`ViewState` laieneb koos lõuendiga:** plaadi ja skeemi vaate teisendus (`zoom`, `pan`), kihtide nähtavus ning foto nähtavus ja kontrast. Leebe parser täidab vanades failides puuduvad väljad vaikeväärtustega.
- **Mõõtmise invariandid koos `measurements` mooduliga** (lisaks M0 `overload`/`value` ja `beep` reeglitele):
  - `value` on kohustuslik, välja arvatud `overload: true` korral;
  - `overload` on lubatud ainult takistusel ja dioodil;
  - läbivusel on `beep` ja `ref` kohustuslikud;
  - takistus on vähemalt 0.
  Pinge, takistuse ja dioodi `ref` jääb valikuliseks: äpp ei oleta musta sondi asukohta ja ilma selleta hinnangut ei anta.
- **M2 ühendused:** ühenduse otsad `a` ja `b` ei tohi olla sama ots (eneseühendus on invariandi viga). Lisandub ka 03 §6 viidete terviklus.
- **Muutuva jalaarvuga tüübid ilma korpuseta** (`ic`, `connector`, `switch`, `other`): lisamisdialoog pakub jalgade arvu ette (`ic` 8, `connector` 2, `switch` 2), kasutaja saab seda muuta. Domeeni `defaultPinIds` jääb samaks.
- **Gemini ülevaatus 2026-11-09:** UI pesade süsteem ja eraldi `@pcbk/client` pakett jäävad alles. `ui` ei tohi importida `features`-it, nii et moodulid peavad end kesta registreerima; kliendipakett on väike ja hoiab andmetele ligipääsu piiri selge.

### Ülesanne 6: Pordid, `storage-memory`, `ProjectService` ja `SaveCoordinator`

**Failid:**
- Loo: `packages/engine/src/{ports,project-service,save-coordinator}.ts`, `packages/adapters/src/storage-memory.ts`.
- Test: `packages/engine/src/project-service.test.ts`, `save-coordinator.test.ts`.

**Liidesed:**
- **Toodab pordid** [03 § 10](../03-arhitektuur.md#10-pordid-ja-adapterid) järgi ja lisab:
  - `ProjectRepository.backupFull(session: string, reason: 'migration'): Promise<void>`;
  - `OpenedProject = { session, projectId, path, doc: unknown, view: ViewState | null, formatVersion: number, readOnly: boolean }`;
  - `SaveReq = { session, baseRev, rev, doc: BoardDoc, journal: JournalEntry[] }`.

  Repositoorium viskab `StorageError { reason: StorageReason; actualRev?: number }`.
- **`createProjectService(opts: { engine: DocumentEngine; host: EngineHost; repo: ProjectRepository; clock: Clock; ids: IdGen; timing?: { debounceMs: number; maxWaitMs: number } }): ProjectService`.**
- **`open` järjekord:**
  1. `repo.open`;
  2. `format_version` suurem kui `CURRENT_FORMAT_VERSION` → viga `storage(too_new)` ja projekti ei laeta;
  3. väiksem → kõigepealt `repo.backupFull(session, 'migration')`, siis `migrateDoc`;
  4. `BoardDocSchema.parse`;
  5. `host.load(uus sessionId, doc, readOnly)`;
  6. ajalugu algab tühjalt.
- **`SaveCoordinator`:**
  - ajastus ja järjekord [03 § 9](../03-arhitektuur.md#salvestuse-vastutaja-savecoordinator-moodul-project) järgi;
  - `baseRev` = viimane edukalt kirjutatud `rev`;
  - logiread võetakse `host.drainJournal()`-iga ja vea korral pannakse tagasi `requeueJournal`-iga;
  - vaade (`saveView`) on eraldi märgitud muudatus ja eraldi kirjutus;
  - olekuteated kannavad `sessionId`-d;
  - `close()` teeb kõigepealt `flush()`; kui see ebaõnnestub, tagastab vea ega laadi seanssi maha.
- **`storage-memory`** jagab salvestit kahe eksemplari vahel. See simuleerib lukku (teine `open` sama tee peale annab vea `locked`), `base_rev` võrdlust ja tõrkeid (`failNext(reason)`, `setReadOnly(path, true)`) ning loendab kirjutusi.

- [ ] **Samm 1: kirjuta kukkuvad testid** (Vitest võltstaimeritega):
  ```ts
  test('saves 1.5 s after last command', …advance(1499) → writes 0; advance(1) → writes 1);
  test('continuous work saves within 10 s', …command every 1 s for 12 s → first write at ≤ 10 000 ms);
  test('one write at a time; newer state written right after', …);
  test('stale base_rev → error state, nothing lost, next command retries', …);
  test('journal entries survive a failed write', …);
  test('view-only change saved without rev change', …expect(repo.view).toEqual(v); expect(repo.rev).toBe(prevRev));
  test('close flushes doc and view; failure keeps session loaded', …);
  test('close during in-flight save waits and reports read_only', …);        // ülevaatuse fookus 4
  test('burst during in-flight save ends with disk equal to engine', …);     // ülevaatuse fookus 3
  test('status events of an old session are ignored after reopen', …);
  test('older format: backup before migration, then migrate', () => { …expect(repo.calls).toEqual(['open', 'backupFull:migration']); });
  test('newer format → too_new, engine stays unloaded', …);
  test('second open of same path → locked', …);
  ```
- [ ] **Samm 2:** testid → KUKUVAD.
- [ ] **Samm 3:** teosta pordid, `storage-memory`, `ProjectService` ja `SaveCoordinator`.
- [ ] **Samm 4:** testid → LÄBIVAD; kogu osa A: `pnpm test packages` → LÄBIB ilma DOM-ita.
- [ ] **Samm 5:** commit `feat(engine): project service and save coordinator`; üleandmine. **Osa A on valmis.**

---

## Osa B · Kasutajaliides brauseris (`apps/web`)

Osa lõpus töötab äpp brauseris IndexedDB-ga ja Playwright läbib M0 teekonna.

### Ülesanne 7: Klient (`@pcbk/client`)

**Failid:**
- Loo: `packages/client/src/{use-snapshot,use-save-status,session-filter,index}.ts`.
- Test: `packages/client/src/client.test.tsx`.

**Liidesed:**
- **Toodab:**
  - `EngineProvider` (props `engine: DocumentEngine`, `projects: ProjectService`);
  - `useSnapshot<T>(select: (s: Snapshot) => T): T` (`useSyncExternalStore` alusel);
  - `useEngine(): DocumentEngine`;
  - `useProjects(): ProjectService`;
  - `useSaveStatus(): SaveStatus`, mis eirab võõra `sessionId`-ga teateid.

- [ ] **Samm 1: kirjuta kukkuvad testid**:
  ```tsx
  test('re-renders only when snapshot reference changes', …);
  test('ignores status of a stale session', …emit({ sessionId: 'old', state: 'error' }) → status stays 'saved');
  ```
- [ ] **Samm 2:** testid → KUKUVAD.
- [ ] **Samm 3:** teosta klient.
- [ ] **Samm 4:** testid → LÄBIVAD; `pnpm depcruise` → `client` ei impordi `engine`-it.
- [ ] **Samm 5:** commit `feat(client): snapshot hooks and session filter`; üleandmine.

### Ülesanne 8: Disainisüsteem, kest, veapüüdjad ja tekstid (`@pcbk/ui`)

**Failid:**
- Loo: `packages/ui/src/kit/*`, `packages/ui/src/shell/*` (vt failide struktuur).
- Test: `packages/ui/src/shell/shell.test.tsx`.

**Liidesed:**
- **Toodab:**
  - kit-komponendid `Button`, `Field`, `Panel`, `Dialog`, `Toast`;
  - `tokens.css`: [06 › Disainitokenid](../06-kasutajaliides.md#disainitokenid) ja tume teema prototüübist;
  - `AppShell` alad [06 › Paigutus](../06-kasutajaliides.md#paigutus) järgi (lõuendi ala on M0-s tühi paneel);
  - `TopBar` (nimi, `SaveStatus`, tagasi/uuesti), `ErrorBar`, `CloseDialog`;
  - `ErrorBoundary` kahel tasemel;
  - `UiRegistry` (registreerib `UiModule`-id, kontrollib id-de unikaalsust);
  - `useSessionStore`, `useViewStore` (Zustand);
  - `keymap`: `Ctrl+Z` tagasi, `Ctrl+Y` ja `Ctrl+Shift+Z` uuesti; sisestusväljas mitte.
- **Täpsed tekstid** (`et.ts`):

  | Koht | Tekst |
  |---|---|
  | Salvestatud | „Salvestatud · {HH:MM}“ |
  | Salvestamisel | „Salvestan…“ |
  | Veariba | „Salvestamine ebaõnnestus: {põhjus}.“ + nupud „Proovi uuesti“, „Salvesta mujale…“ |
  | Sulgemise dialoog | pealkiri „Viimaseid muudatusi ei õnnestunud salvestada: {põhjus}“; nupud **Proovi uuesti**, **Salvesta mujale…**, **Sulge salvestamata**; viimase all „Viimased muudatused kaovad“ |
  | Juurtaseme veapüüdja | „Midagi läks valesti.“ + „Salvesta koopia ja lae uuesti“, „Salvesta diagnostika…“ |
  | Paneeli veapüüdja | „Selle osa kuvamisel tekkis viga.“ + „Proovi uuesti“ |
  | Põhjused | `disk_full` „ketas täis“ · `read_only` „fail on kirjutuskaitstud“ · `missing` „faili ei leitud“ · `locked` „fail on avatud mujal“ · `not_project` „see fail ei ole PCB Kaardistaja projekt“ · `too_new` „fail on tehtud uuema äpiga“ · `unknown` „tundmatu viga“ |

- [ ] **Samm 1: kirjuta kukkuvad testid**:
  ```tsx
  test('panel boundary shows fallback and keeps shell alive', …);
  test('save status shows time as HH:MM', …'Salvestatud · 14:32');
  test('every StorageReason has an Estonian text', () => for (r of reasons) expect(et.reason[r]).toMatch(/\S/));
  test('Ctrl+Z inside a text field does not trigger engine undo', …);
  ```
- [ ] **Samm 2:** testid → KUKUVAD.
- [ ] **Samm 3:** teosta kit, kest ja tekstid; fondid tulevad `@fontsource`-ist, mitte võrgust.
- [ ] **Samm 4:** testid → LÄBIVAD.
- [ ] **Samm 5:** commit `feat(ui): design system, shell, error boundaries, texts`; üleandmine.

### Ülesanne 9: `storage-web`, avaleht, uue plaadi dialoog ja komponentide UI

**Failid:**
- Loo: `packages/adapters/src/storage-web.ts`, `packages/ui/src/shell/{StartScreen,NewBoardDialog}.tsx`, `packages/features/components/ui/*`, `packages/features/project/ui/index.tsx`, `apps/web/*`.
- Test: `apps/web/e2e/m0.spec.ts`.

**Liidesed:**
- Tarbib: kõik eelnev.
- **`storage-web`:**
  - kasutab `idb-keyval`-it: üks kirje võtmega `project:<path>` (`{ meta, doc, rev, view, journal }`);
  - tee kuju on `web://<projectId>`;
  - viimased projektid on `localStorage`-is;
  - koopiat ja varukoopiat ei toeta (viga `unknown`).
- **Avaleht:** [02 › Avaleht](../02-kasutaja-teekond.md#1-äpi-avamine-avaleht) M0 osa: „Uus plaat“, „Ava fail…“ (veebis loend), viimaste projektide kaardid, kaardil „Taasta varukoopiast…“ (veebis keelatud koos vihjega). Fotoala ja näidisprojekt tulevad M1-s.
- **Uue plaadi dialoog:** [02 › Uus plaat](../02-kasutaja-teekond.md#2-uus-plaat) väljad Nimi (vaikimisi „Plaat {YYYY-MM-DD}“), Seade, Mis on viga, Asukoht (ainult töölaual). „Alusta“ on kohe aktiivne ja fail on kohe olemas.
- **Komponendid:**
  - navigaatori vahekaart „Komponendid“ (tähis, tüüp, väärtus) koos nupuga „Lisa komponent“ (tüübi valik ja jalgade arv);
  - kontekstisektsioon väljadega tähis, tüüp, korpuse märgistus, väärtus, märkused, tuvastatud, DNP ning jalgade tabeliga (nimi, NC, lisa, eemalda);
  - väärtuse väljas on teegi vihje hall `placeholder`, mitte väärtus.
- **Vaade:** navigaatori laius muudetakse lohistamisega ja salvestatakse `saveView` kaudu.

- [ ] **Samm 1: kirjuta kukkuv e2e test** `apps/web/e2e/m0.spec.ts`:
  ```ts
  test('M0 journey survives reload', async ({ page }) => {
    // uus plaat → lisa takisti → R1 → nimeta R7 → Ctrl+Z → R1 → Ctrl+Y → R7 → reload → avalehelt viimane → R7 on alles
  });
  test('new component has empty value and marking', …);
  test('navigator width survives reload without any document command', …);
  ```
- [ ] **Samm 2:** `pnpm e2e` → KUKUB.
- [ ] **Samm 3:** teosta adapter, avaleht, dialoog ja komponentide UI ning pane `apps/web` kokku (`engine.features.ts`, `ui.features.ts`, kumbki rida mooduli kohta).
- [ ] **Samm 4:** `pnpm e2e` → LÄBIB; `pnpm check` → LÄBIB.
- [ ] **Samm 5:** commit `feat(web): start screen, new board and first component UI`; üleandmine. **Osa B on valmis.**

---

## Osa C · Töölaud (Tauri) ja väljalase

Osa lõpus ehitab CI `.msi` ja kõik [07 › M0](../07-teekaart.md#m0--vundament-ja-esimene-komponent) tingimused on tõendatud.

**Eeltingimus:** Rust (`rustup`, stable, MSVC), Visual Studio Build Tools 2022 ja WebView2 on paigaldatud ning Tauri keskkonnakontroll läbis (2026-11-07, vt `docs/STATUS.md`). Enne ülesannet 10 kontrolli siiski uuesti `rustc --version`, `cargo --version` ja `pnpm tauri info`.

### Ülesanne 10: Rusti salvestus (`project_db`)

**Failid:**
- Loo: `apps/desktop/src-tauri/src/storage/{mod,db,schema}.rs`, `src/ipc.rs`, `src/bin/test_writer.rs`.
- Test: `tests/storage.rs`, `tests/lock.rs`.

**Liidesed:**
- **Tauri käsud:**
  - `project_create(path, doc_json) -> OpenedProjectDto`;
  - `project_open(path) -> OpenedProjectDto`;
  - `project_save(session, base_rev, rev, doc_json, journal: Vec<JournalDto>)`;
  - `project_save_view(session, view_json)`;
  - `project_close(session)`.
- **DTO-d:** `OpenedProjectDto { session, project_id, path, doc_json, view_json: Option<String>, format_version: u32, read_only: bool }` ja `StorageErrorDto { reason, actual_rev: Option<i64> }`. TypeScripti tüübid genereeritakse `ts-rs`-iga kausta `packages/adapters/src/bindings/`.
- **Skeem:** [03 § 9](../03-arhitektuur.md#9-salvestus-ja-projekti-fail) tabelid täpselt. `meta` võtmed on `format_version`, `app_version`, `created_at`, `project_id`, `copied_from_project_id`, `media_dirty`.
- **Avamine:**
  1. `PRAGMA journal_mode=DELETE; synchronous=FULL; foreign_keys=ON; locking_mode=EXCLUSIVE;`
  2. kohe `BEGIN EXCLUSIVE; COMMIT;`, et lukk oleks käes;
  3. `SQLITE_BUSY` → `locked`;
  4. puuduv `meta.format_version` või SQLite päis puudub → `not_project` (faili ei muudeta);
  5. faili atribuut kirjutuskaitstud → `read_only`.
- **Salvestus** on üks tehing: `UPDATE document SET json=?, rev=?, updated_at=? WHERE id=1 AND rev=?base_rev`. Kui ridu muutus 0, tuleb `stale_rev` koos tegeliku `rev`-iga. Logiread lisatakse samas tehingus.

- [ ] **Samm 1: kirjuta kukkuvad Rusti testid**:
  ```rust
  #[test] fn create_open_save_roundtrip() { … assert_eq!(open.doc_json, saved); }
  #[test] fn save_rejects_wrong_base_rev() { … assert!(matches!(err.reason, Reason::StaleRev)); assert_eq!(err.actual_rev, Some(3)); }
  #[test] fn second_process_cannot_open_locked_file() { /* käivita bin test_writer, mis hoiab faili lahti */ assert_eq!(err.reason, Reason::Locked); }
  #[test] fn killed_writer_leaves_consistent_file() { /* test_writer kirjutab tsüklis, kill(), siis open + PRAGMA integrity_check == "ok" */ }
  #[test] fn rejects_non_project_file_without_writing() { /* suvalised baidid → NotProject; faili sisu ja mtime muutumata */ }
  #[test] fn read_only_attribute_is_reported() { … Reason::ReadOnly }
  #[test] fn opens_and_saves_path_with_estonian_letters_and_spaces() { /* "Plaat õäöü (2).pcbk" */ }
  ```
- [ ] **Samm 2:** `cargo test` → KUKUB.
- [ ] **Samm 3:** teosta `project_db` ja käsud.
- [ ] **Samm 4:** `cargo test` → LÄBIB.
- [ ] **Samm 5:** commit `feat(desktop): sqlite project file with lock and compare-and-swap`; üleandmine.

### Ülesanne 11: Koopia, varukoopiad, taastamine ja viimased projektid

**Failid:**
- Loo: `src/storage/{copy,backup,restore,recent}.rs`.
- Test: `tests/copy_backup.rs`.

**Liidesed:**
- **Käsud:**
  - `project_copy(session, dest, identity, doc_json, rev, view_json, journal) -> OpenedProjectDto`;
  - `project_backup_full(session, reason)`;
  - `project_backups(project_id) -> Vec<BackupInfoDto>`;
  - `project_restore(backup, dest) -> OpenedProjectDto`;
  - `recent_list() / recent_add(entry) / recent_remove(path)`.
- **Koopia:**
  - `VACUUM INTO <dest>.tmp`;
  - siis uusim olek ühe tehinguna;
  - `identity = 'new'` → uus `project_id` ja `copied_from_project_id`;
  - lõpuks ümbernimetamine nimeks `<dest>`;
  - olemasolevat `<dest>`-i üle ei kirjutata (viga `unknown` koos sõnumiga; dialoog küsib uut nime).
- **Varukoopiad:** kaust `%APPDATA%\PCB Kaardistaja\backups\<project_id>\`.
  - **Täiskoopia** `<YYYY-MM-DD>-v<format>.pcbk` (kohalik kuupäev) tehakse avamisel, kui tänast täiskoopiat pole, ja `project_backup_full`-iga enne migratsiooni.
  - **Dokumendikoopia** `<YYYYMMDD-HHMMSS>.doc.json` (`{ base, rev, doc, view }`) tehakse `project_save` järel, kui eelmisest on möödas vähemalt `DOC_BACKUP_INTERVAL_MS`. Kui `meta.media_dirty = 1`, tehakse doc-koopia asemel täiskoopia ja `media_dirty` nullitakse.
  - **Alles hoitakse** 5 + 5. Täiskoopiat, millele mõni dokumendikoopia viitab, ei kustutata.
  - **Varukoopia tõrge** ei katkesta salvestust: see logitakse ja olekuteates on hoiatus.
- **Taastamine:** alati uude faili `.tmp` kaudu, `PRAGMA integrity_check` ja dokumendi JSON-i parsimisega. Dokumendikoopia puhul võetakse aluseks selle `base`-täiskoopia. `project_id` jääb samaks.
- **Viimased projektid:** `recent.json`, kõige rohkem 10 kirjet `{ path, name, project_id, opened_at }`. Puuduv fail kuvatakse kaardil.

- [ ] **Samm 1: kirjuta kukkuvad testid**:
  ```rust
  #[test] fn copy_goes_through_tmp_and_keeps_original() { … assert!(!tmp.exists()); assert_eq!(orig_rev, 5); }
  #[test] fn copy_new_identity_sets_copied_from() { … }
  #[test] fn copy_refuses_existing_destination() { … }
  #[test] fn daily_backup_uses_local_date_across_midnight() { /* süstitud kell: 23:59 ja 00:01 kohalikus ajas → 2 täiskoopiat */ }
  #[test] fn doc_backup_every_30_min_references_its_full_base() { … }
  #[test] fn media_dirty_forces_full_backup() { … }
  #[test] fn retention_keeps_referenced_full_backup() { … }
  #[test] fn restore_creates_new_file_and_validates() { … }
  #[test] fn recent_list_caps_at_ten_and_marks_missing() { … }
  ```
- [ ] **Samm 2:** `cargo test` → KUKUB.
- [ ] **Samm 3:** teosta. Kell ja kuupäev tulevad süstitavast `Clock` traitist.
- [ ] **Samm 4:** `cargo test` → LÄBIB.
- [ ] **Samm 5:** commit `feat(desktop): copy, backups, restore and recent list`; üleandmine.

### Ülesanne 12: `storage-tauri`, töölaua kokkupanek, üks eksemplar, failiseos, sulgemine ja diagnostika

**Failid:**
- Loo: `packages/adapters/src/storage-tauri.ts`, `apps/desktop/src/*`, `src-tauri/src/{main,logging}.rs`, `tauri.conf.json`, `capabilities/default.json`.
- Test: `packages/adapters/src/storage-tauri.test.ts` (võlts-`invoke`), suitsukontroll üleandmises.

**Liidesed:**
- **`storage-tauri`** teostab `ProjectRepository`-i Tauri käskudega ja teisendab `StorageErrorDto` → `StorageError`.
- **`tauri-plugin-single-instance`:** teine käivitus edastab `.pcbk` tee esimesele.
  - Sama fail → aken tuuakse ette.
  - Teine fail → `projects.open` pärast `flush()`-i.
- **`fileAssociations`:** `ext: ["pcbk"]`, `name: "PCB Kaardistaja projekt"`, `role: "Editor"`.
- **Akna sulgemine:** `onCloseRequested` → `preventDefault` → `projects.close()`. Õnnestumisel aken suletakse, vea korral avaneb `CloseDialog`.
- **Logid:** `tauri-plugin-log` kausta `logs\`, pööramine 5 × 1 MB.
- **`log_export(dest)`** kirjutab äpi versiooni ja logid ühte `.txt` faili.
- **Juurtaseme veapüüdja:** „Salvesta koopia ja lae uuesti“ kutsub `projects.copy({ dest: '<sama kaust>\\<nimi> (päästekoopia YYYY-MM-DD HHMM).pcbk', identity: 'same' })` ja laeb akna uuesti.
- **Uus plaat töölaual:** vaikimisi tee `Documents\PCB Kaardistaja\<nimi>.pcbk`. Keelatud märgid `<>:"/\|?*` asendatakse alakriipsuga ja olemasoleva nime korral lisatakse ` (2)`, ` (3)` …

- [ ] **Samm 1: kirjuta kukkuvad testid**:
  ```ts
  test('maps StorageErrorDto to StorageError', …);
  test('new board path sanitizes and de-duplicates', () => expect(boardPath('A/B?', existing)).toBe('…\\A_B_ (2).pcbk'));
  ```
- [ ] **Samm 2:** testid → KUKUVAD.
- [ ] **Samm 3:** teosta adapter ja `apps/desktop` kokkupanek (sama UI, ainult adapter erineb).
- [ ] **Samm 4:** testid → LÄBIVAD. **Suitsukontroll päris aknas** (`pnpm tauri dev`), tulemused üleandmisse:
  1. uus plaat → komponent → nimeta → `Ctrl+Z`/`Ctrl+Y` → sulge → ava viimastest: kõik on alles;
  2. sama faili topeltklõps teisest kohast → olemasolev aken tuleb ette;
  3. faili atribuut kirjutuskaitstud → veariba; akna sulgemine → dialoog; „Salvesta mujale…“ → uus fail avaneb samade andmetega;
  4. navigaatori laiuse muutmine → sulge → ava: laius on alles;
  5. „Salvesta diagnostika…“ loob faili.
- [ ] **Samm 5:** commit `feat(desktop): tauri adapter, single instance, close flow, diagnostics`; üleandmine.

### Ülesanne 13: CI ja paigaldaja

**Failid:**
- Loo: `.github/workflows/ci.yml`.

**Liidesed:**
- **Push ja PR peale** (`windows-latest`): `corepack enable` → `pnpm install --frozen-lockfile` → `pnpm check` (sh Playwright `apps/web` peal) → `pnpm format:check` → `cargo test` kaustas `apps/desktop/src-tauri`.
- **Push `main`-i ja silt `v*`:** lisaks `pnpm tauri build`, mis teeb `.msi` (WebView2 võrguühenduseta paigaldaja: `webviewInstallMode: offlineInstaller`). `.msi` laaditakse artefaktiks; sildi korral lisatakse see GitHubi Release'i.

- [ ] **Samm 1:** kirjuta töövoog.
- [ ] **Samm 2:** lükka haru `m0` GitHubi ainult kasutaja loal. Kui luba pole, käivita samad sammud kohalikult ja näita väljundit.
- [ ] **Samm 3:** kontrolli, et CI on roheline ja `.msi` artefakt on olemas.
- [ ] **Samm 4:** commit `ci: checks, rust tests and msi build`; lõplik üleandmine koos vastuvõtutabeliga. **Osa C ja M0 on valmis ülevaatuseks.**

---

## M0 vastuvõtt: tingimus → tõend

| [07 › M0](../07-teekaart.md#m0--vundament-ja-esimene-komponent) tingimus | Tõend |
|---|---|
| `pnpm check` roheline | Ül. 1 + CI (Ül. 13) |
| CI kukub, kui `features/*/ui` impordib `engine`-it; mootori testid Node'is | Ül. 1 `depcruise.test.ts`; osa A testid |
| uus plaat → komponent → nimeta → tagasi/uuesti → sulge → ava; sama UI veebis ja töölaual | Ül. 9 e2e; Ül. 12 suitsukontroll 1 |
| fail avaneb pärast jõuga sulgemist kirjutamise ajal | Ül. 10 `killed_writer_leaves_consistent_file` |
| kirjutuskaitse või täis ketas → veariba; sulgemine ei kaota ilma kinnituseta; „Salvesta mujale…“ | Ül. 6 testid; Ül. 12 suitsukontroll 3 |
| sama faili teine avamine → aken ette; teise protsessi lukk → „Fail on avatud mujal“ | Ül. 12 suitsukontroll 2; Ül. 10 `second_process_cannot_open_locked_file` |
| `base_rev` võrdlus; vana `sessionId` eiratakse | Ül. 10 `save_rejects_wrong_base_rev`; Ül. 6 ja 7 testid |
| omandi- või invariandirikkumine lükatakse tagasi ka väljalaskes | Ül. 4 testid |
| tagasivõtmine suurendab `rev`-i ja salvestus kirjutab taastatud sisu | Ül. 4 `undo and redo raise rev`; Ül. 6 burst-test |
| ainult vaate muutus säilib; salvestus hiljemalt 10 s | Ül. 6 testid; Ül. 9 e2e; Ül. 12 suitsukontroll 4 |
| täiskoopia enne migratsiooni; taastamine uude faili | Ül. 6 `older format…`; Ül. 11 `restore_creates_new_file_and_validates` |
| CI ehitab `.msi` | Ül. 13 |
| kasutuskatse (M0 sisu: komponent, nimetamine, tagasivõtmine, sulgemine, taasavamine) | kasutaja teeb pärast Ül. 13; tulemus läheb üleandmisse |
