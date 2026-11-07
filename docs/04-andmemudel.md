# 04 · Andmemudel

Kõik tüübid on failides `src/core/model/*.ts` koos zod-skeemidega. Siin on autoriteetne loend. Kui kood erineb, parandatakse koodi või muudetakse see dokument teadlikult koos `format_version` tõstmisega.

## Põhimõtted

- **Muutumatu dokument.** `BoardDoc` muudetakse ainult käskudega (Immeri mustand).
- **Id-d** on stabiilsed stringid kujul `<prefiks>_<nanoid(10)>`: `cmp_`, `con_`, `lbl_`, `rol_`, `msr_`, `rep_`, `pho_`, `dim_`, `are_`, `att_`. Jala id on korpuse jala number või nimi (`"4"`, `"A4B9"`, `"EP"`); jala täisviide on `PinRef = { c: componentId, p: pinId }`.
- **Ühikud:** asukohad on foto pikslites, korpuse geomeetria millimeetrites, nurgad kraadides (päripäeva, y alla), pinge voltides, takistus oomides, aeg ISO 8601 UTC kujul.
- **Tähis ≠ id.** Kasutaja saab tähist (`R1`) vabalt muuta; viited kasutavad alati id-d.

## Tüübid

```ts
type Vec2 = { x: number; y: number };
type PinRef = { c: string; p: string };
type Side = 'top' | 'bottom';

interface BoardDoc {
  format_version: 1;
  rev: number;                         // kasvab iga käsuga
  name: string;
  device?: string;                     // seade / mudel
  problem?: string;                    // „Mis on viga?“
  status: 'mapping' | 'mapped';        // „Märgi kaardistus valmis“
  mappedAt?: string; mappedSnapshot?: ProgressSnapshot;
  scale: { pxPerMm: number; calibrated: boolean; calib?: { a: Vec2; b: Vec2; mm: number } };
  photos: PhotoRef[];                  // v1: üks pealmise poole foto; alumise poole oma tuleb M5-s
  activePhotoId?: string;
  components: Component[];
  connections: Connection[];
  netLabels: NetLabel[];
  roles: NetRole[];                    // vaikimisi DEFAULT_ROLES, kasutaja saab lisada
  measurements: Measurement[];
  repairs: RepairAction[];
  areas: DamageArea[];
  dimensions: Dimension[];
  outline?: BoardOutline;
  schematic: { placements: Record<string, SchematicPlacement> };
  guide: { skipped: string[] };        // vahele jäetud juhendi sammud
}

interface PhotoRef { id: string; side: Side; widthPx: number; heightPx: number; name: string; transform: 'none' | 'rot90' | 'rot180' | 'rot270' | 'mirror' | 'mirror_rot90' | 'mirror_rot180' | 'mirror_rot270' }

interface Component {
  id: string; ref: string; value: string;
  kind: ComponentKind;                 // määrab skeemi sümboli
  footprint: string;                   // generaatori võti, nt 'soic'
  params: Record<string, string | number>;
  center: Vec2; rotationDeg: number; side: Side;
  scaleX: number; scaleY: number;      // 1 = korpuse nominaalsuurus; piirid 0.2–5
  identified: boolean;                 // Tuvastatud / Tuvastamata
  dnp: boolean;                        // paigaldamata
  pinNames: Record<string, string>;    // { '8': 'VCC' }
  pinNc: string[];                     // jalad, mis on märgitud ühendamata (NC)
  extraPins: CustomPin[];
  note: string;
  referenceImageId?: string;           // attachments.id (andmelehe joonis)
}
type ComponentKind = 'resistor' | 'capacitor' | 'capacitor_polarized' | 'inductor' | 'diode' | 'led' | 'zener'
  | 'npn' | 'pnp' | 'nmos' | 'pmos' | 'regulator' | 'ic' | 'connector' | 'crystal' | 'switch' | 'fuse'
  | 'testpoint' | 'via' | 'pad' | 'wire_point' | 'hole' | 'other';
interface CustomPin { id: string; local: Vec2 /* mm */; sizeMm: number; shape: 'circle' | 'rect' }

interface Connection {
  id: string;
  kind: 'trace' | 'wire' | 'link';     // rada (marsruudiga) | juhe | link (otseside, katkendjoon)
  a: Endpoint; b: Endpoint;
  waypoints: Vec2[];                   // ainult 'trace' ja 'wire'
  layer: 'top' | 'bottom';             // 'trace' puhul
  widthMm: number;                     // 'trace' vaikimisi 0.4
  basis: 'assumed' | 'visual';         // kuidas ühendus tekkis: kiirühendus ja piiksu link = oletatud, joonistatud rada/juhe = nähtud
  evidenceId?: string;                 // Measurement.id, mis ühenduse mõõtmisega kinnitas; tase „mõõdetud“ arvutatakse (vt „Ühenduse tase“)
}
type Endpoint = { pin: PinRef } | { point: Vec2 };

interface NetRole { id: string; label: string; kind: 'ground' | 'power' | 'signal' | 'unknown'; nominalV?: number; color: string /* #rrggbb */ }
interface NetLabel { id: string; anchor: string /* PinRef võti 'cmp_x:4' või 'con:<id>' */; name?: string; roleId?: string }

interface Measurement {
  id: string;
  mode: 'voltage' | 'resistance' | 'diode' | 'continuity';
  at: PinRef;                          // Koht (punane sond)
  ref?: PinRef;                        // Vastaspunkt (must sond); ilma selleta pinget ei hinnata
  value?: number;                      // SI ühikutes: V või Ω
  beep?: boolean;                      // läbivus
  power: 'on' | 'off' | 'unknown';
  takenAt: string;
  note?: string;
  atLabel: string; refLabel?: string;  // salvestamise hetke tähised ('U1.8'), et kustutamise järel jääks loetav
  staleByRepairId?: string;            // ≠ undefined → „enne remonti“
  source: 'manual' | 'beep_mode';
}

interface RepairAction { id: string; componentId?: string; action: 'replaced' | 'removed' | 'reflowed' | 'trace_fixed' | 'other'; text: string; at: string }
interface DamageArea { id: string; shape: 'rect' | 'ellipse'; x: number; y: number; w: number; h: number; text: string }
interface Dimension { id: string; a: Endpoint; b: Endpoint; offsetPx: number }
interface BoardOutline { x: number; y: number; w: number; h: number; showDims: boolean }
interface SchematicPlacement { x: number; y: number; rot: 0 | 90 | 180 | 270; mirror: boolean }
```

## Vaikimisi rollid

| id | label | kind | nominalV | värv |
|---|---|---|---|---|
| `rol_gnd` | GND | ground | 0 | `#1f2523` (heledal), joonistusel tumehall/must |
| `rol_3v3` | 3V3 | power | 3,3 | `#e8891c` oranž |
| `rol_5v` | 5V | power | 5,0 | `#d9342b` punane |
| `rol_12v` | 12V | power | 12,0 | `#2a64d6` sinine |
| `rol_sig` | Signaal | signal | — | `#8a4fd3` lilla |
| `rol_unk` | Teadmata | unknown | — | `#8c9692` hall |

Tumedas teemas joonistatakse GND heledama halliga (`#9aa5a0`), et see paistaks taustal välja; salvestatud väärtus ei muutu.

## Võrkude arvutus (`core/nets/resolveNets`)

- **Union-find** üle jalgade (`PinRef` võti) ja ühenduste. Iga ühendus liidab oma `a` ja `b` otsa. Kui `waypoints` puudub, on ühendus link.
- **Vaba ots** (punkt) liitub teise ühendusega, kui see asub ≤ `0.25 mm · pxPerMm + teise laius / 2` kaugusel selle polüjoonest, või jalaga, kui ots asub selle padjandi sees.
- **Võrgu võti** on selle väikseima ühenduse id.
- **Nimi ja roll** tulevad siltidest, mille `anchor` kuulub võrku. Kui kahel sildil on eri `roleId`, siis `roleConflict = true`, `role = undefined` ja `conflictingRoles` loetleb need. Nimeks saab esimene mitte-tühi `name` (ankrute tähestikulises järjekorras); kui seda pole, siis `N1`, `N2` … (võrgu võtme järjekorras).
- **Negatiivne läbivus:** kui kahe jala vahel on mõõtmine `beep = false` ja need jalad satuvad samasse võrku, siis `beepContradiction = true` (hoiatus „Läbivustest ütles, et ühendust pole“).

## Ühenduse tase (`core/measure/connectionLevel`)

Ühenduse usaldusväärsuse tase ([01](01-pohimotted.md#info-usaldusväärsus-kolm-taset)) arvutatakse, mitte ei salvestata:

- `level = 'measured'`, kui `evidenceId` viitab olemasolevale ja mitte aegunud mõõtmisele, kus `mode = continuity`, `beep = true` ning `{at, ref}` on sama jalapaar mis ühenduse otsad. Muidu `level = basis`.
- Seetõttu viib mõõtmise kustutamine (`measurements.remove`), remondist tulenev aegumine või ühenduse otsa lahtiühendamine ühenduse kohe tagasi *nähtud* või *oletatud* tasemele. Ühenduse andmeid selleks ei muudeta ja tagasivõtmine taastab ka taseme.
- Kui `evidenceId` on olemas, aga tase pole `measured`, näitab ühenduse kontekst „Mõõtmine aegunud“ või „Mõõtmine kustutatud“ ja nuppu „Mõõda uuesti“ (avab piiksumisrežiimi selle jalapaariga).
- Käsitsi mõõdetuks märkimist ei ole. `evidenceId` paneb ainult käsk `beep.record` (piiksumisrežiimi „Jah“), mis teeb **ühe tagasivõetava sammuna** järgmist: lisab läbivuse mõõtmise; kui samade jalgade vahel on juba otseühendus, saab see `evidenceId`; kui jalad on juba muu tee kaudu samas võrgus, jääb alles ainult mõõtmine; muidu tekib uus link (`basis = 'assumed'`, `evidenceId`). Vastus „Ei“ lisab ainult mõõtmise `beep = false`.

## Mõõtmiste hindamine

`evaluate(m: Measurement, nets): Verdict`, kus `Verdict = 'ok' | 'low' | 'high' | 'short' | 'none'`.

| Juhtum | Tingimus | Tulemus |
|---|---|---|
| Aegunud | `m.staleByRepairId` on määratud | `none` (ei värvi jalga) |
| Pinge toitega | `mode = voltage`, `power = on`, `ref` on määratud ning nii Koha kui ka vastaspunkti võrgul on kehtiv roll koos `nominalV`-ga. Oodatav pinge `exp = nominalV(at) − nominalV(ref)`, tolerants `tol = max(0.1, 0.1 · |exp|)` | järjekorras: `|v − exp| ≤ tol` → `ok`; `exp ≠ 0`, `v` märk on vastupidine ja `|v| > tol` → `high` (vihje „Sondid võivad olla vahetuses“); `|v| < |exp|` → `low`; muidu `high` |
| Takistus toite ja maa vahel | `mode = resistance`, üks ots power- ja teine ground-võrgus | `value < 1.0 Ω` → `short`, muidu `none` |
| Läbivus eri rollide vahel | `mode = continuity`, `beep = true`, otste võrkudel on eri roll ja kumbki pole `signal`/`unknown` | `short` |
| Kõik muu | sh rollita võrk, vastaspunktita pinge, vastaspunkt signaal- või rollita võrgus, toiteta pinge, diood | `none` |

Pinge hinnang arvestab alati mõlemat sondi. Vastaspunktita pinget ei hinnata, sest äpp ei oleta, kus must sond oli; vastaspunkti saab hiljem mõõtmise real määrata (`measurements.update`) ja siis hinnang arvutatakse.

Kontrollväärtused (`core/measure/evaluate.test.ts`), must sond GND-võrgus: 5V võrgus 4,55 → ok; 4,49 → low; 5,51 → high; −5,0 → high (sondid vahetuses). 3V3 võrgus 2,9 → low. GND võrgus 0,05 → ok; 0,2 → high. Must sond mujal: punane 5V, must 12V: −7,0 → ok; −5,0 → low; +7,0 → high (sondid vahetuses); punane 12V, must 5V: 7,0 → ok. Vastaspunktita pinge → none; vastaspunkt Signaal-võrgus → none. Takistus 5V ↔ GND: 0,6 Ω → short; 1,0 Ω → none. Läbivus 12V ↔ 5V → short; Signaal ↔ 5V → none. Toiteta pinge → none.

**Jala hinnang** (`latestVerdicts`): iga jala jaoks loetakse viimane kehtiv (mitte aegunud) mõõtmine, kus jalg on `at` või (takistuse ja läbivuse puhul) `ref`.

**Väärtuse lugemine** (`parseReading(text, mode)`): koma ja punkt on võrdsed, tühikud eemaldatakse, sufiksid `m` (10⁻³), `k`, `M`. Ka kuju `4k7` = 4700. Ühik võib olla lõpus (`4,98V`, `10 kΩ`). Vigane sisend annab `null`.

## Remont ja aegumine

Käsk `repair.add({componentId, action, text})`:
1. lisab `RepairAction` kirje;
2. märgib aegunuks (`staleByRepairId = rep.id`) kõik kehtivad mõõtmised, mille `at` või `ref` on selle komponendi jalg **või asub samas võrgus mõne selle komponendi jalaga**;
3. avaldab sündmuse `repair.added` koos nende jalgade loendiga (remondimoodul pakub „Mõõda uuesti“).

Komponendita remont (nt rada parandatud) ei aegu ühtegi mõõtmist automaatselt.

## Valmidus (`core/progress`)

```ts
interface ProgressSnapshot {
  componentsIdentified: [done: number, total: number]; // total ilma DNP-ta
  pinsMapped: [number, number];                        // võrgus või pinNc
  powerDefined: boolean;                               // GND-roll olemas ja iga power-rolliga võrk ≥ 2 jalaga
  assumedConnections: number;                          // ühendused, mille arvutatud tase on „oletatud“
  roleConflicts: number;
  suspectMeasurements: number;                         // kehtivad low/high/short
}
```
Edenemisriba = keskmine kolmest osakaalust: komponendid tuvastatud, jalad kaardistatud ja juhendi sammud tehtud.

## Kustutamise reeglid

- Komponendi kustutamine teeb järgmist: selle jalgadele viitavad ühenduste otsad muutuvad vabadeks punktideks, mõõtmised jäävad alles (loetav `atLabel` säilib), sildid, mille ankur oli selle jalg, kustutatakse ja skeemi paigutus eemaldatakse. Kõik see on üks tagasivõetav käsk.
- Oma jala kustutamisel kehtivad samad reeglid selle ühe jala kohta.
- Mõõtmise kustutamine ei muuda ühendusi. Ühendus, mille `evidenceId` sellele viitas, langeb arvutatud tasemelt tagasi *nähtud* või *oletatud* tasemele ([Ühenduse tase](#ühenduse-tase-coremeasureconnectionlevel)); tagasivõtmine taastab mõlemad.
- Rolli kustutamine on lubatud ainult siis, kui ükski silt seda ei kasuta. Vaikerolle ei saa kustutada, ainult ümber nimetada või värvi muuta.

## JSON eksport ja import

- **Eksport** (`project.json`): `{ app: 'pcb-kaardistaja', format_version: 1, exported_at, doc: BoardDoc, photos: [{ id, mime, width, height, data_base64 }] }`.
- **Prototüübi import** (`.pcbmap.json`, `app: 'pcb-kaardistaja'`, `v: 1`): `doc.comps → components` (`type → footprint`, `x,y → center`, `rot`, `side`, `params`, `pn → pinNames`, `extra[{id,x,y,d}] → extraPins`, `kind` tuletatakse korpusest ja prefiksist, `identified = value !== ''`); `doc.traces → connections` (`a/b` koos `c,p` → `{pin}`, muidu `{point}`; `pts → waypoints`; `w → widthMm`; `layer: 'wire'` → `kind: 'wire'`; `basis: 'visual'`); mitte-tühi `trace.net` → `NetLabel { anchor: esimene jala-ots, name }`; `doc.dims → dimensions`; `doc.outlines[0] → outline`; `doc.ppm`, `doc.calibrated`, `doc.calib`, `doc.name`; `img.src` (andme-URI) → foto.
- **Migratsioonid:** `core/io/migrations/NNNN_<kirjeldus>.ts` ekspordib `up(doc: unknown): unknown`. Avamisel käivitatakse kõik vajalikud migratsioonid järjest ja tulemus valideeritakse `BoardDocSchema` vastu. Igal migratsioonil on test, mis kontrollib eelmise versiooni näidisfaili teisendamist.
