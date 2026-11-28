# M2.3 vastuvõtt ja suitsukatse

Kaart [M2-3-7](../tasks/M2-3-7.md), haru `codex/m2-3`, alus `1acfaf8`. Tööpuu `C:/Users/TRUMPIT/.codex/worktrees/bb-m2-3/BB`. Ehitaja kasutas sünteetilisi projekte ja fotosid.

## Vastuvõtt

| Tingimus | Tõend |
|---|---|
| Skeemil lisatud takisti paigutatakse hiljem fotole sama ID-ga. Tähise muutmisel säilivad ühendused ja mõõtmised. | `schematic_acceptance_end_to_end` kontrollib sama ID-d, skeemipunkti ja mõlema andmeloendi võrdsust. |
| Skeem ja plaat kasutavad sama lõuendit ja tabamisindeksit. | [M2-3-2](../tasks/M2-3-2.md) ja [M2-3-4](../tasks/M2-3-4.md), lõuendi ja tabamise testid. |
| Sümbolite teek katab 23 tüüpi. Puuduva jalavastenduse korral kuvatakse nummerdatud kast. | [M2-3-3](../tasks/M2-3-3.md) domeenitestid ja ekraanipildid. |
| Jalgade funktsiooni määramine on üks tagasivõetav samm. | [M2-3-6](../tasks/M2-3-6.md) käsu ja kasutajaliidese testid. |
| Valik on ühine ja „Näita teises vaates“ toob sama komponendi keskele. | M2-3-6 ja M2-3-7 brauseritestid. |
| 300 sümboliga skeem püsib eelarves. | Memo-parandusega tõusis kolme kehtiva Tauri jooksu mediaan 22,22-lt 58,53 fps-ni (piir 45 fps). Kõik seitse kaardil mõõdetud piiri täitusid. |
| M2.2b auditi leiud 08–12 ja 14. | [M2-3-1](../tasks/M2-3-1.md), M2-3-3 ja M2-3-7. |
| Arhitektuuriauditi leiud 01, 02, 06 ja 17, sealhulgas tööriistade sama jalavalik samal padjal. | M2-3-4 tabamistestid ja M2-3-7 pingenäitude tuletise test. |
| Kasutaja tunneb oma plaadi skeemil ära. | Kasutaja suitsukatse on ootel. |

## Automaatsed tõendid

Raja B täisring läbis (`ok: true`, `missing: []`). Vitest 1782/1782, E2E 51/51 ja Rust 108/110 (kaks vahele jäetud). Kõik neli kaarditesti, API, vorming, katvus ja Tauri debug-kooste läbisid. Rusti ühine väljalaskefailide test avas ka uue `.pcbk` faili ning kinnitas, et lähtefaili baitides ei olnud muutusi. Põhikausta raport `output/review-card/M2-3-7-r97tb3/summary.json`.

Memo-paranduse järel läbis raja B täisring uuesti (`ok: true`, `missing: []`). Vitest 1782/1782, E2E 51/51, Rust 108/110 (kaks vahele jäetud), kaarditestid 4/4 ja Tauri debug-kooste läbisid. Põhikausta raport `output/review-card/M2-3-7-ivYQZU/summary.json`.

Alusel `1acfaf8` läbis `schematic_acceptance_end_to_end` kõik kolm sammu. Arhitekti kinnitatud regressioonikaitse logi on `schematic-acceptance-baseline.log`. Uue käitumise RED-logid on `pin-readings-red.log`, `probe-inputs-red.log` ja `release-v080-red.log`. Kõik logid on tööpuu kaustas `output/playwright/m2-3-7/`. Olemasolevate testide ootusi ei muudetud.

`v0.8.0.pcbk` loodi 0.8.0 Tauri kasutajaliidesest, avati uuesti ja läbis SQLite’i tervikluskontrolli. Sama faili dokumendist eraldatud JSON-i kontrollib `release_document_v080_keeps_schematic`. Pingenäitude regressioonitest võrdleb tuletise viidet pärast liigutust ja tähise muutmist ning tulemust täisarvutusega pärast jala asendamist ja tagasivõttu.

Tööpuu ekraanipilt `output/playwright/m2-3-7/pin-function-light.png` näitab jaotise „Jalgade funktsioon“ joondust väljaga „Tähis“.

## Tauri jõudlus

Skeemi sümbol kasutab `React.memo`-t. Eelvaade annab iga sümboli jaoks selle valiku ja ruudustikule haagitud nihke `dx`, `dy`. Paigal oleva sümboli andmed, valik ja nihe ei muutu ning React jätab selle renderduse vahele.

Tauri WebView2 mõõtmine kasutas seemet 127, 1280 × 800 kliendiala ja eraldi rakendusetunnust `ee.pcbkaardistaja.perf.m23`. Kolm kehtivat jooksu. Üks fookuse kaotanud katse jäi mediaanidest välja. Igas vaates mõõdeti 180 panoraami- ja 180 suumikaadrit. Kõigi kuue lohistuse 120 kaadrist 115 olid eelvaatekaadrid ja vabastamisel rakendus üks käsk.

Kooste `1acfaf8bffe7192643b28507503f5fd507b37b4d`, versioon `0.8.0`, tööpuu sisaldas kaardi muudatusi (`clean: false`). Proovi EXE SHA-256 `736061965bb3ae1bdf8eab25240e26ed4f3450916b28f666969448c8ad7b928a`. Jooksude algandmed ja koond on tööpuu kaustas `output/playwright/m2-3-7/`. Koondfail on `native-acceptance-summary.json`. Esimese mõõtmise koond on `native-acceptance-summary-before.json` ja selle algandmed on alamkaustas `native-before/`.

Enne kaadrite mõõtmist kinnitas proov sisendis 300 komponenti, 3000 jalga, 1000 rada, 300 skeemisümbolit, 12 nimetatud võrku ja 2000 mõõtmist, millest 500 olid läbivused. Skeemisümbolid paiknevad A3 lehel 2,54 mm ruudustikul. Käskude mõõtmise eel kinnitas proov ankru võrgus 51 jalga. Ajastatud `beep.record` kasutas sama ankrut ja lisas 52. jala.

### Plaat

Võrdlusalus on [M2.2b Tauri mõõtmine](M2-2b-uleandmine.md#tauri-jõudlus).

| Mõõt | v0.7.0 mediaan | Enne parandust | Kolm kordusjooksu | Pärast parandust | Piir |
|---|---:|---:|---:|---:|---|
| Töölaud ja foto valmis | 984,2 ms | 927,6 ms | 1003,9 ms / 964,7 ms / 997,6 ms | 997,6 ms | < 1500 ms, täidetud |
| Panoraam | 59,01 fps | 59,01 fps | 59,01 fps / 58,69 fps / 58,69 fps | 58,69 fps | ≥ 57,2 fps, täidetud |
| Rattasuum | 60,00 fps | 60,00 fps | 60,00 fps / 60,00 fps / 60,00 fps | 60,00 fps | ≥ 58,2 fps, täidetud |
| Komponendi lohistus | 41,86 fps | 47,06 fps | 42,60 fps / 41,62 fps / 42,60 fps | 42,60 fps | ≥ 40,6 fps, täidetud |
| Suumi rahunemise pikim kaader | 66,8 ms | 66,7 ms | 66,8 ms / 66,7 ms / 66,7 ms | 66,7 ms | Võrdluseks |
| `project_open` | 159,6 ms | 152,1 ms | 164,2 ms / 168,8 ms / 163,0 ms | 164,2 ms | Võrdluseks |
| `project_save` | 108,7 ms | 104,6 ms | 113,8 ms / 114,2 ms / 110,5 ms | 113,8 ms | Võrdluseks |

### Skeem

| Mõõt | Enne parandust | Kolm kordusjooksu | Pärast parandust | Piir |
|---|---:|---:|---:|---|
| Panoraam | 59,34 fps | 59,67 fps / 59,34 fps / 59,34 fps | 59,34 fps | ≥ 57 fps, täidetud |
| Rattasuum | 59,67 fps | 58,06 fps / 57,45 fps / 58,06 fps | 58,06 fps | ≥ 57 fps, täidetud |
| Sümboli lohistus | 22,22 fps | 57,60 fps / 58,53 fps / 59,01 fps | 58,53 fps | ≥ 45 fps, täidetud |

### Käsud ja tuletised

Tabelis on millisekundid. Mõõdeti iga käsu viis kordust jooksus ja koondati korduste ning kolme jooksu mediaanid. Tuletise 0,00 tähendab, et selle arvutuseks aega ei registreeritud.

| Käsk | v0.7.0 valideerimine + tuletised | Enne parandust valideerimine + tuletised | Valideerimine | Tuletised | Valideerimine + tuletised | Kogu käsk |
|---|---:|---:|---:|---:|---:|---:|
| `items.translate` (plaat) | 22,5 | 7,50 | 8,70 | 0,10 | 8,70 | 9,40 |
| `items.translate` (skeem) | – | 7,70 | 8,20 | 0,10 | 8,30 | 8,80 |
| `connections.add` | 18,3 | 15,20 | 10,20 | 8,80 | 18,00 | 26,60 |
| `beep.record` | 22,0 | 18,40 | 8,40 | 10,20 | 18,60 | 33,70 |

| Tuletis | `items.translate` (plaat) | `items.translate` (skeem) | `connections.add` | `beep.record` |
|---|---:|---:|---:|---:|
| `connectionLevels` | 0,00 | 0,00 | 2,80 | 2,90 |
| `nets` | 0,00 | 0,00 | 5,50 | 5,90 |
| `pinReadings` | 0,00 | 0,00 | 0,00 | 1,50 |
| `unplacedBoard` | 0,00 | 0,00 | 0,00 | 0,00 |
| `unplacedSchematic` | 0,00 | 0,00 | 0,00 | 0,00 |

## Teadaolevad piirid

- Paranduse järel täitusid kõik jõudluspiirid. Jõudluse vastuvõtt on arhitekti ülevaatuseks.
- Kasutaja plaadi äratundmist ja kasutusmugavust hinnatakse suitsukatsel.

## Kasutaja suitsukatse

Katse-EXE on `%TEMP%/bb-m2-3-katse/pcbk-m2-3-katse.exe` (0.8.0). Uue projekti vaikekaust on `%TEMP%/bb-m2-3-katse/`. Katsekoostel on eraldi rakendusetunnus `ee.pcbkaardistaja.desktop.m23acceptance`. EXE koostati pärast memo-parandust uuesti. SHA-256 `25d620018187953edb3c883d93d7291c3e9eb7a6a4492c09bf545ab15834bc73` ja koostelogi `output/playwright/m2-3-7/smoke-memo-build.log` tööpuus.

1. Käivita katse-EXE ja ava oma `v0.7.0`-ga tehtud projekti koopia. Kontrolli, et varasemad andmed on alles.
2. Vaheta vaade nupuga „Skeem“ või `Ctrl+Tab`-iga. Vali loendist „Paigutamata“ 5–10 komponenti, vajuta igaühel „Paiguta skeemile“ ja klõpsa lehel.
3. Liiguta komponente hiire ja nooltega, pööra `R`/`Shift+R`-iga ning peegelda `F`-iga. Võta üks samm `Ctrl+Z`-ga tagasi.
4. Kui transistor, diood või LED on kastina, määra „Jalgade funktsioon“ ja vajuta „Salvesta“. Kontrolli, et kast muutub õigeks sümboliks.
5. Paremklõpsa komponendil ja vali „Näita plaadil“, seejärel plaadil „Näita skeemil“. Komponent peab olema kummaski vaates valitud ja keskel.
6. Lisa skeemivaates teegist takisti ja paiguta see hiljem plaadil fotole.
7. Kas tunned oma plaadi skeemil ära? Mis oli segane või aeglane?
