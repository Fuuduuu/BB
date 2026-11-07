# 07 · Teekaart

Iga verstapost lõpeb töötava ja paigaldatava äpiga. Järgmist verstaposti ei alustata enne, kui eelmise „valmis kui“ tingimused on päris äpis läbi proovitud. Iga verstaposti jaoks tehakse enne ehitust eraldi detailne teostusplaan (`docs/plans/Mx-*.md`, ülesanded koos testidega).

## M0 · Vundament

**Eeltingimused arendusmasinas** (praegu puuduvad, paigaldatakse enne M0 koodi):
- Node.js LTS ja `corepack enable`, mis teeb `pnpm`-i kättesaadavaks;
- Rust (`rustup`, stabiilne toolchain) ja Windowsi C++ Build Tools (Visual Studio Build Tools, „Desktop development with C++“), mida Tauri `src-tauri` kompileerimiseks vajab;
- WebView2 runtime (Windows 11-s olemas).

**Sisu:**
- pnpm monorepo, Vite, React, TS strict, Tauri 2;
- paketid `domain`, `contracts`, `engine`, `client`, `ui`, `adapters` ja sõltuvusreeglid ([03 § 2](03-arhitektuur.md#2-kihid));
- sünkroonne dokumendimootor koos käskude, tagasivõtmise ja omandikontrolliga (kehtib ka väljalaskes);
- hetktõmmis koos `sessionId`-ga, `ProjectService` ja `SaveCoordinator` (ajastus ja maksimaalne ooteaeg, `base_rev` võrdlus, vaade eraldi, sulgemise voog);
- SQLite projekti fail koos eksklusiivse lukuga, üks äpi eksemplar ja `.pcbk` failiseos;
- varukoopiad ja taastamine, kahetasemeline `ErrorBoundary` ja diagnostika eksport;
- avaleht ja uue plaadi dialoog, disainisüsteemi põhikomponendid, i18n, GitHub Actions CI.

M0 ehitab ainult projekti ja ühe näidismooduli (`notes`) läbi kõigi kolme osa. Teiste moodulite registrid, paneelid ja tühjad laienduskohad tulevad oma verstapostis.

**Valmis kui:**
- [ ] `pnpm check` on roheline (tsc, eslint, dependency-cruiser, failipikkus, Vitest, Playwright, cargo test).
- [ ] CI kukub, kui `features/*/ui` impordib `engine`-it; mootori testid jooksevad Node'is ilma DOM-ita.
- [ ] Uus plaat → nime muutmine → sulge → ava viimastest: nimi on alles, `Ctrl+Z` töötab. Sama UI töötab nii `apps/web` kui ka `apps/desktop` all; erinev on ainult salvestuse adapter.
- [ ] Fail `.pcbk` avaneb ka pärast äpi jõuga sulgemist (kirjutamise ajal tapetud protsess).
- [ ] Kui projekti fail muutub kirjutuskaitstuks, tuleb punane riba. Akna sulgemine ei kaota muudatusi ilma „Sulge salvestamata“ kinnituseta ja „Salvesta mujale…“ loob koopia, kus on samad andmed ([03 § 9](03-arhitektuur.md#salvestuse-vastutaja-savecoordinator-moodul-project)).
- [ ] Sama faili teine avamine toob ette olemasoleva akna. Teise protsessi poolt lukustatud fail avaneb kirjutuskaitstuna.
- [ ] `project_save` ei kirjuta, kui failis pole oodatud `base_rev` (`cargo test`). Vana `sessionId`-ga vastus ja sündmus jäetakse kõrvale (mootori test).
- [ ] Käsk, mis muudab välja väljaspool oma `owns` ja `alsoWrites` loendit, lükatakse tagasi ka väljalaske ehituses. Dokument, ajalugu ja salvestusjärjekord jäävad muutmata.
- [ ] Ainult vaate muutus (suum, kihid) säilib sulgemisel ilma ühegi dokumendikäsuta. Pidev töö ei lükka salvestamist edasi kauem kui 10 s.
- [ ] Varukoopia tekib enne migratsiooni (testmigratsiooniga) ja selle taastamine avalehelt on läbi proovitud.
- [ ] Näidismoodul `notes` lisatakse kahe reaga (mootor ja UI) ja ilmub navigaatorisse.
- [ ] CI ehitab `.msi` paigaldaja.

## M1 · Plaat, komponendid ja esimene mõõtmine

M1 jaguneb neljaks osaks. Iga osa võetakse eraldi vastu ja esimene läbiv töövoog ei oota ära kõiki korpusi.

### M1.1 · Komponent ja mõõtmine
**Sisu:**
- 5 põhikorpust: kahejalgne chip (takisti/kondensaator), SOT-23, SOIC-8, TO-220 ja pinnirida;
- paigutus ja liigutamine (eelvaade `SessionStore`'is, mootorisse üks käsk);
- jalad ja nende olekud;
- **minimaalne mõõtmine**: `Measurement` mudel, `measurements.add`/`remove` ja lihtne Mõõda-plokk valitud jalale (pinge, väärtus, `Enter`, jalaga seotud mustand) ilma hinnangute nimekirjata.

**Valmis kui:**
- [ ] **Esimene läbiv töövoog** päris äpis: loo projekt → lisa komponent → vali jalg → salvesta mõõtmine → sulge → ava uuesti. Mõõtmine on alles samal jalal.
- [ ] Jalale kirjutatud, aga salvestamata väärtus ei salvestu `Tab`-i ega klõpsuga teisele jalale minnes; tagasi tulles on see alles ([03 § 5](03-arhitektuur.md#5-olek-kolm-eraldi-hoidlat)).
- [ ] Lohistamine `Esc`-iga ei jäta dokumenti, ajalukku ega salvestusse jälge.

### M1.2 · Foto ja kalibreerimine
**Sisu:** foto import Rustis (failist ja kleepimisel baitidest, EXIF, kuvamisvariant, `pcbk://photo`), nähtavus ja kontrast, pööramine ja peegeldamine kogu stseenile, kalibreerimine; **varajane jõudlusproov** päris Tauri aknas tiheda sünteetilise plaadiga (sildid, valik, foto).

**Valmis kui:**
- [ ] Portreefoto, millel on EXIF-pööre, on lõuendil ja ekspordis ühtemoodi õigetpidi.
- [ ] Foto pööramine ja peegeldamine ei muuda jalgade asendit foto suhtes (invariantsustest kõigi 8 teisendusega).
- [ ] 48 MP foto avaneb ilma, et kuvatakse üle 12 MP pilti; „Salvesta mujale…“ koopia avaneb koos originaalfotoga.
- [ ] Jõudlusproovi tulemus on kirja pandud: kas SVG kannab välja või kavandatakse jalgadele Canvas-kiht.

### M1.3 · Korpuste teek
**Sisu:** kõik ~40 korpust prototüübist (samad arvud) ja korpuse vahetuse reegel ([04 › Kustutamise reeglid](04-andmemudel.md#kustutamise-reeglid)).

**Valmis kui:**
- [ ] SOIC-8 jalg 1 on (−2,8; −1,905) mm ja jalg 8 (2,8; −1,905) mm; QFP-44 jalg 12 on alumisel küljel (ühiktest).
- [ ] SOIC-8 → SOIC-14 vahetus hoiab jalad 1–8 seotuna; SOIC-14 → SOIC-8 küsib kinnitust ja loetleb kaduvate jalgade ühendused.

### M1.4 · Suurus ja joondus
**Sisu:** suuruse muutmine käepidemetega ja numbritega, kahe jala joondus, oma jalad, jõudluseelarve.

**Valmis kui:**
- [ ] [02 § 16](02-kasutaja-teekond.md#16-vastuvõtustsenaarium-e2e-test-plaat-algusest-lõpuni) sammud 1–5 lähevad läbi.
- [ ] Kahe jala joondus taastab teadaoleva asendi täpsusega < 0,01 px ja < 0,01°.
- [ ] Jõudluseelarve on täidetud ([03 § 7.3](03-arhitektuur.md#73-kihid-ja-jõudlus)).

## M2 · Ühendused ja võrgud

**Sisu:** moodulid `connections` ja `nets` ning piiksumisrežiim moodulis `measurements` (`beep.record`, kasutab M1 mõõtmise mudelit).
- rajatööriist kihiga ja kiirühendus;
- ühenduse tase, mis arvutatakse mõõtmistest;
- võrkude arvutus koos kihireegliga;
- rollid ja värvid, rollikonflikt, negatiivse läbivuse hoiatus;
- võrguloendi eksport.

**Valmis kui:**
- [ ] Stsenaariumi sammud 6–8 lähevad läbi.
- [ ] Vaba ots 0,2 mm kaugusel teisest rajast liitub, 0,6 mm kaugusel ei liitu. Pealmise ja alumise kihi rajad ühinevad ainult jala kaudu (ühiktestid).
- [ ] GND + 5V liitmine annab konflikti ja ei kirjuta rolli üle; tagasivõtmine taastab.
- [ ] Piiksumisrežiimi „Jah“ on üks samm: `Ctrl+Z` eemaldab nii mõõtmise kui ka ühenduse. Piiks 10 Ω takisti otste vahel ei liida võrke ilma kinnituseta. Kui takisti otsad satuvad siiski samasse võrku, tuleb hoiatus „mõlemad jalad on samas võrgus“.
- [ ] Mõõtmise kustutamine või remondist tulenev aegumine võtab ühenduselt ✓-märgi ära; uus tavaline läbivusmõõtmine samade jalgade vahel taastab selle ([04 › Ühenduse tase](04-andmemudel.md#ühenduse-tase-connectionlevels)).
- [ ] 50 jala kaardistamine piiksumisrežiimis võtab alla 2 minuti (käsitsi proov).

## M3 · Mõõtmised ja vigade otsing

**Sisu:** moodulid `measurements` (täiendus) ja `repair` ning logi vahekaart moodulis `project`.
- kiirsisestus kõigis režiimides koos „OL“-iga;
- `parseReading`;
- hindamine mõlema sondi järgi ja tolerantsi seade;
- mõõtmiste nimekiri ja filtrid, kahtlaste vaade;
- kahjustatud alad, remonditoimingud koos aegumisega.

**Valmis kui:**
- [ ] Stsenaariumi sammud 9–10 lähevad läbi.
- [ ] Kõik hindamise kontrollväärtused ([04](04-andmemudel.md#mõõtmiste-hindamine)) on testidega kaetud, sh must sond mujal kui GND-l (punane 5V, must 12V → −7 V on OK) ning dioodi ja „OL“ juhud.
- [ ] 20 pinget järjest saab mõõta ainult klaviatuuriga (`Tab`, number, `Enter`) ilma hiireta; fookus ja dialoogid on klaviatuuriga kasutatavad (Playwright).
- [ ] Mõõtmise koht ja sisestatud väärtus ei muutu tööriista, filtri ega vahekaardi vahetusel. `Tab`-i või klõpsuga teisele jalale minnes ei salvestu eelmise jala väärtus uuele jalale (regressioonitest BenchBeepi BB-01, BB-04 ja BB-11 kohta).

## M4 · Skeem, valmimine ja eksport

**Sisu:**
- moodulid `dimensions`, `schematic`, `guide` ja `export`;
- mõõtjooned ja kontuur, sümbolid, automaatne paigutus, ühine valik;
- valmiduse näitajad ja „Märgi kaardistus valmis“;
- kõik ekspordid ja remondiraport;
- prototüübi import koos vastuvõtureeglitega;
- paigaldus ja allkirjastamine ([03 § 14](03-arhitektuur.md#14-paigaldus-ja-väljalase)).

**Valmis kui:**
- [ ] Terve [02 § 16](02-kasutaja-teekond.md#16-vastuvõtustsenaarium-e2e-test-plaat-algusest-lõpuni) läheb läbi (e2e `full-flow.spec.ts`).
- [ ] SVG eksport on 1:1 (kontuur 76 mm + 2 × 5 mm varu → `width="86mm"`); kalibreerimata plaadi ekspordil on märge.
- [ ] CSV-d avanevad eestikeelses Excelis õigete veergudega.
- [ ] Prototüübi näidisprojekt (`PCB-Kaardistaja.html` → Salvesta) imporditakse ja näeb välja sama. Vigase viitega fail lükatakse tagasi ilma avatud projekti puudutamata.
- [ ] `.msi` paigaldub võrguühenduseta masinasse; `.pcbk` topeltklõps avab äpi; uue versiooni paigaldamine säilitab projektid ja varukoopiad.
- [ ] **v1.0 väljalase:** allkirjastatud `.msi` GitHubi Release'is.

## M5 · Foto täiendused ja tahvel

**Sisu:** alumise poole foto koos 3–4 punktiga joondusega pealmisele (afiinne), poole vahetus `Tab`-iga koos radadega; perspektiivi parandus (4 nurka); võrdluspildid komponendile; tahvli paigutus (Tauri Android).

**Valmis kui:** sama rada on näha mõlemal fotol õiges kohas; viltu tehtud telefonifoto saab sirgeks ja mõõtkava on pärast parandust ±1 % täpne.

## M6 · AI (eraldi otsusega)

**Sisu:** `AiPort` teostus, nõusoleku ja võtmete haldus, moodulid `ai-assistant` (järgmise sammu soovitus, küsimused projekti kohta), `ai-photo` (komponendikandidaadid kihina) ja `ai-report` (remondikokkuvõte). Kõik muudatused käivad ainult ettepanekutena: lubatud käskude loend, `baseRev` kontroll ja rakendamine ühe sammuna ([03 § 13](03-arhitektuur.md#13-ai-liides-hilisem)).

**Eeltingimus:** M4 on vastu võetud ja kasutaja on teinud eraldi otsuse (privaatsus, teenusepakkuja, hind).

## Hiljem (pole ajastatud)

Mõõteriista otseühendus (seriaal, Bluetooth), KiCadi netlist ja skeemi eksport, andmelehtede otsing, telefoni abirakendus pildistamiseks, mitme plaadi võrdlus (töötav ja vigane plaat), automaatne uuendaja, varundus või sünk (eraldi ADR).
