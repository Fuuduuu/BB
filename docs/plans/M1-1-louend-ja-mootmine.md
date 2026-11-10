# M1.1 · Komponent lõuendil ja esimene mõõtmine: teostusplaan

**Olek.** [M0-15 taasteparandus](../tasks/M0-15.md) on vastu võetud ja `main`-is. M1.1 [töökaartide](../tasks/README.md) hetkeseis on [STATUS-es](../STATUS.md).

> **Ehitajale.** Täida kasutaja antud kaart oskusega `superpowers:executing-plans`. Arhitekt kirjutab [snaipriülesande kaardi](../tasks/README.md) `docs/tasks/M1-1-<n>.md` vahetult enne töö algust. Järgmist ülesannet alusta pärast ülevaatuse otsust „sobib“. Kaardil lahtiseks jäetud teostusvalik kirjuta üleandmisse.

**Eesmärk:** M1.1 [valmis kui](../07-teekaart.md#m11--komponent-fotol-ja-mõõtmine): päris äpis loo projekt → lisa komponent lõuendile → vali jalg → salvesta mõõtmine → sulge → ava uuesti, mõõtmine on samal jalal alles.

**Arhitektuur:** komponent saab plaadipaigutuse (korpus mm-des → tööpinna pikslid, [03 § 7.1](../03-arhitektuur.md#71-koordinaadid)). Lõuend on `packages/ui` baasvõimekus (valik, liigutamine, vaade); komponendi ja mõõtmise kihid, tööriistad ja sektsioonid tulevad moodulitelt `components` ja `measurements`. Eelvaade ja mõõtmise mustand elavad `SessionStore`'is ([03 § 5](../03-arhitektuur.md#5-olek-kolm-eraldi-hoidlat)), mootorisse läheb üks käsk hiire vabastamisel või `Enter`-iga.

**Tehnoloogia:** M0 pinu; uut sõltuvust ei lisata (SVG, Zustand, Immer, zod olemas).

**Spetsifikatsioon:** [03](../03-arhitektuur.md) § 4, 5, 7; [04](../04-andmemudel.md) (Komponent, Pin, BoardPlacement, Measurement, Mõõtmise kontaktid, Väärtuse lugemine); [05](../05-moodulid.md) (components, measurements); [06](../06-kasutajaliides.md) (Jalad, Komponendid, Klaviatuur, Hiir, Tühjad olekud); [07 › M1.1](../07-teekaart.md#m11--komponent-fotol-ja-mõõtmine). Vastuolu korral kehtivad dokumendid ja ehitaja küsib arhitektilt.

**Selle plaani piir.** M1.1 lisab virtuaalsele tööpinnale viis korpuseperekonda, tundmatu komponendi ala ning pinge salvestamise. Foto, täielik korpuseteek, oma padjandite paigutus, ühendused, läbivus ja mõõtmise täisvoog kuuluvad järgmistesse etappidesse.

## Kavandatud arhitektuuri- ja lepingumuudatused

Need teostusotsused jõustuvad pärast plaani kinnitamist. Ehitaja uuendab lepingud ja nende dokumendid vastava muudatusega samas ülesandes.

1. **Foto puudub M1.1-s.** Lõuend kasutab virtuaalset tööpinda 2000 × 1400 px, 10 px/mm ([03 § 7.1](../03-arhitektuur.md#71-koordinaadid)). Foto lisandub M1.2-s ega skaleeri olemasolevaid komponente.
2. **`components.add` saab valikulise `board`-i:** komponent loodakse koos paigutusega ühe käsuna (05: „sama käsk, ainult paigutusega“). Jalad tulevad korpuse padjanditest; kutsuja annab `uid`-id. Olemasolev kutse ilma `board`-ita (M0 dialoog) jääb samaks.
3. **Uued komponendikäsud:** `components.placeOnBoard`, `components.removeFromBoard`, `components.rotate`, `components.flipSide`, `components.setLabelOffset`. Üldkäsk `items.translate` elab mootori tuumas (`packages/engine`, nagu `items.delete`) ja liigutab M1.1-s ainult komponente.
4. **Uus moodul `measurements`** (mootor + UI) omab `measurements` välja ja sõltub moodulist `components`. `measurements.add` salvestab pinge ning `measurements.remove` kustutab kirje tagasivõetavalt. Piiks tuleb M2.2-s. Takistus, diood, hinnangud, tolerants ja mõõtmise muutmine tulevad mõõtmise täisvoos M3.
5. **`Derived.pinReadings`** annab punase sondi jala `uid` järgi viimase kehtiva pingenäidu. Mootor valideerib tuletise ning kasutajaliides kuvab tulemuse.
6. **UI laiendus:** `UiModule` saab `canvasLayers?: LayerSpec[]` ja `tools?: ToolSpec[]` ([03 § 7.2–7.3](../03-arhitektuur.md#72-tööriistad)). Valik, liigutamine ja vaate nihutamine on lõuendi baas (`packages/ui/src/canvas`), mitte moodul.
7. **Sondid ja mustand.** Kasutaja valib mõõtmiskoha ja soovi korral musta sondi. Koht püsib lõuendi üldvalikust eraldi ning mustand kuulub `uid`-idega sondipaarile. Pinge võib salvestada määramata vastaspunktiga. `MeasureBlock` võtab `suggestions: PinRef[]` sisendi, mis on M1.1-s tühi. GND soovitus saab tulla siis, kui võrgu roll on olemas, ja rakendub kasutaja klõpsul.
8. **`Alt+↓` / `Alt+↑`** liiguvad **sama komponendi** jalgade vahel jala järjekorras ega mähi otsi kokku.
9. **Stseeniteisendus on M1.1-s olemas.** Lõuendi juurelement rakendab `photo.transform` (M1.1-s `'none'`), tekstid saavad vastuteisenduse; M1.2 lisab ainult foto ega kirjuta lõuendit ümber ([03 § 7.1](../03-arhitektuur.md#71-koordinaadid), Gemini ülevaatus 2026-11-09).
10. **Olemasolevad projektid.** M1.1 kasutab `v0.1.0` dokumendivormingut. Vana paneelivaade saab puuduva suumi ja nihke vaikeväärtused. Mõõtmiskoht ja mustandid elavad ainult seansi olekus.
11. **Laienduskohad avatuks (Fable ülevaatus 2026-11-10, arhitekt kinnitas).** Iga uus moodul peab saama lisada oma osa tuumapakette muutmata:
    - `Derived` on laiendatav nagu `CommandMap`; `DeriveSpec` kannab skeemi, algväärtust ja sisendväljade loendit meelespidamiseks (kaart M1-1-5).
    - **Seansi olek:** kesta `SessionStore` hoiab ainult üldist: valik, aktiivne tööriist ja üks üldine eelvaate pesa (`preview: { owner: string; data: unknown } | null`). Mooduli enda olek (mõõtmise Koht, sondid, mustandid) elab mooduli kaustas oma Zustandi hoidlas koos lähtestuskonksuga, mille kest kutsub projekti vahetusel.
    - **Valik on kohe mitmikvalik:** `Selection = { items: { kind: string; id: string; componentId?: string }[] }`. M1.1 kasutab ühte elementi; raamvalik ja `Shift`+klõps tulevad M2.1-s ilma kuju muutmata.
    - **Tabamus on üldine:** `HitItem = { kind: string; id: string; shape: { type: 'point'; at: Vec2; r: number } | { type: 'segment'; a: Vec2; b: Vec2; width: number } | { type: 'area'; polygon: Vec2[] }; data?: unknown }`. Kihid/moodulid annavad oma tabamuselemendid; lõuend ei tunne komponente. `Canvas` saab koordinaatide teisenduse ja kihid parameetrina, et M2.3 skeem saaks sama lõuendit kasutada.
    - **Mooduli tekstid on mooduli kaustas:** `features/X/ui/i18n/et.ts`; kesta tekstid jäävad `packages/ui/src/shell/i18n/et.ts`-i. Uued tekstid (alates kaardist M1-1-8) lähevad mooduli faili; olemasolevate komponenditekstide kolimine on M1 hoolduskaardis.

## Globaalsed piirangud

Kehtivad kõik [M0 globaalsed piirangud](M0-vundament.md#globaalsed-piirangud) (strict TS, failipikkus 400/600, sõltuvusreeglid, id-d kutsuja loodud, tekstid `et.ts` failides (kest oma, iga moodul oma `ui/i18n/et.ts`), numbrid kümnendkomaga, kohalik aeg `HH:MM`). Lisaks:

- `features/*/ui` ei impordi `engine`-it; mõõtmise ja paigutuse arvutused on `@pcbk/domain` puhtad funktsioonid.
- Kõik joonistatavad pikslid tulevad `pxPerMm`-st (v1: 10). Hardcoded 10 on viga.
- Jalg on ekraanil vähemalt 10 px läbimõõduga, number alates raadiusest 7 px, nimi alates 14 px ([06 › Jalad](../06-kasutajaliides.md#jalad)).
- Lohistamine algab 3 px liikumise järel; haaramise koht jääb kursori alla.
- Sisestusväljas ei käivitu ükski lõuendi täheklahv.
- Iga avaliku liidese muudatuse järel käivita `pnpm api` enne `pnpm check`-i. Sammudes toodud commit’i sõnumid on soovitused. Commit ja push vajavad kasutaja luba.

## Ülevaatuse fookus

Iga olukorra test kuulub samasse ülesandesse, mis käitumise lisab.

1. **Pööratud ja alumise poole komponent:** jalgade asukohad järgivad järjekorda skaleeri → peegelda (alumine pool) → pööra → `·pxPerMm` → `+center` (Ül. 2, `pad_to_board_applies_scale_mirror_rotation_in_order`; Ül. 6 hiireklõps pööratud komponendi jalal valib selle jala).
2. **Kaks jalga ühe haardraadiuse sees** (SOT-23, 0402): klõps valib kursorile lähima, mitte esimese (Ül. 6, `nearest_pin_wins_inside_hit_radius`).
3. **Lohistamise katkestus:** `Esc`, `pointercancel`, tööriista vahetus ja projekti vahetus jätavad dokumenti, ajalugu ja salvestust puutumata, ka siis kui eelvaade on juba liikunud (Ül. 6, `cancelled_drag_leaves_no_trace`).
4. **Näidu sisestus.** `4,98`, `4.98 V`, `4k7` ja `3m3` annavad pinge. Tühi sisend, `abc`, `1,2,3`, `10 kΩ` ja `OL` annavad selgituse ning salvestus jääb tegemata (Ül. 3 ja 9).
5. **Koha püsimine ja kontaktikadu.** Tühi klõps ja vahekaardi vahetus jätavad Koha ning mustandi alles. Kontaktikadu jätab nähtava selgituse, keelab vigase paari salvestamise ning jätab olemasoleva mõõtmise ajalukku (Ül. 5, 9 ja 10).

## Failide struktuur (muutub / lisandub)

```
packages/domain/src/footprints/     index.ts  types.ts  chip.ts  sot23.ts  soic.ts  to220.ts  header.ts  area.ts  footprints.test.ts
packages/domain/src/geometry/       board.ts (padToBoard, boardPads, bodyOutline)  board.test.ts
packages/domain/src/measure/        reading.ts (parseReading, formatReading)  pin-readings.ts  *.test.ts
packages/contracts/src/             snapshot.ts (Derived.pinReadings)  project-service.ts  view-state.ts
packages/engine/src/                items.ts  types.ts  derivation.ts  registry.ts
packages/features/components/       contract.ts (+params, COMPONENT_LIBRARY)  engine/commands.ts (+5 käsku)
                                    ui/layers/ComponentsLayer.tsx  ui/layers/PinMarker.tsx  ui/Library.tsx  ui/PlaceTool.ts
                                    ui/PlacedList.tsx  ui/PlacementSection.tsx
packages/features/measurements/     contract.ts  engine/index.ts  engine/commands.ts  engine/derive.ts
                                    ui/MeasureBlock.tsx  ui/MeasurementList.tsx  ui/layers/ReadingLabels.tsx  ui/index.tsx
packages/ui/src/canvas/             Canvas.tsx  stage.ts  tools.ts  SelectTool.ts  PanTool.ts  hit-index.ts  index.ts
packages/ui/src/shell/              session-store.ts  view-store.ts  UiRegistry.ts  i18n/et.ts
packages/ui/src/app/                use-workbench.ts (vaate salvestus)
packages/features/                  engine.ts  ui.ts (mõlema rakenduse ühisregistrid)
tooling/                           moodulitevaheliste importide kontroll ja katsefailid
apps/web/e2e/m1-1.spec.ts
```

---

## Osa A · Domeen ja mootor (Node, ilma DOM-ita)

### Ülesanne 1: Korpuste generaatorid (`@pcbk/domain`)

**Liidesed (Produces):**
```ts
export interface PadGeom { id: string; x: number; y: number; w: number; h: number; shape: 'rect' | 'circle'; through: boolean }
export interface FootprintGeom { pads: PadGeom[]; body: { w: number; h: number; pin1?: Vec2 } } // mm, päritolu keskel
export interface FootprintParams { [k: string]: string | number }
export interface FootprintDef { key: string; name: string; defaults: FootprintParams; gen(p: FootprintParams): FootprintGeom | undefined }
export const FOOTPRINTS: readonly FootprintDef[];                 // võtmed: 'chip', 'sot23', 'soic', 'to220', 'header1', 'area'
export function footprintGeometry(key: string, params: FootprintParams): FootprintGeom | undefined;
export function footprintPinIds(key: string, params: FootprintParams): string[] | undefined;  // padjandite id-d järjekorras
```
Generaatorite mõõdud ja padjandite asukohad tulevad prototüübist (`gChip`, `gSot23`, `gSop`, `gTo220`, `gHdr1`). Täpsed arvud ja TO-220 kohandus kere keskpunktile on [kaardil M1-1-1](../tasks/M1-1-1.md#otsused-ja-liidesed). `area` on keskele joondatud `w × h` mm ristkülik ilma genereeritud padjanditeta. Padjandi `id` on jala id (`"1"`, `"2"`…). SOIC-8 prototüübis on x-koordinaadi absoluutväärtus `3.9 / 2 + 1.55 / 2 + 0.05 = 2.775` mm. Ühe kümnendkohaga kuvatakse `2,8` mm.

- [ ] **Samm 1.** Kirjuta testid `soic8_pin1_and_pin8_positions` (jalg 1 `x = -2.775`, jalg 8 `x = 2.775`, mõlemal `y = -1.905` mm), `soic_14_has_14_pads_numbered_1_to_14`, `chip_0805_has_two_pads_symmetric_about_origin`, `sot23_3_5_6_pin_counts`, `to220_has_three_pads`, `header1_pitch_254_places_pads_every_2_54_mm`, `area_has_no_pads` ja `unknown_footprint_or_invalid_params_returns_undefined`.
- [ ] **Samm 2.** Tõenda testide läbikukkumine (RED). **Samm 3.** Implementeeri generaatorid ja register. **Samm 4.** Tõenda testide edu ja uuenda `docs/api` käsuga `pnpm api`. Käivita `pnpm check`, `pnpm format:check` ja `pnpm api:check`.
- [ ] **Samm 5:** commit `feat(domain): five footprint generators for M1.1`.

### Ülesanne 2: Plaadi geomeetria (`@pcbk/domain/geometry`)

**Consumes:** `BoardPlacement`, `PadGeom`. **Produces:**
```ts
export function padToBoard(p: Pick<BoardPlacement, 'center' | 'rotationDeg' | 'side' | 'scaleX' | 'scaleY'>, local: Vec2, pxPerMm: number): Vec2;
export function boardPads(placement: BoardPlacement, pinIds: readonly string[], pxPerMm: number): { pinId: string; at: Vec2; radiusPx: number }[];
export function bodyOutline(placement: BoardPlacement, pxPerMm: number): Vec2[];   // 4 nurka tööpinnal
```
Järjekord on [03 § 7.1](../03-arhitektuur.md#71-koordinaadid) järgi `(x·scaleX, y·scaleY)` → peegel (`x := −x`, kui `side = 'bottom'`) → pööre päripäeva, y alla → `·pxPerMm` → `+center`. Genereeritud padjand seotakse jalaga `padMap?.[padId] ?? padId` kaudu. Käsitsi lisatud padjand seotakse jalaga otse `customPads` kirje võtme järgi. Mõlemal juhul peab jalg leiduma `pinIds` hulgas. [Kaart M1-1-2](../tasks/M1-1-2.md) täpsustab raadiuse ja piirjoone arvutust.

- [ ] **Samm 1:** testid: `pad_to_board_applies_scale_mirror_rotation_in_order` (nt `(1;0)` mm, `rot 90`, `top` → `(center.x, center.y+10)`; `bottom` peegeldab enne pööret), `rotation_wraps_and_is_clockwise_with_y_down`, `pad_map_redirects_pad_to_pin`, `body_outline_respects_scale`.
- [ ] **Samm 2–4.** RED → teostus → GREEN. Uuenda API ülevaade ja anna diff üle. Commit ja push jäävad koondtööjärku.

### Ülesanne 3: Näidu lugemine (`@pcbk/domain/measure`)

**Liidesed**
```ts
export function parseReading(text: string, mode: 'voltage'): { value: number } | null;   // 04 allkiri; M3 laiendab režiime
export function formatReading(reading: { value: number }, mode: 'voltage'): string;
export interface PinReading { measurementId: string; mode: 'voltage'; value: number; takenAt: string }
export interface PinReadingSource {
  readonly components: readonly { readonly id: string; readonly pins: readonly Readonly<Pick<Pin, 'id' | 'uid'>>[] }[];
  readonly measurements: readonly Readonly<Measurement>[];
}
export function pinReadings(doc: PinReadingSource): Record<string, PinReading>;
```
`parseReading` rakendab pinge jaoks [04 väärtuse lugemise reegleid](../04-andmemudel.md#mõõtmiste-hindamine). Toeta märgiga kümnendarvu, koma ja punkti, tühikuid, SI kordajaid `m`, `k`, `M`, kuju `4k7` ning valikulist `V` lõpus. Mittesobiv ühik, `OL` ja mittelõplik arv annavad `null`-i. `formatReading` kuvab näiteks `4,98 V`.

`pinReadings` valib iga punase sondi jala `uid` jaoks viimase kehtiva pinge `takenAt` järgi. Võrdse aja korral võidab dokumendis hilisem kirje. Valikust jäävad välja teised režiimid, aegunud kirjed, puuduva või vigase väärtusega kirjed ning need, mille `at` või olemasolev `ref` ei vasta enam sama `uid`-ga jalale. See arvutus jätab salvestatud mõõtmised puutumata.

- [ ] **Samm 1.** Testi `parse_reading_accepts_comma_and_dot`, `parse_reading_si_suffixes` (`4k7` = 4700, `3m3 V` = 0,0033), `invalid_voltage_returns_null` (`''`, `abc`, `1,2,3`, `10 kΩ`, `OL`, ületäituv arv), `format_reading_uses_decimal_comma`, `pin_readings_picks_latest_active`, `pin_readings_skips_historical_stale_and_other_modes` ja `same_number_new_pin_does_not_inherit_old_reading`.
- [ ] **Samm 2–4:** RED → GREEN. **Samm 5:** commit `feat(domain): reading parser and pin readings`.

### Ülesanne 4: Komponendikäsud paigutusele ja `items.translate`

**Files:** `packages/features/components/{contract.ts,engine/commands.ts}`, `packages/engine/src/items.ts`; **Consumes:** Ül. 1–2.

**Produces (`contract.ts`):**
```ts
export const COMPONENT_LIBRARY: readonly LibraryEntry[];   // Takisti SMD, Kondensaator SMD, SOT-23 (3/5/6), SOIC (8–28), TO-220, Pinnirida 1×N, Tundmatu komponent
export interface LibraryEntry { id: string; kind: ComponentKind; footprint: string; params: FootprintParams; kw: string }   // nimi et.ts-ist id järgi, eesliide refPrefix(kind)-ist (kaart M1-1-4)
export type BoardInput = { footprint: string; params?: FootprintParams; center: Vec2; rotationDeg?: number; side?: Side };
export type AddComponentParams = /* olemasolev */ & { board?: BoardInput };
export function makePlacedComponent(ids: IdGen, entry: LibraryEntry, params: FootprintParams, center: Vec2): AddComponentParams;
// uued käsud (zod-skeemid ja tüübid kontrakti failis):
// components.placeOnBoard { id: string; board: BoardInput }          // ainult siis, kui komponendil pole paigutust
// components.removeFromBoard { id: string }
// components.rotate { id: string; deltaDeg: number }                  // tulemus 0 ≤ deg < 360
// components.flipSide { id: string }
// components.setLabelOffset { id: string; offset: Vec2 | null }
// items.translate { items: { kind: 'component'; id: string }[]; dx: number; dy: number }  // tööpinna px
```
**Paigutuse reeglid.** Tavalise korpusega `components.add` ja `components.placeOnBoard` nõuavad täpselt sama jala ID-de hulka kui `footprintPinIds`. Sobimatus annab `footprint_pins_mismatch`. Padjandid seotakse ID järgi ning olemasoleva komponendi jalgade järjekord ja `uid`-id säilivad. Teegist uue komponendi jalad luuakse generaatori järjekorras. `area` valideerib mõõdud, lubab olemasolevaid käsitsi lisatud jalgu ja säilitab nende `uid`-id. Uus `area` teegist algab jalgadeta ning käsitsi jalgade koordinaadid tulevad M1.4-s.

Uus paigutus kasutab `scaleX = scaleY = 1` ja `customPads = {}`. `items.translate` lükkab paigutamata komponendi tagasi. Edukas muudatus on üks ajaloosamm. Nullnihe jätab ajaloo samaks.

- [ ] **Samm 1.** Kirjuta `packages/features/components/components.test.ts` ja mootoritestid `add_with_board_creates_pins_from_footprint`, `add_with_board_rejects_pin_mismatch`, `place_on_board_matches_ids_after_m0_pin_reorder`, `place_on_board_rejects_already_placed`, `remove_from_board_keeps_component_and_pins`, `area_replaces_board_placement_preserving_manual_pins`, `rotate_normalizes_to_0_360`, `flip_side_toggles_top_bottom`, `translate_moves_center_in_one_history_step`, `translate_zero_is_noop_without_history_entry`, `translate_rejects_unplaced_component`, `undo_restores_exact_center` ja `derived_unplaced_board_updates`.
- [ ] **Samm 2–4:** RED → implementeeri → GREEN. **Samm 5:** uuenda `docs/api/*.md` (`pnpm api`) ja [05](../05-moodulid.md) käskude loend, kui erineb. Commit `feat(components): board placement commands and items.translate`.

### Ülesanne 5: Moodul `measurements` (mootor)

**Failid.** `packages/features/measurements/{contract.ts,engine/*}`, `packages/features/engine.ts`, `packages/contracts/src/snapshot.ts`, `packages/engine/src/{types,derivation,registry}.ts` ja `tooling/` sõltuvustestid. Mõlemad äpid kasutavad juba `packages/features/engine.ts` registrit. Lisa sinna `measurementsEngine` ja eemalda `measurements` reserveeritud väljadest. `measureSettings` jääb reserveerituks M3-ni. Uuenda samas töös tuletiste lepingut [03 § 7.4](../03-arhitektuur.md#74-arvutatud-andmed) ja käskude ulatust [05](../05-moodulid.md).

**Liidesed**
```ts
// contract.ts
export type AddMeasurementParams = { id: string; mode: 'voltage'; at: MeasuredPin; ref?: MeasuredPin; value: number; power: 'on' | 'off' | 'unknown'; takenAt: string; note?: string };
export type RemoveMeasurementParams = { id: string };
// Derived (contracts): pinReadings: Record<string, PinReading>
```
`measurements.add` on range käsk pinge salvestamiseks. `value` on kohustuslik lõplik arv ja `takenAt` on ISO UTC. `at` ja olemasolev `ref` peavad viitama eri jalgadele sama `uid`-ga nagu dokumendis. Käsk talletab `atLabel` ja olemasoleva `refLabel` kujul `"<ref>.<pinId>"` ning `source: 'manual'`. Säilita olemasoleva salvestusvormingu `MeasurementSchema` ja vanade kirjete loetavus.

`DeriveSpec` seob `key: K` puhul `run` tagastuse tüübiga `Derived[K]`. Alg- ja tühjas hetktõmmises on `pinReadings: {}`. Valideeri tuletise tulemus võtmele vastava skeemiga, `unplaced*` endiselt stringimassiividena ja `pinReadings` sõnastikuna, mille kirjed järgivad Ül. 3 tüüpi. Vigane tulemus peatab käsu enne ajaloo ja uue hetktõmmise avaldamist. Mooduli enda `contract.ts` teeb Ül. 3 lugemis- ja vormindusfunktsioonid UI-le kättesaadavaks ning säilitab domeeni käituskoodi impordipiiri.

**`dependsOn` kontroll.** `pnpm check` võrdleb sõltuvusanalüüsi lahendatud moodulitevahelisi tootmiskoodi servi registreeritud moodulite tegeliku `dependsOn`-iga. Kontroll hõlmab ka tüübiimporte. Olemasolev keeld importida teise mooduli privaatfaile jääb jõusse. Tee kontroll selle ülesande osana, et esimene avaliku lepingu ristimport oleks kaetud.

- [ ] **Samm 1.** Testi `measurement_registry_starts_with_unreserved_owner`, `empty_snapshot_has_empty_pin_readings`, `invalid_pin_readings_does_not_publish_command`, `feature_import_requires_declared_dependency`, `add_rejects_unknown_pin_or_wrong_uid`, `add_rejects_same_probe_twice`, `add_rejects_non_voltage_and_nonfinite_value`, `voltage_without_reference_is_allowed`, `labels_survive_component_rename_and_delete`, `remove_is_undoable`, `pin_readings_derived_after_add` ja `ownership_blocks_other_modules_from_writing_measurements`. Sõltuvustestis peab sama avalik import deklaratsioonita läbi kukkuma ning deklareerituna läbima.
- [ ] **Samm 2–4:** RED → GREEN. **Samm 5:** commit `feat(measurements): add/remove commands and pin readings`.

---

## Osa B · Lõuend ja kasutajaliides

### Ülesanne 6: Lõuendi baas, valik ja liigutamine (`packages/ui/src/canvas`)

**Produces:**
```ts
// tools.ts (03 § 7.2)
export interface CanvasPointer { world: Vec2; screen: Vec2; hit?: HitItem; shift: boolean; alt: boolean; ctrl: boolean }
export interface CanvasTool { id: string; cursor: string; onPointerDown(e: CanvasPointer, api: ToolApi): void; onPointerMove(e: CanvasPointer, api: ToolApi): void;
  onPointerUp(e: CanvasPointer, api: ToolApi): void; onKey?(e: KeyboardEvent, api: ToolApi): boolean; overlay?(api: ToolApi): JSX.Element | null; onCancel?(api: ToolApi): void }
export interface ToolSpec { id: string; label: string; icon: string; key?: string; group: 'select' | 'draw' | 'measure' | 'mechanical'; create(): CanvasTool }
export interface ToolApi { execute: DocumentEngine['execute']; select(sel: Selection): void; setPreview(p: Preview | null): void; hitIndex: HitIndex; snapshot(): Snapshot }
export type LayerSpec = { id: string; z: number; render(props: { snapshot: Snapshot; preview: Preview | null; zoom: number }): ReactNode };
// hit-index.ts
export interface HitItem { kind: string; id: string; shape: HitShape; data?: unknown }   // üldine, otsus 11
export type HitShape = { type: 'point'; at: Vec2; r: number } | { type: 'segment'; a: Vec2; b: Vec2; width: number } | { type: 'area'; polygon: Vec2[] };
export interface HitIndex { query(world: Vec2, zoom: number): HitItem | undefined }
export function createHitIndex(items: HitItem[], cellPx?: number /* 32 */): HitIndex;
// session-store.ts (kesta üldine osa, otsus 11)
export type Selection = { items: { kind: string; id: string; componentId?: string }[] };
export type Preview = { owner: string; data: unknown };   // nt owner 'select' + { ids, dx, dy } või owner 'components' + { componentId, offset }
// ViewState (contracts): boardView?: { zoom: number; pan: Vec2 }
```
`Canvas` rendab ühe `<svg>`, stseeni juure `<g data-scene>` (rakendab `PhotoRef.transform`; kõik 8 teisendust, M1.1-s kasutusel `'none'`), tekstielemendid (`SceneText`) saavad vastuteisenduse, nii et tähised, jalanumbrid ja näidud on alati loetavad, ning ühe `<g transform>` (suum/nihe imperatiivselt `ViewStore` kaudu, mitte Reacti renderiga), kihid `z` järjekorras ja ühe osutikuulari juurel `setPointerCapture`-iga. Ekraan → maailm: `getScreenCTM().inverse()`. Pan: keskmine nupp ja tühik + lohista; suum: rullik kursori ümber. **Vali (`V`)**: klõps valib komponendi või jala (`HitIndex`: jala tabamusala `max(raadius, 6 px)`, lähim võidab), tühi klõps tühjendab valiku; lohistamine alates 3 px liigutab valitud komponendi **eelvaatena** ja hiire vabastamisel läheb üks `items.translate`. **Liiguta vaadet (`H`)**. `Esc`, `pointercancel`, tööriista vahetus, projekti vahetus kustutavad eelvaate. Nooled nihutavad 1 px (`Shift` 10 px) üks käsk klahvivajutuse kohta. `UiModule` saab `canvasLayers` ja `tools`; `UiRegistry` koondab need. `Workbench` annab lõuendi `AppShell`-ile.

Tühja klõpsu ja `Esc` valikukäitumine puudutab lõuendi üldvalikut. Ül. 9 mõõtmiskoht elab sellest eraldi. Tähise tabamus võib olla kerest eemal ning avab sildi eelvaate Ül. 7 jaoks.

**Vaate püsimine.** `boardView` on vana vaatega ühilduv valikuline väli, vaikimisi `zoom: 1`, `pan: { x: 0, y: 0 }`. Suum on lõplik positiivne arv ja nihke komponendid on lõplikud. Puuduv või vigane `boardView` asendub vaikeväärtusega, kehtivad paneeliseaded säilivad. `ViewStore` taastab ja tagastab selle välja. `use-workbench.ts` saadab vaate muudatuse `ProjectService.saveView` kaudu sama seansi ajal. Üksnes suum või nihe jätab dokumendi revisjoni ja ajaloo samaks.

- [ ] **Samm 1.** Testi `click_selects_component_then_pin`, `nearest_pin_wins_inside_hit_radius`, `hit_index_rebuilds_on_rev_change`, `drag_below_3px_is_a_click`, `drag_grab_offset_stays_under_cursor`, `drag_commits_one_translate_on_pointerup`, `cancelled_drag_leaves_no_trace` (kõik neli katkestusviisi), `wheel_zoom_keeps_cursor_point_fixed`, `pan_does_not_rerender_layers`, `escape_returns_to_select_and_clears_selection`, `scene_transform_keeps_text_readable_for_all_8_transforms`, `pointer_world_coords_correct_under_each_scene_transform`, `selection_cleared_when_selected_item_disappears`, `m0_view_defaults_board_transform_and_preserves_panels` ja `view_only_change_leaves_document_rev_unchanged`.
- [ ] **Samm 2–4.** RED → GREEN. **Samm 5.** Testi `UiRegistry` ja `UiModule` laiendusi. Uuenda [03 § 4](../03-arhitektuur.md#4-moodulisüsteem) `canvasLayers`/`tools` ja [03 § 5](../03-arhitektuur.md#5-olek-kolm-eraldi-hoidlat) vaate lepingut ning genereeri `docs/api`. Soovitatav commit `feat(ui): canvas base with select, pan and drag preview`.

### Ülesanne 7: Komponentide kiht ja jalad (`features/components/ui`)

**Produces:** `ComponentsLayer` (z 30 kered, 50 jalad, 60 tähised/numbrid), `PinMarker`, `COMPONENTS_LAYERS: LayerSpec[]`. Reeglid [06 › Jalad ja Komponendid](../06-kasutajaliides.md#jalad): kere kontuur 1,4 px koos 3,6 px halo-ga; jalg 1 ruut; jala minimaalne läbimõõt 10 px; number alates raadiusest 7 px, nimi alates 14 px; tähis ja väärtuse silt alles, kui tekst on ekraanil ≥ 8 px (LOD arvutatakse uuesti suumi lõppedes, `requestAnimationFrame` + 120 ms); olekud M1.1-s: ühendamata (ainult kontuur), NC (rist), valitud (+2 px `--sel`), mõõdetud (neutraalne rõngas ja Ül. 9 pingenäidu silt; hinnang tuleb M3-s); alumise poole kere katkendjoon; tuvastamata „?“; DNP 40 % läbipaistvus. Tähise silt on lohistatav ka kerest eemal (`labelOffset`, üks `components.setLabelOffset` vabastamisel, **komponent ei liigu**). Iga komponent on `React.memo` ja renderdub ainult siis, kui tema enda andmed või kuvamiseks vajalik olek muutuvad. Tähised, jalanumbrid ja väärtused `--f-mono`, `tabular-nums`, joonistatakse alati loetavalt.

- [ ] **Samm 1:** testid: `pin1_is_square`, `pin_number_hidden_below_7px_radius_and_name_below_14px`, `pad_min_diameter_10px_at_low_zoom`, `rotated_component_pin_hit_selects_that_pin` (ülevaatuse fookus 1), `bottom_side_component_is_dashed_and_mirrored`, `label_drag_outside_body_changes_only_label_offset`, `unplaced_component_not_drawn`, `component_rerenders_only_on_own_change` (sh teise komponendi või projekti nime muutmine).
- [ ] **Samm 2–4:** RED → GREEN. **Samm 5:** commit `feat(components): components layer and pin markers`.

### Ülesanne 8: Teek, paigutamine ja plaadil/paigutamata loendid

**Produces:** navigaatori vahekaardid **Teek**, **Plaadil**, **Plaadile paigutamata** (`Derived.unplacedBoard`), `PlaceTool` (Paiguta teegist: klõps lõuendil → `components.add` koos `board`-iga ja uus komponent valitakse; `Esc` katkestab, eelvaade kogu korpuse kontuurina kursori all), Teegi otsing (`kw`), kontekstisektsioon **Korpus ja asend** (pööra `R`/`Shift+R`, pool `F`, **Eemalda paigutus plaadilt**), tundmatu komponent (`X1`, tüüp „Muu“, korpus `area`, mõõdud mm; jalad käsitsi olemasoleva jalgade tabeli kaudu, nende asukohad lõuendil tulevad M1.4-s), paigutamata komponendi paigutamine olemasoleva jalgade arvu ja korpuse sobivuse järgi (sobimatu korpus näitab põhjust, ei paiguta). Uue komponendi väärtus ja märgistus on tühjad. Tühjad olekud [06](../06-kasutajaliides.md#tühjad-olekud) tekstidega `et.ts` failis.

Sobivus kasutab Ül. 4 ID-reeglit. `area` korpuse puhul proovi sama komponenti koos käsitsi lisatud jalgadega eemaldada ja tagasi paigutada. Jalgade `uid`-id säilivad.

- [ ] **Samm 1:** testid: `library_lists_five_footprint_families_and_unknown`, `search_filters_by_keyword_and_shows_empty_state`, `place_tool_adds_placed_component_in_one_command`, `place_tool_esc_leaves_no_trace`, `new_component_value_and_marking_are_empty`, `unplaced_list_places_matching_footprint_only`, `rotate_and_flip_keys_dispatch_commands`, `unknown_component_is_area_with_manual_pins`.
- [ ] **Samm 2–4:** RED → GREEN. **Samm 5:** commit `feat(components): library, placement tool and unplaced list`.

### Ülesanne 9: Mõõda-plokk, mõõtmiste loend ja näidu sildid (`features/measurements/ui`)

**Väljund.** `MeasureBlock`, Mõõtmiste vahekaart ja `ReadingLabels` (z 80). `M` viib fookuse väärtuse väljale. Käitumise aluseks on [sondipaari mustand](../03-arhitektuur.md#5-olek-kolm-eraldi-hoidlat) ja [klaviatuuri reeglid](../06-kasutajaliides.md#klaviatuur).

- Mõõtmismooduli oma hoidla (`features/measurements/ui/measure-store.ts`, otsus 11) hoiab `measureAt` ja `blackProbe` kui `MeasuredPin | null`, mustandeid ning viimati kasutatud toidet; kest kutsub selle lähtestuskonksu projekti vahetusel. `measureAt` muutub ainult jala teadlikul valimisel või `Alt+↓`/`Alt+↑` kasutamisel. Mõõda-plokk peab `AppShell`-is püsima nähtav, kui Koht on seatud, ka pärast üldvaliku tühjenemist. Hoia Koha viide koos `uid`-ga alles ka jala kustutamise järel. Projekti vahetus lähtestab seansi oleku.
- **Vastaspunkt** on esialgu määramata. Kasutaja saab valida jala ja selle valiku hiljem tühjendada. Valitud must sond jääb Koha vahetusel paika. M1.1 `suggestions: PinRef[]` on tühi. Süstides testi soovituse, jääb must sond määramata kuni klõpsuni.
- Mustandi võti on `"<punase uid>|<musta uid või ->"`. Kummagi sondi vahetamisel avaneb vastava paari mustand. `Tab`, tühi klõps, tööriist ja vahekaart jätavad Koha ja mustandi alles. `Esc` mõõteplokis tühjendab aktiivse paari mustandi. `Alt+P` vahetab toite olekut **Teadmata → Sees → Väljas**. Vaikimisi on **Teadmata**.
- `Enter` loeb pinge mooduli avaliku lepingu kaudu ja kutsub `measurements.add`. Kutsuja annab ID ja UTC aja. Ainult õnnestunud käsk tühjendab selle paari mustandi. Fookus jääb väljale. Vigane väärtus näitab põhjust ning kasutab `aria-invalid` märget. Kustutatud punase või musta sondi korral jääb mustand koos selgitusega alles. Salvestamine avaneb uuesti, kui valitud paar on kehtiv või kasutaja tühjendab puuduva musta sondi.
- Mõõtmiste vahekaart näitab pingenäite uuemast alates, siltidega `atLabel` ja `refLabel`. Näita ajaloolise kirje juures „kontakt kustutatud“. Kustutus käib `measurements.remove` kaudu ja on tagasivõetav. Lõuend joonistab kehtivad sildid `Derived.pinReadings` järgi. Värvilised hinnangud tulevad M3-s.

- [ ] **Samm 1.** Testi `black_probe_is_never_chosen_automatically`, `suggestion_sets_reference_only_after_click`, `draft_belongs_to_probe_pair`, `alt_down_does_not_carry_value_to_next_pin`, `tab_does_not_change_location`, `alt_down_stops_at_last_pin_no_wrap`, `enter_saves_and_clears_draft_and_keeps_focus`, `failed_save_retains_draft`, `invalid_voltage_blocks_save_and_shows_reason`, `blank_click_and_tab_change_keep_location_and_draft` ning `deleted_probe_keeps_visible_draft_but_blocks_save` päris kestaga. Lisa `no_canvas_hotkeys_fire_inside_input`, `list_marks_historical_measurements` ja `reading_label_shown_on_pin`.
- [ ] **Samm 2–4.** RED → GREEN. **Samm 5.** Registreeri mooduli UI mõlema äpi jaoks `packages/features/ui.ts` kaudu. Soovitatav commit `feat(measurements): measure block, list and reading labels`.

### Ülesanne 10: Esimene läbiv töövoog, e2e ja vastuvõtt

**Failid.** `apps/web/e2e/m1-1.spec.ts`, `docs/STATUS.md` ja `docs/plans/M1-1-uleandmine.md`. Kontrolli, et Ül. 5–6 lepingud ja `docs/api` vastavad tegelikule teostusele.

- [ ] **Samm 1.** Chromiumi test `first_through_flow_measurement_survives_reopen` loob plaadi, paigutab SOIC-8, salvestab jalale 3 `4,98 V`, sulgeb projekti ja avab viimastest sama pingenäiduga samal jalal. Lisakatsed `unsaved_text_does_not_follow_alt_down`, `blank_click_and_tab_keep_measure_location`, `tab_does_not_change_location`, `drag_with_escape_leaves_no_trace`, `undo_redo_of_placement_and_measurement` ja `board_zoom_pan_survive_view_only_close_and_reopen`.
- [ ] **Samm 2:** `pnpm check`, `pnpm format:check`, `pnpm e2e` (M0 8/8 + uued), `cargo test --locked` (muutmata), `pnpm tauri build --debug`.
- [ ] **Samm 3 (Windowsi suitsukontroll ja kasutaja vastuvõtt).** Korda töövoogu päris aknas nii uue failiga kui ka `v0.1.0` sünteetilise `.pcbk` koopiaga. Kontrolli jala identiteeti pärast taasavamist, ainult vaate muutuse püsimist, heledat ja tumedat teemat, lohistamise katkestamist `Esc`-iga ning akent 1100 × 700.
- [ ] **Samm 4:** üleandmine; commit `feat: M1.1 component on canvas and first measurement`. **M1.1 on valmis ülevaatuseks.**

---

## M1.1 vastuvõtt: tingimus → tõend

| [07 › M1.1](../07-teekaart.md#m11--komponent-fotol-ja-mõõtmine) tingimus | Tõend |
|---|---|
| esimene läbiv töövoog päris äpis, mõõtmine samal jalal | Ül. 10 e2e `first_through_flow…` ja suitsukontroll |
| sondipaari mustand ja Koht püsivad ka üldvaliku tühjendamisel | Ül. 9 sondipaari, tühja klõpsu ja kontaktikao katsed ning Ül. 10 e2e |
| must sond jääb määramata kuni kasutaja valikuni | Ül. 9 `black_probe_is_never_chosen_automatically` ja süstitud soovitusega `suggestion_sets_reference_only_after_click` |
| M0 fail avaneb, suum ja nihe taastuvad | Ül. 6 vana vaate test ning Ül. 10 e2e ja Windowsi suitsukontroll |
| uue komponendi väärtus ja märgistus on tühjad | Ül. 8 `new_component_value_and_marking_are_empty` |
| lohistamine `Esc`/`pointercancel` ei jäta jälge | Ül. 6 `cancelled_drag_leaves_no_trace`; Ül. 10 e2e |
| 5 põhikorpust, plaadipaigutus ja liigutamine, tundmatu komponent, jalad ja olekud, tähis lohistatava sildiga | Ül. 1, 2, 4, 7, 8 testid |
| SOIC-8 jalad 1 ja 8 õiges kohas | Ül. 1 `soic8_pin1_and_pin8_positions` |

## Mis jääb järgmistesse plaanidesse

- **M1.2 foto ja kalibreerimine.** Enne fotodega töö alustamist tõenda, et sama projekti ID-ga failiharude varukoopiad püsivad lahus ning meediata päästekoopia on kasutajale selgelt märgitud. Kinnita `v0.1.0` failide ühilduvus. Mõõda SVG jõudlust päris Tauri aknas, kontrolli EXIF-suunda lõuendil ning proovi foto eksporti PNG-sse (teekaardi M1.2).
- **M1.2 enne fotosid:** `meta.file_id` (füüsilise faili tunnus) lisatakse kõrvuti `project_id`-ga; varukoopiad ja dokumendikoopia alus seotakse `file_id`-ga ning taastatud fail ja „Salvesta mujale…“ täielik koopia saavad uue `file_id` (otsus, Fable soovitus). Vaate olekusse tuleb mooduli kaupa pesa (`modules: Record<string, unknown>`), mida moodul tolerantselt loeb. Foto eksport PNG-sse proovitakse M1.2-s (määrab, kuidas fotobaidid frontendini jõuavad). Otsustatakse, kas töölaua suitsukontrolli viis põhivoogu automatiseeritakse.
- **Enne M2.1:** üldkäskude `items.delete`/`items.translate` objektitüübi reeglid liiguvad domeeni puhasteks funktsioonideks; mootor ainult kutsub.
- **M1.2 paigutus pööratud või peegeldatud stseenis.** Uus komponent peab ekraanil ilmuma püstiselt: `PlaceTool` kompenseerib algse `rotationDeg`-i ja `side`-i stseeni teisendusega. Juba paigutatud komponendid pöörduvad ja peegelduvad koos fotoga. Test: kõigi 8 teisenduse korral on uue SOIC-8 jalg 1 ekraanil vasakul üleval.
- **M1.3 ja M1.4.** Korpuste täisteek, korpuse vahetus, suurus, joondus ja oma jalad. Katseta foto ja jalastiku jõudlust ilma radasid eeldamata. 1000 rajaga katse saab tulla pärast M2.1. Kui oma jalgadel on asukohad (`customPads`), peab jala eemaldamine koristama ka selle `customPads`-i ja jalale viitavad `padMap`-i kirjed.
- **M1 hoolduskaart** (eraldi väike kaart pärast M1.1, enne M1.2): salvestusvea korral projekti vahetamine sama valikutega dialoogiga kui sulgemine; `stale_rev` selge veateade; Rusti `storage/backup.rs` jagamine alla 400 rea; `workbench.test.tsx` jagamine. Veebi `discard` muutus koos e2e-tõendiga. Lisaks Fable ülevaatusest:
  - **failivormingu kaitse:** test „skeem muutus, `format_version` mitte“ ning iga väljalaske näidisfail (`v0.1.0`) testandmetes, mis peab avanema;
  - käsu sees tekkinud programmiviga annab uue veakoodi `internal` (mitte `validation`) ja logirea;
  - kasutamata `EngineModule.migrations` eemaldatakse; migratsioonid on ühes kohas domeenis;
  - domeen jagatakse alamteedeks valdkonna kaupa ja TOOL-1 teeb API kokkuvõtte iga alamtee kohta;
  - invariandid liiguvad domeeni valdkonna kaupa ja kontrollitakse ainult muudetud välju (mõõtmise järel);
  - komponendi olemasolevad tekstid kolivad mooduli `ui/i18n/et.ts`-i;
  - domeeni testikatvuse lävi (≥ 90 %) jõustatakse `vitest.config.ts`-is.
- **Mõõtmise vastaspunkt M3-s:** takistusel ja dioodil on vastaspunkt kohustuslik, sest need on kahe punkti mõõtmised; kasutaja valib selle ise ja äpp ei oleta. See asendab M0 plaani M1 märke, mille järgi oli vastaspunkt valikuline. Pinge vastaspunkt jääb valikuliseks.
- **M2 ja M3.** M2.1 lisab elektrilised ühendused. M2.2 lisab läbivuse ja kontrollib aegunud mõõtmise mõju katseandmetega. M3 lisab remondi täisvoo, takistuse ja dioodi koos vastaspunkti nõudega ning mõõtmiste hinnangud. Hilisemad kaardid kasutavad eelnevalt vastu võetud teostuse tegelikku seisu.
