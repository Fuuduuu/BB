# 04 · Andmemudel

Kõik tüübid on failides `packages/domain/src/model/*.ts` koos zod-skeemidega. Siin on autoriteetne loend. Kui kood erineb, parandatakse koodi või muudetakse see dokument teadlikult koos `format_version` tõstmisega.

## Põhimõtted

- **Muutumatu dokument.** `BoardDoc` muudetakse ainult käskudega (Immeri mustand mootoris). Frontend näeb seda külmutatud hetktõmmisena ([03 § 5](03-arhitektuur.md#5-olek-kolm-eraldi-hoidlat)).
- **Id-d** on stabiilsed stringid kujul `<prefiks>_<nanoid(10)>`: `cmp_`, `con_`, `lbl_`, `rol_`, `msr_`, `rep_`, `pho_`, `dim_`, `are_`, `att_`. Uue objekti id loob käsu kutsuja.
- **Jala viide** on `PinRef = { c: componentId, p: pinId }`, kus jala id on korpuse jala number või nimi (`"4"`, `"A4B9"`, `"EP"`) ja oma jalal `CustomPin.id`. Jala id on püsiv: sama numbriga jalg jääb seotuks ka siis, kui korpuse parameetrid muudavad selle asukohta. Jala ümbernimetamine (`pinNames`) id-d ei muuda.
- **Projekti identiteet** (`project_id`, `copied_from_project_id`) on faili `meta` tabelis, mitte dokumendis, sest see ei ole tagasivõetav andmetükk ([03 § 9](03-arhitektuur.md#9-salvestus-ja-projekti-fail)).
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
  measureSettings: { voltageTolerancePct: number; voltageToleranceMinV: number }; // vaikimisi 10 % ja 0,1 V
  repairs: RepairAction[];
  areas: DamageArea[];
  dimensions: Dimension[];
  outline?: BoardOutline;
  schematic: { placements: Record<string, SchematicPlacement> };
  guide: { skipped: string[] };        // vahele jäetud juhendi sammud
}

interface PhotoRef {
  id: string; side: Side; name: string;
  widthPx: number; heightPx: number;   // originaalfoto mõõdud; kõik kaardistuse koordinaadid on nendes pikslites
  transform: 'none' | 'rot90' | 'rot180' | 'rot270' | 'mirror' | 'mirror_rot90' | 'mirror_rot180' | 'mirror_rot270';
                                       // algväärtus tuleb EXIF-orientatsioonist; rakendub kogu stseenile (03 § 7.1)
}

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
}                                      // tase „mõõdetud“ arvutatakse mõõtmistest (vt „Ühenduse tase“)
type Endpoint = { pin: PinRef } | { point: Vec2 };

interface NetRole { id: string; label: string; kind: 'ground' | 'power' | 'signal' | 'unknown'; nominalV?: number; color: string /* #rrggbb */ }
interface NetLabel { id: string; anchor: string /* PinRef võti 'cmp_x:4' või 'con:<id>' */; name?: string; roleId?: string }

interface Measurement {
  id: string;
  mode: 'voltage' | 'resistance' | 'diode' | 'continuity';
  at: PinRef;                          // Koht (punane sond, dioodirežiimis +)
  ref?: PinRef;                        // Vastaspunkt (must sond, dioodirežiimis −); ilma selleta pinget ei hinnata
  value?: number;                      // SI ühikutes: V või Ω; puudub, kui overload = true
  overload?: boolean;                  // „OL“: takistus või diood üle mõõtepiirkonna (avatud ahel)
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

## Võrkude arvutus (`resolveNets`)

- **Union-find** üle jalgade (`PinRef` võti) ja ühenduste. Iga ühendus liidab oma `a` ja `b` otsa. Kui `waypoints` puudub, on ühendus link.
- **Vaba ots** (punkt) liitub teise ühendusega, kui see asub ≤ `0.25 mm · pxPerMm + teise laius / 2` kaugusel selle polüjoonest, või jalaga, kui ots asub selle padjandi sees.
- **Kihid:** raja (`trace`) vaba ots liitub ainult **sama kihi** rajaga. Pealmine ja alumine kiht ühinevad ainult jala kaudu (läbiv jalg, `via` või testpunkt). Juhtme ja lingi vaba ots liitub mõlema kihi rajaga, sest kasutaja on selle teadlikult sinna pannud.
- **Võrgu võti** on selle väikseima ühenduse id.
- **Nimi ja roll** tulevad siltidest, mille `anchor` kuulub võrku. Kui kahel sildil on eri `roleId`, siis `roleConflict = true`, `role = undefined` ja `conflictingRoles` loetleb need. Nimeks saab esimene mitte-tühi `name` (ankrute tähestikulises järjekorras); kui seda pole, siis `N1`, `N2` … (võrgu võtme järjekorras).
- **Negatiivne läbivus:** kui kahe jala vahel on mõõtmine `beep = false` ja need jalad satuvad samasse võrku, siis `beepContradiction = true` (hoiatus „Läbivustest ütles, et ühendust pole“).
- **Lühistatud kahejalgne komponent:**
  - Kui kahejalgse komponendi (`resistor`, `capacitor`, `capacitor_polarized`, `inductor`, `diode`, `led`, `zener`, `fuse`, `crystal`) mõlemad jalad on samas võrgus, siis `shortedComponents` sisaldab seda komponenti ja tuleb hoiatus „R5 mõlemad jalad on samas võrgus. Kas ühendus on õige?“.
  - Tavaliselt on see kaardistusviga, näiteks piiks läbi väikese takisti, aga see võib olla ka päris lühis.
  - Hoiatus on komponendi ja võrgu kontekstis ning kahtlaste vaates. Hinnanguid see ei muuda.
  - Kui komponent on teadlikult sild (nt 0 Ω takisti), kirjutab kasutaja selle märkusesse ja hoiatus jääb informatiivseks.

## Ühenduse tase (`connectionLevels`)

Ühenduse usaldusväärsuse tase ([01](01-pohimotted.md#info-usaldusväärsus-kolm-taset)) arvutatakse mootoris mõõtmistest, mitte ei salvestata ühenduse külge:

- Ühendus, mille mõlemad otsad on jalad `a` ja `b`, on **mõõdetud**, kui nende jalgade vahel (kummaski suunas) on kehtiv, mitte aegunud läbivusmõõtmine ja viimane selline on `beep = true`. Pole vahet, kas see tehti piiksumisrežiimis või tavalise mõõtmisena. Muidu on tase `basis`.
- Kui viimane kehtiv läbivus samade jalgade vahel on `beep = false`, on tase `basis` ja ühendusel on hoiatus „Läbivustest ütles, et ühendust pole“.
- Mõõtmise kustutamine, remondist tulenev aegumine või otsa lahtiühendamine (ots muutub punktiks) viib ühenduse kohe tagasi *nähtud* või *oletatud* tasemele. Uus kehtiv piiks taastab ✓. Ühenduse andmeid selleks ei muudeta.
- Mõõdetud tase kinnitab **jalapaari elektrilist sidet**, mitte fotole joonistatud konkreetset rada. Kui samade jalgade vahel on kaks ühendust (nt rada ja hiljem lisatud parandusjuhe), on mõlemad mõõdetud.
- Käsitsi mõõdetuks märkimist ei ole.

### Piiks ei tõenda sama vaskrada

Mõõteriist piiksub alla oma läve, mis võib olla kümneid oome. 10 Ω takisti otsad piiksuvad, kuigi need on skeemis eri sõlmed. Seepärast eristatakse kahte asja:
- **mõõtetulemus** „läbivus olemas“ (`Measurement`, `beep = true`) salvestatakse alati;
- **tehniku otsus** „need jalad on samas võrgus“ (`Connection`) tehakse ainult siis, kui see on ilmne või kasutaja selle kinnitab.

Käsk `beep.record({ anchor, pin, beep, connect })` teeb kõik **ühe tagasivõetava sammuna**:
1. Lisab läbivuse mõõtmise (`source = 'beep_mode'`).
2. Kui `beep = true` ja `connect = true`:
   - kui jalad on juba samas võrgus, rohkem midagi ei lisata;
   - muidu tekib link (`basis = 'assumed'`), mille tase on mõõtmise tõttu kohe „mõõdetud“.
3. Vastus „Ei“ lisab ainult mõõtmise `beep = false`.

Piiksumisrežiimis saadab „Jah“ vaikimisi `connect = true` (kiire kaardistus). **Automaatselt ei ühendata** kahel juhul; siis salvestatakse ainult mõõtmine ja küsitakse otse lõuendil „Piiksub läbi komponendi R5. Ühendan ikkagi?“ ([02 § 8.3](02-kasutaja-teekond.md#83-piiksumisrežiim-mõõdetud-kõige-kiirem-kaardistus)):
- kui jalad on sama kahejalgse passiivkomponendi otsad (`resistor`, `inductor`, `fuse`, `capacitor`, `capacitor_polarized`, `diode`, `led`, `zener`, `crystal`, `switch`);
- kui ühendamine liidaks kaks eri rolliga võrku.

## Mõõtmiste hindamine

`evaluate(m: Measurement, nets, settings: BoardDoc['measureSettings']): Verdict`, kus `Verdict = 'ok' | 'low' | 'high' | 'short' | 'none'`.

| Juhtum | Tingimus | Tulemus |
|---|---|---|
| Aegunud | `m.staleByRepairId` on määratud | `none` (ei värvi jalga) |
| Pinge toitega (DC) | `mode = voltage`, `power = on`, `ref` on määratud ning nii Koha kui ka vastaspunkti võrgul on kehtiv roll koos `nominalV`-ga. Oodatav pinge `exp = nominalV(at) − nominalV(ref)`, tolerants `tol = max(voltageToleranceMinV, voltageTolerancePct/100 · |exp|)` | järjekorras: `|v − exp| ≤ tol` → `ok`; `exp ≠ 0`, `v` märk on vastupidine ja `|v| > tol` → `high` (vihje „Sondid võivad olla vahetuses“); `|v| < |exp|` → `low`; muidu `high` |
| Takistus toite ja maa vahel | `mode = resistance`, üks ots power- ja teine ground-võrgus, `overload` puudub | `value < 1.0 Ω` → `short` (kahtlus), muidu `none` |
| Diood toite ja maa vahel | `mode = diode`, üks ots power- ja teine ground-võrgus, `overload` puudub | `value < 0.05 V` → `short` (kahtlus), muidu `none` |
| Läbivus eri rollide vahel | `mode = continuity`, `beep = true`, otste võrkudel on eri roll ja kumbki pole `signal`/`unknown` | `short` |
| Kõik muu | sh rollita võrk, vastaspunktita pinge, vastaspunkt signaal- või rollita võrgus, toiteta pinge, „OL“, muu dioodimõõtmine, vahelduvpinge | `none` |

- **Pinge hinnang arvestab alati mõlemat sondi.** Vastaspunktita pinget ei hinnata, sest äpp ei oleta, kus must sond oli. Vastaspunkti saab hiljem mõõtmise real määrata (`measurements.update`) ja siis hinnang arvutatakse.
- **Mis tähendab OK:** „OK“ tähendab, et näit vastab rolli järgi oodatule. See ei tähenda, et komponent või plaat on korras.
- **„Lühis“ on alati kahtlus.** Paralleelsed teed ja sondide takistus mõjutavad näitu, nii et äpp ei kuuluta lühist kindlaks.
- **V1 hindab ainult alalispinget.** Dioodirežiimis salvestatakse näit, polaarsus (`at` = +, `ref` = −) ja „OL“, aga üldist automaatdiagnoosi pole.
- **Tolerants** (`measureSettings`) on projekti seadetes muudetav. Vaikimisi on see 10 % ja vähemalt 0,1 V.
- **Maa ja maa vahel** (mõlemad otsad ground-võrgus, `exp = 0`): kui `0,05 V < |v| ≤ tol`, jääb hinnanguks `ok`, aga mõõtmise real on infovihje „Maa-radade vahel on pingelang. Kontrolli maarada.“ Juba väike pingelang maade vahel viitab katkisele või liiga peenele maarajale või suurele voolule.

Kontrollväärtused (`packages/domain/src/measure/evaluate.test.ts`, vaikeseaded):
- **Must sond GND-võrgus:**
  - 5V võrgus: 4,55 → ok; 4,49 → low; 5,51 → high; −5,0 → high (sondid vahetuses);
  - 3V3 võrgus: 2,9 → low;
  - GND võrgus: 0,05 → ok; 0,07 → ok koos infovihjega; 0,2 → high.
- **Must sond mujal:** punane 5V ja must 12V: −7,0 → ok; −5,0 → low; +7,0 → high (sondid vahetuses). Punane 12V ja must 5V: 7,0 → ok.
- **Ilma hinnanguta:** vastaspunktita pinge → none; vastaspunkt Signaal-võrgus → none; toiteta pinge → none.
- **Takistus 5V ↔ GND:** 0,6 Ω → short; 1,0 Ω → none; OL → none.
- **Diood 5V ↔ GND:** 0,02 V → short; 0,45 V → none; OL → none.
- **Läbivus:** 12V ↔ 5V → short; Signaal ↔ 5V → none.

**Jala hinnang** (`latestVerdicts`): iga jala jaoks loetakse viimane kehtiv (mitte aegunud) mõõtmine, kus jalg on `at` või (takistuse, dioodi ja läbivuse puhul) `ref`.

**Väärtuse lugemine** (`parseReading(text, mode)`): koma ja punkt on võrdsed, tühikud eemaldatakse, sufiksid `m` (10⁻³), `k`, `M`. Ka kuju `4k7` = 4700. Ühik võib olla lõpus (`4,98V`, `10 kΩ`). Takistuse ja dioodi puhul tähendab `OL` (suur- või väiketähtedega) `overload = true`. Vigane sisend annab `null`.

## Remont ja aegumine

Käsk `repair.add({componentId, action, text})`:
1. lisab `RepairAction` kirje;
2. märgib aegunuks (`staleByRepairId = rep.id`) kõik kehtivad mõõtmised, mille `at` või `ref` on selle komponendi jalg **või asub samas võrgus mõne selle komponendi jalaga**;
3. avaldab sündmuse `repair.added` koos nende jalgade loendiga (remondimoodul pakub „Mõõda uuesti“).

Komponendita remont (nt rada parandatud) ei aegu ühtegi mõõtmist automaatselt.

## Valmidus (`computeProgress`)

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
- **Korpuse vahetus** (`components.update` muudab `footprint`-i või jalgade arvu mõjutavaid `params`-e):
  - Sama id-ga jalad jäävad seotuks, ka kui nende asukoht muutub.
  - Kui mõni kaduv jalg on ühenduse ots, sildi ankur, mõõtmise koht või vastaspunkt või kui sellel on nimi või NC-märge, küsib äpp enne kinnitust ja loetleb mõju („Kaovad jalad 9–14: 3 ühendust, 2 mõõtmist, 1 silt“).
  - Kinnitamisel on kõik üks tagasivõetav käsk: ühenduste otsad muutuvad vabadeks punktideks jala endises kohas, nende jalgade sildid kustutatakse, `pinNames` ja `pinNc` kirjed eemaldatakse ning mõõtmised jäävad alles (loetav `atLabel`).
- Mõõtmise kustutamine ei muuda ühendusi. Ühenduse arvutatud tase langeb tagasi *nähtud* või *oletatud* tasemele, kui samade jalgade vahel pole enam kehtivat piiksu ([Ühenduse tase](#ühenduse-tase-connectionlevels)). Tagasivõtmine taastab mõlemad.
- Rolli kustutamine on lubatud ainult siis, kui ükski silt seda ei kasuta. Vaikerolle ei saa kustutada, ainult ümber nimetada või värvi muuta.

## JSON eksport ja import

- **Eksport** (`project.json`): `{ app: 'pcb-kaardistaja', format_version: 1, project_id, exported_at, doc: BoardDoc, photos: [{ id, mime, width, height, data_base64 }] }` (originaalfotod).
- **Impordi vastuvõtureeglid** kehtivad kõigile importidele (`project.json`, `.pcbmap.json`):
  - **Suurusepiirid:** fail kuni 500 MB, üks foto kuni 100 MB, kuni 5000 komponenti.
  - **Täielik kontroll:** zod-skeemi täielik kontroll pärast migratsiooni; id-d peavad olema unikaalsed.
  - **Viidete terviklus:** iga `PinRef` viitab olemasolevale komponendile ja jalale, iga `roleId` olemasolevale rollile ning iga `staleByRepairId` olemasolevale remondile.
  - **Import loob alati uue projekti** (uus `project_id`; `copied_from_project_id` = ekspordi `project_id`, kui see on olemas). Avatud projekti see ei puuduta.
  - **Vea korral** projekti ei looda ja kasutaja näeb esimesi vigu loetava loendina.
- **Prototüübi import** (`.pcbmap.json`, `app: 'pcb-kaardistaja'`, `v: 1`): `doc.comps → components` (`type → footprint`, `x,y → center`, `rot`, `side`, `params`, `pn → pinNames`, `extra[{id,x,y,d}] → extraPins`, `kind` tuletatakse korpusest ja prefiksist, `identified = value !== ''`); `doc.traces → connections` (`a/b` koos `c,p` → `{pin}`, muidu `{point}`; `pts → waypoints`; `w → widthMm`; `layer: 'wire'` → `kind: 'wire'`; `basis: 'visual'`); mitte-tühi `trace.net` → `NetLabel { anchor: esimene jala-ots, name }`; `doc.dims → dimensions`; `doc.outlines[0] → outline`; `doc.ppm`, `doc.calibrated`, `doc.calib`, `doc.name`; `img.src` (andme-URI) → foto.
- **Migratsioonid:** `packages/domain/src/migrations/NNNN_<kirjeldus>.ts` ekspordib `up(doc: unknown): unknown` (mooduli oma migratsioonid on selle `engine/` osas). Enne migratsiooni teeb Rust faili varukoopia ([03 § 9](03-arhitektuur.md#salvestuse-vastutaja-savecoordinator-moodul-project)). Avamisel käivitatakse kõik vajalikud migratsioonid järjest ja tulemus valideeritakse `BoardDocSchema` vastu. Igal migratsioonil on test, mis kontrollib eelmise versiooni näidisfaili teisendamist.
