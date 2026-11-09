# 04 · Andmemudel

Kõik tüübid on failides `packages/domain/src/model/*.ts` koos zod-skeemidega. Siin on autoriteetne loend. Kui kood erineb, parandatakse koodi või muudetakse see dokument teadlikult koos `format_version` tõstmisega. Mudeli põhjendus on [ADR-004](adr/ADR-004-kaks-vaadet-ja-uhendused.md)-s.

## Põhimõtted

- **Muutumatu dokument.** `BoardDoc` muudetakse ainult käskudega (Immeri mustand mootoris). Frontend näeb seda sügavalt külmutatud hetktõmmisena ([03 § 5](03-arhitektuur.md#5-olek-kolm-eraldi-hoidlat)).
- **Üks elektriline tõde, kaks esitust.** Komponent, selle jalad, ühendused ja mõõtmised on ühised. Plaat (foto) ja Skeem on ainult nende paigutused ja joonistused, mis võivad kumbki puududa.
- **Id-d** on stabiilsed stringid. Uued id-d luuakse kujul `<prefiks>_<nanoid(10)>`: `cmp_`, `jun_`, `con_`, `lbl_`, `rol_`, `msr_`, `rep_`, `pho_`, `dim_`, `are_`, `att_`, `txt_`, `chk_`. Uue objekti id loob käsu kutsuja. Valideerimine nõuab objekti tüübile vastavat prefiksit ja mittetühja lõppu, mitte täpselt kümmet märki; fikseeritud vaikerollide ja muu pikkusega imporditud id-d jäävad lubatuks.
- **Jalad:**
  - Jalg (`Pin`) kuulub komponendile ja selle id on püsiv. Korpusest tulnud jalal on id korpuse jala number või nimi (`"4"`, `"A4B9"`, `"EP"`), käsitsi lisatud jalal `"x1"`, `"x2"` …
  - Lisaks on igal jalal **eksemplari tunnus `uid`** (`pin_<nanoid(10)>`), mida ei taaskasutata. Kui jalg kustutatakse ja hiljem tekib sama numbriga uus jalg (nt SOIC-14 → SOIC-8 → SOIC-14), on uuel jalal uus `uid`. Tagasivõtmine taastab sama jala koos sama `uid`-ga.
  - Jala viide on `PinRef = { c: componentId, p: pinId }`.
  - Korpuse padjand ja sümboli kontakt viitavad samale jalale.
  - Tähise, jala nime või asukoha muutmine viiteid ei muuda.
- **Ühendatus on ainult ühendustes.** Võrk arvutatakse ainult `Connection`-itest. Kaugus, ristumine, mõõtkava, suum ega nimi ei liida võrke ([Võrkude arvutus](#võrkude-arvutus-resolvenets)).
- **Teadmata jääb teadmata.** Väärtus, märgistus ja jala nimi on vaikimisi tühjad. Äpp ei pane nendesse oletusi.
- **Projekti identiteet** (`project_id`, `copied_from_project_id`) on faili `meta` tabelis, mitte dokumendis, sest see ei ole tagasivõetav andmetükk ([03 § 9](03-arhitektuur.md#9-salvestus-ja-projekti-fail)).
- **Ühikud ja koordinaadid:**
  - plaadi asukohad on **plaadi tööpinna** pikslites; v1-s on need esimese foto originaalpikslid;
  - korpuse geomeetria on millimeetrites;
  - skeemi asukohad on skeemi ruudustiku ühikutes;
  - nurgad on kraadides (päripäeva, y alla), pinge voltides, takistus oomides ja aeg ISO 8601 UTC kujul.

## Tüübid

```ts
type Vec2 = { x: number; y: number };
type PinRef = { c: string; p: string };                // komponendi id + jala id
type EndRef = { pin: PinRef } | { junction: string };  // ühenduse ots ja sildi ankur
type MeasuredPin = PinRef & { uid: string };           // mõõtmise kontakt koos jala eksemplariga
type Side = 'top' | 'bottom';
type Layer = 'top' | 'bottom';

interface BoardDoc {
  format_version: 1;
  rev: number;                         // kasvab iga dokumenti muutva käsuga, ka tagasivõtmisel
  name: string;
  device?: string;                     // seade / mudel
  problem?: string;                    // „Mis on viga?“
  status: 'mapping' | 'mapped';        // „Märgi kaardistus valmis“
  mappedAt?: string; mappedSnapshot?: ProgressSnapshot;
  scale: { pxPerMm: number; calibrated: boolean; calib?: { a: Vec2; b: Vec2; mm: number } };
  photos: PhotoRef[];                  // v1: üks pealmise poole foto; alumise poole oma tuleb M5-s
  activePhotoId?: string;
  components: Component[];
  junctions: Junction[];
  connections: Connection[];
  netLabels: NetLabel[];
  roles: NetRole[];                    // vaikimisi DEFAULT_ROLES, kasutaja saab lisada
  measurements: Measurement[];
  measureSettings: { voltageTolerancePct: number; voltageToleranceMinV: number }; // vaikimisi 10 % ja 0,1 V
  repairs: RepairAction[];
  areas: DamageArea[];
  dimensions: Dimension[];
  outline?: BoardOutline;
  textNotes: TextNote[];
  importChecks: ImportCheck[];         // prototüübi impordist kinnitamata ühenduskohad
  guide: { skipped: string[] };        // vahele jäetud juhendi sammud
}

interface PhotoRef {
  id: string; side: Side; name: string;
  widthPx: number; heightPx: number;   // originaalfoto mõõdud
  toBoard?: [number, number, number, number, number, number];
                                       // afiinne teisendus foto pikslitest plaadi tööpinnale; puudub = ühikteisendus
                                       // (esimene foto). Teine või asendatud foto saab selle joondusest (M5).
  transform: 'none' | 'rot90' | 'rot180' | 'rot270' | 'mirror' | 'mirror_rot90' | 'mirror_rot180' | 'mirror_rot270';
                                       // vaate orientatsioon (algväärtus EXIF-ist); rakendub kogu stseenile (03 § 7.1)
}

interface Component {
  id: string;
  ref: string;                         // tähis 'R12'; automaatne, muudetav, projektis unikaalne
  kind: ComponentKind;                 // määrab vaikimisi sümboli
  marking: string;                     // korpuselt loetud kood ('103', 'A7W'); '' = lugemata
  value: string;                       // tuvastatud väärtus või mudel ('10 kΩ', 'AMS1117-3.3'); vaikimisi ''
  identified: boolean;                 // Tuvastatud / Tuvastamata
  dnp: boolean;                        // paigaldamata
  note: string;
  referenceImageId?: string;           // attachments.id (andmelehe joonis)
  pins: Pin[];                         // komponendi jalad; kõik viited kasutavad neid
  board?: BoardPlacement;              // puudub → loendis „Plaadile paigutamata“
  schematic?: SymbolPlacement;         // puudub → loendis „Skeemile paigutamata“
}
interface Pin {
  id: string;                          // püsiv number või nimi (vt Põhimõtted); ühenduste, siltide ja kaartide võti
  uid: string;                         // jala eksemplari tunnus 'pin_…', ei taaskasutata
  name?: string;                       // 'VCC', 'OUT'
  nc: boolean;                         // märgitud ühendamata (NC)
}
interface BoardPlacement {
  footprint: string;                   // generaatori võti, nt 'soic'; 'custom' = vabad mõõdud
  params: Record<string, string | number>;
  center: Vec2; rotationDeg: number; side: Side;
  scaleX: number; scaleY: number;      // 1 = korpuse nominaalsuurus; piirid 0.2–5
  padMap?: Record<string, string>;     // korpuse padjand → Pin.id; puudub = sama number
  customPads: Record<string, { local: Vec2 /* mm */; sizeMm: number; shape: 'circle' | 'rect'; through: boolean }>;
                                       // käsitsi lisatud jalgade padjandid (Pin.id → geomeetria)
  labelOffset?: Vec2;                  // tähise nihe fotol; sildi lohistamine ei liiguta komponenti
}
interface SymbolPlacement {
  symbol: string;                      // 'resistor', 'npn', 'box' …; vaikimisi kind'i järgi
  at: Vec2; rot: 0 | 90 | 180 | 270; mirror: boolean;
  pinMap?: Record<string, string>;     // sümboli kontakt ('B', 'C', 'E') → Pin.id; puudub → nummerdatud kast
  labelOffset?: Vec2;
}
type ComponentKind = 'resistor' | 'capacitor' | 'capacitor_polarized' | 'inductor' | 'diode' | 'led' | 'zener'
  | 'npn' | 'pnp' | 'nmos' | 'pmos' | 'regulator' | 'ic' | 'connector' | 'crystal' | 'switch' | 'fuse'
  | 'testpoint' | 'via' | 'pad' | 'wire_point' | 'hole' | 'other';

interface Junction {                   // nähtav liitepunkt: raja haru või lahtine ots
  id: string;
  board?: { at: Vec2; layer: Layer };
  schematic?: { at: Vec2 };
}

interface Connection {                 // kasutaja otsus: need kaks otsa on elektriliselt ühendatud
  id: string;
  a: EndRef; b: EndRef;
  basis: 'assumed' | 'visual';         // oletatud (kiirühendus, piiks, skeemil joonistatud) või nähtud (rada fotol)
  board?: { kind: 'trace' | 'wire'; layer: Layer; waypoints: Vec2[]; widthMm: number; labelOffset?: Vec2 };
                                       // fotojoonistus; puudub → õhujoon (peidetav kiht)
  schematic?: { waypoints: Vec2[] };   // skeemijoonistus; puudub → otsejoon
}                                      // tase „mõõdetud“ arvutatakse mõõtmistest (vt „Ühenduse tase“)

interface NetRole { id: string; label: string; kind: 'ground' | 'power' | 'signal' | 'unknown'; nominalV?: number; color: string /* #rrggbb */ }
interface NetLabel { id: string; anchor: EndRef; name?: string; roleId?: string; source: 'user' | 'import' }

interface Measurement {
  id: string;
  mode: 'voltage' | 'resistance' | 'diode' | 'continuity';
  at: MeasuredPin;                     // Koht (punane sond, dioodirežiimis +)
  ref?: MeasuredPin;                   // Vastaspunkt (must sond, dioodirežiimis −); ilma selleta pinget ei hinnata
  value?: number;                      // SI ühikutes: V või Ω; puudub, kui overload = true
  overload?: boolean;                  // „OL“: takistus või diood üle mõõtepiirkonna (avatud ahel)
  beep?: boolean;                      // läbivus
  power: 'on' | 'off' | 'unknown';     // algolek 'unknown'; kasutaja valik jääb meelde
  takenAt: string;
  note?: string;
  atLabel: string; refLabel?: string;  // salvestamise hetke tähised ('U1.8'); jäävad loetavaks ka pärast kustutamist
  staleByRepairId?: string;            // ≠ undefined → „enne remonti“
  source: 'manual' | 'beep_mode';
}

interface RepairAction {
  id: string; action: 'replaced' | 'removed' | 'reflowed' | 'trace_fixed' | 'cleaned' | 'other'; text: string; at: string;
  affects: { component: string } | { nets: EndRef[] } | { wholeBoard: true } | { nothing: true };
                                       // võrgud on antud ankrutega, sest võrgu võti pole püsiv
}
interface DamageArea { id: string; shape: 'rect' | 'ellipse'; x: number; y: number; w: number; h: number; text: string }
interface Dimension { id: string; a: DimEnd; b: DimEnd; offsetPx: number }
type DimEnd = { pin: PinRef } | { point: Vec2 };   // ainult geomeetria, mitte elektriline ots
interface BoardOutline { x: number; y: number; w: number; h: number; showDims: boolean }
interface TextNote {
  id: string; view: 'board' | 'schematic'; at: Vec2; text: string;
  anchor?: { component: string } | { connection: string } | { junction: string };  // tekst ei muuda ühendatust
}
interface ImportCheck { id: string; at: Vec2; layer: Layer; junctions: string[]; note: string }
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

- **Union-find** üle jalgade (`PinRef` võti `cmp_x:4`) ja liitepunktide. Iga ühendus liidab oma otsad `a` ja `b`. **Midagi muud võrke ei liida:** kaugus, ristumine, mõõtkava, joone paksus, suum ega sama nimi.
- **Üksik jalg** ilma ühendusteta on oma võrk ja võib kanda silti.
- **Liitepunkt** on olemas ainult koos vähemalt ühe ühendusega. Käsk, mis jätab liitepunkti ilma ühenduseta, eemaldab ka liitepunkti **ja käsitleb sama käsu sees sellele ankurdatud sildid**:
  - kui liitepunkt asendub jalaga (`junctions.attachToPin`) või ühendatakse teise liitepunktiga, tõstetakse sildid sinna;
  - muidu tõstetakse silt mõnele allesjäänud liikmele samas võrgus, kus liitepunkt enne käsku oli, kui see võrk on pärast käsku veel olemas (eelistatult jalale, tähestikulises järjekorras);
  - kui sellist liiget pole, silt kustutatakse ja teade ütleb seda („Võrgusilt VBUS eemaldati · Ctrl+Z toob tagasi“).

  Sildi ankur ei jää kunagi puuduvale liitepunktile.
- **Haru:** raja lõpetamine olemasoleva raja peal loob seal liitepunkti ja jagab selle raja kaheks ühenduseks ühe käsuga. Mõlemas vaates on liitepunkt nähtav täpina.
- **Kihid:**
  - pealmise kihi rada saab lõppeda pealmise kihi liitepunktis, pealmise poole pinnajalas või läbivas jalas (läbiv padjand, `via`, testpunkt); alumise kihi rada vastavalt;
  - muul juhul tekib rajale uus liitepunkt sama kihi peal;
  - kihi vahetamine ise ega kahe kihi raja kattumine ei ühenda midagi;
  - juhe (`wire`) võib lõppeda mõlema kihi punktis.

  Seda reeglit järgivad joonistustööriist ja import.
- **Võrgu võti** on väikseima liikme võti (jala võti või liitepunkti id). See on ainult esituse jaoks; püsivad viited (sildid, remont) kasutavad ankruid.
- **Nimi ja roll** tulevad siltidest, mille `anchor` kuulub võrku. Kui kahel sildil on eri `roleId`, siis `roleConflict = true`, `role = undefined` ja `conflictingRoles` loetleb need. Nimeks saab esimene mitte-tühi `name` (ankrute tähestikulises järjekorras); kui seda pole, siis `N1`, `N2` … (võrgu võtme järjekorras). Võrgu nimetamine ei liida võrke; „Ühenda võrguga…“ on eraldi käsk, mis loob ühenduse.
- **Negatiivne läbivus:** kui kahe jala vahel on mõõtmine `beep = false` ja need jalad satuvad samasse võrku, siis `beepContradiction = true` (hoiatus „Läbivustest ütles, et ühendust pole“).
- **Lühistatud kahejalgne komponent:**
  - Kui kahejalgse komponendi (`resistor`, `capacitor`, `capacitor_polarized`, `inductor`, `diode`, `led`, `zener`, `fuse`, `crystal`) mõlemad jalad on samas võrgus, siis `shortedComponents` sisaldab seda komponenti ja tuleb hoiatus „R5 mõlemad jalad on samas võrgus. Kas ühendus on õige?“.
  - Tavaliselt on see kaardistusviga, näiteks piiks läbi väikese takisti, aga see võib olla ka päris lühis.
  - Hoiatus on komponendi ja võrgu kontekstis ning kahtlaste vaates. Hinnanguid see ei muuda.
  - Kui komponent on teadlikult sild (nt 0 Ω takisti), kirjutab kasutaja selle märkusesse ja hoiatus jääb informatiivseks.

## Ühenduse tase (`connectionLevels`)

Ühenduse usaldusväärsuse tase ([01](01-pohimotted.md#info-usaldusväärsus-kolm-taset)) arvutatakse mootoris mõõtmistest, mitte ei salvestata ühenduse külge:

- **Jalapaari tõend:** jalapaar `(A, B)` on mõõdetud, kui nende jalgade vahel (kummaski suunas) on kehtiv, mitte aegunud ja aktiivsete kontaktidega läbivusmõõtmine ning viimane selline on `beep = true`. Pole vahet, kas see tehti piiksumisrežiimis või tavalise mõõtmisena.
- **Ühenduse tase:** ühendus on **mõõdetud**, kui see asub mõõdetud jalapaari `(A, B)` vahelisel teel, mis läbib **ainult liitepunkte** (mitte teisi jalgu). Kui selliseid teid on mitu, kasutatakse lühimat; võrdse pikkusega teede korral valitakse ühenduste id järjekorras. Nii jääb A–B ✓ alles ka siis, kui ühendus on haruks jagatud (A–J ja J–B saavad ✓, haru J–C mitte). Muidu on tase `basis`.
- Kui viimane kehtiv läbivus jalapaari vahel on `beep = false`, saavad selle paari vahelise tee ühendused taseme `basis` ja hoiatuse „Läbivustest ütles, et ühendust pole“.
- Mõõtmise kustutamine, remondist tulenev aegumine või otsa lahtiühendamine viib ühenduse kohe tagasi *nähtud* või *oletatud* tasemele. Uus kehtiv piiks taastab ✓. Ühenduse andmeid selleks ei muudeta.
- Mõõdetud tase kinnitab **jalapaari elektrilist sidet**, mitte fotole joonistatud konkreetset vaskrada. A → B ja B → C piiks ei tekita A → C mõõtmist ning „mõõdetud“ märki ei laiendata tervele võrgule.
- Käsitsi mõõdetuks märkimist ei ole.

### Piiks ei tõenda sama vaskrada

Mõõteriist piiksub alla oma läve, mis võib olla kümneid oome. Piiks võib tulla ka läbi väikese takisti või paralleelse tee. Seepärast eristatakse kahte asja:
- **mõõtetulemus** „läbivus olemas“ (`Measurement`, `beep = true`) salvestatakse alati;
- **tehniku otsus** „need jalad on samas võrgus“ (`Connection`) tehakse ainult nähtava tegevusega.

Käsk `beep.record({ anchor, pin, beep, connect })` teeb kõik **ühe tagasivõetava sammuna**:
1. Lisab läbivuse mõõtmise (`source = 'beep_mode'`).
2. Kui `beep = true` ja `connect = true`:
   - kui jalad on juba samas võrgus, rohkem midagi ei lisata;
   - muidu tekib ühendus (`basis = 'assumed'`, ilma fotojoonistuseta), mille tase on mõõtmise tõttu kohe „mõõdetud“.
3. „Ei piiksu“ lisab ainult mõõtmise `beep = false`.

Piiksumisrežiimis on nupud **„Piiksub ja ühenda“** (`Enter`, `connect = true`), **„Ainult mõõtmine“** (`Shift+Enter`, `connect = false`) ja **„Ei piiksu“** (`N`). `Esc` katkestab ega salvesta midagi ([02 § 8.3](02-kasutaja-teekond.md#83-piiksumisrežiim-mõõdetud-kõige-kiirem-kaardistus)). Tavaline läbivusmõõtmine Mõõda-plokis ei ühenda kunagi.

„Piiksub ja ühenda“ ei ühenda automaatselt kolmel juhul. Siis salvestatakse ainult mõõtmine ja lõuendil küsitakse „Piiksub läbi komponendi R5. Ühendan ikkagi?“:
- kui jalad on sama kahejalgse passiivkomponendi otsad (`resistor`, `inductor`, `fuse`, `capacitor`, `capacitor_polarized`, `diode`, `led`, `zener`, `crystal`, `switch`);
- kui ühendamine paneks **mõne** kahejalgse passiivkomponendi mõlemad jalad samasse võrku, ka kaudselt. Näide: must sond on `J1.1` peal, mis on juba `R5.1`-ga ühendatud, ja punane sond on `R5.2` peal; piiks võib tulla läbi väikese `R5`. Kontroll võrdleb `shortedComponents` hulka enne ja pärast kavandatud ühendust ning nimetab küsimuses uue lühistatud komponendi;
- kui ühendamine liidaks kaks eri rolliga võrku.

Need kaitsed on abilised, mitte garantii.

## Mõõtmise kontaktid ja ajalugu

- Mõõtmisel säilivad mõlema sondi viited koos jala eksemplariga (`at`, `ref`: komponent, jala id ja `uid`) ning salvestamise hetke sildid (`atLabel`, `refLabel`).
- Kontakt on **aktiivne**, kui komponent on olemas, sellel on sama id-ga jalg ja selle jala `uid` on sama. Muidu on mõõtmine **ajalooline**. See kuvatakse ajaloos ja nimekirjas märkega **„kontakt kustutatud“**, aga ei mõjuta võrke, hinnanguid, jala rõngaid ega ühenduse taset.
- **Sama numbriga uus jalg ei aktiveeri vana mõõtmist.** Näiteks SOIC-14 → SOIC-8 → SOIC-14 jätab jalgade 9–14 vanad mõõtmised ajaloolisteks, sest uutel jalgadel on uus `uid`. `Ctrl+Z` taastab aga sama jala koos sama `uid`-ga, nii et mõõtmine on jälle aktiivne.
- Puuduva viite erand kehtib ainult ajaloolisele mõõtmisele. Ühenduse otsad ja sildi ankrud peavad alati viitama olemasolevale jalale või liitepunktile.

## Mõõtmiste hindamine

`evaluate(m: Measurement, nets, settings: BoardDoc['measureSettings']): Verdict`, kus `Verdict = 'ok' | 'low' | 'high' | 'short' | 'none'`.

| Juhtum | Tingimus | Tulemus |
|---|---|---|
| Aegunud või ajalooline | `m.staleByRepairId` on määratud või mõni kontakt on kustutatud | `none` (ei värvi jalga) |
| Pinge toitega (DC) | `mode = voltage`, `power = on`, `ref` on määratud ning nii Koha kui ka vastaspunkti võrgul on kehtiv roll koos `nominalV`-ga. Oodatav pinge `exp = nominalV(at) − nominalV(ref)`, tolerants `tol = max(voltageToleranceMinV, voltageTolerancePct/100 · |exp|)` | järjekorras: `|v − exp| ≤ tol` → `ok`; `exp ≠ 0`, `v` märk on vastupidine ja `|v| > tol` → `high` (vihje „Sondid võivad olla vahetuses“); `|v| < |exp|` → `low`; muidu `high` |
| Takistus toite ja maa vahel | `mode = resistance`, üks ots power- ja teine ground-võrgus, `overload` puudub | `value < 1.0 Ω` → `short` (kahtlus), muidu `none` |
| Diood toite ja maa vahel | `mode = diode`, üks ots power- ja teine ground-võrgus, `overload` puudub | `value < 0.05 V` → `short` (kahtlus), muidu `none` |
| Läbivus eri rollide vahel | `mode = continuity`, `beep = true`, otste võrkudel on eri roll ja kumbki pole `signal`/`unknown` | `short` |
| Kõik muu | sh rollita võrk, vastaspunktita pinge, vastaspunkt signaal- või rollita võrgus, toiteta või teadmata toitega pinge, „OL“, muu dioodimõõtmine, vahelduvpinge | `none` |

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
- **Ilma hinnanguta:** vastaspunktita pinge → none; vastaspunkt Signaal-võrgus → none; toiteta või teadmata toitega pinge → none; kustutatud kontaktiga mõõtmine → none.
- **Takistus 5V ↔ GND:** 0,6 Ω → short; 1,0 Ω → none; OL → none.
- **Diood 5V ↔ GND:** 0,02 V → short; 0,45 V → none; OL → none.
- **Läbivus:** 12V ↔ 5V → short; Signaal ↔ 5V → none.

**Jala hinnang** (`latestVerdicts`): iga jala jaoks loetakse viimane kehtiv (mitte aegunud ega ajalooline) mõõtmine, kus jalg on `at` või (takistuse, dioodi ja läbivuse puhul) `ref`.

**Väärtuse lugemine** (`parseReading(text, mode)`): koma ja punkt on võrdsed, tühikud eemaldatakse, sufiksid `m` (10⁻³), `k`, `M`. Ka kuju `4k7` = 4700. Ühik võib olla lõpus (`4,98V`, `10 kΩ`). Takistuse ja dioodi puhul tähendab `OL` (suur- või väiketähtedega) `overload = true`. Vigane sisend annab `null`. Sama parserit kasutavad Mõõda-plokk ja import.

## Remont ja aegumine

Käsk `repair.add({ affects, action, text })`:
1. lisab `RepairAction` kirje;
2. märgib aegunuks (`staleByRepairId = rep.id`) kehtivad mõõtmised vastavalt sellele, mida remont mõjutab:
   - `component`: mõõtmised, mille `at` või `ref` on selle komponendi jalg **või asub samas võrgus mõne selle komponendi jalaga**;
   - `nets`: mõõtmised, mille `at` või `ref` asub mõnes valitud võrgus (nt „rada parandatud“, „oksiid puhastatud“);
   - `wholeBoard`: kõik kehtivad mõõtmised;
   - `nothing`: mitte ühtegi. Kasutaja valib selle teadlikult, nt märkuse jaoks;
3. avaldab sündmuse `repair.added` koos mõjutatud jalgade loendiga (remondimoodul pakub „Mõõda uuesti“).

Remondi aknas valib kasutaja mõju alati ise. Komponendiga remondi puhul on vaikimisi valitud see komponent, rajaparanduse puhul palub äpp valida võrgud. Komponendita remont ei jäta muljet, et varasemad tulemused on kindlasti endiselt kehtivad.

## Valmidus (`computeProgress`)

```ts
interface ProgressSnapshot {
  componentsIdentified: [done: number, total: number]; // total ilma DNP-ta
  pinsMapped: [number, number];                        // ühendatud või NC
  unplaced: { board: number; schematic: number };      // komponendid, millel paigutus puudub
  powerDefined: boolean;                               // GND-roll olemas ja iga power-rolliga võrk ≥ 2 jalaga
  assumedConnections: number;                          // ühendused, mille arvutatud tase on „oletatud“
  roleConflicts: number;
  openImportChecks: number;                            // kinnitamata impordi ühenduskohad
  suspectMeasurements: number;                         // kehtivad low/high/short
}
```
Edenemisriba = keskmine kolmest osakaalust: komponendid tuvastatud, jalad kaardistatud ja juhendi sammud tehtud.

## Kustutamise reeglid

- **Komponendi kustutamine** on üks tagasivõetav käsk:
  - selle jalgadele viitavate ühenduste otsad muutuvad liitepunktideks jala endises kohas (plaadil ja/või skeemil), nii et joonistused jäävad alles ja need saab teisele jalale ümber tõsta;
  - sildid, mille ankur oli selle jalg, kustutatakse;
  - mõõtmised jäävad ajaloolistena alles.

  Komponent kaob mõlemast vaatest.
- **Jala kustutamisel** kehtivad samad reeglid selle ühe jala kohta.
- **„Eemalda paigutus plaadilt“ või „… skeemilt“** eemaldab ainult vastava esituse. Komponent, jalad, ühendused ja mõõtmised jäävad alles ning komponent ilmub loendisse „Plaadile paigutamata“ või „Skeemile paigutamata“.
- **„Eemalda joonistus“** eemaldab ühenduse joonistuse plaadilt või skeemilt, aga elektriline ühendus jääb alles (plaadil õhujoonena).
- **„Kustuta ühendus“** eemaldab elektrilise sideme koos mõlema joonistusega. Liitepunktid, mis jäävad ilma ühendusteta, kaovad samuti. Mõõtmised jäävad.
- **Liitepunkti kustutamine** kustutab kõik selle ühendused. Äpp ütleb enne, mitu ühendust see on. Sellele ankurdatud sildid käsitletakse sama käsu sees ([Võrkude arvutus](#võrkude-arvutus-resolvenets)).
- **Korpuse vahetus** (`components.update` muudab `board.footprint`-i või jalgade arvu mõjutavaid `params`-e):
  - Sama id-ga jalad jäävad seotuks ja säilitavad oma `uid`-i, ka kui nende asukoht muutub. Uued jalad saavad uue `uid`-i.
  - Kui vastavus pole üheselt selge, pakub äpp jalgade vastavuse tabelit ega tõsta midagi vaikselt ümber.
  - Kui mõni kaduv jalg on ühenduse ots, sildi ankur või mõõtmise kontakt või kui sellel on nimi või NC-märge, küsib äpp enne kinnitust ja loetleb mõju („Kaovad jalad 9–14: 3 ühendust, 2 mõõtmist, 1 silt“).
  - Kinnitamisel on kõik üks tagasivõetav käsk ja kaduvaid jalgu puudutavad samad reeglid nagu jala kustutamisel.
- **Mõõtmise kustutamine** ei muuda ühendusi. Ühenduse arvutatud tase langeb tagasi *nähtud* või *oletatud* tasemele, kui samade jalgade vahel pole enam kehtivat piiksu ([Ühenduse tase](#ühenduse-tase-connectionlevels)). Tagasivõtmine taastab mõlemad.
- **Rolli kustutamine** on lubatud ainult siis, kui ükski silt seda ei kasuta. Vaikerolle ei saa kustutada, ainult ümber nimetada või värvi muuta.

## JSON eksport ja import

- **Eksport** (`project.json`): `{ app: 'pcb-kaardistaja', format_version: 1, project_id, exported_at, doc: BoardDoc, photos: [{ id, mime, width, height, data_base64 }] }` (originaalfotod). Oma eksport läbib alati impordi, ka pärast kustutamisi.
- **Impordi vastuvõtureeglid** kehtivad kõigile importidele (`project.json`, `.pcbmap.json`):
  - **Suurusepiirid:** fail kuni 500 MB, üks foto kuni 100 MB, kuni 5000 komponenti.
  - **Täielik kontroll:** zod-skeemi täielik kontroll pärast migratsiooni; id-d peavad olema unikaalsed.
  - **Viidete terviklus:**
    - iga ühenduse ots ja sildi ankur viitab olemasolevale jalale või liitepunktile;
    - iga `roleId` viitab olemasolevale rollile ja iga `staleByRepairId` olemasolevale remondile;
    - mõõtmise kontakt võib viidata kustutatud jalale või jala varasemale eksemplarile (ajalooline mõõtmine), kui `uid`, `atLabel` ja vajadusel `refLabel` on olemas;
    - jala `uid`-id on projektis unikaalsed.
  - **Import loob alati uue projekti** (uus `project_id`; `copied_from_project_id` = ekspordi `project_id`, kui see on olemas). Avatud projekti see ei puuduta.
  - **Vea korral** projekti ei looda ja kasutaja näeb esimesi vigu loetava loendina.
- **Prototüübi import** (`.pcbmap.json`, `app: 'pcb-kaardistaja'`, `v: 1`) on eelvaatega:
  - **Komponendid:** `doc.comps` → komponendid koos plaadipaigutusega: `type → board.footprint`, `x,y → board.center`, `rot`, `side`, `params`, jalad korpusest, `pn` → `pins[].name`, `extra[{id,x,y,d}]` → lisatud jalad koos `customPads`-iga. `kind` tuletatakse korpusest ja prefiksist, `identified = value !== ''`. Imporditud väärtus on alles, kuid kuvatakse kinnitamata imporditud infona.
  - **Rajad:** `doc.traces` → ühendused koos fotojoonistusega (`pts → board.waypoints`, `w → widthMm`, `layer: 'wire' → board.kind = 'wire'`, `basis: 'visual'`). Otsene jalaviide (`a/b` koos `c,p`) jääb jalaviiteks. Vaba ots saab lahtiseks liitepunktiks samal kihil.
  - **Läheduse põhjal arvatud liited:** prototüübi `getNets()` liitis vabad otsad läheduse põhjal. Uues mudelis neid **ei looda**, vaid need lähevad loendisse `importChecks` („Kontrolli neid ühenduskohti“). Eelvaade näitab nende asukohta fotol ning vana ja uue võrguloendi erinevust. Kasutaja valib „Kinnita liide“ (tekib selge liitepunkt, mis ei ole mõõdetud) või „Jäta lahti“. Kõiki kohti ei pea kohe lahendama: kinnitamata kohad jäävad projektis nähtavaks kontrollnimekirjaks.
  - **Eri kihid:** eri kihtide juhuslikust kattumisest läbiviiku ei tehta. Sellist liidet saab kinnitada ainult tegeliku läbiviigu või läbiva jala kaudu.
  - **Võrgunimed:** mitte-tühi `trace.net` → `NetLabel { anchor: esimene ots, name, source: 'import' }`. Sama nimega tekstid ise võrke ei ühenda.
  - **Muu:** `doc.dims → dimensions`, `doc.outlines[0] → outline`, `doc.ppm`, `doc.calibrated`, `doc.calib`, `doc.name`, `img.src` (andme-URI) → foto.
  - **Kokkuvõte:** enne lõpetamist ütleb import näiteks: „6 ühenduskohta vajavad kontrolli, neid pole veel võrku liidetud.“
- **Migratsioonid:** `packages/domain/src/migrations/NNNN_<kirjeldus>.ts` ekspordib `up(doc: unknown): unknown` (mooduli oma migratsioonid on selle `engine/` osas). Enne migratsiooni teeb Rust faili täisvarukoopia ([03 § 9](03-arhitektuur.md#salvestuse-vastutaja-savecoordinator-moodul-project)). Avamisel käivitatakse kõik vajalikud migratsioonid järjest ja tulemus valideeritakse `BoardDocSchema` vastu. Igal migratsioonil on test, mis kontrollib eelmise versiooni näidisfaili teisendamist.
