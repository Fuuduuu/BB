# 07 · Teekaart

Iga verstapost lõpeb töötava ja paigaldatava äpiga. Järgmist verstaposti ei alustata enne, kui eelmise „valmis kui“ tingimused on päris äpis läbi proovitud. Iga verstaposti jaoks tehakse enne ehitust eraldi detailne teostusplaan (`docs/plans/Mx-*.md`, ülesanded koos testidega).

## M0 · Vundament

**Sisu:** repo (pnpm, Vite, React, TS strict, Tauri 2), kaustastruktuur ja sõltuvusreeglid ([03 § 2](03-arhitektuur.md#2-kihid)), `AppModule` ja `ModuleRegistry`, kolm hoidlat, käsud koos tagasivõtmisega, platvormikiht (tauri + web), SQLite projekti fail, automaatsalvestus, avaleht ja uue plaadi dialoog, disainisüsteemi põhikomponendid, i18n, GitHub Actions CI.

**Valmis kui:**
- [ ] `pnpm check` on roheline (tsc, eslint, dependency-cruiser, failipikkus, Vitest, Playwright, cargo test).
- [ ] Uus plaat → nime muutmine → sulge → ava viimastest: nimi on alles; `Ctrl+Z` töötab.
- [ ] Fail `.pcbk` avaneb ka pärast äpi jõuga sulgemist (kirjutamise ajal tapetud protsess).
- [ ] Näidismoodul (`notes`) lisatakse ühe reaga ja ilmub navigaatorisse.
- [ ] CI ehitab `.msi` paigaldaja.

## M1 · Plaat ja komponendid

**Sisu:** moodulid `photo`, `calibration`, `selection`, `components`, `pins`; korpuste teek porditud prototüübist (kõik ~40 võtit ja samad arvud); paigutus, suuruse muutmine, kahe jala joondus; jalgade olekud ja oma jalad; jõudlustest.

**Valmis kui:**
- [ ] [02 § 16](02-kasutaja-teekond.md#16-vastuvõtustsenaarium-e2e-test-plaat-algusest-lõpuni) sammud 1–5 lähevad läbi.
- [ ] SOIC-8 jalg 1 on (−2,8; −1,905) mm ja jalg 8 (2,8; −1,905) mm; QFP-44 jalg 12 on alumisel küljel (ühiktest).
- [ ] Kahe jala joondus taastab teadaoleva asendi täpsusega < 0,01 px ja < 0,01°.
- [ ] Jõudluseelarve on täidetud ([03 § 7.3](03-arhitektuur.md#73-kihid-ja-jõudlus)).

## M2 · Ühendused ja võrgud

**Sisu:** moodulid `connections`, `nets`, `beep`; rajatööriist, kiirühendus, piiksumisrežiim, võrkude arvutus, rollid ja värvid, rollikonflikt, negatiivse läbivuse hoiatus, võrguloendi eksport.

**Valmis kui:**
- [ ] Stsenaariumi sammud 6–8 lähevad läbi.
- [ ] Vaba ots 0,2 mm kaugusel teisest rajast liitub, 0,6 mm kaugusel ei liitu (ühiktest).
- [ ] GND + 5V liitmine annab konflikti ja ei kirjuta rolli üle; tagasivõtmine taastab.
- [ ] 50 jala kaardistamine piiksumisrežiimis võtab < 2 minutit (käsitsi proov).

## M3 · Mõõtmised ja vigade otsing

**Sisu:** moodulid `measurements`, `repair`, `journal`; kiirsisestus, `parseReading`, hindamine, mõõtmiste nimekiri ja filtrid, kahtlaste vaade, kahjustatud alad, remonditoimingud koos aegumisega, logi.

**Valmis kui:**
- [ ] Stsenaariumi sammud 9–10 lähevad läbi.
- [ ] Kõik hindamise kontrollväärtused ([04](04-andmemudel.md#mõõtmiste-hindamine)) on testidega kaetud.
- [ ] 20 pinget järjest saab mõõta ainult klaviatuuriga (`Tab`, number, `Enter`) ilma hiireta.
- [ ] Mõõtmise koht ei muutu tööriista, filtri ega vahekaardi vahetusel (regressioonitest BenchBeepi BB-01, BB-04 ja BB-11 kohta).

## M4 · Skeem, valmimine ja eksport

**Sisu:** moodulid `dimensions`, `schematic`, `guide`, `export`; mõõtjooned ja kontuur, sümbolid, automaatne paigutus, ühine valik, valmiduse näitajad, „Märgi kaardistus valmis“, kõik ekspordid ja remondiraport, prototüübi import.

**Valmis kui:**
- [ ] Terve [02 § 16](02-kasutaja-teekond.md#16-vastuvõtustsenaarium-e2e-test-plaat-algusest-lõpuni) läheb läbi (e2e `full-flow.spec.ts`).
- [ ] SVG eksport on 1:1 (kontuur 76 mm + 2 × 5 mm varu → `width="86mm"`).
- [ ] CSV-d avanevad eestikeelses Excelis õigete veergudega.
- [ ] Prototüübi näidisprojekt (`PCB-Kaardistaja.html` → Salvesta) imporditakse ja näeb välja sama.
- [ ] **v1.0 väljalase:** `.msi` GitHubi Release'is.

## M5 · Foto täiendused ja tahvel

**Sisu:** alumise poole foto koos 3–4 punktiga joondusega pealmisele (afiinne), poole vahetus `Tab`-iga koos radadega; perspektiivi parandus (4 nurka); võrdluspildid komponendile; tahvli paigutus (Tauri Android).

**Valmis kui:** sama rada on näha mõlemal fotol õiges kohas; viltu tehtud telefonifoto saab sirgeks ja mõõtkava on pärast parandust ±1 % täpne.

## M6 · AI (eraldi otsusega)

**Sisu:** `AiProvider` teostus, nõusoleku ja võtmete haldus, moodulid `ai-assistant` (järgmise sammu soovitus, küsimused projekti kohta), `ai-photo` (komponendikandidaadid kihina) ja `ai-report` (remondikokkuvõte). Kõik muudatused käivad ainult ettepanekutena ([03 § 13](03-arhitektuur.md#13-ai-liides-hilisem)).

**Eeltingimus:** M4 on vastu võetud ja kasutaja on teinud eraldi otsuse (privaatsus, teenusepakkuja, hind).

## Hiljem (pole ajastatud)

Mõõteriista otseühendus (seriaal, Bluetooth), KiCadi netlist ja skeemi eksport, andmelehtede otsing, telefoni abirakendus pildistamiseks, mitme plaadi võrdlus (töötav ja vigane plaat).
