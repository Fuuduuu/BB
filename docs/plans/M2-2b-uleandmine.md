# M2.2b vastuvõtt ja suitsukatse

Kaart [M2-2b-5](../tasks/M2-2b-5.md), haru `codex/m2-2b`, alus `ff45a26`, vastu võetud `2eb1a1c`. Tööpuu `C:/Users/TRUMPIT/.codex/worktrees/bb-m2-2b/BB`. Ehitaja kasutas sünteetilisi fotosid ja projekte.

Kasutaja vastas pärast suitsukatset „korras“ (2026-11-25). Astra audit tipul `2eb1a1c` ([ülevaatus ja triaaž](../review/2026-11-25-m2-2b-ulevaatus-2eb1a1c.md)) leidis 15 viga ja peatas liitmise. Parandused tulid kaartidega [M2-2b-6](../tasks/M2-2b-6.md) (`2a083fa`) ja [M2-2b-7](../tasks/M2-2b-7.md) (`5e27a2b`). Näidisfailid `v0.6.0` ja `v0.7.0` koos SHA-256-ga on kaardil M2-2b-7.

**Avaldatud `v0.7.0`** (2026-11-26): liidetud `main`-i `02ac941`, versioon `419ab44`, silt `v0.7.0`. `main`-is läbisid `pnpm check` 1752/1752, vormindus, API-kontroll ja E2E 46/46. Rusti kood on sama mis harus, kus `cargo test` läbis 108/110 (2 vahele jäetud).

## Vastuvõtt

| Tingimus | Tõend |
|---|---|
| Kalibreerimisaken näitab enne kinnitamist px/mm-i, µm/px-i ja foto suurust | `scale_from_footprint_end_to_end` valib 25,4 mm ning kontrollib 29,92 px/mm, 33 µm/px ja foto suurust 27 × 20 mm. |
| Joondus tuvastab vale mõõtkava ja korpuse järgi parandamine on üks tagasivõetav samm | Sama E2E kontrollib küsimust ja parandust 10 px/mm-ni. DIP-i jalad püsivad sihtpunktides. Teise komponendi keskpunkt püsib ja laius väheneb. Kaks `Ctrl+Z`-i taastavad esmalt mõõtkava, seejärel DIP-i algse paigutuse. |
| Korpuste kontuurid ning polaarsuse ja suuna märgid on loetavad | Kaartide M2-2b-3 ja M2-2b-4 domeeni- ning UI-testid. Sünteetiline 14 korpusega plaat mõlemas teemas. |
| Suur plaat püsib jõudluspiirides | Kolme kehtiva Tauri jooksu mediaanid täitsid kõik neli kaardil seatud piiri. |
| Kasutaja tunneb oma plaadi komponendid ära ja suurused vastavad fotole | Kasutaja vastas katse-EXE-ga tehtud suitsukatse järel „korras“ (2026-11-25). Samme eraldi ei raporteeritud. |
| 50 jala kaardistamine piiksuga alla 2 minuti | Kasutaja vastus „korras“ (2026-11-25). Aega ei raporteeritud. |

## Automaatsed tõendid

`scale_from_footprint_end_to_end` läbis Chromiumis 4,7 sekundiga. Tööpuu `pnpm check`, `cargo test --locked` ja `pnpm tauri build --debug` läbisid. Logid on tööpuu kaustas `output/playwright/m2-2b-5/` failides `scale-e2e.log`, `pnpm-check.log`, `cargo-test.log` ja `tauri-debug-build.log`.

Raja B täisring läbis (`ok: true`, `missing: []`). Vitest 1744/1744, E2E 45/45, Rust 108/110 (2 vahele jäetud) ning kaarditest 1/1. Põhikausta raport `output/review-card/M2-2b-5-WI4Vq9/summary.json`.

Lisandus üks nimega E2E test. Olemasolevas generaatoritestis lisandus korpuste hulga ootusesse `radial`. Kasutaja loal muutus `probe-fixes.test.ts` tekstide koguarv 3300 → 3420. 300 tähisele ja 3000 jalanumbrile lisandub 60 elektrolüüdi 120 polaarsusega jalanime. Esimese kontrolli tõrge on tööpuus `output/playwright/m2-2b-5/pnpm-check-labels-red.log`.

Ekraanipildid on tööpuus `output/playwright/m2-2b-5/shapes-light.png` ja `output/playwright/m2-2b-5/shapes-dark.png`. Plaadil on kõik 14 kaardil nimetatud korpust. THT elektrolüüt on alumisel poolel, pöördega +90°. Jalgade asukohad ja punktiir kontrolliti enne pildistamist.

## Tauri jõudlus

Kolm kehtivat jooksu kasutasid Tauri WebView2, 1280 × 800 kliendiala, seemet 127 ja eraldatud katseprofiili. Kõigis jooksudes püsis fookus. Panoraam ja rattasuum kestsid kumbki 180 kaadrit, komponendi lohistus 120 kaadrit ja lõppes ühe käsuga. Võrdlusalus on [M2.2 Tauri jõudluskatse](M2-2-uleandmine.md#tauri-jõudlus).

Segus asendus `c_smd` 60 radiaalse elektrolüüdiga (D 6,3, samm 2,5). Plaadil oli 300 komponenti, 3000 jalga, 60 radiaalset elektrolüüti ja 60 SOIC-ut. Joonistati 60 plussi, 60 triipu ja 60 sälku. Üheksa radiaali ja seitse SOIC-ut olid alumisel poolel. Plaadil oli 1000 rada, 12 nimetatud võrku, 12 MP sünteetiline foto, 1500 pingemõõtmist ja 500 läbivust (450 positiivset ja 50 negatiivset).

| Mõõt | M2-2-11 mediaan | M2-2b-5 jooksud | M2-2b-5 mediaan | Piir |
|---|---:|---:|---:|---|
| Töölaud ja foto valmis | 1098,6 ms | 1092,3 ms / 984,2 ms / 865,4 ms | 984,2 ms | < 1500 ms, täidetud |
| Panoraam | 56,84 fps | 56,54 fps / 59,01 fps / 59,02 fps | 59,01 fps | ≥ 56,84 fps, täidetud |
| Rattasuum | 60,00 fps | 60,00 fps / 60,00 fps / 60,00 fps | 60,00 fps | ≥ 57 fps, täidetud |
| Komponendi lohistus | 40,22 fps | 40,68 fps / 41,86 fps / 43,90 fps | 41,86 fps | ≥ 40,22 fps, täidetud |
| Suumi rahunemise pikim kaader | 133,3 ms | 83,3 ms / 66,8 ms / 66,8 ms | 66,8 ms | Võrdluseks |
| `project_open` | 173,7 ms | 159,6 ms / 160,3 ms / 157,6 ms | 159,6 ms | Võrdluseks |
| `project_save` | 104,0 ms | 114,7 ms / 108,7 ms / 106,9 ms | 108,7 ms | Võrdluseks |

| Käsk | Valideerimine + tuletised M2-2-11 | M2-2b-5 jooksud | M2-2b-5 mediaan | Valideerimine | Kõik tuletised | `nets` | `connectionLevels` | Kogu `execute` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `items.translate` | 20,0 ms | 21,9 ms / 22,6 ms / 22,5 ms | 22,5 ms | 9,5 ms | 12,3 ms | 6,5 ms | 3,7 ms | 24,7 ms |
| `connections.add` | 17,1 ms | 18,6 ms / 18,3 ms / 18,3 ms | 18,3 ms | 8,9 ms | 9,8 ms | 6,2 ms | 3,1 ms | 26,8 ms |
| `beep.record` | 20,2 ms | 22,0 ms / 22,2 ms / 20,7 ms | 22,0 ms | 9,0 ms | 12,3 ms | 6,6 ms | 4,1 ms | 35,1 ms |

Käsku mõõdeti jooksus viis korda ja võeti iga kord tagasi. Tabel näitab mediaanide mediaani. Valideerimine ja tuletised liideti proovi sees. `nets` ja `connectionLevels` sisalduvad tuletiste ajas. `beep.record` lisas positiivse mõõtmise ja ühenduse.

Toorandmed ja kokkuvõte on tööpuu kaustas `output/playwright/m2-2b-5/` failides `acceptance-{1,2,3}-perf.json` ja `native-acceptance-summary.json`.

## Ühilduvus

Varasem väljalaskefailide test `every_release_pcbk_opens_without_modifying_source` läbis. Kasutaja `v0.6.0` projekti avamine kuulub suitsukatsesse.

## Teadaolevad piirid

- Käskude valideerimine koos tuletistega oli eelmise vastuvõtuga võrreldes 1,2–2,5 ms aeglasem. Käsku mõõdeti võrdluseks. Vastuvõtu piirid käivad foto valmimise, panoraami, rattasuumi ja lohistuse mediaanide kohta.
- `nets` ja `connectionLevels` saavad sisendiks terve `components` välja ja arvutatakse komponendi liigutuse järel uuesti. Sisendi kitsendamine on järgmise verstaposti plaanis. [M2.2 järgmised tööd](M2-2-piiksumisreziim.md#mis-jääb-järgmistesse-plaanidesse).

## Kasutaja suitsukatse ja kasutuskatse

Katsefail on `%TEMP%/bb-m2-2b-katse/pcbk-m2-2b-5-katse.exe`. Vaikekaust on `%TEMP%/bb-m2-2b-katse/` ja rakendusetunnus `ee.pcbkaardistaja.desktop.m22bacceptance`. `pickSavePath` tagastab `SaveTarget`-i koos `replaceToken`-iga. Ehitaja lõi selles katses sünteetilise projekti, avas selle hiljutiste loendist uuesti ja sulges. SQLite `quick_check` andis `ok`. Tõend on tööpuus `output/playwright/m2-2b-5/smoke-exe-proof.json`.

1. Käivita katse-EXE ja loo uus projekt oma plaadi fotoga.
2. Kalibreeri `K`-ga kahe tuntud vahega punkti vahel. Näiteks 11 jalaga pinnirea esimese ja viimase jala keskpunktide vahe on 10 × 2,54 = 25,4 mm. Enne `Enter`-it võrdle aknas rida „Foto: … × … mm“ oma plaadi mõõtudega.
3. Paiguta „Elektrolüüt THT“ õige läbimõõduga. Vaata, kas ring katab purgi. Kui ring ei kata purki, joonda `A`-ga kaks jalga fotol jalgadele. Suuruse erinevuse korral proovi küsimuses „Kas kasutada seda korpust mõõtkava aluseks?“ valikut „Kasuta mõõtkavaks“ ja siis `Ctrl+Z`.
4. Kui sul on alles 2026-11-24 katse projekt 28 komponendiga, ava see. Vaheta ühe elektrolüüdi korpus omaduste „Korpuse vahetus“ kaudu „Elektrolüüt THT“-ks õige läbimõõdu ja sammuga. Joonda `A`-ga ja vali „Kasuta mõõtkavaks“. Vaata, kas kõigi komponentide suurused vastavad fotole.
5. Vaata korpuseid heledas ja tumedas teemas. Elektrolüüt on ümar ja sellel on `+` ning triip `−` poolel. Dioodil on triip katoodi poolel. Mikroskeemil on sälk või lõigatud nurk. LED-il on lame külg. Märgi üles, millised oma plaadi komponendid tunned ära ja mis jääb segaseks.
6. Ava oma `v0.6.0` ajal tehtud projekt ja kontrolli, et andmed on alles.
7. Kaardista Piiksuga 50 jalga, näiteks GND-võrgus. Mõõda aeg ja võrdle seda alla kahe minuti eesmärgiga. Kirjuta arhitektile aeg ning see, mis oli segane või aeglane.
