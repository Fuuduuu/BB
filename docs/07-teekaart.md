# 07 · Teekaart

Iga verstapost lõpeb töötava ja paigaldatava äpiga. Järgmist verstaposti ei alustata enne, kui eelmise „valmis kui“ tingimused on päris äpis läbi proovitud ja kasutuskatse on tehtud ([03 § 12](03-arhitektuur.md#kohustuslikud-invariandid)). Iga verstaposti jaoks tehakse enne ehitust eraldi detailne teostusplaan (`docs/plans/Mx-*.md`, ülesanded koos testidega). Mitme kuu kõigi funktsioonide koodi ja teste ette ei kirjutata.

Järjekord ([ADR-004](adr/ADR-004-kaks-vaadet-ja-uhendused.md)):

| Verstapost | Kasutaja saab |
|---|---|
| M0 | projekti ja ühe komponendi, tagasivõtmise, sulgemise ja taasavamise |
| M1 | foto, komponendid fotol ja esimese mõõtmise |
| M2 | ühendused, võrgud ja muudetava skeemi (neli osa: M2.1–M2.4) |
| M3 | mõõtmise täisvoo ja remondi |
| M4 | ekspordi, impordi, automaatpaigutuse abilise ja v1.0 väljalaske (kolm osa: M4.1–M4.3) |

Kasutamise järjekord (foto → komponendid → skeem → mõõtmine → rajad) ei pea olema sama mis arendamise järjekord: parandaja saab mõõta juba M1-s ja kahe vaate koostöö kontrollitakse M2-s.

## Rollid

Kasutaja otsus 2026-11-07: **Codex ehitab, Claude on arhitekt.**

| Roll | Teeb | Ei tee |
|---|---|---|
| **Arhitekt** (Claude) | hoiab arhitektuuri ja andmemudelit (ADR-id, 03–05) ning dokumentide kooskõla; kirjutab enne iga verstaposti teostusplaani (`docs/plans/Mx-*.md`: ülesanded, failid, liidesed, invariandid, kontrollid, vastuvõtt); vaatab ehitaja iga muudatuse enne commiti üle (kihipiirid, invariandid, testid, plaanist kõrvalekalded) ja annab otsuse **„sobib“** või **„vajab parandust“** koos põhjustega | ei kirjuta rakenduse koodi, kui kasutaja seda eraldi ei palu |
| **Ehitaja** (Codex) | teeb plaani järgi koodi ja testid väikeste terviklike sammudena; jooksutab kontrollid (`pnpm check`, `cargo test`, Tauri suitsutest); kirjutab üleandmise: mis tehtud, millised kontrollid päriselt läbisid, mis jäi pooleli | ei muuda arhitektuuri, andmemudelit ega lepingut omal käel; kõrvalekalle või avastatud probleem tuleb arhitektile ettepanekuna |
| **Kasutaja** | kinnitab ADR-id ja verstapostid, teeb visuaalse vastuvõtu ja kasutuskatse, annab loa commitiks ja pushiks | — |

Töö käik: arhitekti plaan → arhitekti [ülesandekaart](tasks/README.md) → ehitaja samm → ehitaja kontrollid ja üleandmine → arhitekti ülevaatus → parandused → kasutaja loal commit. Kaks AI-d ei kirjuta samal ajal samu faile.

## M0 · Vundament ja esimene komponent

**Olek: valmis ja avaldatud** versioonina `v0.1.0` (2026-11-09). Tõendid: [M0 kaardid](tasks/README.md), CI ja kasutaja suitsukontroll ([STATUS](STATUS.md)).

**Eeltingimused arendusmasinas** (kõik olemas, kontrollitud 2026-11-07; täpsed versioonid on failis `docs/STATUS.md`):
- Node.js LTS ja Corepack koos pnpm-iga;
- Rust (`rustup`, stable, MSVC host) koos `rustfmt`-i ja `clippy`-ga;
- Windowsi C++ Build Tools 2022 ja Windows SDK;
- WebView2 runtime;
- Tauri CLI 2; keskkonnakontroll `pnpm tauri info` läbis.

**Sisu:**
- pnpm monorepo, Vite, React, TS strict, Tauri 2;
- paketid `domain`, `contracts`, `engine`, `client`, `ui`, `adapters` ja sõltuvusreeglid ([03 § 2](03-arhitektuur.md#2-kihid));
- sünkroonne dokumendimootor koos käskude, invariantide kontrolli, tagasivõtmise ja omandikontrolliga (kehtib ka väljalaskes);
- sügavalt külmutatud hetktõmmis koos `sessionId`-ga;
- `ProjectService` ja `SaveCoordinator`: ajastus ja maksimaalne ooteaeg, `base_rev` võrdlus, vaade eraldi, sulgemise voog;
- SQLite projekti fail koos eksklusiivse lukuga, üks äpi eksemplar ja `.pcbk` failiseos;
- täis- ja dokumendikoopiad koos taastamisega, kahetasemeline `ErrorBoundary` ja diagnostika eksport;
- avaleht ja uue plaadi dialoog, disainisüsteemi põhikomponendid, i18n, GitHub Actions CI.

M0 ehitab **ühe päris mooduli**, `components`, läbi kõigi kolme osa: komponent ilma fotota (tähis, tüüp, märgistus, väärtus, jalad), nimetamine, tagasi/uuesti. Näidismoodulit ega teiste moodulite tühje kaustu ei tehta.

**Valmis kui:**
- [x] `pnpm check` on roheline (tsc, eslint, dependency-cruiser, failipikkus, Vitest, Playwright, cargo test).
- [x] CI kukub, kui `features/*/ui` impordib `engine`-it; mootori testid jooksevad Node'is ilma DOM-ita.
- [x] Uus plaat → lisa komponent → nimeta → `Ctrl+Z` / `Ctrl+Y` → sulge → ava viimastest: komponent, nimi ja vaade on alles. Sama UI töötab nii `apps/web` kui ka `apps/desktop` all; erinev on ainult salvestuse adapter.
- [x] Fail `.pcbk` avaneb ka pärast äpi jõuga sulgemist (kirjutamise ajal tapetud protsess).
- [x] Kui projekti fail muutub kirjutuskaitstuks või ketas saab täis, tuleb punane riba. Akna sulgemine ei kaota muudatusi ilma „Sulge salvestamata“ kinnituseta ja „Salvesta mujale…“ loob koopia, kus on samad andmed ([03 § 9](03-arhitektuur.md#salvestuse-vastutaja-savecoordinator-moodul-project)).
- [x] Sama faili teine avamine toob ette olemasoleva akna. Teise protsessi poolt lukustatud fail annab teate „Fail on avatud mujal“ ega riku midagi (kaks päris protsessi).
- [x] `project_save` ei kirjuta, kui failis pole oodatud `base_rev` (`cargo test`). Vana `sessionId`-ga vastus ja sündmus jäetakse kõrvale (mootori test).
- [x] Käsk, mis muudab välja väljaspool oma `owns` ja `alsoWrites` loendit või rikub invarianti, lükatakse tagasi ka väljalaske ehituses. Dokument, ajalugu ja salvestusjärjekord jäävad muutmata.
- [x] Tagasivõtmine suurendab `rev`-i ja salvestus kirjutab taastatud sisu.
- [x] Ainult vaate muutus (M0-s paneelide laius ja avatus ning vahekaart; suum ja kihid lisanduvad lõuendiga M1-s) säilib sulgemisel ilma ühegi dokumendikäsuta. Pidev töö ei lükka salvestamist edasi kauem kui 10 s.
- [x] Täisvarukoopia tekib enne migratsiooni (testmigratsiooniga). Taastamine avalehelt uude faili on läbi proovitud.
- [x] CI ehitab `.msi` paigaldaja.

## M1 · Foto, komponendid ja esimene mõõtmine

M1 jaguneb neljaks osaks. Iga osa võetakse eraldi vastu ja esimene läbiv töövoog ei oota ära kõiki korpusi.

### M1.1 · Komponent fotol ja mõõtmine
_M1.1 töötab virtuaalsel tööpinnal ilma fotota ([03 § 7.1](03-arhitektuur.md#71-koordinaadid)); foto tuleb M1.2-s. Lõuendi stseeniteisendus (`PhotoRef.transform`, M1.1-s identne) ja tekstide vastuteisendus on M1.1-s olemas, et M1.2 ei kirjutaks lõuendit ümber._

**Sisu:**
- 5 põhikorpust: kahejalgne chip (takisti/kondensaator), SOT-23, SOIC-8, TO-220 ja pinnirida;
- plaadipaigutus, paigutus ja liigutamine (eelvaade `SessionStore`'is, mootorisse üks käsk);
- tundmatu komponent alana (`X1`, tüüp „Muu“, jalad käsitsi);
- jalad ja nende olekud, tähis fotol koos lohistatava sildiga;
- **minimaalne mõõtmine**: `Measurement` mudel, `measurements.add`/`remove` ja lihtne Mõõda-plokk:
  - punane ja must sond;
  - pinge, väärtus ja `Enter`;
  - mustand sondipaari kaupa;
  - toite algolek „Teadmata“;
  - `Alt+↓` järgmisele jalale.

**Valmis kui:**
- [ ] **Esimene läbiv töövoog** päris äpis: loo projekt → lisa komponent → vali jalg → salvesta mõõtmine → sulge → ava uuesti. Mõõtmine on alles samal jalal.
- [ ] Jalale kirjutatud, aga salvestamata väärtus ei salvestu teisele jalale minnes (`Alt+↓` või klõps); `Tab` ei muuda Kohta; tagasi tulles on väärtus alles ([03 § 5](03-arhitektuur.md#5-olek-kolm-eraldi-hoidlat)).
- [ ] Musta sondi ei vali äpp kasutaja eest; GND on ainult ühe klõpsuga soovitus.
- [ ] Uue komponendi väärtus ja märgistus on tühjad.
- [ ] Lohistamine `Esc`-iga või `pointercancel`-iga ei jäta dokumenti, ajalukku ega salvestusse jälge.

### M1.2 · Foto ja kalibreerimine
**Sisu:**
- terviklik foto import Rustis (failist ja kleepimisel baitidest, EXIF, kuvamisvariant, `pcbk://photo`);
- nähtavus ja kontrast, pööramine ja peegeldamine kogu stseenile;
- kalibreerimine;
- **varajane jõudlusproov** päris Tauri aknas tiheda sünteetilise plaadiga (sildid, valik, foto);
- **sünteetilise plaadi generaator** (`tooling/fixtures`): ehitab suure dokumendi tavaliste käskudega; seda kasutavad jõudlusproov ning M2–M3 testid;
- foto lohistamine avalehele loob uue plaadi selle fotoga ([02 § 1](02-kasutaja-teekond.md#1-äpi-avamine-avaleht));
- **faili tunnus `meta.file_id`**: varukoopiad seotakse failiga, taastatud fail ja täielik koopia saavad uue tunnuse ([03 § 9](03-arhitektuur.md#9-salvestus-ja-projekti-fail));
- foto ekspordi proov PNG-sse (kuidas fotobaidid frontendini jõuavad) ja otsus, kas töölaua suitsukontrolli viis põhivoogu automatiseeritakse.

**Valmis kui:**
- [ ] Esimene komponent on paigas kõige rohkem 3 tegevusega pärast foto valimist.
- [ ] Portreefoto, millel on EXIF-pööre, on lõuendil ja ekspordis ühtemoodi õigetpidi.
- [ ] Foto pööramine ja peegeldamine ei muuda jalgade asendit foto suhtes (invariantsustest kõigi 8 teisendusega).
- [ ] 48 MP foto avaneb ilma, et kuvatakse üle 12 MP pilti; „Salvesta mujale…“ koopia avaneb koos originaalfotoga.
- [ ] Katkenud foto import ei jäta dokumenti viidet puuduvale fotole.
- [ ] Jõudlusproovi tulemus on kirja pandud: kas SVG kannab välja või kavandatakse jalgadele Canvas-kiht.
- [ ] Taastatud ja algne sama `project_id`-ga fail ei sega teineteise varukoopiaid (eri `file_id`); dokumendikoopia taastub ainult oma faili aluse peale.
- [ ] Foto lohistamine avalehele avab uue plaadi selle fotoga.

### M1.3 · Korpuste teek
**Sisu:** kõik ~40 korpust prototüübist (samad arvud), sh **punktkomponendid** (testpunkt, via, padjand, ava), ja korpuse vahetus koos jalgade vastavusega ([04 › Kustutamise reeglid](04-andmemudel.md#kustutamise-reeglid)). Via on vajalik M2.1 kihireegli jaoks.

**Valmis kui:**
- [ ] SOIC-8 jalg 1 on (−2,775; −1,905) mm ja jalg 8 (2,775; −1,905) mm. QFP-44 jalg 12 on alumisel küljel (ühiktest).
  SOIC-8 x-koordinaadi absoluutväärtus 2,775 mm tuleb prototüübi `gSop` valemist `3,9 / 2 + 1,55 / 2 + 0,05`.
- [ ] SOIC-8 → SOIC-14 vahetus hoiab jalad 1–8 seotuna (sama `uid`); SOIC-14 → SOIC-8 küsib kinnitust ja loetleb kaduvate jalgade mõju; nende jalgade mõõtmised muutuvad ajaloolisteks. SOIC-8 → SOIC-14 tagasi ei aktiveeri vanu mõõtmisi (uus `uid`), aga `Ctrl+Z` aktiveerib.

### M1.4 · Suurus ja joondus
**Sisu:** suuruse muutmine käepidemetega ja numbritega, kahe jala joondus, oma jalad, jõudluseelarve, paremklõpsu kontekstimenüü baas ([06 › Hiir ja puude](06-kasutajaliides.md#hiir-ja-puude)): komponent (pööra, pool, dubleeri, kustuta), jalg (mõõda, nimeta, NC), tühi ala (lisa komponent siia); hilisemad osad lisavad oma kirjed.

**Valmis kui:**
- [ ] [02 § 16](02-kasutaja-teekond.md#16-vastuvõtustsenaarium-e2e-test-plaat-algusest-lõpuni) sammud 1–5 lähevad läbi.
- [ ] Kahe jala joondus taastab teadaoleva asendi täpsusega < 0,01 px ja < 0,01°.
- [ ] Jõudluseelarve on täidetud ([03 § 7.3](03-arhitektuur.md#73-kihid-ja-jõudlus)).
- [ ] Paremklõps komponendil, jalal ja tühjal alal avab menüü, mille kirjed teevad sama, mis klahvid ja tööriistad; `Esc` sulgeb menüü ilma muutuseta.

## M2 · Ühendused, võrgud ja muudetav skeem

M2 jaguneb neljaks osaks. Iga osa võetakse eraldi vastu ja neid ehitatakse järjest: võrgud plaadil, siis mõõtmisest tulenev tase, siis skeemi sümbolid ja paigutus, siis skeemi juhtmed ja sildid.

### M2.1 · Ühendused ja võrgud plaadil
**Sisu:** moodulid `connections` ja `nets`.
- **ühendused ja liitepunktid:**
  - rada fotol kihiga, juhe, kiirühendus ja õhujoon;
  - haru loob liitepunkti, lahtine ots on liitepunkt;
  - „Joonista rada fotol“ olemasolevale ühendusele;
  - „Eemalda joonistus“ vs „Kustuta ühendus“;
  - raja silt (võrgu nimi) koos lohistatava nihkega;
- **võrgud** arvutatakse ainult ühendustest (ilma läheduseta) koos kihireegliga; rollid ja värvid, rollikonflikt, negatiivse läbivuse hoiatus, lühistatud komponendi hoiatus, „Ühenda võrguga…“, võrguloendi eksport;
- paremklõpsu menüü laieneb ühenduse tegevustega (alusta rada jalalt, kustuta ühendus);
- **raamvalik ja mitmikvalik** (`Shift`+klõps), mida kiirühendus vajab ([02](02-kasutaja-teekond.md)).

**Valmis kui:**
- [ ] Kaks ristuvat rada ja raja ots 1 px kaugusel teisest rajast **ei** liitu. Haru tekib ainult liitepunktiga. Mõõtkava muutmine ei muuda ühtegi võrku. Pealmise ja alumise kihi rajad ühinevad ainult läbiva jala kaudu (ühiktestid).
- [ ] Liitepunkti eemaldamine ei jäta võrgusildile katkist ankrut.
- [ ] Kaks eraldi GND-nimega võrku jäävad eraldi; GND + 5V liitmine annab konflikti ja ei kirjuta rolli üle; tagasivõtmine taastab.
- [ ] „Eemalda joonistus“ jätab ühenduse alles (õhujoonena); „Kustuta ühendus“ eemaldab selle; mõlemad on tagasivõetavad.
- [ ] **Jõudlus:** sünteetiline plaat 300 komponendi, 3000 jala ja 1000 rajaga püsib [03 § 7.3](03-arhitektuur.md#73-kihid-ja-jõudlus) eelarves; võrkude arvutus käsu järel on mõõdetud ja kirja pandud.

### M2.2 · Piiksumisrežiim ja ühenduse tase
**Sisu:** piiksumisrežiim moodulis `measurements` (`beep.record`) ja ühenduse tase (`connectionLevels`).
- „Piiksub ja ühenda“ (`Enter`), „Ainult mõõtmine“ (`Shift+Enter`), „Ei piiksu“ (`N`); `Esc` katkestab;
- ühenduse tase arvutatakse mõõtmistest.

**Valmis kui:**
- [ ] Piiksumisrežiimi „Piiksub ja ühenda“ on üks samm: `Ctrl+Z` eemaldab nii mõõtmise kui ka ühenduse. „Ainult mõõtmine“ ei muuda ühendusi. `Esc` ei salvesta midagi. Piiks 10 Ω takisti otste vahel ei liida võrke ilma kinnituseta; kui otsad satuvad siiski samasse võrku, tuleb hoiatus.
- [ ] Mõõdetud A–B ühenduse jagamine haruks jätab A–J ja J–B mõõdetuks.
- [ ] Mõõtmise kustutamine või remondist tulenev aegumine võtab ühenduselt ✓-märgi ära; uus tavaline läbivusmõõtmine samade jalgade vahel taastab selle ([04 › Ühenduse tase](04-andmemudel.md#ühenduse-tase-connectionlevels)).
- [ ] 50 jala kaardistamine piiksumisrežiimis võtab alla 2 minuti **kasutuskatses**.

### M2.3 · Skeemi sümbolid ja paigutus
**Sisu:** moodul `schematic`, esimene pool.
- **algab lõuendi taaskasutuse prooviga:** sama lõuend teise koordinaadistikuga (skeemi ruudustik) ilma lõuendi koodi kopeerimata;
- komponendi lisamine kummaski vaates ja „Plaadile/Skeemile paigutamata“ loendid;
- **sümbolid kõigile `ComponentKind` tüüpidele** (~23: takisti, kondensaator, diood, transistorid, IC-kast jt; sümbol tuleb tüübist, mitte korpusest), käsitsi paigutus ja pööramine, nummerdatud kast tundmatule korpusele, jalgade funktsiooni määramine;
- ühine valik ja „Näita teises vaates“.

**Valmis kui:**
- [ ] Skeemil lisatud takisti paigutatakse hiljem fotole sama id-ga; tähise ümbernimetamine ei muuda ühendusi ega mõõtmisi.
- [ ] Skeem kasutab sama lõuendi baasi ja tabamust nagu plaat (ühiskood, mitte koopia).
- [ ] **Jõudlus:** 300 sümboliga skeem püsib [03 § 7.3](03-arhitektuur.md#73-kihid-ja-jõudlus) eelarves.

### M2.4 · Skeemi juhtmed, sildid ja mõõtmine skeemilt
**Sisu:** moodul `schematic`, teine pool.
- ühendusjooned ja liitepunktid skeemil, võrgusildid, toite- ja maandussümbolid;
- mõõtmine skeemilt.

Tekstimärkused (`textNotes`) ei kuulu M2-sse: neid omab moodul `dimensions` ja need tulevad M4.1-s.

**Valmis kui:**
- [ ] Stsenaariumi sammud 6–9 lähevad läbi (kogu M2: M2.1–M2.4 kokku).
- [ ] Ühes vaates loodud ühendus on teises vaates olemas.
- [ ] „Eemalda joonistus“ jätab ühenduse ja skeemi alles; „Kustuta ühendus“ eemaldab selle mõlemast vaatest; mõlemad on tagasivõetavad.

## M3 · Mõõtmise täisvoog ja remont

**Sisu:** moodulid `measurements` (täiendus) ja `repair` ning logi vahekaart moodulis `project`.
- kiirsisestus kõigis režiimides koos „OL“-iga;
- `parseReading`;
- hindamine mõlema sondi järgi ja tolerantsi seade;
- ajaloolised mõõtmised („kontakt kustutatud“);
- mõõtmiste nimekiri ja filtrid, kahtlaste vaade;
- kahjustatud alad;
- remonditoimingud koos mõjuga (komponent, võrgud, kogu plaat, mitte midagi) ja aegumisega;
- käsupalett `Ctrl+K`: otsing eesti keeles üle kõigi registreeritud käskude ja tööriistade ([01 › põhimõte 7](01-pohimotted.md));
- kiirklahvide abi `?` (sama registri põhjal nagu käsupalett).

**Valmis kui:**
- [ ] Stsenaariumi sammud 10–11 lähevad läbi.
- [ ] Kõik hindamise kontrollväärtused ([04](04-andmemudel.md#mõõtmiste-hindamine)) on testidega kaetud, sh must sond mujal kui GND-l (punane 5V, must 12V → −7 V on OK), dioodi ja „OL“ juhud ning kustutatud kontaktiga mõõtmine.
- [ ] 20 pinget järjest saab mõõta ainult klaviatuuriga (`Alt+↓`, number, `Enter`) ilma hiireta; fookus ja dialoogid on klaviatuuriga kasutatavad (Playwright).
- [ ] Mõõtmise koht, must sond ja sisestatud väärtus ei muutu tööriista, filtri, vahekaardi ega Plaat/Skeem vahetusel. Teisele jalale minnes ei salvestu eelmise jala väärtus uuele jalale (regressioonitest BenchBeepi BB-01, BB-04 ja BB-11 kohta).
- [ ] Rajaparandus valitud võrgule märgib selle võrgu mõõtmised „enne remonti“; komponendita remont nõuab mõju valikut.
- [ ] `Ctrl+K` leiab käsu eestikeelse nime järgi ja käivitab selle; kontekstiklahvid (nt piiksu nupud) ei ilmu paletis, kui konteksti pole.

## M4 · Eksport, import ja väljalase

M4 jaguneb kolmeks osaks; iga osa võetakse eraldi vastu. **v1.0 on M4.3 lõpus.**

### M4.1 · Mõõtjooned, juhend ja automaatpaigutus
**Sisu:**
- moodulid `dimensions` ja `guide`;
- mõõtjooned ja kontuur, valmiduse näitajad ja „Märgi kaardistus valmis“;
- tekstimärkused mõlemas vaates (`textNotes`, `notes.*`) koos mooduliga `dimensions`;
- skeemi **automaatpaigutus abilisena** (ELK-i proov 20–50 komponendiga, ainult paigutamata või valitud sümbolid);
- seadete vaade: teema, varukoopiate asukoht ja kettakulu ([03 § 9](03-arhitektuur.md#9-salvestus-ja-projekti-fail)).

**Valmis kui:**
- [ ] Automaatpaigutus ei liiguta kasutaja paigutatud sümboleid; „Paiguta valik uuesti“ on tagasivõetav.
- [ ] Seadetes on näha varukoopiate asukoht ja nende kettakulu.

### M4.2 · Ekspordid, print ja import
**Sisu:**
- moodul `export`: kõik ekspordid, remondiraport, kaardi ja skeemi printimine;
- uuema äpiga tehtud faili vaatamine kirjutuskaitstult ja eksport ([03 § 9](03-arhitektuur.md#9-salvestus-ja-projekti-fail));
- prototüübi import koos kontrollnimekirjaga („Kontrolli neid ühenduskohti“).

**Valmis kui:**
- [ ] SVG eksport on 1:1 (kontuur 76 mm + 2 × 5 mm varu → `width="86mm"`); kalibreerimata plaadi ekspordil on märge.
- [ ] CSV-d avanevad eestikeelses Excelis õigete veergudega.
- [ ] Oma eksport imporditakse tagasi ka pärast komponentide kustutamist; vigase viitega fail lükatakse tagasi ilma avatud projekti puudutamata.
- [ ] Prototüübi näidisprojekt (`PCB-Kaardistaja.html` → Salvesta) imporditakse koos kontrollnimekirjaga:
  - otsene jalaviide säilib;
  - sama kihi lähedane vaba ots ootab kinnitust;
  - eri kihtide kattumisest läbiviiku ei teki;
  - kasutaja näeb võrgu muutust enne lõpetamist.
- [ ] Uuema vorminguga fail avaneb ainult vaatamiseks ja ekspordiks; sinna midagi ei kirjutata.

### M4.3 · Näidisprojekt, avaleht ja väljalase v1.0
**Sisu:**
- avalehe „Näidisprojekt“: avaneb kirjutuskaitstud koopia näidisplaadist, esimene muudatus pakub „Salvesta oma koopiana“ ([02 § 1](02-kasutaja-teekond.md));
- avalehe kaartidel pisipilt ja edenemisriba;
- paigaldus ja allkirjastamine ([03 § 14](03-arhitektuur.md#14-paigaldus-ja-väljalase)).

**Valmis kui:**
- [ ] Terve [02 § 16](02-kasutaja-teekond.md#16-vastuvõtustsenaarium-e2e-test-plaat-algusest-lõpuni) läheb läbi (e2e `full-flow.spec.ts`).
- [ ] `.msi` paigaldub võrguühenduseta masinasse; `.pcbk` topeltklõps avab äpi; uue versiooni paigaldamine säilitab projektid ja varukoopiad.
- [ ] **v1.0 väljalase:** `.msi` GitHubi Release'is ja kasutaja visuaalne vastuvõtt. Allkirjastamine on kasutaja otsus: kui koodiallkirjastamise sertifikaat on seadistatud, on `.msi` allkirjastatud; muidu on Release'i märge „allkirjastamata“ ja SmartScreeni hoiatus on teada piirang.

## M5 · Foto täiendused ja tahvel

**Sisu:**
- alumise poole foto koos 3–4 punktiga joondusega plaadi tööpinnale (`PhotoRef.toBoard`, afiinne);
- poole vahetus `Tab`-iga koos radadega;
- perspektiivi parandus (4 nurka);
- võrdluspildid komponendile;
- tahvli paigutus (Tauri Android).

**Valmis kui:** sama rada on näha mõlemal fotol õiges kohas; viltu tehtud telefonifoto saab sirgeks ja mõõtkava on pärast parandust ±1 % täpne.

## M6 · AI (eraldi otsusega)

**Sisu:** `AiPort` teostus, nõusoleku ja võtmete haldus, moodulid `ai-assistant` (järgmise sammu soovitus, küsimused projekti kohta), `ai-photo` (komponendikandidaadid kihina) ja `ai-report` (remondikokkuvõte). Kõik muudatused käivad ainult ettepanekutena: lubatud käskude loend, `baseRev` kontroll ja rakendamine ühe sammuna ([03 § 13](03-arhitektuur.md#13-ai-liides-hilisem)).

**Eeltingimus:** M4 on vastu võetud ja kasutaja on teinud eraldi otsuse (privaatsus, teenusepakkuja, hind).

## Hiljem (pole ajastatud)

Mõõteriista otseühendus (seriaal, Bluetooth), KiCadi netlist ja skeemi eksport, andmelehtede otsing, telefoni abirakendus pildistamiseks, mitme plaadi võrdlus (töötav ja vigane plaat), automaatne uuendaja, varundus või sünk (eraldi ADR), mitme joonistuse tugi ühele ühendusele, manused (andmelehe joonis komponendile).
