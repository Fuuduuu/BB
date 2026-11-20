# M2.1 vastuvõtt ja suitsukatse

Kaart [M2-1-11](../tasks/M2-1-11.md), haru `codex/m2-1`, alus `a29cef4`. Tööpuu `C:/Users/TRUMPIT/.codex/worktrees/bb-m2-1/BB`. Ehitaja kontrollides kasutati sünteetilisi fotosid ja projekte.

## Vastuvõtt

| Tingimus | Tõend |
|---|---|
| Raja joonistamine, haru ja kiirühendus | `connections_flow_end_to_end` kontrollib rada käänupunktiga, haru liitepunkti ja kolme jala kiirühendust. |
| Rollid, hoiatus, ühenduse eemaldamine ja tagasivõtmine | Sama E2E määrab rollid GND ja 5V, kontrollib ühendamisel hoiatust ning eristab joonistuse ja ühenduse eemaldamist. Iga sammu järel kontrollitakse Ctrl+Z tulemust. |
| Võrguloendi CSV | TS-test kontrollib nupu olekuid, puhastatud failinime, CSV sisu ja veateadet. E2E kontrollib veebist allalaaditud faili. Rusti test kontrollib laiendipiirangut ja faili baite. Jõudlusparanduse eelne katse-EXE salvestas Windowsi dialoogist sünteetilise projekti kahe reaga UTF-8 CSV. |
| v0.4.0 ühilduvus | `v0_4_0_file_opens_and_keeps_data` avab koopia kaks korda. Säilisid `file_id`, dokument ja originaalfoto baidid. |
| Suure plaadi jõudlus | Kolm kehtivat Tauri jooksu mõlemas mõõtmises. Lohistuse mediaan tõusis 32,29 fps-lt 40,68 fps-ni. Kasutaja aktsepteeris 45 fps eelarvest madalamat tulemust v0.5.0 jaoks. Muud eelarved täitusid. |
| Kasutaja suitsukatse | Läbis 2026-11-20: kasutaja tegi kõik 12 sammu oma plaadi fotoga ja kõik läbisid. |

## Automaatsed tõendid

Tööpuus `output/playwright/m2-1-11/` on `e2e-red.log`, `e2e-green.log`, `netlist-export-red.log`, `netlist-export-green.log`, `text-export-red.log`, `text-export-green.log`, `compatibility-red.log` ja `compatibility-green.log`. RED-is puudus E2E ja TS jaoks CSV-nupp, Rusti CSV-testi jaoks kirjutusfunktsioon ning ühilduvustesti jaoks v0.4.0 näidisfail.

Esimeses täisringis leidsid kontrollid uue TS-testi lintivead ning koostetesti juhtumi, kus töölaua host puudus. Kooste annab nüüd valikulise salvestusvõime edasi koos hostiga. Koostetesti ootused säilisid. Sama jooksu `pin_stays_on_photo_mark_after_rotate_and_mirror` kaotas brauseri konteksti veebikooste faili kirjutamise ajal. Esimese jooksu tõendid on põhikaustas `output/review-card/M2-1-11-zIbZq9/`.

Kordus enne jõudlusparandust läbis 1673 ühiktesti, 43 E2E ja 105 Rusti testi. Kaks Rusti testi jäid oma seadistuse järgi vahele. Kokkuvõte on põhikaustas `output/review-card/M2-1-11-tyolC9/summary.json`. Pärast lohistusparandust läbisid kõik 24 ühenduste ja võrkude kasutajaliidese testi ning tüübikontroll. Logid on tööpuus `output/playwright/m2-1-11/drag-memo-targeted.log` ja `output/playwright/m2-1-11/drag-memo-typecheck.log`.

Lõplik põhikaustast käivitatud `pnpm bb-review-card M2-1-11` andis `ok: true` ja `missing: []`. Läbisid kõik 1673 ühiktesti, 43 E2E ja 105 Rusti testi, sealhulgas neli kaarditesti. Kaks Rusti testi jäid oma seadistuse järgi vahele. Kokkuvõte on põhikaustas `output/review-card/M2-1-11-aoDS9v/summary.json`.

Domeeni katvus lõplikul koodil oli 99,72% ridadest, 96,27% harudest, 98,81% funktsioonidest ja 98,36% lausetest. Kõige väiksema harukattega failid on tabelis. Ridade järgi on neist ainult `connections.ts` alla 100%.

| Fail | Harukate | Reakate |
|---|---:|---:|
| `packages/domain/src/rules/connections.ts` | 104/118 (88,13%) | 98,46% |
| `packages/domain/src/rules/nets.ts` | 11/12 (91,66%) | 100% |
| `packages/domain/src/rules/layers.ts` | 12/13 (92,30%) | 100% |

## Tauri jõudlus

Võrdlusalus on [M1.4 vastuvõtt](M1-4-uleandmine.md#tauri-jõudlus). Mõlema mõõtmise kolm kehtivat Tauri jooksu kasutasid seemet 127, 300 komponenti, 3000 jalga, 1000 rada (909 pealmisel ja 91 alumisel kihil), 1500 mõõtmist, 12 nimega võrku, 12 MP sünteetilist fotot ja 1280 × 800 kliendiala. Akna fookus ja nähtavus säilisid kõigis arvestatud jooksudes. Panoraami ja rattasuumi proov oli kumbki 180 kaadrit ning komponendi lohistuse proov 120 kaadrit ja üks käsk.

| Mõõt | M1-4-11 mediaan | Enne parandust | Pärast parandust | Eelarve |
|---|---:|---:|---:|---:|
| Töölaud ja foto valmis | 714,5 ms | 1032,5 ms | 1033,6 ms | < 1500 ms |
| Panoraam | 59,3 fps | 57,14 fps | 58,38 fps | ≥ 57 fps |
| Rattasuum | 60,0 fps | 60,00 fps | 59,67 fps | ≥ 57 fps |
| Komponendi lohistus | 50,7 fps | 32,29 fps | **40,68 fps** | **≥ 45 fps, täitmata** |
| Suumi rahunemise pikim kaader | 50,0 ms | 99,9 ms | 66,7 ms | 1000 ms vaatlus |
| `project_open` | 81,0 ms | 169,5 ms | 147,4 ms | võrdluseks |
| `project_save` | 56,8 ms | 88,8 ms | 93,6 ms | võrdluseks |

| Käsk | `validateDocument` | Tuletised | sh `nets` | Valideerimine + tuletised enne → pärast (≤ 16 ms) | Kogu `execute` pärast |
|---|---:|---:|---:|---:|---:|
| `items.translate` | 6,3 ms | 6,3 ms | 4,5 ms | 12,4 → 12,9 ms | 15,2 ms |
| `connections.add` | 6,2 ms | 3,4 ms | 3,4 ms | 9,8 → 9,5 ms | 18,3 ms |

Iga käsu valideerimise ja tuletiste aeg liideti mõõteproovi kaupa. Tabel näitab summade mediaani. Tuletiste aeg sisaldab `nets`-i ja lõplik dokumendipildi külmutamine kajastub kogu `execute` ajas. Paranduse järel mõõdeti lohistusel 38,10, 40,91 ja 40,68 fps. Lähteandmed ja eelarvete arvutus on tööpuus `output/playwright/m2-1-11/native-acceptance-summary.json`. Varasem proov on samas `before-drag-memo/native-acceptance-summary.json`.

### Lohistuse Reacti profiil

Eraldi diagnostilises Tauri jooksus uuendasid järgmised kihid kõigil 115 aktiivsel eelvaatekaadril. Mediaan kirjeldab Reacti `actualDuration`-it. Selle mõõdu alt jäävad välja DOM-i muudatuste rakendamine, paigutus ja värvimine.

| Kiht | Reacti mediaan kaadris |
|---|---:|
| `components.pins` | 1,3 ms |
| `components.labels` | 1,1 ms |
| `measurements.readings` | 0,9 ms |
| `components.bodies` | 0,8 ms |
| `connections.traces` | 0,8 ms |
| `components.handles` | 0,1 ms |
| `nets.pinRoles` | 0,1 ms |
| `connections.airLines`, `connections.junctions` | ümardatult 0 ms |

Rajakihi memo-komponentidest joonistus igas kaadris uuesti 20 mõjutatud rada 1000-st. Jalarõngaste memo-komponendid jäid selle žesti puhul vahele. Prooviplaadil polnud õhujooni ega liitepunkte, mistõttu profiil näitab nende kihtide ümbriste tööd. Foto ja rajasiltide kihid aktiivse eelvaate ajal uuesti ei joonistunud. Profiil on tööpuus `output/playwright/m2-1-11/after-drag-memo/profile/layer-profile-summary.json`. Diagnostilise jooksu 40,22 fps jäi vastuvõtu mediaanist välja.

## Ühilduvusfailid

Rusti testid avavad ajutisi koopiaid. Failid asuvad tööpuus `apps/desktop/src-tauri/tests/fixtures/`.

| Fail | Baiti | SHA-256 |
|---|---:|---|
| `v0.1.0.pcbk` | 49152 | `b9f9535bde765a9affe23d5ad8eea3a11af40323b5ce199b3877519c382e8d9f` |
| `v0.1.1.pcbk` | 49152 | `caef9d0ac7d3deaad032522527f6556aea04fe637355b82520206f7922a36a65` |
| `v0.2.0.pcbk` | 208896 | `7c5ffa0662ad1927a7c990f41bbbc9924fd0768d7fa8e6cd994a23cb238b6177` |
| `v0.3.0.pcbk` | 208896 | `c7835130797a17e8d6c10b3044bdfd535026a4393cdaab12a2d37bff19871eb0` |
| `v0.4.0.pcbk` | 208896 | `d30ce7bf14b9e460c92d0279056af2e851ad23b4c227436f6f19f760a1f7944a` |

v0.4.0 näidis loodi sildi `v0.4.0` (`00a424e`) töölauarakenduse kasutajaliideses. Eraldatud käivitus kasutas ajutist projektikausta. Sünteetilise JPEG-fotoga plaadile salvestati 20 mm kalibreering, komponendid U1 (SOIC-8) ja R1, U1.8 nimi VCC, U1.7 tunnus NC, U1 käsitsi nihutatud tähis ning näit 4,98 V jalgade U1.8 ja R1.1 vahel. Pärast projekti sulgemist kontrolliti SQLite terviklust ja faili räsi.

## Teadaolevad piirid

- Väljalaske otsus järgneb kasutaja suitsukatsele. Katse-EXE kasutab praegust versiooniväärtust 0.4.0.
- Suure sünteetilise plaadi lohistuse mediaan on 40,68 fps, eelarve 45 fps. Kasutaja aktsepteeris seda piirangut v0.5.0 jaoks. Ülejäänud Reacti renderdustööst võtsid enim aega komponendi jalgade, siltide ja mõõtenäitude kihid. Nende jõudlus läheb järgmisesse verstaposti.
- CSV-nupp on kasutatav, kui projektis on vähemalt üks võrk ja host toetab salvestust. Töölaual valib kasutaja salvestuskoha dialoogis.

## Kasutaja suitsukatse

Staatus: **läbis 2026-11-20**. Kasutaja tegi kõik 12 sammu oma plaadi fotoga ja teatas, et kõik läbisid. Lohistus oli tema plaadil vastuvõetav.

Katse-EXE on `%TEMP%/bb-m2-1-katse/pcbk-m2-1-11-katse.exe`, SHA-256 `0d3e8e45eac94e723a0a03457434ead42e443f53a1e8e62d8825a9ff7b2fd4c6`. Uue projekti ja „Salvesta mujale…“ vaikekaust on `%TEMP%/bb-m2-1-katse/`. Ehituse logi on tööpuus `output/playwright/m2-1-11/smoke-build.log`. Vana faili avamist saab proovida sünteetilise koopiaga `%TEMP%/bb-m2-1-katse/v0.4.0-suitsukatse.pcbk`.

Enne lohistuse parandust kontrollis ehitaja sünteetilise projekti loomist vaikekausta, selle taasavamist, CSV-dialoogi tühistamist veateateta ja 57-baidise BOM-iga UTF-8 CSV salvestust. Tõend on tööpuus `output/playwright/m2-1-11/smoke-exe-pre-memo-proof.json`. Pärast lohistuse parandust kontrolliti uue EXE käivitust (`output/playwright/m2-1-11/smoke-exe-proof.json`). Aknale sisendi saatmise tõrge takistas selles ehituses töölaua CSV salvestuse kordamist. Kasutaja kinnitas allolevad sammud 2026-11-20.

1. Käivita katse-EXE ja lohista oma plaadi foto avalehele. Kalibreeri `K`-ga teadaolev vahe.
2. Paiguta kaks komponenti. Joonista `T`-ga rada jalast jalani mööda fotol nähtavat rada. Proovi käänupunkte, `Shift`-i 45° nurka, `L`-iga kihi vahetust ja `Esc`-iga katkestamist.
3. Lõpeta teine rada esimese peal. Tekib liitepunkt. Joonista rada, mis ristub teisega ilma lõpetamata selle peal. See ei ühendu.
4. Vali `Shift`+klõpsuga kolm jalga ja vajuta `C`. Tekivad õhujooned. Ülariba „Õhujooned“ peidab need ja toob tagasi.
5. Ava vahekaart „Võrgud“. Anna ühele võrgule nimi ja roll GND, teisele 5V. Rajad ja jalad on rolli värvi. Ühenda need „Ühenda võrguga…“ kaudu ja kontrolli punast hoiatust. Võta ühendamine `Ctrl+Z`-ga tagasi.
6. Vali rada ja lohista käänupunkti. Lohista raja silti. Lohista liitepunkt jalale ja vaata, kas see kinnitub.
7. Paremklõpsa rajal. „Eemalda joonistus“ jätab õhujoone. „Kustuta ühendus“ eemaldab ühenduse. Võta mõlemad `Ctrl+Z`-ga tagasi.
8. Mõõda üks ühendatud ja nimega võrgu jalg ning kustuta selle komponent. Ühenduse otsad muutuvad liitepunktideks, mõõtmine jääb ajalukku ja tuleb teade „Võrgusilt … eemaldati · Ctrl+Z toob tagasi“.
9. Vali raamiga mitu komponenti, pööra `R`-iga ja dubleeri `Ctrl+D`-ga. Mõlemad on üks samm.
10. Vajuta „Ekspordi võrguloend (CSV)“ ja ava fail Excelis. Kontrolli täpitähti, veerge ja ridu.
11. Ava oma `v0.4.0` ajal tehtud projekt ja kontrolli, et andmed on alles.
12. Sule projekt ja ava see järgmisel päeval. Kirjuta arhitektile, mis oli segane või aeglane.
