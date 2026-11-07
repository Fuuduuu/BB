# BB: kuidas mina rakenduse algusest lõpuni valmis ehitaksin

**Koostaja:** Codex · **Kuupäev:** 2026-11-07 · **Staatus:** iseseisev uuring ja soovitus kasutaja tellimusel.

**Kõige tähtsam on kasutajamugavus:** foto taustaks → komponendid peale → muudetav skeem → ühenduste mõõtmine → märgistatud rajad. Selle dokumendi ettepanekud ei tähenda, et rakendus oleks juba ehitatud või ADR-003 vastu võetud. Rakenduskoodi, prototüüpi ega põhidokumente 01–08 selle uuringuga ei muudeta.

## 1. Minu otsus

Ehitaksin **ühe kohaliku töölaua kahe omavahel seotud lõuendivaatega: Plaat ja Skeem**. Mõlemas saab töötada. Mõlemad kasutavad sama komponenti, samu jalgu, sama ühenduste mudelit ja samu mõõtmisi. Vahetub esitus, mitte projekt ega andmete tõde.

Jätaksin alles TypeScripti, Reacti, Tauri 2 ja SQLite'i. ADR-003 v2 kohalik sünkroonne mootor on sobiv alus, kuid täpsustaksin andmemudelit enne päris ehitamist. Suurim muudatus on muudetav skeem kohe põhiteekonnas; teine on elektrilise ühenduse eristamine fotol oleva raja kujust.

Minu kaheksa põhiotsust:

1. **Foto ja komponendid enne halduspaneele.** Esimene töötav osa peab laskma fotole komponendi paigutada, salvestada ja uuesti avada.
2. **Skeemi saab avada kohe.** Puuduv foto, korpus, mõõtkava või ühendus ei keela skeemil töötamist.
3. **Komponendi saab lisada kummaski vaates.** Skeemil lisatud komponent ootab fotole paigutamist; sellest ei looda teist komponenti.
4. **Mõõtmine, ühenduse otsus ja raja joonistus on eri asjad.** Ühe olemasolust ei mõelda teisi juurde.
5. **Ühendus sõltub selgetest otstest ja liitepunktidest.** Joone lähedus ega ristumine ei ühenda võrke iseenesest.
6. **Teadmata väärtus jääb teadmata.** Uuele takistile ei panda päris väärtuseks automaatselt 10 kΩ ega tundmatule transistorile oletatud jalgade funktsioone.
7. **Valik ja mõõtmise koht on nähtavad ning püsivad.** Ükski filter, paneel ega automaatpaigutus ei vaheta neid kasutaja eest.
8. **Valmis tähendab läbitud tervikteekonda päris töölauaäpis.** Ilus näidis ja brauseritestid üksi seda ei tõesta.

## 2. Mida kontrollisin ja millele see soovitus toetub

Kohalik repo: `C:\Users\TRUMPIT\Desktop\BB`, haru `main`, kontrollitud HEAD `06dff94`. Uuringu alguses olid AI stardifailid ja kahe README muudatused commit'imata; säilitasin need. Uue rakenduse `apps/` ja `packages/` teostust veel pole. Olemas on dokumentatsioon ja JavaScripti veebiprototüüp.

| Allikas | Mida sellest kasutasin |
|---|---|
| `docs/01-pohimotted.md`, `02-kasutaja-teekond.md`, `06-kasutajaliides.md` | töökoja kasutaja, foto keskne töölaud, otsene muutmine, mõõtmise sisestus, vaadete käitumine |
| `docs/03-arhitektuur.md`, `04-andmemudel.md`, `05-moodulid.md`, ADR-003 v2 | mootori piir, käsud, omand, salvestus, jalgade ja ühenduste mudel |
| `docs/07-teekaart.md`, `08-benchbeepi-opetused.md` | praegune ehitusjärjekord ja varasema projekti vead |
| `prototype/src/js/01-footprints.js` kuni `08-boot.js`, `src/index.html`, `app.css` | tegelikud korpused, renderdus, valimine, rajad, failid ja näidisplaat |
| `C:\dev\TraceBench\docs\POHIKIRI.md`, `UI_WORKFLOWS.md`, `WORKFLOW_FINDINGS.md` | sihtmärgi vahetumine, topeltobjektid, paneeli avanemisel hüppav lohistamine ja nähtamatu lisamisrežiim |
| KiCadi ja LibrePCB ametlik dokumentatsioon | elektriliste ühenduste, sümbolite, korpuste ja jalgade vastavuse läbiproovitud põhimõtted |
| Reacti, SQLite'i, Tauri, brauseri API-de, ELK-i ja W3C ametlikud allikad | tehniliste valikute võimalused ja piirangud; viited on vastavate otsuste juures |

Näidise visuaalse lähtealusena kasutasin varasema ülevaatuse ekraanipilti ja praegust lähtekoodi. Selles uuringus uut interaktiivset läbimängu ei tehtud: brauseri turvareegel keelas kohaliku `file:`-URL-i avamise. Allpool olevad kasutatavuse mõõdikud ja jõudlusnumbrid on **vastuvõtueesmärgid, mitte saavutatud tulemused**.

### Mida Claude'i tööst alles jätaksin

Foto keskne töölaud, vase ja rohelise visuaalne keel, pidevalt kättesaadav foto nähtavus, korpuste parameetriline geomeetria, jala küljes püsivad ühenduste otsad ning käsitsi kaardistamine on hea lähtekoht. Alles jäävad ka kohaliku mootori piir, UI eelvaade, üks tagasivõtmise ajalugu ja nähtav salvestuse olek.

Prototüüpi kasutaksin **käitumise ja geomeetria allikana**, mitte uue rakenduse tuumana. Näiteks `02-state.js:83` arvutab võrke geomeetrilise lähedusega, `02-state.js:137` salvestab ajalukku terve dokumendi stringe, `02-state.js:180` peidab automaatsalvestuse vea ning `03-render.js:132` asendab kogu stseeni HTML-i. Need on prototüübi kompromissid; ADR-i kavandatud mootor ja salvestus lahendavad neist mitu juba põhimõtteliselt ära.

## 3. Kaalutud ülesehitused

| Variant | Eelis | Puudus BB jaoks | Minu valik |
|---|---|---|---|
| Jätkata prototüübi laiendamist | kõige kiiremini järgmine nähtav nupp | ühine muudetav globaalolek, käsud ja salvestus segunevad UI-ga; skeemi lisamine kasvatab sama probleemi | hoian prototüübi võrdluseks |
| Ehitus üldise sõlmeredaktori peale, nt React Flow | valmis valimine, vaade, ühenduspunktid ja kohandatavad sõlmed | foto, täpne korpuse geomeetria, füüsilised padjandid ja skeem nõuavad ikkagi oma domeeni ning palju erikäitumist | ei vali põhialuseks |
| Reacti töölaud, ühine väike lõuenditaristu, eraldi plaadi- ja skeemikihid, kohalik mootor | sama sisestusloogika ja andmed, kontrollitavad piirid, renderer vahetatav mõõdetud vajaduse korral | lõuendi tabamine, tööriistad ja geomeetria tuleb hoolikalt teha | **valin selle** |

React Flow toetab kohandatud sõlmi ja mitut identifitseeritavat ühenduspunkti. See muudab ta tõsiseks alternatiiviks, kuid ei lahenda ise elektroonika andmemudelit. Ülaltoodud sobivushinnang on minu järeldus, mitte jõudlusvõrdluse tulemus. [Kohandatud sõlmed](https://reactflow.dev/learn/customization/custom-nodes), [ühenduspunktid](https://reactflow.dev/learn/customization/handles).

Mootorit Rusti ümber ei kirjutaks ja kohalikku veebiserverit ei lisaks. Praegused vajadused ei tasu seda lisakeerukust ära. Avalik pluginasüsteem, mikroteenused ja sündmustest taastatav tõe torustik jäävad samuti välja.

## 4. Põhiteekond kasutaja jaoks

Tööriistad on alati kättesaadavad. Allolev järjekord aitab alustada, kuid pole kohustuslik viisard.

| Samm | Kasutaja teeb | Rakendus teeb | Mida ei nõuta |
|---|---|---|---|
| 1. Foto | lohistab või kleebib pildi | loob projektifaili, näitab pilti ja salvestuse olekut | projekti kirjeldust, mõõtkava ega kontot |
| 2. Komponendid | valib teegist komponendi või märgib tundmatu ala | lisab ühe komponendi, tähise ja vajadusel jalad | väärtust ega täpset korpust |
| 3. Märgistus | soovi korral lisab tähise, korpuselt loetud teksti või väärtuse | hoiab need eri väljades; sildi asukohta saab muuta | kõigi komponentide kohest tuvastamist |
| 4. Skeem | avab Skeemi ja lisab või paigutab sümboleid | kasutab samu komponente; pakub puuduvad sümbolid paigutamiseks | lõpuni kaardistatud plaati |
| 5. Mõõtmised | valib kaks jalga ja sisestab näidu või piiksu | salvestab tulemuse täpselt sellele paarile | nähtavat vaskrada ega automaatdiagnoosi |
| 6. Rajad ja nimed | ühendab jalad ning joonistab teadaoleva tee fotol | kuvab võrgu nime, märgistuse ja teadmise päritolu | kõigi radade füüsilise marsruudi teadmist |
| 7. Jätkamine | sulgeb ja avab projekti | taastab dokumendi, fotod, skeemi ja vaate | eksportimist enne sulgemist |

### 4.1 Foto ja esimene komponent

Esimesel avamisel on suur lohistusala, „Vali foto“, „Jätka ilma fotota“ ja „Ava näidis“. Näidis avaneb eraldi koopiana; oma foto lisamine ei kirjuta olemasolevat projekti ootamatult üle.

Foto laadimise järel on kasutaja kohe lõuendil. Vaikimisi on foto lukus, et komponendi haaramisel ei liiguks taust kaasa. Nähtavuse liugur ja „Sobita“ on kogu aeg leitavad. Kalibreerimise ettepanek on väike vihje, mitte järgmine kohustuslik ekraan.

Komponendi lisamiseks on kaks teed:

- **Tean korpust:** vali näiteks SOIC-8, klõpsa fotol, joonda kaks jalga või muuda suurust.
- **Ei tea komponenti:** märgi ala, tekib `X1`, tüüp „Teadmata“. Jalgu saab lisada käsitsi. Hilisem korpuse või tüübi määramine muudab sama objekti.

Paigutusrežiim jääb sama tüübi kordamiseks sisse ning on selgelt märgistatud. `Esc` lõpetab selle. Tavalises valimisrežiimis tühjal kohal klõpsamine midagi ei lisa.

**Väärtuse lahter on algul tühi.** Teegi soovitus võib olla sisestusvihje, kuid ei tohi muutuda tuvastatud faktiks. Prototüübi `01-footprints.js:182–190` ja praeguse teekonna § 6.1 näidisväärtusi ei tooks päris andmetesse üle.

### 4.2 Märgistus peab tähendama üht asja korraga

| Kasutajale nähtav väli | Näide | Otstarve |
|---|---|---|
| Tähis | `R12`, `U3` | komponendi nimi projektis; automaatne, muudetav |
| Korpuse märgistus | `103`, `A7W`, `AMS1117` | täpselt see tekst, mida kasutaja detaililt loeb |
| Väärtus või mudel | `10 kΩ`, `AMS1117-3.3` | kasutaja tuvastatud tähendus |
| Jala nimi | `VCC`, `OUT` | kontakti funktsioon, kui teada |
| Võrgu nimi ja roll | `VBUS`, `5V`, `GND` | ühendatud jalgade ühine tähendus |
| Mõõtenäit | `3,28 V`, `OL` | konkreetse mõõtmise tulemus, mitte komponendi väärtus |

Fotol on vaikimisi ainult tähis; väärtused ja muud tekstid saab sisse lülitada. Valitud objekti oluline info on alati loetav. Sildi lohistamine muudab sildi nihket, mitte komponendi asukohta. Vabateksti saab lisada ka rajale või alale.

### 4.3 Muudetav skeem

„Skeem“ on sama projekti teine tööpind, millel saab:

- lisada, liigutada, pöörata ja nimetada komponente;
- joonistada ühendusi jala ja jala või liitepunkti vahele;
- lisada võrgu silte, toite-/maandussümboleid ja märkusi;
- valida jalgu ning sisestada neile mõõtmisi;
- valida komponendi ja kasutada tegevust „Näita plaadil“.

**Skeemil lisatud komponent ei saa väljamõeldud asukohta fotol.** See ilmub nimekirja „Plaadile paigutamata“. „Paiguta plaadile“ võtab olemasoleva komponendi kursori alla; paigutamisel säilivad id, jalad, ühendused ja mõõtmised. Vastupidises suunas on fotol lisatud komponendid „Skeemile paigutamata“ loendis.

Foto kontuuriga tundmatu komponent võib skeemil olla numbriteta kast, kuni kasutaja lisab kontaktid. Kui korpus on teadmata, saab skeemil siiski alustada kahe jalaga takisti või nummerdatud IC-kastiga.

Esialgu piisab käsitsi paigutusest, võrgusiltidest ja täisnurga all juhitavatest ühendusjoontest. **Automaatpaigutus tuleb hiljem abilisena**, mitte skeemi avamise eeltingimusena. „Paiguta lisamata komponendid“ ei liiguta kasutaja senist tööd. „Paiguta valik uuesti“ on eraldi tagasivõetav tegevus.

See lähenemine kasutab EDA-s levinud eristust: loogiline komponent ja sümbol saavad olemas olla enne konkreetset korpust ning paigutust. LibrePCB kirjeldab seda selgelt; BB jaoks kasutaksin selle väikest vajalikku osa. [LibrePCB komponendi, seadme ja korpuse eristus](https://librepcb.org/docs/quickstart/create-project/schematics/).

### 4.4 Mõõtmine ilma sihtmärgi eksimiseta

Paremas paneelis on mõõtmise ajal alati nähtavad **Punane sond**, **Must sond**, režiim, näit ja toite olek. „GND“ üksi pole piisav koht: näidatakse ka tegelikku jalga, näiteks `J1.2 · GND`.

1. Kasutaja valib punase sondi koha.
2. Ta valib musta sondi koha; juba kasutaja valitud vastaspunkti võib sama mõõtmisjada jooksul hoida lukustatuna.
3. Sisestab näidu, näiteks `3,28`, `4k7`, `680m` või `OL`.
4. `Enter` või „Salvesta mõõtmine“ lisab ühe mõõtmise ja jätab sisestuse valmis järgmiseks.

Vaikimisi ei valita esimest GND-jalga kasutaja eest. Praeguse `02-kasutaja-teekond.md:223` automaatse vastaspunkti muudaksin selgeks soovituseks, mille kasutaja kinnitab. Esialgne toite olek on „Teadmata“, mitte vaikiv „Toitega“.

Mõõtmise mustand seotakse seansi ja konkreetsete jalgadega. Selle `at`, `ref`, `mode`, `power` ja tekst loetakse salvestamisel samast mustandist. Neid ei panda kokku ühe globaalse valiku ja teise vormivälja juhuslikust hetkeolukorrast.

Paneeli, filtri ja Plaat/Skeem vahetus mustandit ei liiguta. Teise jala teadlik valimine avab selle oma mustandi. Kui sihtmärk on peidetud, säilib nähtav Koha kiip koos „Näita“ tegevusega; rakendus ei asenda teda nähtava esimese komponendiga. Kustutatud sihtmärgi mustand säilib selgitusega, kuid seda ei saa salvestada enne koha parandamist.

`Tab` liigub tavapäraselt vormiväljade vahel. Järgmisele jalale on nähtavad „Eelmine / Järgmine jalg“ nupud ning kiirtee `Alt+↓ / Alt+↑`. See väldib olukorda, kus tavapärane klaviatuuriga vormis liikumine muudab mõõtmise kohta. Sisestusväljas ei käivitu `R`, `T`, `V` ega muud lõuendi täheklahvid.

Toiteta mõõtmise režiimi ja märgitud toite oleku vastuolu näidatakse samas plokis. Pinge ilma vastaspunktita võib jääda ajalukku „vastaspunkt määramata“ märkega, kuid automaatset hinnangut ei anta. Läbivus, takistus ja diood vajavad kahte selget kontakti. Hinnangut „OK“ nimetatakse vajadusel „Vastab oodatule“, et see ei kõlaks terve plaadi diagnoosina.

### 4.5 Piiks ja võrku ühendamine

Valin vaikimisi konservatiivse, kuid kiire sisestuse:

- **„Piiksub“** salvestab mõõtetulemuse.
- **„Piiksub ja ühendan“** salvestab tulemuse ning ühendab sama jalapaari ühe tagasivõetava käsuga.
- **„Ei piiksu“** salvestab negatiivse tulemuse.
- `Esc` katkestab. See ei salvesta vastust „Ei“.

Must sond võib jääda üheks ankruks ja punasega saab edasi liikuda. Kiirklahvid kuvatakse nuppude peal; `Enter` kinnitab valitud tulemuse, `Ctrl+Enter` on selles režiimis selgelt nähtava „Piiksub ja ühendan“ kiirtee. Ühendamist ei lubata ainult vihjena peidetud püsiseade kaudu.

Piiks ei tõesta sama vaskrada: paralleelne tee võib kulgeda läbi teiste komponentide ka siis, kui valitud kontaktid pole sama takisti otsad. Seetõttu ei piisaks mulle praegusest kahest automaatühenduse erandist. Rollikonflikt ja sama passiivkomponendi otsad annavad lisahoiatuse, kuid põhiline eristus on nähtaval nupul kõigi paaride puhul.

### 4.6 Rajad ja märgistused

Kasutaja saab teadaoleva elektrilise ühenduse valida ja vajutada „Joonista rada fotol“. Ta klõpsab alguses, vajalikud käänud ja lõpu. Jala või olemasoleva liitepunkti külge haakumine on enne klõpsu esiletõstetud. Tühjal kohal lõpetamisel tekib lahtine ots, mitte varjatud ühendus lähima rajaga.

Kui kasutaja alustab uut rada otse kahe jala vahele, loob üks käsk nii ühenduse kui selle fotojoonistuse. Skeem näitab ühendust kohe. Kui ühendus on juba olemas, lisatakse selle joonistus ilma dubleeriva elektrilise sidemeta.

Rajal saab näidata võrgu nime, mõlema otsa tähist, märget „nähtud / oletatud“ ja viimast sobivat läbivuse tulemust. Füüsilise vaskraja tõendatust ei esitata mõõdetud jalapaari põhjal kindla faktina. Ilma teadaoleva marsruudita ühendus on õhuke katkendlik õhujoon, mida saab kihina peita; seda ei joonistata väljamõeldud vaskrajaks.

## 5. Ekraani ülesehitus ja kasutamise reeglid

```text
Projekti nimi · Salvestatud       [Plaat | Skeem]        Tagasi / Uuesti · Eksport
┌──────────────────┬───────────────────────────────────┬────────────────────────┐
│ Lisa / Otsi      │                                   │ Valitud objekt         │
│ Komponendid     │          AKTIIVNE LÕUEND           │ Tähis, väärtus, märk   │
│ Võrgud          │      foto VÕI muudetav skeem       │                        │
│ Mõõtmised       │                                   │ Punane: U1.8           │
│ Märkmed ja logi │   Vali · Lisa · Ühenda · Mõõda     │ Must: J1.2 · GND       │
│                 │                                   │ Näit [        ]        │
│ Paigutamata (2) │                                   │ [Salvesta mõõtmine]    │
└──────────────────┴───────────────────────────────────┴────────────────────────┘
Foto nähtavus / skeemi kuvamine · Kihid                         Suum · Sobita
```

- Töövoo edenemine on tagasihoidlik abiline. See ei võta ülaribal ära Plaat/Skeem lülitit ega salvestuse olekut.
- Alguses on korraga üks suur lõuend. Kahe vaate kõrvutamine lisandub alles siis, kui suurte ekraanide kasutuskatse selle kasu näitab. Vahetamisel säilib kummagi suum ja asukoht.
- „Näita teises vaates“ viib sama objekti juurde. Tavaline valik ei tee automaatset suumimist ega lõuendi hüpet.
- Kontekstipaneeli jaoks on laial ekraanil koht reserveeritud; selle avanemine ei liiguta kursori all olevat objekti. Kitsamas aknas on paneel ülekattena ja kokkupandav.
- Tavatekst on vaikimisi 14 px, abitekst vähemalt 12 px; kasutaja saab UI mõõtu suurendada. Oluline näit ja Koha kiip on suuremad. Põhitöö peab mahtuma 1280 × 720 aknasse ka Windowsi 125% skaleeringu korral.
- Põhinuppude sihtala on 40 × 40 CSS px. Tihedaid jalgu ei paisutata fotol üksteise peale: kasutatakse lähima kandidaadi esiletõstu, vajadusel suurendust ja sama jala valimist paneeli loendist.
- Värvile lisandub kuju või tekst. GND, valik, hoiatus ja mõõtetulemus peavad eristuma ka tumedal fotol.
- Lohistamise kõrval on „Paiguta siia“, numbriväljad ja nihutamisnupud. Kõiki täpseid toiminguid ei tehta ainult lohistamisega.
- Tööriist, mõõtmise toite olek ja kaks sondikohta on nähtavad. Valiku puudumisel on aus tühi olek, mitte automaatselt esimene komponent.

Nende sihtalade ja lohistamise alternatiivide aluseks kasutan W3C juhiseid; see ei ole väide, et kavand või prototüüp juba vastab kogu WCAG-le. [Sihtala suurus ja erandid](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [lohistamise alternatiivid](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).

## 6. Andmemudel: üks elektriline tõde, kaks paigutust

Praegune `Component` nõuab korraga korpust ja foto asukohta (`04-andmemudel.md:53–69`). `schematic.placements` lisab ainult sümboli asukoha. See ei kata veel skeemil alustatud, fotole paigutamata komponenti ega sümboli kontaktide kindlat vastavust füüsilistele padjanditele.

Minu minimaalne mudel oleks järgmine. Need on ettepaneku objektinimed, mitte juba olemasolevad koodifailid.

| Objekt | Püsiv tähendus ja vajalik info |
|---|---|
| `Component` | `id`, unikaalne tähis, tüüp, loetud märgistus, tuvastatud väärtus, märkused, tuvastuse olek; ei vaja olemasoluks foto asukohta |
| `Terminal` | komponendile kuuluv stabiilne `pinId`, nähtav number, valikuline nimi, NC ja aktiivne/arhiveeritud olek; number ja nimi ei ole objekti identiteet |
| `BoardPlacement` | `componentId`, foto/plaadipoole viide, keskpunkt, pööre, suurus, korpus ja padjandi → terminali vastavus; võib puududa |
| `SymbolPlacement` | `componentId`, sümboli tüüp, asukoht, pööre ja sümbolikontakti → terminali vastavus; võib puududa |
| `Junction` | stabiilse id-ga elektriline liitepunkt; võib omada plaadi- ja/või skeemiasukohta |
| `Connection` | kahe terminali või liitepunkti vaheline kasutaja määratud elektriline side, oma id ja alus „oletatud / nähtud“; ei sisalda foto koordinaate |
| `BoardRoute` | ühenduse fotojoonistus: `connectionId`, kiht, käänud, laius ja sildi nihe; ühe ühenduse kohta võib neid olla mitu või mitte ühtegi |
| `SchematicWire` | sama ühenduse skeemijoonistuse käänud; uus elektriline graaf siia ei teki |
| `NetAnnotation` | stabiilsele terminalile või liitepunktile ankurdatud nimi ja roll; arvutatud võrgu ajutist indeksit ei salvestata viitena |
| `Measurement` | konkreetne sondipaar, režiim, väärtus/OL/piiks, toite olek, aeg, märkus ja salvestamise hetke loetavad tähised |
| `TextAnnotation` | komponendi, raja, liitepunkti või vaate juurde kuuluv märkus ja paigutus; tekst ei muuda elektrilist sidet |

**Miks neid eristusi vaja on:** fotojoone kuju, sümboli asukoht ja tegelik ühendatuse otsus muutuvad eri põhjustel. Eraldi paigutusobjekt on sama komponendi esitus, mitte teine komponent ega kinnitamist ootav koopia.

### 6.1 Täpsed ühendamise reeglid

1. Võrk on aktiivsete terminalide ja liitepunktide ühendatud hulk; arvutatakse `Connection`-itest. Ka üksikjalg saab olla eraldi võrk ja kanda silti.
2. Kaks samas kohas olevat punkti pole automaatselt üks punkt. Kaks ristuvat joont pole automaatselt ühendatud.
3. Haru lisamine olemasolevale ühendusele loob selge `Junction`-i ja jagab vajalikud ühendused ühe käsuga. Fotol ja skeemil nähtav täpp tähendab seda päris liidet.
4. Haakumine aitab valida olemasolevat terminali või liidet. Läved on ekraani pikslites; elektriline topoloogia ei sõltu suumist, kalibreerimisest ega joone paksusest.
5. Kihi vahetamine ise ei ühenda pealmist ja alumist rada. Läbiviik ja läbiv jalg sisaldavad selget kihtidevahelist sidet; tavaline pealmise poole SMD-jalg seda ei anna.
6. Võrgu nime või rolli muutmine ei ühenda eraldi võrke. „Ühenda olemasoleva võrku…“ on eraldi selge tegevus. Kaks isoleeritud GND-nimega ala võivad remondis just olla oluline leid.
7. Fotol „Eemalda joonistus“ jätab ühenduse ja skeemi alles. „Kustuta ühendus“ eemaldab elektrilise sideme ning sellega seotud joonistused mõlemast vaatest; mõõtmised jäävad ajalukku. Mõlemad on tagasivõetavad.
8. `N1`, `N2` ja arvutatud võrgu võti on esituse identifikaatorid. Püsivad märkused ja mõõtmised ankurdatakse terminalidele/liitepunktidele, et võrgu jagamine ei kaotaks neid.

KiCad eristab samuti ristuvaid juhtmeid ja teadlikke liitepunkte. BB-s kasutaksin selle lisaks geomeetriale ka selgesõnalise andmereeglina. [KiCad: elektrilised ühendused ja liitepunktid](https://docs.kicad.org/9.0/en/eeschema/eeschema.html#wire-junctions).

### 6.2 Jalad ja korpuse vahetus

Jalad on domeeni identiteedid; nende ekraanikoordinaadid arvutatakse paigutusest. Korpuse `1, 2, 3` ei tähenda ilma mudeli/pinout'i teadmiseta automaatselt `B, C, E` või `G, D, S`. Tundmatu SOT-23 jääb skeemil nummerdatud kastiks, kuni funktsioon on määratud.

Korpuse muutmisel pakutakse vastavust olemasolevate terminalidega. Selge sama-number-sama-jalg juhtum on kiire; mitmetähendusliku vastavuse puhul ei tehta vaikivat ümbertõstmist. Kadunud kontakt arhiveeritakse ning selle aktiivsed ühendused eemaldatakse ühe tagasivõetava käsuga. Mõõtmine säilitab oma algse terminali viite ja teksti.

See lahendab ka praeguse andmemudeli vastuolu: § „Kustutamise reeglid“ jätab mõõtmise alles, kuid § „JSON eksport ja import“ nõuab, et iga `PinRef` viitaks olemasolevale jalale. Mina säilitaksin mõõtmisega seotud arhiveeritud terminalid ja komponendi minimaalse identiteedi. Arhiiv ei ilmu aktiivsete komponentide ega võrkude hulka; import suudab ajaloolised viited siiski kontrollida. `Ctrl+Z` taastab aktiivse seisundi.

### 6.3 Mõõtmised ja remondi järel kehtivus

Mõõtmise väärtus on fakt sellest, mida kasutaja sisestas. Rolli või sildi muutmine ei kirjuta seda ümber. Hinnang on arvutatud abiinfo ning näitab, milliste eeldustega seda arvutati.

Läbivuse tulemus seotakse sondipaariga. A → B ja B → C piiks ei tekita automaatselt A → C mõõtmist. Ühenduste graafi transitiivsus ja reaalselt mõõdetud paaride hulk on erinevad. „Mõõdetud“ märki ei laiendata automaatselt terve võrgu kõigile joontele.

Remonditoiming pakub nähtavalt mõjutatud komponente/võrke ja mõõtmisi. Komponendiga seotud tegevusele saab pakkuda praeguse kavandi reeglit; „parandasin rada“ peab samuti võimaldama valida mõjutatud võrgu või märkida kogu plaadi varasema seisundi. Uuesti mõõtmist vajavad kirjed jäävad ajalukku. Komponendita remont ei tohi jätta muljet, et kõik eelmised tulemused on kindlasti endiselt kehtivad.

### 6.4 Prototüübi import ilma varjatud ühendusteta

Import loob alati uue projekti. Algfaili ega parajasti avatud projekti ei muudeta. Kõigepealt valideeritakse suurused, id-d, geomeetria ja otsesed viited; tulemus vaadatakse enne lõplikku loomist üle.

- Salvestatud otsesed jalaviited teisendatakse kindlateks terminaliviideteks. Vaba ots jääb oma id-ga lahtiseks liitepunktiks. Käänud ja kihid säilivad joonistusena.
- Vana `getNets()` läheduse järgi arvutatud ühendatust kasutatakse ainult **impordi võrdluseks**, mitte uue graafi tõena. Läheduse tõttu ühendatuks peetud, kuid otsese viiteta otsad tulevad loendisse „Kontrolli neid ühenduskohti“.
- Eelvaade näitab nende kohtade asukohta fotol, vana ja uue võrguloendi erinevust ning valikuid „Kinnita liide“ või „Jäta lahti“. Kinnitamine loob selge liitepunkti; seda ei märgita mõõdetuks. Eri kihtide kahtlast liitumist saab kinnitada ainult tegeliku läbiviigu või toetatud kontaktiga.
- Kõiki kohti ei pea kohe lahendama. Kinnitamata kohad jäävad projektis nähtavaks kontrollnimekirjaks ning nendega seotud vanad võrgunimed ei kao märkamatult. Import ütleb enne lõpetamist näiteks „6 ühenduskohta vajavad kontrolli; neid pole veel võrku liidetud“.
- Prototüübi raja tekstiline võrgunimi imporditakse ankurdatud märkusena. Sama nimega tekstid ise võrke ei ühenda. Vana väärtust ei kustutata, kuid kui selle päritolu ei saa tuvastada, kuvatakse see imporditud ja kinnitamata infona, mitte uue tuvastusena.

Vastuvõtukatse sisaldab ühte otsest jalapaari, ühte sama kihi lähedast vaba otsa ja ühte eri kihtide juhuslikku kattumist. Esimene säilib ühendatuna, teine ootab selget kinnitust ning kolmandast ei teki läbiviiku. Kasutaja näeb võrgu muutust enne impordi lõpetamist. Eraldi kontrollitakse vigase faili tagasilükkamist ilma algprojekti puudutamata.

## 7. Arhitektuur ja moodulite piirid

### 7.1 Kihid

| Kiht | Vastutus | Piir |
|---|---|---|
| `domain` | põhitüübid, valideerimine, geomeetria, terminalide viited ja ühendatuse puhtad arvutused | ei tunne Reacti, Taurit ega failisüsteemi |
| `contracts` | käsud, hetktõmmis, projektiteenus, veakoodid | ei hoia olekut ega impordi mootorit |
| `engine` | autoriteetne dokument, käskude atomaarne täitmine, ajalugu, omand, tuletused | ei tunne UI-d, DOM-i ega Tauri API-t |
| `client` | Reacti tellimused ja seansi kontroll | ei muuda dokumenti |
| `ui` | kesta põhikomponendid, lõuendi sisestus, valimine, vaade ja eelvaade | ei impordi mootorit ega tee Tauri `invoke`-i |
| `features/<nimi>` | konkreetse võimaluse leping, mootori käsk/reeglid ja UI koos | avalikud lepingud; teise võimaluse sisefaile ei impordita |
| `adapters` ja Rusti host | failid, SQLite, fotod, dialoogid ja operatsioonisüsteem | domeeniotsuseid ei tehta SQL-is ega UI komponendis |
| `apps/desktop`, `apps/web` | panevad tegelikud sõltuvused kokku | siin on lubatud UI ja mootori ühendamine |

Säilitaksin kerge pnpm monorepo, kuid ei looks ette ühtteist tühja moodulit ega kõiki võimalikke laiendusliideseid. Alguses piisab kahest tüübistatud registrist ja päriselt kasutatavatest kaastöödest. Mooduli „kaks rida registris“ on eesmärk tavalise UI-kaastöö puhul; uus domeenivaldkond vajab õigustatult ka mudelit, käske ja teste.

```text
apps/
  desktop/                         Tauri kompositsioon ja Rusti host
  web/                             sama UI arenduseks ja brauseritestideks
packages/
  domain/                          mudel, viited, geomeetria, ühendatuse arvutus
  contracts/                       avalik rakendusleping
  engine/                          käsud, ajalugu, omand, projektiteenus
  client/                          Reacti tellimine
  ui/                              kit, shell, canvas
  adapters/                        storage-memory, storage-web, storage-tauri
  features/
    components/{contract.ts, engine/, ui/}
    photo/{contract.ts, engine/, ui/}
    connections/{contract.ts, engine/, ui/}
    schematic/{contract.ts, engine/, ui/}
    measurements/{contract.ts, engine/, ui/}
    project/                       algusest olemas; teised lisanduvad vajadusel
tests/
  fixtures/                        sünteetilised plaadid ja vanad failivormingud
  e2e/                             kasutajateekonnad
```

Võrgu nimede/rollide, remondi ja ekspordi moodulid lisanduvad nende ehitamisel. `domain`-isse ei koguta kõiki tulevasi abifunktsioone: näiteks mõõtmise parser ja hindaja võivad olla mõõtmismooduli puhtas mootorialas. Ühine funktsioon viiakse jagatud kohta siis, kui tal on päriselt mitu tarbijat.

### 7.2 Funktsioonid ja klassid

**Puhtad funktsioonid** sobivad geomeetriale, `resolveNets`, `parseReading`, `evaluateMeasurement`, jalgade vastavuse kontrollile ja ekspordi andmete moodustamisele. Neid saab testida ilma brauserita.

**Klass või sulundiga teenus** sobib elutsükli ja ressurssi omava vastutuse jaoks: `DocumentEngine`, `History`, `SaveCoordinator`, `ProjectRepository`, `PhotoStore`, `HitIndex` ja tööriista olekumasin. Neid ei panda pärilushierarhiasse lihtsalt selleks, et rakendus oleks „klassipõhine“.

Konkreetne vastutus elab ühes kohas: näiteks mõõtmise parserit kasutavad paneel ja import, mitte kaks sarnast parserit; sama terminali asukoha funktsiooni kasutavad renderer, tabamine ja eksport. Mõõtmise ärireeglid ei koli universaalsesse `utils.ts` faili.

### 7.3 Käsu täitmine ja olek

1. Käsk saab tüübitud andmed, objekti id-d ning aktiivse seansi.
2. Mootor kontrollib skeemi, viiteid, kirjutuskaitset ja lubatud välju.
3. Koostab järgmise dokumendi ning vajalikud tuletused ajutiselt.
4. Kontrollib tulemuse invariante. Vea korral ei avalda midagi ega lisa ajalugu.
5. Avaldab ühe tervikliku külmutatud hetktõmmise, suurendab `rev`-i ning lisab ühe ajaloosammu ja logikirje.
6. Salvestusjärjekord saab kinnitatud muudatuse. UI näeb kohe uut olekut ja eraldi salvestuse seisu.

`undo` ja `redo` taastavad sisu, kuid `rev` liigub ka neil edasi. `rev` ei ole ajaloo kursori number. Ajalugu hoitakse paikadena, mitte iga hiireliigutuse täieliku dokumendikoopiana.

Olekuid on kolm: **dokument**, **seansi sisestus ja eelvaade**, **salvestatav vaade**. Mõõtmise pooleli tekst on mustand, mitte mõõtmine. Komponendi lohistamine jõuab dokumenti ühe käsuga hiire vabastamisel; `Esc`, `pointercancel` ja projekti vahetus katkestavad eelvaate.

UI saab sügavalt kirjutuskaitstud tüübi ja käitusajal külmutatud JSON-objektid. Pelk TypeScripti `Readonly<BoardDoc>` on madal kaitse; nested massiivide muutmine peab olema välistatud samuti. Reacti tellimiseks kasutaksin `useSyncExternalStore`-i ning stabiilseid, ainult muudatuse järel vahetuvaid hetktõmmiseid. [Reacti hetktõmmise nõuded](https://react.dev/reference/react/useSyncExternalStore).

**Sünkroonne mootor ei koli samal kujul läbipaistvalt Workerisse.** Raske puhta paigutusarvutuse võib teha asünkroonselt ning kontrollida tulemust `sessionId` ja `baseRev` vastu. Kogu mootori teise lõime viimine muudaks käsulepingut ja vajaks uut otsust.

### 7.4 Muutuse lokaalsus

| Tulevane muudatus | Peamine muutmiskoht | Mis peab jääma puutumata |
|---|---|---|
| uus korpus | komponendimooduli korpused, geomeetriatest | salvestus, mõõtepaneel ja kesta juhtloogika |
| uus sümbol | skeemimooduli sümbolid ja kontaktivastavus | komponentide id-d ja mõõteandmed |
| uus mõõterežiim | mõõtmise leping, parser/hindaja ja üks UI-plokk | lõuendi valimise süsteem |
| uus eksport | eksportija ja tema testandmed | käsutäitja ja projekti avamine |
| multimeeter | uus seadmeadapter ja nähtav näidumustandi täitmine | ühenduse otsustamine ja mõõtmise kinnitamine |
| tulevane AI | ettepanekute teenus ja kontrollitud käsud | mõõtmiste allikas, andmete tõe omanik |

## 8. Lõuend, koordinaadid ja jõudlus

Alustaksin SVG-ga ja jagatud sisestustaristuga, kuid plaadi ja skeemi rendererid oleksid eraldi. Foto asub ühe pildikihina, geomeetria vektorina ning HTML-vormid väljaspool stseeni. Renderduselemendid ei ole salvestatav domeenimudel.

Plaadi püsikoordinaadid kasutavad alguses esimese originaalfoto pikslite mõõtu, korpuse geomeetria millimeetreid ja skeem oma ruudustiku ühikuid. Need on eri tüübid ja teisendatakse selgete funktsioonidega. Plaadi tööpinna koordinaadistik jääb püsima ka foto vahetamisel: igal fotopaigutusel on teisendus pildipunktidest plaadi tööpinnale. Esimesel fotol on see algul ühikteisendus. Nii saab hiljem lisada teise foto ilma komponentide koordinaate ümber kirjutamata. Fotota plaadil kasutatakse virtuaalset tööpinda; hilisem foto lisamine ei skaleeri olemasolevaid komponente vaikimisi. Pildile paigutamise/joondamise eelvaade kinnitatakse ühe käsuga.

EXIF-orientatsioon lahendatakse fototöötluses ühes kohas. Originaal säilib, kuvamisvariant normaliseeritakse ning foto paigutuse teisendus rakendub koos kaardistusega. Sama foto asendamine teise eraldusvõime või kadreeringuga vajab joondust või uut fotokihti, mitte vaikset vana tausta vahetust. 2D mõõtkava ei kõrvalda perspektiivimoonutust.

Ekraanipunktist maailma teisendamisel kasutatakse tegeliku stseeni maatriksi pöördteisendust, mitte ainult `x / zoom` arvutust. SVG annab selleks `getScreenCTM`-i; haaratud osuti hoidmiseks on `setPointerCapture`. Need API-d aitavad, kuid paneeli ümberpaigutuse ja katkenud lohistamise reeglid tuleb endal testida. [SVG teisendusmaatriks](https://developer.mozilla.org/en-US/docs/Web/API/SVGGraphicsElement/getScreenCTM), [osuti hõivamine](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture).

Jõudluse jaoks teeksin esmalt lihtsad asjad õigesti: pan/suum ühe stseeniteisendusega, ainult muutunud objektide renderdus, tekstide detailsus suumi järgi, nähtava ala väljajätmine ning ühine ruumiindeks tabamiseks ja haakumiseks. Võrke ei arvutata iga hiireliigutusega ega mõõtenäidu teksti sisestamisel.

**Mõõdetav algne eelarve:** 300 komponenti, 3000 jalga, 1000 ühendust ja kuni 12 MP kuvamisfoto; sama test ka 1000 komponendi / 10 000 jalaga piiride leidmiseks. Võrdlusmasin ja Windowsi skaleering märgitakse tulemuse juurde.

- tavaline käsk → nähtav tulemus: p95 alla 100 ms;
- lohistamine: p95 kaadri tööaeg kuni 22 ms, tavapärane pan/suum sihiga 60 fps;
- tüüpilise projekti avamine: alla 2 s kontrollmasinal; suure foto import mõõdetakse eraldi;
- eelarvet kontrollitakse päris Tauri väljalaske-ehituses, mitte ainult arendusbrauseris.

Kui SVG ei mahu eelarvesse, profileerin esmalt tekste, tabamist ja ülearuseid renderdusi. Seejärel proovin ainult tiheda kihi viimist Canvas 2D-le. Konva/Pixi või WebGL ei tule sõltuvuseks pelgalt igaks juhuks. Ka Canvasel on kihtide, kuulajate ja joonistuse kulu; raamistiku valik ei anna automaatset jõudlusgarantiid. [Konva enda jõudlusjuhised](https://konvajs.org/docs/performance/All_Performance_Tips.html).

Automaatse skeemipaigutuse hilisem kandidaat on **ELK/elkjs**, sest ta toetab ühendusporte ning Workerit. Ta arvutab paigutust, mitte elektrilist skeemi, komponentide tähendust ega tõde. Ühenduste graaf ja kasutaja kinnitatud paigutus jäävad BB omaks. Esmalt katsetaksin 20–50 komponendiga, kas tulemus on remondis loetav; alles siis lisaksin sõltuvuse. [ELK-i ametlik JavaScripti teek](https://github.com/kieler/elkjs/blob/master/README.md).

## 9. Salvestus ja taastamine

Valiksin ühe `.pcbk` SQLite-faili: dokument JSON-ina, fotod/manused eraldi baidiväljadena, vaade oma tabelis ja logi lisatava ajaloona. Fotobaite ei kanta igal käsul läbi Reacti oleku ega JSON-hetktõmmise.

Säilitaksin praeguse lihtsa ühe kirjutaja lähenemise, `journal_mode=DELETE` ja `synchronous=FULL` ning ühe salvestusjärjekorra. Kinnitatud muudatus kirjutatakse 1,5 s tegevuspausi järel, pideva töö ajal hiljemalt 10 s jooksul; sulgemine ja projekti vahetus ootavad `flush()`-i. Salvestuse „õnnestus“ käib konkreetse revisjoni kohta. Kirjutuse ajal lisandunud uuem muudatus ei tohi saada ekslikult „salvestatud“ märget.

Tavalise automaatsalvestuse puhul võib viimane 1,5–10 sekundi töö protsessi ootamatul lõppemisel kaduda. Faili tehinguline terviklus ei tähenda, et veel mälus olev töö oli kettal. Seda vahet näitab kasutajale „Salvestan…“ olek; kinnitatud failikirjutusest peab olema päris test.

Olulised täpsustused praegusele kavandile:

1. **Kettaseisu võrdlus tehingu sees.** `baseRev` kontroll ja dokument koos logikirjetega uuendatakse ühes tehingus. Vigane või vananenud kirjutus ei avalda poolikut tulemust. `rev` peab vastama nii JSON-is kui tabeliveerus.
2. **Faililukk ei taga alati kirjutuskaitstud avamist.** Kui esimene protsess hoiab SQLite'i eksklusiivset lukku, võib teine protsess ebaõnnestuda juba lugemisel. V1-s näitaksin ausalt „Fail on avatud mujal“ ja pakuksin olemasolevat akent või varem loodud varukoopiat. Ei lubaks tingimusteta otseavanevat kirjutuskaitstud vaadet.
3. **Lahti oleva andmebaasi tavalist failikoopiat ei esitata ohutu varundusena.** Rakenduse „Tee koopia“ ja varundus kasutavad SQLite Backup API-t või `VACUUM INTO`-t koos lõpetamise ja vigade kontrolliga. Ka rollback-režiimis võib aktiivse kirjutuse ajal kopeeritud fail olla ebajärjekindel. [SQLite Backup API](https://www.sqlite.org/backup.html), [atomaarse kirjutuse tingimused](https://www.sqlite.org/atomiccommit.html).
4. **Taastamine uude faili.** Ajutine koopia valideeritakse, seejärel saab lõpliku nime. Originaali ei kirjutata taastamise proovimisel üle. Enne migratsiooni jääb alati taastatav varukoopia.
5. **Pikk tööpäev vajab vahekoopiat.** Lisaks enne migratsiooni ja päeva esimesel avamisel tehtavale koopiale teeksin muutunud projektist kuni kord 30 minuti järel varukoopia. Algne piir: 5 viimast vahekoopiat ja 5 päevakoopiat. Suurte fotodega kontrollitakse selle kettakulu ning kasutaja näeb asukohta.
6. **Foto import on terviklik tegevus.** Kõigepealt loetakse ja kontrollitakse fail ning valmistatakse kuvamisvariant, seejärel avaldatakse dokumendiviide koos kestva salvestusega. Viga ei jäta dokumenti puuduvat fotot. Undo jaoks vajalikku fotot ei koristata enne vastava ajaloo lõppu.
7. **Kirjutuskaitstud fail ei tohi muutuda avamise kõrvalmõjuna.** Ruumivabastus, varufotode koristus ja migratsioon ei toimu kirjutuskaitstud projektil. Uuemat vormingut ei sunnita vana skeemi sisse: näidatakse versiooniviga ning ainult tõendatult toetatud vaatlus/eksporti.
8. **Eemaldatud kettale ei lubata terviklikku päästekoopiat.** Mälus oleva dokumendi saab päästa; algfailis kättesaamatute fotode puudumisest tuleb enne jätkamist selgelt teada anda. Koopia edu kontrollib viidatud manuste olemasolu.

SQLite'i lukkude ja samaaegsete kirjutuste käitumist testitakse kahe päris ühenduse/protsessiga. Kohalikku faili toetatakse v1-s; võrguketta või sünkroonkausta samaaegse muutmise töökindlust ei lubata ilma eraldi kontrollita. [SQLite tehingud ja eksklusiivse tehingu mõju lugejale](https://www.sqlite.org/lang_transaction.html).

## 10. Mida olemasolevas kavandis enne ehitamist muudaksin

P0 tähendab siin andmete õigsuse või nõutud põhiteekonna eeldust; P1 olulist kasutamise/parandamise riski; P2 edasilükatavat täiustust. Need on konkreetsed muudatusettepanekud, mitte väited juba ehitatud rakenduse vigadest.

| Prioriteet | Asukoht praeguses repos | Muudatus ja mõju |
|---|---|---|
| P0 | `02` § 13.1, `03` § 8, `05` skeemimoodul, `07` M4 | skeemist saab varajane täisväärtuslik tööpind; muidu kasutaja põhisoov saabub alles suure töö lõpus |
| P0 | `04` § Tüübid: `Component`, `Connection`, `SchematicPlacement` | eraldi valikulised paigutused ja stabiilsed terminalid; skeemil lisatud komponent ei vaja väljamõeldud fotoasukohta |
| P0 | `04` § Võrkude arvutus, `07` M2 läheduse test | geomeetriline automaatliitmine asendada teadliku liitepunktiga; mõõtkava ja joone nihutus ei tohi elektrilist tõde muuta |
| P0 | `02` § 8.3, `04` § Piiks ei tõenda sama vaskrada | mõõtetulemus ja võrku ühendamine nähtavateks eri tegevusteks kõigi paaride puhul; kaks erandit ei kata paralleelseid teid |
| P0 | `04` § Kustutamise reeglid ja JSON impordi terviklus | arhiveeritud terminalid lahendavad ajalooliste mõõteviidete säilimise; oma ekspordi taasimport peab töötama ka pärast kustutamist |
| P1 | `02:223`, `06` § Klaviatuur | must sond kasutaja selge valikuga; `Tab` tavapäraseks fookusliikumiseks; `Esc` ei salvesta negatiivset piiksu |
| P1 | `01` usaldusväärsuse tabel, `04` ühenduse tase | paaril mõõdetud läbivust ei esitata konkreetse vaskmarsruudi tõestusena; eeldus ja mõõtmistulemus näidatakse eraldi |
| P1 | `01` v1 foto punkt, `04` fotod, `07` M5 | teha vahe v1 lihtsal taustal ja hilisemal mitme foto joondusel; juba nüüd foto vahetuse juures kaardistust säilitav reegel |
| P1 | `03` § 9, `02` § 15 | eemaldada tingimusteta lubadused avatud faili kopeerimise ja lukus faili lugemise kohta; kasutada kontrollitud koopiat ja ausat veavoogu |
| P1 | `04` § Remont ja aegumine | rajaparandusele mõjutatud võrgu/ala valik; olulised varasemad mõõtmised ei jää nähtamatult „kehtivaks“ |
| P1 | `07` M0 näidismoodul `notes` | arhitektuuriprooviks üks päris komponent koos fotopaigutuse ja taasavamisega; eraldi märkmete näidismoodul pole esimene kasutajaväärtus |
| P2 | `03` § 7.4 ja ADR-i kasvutee | täpsustada, et Workerisse liigub puhas arvutus, mitte sünkroonne mootor muutumatu lepinguga |

Praeguses kavandis juba olevad head parandused — seansi id, salvestuse maksimaalne ooteaeg, UI eelvaade ja väljalaskes kehtiv omandikontroll — jäävad alles. Neid ei avata lihtsalt uue ülevaatuse pärast uuesti.

## 11. Ehitusjärjekord algusest väljalaskeni

Allolevad etapid on minu soovitatud järjekord. Need ei märgi praeguseid M0–M6 vastuvõetuks ega asenda veel teekaardi omanikdokumenti. Iga etapi lõpus on käivitatav töölauaäpp ning väike inimkatse.

| Etapp | Tulemus kasutajale | Teostuse põhi | Vastuvõtu tõend |
|---|---|---|---|
| 0. Päris väike vundament | projekt, üks komponent, undo, sulge/ava | paketipiirid, käsud, külmutatud hetktõmmis, SQLite, save/flush, lihtne varukoopia, CI ja esimene Tauri ehitus | komponendi nimi/asukoht säilib; vale omanik lükatakse tagasi; ketta viga on nähtav |
| 1. Foto ja kaardistamine | oma foto, 5 põhikorpust, tundmatu komponent, tähis, suurus ja joondus | fotovood, koordinaadid, tabamine, sildid, terminalid; varajane jõudlusproov | esimene komponent paigas ≤ 3 tegevusega pärast foto valimist; foto ja paigutus säilivad taasavamisel |
| 2. Muudetav skeem | Plaat/Skeem, lisamine mõlemast vaatest, ühendused ja märkus | valikulised paigutused, pin-map, liitepunktid, võrgu nimed/rollid, käsitsi skeemipaigutus | skeemil loodud komponent paigutatakse fotole sama id-ga; ühe vaate ühendus on teises olemas |
| 3. Mõõtmine | kaks sondi, V/Ω/diood/piiks, jada, OL, nähtavad tulemused | parser, mustandid, paarimõõtmised, eraldi ühenda-tegevus, tingimuslik hindamine | valele jalale salvestamise regressioonid ei läbi; 20 näidu sisestamine ilma hiireta õnnestub |
| 4. Märgistatud rajad | fotole tegelikud marsruudid, harud, kihid ja võrgunimed | `BoardRoute`, selged haruliited, sildi paigutus, õhujoonte filter | kasutaja tellitud terve põhiteekond läbib foto → komponendid → skeem → mõõtmised → rajad |
| 5. Usaldatav igapäevatöö | remont ja kordusmõõtmine, import, eksport, raport, täielikum teek | arhiiviviited, migratsioon, ~40 korpust, SVG/PNG/CSV/HTML, valikuline ELK-proov | kustutuse järel eksport/import toimib; varukoopia taastamine ja päris plaadi väike remondijuhtum läbitud |
| 6. Väljalase | paigaldatav, offline töötav Windowsi v1 | allkirjastamine, failiseos, installer, versiooniuuendus, diagnostika ja jõudluskontroll | puhtas Windowsis paigalda → tööta → uuenda → taasava; kasutaja visuaalne vastuvõtt |

Etapis 0 ei ehitata tervet mooduliplatvormi. Ainult parasjagu vajaliku `components`-võimaluse mootor ja UI tõestavad piiri. Foto lisandub järgmise väikese osana; mõõtmise täisvoog ei oota korpuste teegi lõpetamist. Ühenduste alus peab olema olemas enne mõõtmiste hinnangute ja skeemi automaatse paigutuse keerukust.

**Esimene nädal oleks tööjärjekorra siht, mitte lubatud valmimisaeg:** tegeliku arenduskeskkonna ja pakendamise kontroll → üks komponent, undo ja taasavamine → foto → kahe vaate ühine identiteet → lühike kasutuskatse ning mõõdetud järgmine samm. Kui esimene salvestuse/taastekatse pole korras, järgmisi võimalusi selle peale ei kuhjata.

Täpsed failipõhised teostusplaanid kirjutatakse ühe etapi kaupa, pärast selle suuna kinnitamist. Mitme kuu kõikide funktsioonide koodi ja testkehi praegu ette ei kirjutata. Järgmise etapi liidesed täpsustatakse eelmise töötava tulemuse järgi.

## 12. Kontrollid, mis päriselt kaitsevad kasutajat

### Kohustuslikud invariandid

| Kontroll | Mida tõendab |
|---|---|
| komponent lisatakse skeemil, paigutatakse fotole, nimetatakse ümber | üks objekt, samad jalad ja mõõtmised; sõltuvus pole tähise tekstist |
| komponent/sümbol/silt/raja käänupunkt liigub | ainult asjakohane paigutus muutub; ühendatus ei muutu |
| kaks joont ristuvad; lõpp jääb 1 px kaugusele | ühendust pole ilma valitud ühise liiteta |
| pealmine SMD-jalg vs läbiv jalg/via | kihid liituvad ainult toetatud füüsilise liite kaudu |
| kaks eraldi võrku nimetatakse GND-ks | nimi/roll üksi ei liida võrke |
| „piiksub“ ja „piiksub ning ühendan“ | esimesel muutub ainult mõõtmine; teisel üks atomaarne mõõtmise+ühenduse samm |
| filter, tööriist, vaade ja paneel muutuvad pooleli näiduga | mustand ning selle mõlemad sondid säilivad; teine jalg ei saa vana näitu |
| must sond valimata või teadlikult mujal kui GND | automaatset GND-oletust pole; pinge hinnang kasutab mõlemat otsa |
| kustutus, korpuse vahetus, eksport ja taasimport | ajaloolised mõõtmised on loetavad ja viited kontrollitavad |
| prototüübi otsene viide, läheduse seos ja eri kihtide kattumine impordil | kindel viide säilib; ebaselge seos vajab nähtavat kinnitust; uut läbiviiku ei oletata |
| undo/redo mitut tabelit muutva käsu järel | sisu taastub tervikuna ja `rev` ei lähe tagasi |
| ketas täis, kirjutuskaitse, katkestatud kirjutus, vana `baseRev` | vana terviklik fail säilib; edu ei näidata enne kinnitust |
| projekti vahetus hilinenud foto/salvestuse/paigutuse vastusega | vana seanss ei muuda uut projekti |
| taastamine ja versiooniuuendus | originaal säilib; koopia sisaldab ka fotosid ja manuseid |

Domeeni ja mootori testid kasutavad Vitesti Node'is ning sünteetilisi projekte. UI käitumist kontrollitakse Testing Libraryga; kasutajateekondi Playwrightiga brauseris. SQLite'i, lukke, fotosid, sulgemist ja pakendamist kontrollitakse lisaks Rusti testide ning päris Tauri suitsukatsetega. Brauseri IndexedDB-adapter ei tõesta töölaua failisalvestuse töökindlust.

Katvuse protsent ja faili pikkus on abimõõdikud. Need ei asenda ülalolevaid invariandikatseid. Iga visuaalse muudatuse jaoks ei kirjutata teostust kordavat testi; ohtlikud sihtmärgi, topoloogia ja andmesäilimise reeglid saavad tugevad regressioonid.

### Kasutuskatse

Tehnik teeb väikese sünteetilise 5 V sisendi ja 3,3 V regulaatoriga plaadi näitel:

1. Avab foto ja lisab J1, U1, kaks kondensaatorit ning ühe tundmatu komponendi.
2. Annab korpuselt loetud märgistuse ning joondab ühe IC; ei pea kõiki väärtusi teadma.
3. Avab skeemi, lisab takisti, ühendab selle ja paigutab sama takisti hiljem fotole.
4. Valib musta sondi J1 maanduskontaktile. Sisestab U1 väljundile 3,28 V ning teisele katsele 2,70 V.
5. Salvestab piiksu ilma ühendamata ja teise piiksu koos teadliku ühendamisega.
6. Joonistab ühe fotol nähtava haruneva raja, liigutab silti ja eemaldab ühe joonistuse ühendust kaotamata.
7. Vahetab filtreid ja vaateid pooleli mustandiga, kustutab komponendi ja võtab tagasi.
8. Sulgeb, taasavab, ekspordib ning taastab varukoopia eraldi faili.

Mõõdame: aeg esimese komponendini, valede klõpsude ja abi vajaduse arv, kahe vaate vahel otsimise aeg, 20 mõõtmise sisestuse aeg ning kõik valesse kohta sattunud kirjed. **Valesse kohta salvestatud mõõtmisi ja tahtmatuid võrguühendusi peab olema null.** Kiirus saavutatakse pärast õigsust.

## 13. Täieliku v1 piir ja hilisem kasv

V1 sisaldab kogu kasutaja nimetatud põhiteekonda, käsitsi skeemiredaktorit, põhilisi ja kohandatud korpusi/sümboleid, võrgunimesid ning rolle, nelja mõõterežiimi, remondimärkmeid, automaatsalvestust, taastatavaid varukoopiaid, prototüübi importi ja põhilisi ekspordivorminguid. Kaardi ning skeemi saab kasutaja jaoks välja printida. Automaatpaigutus ei ole v1 kasutatavuse eeltingimus.

V1 ei ürita olla PCB projekteerimistarkvara: puuduvad tootmis-Gerberid, täielik elektrireeglite kontroll, mitmelehelise skeemi hierarhia ja automaatne vaskradade projekteerimine. Puuduvat skeemi saab remondiks sammhaaval taastada.

Kahe poole mitme foto täpne joondus, perspektiiviparandus, tahvel, multimeetri ühendus ja AI tulevad eraldi väikeste jätkuetappidena. Füüsilised pooled, läbiviigud ja valikuline fotoviide on mudelis siiski algusest arvestatud, et nende lisamine ei nõuaks mõõtmiste identiteedi muutmist.

Multimeetri tulevane näit täidab nähtava mustandi. AI võib pakkuda komponenti, pinout'i või ühendust, kuid ei loo inimese eest mõõtmist ega muuda oletust mõõdetud faktiks. Puuduvat internetti ei esitata katkise äpina.

Windowsi installer, kaasa pakitud fondid ja offline WebView2 paigaldamise variant kontrollitakse enne väljalaset puhtas masinas. Kasutaja arvuti üldseadistusi selle uuringu käigus ei muudeta. [Tauri Windowsi paigaldajate juhis](https://v2.tauri.app/distribute/windows-installer/).

Tauri õigused hoitakse kitsad; kohandatud Rusti failikäsk kontrollib ise ka lubatud teed ja aktiivset seanssi. Capability-faili olemasolu ei asenda hosti sisendikontrolli. V1-s pole automaatset välisvõrku saatmist. Uuendamine on esialgu käsitsi allkirjastatud paigaldajaga; automaatuuendaja ja selle allkirjad on eraldi järgmine töö. [Tauri õiguste piirid](https://v2.tauri.app/security/capabilities/), [uuendaja juhis](https://v2.tauri.app/plugin/updater/).

## 14. Kuidas AI-dega ehitamist juhiksin

Ühine mälu jääb praeguse `AGENTS.md` → `STATUS.md` → `WORKFLOW.md` → `SKILLS.md` tee peale. Uue AI algus ei tähenda kogu arhiivi lugemist. `STATUS` ütleb, milline etapp päriselt töötab, milline katse tehti, mis jäi pooleli ja mis failides järgmine töö toimub.

Iga tööüksus sisaldab kasutajale nähtavat tulemust, mõjutatud vastutust ja üht mõistlikku vastuvõtukatset. Esmalt otsitakse olemasolev lahendus, seejärel tehakse väikseim terviklik muudatus. Mitut AI-d ei panda sama salvestus- või andmemudelifaili korraga kirjutama. Commit ja push vajavad kasutaja ülesannet.

### Oskuste ja tööriistade kasutamine

| Töö | Sobiv töövõte või vahend |
|---|---|
| uus kasutajateekond või käitumine | Superpowers: `brainstorming`; eesmärk, alternatiivid ja läbivaadatav kavand |
| järgmise väikese etapi täpne ehitus | `writing-plans`, seejärel valitud teostusviis; failid, liidesed ja kontrollid |
| domeeniloogika ja veaparandus | `test-driven-development`; tähenduslik regressioon enne parandust |
| seletamatu käitumine | `systematic-debugging`; põhjus enne lahenduse muutmist |
| suurem andmeleping või valmis etapp | `requesting-code-review`, vajadusel sõltumatu ülevaatus |
| välise ülevaatuse ettepanek | `receiving-code-review`; väide kontrollitakse päris koodi ja lepinguga |
| lõpetamise väide | `verification-before-completion`; käsk ja tegelik tulemus |
| visuaalne töö | brauseri/arvuti vaatlus, kui ligipääs lubab; uue UI puhul tegelikud ekraanipildid |
| dokumentide leidmine ja kontroll | BB MCP, kui seansis olemas; muidu samad failid, Git ja serveri lugemiskontroll otse |
| võõra teegi API uurimine | ametlikud juhised; GitHubi ühendus avaliku lähterepo lugemiseks |

Selles uuringus laadisin sobivad kavandamise, planeerimise ja kontrollimise juhised, uurisin kohalikku koodi ning kasutasin ametlikke veebiallikaid ja GitHubi ühendust ELK-i lähterepo lugemiseks. Figma faili või uut pluginapaigaldust polnud selle tulemuse jaoks vaja. Täielik ehitusplaan ning teostus jäävad järgmise, eraldi töö ulatusse.

Uue korduva töö alguses kontrollitakse alati, kas olemasolev oskus aitab. BB-spetsiifiline võimalik oskus oleks hiljem **kahe vaate ja mõõtmise invariantide läbiv ülevaatus**: see käivitaks sünteetilise plaadi, kontrolliks mõlema vaate identiteete ja annaks lühikese tõendiraporti. Praegu ei looks ma tühja oskust; esmalt tekivad testandmed ja toimiv kontrollkäik. Mehaaniline kontroll kuulub skripti/CI-sse, oskus selle sihitud kasutamise juhiseks.

## 15. Järgmine konkreetne samm

Minu soovitus on **säilitada Claude'i tehnoloogiline alus ning muuta ehitusjärjekorda ja mudeli ühenduspiire**. Käesolev fail on eraldi alternatiivne tervikettepanek; ADR-003 on endiselt ettepanek ning 01–08 jäävad praegu muutmata.

Kui selle suuna järgi ehitada, fikseeriksin esmalt lühidalt kolm sisulist lepingut: (1) sama komponendi valikulised plaadi- ja skeemipaigutused, (2) ühendus eraldi joonistusest ning mõõtmise selge sondipaar, (3) kustutamise järel ajalooliste viidete säilimine. Seejärel teeksin **etapi 0 koos ühe päris komponendi salvestamise ja taasavamisega**, lisaks kohe esimese ketta vea ja katkestatud kirjutuse katse. Järgmisena foto ning varakult kahe vaate ühine identiteet.

Rakenduse lõplikuks vastuvõtuks peab kasutaja saama oma plaadi foto põhjal jõuda märgistatud, mõõtmistega seotud ja uuesti avatava skeemini ilma terminali, käsitsi failiparanduste või AI abita.
