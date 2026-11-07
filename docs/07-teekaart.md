# 07 · Teekaart

Iga verstapost lõpeb töötava ja paigaldatava äpiga. Järgmist verstaposti ei alustata enne, kui eelmise „valmis kui“ tingimused on päris äpis läbi proovitud ja kasutuskatse on tehtud ([03 § 12](03-arhitektuur.md#kohustuslikud-invariandid)). Iga verstaposti jaoks tehakse enne ehitust eraldi detailne teostusplaan (`docs/plans/Mx-*.md`, ülesanded koos testidega). Mitme kuu kõigi funktsioonide koodi ja teste ette ei kirjutata.

Järjekord ([ADR-004](adr/ADR-004-kaks-vaadet-ja-uhendused.md)):

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

**Eeltingimused arendusmasinas:**
- Node.js LTS (paigaldatud: 26.13.0) ja `corepack enable`, mis teeb `pnpm`-i kättesaadavaks;
- **puudub veel:** Rust (`rustup`, stabiilne toolchain) ja Windowsi C++ Build Tools (Visual Studio Build Tools, „Desktop development with C++“), mida Tauri `src-tauri` kompileerimiseks vajab;
- WebView2 runtime (Windows 11-s olemas).

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
- [ ] `pnpm check` on roheline (tsc, eslint, dependency-cruiser, failipikkus, Vitest, Playwright, cargo test).
- [ ] CI kukub, kui `features/*/ui` impordib `engine`-it; mootori testid jooksevad Node'is ilma DOM-ita.
- [ ] Uus plaat → lisa komponent → nimeta → `Ctrl+Z` / `Ctrl+Y` → sulge → ava viimastest: komponent, nimi ja vaade on alles. Sama UI töötab nii `apps/web` kui ka `apps/desktop` all; erinev on ainult salvestuse adapter.
- [ ] Fail `.pcbk` avaneb ka pärast äpi jõuga sulgemist (kirjutamise ajal tapetud protsess).
- [ ] Kui projekti fail muutub kirjutuskaitstuks või ketas saab täis, tuleb punane riba. Akna sulgemine ei kaota muudatusi ilma „Sulge salvestamata“ kinnituseta ja „Salvesta mujale…“ loob koopia, kus on samad andmed ([03 § 9](03-arhitektuur.md#salvestuse-vastutaja-savecoordinator-moodul-project)).
- [ ] Sama faili teine avamine toob ette olemasoleva akna. Teise protsessi poolt lukustatud fail annab teate „Fail on avatud mujal“ ega riku midagi (kaks päris protsessi).
- [ ] `project_save` ei kirjuta, kui failis pole oodatud `base_rev` (`cargo test`). Vana `sessionId`-ga vastus ja sündmus jäetakse kõrvale (mootori test).
- [ ] Käsk, mis muudab välja väljaspool oma `owns` ja `alsoWrites` loendit või rikub invarianti, lükatakse tagasi ka väljalaske ehituses. Dokument, ajalugu ja salvestusjärjekord jäävad muutmata.
- [ ] Tagasivõtmine suurendab `rev`-i ja salvestus kirjutab taastatud sisu.
- [ ] Ainult vaate muutus (suum, kihid) säilib sulgemisel ilma ühegi dokumendikäsuta. Pidev töö ei lükka salvestamist edasi kauem kui 10 s.
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
- [ ] Jalale kirjutatud, aga salvestamata väärtus ei salvestu teisele jalale minnes (`Alt+↓` või klõps); `Tab` ei muuda Kohta; tagasi tulles on väärtus alles ([03 § 5](03-arhitektuur.md#5-olek-kolm-eraldi-hoidlat)).
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
**Sisu:** kõik ~40 korpust prototüübist (samad arvud) ja korpuse vahetus koos jalgade vastavusega ([04 › Kustutamise reeglid](04-andmemudel.md#kustutamise-reeglid)).

**Valmis kui:**
- [ ] SOIC-8 jalg 1 on (−2,8; −1,905) mm ja jalg 8 (2,8; −1,905) mm; QFP-44 jalg 12 on alumisel küljel (ühiktest).
- [ ] SOIC-8 → SOIC-14 vahetus hoiab jalad 1–8 seotuna (sama `uid`); SOIC-14 → SOIC-8 küsib kinnitust ja loetleb kaduvate jalgade mõju; nende jalgade mõõtmised muutuvad ajaloolisteks. SOIC-8 → SOIC-14 tagasi ei aktiveeri vanu mõõtmisi (uus `uid`), aga `Ctrl+Z` aktiveerib.

### M1.4 · Suurus ja joondus
**Sisu:** suuruse muutmine käepidemetega ja numbritega, kahe jala joondus, oma jalad, jõudluseelarve.

**Valmis kui:**
- [ ] [02 § 16](02-kasutaja-teekond.md#16-vastuvõtustsenaarium-e2e-test-plaat-algusest-lõpuni) sammud 1–5 lähevad läbi.
- [ ] Kahe jala joondus taastab teadaoleva asendi täpsusega < 0,01 px ja < 0,01°.
- [ ] Jõudluseelarve on täidetud ([03 § 7.3](03-arhitektuur.md#73-kihid-ja-jõudlus)).

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
- [ ] Mõõtmise kustutamine või remondist tulenev aegumine võtab ühenduselt ✓-märgi ära; uus tavaline läbivusmõõtmine samade jalgade vahel taastab selle ([04 › Ühenduse tase](04-andmemudel.md#ühenduse-tase-connectionlevels)).
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
- [ ] Kõik hindamise kontrollväärtused ([04](04-andmemudel.md#mõõtmiste-hindamine)) on testidega kaetud, sh must sond mujal kui GND-l (punane 5V, must 12V → −7 V on OK), dioodi ja „OL“ juhud ning kustutatud kontaktiga mõõtmine.
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
- paigaldus ja allkirjastamine ([03 § 14](03-arhitektuur.md#14-paigaldus-ja-väljalase)).

**Valmis kui:**
- [ ] Terve [02 § 16](02-kasutaja-teekond.md#16-vastuvõtustsenaarium-e2e-test-plaat-algusest-lõpuni) läheb läbi (e2e `full-flow.spec.ts`).
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

**Sisu:** `AiPort` teostus, nõusoleku ja võtmete haldus, moodulid `ai-assistant` (järgmise sammu soovitus, küsimused projekti kohta), `ai-photo` (komponendikandidaadid kihina) ja `ai-report` (remondikokkuvõte). Kõik muudatused käivad ainult ettepanekutena: lubatud käskude loend, `baseRev` kontroll ja rakendamine ühe sammuna ([03 § 13](03-arhitektuur.md#13-ai-liides-hilisem)).

**Eeltingimus:** M4 on vastu võetud ja kasutaja on teinud eraldi otsuse (privaatsus, teenusepakkuja, hind).

## Hiljem (pole ajastatud)

Mõõteriista otseühendus (seriaal, Bluetooth), KiCadi netlist ja skeemi eksport, andmelehtede otsing, telefoni abirakendus pildistamiseks, mitme plaadi võrdlus (töötav ja vigane plaat), automaatne uuendaja, varundus või sünk (eraldi ADR), mitme joonistuse tugi ühele ühendusele.
