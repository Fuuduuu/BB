# ADR-001: Kohaliku PCB Kaardistaja keel ja platvorm

**Staatus:** Asendatud, vt [ADR-002](ADR-002-typescript-tauri.md) (BenchBeepiga ühilduvus pole enam nõue)
**Kuupäev:** 2026-11-07
**Otsustaja:** Kasutaja (BenchBeep / TraceBench omanik)

## Kontekst

Veebiprototüüp ([PCB-Kaardistaja.html](../../prototype/PCB-Kaardistaja.html)) näitas, et töövoog toimib: plaadi foto taustaks → komponendid peale → jalad → ühendused → mõõdud. Nüüd on vaja kohalikku äppi, mida kasutatakse elektroonika remondil siis, kui plaadi skeemi pole olemas. Nõuded:

- Kood on moodulite, klasside ja funktsioonidena. Uue võimaluse saab lisada eraldi moodulina, ilma olemasolevat koodi lahti võtmata.
- Komponendi suurust saab muuta ja jalad on kergesti eristatavad.
- Ühenduste põhjal tekivad võrgud, millele saab anda rolli: maandus, 5 V, 12 V jne.
- Mõõtmised (pinge, takistus, diood, läbivus) jäävad kirja koos toite olekuga, et viga saaks järjekindlalt otsida.

Arvestada tuleb ka sellega, et kasutajal on juba **BenchBeep** (`C:\dev\TraceBench`): Flutter/Dart töölaua-äpp sama valdkonna jaoks. Sellel on oma Flutteri SDK (`C:\dev\flutter-tracebench`, Flutter 3.44.9 / Dart 3.12.2), Riverpod ning mõõtmiste ja võrkude andmemudel (`mode: voltage|resistance|diode|continuity`, `power_state`, `confirmation_basis`).

## Otsus

**Flutter / Dart, eraldi repos `C:\dev\PcbKaardistaja`**, esmalt Windowsi töölauale. Struktuur on selline, et Androidi tahvel tuleb hiljem juurde ilma ümberkirjutamiseta. Andmevormingu väljanimed järgivad BenchBeepi omi, et projekti saaks hiljem BenchBeepi importida.

## Kaalutud variandid

### A: Flutter / Dart (valitud)

| Mõõde | Hinnang |
|---|---|
| Keerukus | Keskmine: joonistus käib `CustomPainter`iga, töövoog tuleb Darti ümber kirjutada |
| Kulu | Tasuta, SDK on juba olemas |
| Laiendatavus | Hea: Darti teegid ja paketid, abstraktsed klassid moodulite liideseks |
| Tuttavus | Kõrge: BenchBeep on samas keeles |

**Plussid:** sama keel ja tööriistad mis BenchBeepil; üks koodibaas Windowsile ja Androidile; tugev tüübikontroll ja klassid; `CustomPainter` on kiire ka suure foto ja sadade jalgadega; testid käivad `flutter test`iga.
**Miinused:** prototüübi JavaScripti ei saa otse kasutada, korpuste generaatorid ja võrguloogika tuleb porteerida; SVG-eksport tuleb ise kirjutada.

### B: TypeScript + Tauri

| Mõõde | Hinnang |
|---|---|
| Keerukus | Madal: prototüübi kood jagatakse ES-mooduliteks |
| Kulu | Tasuta, vaja Rusti tööriistaketti |
| Laiendatavus | Hea: ES-moodulid, klassid |
| Tuttavus | Keskmine |

**Plussid:** kiireim tee, sest SVG-joonistus ja loogika on juba olemas; väike `.exe`.
**Miinused:** BenchBeepiga eri keel, nii et mudeleid ja koodi ei saa jagada; juurde tuleb Rusti ehituskeskkond.

### C: Python + Qt (PySide6)

| Mõõde | Hinnang |
|---|---|
| Keerukus | Keskmine: `QGraphicsScene` sobib sellele ülesandele hästi |
| Kulu | Tasuta (LGPL) |
| Laiendatavus | Hea: Pythoni paketid; mõõteriistade (SCPI/seriaal) liidestus on lihtne |
| Tuttavus | Keskmine: TraceBenchi tööriistad on Pythonis |

**Plussid:** mõõteriistade otseühendus on lihtne; lohistamine ja suumimine tulevad `QGraphicsView`ist valmis kujul.
**Miinused:** jagamine on kohmakas (PyInstaller, suur pakk); tahvlil ei tööta; BenchBeepiga eri kasutajaliides.

## Kompromisside analüüs

Otsuse määrab see, et BenchBeep on juba olemas. Variant B annaks esimese versiooni kiiremini, aga siis oleks kaks eri keeles äppi ühe ja sama remondiprotsessi jaoks. Variant A maksab rohkem porteerimistööd, kuid annab ühise keele, ühise andmemudeli ja hiljem võimaluse tööriistad kokku viia. Eraldi repo valiti selleks, et uus töövoog ei peaks kohe läbima TraceBenchi auditit ja sündmuste logi (`events.jsonl`) reegleid.

## Tagajärjed

- **Lihtsamaks läheb:** BenchBeepi mudelid ja teadmised on samas keeles; Androidi tahvel tuleb samast koodist; moodulite liides on kompilaatori poolt kontrollitud.
- **Raskemaks läheb:** prototüübi korpuste generaatorid (~40) tuleb Darti porteerida; SVG-eksport kirjutatakse käsitsi.
- **Hiljem üle vaadata:** kas PCB Kaardistaja jääb eraldi äpiks või saab BenchBeepi mooduliks; kas lisada mõõteriista otseühendus (SCPI/Bluetooth-multimeeter).

## Järgmised sammud

1. [ ] Kasutaja kinnitab variandi A ja asukoha `C:\dev\PcbKaardistaja`.
2. [ ] Teostus käib plaani [2026-11-07-pcb-kaardistaja-desktop.md](../superpowers/plans/2026-11-07-pcb-kaardistaja-desktop.md) järgi.
