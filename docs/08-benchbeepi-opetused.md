# 08 · BenchBeepi õppetunnid

BenchBeep (`C:\dev\TraceBench`) oli sama eesmärgiga eelmine katse. Seda **ei võeta lõpliku tõena**. Siia on kirja pandud, mis sealt on kasulik ja mida enam kunagi ei korrata. BenchBeepi kood on Dartis, seega võetakse üle ideed ja reeglid, mitte koodiread.

## Mis võetakse üle

| Idee | BenchBeepis | Siin |
|---|---|---|
| Inimene on sensor, AI on abiline | `docs/POHIKIRI_AI.md` | [01](01-pohimotted.md), [03 § 13](03-arhitektuur.md#13-ai-liides-hilisem): AI ainult ettepanekutena, äpp töötab täielikult ilma AI-ta |
| Local-first, internetita | `docs/PROJECT_MEMORY.md` | üks `.pcbk` fail, võrguõigust v1-s pole, fondid pakitud kaasa |
| Visuaalne töölaud: plaat keskel, kontekst paremal | `docs/POHIKIRI.md` §4 | [02 § 3](02-kasutaja-teekond.md#3-töölaud), [06](06-kasutajaliides.md#paigutus) |
| Mõõtmine: **Koht → Väärtus → Ühik → Salvesta** | `docs/UI_WORKFLOWS.md` | [02 § 10](02-kasutaja-teekond.md#10-mõõtmine) |
| Kiired režiimid V / Ω / Diood / Piiks; vool on lisavõimalus | `measurement_units.dart` | sama; vool tuleb hiljem |
| Töökoja sõnavara: Koht, Väärtus, „Mõõdetud siin“, „Võrdluseks“, „Kinnitamata“ | `PROJECT_MEMORY.md` | [01 › Sõnastik](01-pohimotted.md#sõnastik), [06 › Tekstid](06-kasutajaliides.md#tekstid) |
| Mõõtmised aeguvad pärast remonti, aga jäävad ajalukku | `stale_after_repair` | `staleByRepairId` ja „enne remonti“ ([04](04-andmemudel.md#remont-ja-aegumine)) |
| Paigaldamata komponent | `not_populated` | `dnp` |
| Visuaalne ja mõõdetud teadmine on eri tasemel | Visual vs Electrical graph | lihtsalt üks väli `basis`: oletatud / nähtud / mõõdetud ([01](01-pohimotted.md#info-usaldusväärsus-kolm-taset)) |
| Projekt võib alata fotota ja tundmatu seadmega | `POHIKIRI.md` §3 | [02 § 2](02-kasutaja-teekond.md#2-uus-plaat): kõik väljad valikulised |
| Rollide värvid: 5V punane, 12V sinine, maandus must | `POHIKIRI_AI.md` §4 | vaikerollid ([04](04-andmemudel.md#vaikimisi-rollid)) |
| Rada ei jookse linnulennult | `POHIKIRI_AI.md` §4 | rada käänupunktidega; linnulennul ühendus on eraldi tüüp „link“ |
| Kahjustatud ja kahtlased alad fotol | `DamageRegionFact`, `SuspectRegionFact` | `DamageArea` ja kahtlaste vaade ([02 § 11](02-kasutaja-teekond.md#11-vigade-otsing-ja-remont)) |
| Kliendile mõeldud raport | `samples/pelle_pv20_minimal/exports/customer_report.md` | remondiraport ([02 § 14](02-kasutaja-teekond.md#14-eksport-ja-raport)) |
| Võrdluspildid (andmelehe jalgade joonis) eraldi tõendist | reference images sidecar | `referenceImageId` komponendil; ei ole kunagi mõõtmine |
| Korpuste mõõtude kontroll | `lib/shared/footprints/vector_footprint_library.dart` | teisene allikas prototüübi korpuste mõõtude ristkontrolliks M1-s |

## Mida ei korrata

| BenchBeepi probleem | Tagajärg | Siinne reegel |
|---|---|---|
| Üks ekraani fail kasvas 209 KB-ni (`board_canvas_screen.dart`), lisaks mega-kontrollerid | muudatused murdsid teisi osi; audit ja parandused venisid | moodulid + registri kaastööd; faili piir 400/600 rida CI-s ([03 § 2](03-arhitektuur.md#2-kihid)) |
| Tõe torustik: `events.jsonl` → Pythoni materializer → `known_facts.json` → käsitsi „Värskenda andmeid“ | kasutaja nägi aegunud andmeid ja pidi torustikku ise juhtima | üks dokument mälus, käsud koos tagasivõtmisega, automaatsalvestus; logi on ajalugu, mitte tõe allikas ([03 § 6](03-arhitektuur.md#6-käsud-tagasivõtmine-ja-logi)) |
| Komponent kahe objektina: kandidaat ja kinnitatud paigutus (BB-03, BB-08) | segadus, topeltvalik, kinnitusvoog jäi tegemata | üks komponent = üks objekt; „Tuvastatud“ on ainult olek |
| Mõõtmise sihtmärk vahetus ise (BB-01: valisid C2, salvestati R1) | vale andmekirje, kõige ohtlikum viga | valik ainult SessionStore'is; tööriist/filter/paneel ei muuda valikut; regressioonitestid M3-s |
| Tühjale alale klõps või filter tühjendas sihtmärgi või vahetas režiimi (BB-04, BB-11) | kasutaja kaotas sisestuse | sama reegel; mustand jääb alles |
| Peidetud nupud tegid ikkagi tegevusi (BB-06) | „nähtamatu maagia“ | tööriist on aktiivne ainult siis, kui see on nähtavalt valitud |
| Lohistamine hüppas paneeli avanemisel või keskpunkt hüppas kursori alla (BB-02, BB-14) | asukohad läksid valesti salvestusse | lohistamine algab 3 px järel; haaramise koht säilib; paneelide avanemine ei liiguta lõuendit |
| Seitsmesammuline viisard enne plaadi nägemist | aeglane algus | üks dialoog, kõik valikuline, või lohista foto avalehele ([02 § 1–2](02-kasutaja-teekond.md#1-äpi-avamine-avaleht)) |
| Kohustuslikud kontrolldokumendid, auditiregistrid ja „pass queue“ protsess | arendus läks paberimajanduseks | kvaliteet tuleb automaatsetest väravatest (CI, testid, sõltuvusreeglid) ja lühikestest verstapostidest ([07](07-teekaart.md)) |
| Mobiilis „pole saadaval“ nupud | ebaaus kasutajaliides | platvorm, mis tegevust ei toeta, seda nuppu ei näita |

## Kuidas BenchBeepi materjali kasutada

- **Loe:** `docs/POHIKIRI.md`, `docs/POHIKIRI_AI.md`, `docs/WORKFLOW_FINDINGS.md` (vead, mida vältida), `docs/BOARD_GRAPH_SPEC.md` ja `docs/PHOTO_FLOW_SPEC.md` (ideed M5 ja M6 jaoks).
- **Ära kopeeri:** sündmuste skeeme, Project ZIP lepingut, Pythoni materializerit, auditi- ja protsessidokumente.
- **Andmeid ei impordita:** BenchBeepi projektide import pole nõue. Kui seda hiljem vaja läheb, tehakse eraldi `importers` kaastöö moodulis `project`.
