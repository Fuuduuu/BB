# Ülevaatuste otsused (GPT ja Gemini, 2026-11-07)

Mõlemad ülevaatajad said sama [paketi](2026-11-07-ulevaatuse-pakett.md) ja mõlema üldhinnang oli **„JAH, PÄRAST PARANDUSI“**. Mõlemad toetasid ADR-003 varianti D (kohalik mootor lepingu taga). See fail näitab iga leiu kohta, mis otsustati ja kus dokumentides muudatus on.

Tähised: **✓** võetud vastu · **◐** osaliselt (osa oli juba olemas või tehti lihtsamalt) · **✗** tagasi lükatud või juba olemas.

## Arhitektuur ja leping

| Leid | Kes | Otsus | Kus |
|---|---|---|---|
| ReadModel paikadega on v1 jaoks liiga keeruline | mõlemad | ✓ Frontend saab mootorist sama külmutatud viite (`Snapshot`); paikade protokolli pole | [ADR-003](../adr/ADR-003-frontend-backend.md), [03 § 5](../03-arhitektuur.md#5-olek-kolm-eraldi-hoidlat) |
| `execute` peab olema sünkroonne, failitöö asünkroonne | Gemini | ✓ `DocumentEngine` (sünkroonne) + `ProjectService` (asünkroonne). Kohalikus äpis jääb mootor alati arvutisse | ADR-003, [03 § 6](../03-arhitektuur.md#6-käsud-tagasivõtmine-ja-logi) |
| Sõnumid vajavad projekti seansi identiteeti | GPT | ✓ `sessionId` hetktõmmises ja olekuteadetes; klient eirab vana seanssi ja vana `rev`-i; sünkroonne mootor kaotab hilinenud käsuvastused | ADR-003, 03 § 5 |
| Lohistamise tehing vs automaatsalvestus; kaadri kaupa arvutamine | mõlemad | ✓ Tehingud lepingust välja. Eelvaade on `SessionStore`'is, mootorisse läheb üks käsk hiire vabastamisel, `Esc` ei jäta jälge | 03 § 5, [§ 7.2](../03-arhitektuur.md#72-tööriistad), [07 M1.1](../07-teekaart.md#m11--komponent-fotol-ja-mõõtmine) |
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
| M0 eeltingimused: Node.js LTS + corepack, Rust + C++ Build Tools | ✓ | [07 M0](../07-teekaart.md#m0--vundament-ja-esimene-komponent) |
| Foto pööramisel kinnituse küsimine | ✗ Pole vaja, sest teisendus rakendub kogu stseenile ja andmeid ümber ei arvutata | 03 § 7.1 |
| M1 kaheks osaks | ◐ Jääb neljaks osaks (M1.1–M1.4, GPT soovitus); M1.1 vastab Gemini M1a-le | 07 M1 |

## Kolmas ring: Codexi tervikplaan

[Codexi tervikplaan](2026-11-07-codex-tervikplaan.md) pakkus kahte võrdset vaadet (Plaat ja Skeem) ning EDA-laadset 11 objektiga mudelit. Gemini vaidles mudeli suurusele ja skeemi varasele ajale vastu. Codex nõustus kompromissiga ja lisas viis täpsustust. Kokkuvõte on [ADR-004](../adr/ADR-004-kaks-vaadet-ja-uhendused.md).

| Leid või ettepanek | Kes | Otsus | Kus |
|---|---|---|---|
| Skeem peab olema muudetav tööpind, komponendi saab lisada kummaski vaates | Codex | ✓ Üks komponent valikuliste paigutustega (`board?`, `schematic?`), loendid „Plaadile/Skeemile paigutamata“ | [04 › Tüübid](../04-andmemudel.md#tüübid), [02 § 13](../02-kasutaja-teekond.md#13-skeem-ja-kaardistuse-valmimine), [03 § 8](../03-arhitektuur.md#8-skeemivaade) |
| 11 eraldi objekti (Terminal, BoardPlacement, SymbolPlacement, BoardRoute, SchematicWire …) | Codex | ◐ Gemini variant: valikulised väljad komponendil ja ühendusel, lisaks `Junction`; vastutused säilivad ilma eraldi objektideta (Codexi kinnitus) | 04 |
| Jalgade vastavus: padjand ja sümboli kontakt viitavad samale jalale; tähise või nime muutus ei muuda ühendusi | Codex | ✓ `Component.pins`, `padMap`, `pinMap` | 04 › Tüübid |
| Võrgud geomeetrilise läheduse põhjal → teadlikud liitepunktid | mõlemad | ✓ ühendatus ainult ühendustes; haru loob liitepunkti; kihireegel joonistamisel | [04 › Võrkude arvutus](../04-andmemudel.md#võrkude-arvutus-resolvenets), 02 § 8, 07 M2 |
| „Eemalda joonistus“ ja „Kustuta ühendus“ eraldi | Codex | ✓ | 04 › Kustutamise reeglid, 02 § 8.1 |
| Piiks: kõigil paaridel nähtav valik ühendamise ja ainult mõõtmise vahel | Codex, Gemini | ✓ Gemini kiirtee Codexi tingimusega: `Enter` = nupp „Piiksub ja ühenda“, `Shift+Enter` = „Ainult mõõtmine“, `N` = „Ei piiksu“; tavaline läbivus ei ühenda; kaitsed on abilised; 50 jalga < 2 min tõendatakse kasutuskatses | 04 › Piiks, 02 § 8.3, 06, 07 M2 |
| `Esc` salvestas piiksu vastuse „ei“ | Codex | ✓ `Esc` katkestab ega salvesta midagi | 02 § 8.3, 06 |
| Must sond valiti automaatselt esimese GND-jalana; toite vaikimisi olek | Codex | ✓ kasutaja valib, GND on soovitus, lukk mõõtmisjada ajaks; toite algolek „Teadmata“ | 02 § 10, 04 |
| `Tab` vahetas mõõtmise Kohta | Codex, Gemini | ✓ `Tab` = vormiväljad, `Alt+↓/↑` ja nupud = järgmine/eelmine jalg | 02 § 10, 03 § 5, 06, 07 M3 |
| Väärtus vaikimisi „10k“; korpuse märgistus puudus | Codex, Gemini | ✓ `value` tühi, uus väli `marking` | 04, 02 § 6 |
| Kustutatud jala mõõtmised vs impordi viidete terviklus | Codex, Gemini | ◐ Arhiveeritud jalgu ei tehta (Gemini); mõõtmine säilitab mõlema sondi id ja sildi ning on „kontakt kustutatud“ olekus, ei mõjuta võrke ega hinnanguid (Codexi täpsustus); erand kehtib ainult mõõtmistele | [04 › Mõõtmise kontaktid ja ajalugu](../04-andmemudel.md#mõõtmise-kontaktid-ja-ajalugu), 04 › JSON |
| Remont rajale või võrgule | mõlemad | ✓ `affects`: komponent, võrgud, kogu plaat, mitte midagi; komponendita remondil tuleb valida | 04 › Remont, 02 § 11 |
| Lukus fail ei avane kirjutuskaitstuna; avatud faili kopeerimine pole ohutu | Codex | ✓ aus teade „Fail on avatud mujal“; koopia ainult äpi kaudu | [03 § 9](../03-arhitektuur.md#9-salvestus-ja-projekti-fail), 02 § 15 |
| 30 minuti vahekoopiad | Codex; Gemini vastu (kettakulu) | ◐ Dokumendikoopia ilma fotodeta iga 30 min järel, täiskoopia aluseks; uus foto → järgmine taastepunkt täiskoopiana (Codexi täpsustus) | 03 § 9 |
| Foto import terviklik; kirjutuskaitstud fail avamisel ei muutu | Codex | ✓ | 03 § 9 |
| Plaadi tööpind fotost sõltumatu, teine foto joondusega | Codex | ✓ `PhotoRef.toBoard` (esimesel ühik) | 04, 03 § 7.1 |
| Ekraanipunkt maailma: pöördmaatriks, `setPointerCapture`, `pointercancel` | Codex | ✓ | 03 § 7.1 |
| `rev` kasvab ka tagasivõtmisel; sügav külmutus; `useSyncExternalStore` | Codex | ✓ | 03 § 5, § 6 |
| Workerisse liigub puhas arvutus, mitte mootor | Codex | ✓ (oli juba ADR-003 v2-s, sõnastus täpsustatud) | 03 § 7.4 |
| M0 näidismoodul `notes` → päris komponent | mõlemad | ✓ | [07 M0](../07-teekaart.md#m0--vundament-ja-esimene-komponent), 05 |
| Skeemi aeg: Codex enne mõõtmisi, Gemini M4 | — | ✓ **M2** (Claude'i ettepanek, Codex nõustus): minimaalne mõõtmine M1-s, lihtne muudetav skeem M2-s, automaatpaigutus M4-s | ADR-004, 07 |
| Prototüübi import: läheduse liited ei tule kindlatena | Codex, Gemini | ✓ `importChecks` kontrollnimekiri, „Kinnita liide“ / „Jäta lahti“, eri kihtidest läbiviiku ei tehta | 04 › JSON, 05, 07 M4 |
| Invariandid ja kasutuskatse | Codex | ✓ invariantide tabel ja kasutuskatse iga verstaposti lõpus | [03 § 12](../03-arhitektuur.md#kohustuslikud-invariandid) |
| Kaks vaadet kõrvuti | Codex | ✗ v1-s üks suur lõuend korraga; kõrvutamine ainult siis, kui kasutuskatse selle kasu näitab | 02 § 13 |

## Neljas ring: commiti eelkontroll (Codex)

Codex kontrollis kavandatud commiti eraldi koopias ja leidis kuus lünka. Kõik pidasid kontrollimisel paika ja on parandatud.

| Leid | Otsus | Kus |
|---|---|---|
| Commiti koopias tekiks 5 katkist viidet, sest `docs/README.md` stardiraamistiku osa viitab commitist välja jäävatele failidele | ✓ Commit koostatakse ainult enda muudatustest; `docs/README.md`-st võetakse ainult enda read; enne commiti kontrollitakse commiti puu eraldi koopias | commiti käik |
| Sama numbriga uus jalg (SOIC-14 → SOIC-8 → SOIC-14) aktiveeriks vanad mõõtmised | ✓ Jalal on eksemplari tunnus `uid`, mida ei taaskasutata; mõõtmine salvestab `uid`-i; tagasivõtmine taastab sama `uid`-i | [04 › Mõõtmise kontaktid ja ajalugu](../04-andmemudel.md#mõõtmise-kontaktid-ja-ajalugu), 07 M1.3 |
| Liitepunkti eemaldamisel jääks võrgusildi ankur katki; omanditabel ei lubanud seda | ✓ Sildid tõstetakse asendavale jalale või allesjäänud võrguliikmele, muidu kustutatakse, sama käsu sees; `connections` ja `schematic` tohivad kirjutada `netLabels`-i | [04 › Võrkude arvutus](../04-andmemudel.md#võrkude-arvutus-resolvenets), [05](../05-moodulid.md#andmete-omanikud) |
| Mustand „kuulub sondipaarile“, aga võti oli ainult punane sond | ✓ Võti on punase ja musta sondi paar; kumma sondi vahetus avab uue mustandi | 03 § 5, 02 § 10 |
| Kasutuskatse nõudis 20 mõõtmist ka M0-s; stsenaariumis puudus U2 loomine | ✓ Kasutuskatse sisu kasvab verstapostide kaupa (20 mõõtmist alates M3); stsenaariumi samm 4 loob U2 (SOT-23 regulaator) ja nimetab J1, J2, C1, C2 | [03 § 12](../03-arhitektuur.md#kohustuslikud-invariandid), 02 § 16 |
| A–B mõõtekinnitus kaoks, kui ühendus jagatakse haruks (A–J, J–B) | ✓ Mõõdetud on ühendused, mis asuvad mõõdetud jalapaari vahelisel teel ainult liitepunktide kaudu | [04 › Ühenduse tase](../04-andmemudel.md#ühenduse-tase-connectionlevels), 07 M2 |

## Kasutaja otsused

- **2026-11-07: Codex ehitab, Claude on arhitekt.** Rollid on kirjas [teekaardil](../07-teekaart.md#rollid).
- **2026-11-07: [ADR-003 v2](../adr/ADR-003-frontend-backend.md) ja [ADR-004](../adr/ADR-004-kaks-vaadet-ja-uhendused.md) võeti vastu.** Järgmine samm on M0 teostusplaan Codexile.

## Kasutaja otsustada

Lahtisi otsuseid praegu pole.
