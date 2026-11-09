# BB / PCB Kaardistaja: teekaart ja kõik tulevased tööd (ülevaatuspakett)

Kuupäev: 2026-11-09. Koostaja: arhitekt (Claude). Ülevaataja: Gemini. See fail on **ainult lugemiseks**: ülevaataja ei muuda ühtegi projekti faili. Fail koondab teekaardi, M1.1 teostusplaani ja kõik teadaolevad avatud tööd, et neid saaks sõltumatult hinnata enne ehituse algust.

## Kontekst lühidalt

- **Toode:** kohalik töölauarakendus elektroonika parandajale (TypeScript + React + Rust/Tauri 2, projekt on üks SQLite-fail `.pcbk`). Foto põhjal komponentide, jalgade ja ühenduste kaardistamine, võrkude rollid, mõõtmised, lõpuks skeem ja remondiraport. Töötab täielikult ilma AI ja internetita.
- **Seis:** M0 (vundament) on valmis ja avaldatud (`v0.1.0`, `main` = `7dacff8`): dokumendimootor käskude/undo/invariantidega, `SaveCoordinator`, SQLite fail eksklusiivse lukuga, avaleht, komponentide moodul, Tauri töölaud, CI ja `.msi`.
- **Rollid:** Claude on arhitekt (plaanid, andmemudel, ülevaatus), Codex ehitaja, kasutaja kinnitab otsused ja visuaalse vastuvõtu.
- **Dokumendid:** `docs/01–08` ja `docs/adr/` on autoriteetsed; `docs/api/*.md` on koodist genereeritud liideste kokkuvõte. Repo: `C:\Users\TRUMPIT\Desktop\BB`, haru `main`.

## Mida ülevaatajalt oodatakse

Anna sõltumatu, kriitiline hinnang vanemprogrammeerija ning tarkvara- ja riistvaraarhitekti vaatenurgast. Ainult tõendatavad probleemid; ära kiida põhjuseta. Vasta eesti keeles.

1. **Teekaart:** kas M1–M6 järjekord ja jaotus on mõistlik? Mis sõltuvus on valesti pidi, mis on liiga suur või liiga hilja? Kas "valmis kui" tingimused on kontrollitavad?
2. **M1.1 plaan:** kas ülesanded on õiges suuruses, kas liidesed on omavahel kooskõlas (tüübid, käsunimed, `Derived.pinReadings`, `items.translate`), kas testid tõestavad tähendust, mis on puudu?
3. **Domeen ja riistvara:** kas mõõtmise mudel, jala identiteet (`uid`), korpuse geomeetria ja mõõtmise hindamine on piisavad päris remonditööks (multimeeter, dioodirežiim, toide sees/väljas, mitmekihilised plaadid, via'd, SMD/THT)? Millised ohutusriskid (laetud kondensaator, võrgupinge, ESD) peaks äpp arvestama?
4. **Jõudlus ja arhitektuur:** eesmärk 300 komponenti / 3000 jalga / 1000 rada; SVG vs Canvas; `validateDocument` täis-Zod igal käsul; Web Worker; foto suurus.
5. **Andmeohutus ja migratsioonid:** mida tuleb arvestada enne, kui `format_version` hakkab muutuma (M1.2 foto, M2 ühendused)?
6. **Avatud tööd ja võlg** (allpool): mis on prioriteedi poolest valesti, mis puudub?

## Väljundi vorm

- Kõigepealt lõplik hinnang 5–8 lausega: kas plaan on ehitamiseks valmis, ja 3 suurimat riski.
- Leiud tabelina raskuse järjekorras: ID, raskus (blokeeriv / oluline / väike), koht (jaotis või ülesande number), probleem ühe lausega, konkreetne stsenaarium, soovitatud parandus, kindlus (KINNITATUD / VÕIMALIK).
- Eraldi lõigud: "Mida ma ei suutnud kontrollida" ja "Mida teeksin teisiti". Kuni 25 leidu, ilma üldnõuanneteta ja kosmeetikata.

---

# A. Avatud tööd ja teadaolev võlg (väljaspool teekaarti)

| # | Töö | Seisund | Märkus |
|---|---|---|---|
| A1 | Kuue AI stardifaili (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `docs/WORKFLOW.md`, `docs/SKILLS.md`, `docs/STATUS.md`) ja `docs/tasks/` commitimine | otsus tegemata | on praegu ainult kohalikus töökaustas |
| A2 | Koodiallkirjastamine (`.msi` on allkirjastamata, SmartScreeni hoiatus) | otsus tegemata | enne laiemat jagamist |
| A3 | `validateDocument` teeb igal käsul/undol täis `BoardDocSchema.parse` | M1 jõudlusmõõtmise järel | eralda `parseDocument(unknown)` ja `checkInvariants(doc)` |
| A4 | `SaveStatus` ei erista `stale_rev`-i (autosave'i riba ütleb „tundmatu viga“) | M1 | vajab lepingu laiendust |
| A5 | `dependsOn` kontroll alates esimesest moodulitevahelisest lepinguimpordist | M1 | märge M0 plaanis |
| A6 | Jala eemaldamisel plaadipaigutuse `customPads`/`padMap` koristus | M1.3/M1.4 | märge M0 plaanis |
| A7 | Salvestatud oleku avamisaja märkus töölauasalvestusega | täpsustamata | |
| A8 | `backup.rs` on 419 rida (hoiatuse piir 400) | väike | |
| A9 | CI: Rusti `target/` pole vahemälus (aeglane); `push` kõigile harudele annab PR-ile kaks jooksu | väike | |
| A10 | Veebi `discard` teeb täieliku taaslaadimise (dokumenteeritud otsus) | muuda alles e2e-tõendiga | |
| A11 | `log_export` kirjutab mis tahes `.txt` tee üle (webview on usaldatud, CSP range) | väike | |

---

# B0. Teekaart etappidena (kokkuvõte)

| Etapp | Mida kasutaja saab | Sõltub | Seis | Peamine risk |
|---|---|---|---|---|
| **M0 Vundament** | projekt → komponent → nimetamine, tagasi/uuesti → sulgemine → taasavamine; töölaud, `.msi`, CI, taastamine | , | **valmis, avaldatud `v0.1.0`** | , |
| **M1.1 Komponent lõuendil + esimene mõõtmine** | 5 korpust lõuendil, jalg, mõõtmine, näit jala juures | M0 | plaan valmis, ehitamata | lõuendi/valiku keerukus, lepingu laiendused (`UiModule`, `Derived`) |
| **M1.2 Foto ja kalibreerimine** | foto import (Rust, EXIF, 48 MP), pööramine/peegeldamine, kalibreerimine, **jõudlusproov** | M1.1 | plaanita | `format_version` ja foto salvestus; SVG vs Canvas otsus |
| **M1.3 Korpuste teek** | ~40 korpust, korpuse vahetus jalgade vastavusega | M1.1 | plaanita | jala `uid` ja ajaloolised mõõtmised vahetusel |
| **M1.4 Suurus ja joondus** | käepidemed, kahe jala joondus, oma jalad, jõudluseelarve | M1.1–M1.3 | plaanita | joonduse täpsus < 0,01 px/° , 300/3000/1000 eelarve |
| **M2 Ühendused, võrgud, skeem** | rajad, haru, võrgud ja rollid, piiksumisrežiim, lihtne muudetav skeem | M1 | plaanita | topoloogia ainult ühendustest; mõõdetud tase ja piiks |
| **M3 Mõõtmise täisvoog ja remont** | kõik režiimid, hindamine, tolerants, ajalugu, kahtlaste vaade, remont ja aegumine | M2 | plaanita | hindamisreeglid ja valehinnangu risk |
| **M4 Eksport, import, väljalase** | ekspordid, raport, printimine, prototüübi import, automaatpaigutus, ~40 sümbolit, allkirjastamine | M3 | plaanita | automaatpaigutus (ELK), import kontrollnimekirjaga |
| **M5 Foto täiendused ja tahvel** | alumine pool, perspektiivi parandus, võrdluspildid, tahvli paigutus | M4 | plaanita | afiinne joondus, Android |
| **M6 AI (eraldi otsus)** | soovitaja, komponendikandidaadid, aruanne | M4 + kasutaja otsus | otsustamata | privaatsus, teenusepakkuja, hind |
| **Hiljem** | mõõteriista otseühendus, KiCadi netlist, andmelehed, mitme plaadi võrdlus, uuendaja, sünk | , | ajastamata | , |

**Kriitiline tee:** M0 → M1.1 → M1.2 (jõudlusproov) → M1.4 (eelarve, SVG/Canvas otsus) → M2 → M3 → M4. M1.3 võib minna M1.2-ga paralleelselt. Iga etapp võetakse vastu eraldi ja esimene läbiv töövoog (M1.1) ei oota kõiki korpusi.

**Etappide piirid, mida ülevaataja peaks eriti vaatama:** kas jõudlusotsus (SVG vs Canvas) on M1.2/M1.4 jaoks piisavalt vara; kas `format_version` tõstmine on enne M1.2 plaanitud; kas M2 on liiga suur (ühendused + võrgud + skeem + piiks korraga).

---

# B1. Teekaart täistekstina (fail `docs/07-teekaart.md`, muutmata kujul)

# 07 · Teekaart

Iga verstapost lõpeb töötava ja paigaldatava äpiga. Järgmist verstaposti ei alustata enne, kui eelmise „valmis kui“ tingimused on päris äpis läbi proovitud ja kasutuskatse on tehtud ([03 § 12](../03-arhitektuur.md#kohustuslikud-invariandid)). Iga verstaposti jaoks tehakse enne ehitust eraldi detailne teostusplaan (`docs/plans/Mx-*.md`, ülesanded koos testidega). Mitme kuu kõigi funktsioonide koodi ja teste ette ei kirjutata.

Järjekord ([ADR-004](../adr/ADR-004-kaks-vaadet-ja-uhendused.md)):

| Verstapost | Kasutaja saab |
|---|---|
| M0 | projekti ja ühe komponendi, tagasivõtmise, sulgemise ja taasavamise |
| M1 | foto, komponendid fotol ja esimese mõõtmise |
| M2 | ühendused, võrgud ja muudetava skeemi |
| M3 | mõõtmise täisvoo ja remondi |
| M4 | ekspordi, impordi, automaatpaigutuse abilise ja v1.0 väljalaske |

Kasutamise järjekord (foto → komponendid → skeem → mõõtmine → rajad) ei pea olema sama mis arendamise järjekord: parandaja saab mõõta juba M1-s ja kahe vaate koostöö kontrollitakse M2-s.

## Rollid

Kasutaja otsus 2026-11-07: **Codex ehitab, Claude on arhitekt.**

| Roll | Teeb | Ei tee |
|---|---|---|
| **Arhitekt** (Claude) | hoiab arhitektuuri ja andmemudelit (ADR-id, 03–05) ning dokumentide kooskõla; kirjutab enne iga verstaposti teostusplaani (`docs/plans/Mx-*.md`: ülesanded, failid, liidesed, invariandid, kontrollid, vastuvõtt); vaatab ehitaja iga muudatuse enne commiti üle (kihipiirid, invariandid, testid, plaanist kõrvalekalded) ja annab otsuse **„sobib“** või **„vajab parandust“** koos põhjustega | ei kirjuta rakenduse koodi, kui kasutaja seda eraldi ei palu |
| **Ehitaja** (Codex) | teeb plaani järgi koodi ja testid väikeste terviklike sammudena; jooksutab kontrollid (`pnpm check`, `cargo test`, Tauri suitsutest); kirjutab üleandmise: mis tehtud, millised kontrollid päriselt läbisid, mis jäi pooleli | ei muuda arhitektuuri, andmemudelit ega lepingut omal käel; kõrvalekalle või avastatud probleem tuleb arhitektile ettepanekuna |
| **Kasutaja** | kinnitab ADR-id ja verstapostid, teeb visuaalse vastuvõtu ja kasutuskatse, annab loa commitiks ja pushiks | — |

Töö käik: arhitekti plaan → ehitaja samm → ehitaja kontrollid ja üleandmine → arhitekti ülevaatus → parandused → kasutaja loal commit. Kaks AI-d ei kirjuta samal ajal samu faile.

## M0 · Vundament ja esimene komponent

**Eeltingimused arendusmasinas** (kõik olemas, kontrollitud 2026-11-07; täpsed versioonid on failis `docs/STATUS.md`):
- Node.js LTS ja Corepack koos pnpm-iga;
- Rust (`rustup`, stable, MSVC host) koos `rustfmt`-i ja `clippy`-ga;
- Windowsi C++ Build Tools 2022 ja Windows SDK;
- WebView2 runtime;
- Tauri CLI 2; keskkonnakontroll `pnpm tauri info` läbis.

**Sisu:**
- pnpm monorepo, Vite, React, TS strict, Tauri 2;
- paketid `domain`, `contracts`, `engine`, `client`, `ui`, `adapters` ja sõltuvusreeglid ([03 § 2](../03-arhitektuur.md#2-kihid));
- sünkroonne dokumendimootor koos käskude, invariantide kontrolli, tagasivõtmise ja omandikontrolliga (kehtib ka väljalaskes);
- sügavalt külmutatud hetktõmmis koos `sessionId`-ga;
- `ProjectService` ja `SaveCoordinator`: ajastus ja maksimaalne ooteaeg, `base_rev` võrdlus, vaade eraldi, sulgemise voog;
- SQLite projekti fail koos eksklusiivse lukuga, üks äpi eksemplar ja `.pcbk` failiseos;
- täis- ja dokumendikoopiad koos taastamisega, kahetasemeline `ErrorBoundary` ja diagnostika eksport;
- avaleht ja uue plaadi dialoog, disainisüsteemi põhikomponendid, i18n, GitHub Actions CI.

M0 ehitab **ühe päris mooduli**, `components`, läbi kõigi kolme osa: komponent ilma fotota (tähis, tüüp, märgistus, väärtus, jalad), nimetamine, tagasi/uuesti. Näidismoodulit ega teiste moodulite tühje kaustu ei tehta.

**Valmis kui:**
- [ ] `pnpm check` on roheline (tsc, eslint, dependency-cruiser, failipikkus, Vitest, Playwright, cargo test).
- [ ] CI kukub, kui `features/*/ui` impordib `engine`-it; mootori testid jooksevad Node'is ilma DOM-ita.
- [ ] Uus plaat → lisa komponent → nimeta → `Ctrl+Z` / `Ctrl+Y` → sulge → ava viimastest: komponent, nimi ja vaade on alles. Sama UI töötab nii `apps/web` kui ka `apps/desktop` all; erinev on ainult salvestuse adapter.
- [ ] Fail `.pcbk` avaneb ka pärast äpi jõuga sulgemist (kirjutamise ajal tapetud protsess).
- [ ] Kui projekti fail muutub kirjutuskaitstuks või ketas saab täis, tuleb punane riba. Akna sulgemine ei kaota muudatusi ilma „Sulge salvestamata“ kinnituseta ja „Salvesta mujale…“ loob koopia, kus on samad andmed ([03 § 9](../03-arhitektuur.md#salvestuse-vastutaja-savecoordinator-moodul-project)).
- [ ] Sama faili teine avamine toob ette olemasoleva akna. Teise protsessi poolt lukustatud fail annab teate „Fail on avatud mujal“ ega riku midagi (kaks päris protsessi).
- [ ] `project_save` ei kirjuta, kui failis pole oodatud `base_rev` (`cargo test`). Vana `sessionId`-ga vastus ja sündmus jäetakse kõrvale (mootori test).
- [ ] Käsk, mis muudab välja väljaspool oma `owns` ja `alsoWrites` loendit või rikub invarianti, lükatakse tagasi ka väljalaske ehituses. Dokument, ajalugu ja salvestusjärjekord jäävad muutmata.
- [ ] Tagasivõtmine suurendab `rev`-i ja salvestus kirjutab taastatud sisu.
- [ ] Ainult vaate muutus (M0-s paneelide laius ja avatus ning vahekaart; suum ja kihid lisanduvad lõuendiga M1-s) säilib sulgemisel ilma ühegi dokumendikäsuta. Pidev töö ei lükka salvestamist edasi kauem kui 10 s.
- [ ] Täisvarukoopia tekib enne migratsiooni (testmigratsiooniga). Taastamine avalehelt uude faili on läbi proovitud.
- [ ] CI ehitab `.msi` paigaldaja.

## M1 · Foto, komponendid ja esimene mõõtmine

M1 jaguneb neljaks osaks. Iga osa võetakse eraldi vastu ja esimene läbiv töövoog ei oota ära kõiki korpusi.

### M1.1 · Komponent fotol ja mõõtmine
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
- [ ] Jalale kirjutatud, aga salvestamata väärtus ei salvestu teisele jalale minnes (`Alt+↓` või klõps); `Tab` ei muuda Kohta; tagasi tulles on väärtus alles ([03 § 5](../03-arhitektuur.md#5-olek-kolm-eraldi-hoidlat)).
- [ ] Musta sondi ei vali äpp kasutaja eest; GND on ainult ühe klõpsuga soovitus.
- [ ] Uue komponendi väärtus ja märgistus on tühjad.
- [ ] Lohistamine `Esc`-iga või `pointercancel`-iga ei jäta dokumenti, ajalukku ega salvestusse jälge.

### M1.2 · Foto ja kalibreerimine
**Sisu:**
- terviklik foto import Rustis (failist ja kleepimisel baitidest, EXIF, kuvamisvariant, `pcbk://photo`);
- nähtavus ja kontrast, pööramine ja peegeldamine kogu stseenile;
- kalibreerimine;
- **varajane jõudlusproov** päris Tauri aknas tiheda sünteetilise plaadiga (sildid, valik, foto).

**Valmis kui:**
- [ ] Esimene komponent on paigas kõige rohkem 3 tegevusega pärast foto valimist.
- [ ] Portreefoto, millel on EXIF-pööre, on lõuendil ja ekspordis ühtemoodi õigetpidi.
- [ ] Foto pööramine ja peegeldamine ei muuda jalgade asendit foto suhtes (invariantsustest kõigi 8 teisendusega).
- [ ] 48 MP foto avaneb ilma, et kuvatakse üle 12 MP pilti; „Salvesta mujale…“ koopia avaneb koos originaalfotoga.
- [ ] Katkenud foto import ei jäta dokumenti viidet puuduvale fotole.
- [ ] Jõudlusproovi tulemus on kirja pandud: kas SVG kannab välja või kavandatakse jalgadele Canvas-kiht.

### M1.3 · Korpuste teek
**Sisu:** kõik ~40 korpust prototüübist (samad arvud) ja korpuse vahetus koos jalgade vastavusega ([04 › Kustutamise reeglid](../04-andmemudel.md#kustutamise-reeglid)).

**Valmis kui:**
- [ ] SOIC-8 jalg 1 on (−2,8; −1,905) mm ja jalg 8 (2,8; −1,905) mm; QFP-44 jalg 12 on alumisel küljel (ühiktest).
- [ ] SOIC-8 → SOIC-14 vahetus hoiab jalad 1–8 seotuna (sama `uid`); SOIC-14 → SOIC-8 küsib kinnitust ja loetleb kaduvate jalgade mõju; nende jalgade mõõtmised muutuvad ajaloolisteks. SOIC-8 → SOIC-14 tagasi ei aktiveeri vanu mõõtmisi (uus `uid`), aga `Ctrl+Z` aktiveerib.

### M1.4 · Suurus ja joondus
**Sisu:** suuruse muutmine käepidemetega ja numbritega, kahe jala joondus, oma jalad, jõudluseelarve.

**Valmis kui:**
- [ ] [02 § 16](../02-kasutaja-teekond.md#16-vastuvõtustsenaarium-e2e-test-plaat-algusest-lõpuni) sammud 1–5 lähevad läbi.
- [ ] Kahe jala joondus taastab teadaoleva asendi täpsusega < 0,01 px ja < 0,01°.
- [ ] Jõudluseelarve on täidetud ([03 § 7.3](../03-arhitektuur.md#73-kihid-ja-jõudlus)).

## M2 · Ühendused, võrgud ja muudetav skeem

**Sisu:**
- moodulid `connections`, `nets` ja `schematic` ning piiksumisrežiim moodulis `measurements` (`beep.record`);
- **ühendused ja liitepunktid:**
  - rada fotol kihiga, juhe, kiirühendus ja õhujoon;
  - haru loob liitepunkti, lahtine ots on liitepunkt;
  - „Joonista rada fotol“ olemasolevale ühendusele;
  - „Eemalda joonistus“ vs „Kustuta ühendus“;
  - raja silt (võrgu nimi) koos lohistatava nihkega;
- **võrgud** arvutatakse ainult ühendustest (ilma läheduseta) koos kihireegliga; rollid ja värvid, rollikonflikt, negatiivse läbivuse hoiatus, lühistatud komponendi hoiatus, „Ühenda võrguga…“, võrguloendi eksport;
- **lihtne muudetav skeem:**
  - komponendi lisamine kummaski vaates ja „Plaadile/Skeemile paigutamata“ loendid;
  - käsitsi sümbolite paigutus ja pööramine, nummerdatud kast tundmatule korpusele, jalgade funktsiooni määramine;
  - ühendusjooned ja liitepunktid skeemil, võrgusildid, toite- ja maandussümbolid, tekstimärkused;
  - ühine valik ja „Näita teises vaates“;
  - mõõtmine skeemilt;
- **piiksumisrežiim:** „Piiksub ja ühenda“ (`Enter`), „Ainult mõõtmine“ (`Shift+Enter`), „Ei piiksu“ (`N`); `Esc` katkestab. Ühenduse tase arvutatakse mõõtmistest.

**Valmis kui:**
- [ ] Stsenaariumi sammud 6–9 lähevad läbi.
- [ ] Skeemil lisatud takisti paigutatakse hiljem fotole sama id-ga; ühes vaates loodud ühendus on teises vaates olemas; tähise ümbernimetamine ei muuda ühendusi ega mõõtmisi.
- [ ] Kaks ristuvat rada ja raja ots 1 px kaugusel teisest rajast **ei** liitu. Haru tekib ainult liitepunktiga. Mõõtkava muutmine ei muuda ühtegi võrku. Pealmise ja alumise kihi rajad ühinevad ainult läbiva jala kaudu (ühiktestid).
- [ ] Mõõdetud A–B ühenduse jagamine haruks jätab A–J ja J–B mõõdetuks. Liitepunkti eemaldamine ei jäta võrgusildile katkist ankrut.
- [ ] Kaks eraldi GND-nimega võrku jäävad eraldi; GND + 5V liitmine annab konflikti ja ei kirjuta rolli üle; tagasivõtmine taastab.
- [ ] „Eemalda joonistus“ jätab ühenduse ja skeemi alles; „Kustuta ühendus“ eemaldab selle mõlemast vaatest; mõlemad on tagasivõetavad.
- [ ] Piiksumisrežiimi „Piiksub ja ühenda“ on üks samm: `Ctrl+Z` eemaldab nii mõõtmise kui ka ühenduse. „Ainult mõõtmine“ ei muuda ühendusi. `Esc` ei salvesta midagi. Piiks 10 Ω takisti otste vahel ei liida võrke ilma kinnituseta; kui otsad satuvad siiski samasse võrku, tuleb hoiatus.
- [ ] Mõõtmise kustutamine või remondist tulenev aegumine võtab ühenduselt ✓-märgi ära; uus tavaline läbivusmõõtmine samade jalgade vahel taastab selle ([04 › Ühenduse tase](../04-andmemudel.md#ühenduse-tase-connectionlevels)).
- [ ] 50 jala kaardistamine piiksumisrežiimis võtab alla 2 minuti **kasutuskatses**.

## M3 · Mõõtmise täisvoog ja remont

**Sisu:** moodulid `measurements` (täiendus) ja `repair` ning logi vahekaart moodulis `project`.
- kiirsisestus kõigis režiimides koos „OL“-iga;
- `parseReading`;
- hindamine mõlema sondi järgi ja tolerantsi seade;
- ajaloolised mõõtmised („kontakt kustutatud“);
- mõõtmiste nimekiri ja filtrid, kahtlaste vaade;
- kahjustatud alad;
- remonditoimingud koos mõjuga (komponent, võrgud, kogu plaat, mitte midagi) ja aegumisega.

**Valmis kui:**
- [ ] Stsenaariumi sammud 10–11 lähevad läbi.
- [ ] Kõik hindamise kontrollväärtused ([04](../04-andmemudel.md#mõõtmiste-hindamine)) on testidega kaetud, sh must sond mujal kui GND-l (punane 5V, must 12V → −7 V on OK), dioodi ja „OL“ juhud ning kustutatud kontaktiga mõõtmine.
- [ ] 20 pinget järjest saab mõõta ainult klaviatuuriga (`Alt+↓`, number, `Enter`) ilma hiireta; fookus ja dialoogid on klaviatuuriga kasutatavad (Playwright).
- [ ] Mõõtmise koht, must sond ja sisestatud väärtus ei muutu tööriista, filtri, vahekaardi ega Plaat/Skeem vahetusel. Teisele jalale minnes ei salvestu eelmise jala väärtus uuele jalale (regressioonitest BenchBeepi BB-01, BB-04 ja BB-11 kohta).
- [ ] Rajaparandus valitud võrgule märgib selle võrgu mõõtmised „enne remonti“; komponendita remont nõuab mõju valikut.

## M4 · Eksport, import ja väljalase

**Sisu:**
- moodulid `dimensions`, `guide` ja `export`;
- skeemi **automaatpaigutus abilisena** (ELK-i proov 20–50 komponendiga, ainult paigutamata või valitud sümbolid);
- mõõtjooned ja kontuur, valmiduse näitajad ja „Märgi kaardistus valmis“;
- kõik ekspordid, remondiraport, kaardi ja skeemi printimine;
- prototüübi import koos kontrollnimekirjaga („Kontrolli neid ühenduskohti“);
- ~40 korpusest täielik teek koos sümbolitega;
- paigaldus ja allkirjastamine ([03 § 14](../03-arhitektuur.md#14-paigaldus-ja-väljalase)).

**Valmis kui:**
- [ ] Terve [02 § 16](../02-kasutaja-teekond.md#16-vastuvõtustsenaarium-e2e-test-plaat-algusest-lõpuni) läheb läbi (e2e `full-flow.spec.ts`).
- [ ] Automaatpaigutus ei liiguta kasutaja paigutatud sümboleid; „Paiguta valik uuesti“ on tagasivõetav.
- [ ] SVG eksport on 1:1 (kontuur 76 mm + 2 × 5 mm varu → `width="86mm"`); kalibreerimata plaadi ekspordil on märge.
- [ ] CSV-d avanevad eestikeelses Excelis õigete veergudega.
- [ ] Oma eksport imporditakse tagasi ka pärast komponentide kustutamist; vigase viitega fail lükatakse tagasi ilma avatud projekti puudutamata.
- [ ] Prototüübi näidisprojekt (`PCB-Kaardistaja.html` → Salvesta) imporditakse koos kontrollnimekirjaga:
  - otsene jalaviide säilib;
  - sama kihi lähedane vaba ots ootab kinnitust;
  - eri kihtide kattumisest läbiviiku ei teki;
  - kasutaja näeb võrgu muutust enne lõpetamist.
- [ ] `.msi` paigaldub võrguühenduseta masinasse; `.pcbk` topeltklõps avab äpi; uue versiooni paigaldamine säilitab projektid ja varukoopiad.
- [ ] **v1.0 väljalase:** allkirjastatud `.msi` GitHubi Release'is ja kasutaja visuaalne vastuvõtt.

## M5 · Foto täiendused ja tahvel

**Sisu:**
- alumise poole foto koos 3–4 punktiga joondusega plaadi tööpinnale (`PhotoRef.toBoard`, afiinne);
- poole vahetus `Tab`-iga koos radadega;
- perspektiivi parandus (4 nurka);
- võrdluspildid komponendile;
- tahvli paigutus (Tauri Android).

**Valmis kui:** sama rada on näha mõlemal fotol õiges kohas; viltu tehtud telefonifoto saab sirgeks ja mõõtkava on pärast parandust ±1 % täpne.

## M6 · AI (eraldi otsusega)

**Sisu:** `AiPort` teostus, nõusoleku ja võtmete haldus, moodulid `ai-assistant` (järgmise sammu soovitus, küsimused projekti kohta), `ai-photo` (komponendikandidaadid kihina) ja `ai-report` (remondikokkuvõte). Kõik muudatused käivad ainult ettepanekutena: lubatud käskude loend, `baseRev` kontroll ja rakendamine ühe sammuna ([03 § 13](../03-arhitektuur.md#13-ai-liides-hilisem)).

**Eeltingimus:** M4 on vastu võetud ja kasutaja on teinud eraldi otsuse (privaatsus, teenusepakkuja, hind).

## Hiljem (pole ajastatud)

Mõõteriista otseühendus (seriaal, Bluetooth), KiCadi netlist ja skeemi eksport, andmelehtede otsing, telefoni abirakendus pildistamiseks, mitme plaadi võrdlus (töötav ja vigane plaat), automaatne uuendaja, varundus või sünk (eraldi ADR), mitme joonistuse tugi ühele ühendusele.


---

# C. M1.1 teostusplaan (fail `docs/plans/M1-1-louend-ja-mootmine.md`, muutmata kujul)

# M1.1 · Komponent lõuendil ja esimene mõõtmine: teostusplaan

> **Ehitajale (Codex):** täida see plaan ülesande kaupa oskusega `superpowers:executing-plans`. Sammud on märkeruutudega. Iga ülesande jaoks kirjutab arhitekt vahetult enne algust [snaipriülesande kaardi](../tasks/README.md) `docs/tasks/M1-1-<n>.md`; kaart on töö ühik ja see plaan on ülevaade. Järgmist ülesannet alusta alles pärast arhitekti „sobib“. Kus plaan jätab valiku lahti, tee mõistlik valik ja kirjuta see üleandmisse.

**Eesmärk:** M1.1 [valmis kui](../07-teekaart.md#m11--komponent-fotol-ja-mõõtmine): päris äpis loo projekt → lisa komponent lõuendile → vali jalg → salvesta mõõtmine → sulge → ava uuesti, mõõtmine on samal jalal alles.

**Arhitektuur:** komponent saab plaadipaigutuse (korpus mm-des → tööpinna pikslid, [03 § 7.1](../03-arhitektuur.md#71-koordinaadid)). Lõuend on `packages/ui` baasvõimekus (valik, liigutamine, vaade); komponendi ja mõõtmise kihid, tööriistad ja sektsioonid tulevad moodulitelt `components` ja `measurements`. Eelvaade ja mõõtmise mustand elavad `SessionStore`'is ([03 § 5](../03-arhitektuur.md#5-olek-kolm-eraldi-hoidlat)), mootorisse läheb üks käsk hiire vabastamisel või `Enter`-iga.

**Tehnoloogia:** M0 pinu; uut sõltuvust ei lisata (SVG, Zustand, Immer, zod olemas).

**Spetsifikatsioon:** [03](../03-arhitektuur.md) § 4, 5, 7; [04](../04-andmemudel.md) (Komponent, Pin, BoardPlacement, Measurement, Mõõtmise kontaktid, Väärtuse lugemine); [05](../05-moodulid.md) (components, measurements); [06](../06-kasutajaliides.md) (Jalad, Komponendid, Klaviatuur, Hiir, Tühjad olekud); [07 › M1.1](../07-teekaart.md#m11--komponent-fotol-ja-mõõtmine). Vastuolu korral kehtivad dokumendid ja ehitaja küsib arhitektilt.

**Selle plaani piir:** M1.2 (foto), M1.3 (kõik ~40 korpust, korpuse vahetus), M1.4 (suurus, joondus, oma jalad) saavad **eraldi plaanid** pärast M1.1 vastuvõttu. Võrke, hinnanguid (`evaluate`), ühendusi ja rolle (M2) siin ei ole.

## Arhitekti otsused ja lepingu muudatused

Need on kehtivad; ehitaja uuendab vastavad dokumendid samas ülesandes, kus koodi muudab.

1. **Foto puudub M1.1-s.** Lõuend kasutab virtuaalset tööpinda 2000 × 1400 px, 10 px/mm ([03 § 7.1](../03-arhitektuur.md#71-koordinaadid)). Foto lisandub M1.2-s ega skaleeri olemasolevaid komponente.
2. **`components.add` saab valikulise `board`-i:** komponent loodakse koos paigutusega ühe käsuna (05: „sama käsk, ainult paigutusega“). Jalad tulevad korpuse padjanditest; kutsuja annab `uid`-id. Olemasolev kutse ilma `board`-ita (M0 dialoog) jääb samaks.
3. **Uued komponendikäsud:** `components.placeOnBoard`, `components.removeFromBoard`, `components.rotate`, `components.flipSide`, `components.setLabelOffset`. Üldkäsk `items.translate` elab mootori tuumas (`packages/engine`, nagu `items.delete`) ja liigutab M1.1-s ainult komponente.
4. **Uus moodul `measurements`** (mootor + UI): käsud `measurements.add` ja `measurements.remove`; `owns: ['measurements']`, `dependsOn: ['components']`. `measurements.update`, hinnangud, tolerants ja piiks tulevad M2-s.
5. **`Derived.pinReadings`** (`@pcbk/contracts`): jala `uid` → viimane kehtiv näit. Arvutab mootor (`derive`), UI ei arvuta ise.
6. **UI laiendus:** `UiModule` saab `canvasLayers?: LayerSpec[]` ja `tools?: ToolSpec[]` ([03 § 7.2–7.3](../03-arhitektuur.md#72-tööriistad)). Valik, liigutamine ja vaate nihutamine on lõuendi baas (`packages/ui/src/canvas`), mitte moodul.
7. **Must sond.** Äpp ei vali seda kunagi kasutaja eest. Ilma võrkudeta (M2) pole „GND soovitust“ millest arvutada, seega M1.1 `MeasureBlock` võtab `suggestions: PinRef[]` propi, mis on praegu tühi; M2 täidab selle. Test kontrollib, et soovitus ei salvestu ilma klõpsuta.
8. **`Alt+↓` / `Alt+↑`** liiguvad **sama komponendi** jalgade vahel jala järjekorras ega mähi otsi kokku.

## Globaalsed piirangud

Kehtivad kõik [M0 globaalsed piirangud](../plans/M0-vundament.md#globaalsed-piirangud) (strict TS, failipikkus 400/600, sõltuvusreeglid, id-d kutsuja loodud, tekstid ainult `et.ts`, numbrid kümnendkomaga, kohalik aeg `HH:MM`). Lisaks:

- `features/*/ui` ei impordi `engine`-it; mõõtmise ja paigutuse arvutused on `@pcbk/domain` puhtad funktsioonid.
- Kõik joonistatavad pikslid tulevad `pxPerMm`-st (v1: 10). Hardcoded 10 on viga.
- Jalg on ekraanil vähemalt 10 px läbimõõduga, number alates raadiusest 7 px, nimi alates 14 px ([06 › Jalad](../06-kasutajaliides.md#jalad)).
- Lohistamine algab 3 px liikumise järel; haaramise koht jääb kursori alla.
- Sisestusväljas ei käivitu ükski lõuendi täheklahv.

## Ülevaatuse fookus

Need viis olukorda on spetsifikatsiooniga kaudselt nõutud, kuid muidu ühegi ülesande testis ei esineks. Igaüks on lisatud vastava ülesande testidesse.

1. **Pööratud ja alumise poole komponent:** jalgade asukohad järgivad järjekorda skaleeri → peegelda (alumine pool) → pööra → `·pxPerMm` → `+center` (Ül. 2, `pad_to_board_applies_scale_mirror_rotation_in_order`; Ül. 6 hiireklõps pööratud komponendi jalal valib selle jala).
2. **Kaks jalga ühe haardraadiuse sees** (SOT-23, 0402): klõps valib kursorile lähima, mitte esimese (Ül. 6, `nearest_pin_wins_inside_hit_radius`).
3. **Lohistamise katkestus:** `Esc`, `pointercancel`, tööriista vahetus ja projekti vahetus jätavad dokumenti, ajalugu ja salvestust puutumata, ka siis kui eelvaade on juba liikunud (Ül. 6, `cancelled_drag_leaves_no_trace`).
4. **Näidu sisestus:** `4,98`, `4.98`, `4k7`, `10 kΩ`, `OL` (suur-/väiketäht, ainult takistuses/dioodis), tühi, `abc`, `1,2,3`; vigane sisend ei salvestu ja näitab põhjust (Ül. 3 ja 9).
5. **Jalg või komponent kustutatakse mustandi ajal:** mustand jääb alles koos selgitusega, aga seda ei saa salvestada enne uue Koha valikut; olemasolev mõõtmine jääb ajaloolisena alles (Ül. 5 ja 9).

## Failide struktuur (muutub / lisandub)

```
packages/domain/src/footprints/     index.ts  chip.ts  sot23.ts  soic.ts  to220.ts  header.ts  area.ts  footprints.test.ts
packages/domain/src/geometry/       board.ts (padToBoard, boardPads, bodyOutline)  board.test.ts
packages/domain/src/measure/        reading.ts (parseReading, formatReading)  pin-readings.ts  *.test.ts
packages/contracts/src/             snapshot.ts (Derived.pinReadings)
packages/engine/src/                items.ts (items.translate)
packages/features/components/       contract.ts (+params, COMPONENT_LIBRARY)  engine/commands.ts (+5 käsku)
                                    ui/layers/ComponentsLayer.tsx  ui/layers/PinMarker.tsx  ui/Library.tsx  ui/PlaceTool.ts
                                    ui/PlacedList.tsx  ui/PlacementSection.tsx
packages/features/measurements/     contract.ts  engine/index.ts  engine/commands.ts  engine/derive.ts
                                    ui/MeasureBlock.tsx  ui/MeasurementList.tsx  ui/layers/ReadingLabels.tsx  ui/index.tsx
packages/ui/src/canvas/             Canvas.tsx  stage.ts  tools.ts  SelectTool.ts  PanTool.ts  hit-index.ts  index.ts
packages/ui/src/shell/              session-store.ts (+preview, measureDrafts)  UiRegistry.ts (+canvasLayers, tools)  i18n/et.ts
apps/web/src/engine.features.ts  ui.features.ts  apps/desktop/src/engine.features.ts  ui.features.ts  (+measurements)
apps/web/e2e/m1-1.spec.ts
```

---

## Osa A · Domeen ja mootor (Node, ilma DOM-ita)

### Ülesanne 1: Korpuste generaatorid (`@pcbk/domain`)

**Liidesed (Produces):**
```ts
export interface PadGeom { id: string; x: number; y: number; w: number; h: number; shape: 'rect' | 'circle'; through: boolean }
export interface FootprintGeom { pads: PadGeom[]; body: { w: number; h: number; pin1?: Vec2 } } // mm, päritolu keskel
export interface FootprintParams { [k: string]: string | number }
export interface FootprintDef { key: string; name: string; defaults: FootprintParams; gen(p: FootprintParams): FootprintGeom | undefined }
export const FOOTPRINTS: readonly FootprintDef[];                 // võtmed: 'chip', 'sot23', 'soic', 'to220', 'header1', 'area'
export function footprintGeometry(key: string, params: FootprintParams): FootprintGeom | undefined;
export function footprintPinIds(key: string, params: FootprintParams): string[] | undefined;  // padjandite id-d järjekorras
```
Generaatorite arvud porditakse **samade väärtustega** failist `prototype/src/js/01-footprints.js` (`gChip`, `gSot23`, `gSop`, `gTo220`, `gHdr1`); `area` on alumine ruut `w × h` mm ilma padjanditeta (tundmatu komponent). Padjandi `id` on jala id (`"1"`, `"2"`…).

- [ ] **Samm 1:** kirjuta testid: `soic8_pin1_and_pin8_positions` (jalg 1 `(−2,8; −1,905)`, jalg 8 `(2,8; −1,905)` mm), `soic_14_has_14_pads_numbered_1_to_14`, `chip_0805_has_two_pads_symmetric_about_origin`, `sot23_3_5_6_pin_counts`, `to220_has_three_pads`, `header1_pitch_254_places_pads_every_2_54_mm`, `area_has_no_pads`, `unknown_footprint_or_invalid_params_returns_undefined`.
- [ ] **Samm 2:** testid kukuvad (RED). **Samm 3:** implementeeri generaatorid ja register. **Samm 4:** testid läbivad; `pnpm check`.
- [ ] **Samm 5:** commit `feat(domain): five footprint generators for M1.1`.

### Ülesanne 2: Plaadi geomeetria (`@pcbk/domain/geometry`)

**Consumes:** `BoardPlacement`, `PadGeom`. **Produces:**
```ts
export function padToBoard(p: Pick<BoardPlacement, 'center' | 'rotationDeg' | 'side' | 'scaleX' | 'scaleY'>, local: Vec2, pxPerMm: number): Vec2;
export function boardPads(placement: BoardPlacement, pinIds: readonly string[], pxPerMm: number): { pinId: string; at: Vec2; radiusPx: number }[];
export function bodyOutline(placement: BoardPlacement, pxPerMm: number): Vec2[];   // 4 nurka tööpinnal
```
Järjekord on [03 § 7.1](../03-arhitektuur.md#71-koordinaadid) järgi: `(x·scaleX, y·scaleY)` → peegel (`x := −x`, kui `side = 'bottom'`) → pööre päripäeva, y alla → `·pxPerMm` → `+center`. Padjandi → jala vastavus on `padMap?.[padId] ?? padId`. Kohandatud padjandid (`customPads`) loetakse samamoodi.

- [ ] **Samm 1:** testid: `pad_to_board_applies_scale_mirror_rotation_in_order` (nt `(1;0)` mm, `rot 90`, `top` → `(center.x, center.y+10)`; `bottom` peegeldab enne pööret), `rotation_wraps_and_is_clockwise_with_y_down`, `pad_map_redirects_pad_to_pin`, `body_outline_respects_scale`.
- [ ] **Samm 2–4:** RED → implementeeri → GREEN. **Samm 5:** commit `feat(domain): board placement geometry`.

### Ülesanne 3: Näidu lugemine (`@pcbk/domain/measure`)

**Produces:**
```ts
export type Reading = { value: number; overload?: false } | { overload: true };
export function parseReading(text: string, mode: Measurement['mode']): Reading | null;
export function formatReading(m: Pick<Measurement, 'mode' | 'value' | 'overload'>): string;  // '4,98 V', '10 kΩ', 'OL'
export function pinReadings(doc: BoardDoc): Record<string, PinReading>;   // uid → viimane kehtiv näit
export interface PinReading { measurementId: string; mode: Measurement['mode']; value?: number; overload?: boolean; takenAt: string }
```
`parseReading` järgib [04 › Väärtuse lugemine](../04-andmemudel.md#mõõtmiste-hindamine): koma = punkt, tühikud eemaldatakse, sufiksid `m`, `k`, `M`, kuju `4k7`, ühik lõpus; `OL` ainult `resistance` ja `diode` puhul. `pinReadings` võtab jala jaoks viimase (`takenAt`) mõõtmise, kus jalg on `at` (või `resistance`/`diode` puhul ka `ref`), ja jätab välja `staleByRepairId`-ga ning ajaloolised (kontakt puudub või `uid` erineb).

- [ ] **Samm 1:** testid: `parse_reading_accepts_comma_and_dot` (`4,98` = `4.98`), `parse_reading_si_suffixes` (`4k7` = 4700, `10 kΩ` = 10000, `3m3` = 0,0033), `ol_only_in_resistance_and_diode`, `invalid_returns_null` (`''`, `abc`, `1,2,3`), `format_reading_uses_decimal_comma`, `pin_readings_picks_latest_active`, `pin_readings_skips_historical_and_stale`, `same_number_new_pin_does_not_inherit_old_reading` (uus `uid`).
- [ ] **Samm 2–4:** RED → GREEN. **Samm 5:** commit `feat(domain): reading parser and pin readings`.

### Ülesanne 4: Komponendikäsud paigutusele ja `items.translate`

**Files:** `packages/features/components/{contract.ts,engine/commands.ts}`, `packages/engine/src/items.ts`; **Consumes:** Ül. 1–2.

**Produces (`contract.ts`):**
```ts
export const COMPONENT_LIBRARY: readonly LibraryEntry[];   // Takisti SMD, Kondensaator SMD, SOT-23 (3/5/6), SOIC (8–28), TO-220, Pinnirida 1×N, Tundmatu komponent
export interface LibraryEntry { id: string; name: string; kind: ComponentKind; prefix: string; footprint: string; params: FootprintParams; kw: string }
export type BoardInput = { footprint: string; params?: FootprintParams; center: Vec2; rotationDeg?: number; side?: Side };
export type AddComponentParams = /* olemasolev */ & { board?: BoardInput };
export function makePlacedComponent(ids: IdGen, entry: LibraryEntry, params: FootprintParams, center: Vec2): AddComponentParams;
// uued käsud (zod-skeemid ja tüübid kontrakti failis):
// components.placeOnBoard { id: string; board: BoardInput }          // ainult siis, kui komponendil pole paigutust
// components.removeFromBoard { id: string }
// components.rotate { id: string; deltaDeg: number }                  // tulemus 0 ≤ deg < 360
// components.flipSide { id: string }
// components.setLabelOffset { id: string; offset: Vec2 | null }
// items.translate { items: { kind: 'component'; id: string }[]; dx: number; dy: number }  // tööpinna px
```
**Reeglid:** `components.add` koos `board`-iga nõuab, et `pins` id-d (järjekorras) võrduksid `footprintPinIds`-ga, muidu tagasilükkamine (`footprint_pins_mismatch`, sama veatüüp nagu olemasolev `add`); `placeOnBoard` kontrollib sama olemasolevate jalgade vastu. Uus paigutus: `scaleX = scaleY = 1`, `customPads = {}`. `items.translate` ilma paigutuseta komponendil lükatakse tagasi. Kõik käsud on üks samm ajaloos; no-op (`dx = dy = 0`) ei lisa sammu.

- [ ] **Samm 1:** testid (`packages/features/components/components.test.ts` + engine test): `add_with_board_creates_pins_from_footprint`, `add_with_board_rejects_pin_mismatch`, `place_on_board_requires_matching_pins`, `place_on_board_rejects_already_placed`, `remove_from_board_keeps_component_and_pins`, `rotate_normalizes_to_0_360`, `flip_side_toggles_top_bottom`, `translate_moves_center_in_one_history_step`, `translate_zero_is_noop_without_history_entry`, `translate_rejects_unplaced_component`, `undo_restores_exact_center`, `derived_unplaced_board_updates` (olemasolev derive).
- [ ] **Samm 2–4:** RED → implementeeri → GREEN. **Samm 5:** uuenda `docs/api/*.md` (`pnpm api`) ja [05](../05-moodulid.md) käskude loend, kui erineb. Commit `feat(components): board placement commands and items.translate`.

### Ülesanne 5: Moodul `measurements` (mootor)

**Files:** `packages/features/measurements/{contract.ts,engine/*}`, `packages/contracts/src/snapshot.ts`, registreerimine `apps/*/src/engine.features.ts`.

**Produces:**
```ts
// contract.ts
export type AddMeasurementParams = { id: string; mode: Measurement['mode']; at: MeasuredPin; ref?: MeasuredPin; value?: number; overload?: boolean; power: 'on' | 'off' | 'unknown'; takenAt: string; note?: string };
export type RemoveMeasurementParams = { id: string };
// Derived (contracts):  pinReadings: Record<string, PinReading>   // Ül. 3 tüüp
```
`measurements.add` kontrollib: `at` (ja `ref`) viitab olemasolevale jalale **sama `uid`-ga**; `ref ≠ at`; `value` on kohustuslik, kui `overload` puudub; `overload` ainult `resistance`/`diode`; `takenAt` on ISO UTC. `atLabel`/`refLabel` arvutab käsk (`"<ref>.<pinId>"`); `source: 'manual'`. `derive` kutsub `pinReadings(doc)`.

- [ ] **Samm 1:** testid: `add_rejects_unknown_pin_or_wrong_uid`, `add_rejects_same_probe_twice`, `add_requires_value_unless_overload`, `add_stores_labels_at_save_time`, `labels_survive_component_rename_and_delete` (silt jääb, mõõtmine muutub ajaloolisena `pinReadings`-ist välja), `remove_is_undoable`, `pin_readings_derived_after_add`, `ownership_blocks_other_modules_from_writing_measurements`.
- [ ] **Samm 2–4:** RED → GREEN. **Samm 5:** commit `feat(measurements): add/remove commands and pin readings`.

---

## Osa B · Lõuend ja kasutajaliides

### Ülesanne 6: Lõuendi baas, valik ja liigutamine (`packages/ui/src/canvas`)

**Produces:**
```ts
// tools.ts (03 § 7.2)
export interface CanvasPointer { world: Vec2; screen: Vec2; hit?: HitItem; shift: boolean; alt: boolean; ctrl: boolean }
export interface CanvasTool { id: string; cursor: string; onPointerDown(e: CanvasPointer, api: ToolApi): void; onPointerMove(e: CanvasPointer, api: ToolApi): void;
  onPointerUp(e: CanvasPointer, api: ToolApi): void; onKey?(e: KeyboardEvent, api: ToolApi): boolean; overlay?(api: ToolApi): JSX.Element | null; onCancel?(api: ToolApi): void }
export interface ToolApi { execute: DocumentEngine['execute']; select(sel: Selection): void; setPreview(p: Preview | null): void; hitIndex: HitIndex; snapshot(): Snapshot }
export type LayerSpec = { id: string; z: number; render(props: { snapshot: Snapshot; preview: Preview | null; zoom: number }): ReactNode };
// hit-index.ts
export interface HitItem { kind: 'pin' | 'component'; id: string; componentId: string; at: Vec2; radiusPx: number; pinId?: string }
export function createHitIndex(items: HitItem[], cellPx?: number /* 32 */): { query(world: Vec2, zoom: number): HitItem | undefined };
// session-store.ts (lisandub)
export type Preview = { kind: 'translate'; ids: string[]; dx: number; dy: number };
// state: preview, setPreview, measureDrafts, lastMode, lastPower, blackProbe (Ül. 9)
```
`Canvas` rendab ühe `<svg>`, ühe `<g transform>` (suum/nihe imperatiivselt `ViewStore` kaudu, mitte Reacti renderiga), kihid `z` järjekorras ja ühe osutikuulari juurel `setPointerCapture`-iga. Ekraan → maailm: `getScreenCTM().inverse()`. Pan: keskmine nupp ja tühik + lohista; suum: rullik kursori ümber. **Vali (`V`)**: klõps valib komponendi või jala (`HitIndex`: jala tabamusala `max(raadius, 6 px)`, lähim võidab), tühi klõps tühjendab valiku; lohistamine alates 3 px liigutab valitud komponendi **eelvaatena** ja hiire vabastamisel läheb üks `items.translate`. **Liiguta vaadet (`H`)**. `Esc`, `pointercancel`, tööriista vahetus, projekti vahetus kustutavad eelvaate. Nooled nihutavad 1 px (`Shift` 10 px) üks käsk klahvivajutuse kohta. `UiModule` saab `canvasLayers` ja `tools`; `UiRegistry` koondab need. `Workbench` annab lõuendi `AppShell`-ile.

- [ ] **Samm 1:** testid (jsdom): `click_selects_component_then_pin`, `nearest_pin_wins_inside_hit_radius` (kaks jalga 4 px kaugusel), `hit_index_rebuilds_on_rev_change`, `drag_below_3px_is_a_click`, `drag_grab_offset_stays_under_cursor`, `drag_commits_one_translate_on_pointerup`, `cancelled_drag_leaves_no_trace` (`Esc`, `pointercancel`, tööriista vahetus, projekti vahetus: `rev`, ajalugu ja journal muutumatud), `wheel_zoom_keeps_cursor_point_fixed`, `pan_does_not_rerender_layers`, `escape_returns_to_select_and_clears_selection`, `selection_cleared_when_selected_item_disappears` (M0 parandus jääb kehtima).
- [ ] **Samm 2–4:** RED → GREEN. **Samm 5:** `UiRegistry` ja `UiModule` testid, `docs/api/ui.md`. Commit `feat(ui): canvas base with select, pan and drag preview`.

### Ülesanne 7: Komponentide kiht ja jalad (`features/components/ui`)

**Produces:** `ComponentsLayer` (z 30 kered, 50 jalad, 60 tähised/numbrid), `PinMarker`, `COMPONENTS_LAYERS: LayerSpec[]`. Reeglid [06 › Jalad ja Komponendid](../06-kasutajaliides.md#jalad): kere kontuur 1,4 px koos 3,6 px halo-ga; jalg 1 ruut; jala minimaalne läbimõõt 10 px; number alates raadiusest 7 px, nimi alates 14 px; tähis ja väärtuse silt alles, kui tekst on ekraanil ≥ 8 px (LOD arvutatakse uuesti suumi lõppedes, `requestAnimationFrame` + 120 ms); olekud M1.1-s: ühendamata (ainult kontuur), NC (rist), valitud (+2 px `--sel`), mõõdetud (näit silt kohe jala juures, neutraalne rõngas; OK/kahtlane tuleb M2-s); alumise poole kere katkendjoon; tuvastamata „?“; DNP 40 % läbipaistvus. Tähise silt on lohistatav (`labelOffset`, üks `components.setLabelOffset` vabastamisel, **komponent ei liigu**). Iga komponent on `React.memo` ja renderdub ainult oma andmete muutusel. Tähised, jalanumbrid ja väärtused `--f-mono`, `tabular-nums`, joonistatakse alati loetavalt.

- [ ] **Samm 1:** testid: `pin1_is_square`, `pin_number_hidden_below_7px_radius_and_name_below_14px`, `pad_min_diameter_10px_at_low_zoom`, `rotated_component_pin_hit_selects_that_pin` (ülevaatuse fookus 1), `bottom_side_component_is_dashed_and_mirrored`, `label_drag_changes_only_label_offset`, `unplaced_component_not_drawn`, `component_rerenders_only_on_own_change`.
- [ ] **Samm 2–4:** RED → GREEN. **Samm 5:** commit `feat(components): components layer and pin markers`.

### Ülesanne 8: Teek, paigutamine ja plaadil/paigutamata loendid

**Produces:** navigaatori vahekaardid **Teek**, **Plaadil**, **Plaadile paigutamata** (`Derived.unplacedBoard`), `PlaceTool` (Paiguta teegist: klõps lõuendil → `components.add` koos `board`-iga ja uus komponent valitakse; `Esc` katkestab, eelvaade kogu korpuse kontuurina kursori all), Teegi otsing (`kw`), kontekstisektsioon **Korpus ja asend** (pööra `R`/`Shift+R`, pool `F`, **Eemalda paigutus plaadilt**), tundmatu komponent (`X1`, tüüp „Muu“, korpus `area`, mõõdud mm; jalad käsitsi olemasoleva jalgade tabeli kaudu, nende asukohad lõuendil tulevad M1.4-s), paigutamata komponendi paigutamine olemasoleva jalgade arvu ja korpuse sobivuse järgi (sobimatu korpus näitab põhjust, ei paiguta). Uue komponendi väärtus ja märgistus on tühjad. Tühjad olekud [06](../06-kasutajaliides.md#tühjad-olekud) tekstidega `et.ts` failis.

- [ ] **Samm 1:** testid: `library_lists_five_footprint_families_and_unknown`, `search_filters_by_keyword_and_shows_empty_state`, `place_tool_adds_placed_component_in_one_command`, `place_tool_esc_leaves_no_trace`, `new_component_value_and_marking_are_empty`, `unplaced_list_places_matching_footprint_only`, `rotate_and_flip_keys_dispatch_commands`, `unknown_component_is_area_with_manual_pins`.
- [ ] **Samm 2–4:** RED → GREEN. **Samm 5:** commit `feat(components): library, placement tool and unplaced list`.

### Ülesanne 9: Mõõda-plokk, mõõtmiste loend ja näidu sildid (`features/measurements/ui`)

**Produces:** kontekstisektsioon **Mõõda** (jalg valitud), `MeasureBlock`, `MeasurementList` (sektsioon **Mõõtmised** ja navigaatori vahekaart), `ReadingLabels` (z 80), `Alt`-klahvid, `M` (fookus väärtuse väljale). Käitumine [03 § 5](../03-arhitektuur.md#5-olek-kolm-eraldi-hoidlat) ja [06 › Klaviatuur](../06-kasutajaliides.md#klaviatuur) järgi:
- **Koht** (punane sond) on valitud jalg; **Vastaspunkt** (must sond) on tühi, kuni kasutaja selle valib (loend jalgadest + valikuline soovituste rida `suggestions: PinRef[]`, M1.1-s tühi, Arhitekti otsus 7).
- Mustand on `measureDrafts[pairKey]`, `pairKey = "<punase uid>|<musta uid või ->"`. Koha vahetus (`Alt+↓`/`Alt+↑`, klõps teisel jalal) ei vii väärtust kaasa; uus jalg saab oma mustandi viimati kasutatud režiimi ja toitega; must sond jääb mõõtmisjada ajaks lukku. `Tab` ei muuda Kohta. Tööriista, filtri või vahekaardi vahetus ei muuda Kohta ega mustandit.
- Režiimid `Alt+1…3` (pinge, takistus, diood), toide `Alt+P` (Teadmata → Sees → Väljas), vaikimisi **Teadmata**. `Enter` salvestab: `parseReading` → `measurements.add` (`takenAt` kutsuja UTC, id kutsuja), mustand kustub, fookus jääb väljale. `Esc` tühjendab mustandi ja väljub. Vigane sisend: väli `aria-invalid` ja põhjus, midagi ei salvestata.
- Kustutatud jala/komponendi mustand jääb alles koos selgitusega ja „Salvesta“ on keelatud, kuni Koht on uus.
- Mõõtmiste loend: uuemad enne, näit `formatReading`, sildid `atLabel`/`refLabel`, ajalooline märge „kontakt kustutatud“, kustutamine (`measurements.remove`, `Ctrl+Z` toob tagasi).
- Näidu silt jala juures kasutab `Derived.pinReadings`; hinnangut (OK/madal/kõrge) M1.1 ei näita.

- [ ] **Samm 1:** testid: `black_probe_is_never_chosen_automatically`, `suggestion_requires_click_to_save`, `draft_belongs_to_probe_pair` (kaks paari, eri väärtused), `alt_down_does_not_carry_value_to_next_pin`, `tab_does_not_change_location`, `alt_down_stops_at_last_pin_no_wrap`, `enter_saves_and_clears_draft_and_keeps_focus`, `invalid_reading_blocks_save_and_shows_reason` (`abc`, `1,2,3`, tühi), `ol_rejected_for_voltage`, `deleted_pin_keeps_draft_but_blocks_save` (ülevaatuse fookus 5), `no_canvas_hotkeys_fire_inside_input`, `list_marks_historical_measurements`, `reading_label_shown_on_pin`.
- [ ] **Samm 2–4:** RED → GREEN. **Samm 5:** registreeri moodul `apps/web` ja `apps/desktop`; commit `feat(measurements): measure block, list and reading labels`.

### Ülesanne 10: Esimene läbiv töövoog, e2e ja vastuvõtt

**Files:** `apps/web/e2e/m1-1.spec.ts`, `docs/api/*.md`, `docs/03-arhitektuur.md` (§ 4 `canvasLayers`/`tools`, § 7.4 `pinReadings`), `docs/STATUS.md`, `docs/plans/M1-1-uleandmine.md`.

- [ ] **Samm 1:** e2e (Chromium, `apps/web`): `first_through_flow_measurement_survives_reopen`: uus plaat → Teek → SOIC-8 lõuendile → klõps jalal 3 → mõõda `4,98` (pinge) `Enter` → sule → ava viimastest → jalg 3 näitab `4,98 V`; lisakatsed: `unsaved_text_does_not_follow_alt_down`, `tab_does_not_change_location`, `drag_with_escape_leaves_no_trace`, `undo_redo_of_placement_and_measurement`.
- [ ] **Samm 2:** `pnpm check`, `pnpm format:check`, `pnpm e2e` (M0 8/8 + uued), `cargo test --locked` (muutmata), `pnpm tauri build --debug`.
- [ ] **Samm 3 (suitsukontroll päris aknas, kasutaja vastuvõtt):** sama voog töölaual; mõõtmine on pärast sulgemist samal jalal; hele ja tume teema; lohistamine `Esc`-iga; 1100 × 700 aken.
- [ ] **Samm 4:** üleandmine; commit `feat: M1.1 component on canvas and first measurement`. **M1.1 on valmis ülevaatuseks.**

---

## M1.1 vastuvõtt: tingimus → tõend

| [07 › M1.1](../07-teekaart.md#m11--komponent-fotol-ja-mõõtmine) tingimus | Tõend |
|---|---|
| esimene läbiv töövoog päris äpis, mõõtmine samal jalal | Ül. 10 e2e `first_through_flow…` ja suitsukontroll |
| salvestamata väärtus ei kandu teisele jalale; `Tab` ei muuda Kohta; väärtus tagasi tulles alles | Ül. 9 `draft_belongs_to_probe_pair`, `alt_down_does_not_carry…`, `tab_does_not_change_location`; Ül. 10 e2e |
| musta sondi ei vali äpp; GND ainult klõpsuga soovitus | Ül. 9 `black_probe_is_never_chosen_automatically`, `suggestion_requires_click_to_save` |
| uue komponendi väärtus ja märgistus on tühjad | Ül. 8 `new_component_value_and_marking_are_empty` |
| lohistamine `Esc`/`pointercancel` ei jäta jälge | Ül. 6 `cancelled_drag_leaves_no_trace`; Ül. 10 e2e |
| 5 põhikorpust, plaadipaigutus ja liigutamine, tundmatu komponent, jalad ja olekud, tähis lohistatava sildiga | Ül. 1, 2, 4, 7, 8 testid |
| SOIC-8 jalad 1 ja 8 õiges kohas | Ül. 1 `soic8_pin1_and_pin8_positions` |

## Mis jääb järgmistesse plaanidesse

M1.2 foto ja kalibreerimine (Rust, EXIF, jõudlusproov); M1.3 ~40 korpust ja korpuse vahetus; M1.4 suurus, joondus, oma jalad, jõudluseelarve. Neist igaühe plaani kirjutab arhitekt pärast eelmise osa vastuvõttu, tegeliku seisu põhjal.
