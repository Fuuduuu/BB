# ADR-002: TypeScript + Tauri 2, nullist ehitatud moodulipõhine äpp

**Staatus:** Vastu võetud (kasutaja otsus 2026-11-07: BenchBeepiga ühilduvus pole nõue)
**Kuupäev:** 2026-11-07
**Asendab:** [ADR-001](ADR-001-keel-ja-platvorm.md) (Flutter/Dart)

## Kontekst

BenchBeep (`C:\dev\TraceBench`, Flutter) läks valele rajale. Ühe ekraani fail kasvas 209 KB-ni, tõe torustik (sündmuste logi → Pythoni materializer → projektsioon → käsitsi „Värskenda andmeid“) tegi kasutaja töö keeruliseks ning sama komponent elas kahe eri objektina (kandidaat ja kinnitatud). Kasutaja tahab alustada nullist ning lähtuda moodulipõhisest ülesehitusest ja kasutaja mugavusest. BenchBeepiga ühilduvus ei ole enam nõue.

Veebiprototüüp ([PCB-Kaardistaja.html](../../prototype/PCB-Kaardistaja.html), lähtekood `prototype/src/`) vastab kasutaja ootustele ja on kirjutatud JavaScriptis.

Nõuded otsusele:
- kohalik töölaua-äpp, mis töötab ilma internetita;
- moodulid, klassid ja funktsioonid, nii et uue võimaluse saab lisada eraldi moodulina;
- kiire ja täpne joonistus (foto, sajad komponendid, tuhanded jalad);
- AI esialgu puudub, aga peab olema hiljem ühendatav;
- lihtne ja mugav kasutada.

## Otsus

**TypeScript (strict) + React 18 + Vite, kest Tauri 2 (Rust).** Plaat joonistatakse SVG-na kihtidena. Olekut hoiavad Zustand ja Immer (käsud, tagasivõtmine Immeri paikadega). Projekt on üks fail `.pcbk` (SQLite). Sama kasutajaliides jookseb ka tavabrauseris platvormikihi `web` kaudu, mida kasutatakse arenduseks ja e2e-testideks.

## Kaalutud variandid

| | TypeScript + Tauri (valitud) | Flutter/Dart | Python + Qt |
|---|---|---|---|
| Prototüübi korduskasutus | Otse: SVG-joonistus, korpuste generaatorid, võrguloogika | Tuleb kõik porteerida | Tuleb kõik porteerida |
| Joonistus ja eksport | SVG = ekraan ja eksport sama koodiga | `CustomPainter`, SVG-eksport eraldi | `QGraphicsScene`, SVG eraldi |
| AI hilisem ühendamine | Lihtsaim: HTTP, JSON-skeemid (zod), MCP-ökosüsteem | Võimalik | Võimalik |
| Paigaldus | Väike `.exe`/`.msi` (~10 MB), WebView2 on Windowsis olemas | ~25 MB | PyInstaller, suur ja kohmakas |
| Testimine | Vitest (loogika), Playwright (terve töövoog brauseris), cargo test | flutter test | pytest, GUI-testid keerulised |
| Tahvel hiljem | Tauri 2 toetab Androidi | Väga hea | Ei |
| Riistvara (multimeeter) hiljem | Rust: seriaalport, Bluetooth | Pluginad | Väga hea |

## Kompromissid

Flutteri ainus suur eelis oli BenchBeepiga sama keel, kuid see nõue kadus. TypeScript + Tauri annab kiireima tee tõestatud prototüübist valmis äpini. Ekraanile joonistamine ja SVG-eksport kasutavad sama koodi ning AI hilisem ühendamine on selles ökosüsteemis kõige lihtsam. Hinnaks on kaks keelt (TypeScript ja Rust). Rusti osa hoitakse aga väikesena: failid, SQLite, dialoogid ning hiljem seriaalport ja AI võtmete hoidmine.

## Tagajärjed

- **Lihtsamaks läheb:** prototüübi loogika viiakse moodulitesse; käsud ja nende zod-skeemid sobivad hiljem otse AI tööriistade kirjeldusteks; e2e-testid käivad brauseris ilma Tauri-akent avamata.
- **Raskemaks läheb:** suure foto ja tuhandete SVG-elementidega tuleb jõudlust hoida (vt [03-arhitektuur.md](../03-arhitektuur.md), jõudluseelarve); fondid tuleb kaasa pakkida, sest töö toimub võrguühenduseta.
- **Hiljem üle vaadata:** kas SVG jääb piisavaks väga suurte plaatide puhul (variant: Canvas/WebGL-kiht jalgadele).

## Seotud

[03-arhitektuur.md](../03-arhitektuur.md), [07-teekaart.md](../07-teekaart.md), [08-benchbeepi-opetused.md](../08-benchbeepi-opetused.md)
