# BB M2.2 piiksumisrežiimi ja ühenduse taseme sõltumatu koodiülevaatus

21. november 2026 · `codex/m2-2` · `5f4ffae` · M2-2-1 kuni M2-2-6

**Soovitan peatada Piiksu tööriista vastuvõtu kahe vale salvestuse tõttu.** Enter salvestas mõõtmise ja elektriühenduse ajal, mil fookuses oli „Võta tagasi“. Teises katses salvestas suure padjandi sisse tehtud klõps tulemuse kõrvaljala kohta. Mõlemal juhul jõudsid projekti tehniliselt kehtivad andmed ja rakendus sai näidata veenvat, kuid vale ✓.

Leidsin **2 P1, 8 P2 ja 2 P3 viga**. P1 tähendab vale sisu salvestamist või andmekadu. P2 puudutab töövoogu, taastamist või tulemuse usaldusväärsust. P3 on väiksema mõjuga kuvaviga. Allpool on iga leiu juures katse, selle eritingimused ja viited kontrollitud commit'i ridadele.

## Ulatus ja kontrollide tulemused

| Ulatus või kontroll | Sõltumatu tulemus |
|---|---|
| Git | Eraldi ajutine Git-koopia, fikseeritud tipule `5f4ffae11ab811d42fb858efda61a371c8c5cf40`. Alusest `9d89bb8` tipuni on 6 kaardicommit'i ja 56 muudetud faili. Esimene on `2c39900`. Aluse rakenduste ja pakettide kood klapib väljalaskega v0.5.0. M2-2-7 jäi välja. |
| Otsused ja vastuvõtutingimused | Põhikausta [M2.2 plaan ja O1–O6](../plans/M2-2-piiksumisreziim.md), [kaart 1](../tasks/M2-2-1.md), [2](../tasks/M2-2-2.md), [3](../tasks/M2-2-3.md), [4](../tasks/M2-2-4.md), [5](../tasks/M2-2-5.md) ja [6](../tasks/M2-2-6.md), sh arhitekti vastused ja ülevaatused. Võrdlusaluseks olid ka [andmemudeli](../04-andmemudel.md) ühenduse taseme ja piiksu reeglid, [kasutajateekonna](../02-kasutaja-teekond.md) § 8.1 ja § 8.3 ning [kasutajaliidese](../06-kasutajaliides.md) „Ühendused“. |
| `pnpm check` | **Lõppes koodiga 1.** Mõlemad TypeScripti kontrollid ja ESLint läbisid. Sõltuvuskontrollis oli 590 moodulit, 2340 sõltuvust ja 0 rikkumist. Failipikkuse kontroll läbis nelja hoiatusega testifailide kohta. Koondkäsk peatus Vitestis. Eraldi käivitatud `api:check` läbis. |
| Vitest | Tavakäivitus ei suutnud 217 testifailist 156 puhul teste koguda. Võrguühenduseta paketivahemälu oli puudulik ja Windows keelas kataloogilinkide loomise. Kordus kasutas lukufaili versioonidele vastavaid sõltuvusi ja sidus tööruumi paketinimed otse kontrollitud commit'i lähtekoodiga. Kõik 217 faili käivitusid, **1699/1713 testi läbis, 14 ebaõnnestus, 0 jäeti vahele**. Kolm tööriistatesti vajasid keelatud kataloogilinki ja üksteist võrdlesid mooduli füüsilist failiteed. Rakenduse testid läbisid. |
| `pnpm e2e` | Tavakäivitus jäi keskkonna `EACCES` tõttu seisma aadressil `127.0.0.1:5173`. Sama commit'i värske veebikooste ja repo võrguühenduseta testitee kaudu läbisid Chromiumis **43/43 muutmata Playwrighti testi** 151 sekundiga, ilma korduskatsete ja vahelejätmisteta. Allpool kirjeldatud Piiksu sihtkatsed olid sellele lisaks. |
| `cargo test --locked --offline --no-fail-fast` | Kaustas `apps/desktop/src-tauri` **107 läbis, 0 ebaõnnestus ja 2 märgiti ignoreerituks**. Kaks ignoreeritud kirjet on alamprotsessi abikatsed, mida kasutavad nende põhikatsed. |
| Vormistus | `cargo fmt --check` ja `git diff --check 9d89bb8..5f4ffae` läbisid. |
| Ühilduvus | Repos tarnitud v0.4.0 näidisfaili koopia ja v0.5.0 tegeliku väljalaskekoodiga selle ülevaatuse jaoks loodud SQLite'i projekt avanesid uue Rusti `ProjectStore::open` kaudu. Mõlema formaadiversioon oli 1. Kontrollitud mootori laadimisel säilis mõlema dokumendi sisu. V0.5.0 failis säilisid ka faili tunnus, võrgunimi ja roll, ühendus ning 3,3 V näit. V0.4.0 näidise foto baitide säilimist kattis Rusti test. Mudeli, migratsioonide ega Rusti salvestuskoodi muudatusi selles vahemikus ei olnud. |

Katsed kasutasid sünteetilisi plaate ja repo näidisandmeid. Jõudlustest allpool mõõtis Node'is ühenduse taseme tuletist. Tauri kaadrisagedus, värske töölaua-EXE visuaalne suitsukatse ning O6 kasutuskatse „50 jalga alla 2 minuti“ jäid selle vaheseisu kontrollist välja.

## Mis töötas

- **Millal ✓ tekib.** Võrdlesin `connectionLevels`-i tulemust sõltumatu lubatud teede täieliku loendusega 750 sünteetilisel väikesel graafil. Katsed hõlmasid tsükleid, paralleelservi, võrdseid teid ja ümberpööratud sonde. Võrdse pikkusega teedel otsustas ühenduste tunnuste järjestus kanoonilisest algusjalast. A→B ja B→C mõõtmine ei andnud A→C tõendit. Aegunud mõõtmine ja vana jala UID jäid välja. Võrdsel ajatemplil võitis hiljem lisatud näit. Peenema ajatäpsuse erand on leid 08. [Taseme arvutus](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/domain/src/rules/levels.ts#L14)
- **Haru mõju.** Mõõdetud A–B ainsa raja jagamisel säilis ✓ mõlemal lõigul A–J ja J–B. Kõrvalharu J–C jäi algtasemele. Kahe paralleelse A–B ühendusega on oluline eritingimus. Kui märgitud tee jagada kaheks lõiguks, muutub puutumata paralleeltee lühemaks ja ✓ liigub sellele. Undo taastas algse märgistuse. See tulemus järgib kaardi lühima tee reeglit. [Lubatud tee otsing](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/domain/src/rules/levels.ts#L59)
- **Kaitsed ja Undo.** Tavalisel „Piiksub ja ühenda“ toimingul tekkisid ühe ajaloosammuga nii mõõtmine kui ka ühendus. Üks Undo eemaldas mõlemad. Kaitsega tekkis esmalt üks mõõtmine ja üks õigete tunnustega `beep.guarded` sündmus. „Ühenda ikkagi“ lisas eraldi sammu. Esimene Undo eemaldas ühenduse, järgmine mõõtmise. Kontrollisin sama kahejalgse komponendi kaitset koos lülitiga, seejärel uue lühistatud komponendi ja lõpuks eri võrgurollide kaitset. Sama võrgu, vigase UID, sama jala, negatiivse näidu ja ainult mõõtmise juhtumid andsid oodatud tulemused. [Kaitsete järjekord](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/domain/src/rules/beep.ts#L44) · [Käsu katsed](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/beep-record.test.ts#L1)
- **Tööriist ja Mõõda-plokk.** Lõuendil töötasid Enter, Shift+Enter ja N. All hoitud N salvestas ühe negatiivse näidu. Avatud toimingu esimene Esc sulges valikud, teine lõpetas tööriista. Tööriista ja projektiseansi vahetamine tühjendas ankru ning tööriista „Rada“ katkestamine töötas katses endiselt. Mõõda-plokis salvestusid mõlemad läbivustulemused ühendust lisamata. Mustandid püsisid kontaktipaari kaupa lahus ka eraldusmärke sisaldavate tunnustega. Pingenäidu mustand säilis režiimi vahetusel. Mõõtmiste üldloendis ja jala ajaloos oli võrdse ajatempliga hilisem sisestus eespool. [Esc käitlus](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/ui/src/canvas/use-canvas-keys.ts#L51) · [Mõõda-plokk](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/MeasureBlock.tsx#L109)
- **Geomeetria ja kordusmõõtmine.** Mõõtkava muutmisel 10→20 px/mm ning komponendi või liitepunkti liigutamisel arvutati geomeetria ja märgi asukoht uuesti. Undo taastas asukoha. Positiivse näidu kustutamisel kadus ✓ ka muutumata ühenduste massiiviga. Aegunud tõend või sama jalatähise varasem UID näitas „Mõõda uuesti“. Kui varasem mõõtmine oli täielikult kustutatud, ilmus kaardi 5 arhitekti täpsustuse järgi „Mõõda piiksuga“. Mõõdetud ühendusel, liitepunktiga otsal ja puuduva padjandiga jalal nuppu ei ilmunud. [Geomeetria vahemälu](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/connections/ui/connection-geometry.ts#L1) · [Nupu nähtavus ja tekst](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/MeasureAgain.tsx#L33)
- **Kaart 6.** CSV ja võrgu konfliktihoiatus näitasid puuduva rolli tunnust koos märkega „(puudub)“. Valitud rolli uuesti vajutamine eemaldas rolli ja Undo taastas selle. Liitepunkti kustutusteade luges kaasa kaudselt kustunud ühendused ning vältis juba eraldi valitud ühenduse topeltarvestust. Piiksu enda kaitseküsimusel on eraldi puudus (leid 07). [Rolli varutekst](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/nets/contract.ts#L75)

## P1 — vale salvestus

### 01 · P1 · Enter salvestab mõõtmise ja elektriühenduse teise nupu fookusest

**Katse Chromiumis.** Valisin B-tööriistaga eri komponentide jalad U1.1 ja U2.1. Kolm Shift+Tab vajutust viisid fookuse tööriistariba nupule „Võta tagasi“. Enter lisas positiivse mõõtmise ja plaadi ühenduste arv muutus 0→1. Teises katses valisin takisti R1 mõlemad otsad. Esimene Enter salvestas mõõtmise ja avas kaitseküsimuse. Tab, Tab viis fookuse nupule „Lisa foto“. Seal vajutatud Enter kinnitas „Ühenda ikkagi“ ning lisas R1 jalgade vahele ühenduse.

Akna klahvikuulaja annab Enteri aktiivsele tööriistale. Piiks jätab natiivse aktiveerimise alles ainult oma HUD-i nupul. Piira Piiksu Enter lõuendi ja tema nupurühma fookusega ning kata mõlemad juhtumid päris klaviatuuriga. [Akna klahvikuulaja](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/ui/src/canvas/use-canvas-keys.ts#L69) · [Enter ja kaitse kinnitamine](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/BeepTool.tsx#L292)

### 02 · P1 · Nähtava padjandi sisse tehtud klõps võib salvestada mõõtmise kõrvaljalale

**Katse AppShelli, lõuendi tabamiskontrolli ja päris mootoriga.** Suum oli 1 ja mõõtkava 10 px/mm. U1.1 keskpunkt oli (120, 100), raadius 10 px. Kõrvaljala U1.2 keskpunkt oli (135, 100), raadius 2,5 px. Ankur oli U1.4. Klõps (129,5, 100) asus 0,5 px suure padjandi sees ja 3 px väiksema servast väljas. Enter salvestas positiivse näidu U1.2 ja U1.4 vahel ning lisas samale valele paarile elektriühenduse.

Piiks võtab lõuendi ühe üldtabamuse. Kõrvuti padjanditel võib laiendatud tabamisalaga jalg võita keskpunkti kauguse alusel. Eelista nähtava padjandi täpset tabamust, kasuta puutevaru siis, kui täpne tabamus puudub. Tabamuste loendis on `exact` juba olemas. [Klõpsu tabamus](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/ui/src/canvas/Canvas.tsx#L289) · [Täpne ja laiendatud tabamus](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/ui/src/canvas/hit-index.ts#L219) · [Sondi kontakti valik](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/BeepTool.tsx#L260)

## P2 — töövoog, taastamine ja tulemuse usaldusväärsus

### 03 · P2 · Lahti jäänud kaitseküsimus lisab juba ühendatud jalgade vahele teise ühenduse

**Katse kasutajaliidese ja mootoriga.** Avasin GND ja 5V jalgade Piiksu kaitse. Ühendasin samad võrgud vahekaardilt „Võrgud“ käsuga „Ühenda võrguga…“. Algne kaitseküsimus jäi alles. „Ühenda ikkagi“ lisas teise ühenduse samade otste vahele. Ajalugu oli `beep.record → nets.join → connections.add`. Projekti jäid eri tunnustega `con_3` ja `con_4`. Ühe kustutamine jättis jalad endiselt kokku.

Kinnitus kontrollib kontaktide ja mõõtmise olemasolu, kuid saadab `skipJoined: false` ka pärast võrgu muutust. Kontrolli kinnitamisel värskest hetkeseisust, kas otsad on juba ühendatud. [Kaitse kinnitamine](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/BeepTool.tsx#L112) · [Teine ühendamise tee](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/nets/ui/NetsTab.tsx#L178)

### 04 · P2 · „Mõõda piiksuga“ järel peidab N navigaatori

**Katse Chromiumis.** Valisin olemasoleva mõõtmata ühenduse ja vajutasin kontekstis „Mõõda piiksuga“. Sondid ning nupud avanesid õigel paaril, aga fookus jäi käivitusnupule. Kohe vajutatud N peitis navigaatori, valikud jäid ekraanile ja mõõtmisi lisandus 0. Sama käivitusteed kasutab „Mõõda uuesti“. Otse lõuendilt valitud paaril salvestas N ühe negatiivse näidu.

Vii kontekstist käivitatud Piiksu fookus lõuendile või avatud nupurühma. N-i kohalik prioriteet saab siis toimida koos navigaatori otseteega. [Kontekstinupu käivitus](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/MeasureAgain.tsx#L55) · [N-i fookusetingimus](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/BeepTool.tsx#L192) · [Navigaatori klahv](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/ui/src/shell/keymap.ts#L91)

### 05 · P2 · Võrgu detailides näevad positiivne ja negatiivne näit välja ühesugused

**Katse võrgu detailivaates.** Salvestasin samale jalapaarile võrdse ajatempliga esmalt „piiksub“ ja seejärel „ei piiksu“. Mõõtmiste üldloend eristas tulemusi ja ühenduse tase arvestas viimast negatiivset näitu. Võrgu detailides oli mõlema väärtuse kohal kriips ja varem lisatud näit seisis eespool. Selle vaate järgi ei saa tehnik teada viimase läbivuskatse tulemust.

Detailivaate vormindaja käsitleb pinget ja ülekoormust ning sort võrdleb ainult aega. Kasuta läbivuse kuvamisel ja võrdsete aegade järjestamisel samu reegleid nagu mõõtmiste loendis. [Võrgu näidu tekst](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/nets/ui/net-details.ts#L46) · [Võrgu näitude järjestus](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/nets/ui/net-details.ts#L90) · [Läbivust arvestav vormindus](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/measurement-display.ts#L5)

### 06 · P2 · Undo järel pakub Piiks tegevust puuduvale ankrule või tühistatud mõõtmisele

**Kaks kasutajaliidese katset.** Valisin värskelt lisatud jala J8.1 mustaks sondiks ja võtsin jala lisamise Ctrl+Z-ga tagasi. Must rõngas kadus, aga tööriist palus valida punast sondi. Järgmise elus jala klõps avas salvestusnupud ja salvestamine lõppes veaga. Teises katses võtsin avatud kaitseküsimuse ajal tagasi selle tekitanud mõõtmise. „Ühenda ikkagi“ jäi nähtavale ning lõppes samuti veaga. Mõlemas katses tõrjus mootor kehtetu muudatuse.

Sünkrooni ankur, valitud kontakt ja kaitseküsimuse mõõtmise tunnus projekti hetkeseisuga. Kui ankur kaob, peaks järgmine jalaklõps valima uue musta sondi. [Kinnituse kontroll](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/BeepTool.tsx#L115) · [Ankru kasutamine](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/BeepTool.tsx#L272) · [Tööriista juhis](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/BeepTool.tsx#L332)

### 07 · P2 · Piiksu kaitse jätab puuduva rolli tunnuse küsimusest välja

**Katse kahe puuduva rolliga sünteetilisel projektil.** Sildid viitasid tunnustele `rol_missing_a` ja `rol_missing_b`. Ühendamine peatati õigesti, aga küsimus oli „Ühendamine liidaks võrgud . Ühendan ikkagi?“. Ühe olemasoleva ja ühe puuduva rolliga ilmus vaid olemasoleva nimi. CSV ja võrgu detailide hoiatus kuvasid samade andmete korral puuduvad tunnused.

Kaitse otsustab konflikti tunnuste järgi, kuid küsimusele antav nimekiri koostatakse ainult olemasolevatest rollidest. Säilita mõlema rolli identiteet ja kuva puudumisel sama varutekst nagu võrkude vaates. [Kaitse rollinimekiri](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/domain/src/rules/beep.ts#L69) · [Kaitseküsimus](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/BeepTool.tsx#L222) · [CSV ja võrgu varutekst](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/nets/contract.ts#L75)

### 08 · P2 · Millisekundist täpsem kellaaeg võib anda vale ✓

**Katse mootori avaliku käsuga.** Lisasin samale rajale esmalt negatiivse mõõtmise kell `12:00:00.123900Z`, seejärel tegelikult varasema positiivse kell `12:00:00.123100Z` samal kuupäeval. Mõlemad `measurements.add` käsud õnnestusid. Pärast esimest oli tase `visual` ja `noContinuity: true`. Pärast teist oli tase `measured` ja negatiivse tulemuse märge kadus. Mõlemad täpsed ajatemplid jäid dokumenti alles.

Skeem lubab mikrosekundeid. `Date.parse` taandab mõlemad siin samale millisekundile ning otsustama pääseb sisestusjärjekord. Rakenduse enda praegused nupud annavad millisekunditäpsuse. Viga puudutab täpsema ajatempliga avatud dokumenti või käsusisendit. Võrdle kehtivaid aegu sisendi täpsusega, säilitades võrdse aja korral senise järjestuse. [Ajatempli skeem](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/domain/src/model/primitives.ts#L5) · [Viimase tõendi valik](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/domain/src/rules/levels.ts#L29)

### 09 · P2 · Sama musta sondiga hargnenud võrgus ületab taseme arvutus kaardi 3 ms eelarve

**Katse Node'is.** Kõigil kolmel sünteetilisel plaadil oli 300 komponenti, 3000 jalga, 1000 ühendust ja 1500 mõõtmist, neist 500 aktiivset läbivuspaari. Mõõtsin ainult `connectionLevels`-i, 10 soojendus- ja 30 mõõtejooksu paigutuse kohta. Eraldiseisvate ühendustega võrdlusplaadi mediaan oli **3,17 ms**. Sama ankru ja 500 liitepunktiga ahelas oli see **23,54 ms**, tähtvõrgus **18,34 ms**. Suur erinevus kordus teises jooksuseerias. Kaardi 2 enda plaadil on dokumenteeritud 1,61 ms.

Iga aktiivne jalapaar käivitab eraldi laiutiotsingu. Sama ankru mõõteseerias läbitakse ühiseid lõike sadu kordi. Lisa hargnenud võrgu jõudluskatse ja taaskasuta teeotsingut või selle tuletist, säilitades võrdsete teede valiku. Tauri lohistuse 40,68 fps ja 0,2 ms varu on varasemad eraldi mõõtmised. [Teeotsing](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/domain/src/rules/levels.ts#L59) · [Kutse iga paari kohta](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/domain/src/rules/levels.ts#L90) · [Tuletise sõltuvused](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/connections/engine/derive.ts#L6)

### 10 · P2 · Mõõda-ploki „Ei piiksu“ salvestab all hoitud Enteriga mitu näitu

**Katse Chromiumis.** Valisin Mõõda-plokis läbivuse, takisti kaks jalga ja viisin fookuse nupule „Ei piiksu“. Üks Enteri allavajutus ja kolm klahvikordust enne vabastamist lisasid ajalukku **neli** negatiivset mõõtmist. Sama sündmuste jada nupul „Piiksub“ lisas **ühe** mõõtmise.

Positiivse nupu Enter ja Alt+N kontrollivad kordust. Negatiivse nupu tavaline klaviatuuriaktiveerimine läheb otse klõpsukäsitlejasse. Piira korduv Enter ka sellel nupul ning säilita uue eraldi vajutuse võimalus. [Korduse kontroll](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/MeasureBlock.tsx#L157) · [Negatiivse näidu nupp](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/MeasureBlock.tsx#L289)

## P3 — väiksema mõjuga kuvavead

### 11 · P3 · Kahe füüsilise padjandiga jalal joonistatakse sond vale padjandi juurde

**Katse mitme padjandiga sünteetilisel komponendil.** Korpuse padjandid 1 ja 4 olid seotud sama loogilise jalaga. Klõpsasin teisel padjandil punktis (198,1, 100), aga punane rõngas ja nupurühm ilmusid esimese juurde (121,9, 100). Vahe oli **76,2 px**. Kordus musta sondiga näitas sama nihet. Mõõtmisele salvestatud loogiline jalg oli õige.

Kuvamisel kasutatakse esimese sobiva padjandi keskpunkti. Säilita klõpsatud füüsilise padjandi identiteet tööriista ajutises olekus. [Padjandi valimine ja sondid](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/BeepTool.tsx#L19) · [Nuppude asukoht](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/measurements/ui/BeepTool.tsx#L205) · [Padjandite geomeetria](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/domain/src/geometry/board.ts#L83)

### 12 · P3 · Teise kihi ristuv rada võib ✓ täielikult varjata

**Katse Chromiumi pikslivõrdlusega.** Alumise kihi mõõdetud rada ristus märgi keskpunktis ülemise aktiivse kihi sõltumatu rajaga. Laius oli 0,3 mm, mõõtkava 10 px/mm ja suum 8. Mõõdetud raja ✓ sisse- ja väljalülitamisel olid märgi ümber oleva 30 × 30 px ala pikslid identsed. Kui eemaldasin ristuva raja, tekkis samal võrdlusel nähtav erinevus. Tuletatud tase püsis kogu katse vältel õige.

Iga rada joonistab oma märgi kohe joone järel. Hilisem läbipaistmatu rada saab selle katta. Joonista märgid pärast radade jooni ja säilita nende kuuluvus õigele kihile. [Märgi joonistamine](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/connections/ui/layers.tsx#L197) · [Radade joonistusjärjekord](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/connections/ui/layers.tsx#L232) · [Märgi geomeetria](https://github.com/Fuuduuu/BB/blob/5f4ffae11ab811d42fb858efda61a371c8c5cf40/packages/features/connections/ui/level-mark.tsx#L52)

## Soovitus

**Enne Piiksu tööriista vastuvõttu paranda 01 ja 02.** Vastuvõtukatses kontrolli pärast klaviatuuriga kõrvalnupu aktiveerimist nii mõõtmiste kui ühenduste arvu. Tiheda jalapaigutuse katses kontrolli salvestatud paari mõlemat UID-d. Nii avastab test ka vea, mille korral ekraanile ilmuv ✓ tundub usutav.

**Enne v0.6.0 kasutajakatset** parandaksin kaitseküsimuse ja ankru aegumise (03, 06), kontekstist käivitatud N-i (04), võrgu näitude kuvamise (05) ja korduskirjed (10). Rollitunnused (07) ning ajatäpsus (08) vajavad sihitud parandust enne vastava andmestiku vastuvõttu. Jõudluse puhul (09) kordaksin sama ankruga katset Tauris enne „50 jalga alla 2 minuti“ katset. Kaks P3 kuvaviga võivad oodata. Enne väljalaske otsust tuleb saada tavakeskkonnas roheline `pnpm check` ja `pnpm e2e`.

## Arhitekti triaaž (2026-11-21)

Kõik 12 leidu on õiged. Need kuuluvad M2.2-sse, sest puudutavad just tehtud koodi. Parandused lähevad kolme kaardiga enne vastuvõttu ([plaani Osa E](../plans/M2-2-piiksumisreziim.md)):

| Kaart | Leiud | Rada | Sisu |
|---|---|---|---|
| ül. 8 · Piiksu sihtimine ja klahvid | 01, 02, 04, 10, 11 | A | Enter ainult lõuendi või Piiksu nuppude fookusest. Piiks eelistab nähtava padjandi täpset tabamust. „Mõõda piiksuga“ viib fookuse Piiksule. „Ei piiksu“ ei salvesta kordusklahviga mitut näitu. Sond kuvatakse klõpsatud padjandi juures. |
| ül. 9 · Piiksu olek ja näidud | 03, 05, 06, 07 | A | „Ühenda ikkagi“ kontrollib värsket seisu. Ankur ja kaitseküsimus aeguvad koos projektiga (Undo). Kaitseküsimus näitab puuduva rolli tunnust. Võrgu detailid näitavad läbivuse tulemust ja võrdse aja järjekorda nagu mõõtmiste loend. |
| ül. 10 · Ühenduse taseme täpsus ja jõudlus | 08, 09, 12 | B | Ajatemplid võrreldakse sisendi täpsusega. Teeotsingut taaskasutatakse, sama ankruga hargnenud võrk mahub 3 ms eelarvesse. ✓ joonistatakse pärast radade jooni. |

P1 leiud 01 ja 02 parandatakse esimesena. Vastuvõtukatse (ül. 11) kontrollib Astra soovitusel kõrvalnupu klaviatuuriaktiveerimise järel mõõtmiste ja ühenduste arvu ning tiheda paigutuse katses salvestatud paari mõlemat UID-d. Sama ankruga jõudluskatse korratakse Tauris enne kasutuskatset „50 jalga alla 2 minuti“.
