# Ülevaatuste otsused (GPT ja Gemini, 2026-11-07)

Mõlemad ülevaatajad said sama [paketi](2026-11-07-ulevaatuse-pakett.md) ja mõlema üldhinnang oli **„JAH, PÄRAST PARANDUSI“**. Mõlemad toetasid ADR-003 varianti D (kohalik mootor lepingu taga). See fail näitab iga leiu kohta, mis otsustati ja kus dokumentides muudatus on.

Tähised: **✓** võetud vastu · **◐** osaliselt (osa oli juba olemas või tehti lihtsamalt) · **✗** tagasi lükatud või juba olemas.

## Arhitektuur ja leping

| Leid | Kes | Otsus | Kus |
|---|---|---|---|
| ReadModel paikadega on v1 jaoks liiga keeruline | mõlemad | ✓ Frontend saab mootorist sama külmutatud viite (`Snapshot`); paikade protokolli pole | [ADR-003](../adr/ADR-003-frontend-backend.md), [03 § 5](../03-arhitektuur.md#5-olek-kolm-eraldi-hoidlat) |
| `execute` peab olema sünkroonne, failitöö asünkroonne | Gemini | ✓ `DocumentEngine` (sünkroonne) + `ProjectService` (asünkroonne). Kohalikus äpis jääb mootor alati arvutisse | ADR-003, [03 § 6](../03-arhitektuur.md#6-käsud-tagasivõtmine-ja-logi) |
| Sõnumid vajavad projekti seansi identiteeti | GPT | ✓ `sessionId` hetktõmmises ja olekuteadetes; klient eirab vana seanssi ja vana `rev`-i; sünkroonne mootor kaotab hilinenud käsuvastused | ADR-003, 03 § 5 |
| Lohistamise tehing vs automaatsalvestus; kaadri kaupa arvutamine | mõlemad | ✓ Tehingud lepingust välja. Eelvaade on `SessionStore`'is, mootorisse läheb üks käsk hiire vabastamisel, `Esc` ei jäta jälge | 03 § 5, [§ 7.2](../03-arhitektuur.md#72-tööriistad), [07 M1.1](../07-teekaart.md#m11--komponent-ja-mõõtmine) |
| Arvutatud andmed peavad olema mootoris | mõlemad | ✓ Võrgud, hinnangud, ühenduse tasemed ja valmidus arvutab mootor ning annab need hetktõmmises; Workeri otsus tehakse kasutajale nähtava viivituse järgi | [03 § 7.4](../03-arhitektuur.md#74-arvutatud-andmed) |
| Omandikontroll ainult logihoiatusena väljalaskes | GPT | ✓ Kontroll tehakse enne avaldamist ja rikkumine lükatakse tagasi ka väljalaskes | [03 § 4](../03-arhitektuur.md#4-moodulisüsteem), 07 M0 |
| Omandikontroll ära jätta | Gemini | ✗ Jääb alles (vt GPT leid). Pärast moodulite liitmist on erandeid vähe | [05](../05-moodulid.md#andmete-omanikud) |
| 16 moodulit liiga killustatud | Gemini | ✓ 11 moodulit: jalad läksid `components`'i, mõõtkava `photo`'sse, logi `project`'i, piiks `measurements`'i; valik on lõuendi tuumas | 05 |
| Kolm versiooni on üleliigne | Gemini | ✓ Alles jääb ainult `format_version` | ADR-003 |
| „Hiljem muutub ainult transport“ on eesmärk, mitte lubadus | GPT | ✓ Sõnastus muudetud | ADR-003 › Kasvutee |
| Feature'id ühes paketis | mõlemad | ✓ Oli juba nii | 03 § 3 |
| M0-s ainult projekt ja üks näidismoodul | GPT | ✓ | 07 M0 |
| IndexedDB asemel ainult mälu | Gemini | ◐ `storage-memory` testideks; `storage-web` jääb minimaalseks brauseris arendamiseks ja „sulge ja ava“ testiks | [03 § 10](../03-arhitektuur.md#10-pordid-ja-adapterid) |

## Salvestus, failid ja fotod

| Leid | Kes | Otsus | Kus |
|---|---|---|---|
| „Suurem `rev`“ ei kaitse kahe akna eest | GPT | ✓ Üks kirjutav seanss ja `base_rev` võrdlus tehingu sees | [03 § 9](../03-arhitektuur.md#9-salvestus-ja-projekti-fail) |
| Sama fail mitmes aknas, WAL-fail jääb kopeerimisel maha | Gemini | ✓ Lihtsamalt kui pakutud: `journal_mode=DELETE` (WAL-i ega checkpointe pole), eksklusiivne lukk ja üks äpi eksemplar; lukustatud fail avaneb kirjutuskaitstuna | 03 § 9, 02 § 15 |
| Vaate salvestamise tee puudub | GPT | ✓ `saveView`: ei loo ajaloosammu ega muuda `rev`-i, `flush()` hõlmab seda | 03 § 9, 07 M0 |
| Pidev töö lükkab salvestamist lõputult edasi | GPT | ✓ Kõige rohkem 10 s ooteaega | 03 § 9 |
| `journal` tabeli piir 5000 rida | Gemini | ✗ Logisse lähevad ainult kinnitatud käsud ja kasutaja ajalool pole suvalist piiri (GPT soovitus) | 03 § 6 |
| `VACUUM INTO` võib jätta poolelioleva faili | GPT | ✓ Kirjutatakse ajutisse faili ja nimetatakse ümber alles pärast õnnestumist | 03 § 9 |
| Varundus ja taastamine | mõlemad | ✓ Automaatne koopia enne migratsiooni ja iga päeva esimesel avamisel (5 viimast); taastamine avalehelt | 03 § 9, 02 § 15, 07 M0 |
| Fotod üle IPC JSON-ina | Gemini | ◐ Kuvamine oli juba ilma Base64-ta, aga asset-protokoll ei serveeri SQLite blob'e → oma protokoll `pcbk://photo`; import käib failist või toorbaitidena | 03 § 9 |
| EXIF ja foto suurus | Gemini | ◐ EXIF loetakse foto teisenduseks (originaali ümber ei kodeerita); üle 12 MP foto jaoks tehakse kuvamisvariant | 03 § 9, [04](../04-andmemudel.md), 07 M1.2 |
| Foto mälukasutus, originaali säilitamine, baidid mitte hetktõmmises | GPT | ✓ Originaal jääb alles, kuvamisvariant ≤ 12 MP, fotobaidid ei ole kunagi hetktõmmises | 03 § 9 |
| Ühe eksemplari lukk ja `.pcbk` failiseos | Gemini | ✓ | 03 § 9, [§ 14](../03-arhitektuur.md#14-paigaldus-ja-väljalase), 07 M0 |
| Juurtaseme veapüüdja ja diagnostika | Gemini | ◐ Paneelide kaupa oli juba olemas; lisandus juurtase („Salvesta koopia ja lae uuesti“) ja diagnostika eksport | [03 § 11](../03-arhitektuur.md#11-vead-logimine-keel) |
| Paigaldus: Windows, WebView2 võrguühenduseta, projektide säilimine | GPT | ✓ Uuendamine käsitsi, allkirjastamine enne avalikku väljalaset, automaatne uuendaja hiljem | 03 § 14, 07 M4 |
| Impordi vastuvõtureeglid | GPT | ✓ Suurusepiirid, täielik kontroll, unikaalsed id-d, viidete terviklus; import loob alati uue projekti | 04 › JSON eksport ja import, 07 M4 |

## Domeen

| Leid | Kes | Otsus | Kus |
|---|---|---|---|
| Piiks ei tõenda sama vaskrada (10 Ω takisti piiksub) | GPT | ✓ Mõõtetulemus ja tehniku otsus on eraldi; `beep.record` saab parameetri `connect`; passiivkomponendi otste vahel ja rollikonflikti korral ei ühendata automaatselt | [04 › Piiks](../04-andmemudel.md#piiks-ei-tõenda-sama-vaskrada), 02 § 8.3, 01, 07 M2 |
| `evidenceId` jääb remondi ja kordusmõõtmise järel valeks | Gemini | ✓ `evidenceId` eemaldati; tase arvutatakse kehtivatest läbivusmõõtmistest samade jalgade vahel | [04 › Ühenduse tase](../04-andmemudel.md#ühenduse-tase-connectionlevels) |
| Vastuolulised mõõtmised ja kihid | GPT | ✓ Viimane kehtiv läbivus otsustab; kihid ühinevad ainult jala kaudu | 04 |
| Jala identiteet korpuse vahetusel | mõlemad | ◐ `PinRef` oli juba olemas; lisandus korpuse vahetuse reegel kinnitusega | 04 › Kustutamise reeglid, 02 § 6.2, 07 M1.3 |
| Foto peegeldamine viib jalad valeks | Gemini | ✓ Lihtsamalt kui pakutud: teisendus rakendub kogu stseenile ja andmeid ümber ei arvutata; lisandus invariantsustest | [03 § 7.1](../03-arhitektuur.md#71-koordinaadid), 02 § 4, 07 M1.2 |
| SVG jõudlus 3000 jalaga | Gemini | ◐ Pan ja suum ühel `<g>`-l oli juba olemas; lisandus üks kuular koos `HitIndex`-iga, LOD 06 lävede järgi ja varajane proov päris aknas (GPT) | [03 § 7.3](../03-arhitektuur.md#73-kihid-ja-jõudlus), 07 M1.2 |
| Tolerants seadistatavaks; „OK“ tähendus; ainult DC | GPT | ✓ `measureSettings` (vaikimisi 10 %, vähemalt 0,1 V) | 04, 02 § 10 |
| Dioodirežiim ja OL | mõlemad | ◐ Salvestatakse näit, polaarsus ja `OL`. „< 0,05 V → lühise kahtlus“ kehtib ainult toite ja maa vahel (sama reegel mis takistusel); üldist dioodidiagnoosi pole | 04, 02 § 10 |
| „< 1 Ω“ on kahtlus, mitte kindel lühis | GPT | ✓ Sõnastatud | 04 |
| AI ettepanek peab olema eraldi kihis | Gemini | ✗ Oli juba nii ([03 § 13](../03-arhitektuur.md#13-ai-liides-hilisem)) | — |
| AI: lubatud käskude loend, `baseRev`, terviklik eelvaade, üks samm | GPT | ✓ | 03 § 13 |
| `projectId`, `sessionId`, `requestId` | mõlemad | ✓ `project_id` ja `copied_from_project_id` on `meta` tabelis; `requestId` läheb logisse | 03 § 9, 04 |
| Kalibreerimata SVG 1:1 | Gemini | ✗ Oli juba olemas (02 § 5); lisandus M4 kontroll | 07 M4 |

## Teekaart ja testid

| Leid | Kes | Otsus | Kus |
|---|---|---|---|
| M1 on liiga suur | mõlemad | ✓ M1.1 (5 põhikorpust + läbiv töövoog) → M1.2 (foto, kalibreerimine, jõudlusproov) → M1.3 (korpuste teek) → M1.4 (suurus ja joondus) | 07 M1 |
| Klaviatuuri, fookuse ja dialoogide katsed | GPT | ✓ | [03 § 12](../03-arhitektuur.md#12-testimine-ja-kvaliteediväravad), 07 M3 |
| Esimese nädala järjekord | mõlemad | ✓ Leping ja tõrkejuhud → mälus töötav mootor → SQLite ja `SaveCoordinator` → sama UI brauseris ja töölaual → rikkekohtade testid | 07 M0 |

## Teine ring (Gemini, MCP serveri järel)

| Leid | Otsus | Kus |
|---|---|---|
| Repo MCP seadistustes ei tohi olla masinapõhiseid teid | ✓ Kontrollitud: `.mcp.json` ja `.gemini/settings.json` kasutavad ainult `python` ja suhtelist teed | [tools/mcp-bb](../../tools/mcp-bb/README.md) |
| Hoiatus, kui kahejalgse komponendi mõlemad jalad on samas võrgus | ✓ `shortedComponents`; püüab kinni vale piiksu või kaardistusvea | [04 › Võrkude arvutus](../04-andmemudel.md#võrkude-arvutus-resolvenets), 02 § 11, 07 M2 |
| Maa ja maa vahel 0,05–0,1 V infovihje | ✓ Kasutaja kinnitas 2026-11-07: hinnang jääb „OK“, lisandub infovihje | [04 › Mõõtmiste hindamine](../04-andmemudel.md#mõõtmiste-hindamine) |
| M0 eeltingimused: Node.js LTS + corepack, Rust + C++ Build Tools | ✓ | [07 M0](../07-teekaart.md#m0--vundament) |
| Foto pööramisel kinnituse küsimine | ✗ Pole vaja, sest teisendus rakendub kogu stseenile ja andmeid ümber ei arvutata | 03 § 7.1 |
| M1 kaheks osaks | ◐ Jääb neljaks osaks (M1.1–M1.4, GPT soovitus); M1.1 vastab Gemini M1a-le | 07 M1 |

## Kasutaja otsustada

1. **ADR-003 v2 vastuvõtmine.** Dokumendid on sellega juba kooskõlla viidud. Staatus on „Ettepanek“, kuni kasutaja selle kinnitab.
