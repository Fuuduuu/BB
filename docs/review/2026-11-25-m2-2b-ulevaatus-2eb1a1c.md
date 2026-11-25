# Ülevaatus: BB M2.2b väljalaske-eelne audit ning arhitektuur ja modulaarsus · 2eb1a1c

- **Ülevaataja:** astra
- **Kuupäev:** 2026-11-25
- **Git HEAD:** d682e63 docs: M2.2b user smoke reply, Astra audit before merge
- **Üldhinnang:** EI

## Kokkuvõte

**Soovitan liitmise ja v0.7.0 väljalaske peatada.** Kinnitasin 15 leidu: **5 P1, 8 P2 ja 2 P3**. Neli P1 leidu puudutavad M2.2b uut üleplaadilist mõõtkava. Viies on v0.6.0-st pärit Piiksu viga, mis salvestab mõõtmise ja ühenduse valele jalale. P1 tähistab vale salvestust või andmekadu, P2 töövoo-, usaldusväärsuse või arhitektuuririski ja P3 väiksemat mõju. Tavavoos kalibreerimine, ühe sammuga tagasivõtmine ja vanade failide avamine toimisid. Kasutaja 25. novembri suitsukatse vastus „korras“ jääb eraldi vastuvõtutõendiks. 50 jala katse aega pole üleandmises kirjas.

## Ulatus ja kontrollid

| Ulatus või kontroll | Sõltumatu tulemus |
|---|---|
| A ja B | Kood eraldi ajutises Git-koopias täpselt tipul `2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8`. Alus on v0.6.0 ehk `b7ecf03`. Vahemikus on 3 dokumendicommit’i ja 5 kaardicommit’i, rakendustes ja pakettides 52 muudetud faili. B hõlmas sama tipu kogu repo kihipiire, teste ja avalikke liideseid. Postkasti päises olev Git HEAD tähistab dokumentide põhikausta. |
| Nõuded | Põhikausta [plaan O1–O5](../plans/M2-2b-korpused-ja-mootkava.md), kaartide [1](../tasks/M2-2b-1.md), [2](../tasks/M2-2b-2.md), [3](../tasks/M2-2b-3.md), [4](../tasks/M2-2b-4.md) ja [5](../tasks/M2-2b-5.md) arhitekti ülevaatused ning [üleandmine](../plans/M2-2b-uleandmine.md). Arhitektuuri võrdluses 03, 05 ja tipu 51 API-dokumenti. |
| `pnpm check` | Tervikuna väljumiskood 1. Mõlemad TypeScripti kontrollid, ESLint ja sõltuvusreeglid läbisid. 613 moodulit, 2448 sõltuvust ja 0 rikkumist. Failipikkuse kontroll läbis nelja testifaili hoiatusega. Vitesti tavakäivituses tekkis 158 failis tõrge testide kogumisel. Kokku 228 failist 163 ebaõnnestus. |
| Vitesti kordus | Tööruumi paketi nimed seoti kontrollitud tipu lähtekoodiga ja välised sõltuvused vastasid lukufailile. Kõik 228 testifaili käivitusid. **1730/1744 testi läbis, 14 ebaõnnestus, 0 jäeti vahele.** Kolm tööriistatesti vajasid keskkonnas keelatud kataloogilinki (`EPERM`), 11 kontrollisid füüsilist mooduliteed, mis ajutise suunamisega erines. Kõik rakenduste ja pakettide testid läbisid. |
| `pnpm api:check` ja `pnpm format:check` | Mõlema väljumiskood 0. API kontroll hoiatas 415-realise genereeritud komponendilepingu üle. Puuduvat võrkude UI sisenemispunkti see kontroll ei avastanud (09). |
| `pnpm e2e` | Tavakäivituses oli port 5173 hõivatud. Vabal pordil blokeeris keskkond kohaliku ühenduse (`EACCES`). Sama tipu värske veebikooste ja repo võrguühenduseta testitee kaudu **45/45 Chromiumi testi** 193,47 sekundiga, 0 kordust ja 0 vahelejätmist. Uus `scale_from_footprint_end_to_end` läbis 2,1 sekundiga. Allpool toodud sihtkatsed lisanduvad sellele arvule. |
| `cargo test --locked` | `apps/desktop/src-tauri` kaustas **108 läbis, 0 ebaõnnestus, 2 ignoreeriti**. Mõlemad ignoreeritud kirjed on põhikatsetest käivitatavad SQLite’i päeviku alamprotsessi abikatsed. |
| `git diff --check v0.6.0..2eb1a1c` | Väljumiskood 0. Katsetes kasutati ainult sünteetilisi plaate ja hoidlas olevaid näidisfaile. |

## Mis töötas

- **Mõõtkava ja ajalugu.** 10→20 px/mm parandus tõi võrdlusjalad sihtidesse ühe käsuga. Üks Undo taastas dokumendi sisu peale kasvava revisjoni. Teise komponendi keskpunkt, tegurid, sildi nihe, liitepunkt, raja käänupunkt, mõõtmine ja võrgusilt säilisid. Jalale kinnitatud raja ots liikus koos ümber mõõdistatud jalaga.
- **Piirid ja katkestus.** Tegurid 0,05 ja 7,5 avasid küsimuse ilma dokumendi muutuseta. Esc säilitas revisjoni. Teguril 0,5 jäi katkestades alles juba tehtud kohalik joondus, nagu kaart ette näeb. Pööratud ja peegeldatud fotol jäid alumise poole 0805 jalad pärast parandust värvimärkidest alla 0,001 ekraanipiksli kaugusele. V0.6.0 fail säilitas taasavamisel võrgu, mõõtmise ja faili identiteedi.

## Leiud

### 1. [P1] Enter teisel juhtnupul kinnitab kogu plaadi mõõtkava

- **Jaotis:** A · 01 · kaart 2 · joondusküsimuse fookus
- **Stsenaarium:** Chromium, sünteetiline 800 × 600 foto, 0805 korpuse 2 mm ja 160 px sihid. Küsimus sai õigesti algfookuse. Kolm Shift+Tab vajutust viisid fookuse teeginupule „Kinnitusava“. Enter jättis teeginupu suletuks ja muutis mõõtkava „Kalibreerimata“ → 80,00 px/mm. Sama kordus kahe Tab-i järel paneeli laiuse eraldajal.
- **Soovitatud muudatus:** Lase joondusel Enterit töödelda ainult lõuendi või tema enda nupurühma fookusest. Piiksul on see kontroll juba olemas. Regressioonikatses kontrolli nii teise nupu aktiveerumist kui ka mõõtkava püsimist. [Joonda klahvid](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/components/ui/AlignTool.ts#L127) · [Akna kuular](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/ui/src/canvas/use-canvas-keys.ts#L69) · [Piiksu fookusekontroll](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/measurements/ui/BeepTool.tsx#L343)

### 2. [P1] Kinnitus salvestab teise mõõtkava, kui kasutajale parajasti näidatakse

- **Jaotis:** A · 02 · kaart 2 · poolelioleva pakkumise kehtivus
- **Stsenaarium:** Chromium. 0805 korpus ja 160 px jalgade vahe andsid pakkumise 80,00 px/mm. Avasin küsimuse kõrvalt omadused ja vahetasin 0805 korpuse 1206 vastu. Küsimuses püsis 80,00 px/mm. „Kasuta mõõtkavaks“ salvestas uue korpuse 3 mm järgi 53,33 px/mm. Projekti taasavamine kinnitas 53,33. Teine kordus näitas sama olekuvea väiksemat mõju. Kui Ctrl+Z eemaldas komponendi, jäi kinnitus aktiivseks ning vajutus andis puuduva komponendi vea. Projektivahetus puhastas küsimuse.
- **Soovitatud muudatus:** Seo pakkumine valitud korpuse, füüsiliste padjandite ja arvutuseks kasutatud geomeetriaga. Eelduse muutumisel sulge küsimus või kuva uus väärtus ja küsi uuesti kinnitust. [Pakkumise kuva](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/components/ui/AlignScaleQuestion.tsx#L28) · [Kinnituskäsk](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/components/ui/AlignTool.ts#L19) · [Hetkeseisu uuendamine](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/ui/src/canvas/Canvas.tsx#L211) · [Mõõtkava kirjutus](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/domain/src/rules/scale-from-pins.ts#L70)

### 3. [P1] Joonda võib võtta nähtava padjandi asemel kõrvaljala mõõtkava aluseks

- **Jaotis:** A · 03 · kaart 2 · lähtejalgade valik
- **Stsenaarium:** Chromium, suum 1. Klõps (129,5; 100) jäi U1.1 sisse 0,5 px ja U1.2 pinnast välja 3 px. Joondus valis U1.2. Kolmas jalg asus (200; 100) ja sihid olid 160 px vahega. Andmebaasi salvestati 6,5 mm ja 24,6154 px/mm. Klõpsatud jalgade järgi oli vahe 8 mm ning tulemus 20 px/mm. Sõltumatus katses tavalise QFN-32+EP korpusega andis samasugune valik 28,07 asemel 160 px/mm. Mõlemal korral muutus kogu plaadi mõõtkava.
- **Soovitatud muudatus:** Eelista nähtava padjandi täpset tabamust. Kasuta suurendatud tabamisala alles siis, kui täpseid tabamusi pole. Ühenda Joonda ja Piiksu jalgade valimise reegel ning testi salvestatud paari ja mõõtkava. [Joonda kasutab üksiktabamust](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/components/ui/AlignTool.ts#L42) · [Üksiktabamuse valik](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/ui/src/canvas/hit-index.ts#L198) · [Piiksu järjestatud tabamused](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/measurements/ui/BeepTool.tsx#L306)

### 4. [P1] Fotole käsitsi lisatud jalad saavad kinnitada oletusliku mõõtkava kalibreerituks

- **Jaotis:** A · 04 · kaart 2 · mõõdu päritolu
- **Stsenaarium:** Chromium ja püsiv brauseriandmebaas. Kalibreerimata plaadi algväärtus oli 10 px/mm. Suvalisel alal X1 klõpsasin J-tööriistaga jalad (150; 100) ja (190; 100). Jalgadele ei sisestatud teadaolevat millimeetrimõõtu. Joondasin need samadele punktidele ja valisin „Kasuta mõõtkavaks“. Dokument salvestas calibrated=true ning calib.mm=4. See 4 mm pärines üksnes sama plaadi algsest oletusest 40 px / 10 px/mm. Kalibreering võib seega jääda valeks ka täiesti täpsete klõpsude korral.
- **Soovitatud muudatus:** Luba korpuse järgi kalibreerida kahe teadaoleva füüsilise padjandi alusel. Käsitsi määratud padjandite puhul võimalda tavalist paigutuse joondamist või küsi iseseisvalt mõõdetud vahet. Kaart 2 kirjeldab kohalikku ühikut millimeetrites, kasutajateekond eeldab teadaoleva mõõduga korpust. [Käsijala koordinaadi päritolu](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/components/ui/OwnPinTool.ts#L41) · [Käsitsi lisatud padjandid](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/domain/src/geometry/board.ts#L93) · [Füüsilise vahe arvutus](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/domain/src/rules/scale-from-pins.ts#L18) · [Teadaoleva korpuse nõue](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/docs/02-kasutaja-teekond.md#L117)

### 5. [P1] Piiks loeb ovaalse padjandi tühja nurga vaseks ja salvestab vale elektriühenduse

- **Jaotis:** B · 05 · olemas juba v0.6.0-s · ühine jalgade tabamisgeomeetria
- **Stsenaarium:** Rakenduse lõuendi ja mootoriga korratud kaks korda. TO-92 ovaalse Q1.3 keskpunkt oli (175,4; 200), poolmõõdud 10,5 ja 15 px. Punkt (185,6; 214,7) oli ovaali servast 3,92 px väljas ja naaberpadjandi P1.1 sees 1,58 px. Chromiumi sõltumatu SVG-täite kontroll paigutas punkti ainult P1.1 sisse. Piiks salvestas positiivse mõõtmise UID-le pin_Q1_3 ja elektriühenduse U1.1→Q1.3. Seda põhjustavad failid ei muutunud M2.2b-s. Leid 03 esineb ka ümmarguste padjanditega. Siin eksib juba täpseks loetud kuju ise.
- **Soovitatud muudatus:** Kasuta tabamisel sama ümarat otsa, raadiust ja pööret nagu padjandi joonistamisel. Lisa kumerast servast välja ja kõrvaljala sisse jääva punkti katse mõlema tööriista kaudu. [Nähtav padjand](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/components/ui/layers/PinMarker.tsx#L46) · [Tabamiskuju](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/components/ui/layers/hits.ts#L35) · [Täpseks lugemine](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/ui/src/canvas/hit-index.ts#L229) · [Salvestatava jala valik](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/measurements/ui/BeepTool.tsx#L306)

### 6. [P2] Lubamatu üleplaadilise mõõtkava korral lõpeb joondus selgituseta

- **Jaotis:** A · 06 · kaart 2 · lubatud mõõtkava 0,1–1000 px/mm
- **Stsenaarium:** Tööriista ja mootoriga katse. Kalibreeritud plaadil oli 800 px/mm ja 0805 jalgade vahe 2 mm. Sihid 2400 px vahega andsid lubatud kohaliku teguri 1,5 ning lubamatu üleplaadilise pakkumise 1200 px/mm. Rakendus salvestas kohaliku joonduse (rev 0→1), jättis kogu plaadi mõõtkavaks 800 ja läks küsimuse või veateateta esimesele sammule. Sama kordus 2002 px ja 1001 px/mm juures. Kaardi 2 otsus 3 näeb lubatust väljapoole jäävale pakkumisele ette veateate.
- **Soovitatud muudatus:** Säilita õnnestunud kohalik joondus ja selle Undo. Ütle kasutajale, et kogu plaadi mõõtkava jäi samaks, sest tulemus ületas lubatud vahemiku. [Pakkumise piir](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/components/ui/AlignTool.ts#L83) · [Eduka joonduse lõpp](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/components/ui/AlignTool.ts#L105) · [Olemasolev veatekst](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/components/ui/i18n/et.ts#L302)

### 7. [P2] Polaarsuse pluss kaob mõnel fototaustal peaaegu täielikult

- **Jaotis:** A · 07 · kaart 4 · loetavus
- **Stsenaarium:** Chromiumis võrdlesin radiaalse D 6,3 elektrolüüdi samu piksleid märgiga ja märgita, 20 px/mm. Heleda teema ja musta fototausta korral oli isegi kõige eristuvama plussipiksli heleduse kontrast 1,024 : 1, tumerohelisel sünteetilisel plaadil 1,484 : 1. Tumeda teema ja valge foto korral oli see 1,294 : 1. Vastassuunalise kontrastiga kontrollides oli tulemus üle 16 : 1. Teadaolev on heleda teema nõrk triibutäidis. Katse näitas mõju ka joonmärgile ja mõlemas teemas.
- **Soovitatud muudatus:** Anna plussile kontrastne alusjoon, nagu korpuse väliskontuuril juba on. Võrdle uuesti heleda ja tumeda fotopinnaga kummaski teemas. [Kontuur, pluss ja triip](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/components/ui/layers/ComponentShape.tsx#L55) · [Heleda teema värvid](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/ui/src/kit/tokens.css#L27) · [Tumeda teema värvid](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/ui/src/kit/tokens.css#L107)

### 8. [P2] Repos olev Tauri jõudlusproov ei taasta üleandmisel mõõdetud koormust

- **Jaotis:** A · 08 · kaart 5 · tõendi korratavus
- **Stsenaarium:** Seeme 127: generaator annab 300 komponenti, 3000 jalga, 1000 ühendust, 1500 pinget ning eraldi 450 positiivset ja 50 negatiivset läbivust. Kontrollitud tipu proovi täitmistee kasutab ainult pingete loendit. Tulemuseks on 0 läbivust ja 0 ✓. Generaatori teise loendi lisamisel sain 500 läbivust ja 450 ✓. Käsumõõtja kutsus 5× items.translate ja 5× connections.add, 0× beep.record. connectionLevels-i aja veerg puudus. Ka panoraami ja lohistuse läved erinevad kaardist. Üleandmise kolme jooksu mediaanid on aritmeetiliselt õiged. Erinevus puudutab sama katse iseseisvat kordamist.
- **Soovitatud muudatus:** Lisa tegelikult kasutatud vastuvõtuproov reposse ja seo selle mõõdikud ja piirid kaardiga. Kontrolli enne ajastamist andmete arvu ning salvesta sisendi ja kooste tunnus koos kolme jooksu tulemustega. [Andmete sisestamine](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/apps/desktop/src/perf/probe.ts#L169) · [Lävede kontroll](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/apps/desktop/src/perf/probe.ts#L243) · [Mõõdetavad käsud](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/apps/desktop/src/perf/probe-commands.ts#L56) · [Tuletiste ajastus](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/apps/desktop/src/perf/probe-timing-plugin.ts#L39)

### 9. [P2] Võrkude UI avalik imporditee ei lahene ja API kontroll jätab selle vahele

- **Jaotis:** B · 09 · pakettide avalik liides
- **Stsenaarium:** Käivitasin tipu packages/features/package.json suhtes Node’i createRequire(...).resolve(...). @pcbk/features/nets/ui andis MODULE_NOT_FOUND. nets/contract ja measurements/ui lahenesid. Ekspordimuster otsib ui/index.tsx, aga võrkude moodul kasutab ui/index.ts. Rakendus käivitub suhtelise koostepunkti kaudu. API ülevaate koostaja jätab puuduva mustri vahele, mistõttu pnpm api:check läbib ka siis, kui selle mooduli avalik tee ei tööta.
- **Soovitatud muudatus:** Ühtlusta eksporditee tegeliku failiga. Kontrolli iga lubatud alamtee lahendamist ja selle kattumist genereeritud ülevaatega. [Ekspordimuster](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/package.json#L12) · [Tegelik UI sisenemine](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/nets/ui/index.ts#L10) · [API ülevaate leidmine](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/tooling/api-digest.mjs#L96) · [Rakenduse kooste](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/ui.ts#L6)

### 10. [P2] Teisest tuletisest sõltuv väärtus võib jääda eelmisele revisjonile

- **Jaotis:** B · 10 · enne M2.3 esimest tuletiste ahelat
- **Stsenaarium:** Päris createSnapshotBuilder, kaks lubatud katsespetsifikatsiooni. Esimene sõltus nimest, teine luges ainult esimese tulemust ja deklareeris inputs=[]. Algseis oli A/A. Nime muutmisel B-ks andis inkrementaalne arvutus B/A ja täisarvutus samast dokumendist B/B. Viis praegust tootetuletist teise tuletise lugemist ei vaja. See erineb teadaolevast probleemist, kus nets ja connectionLevels arvutatakse liiga sageli.
- **Soovitatud muudatus:** Enne esimese sõltuva skeemituletise lisamist piira leping sõltumatutele arvutustele või deklareeri tuletiste omavahelised sõltuvused ning arvesta neid järjestuses ja vahemälus. Testi ka Undo ja täisarvutusega võrdsust. [Avalik leping](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/engine/src/types.ts#L28) · [Vahemälu kontroll](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/engine/src/derivation.ts#L31) · [Registreerimine](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/engine/src/registry.ts#L66)

### 11. [P2] Mooduli juurkausta abifail saab UI ja mootori vahelisest sõltuvuskontrollist mööda

- **Jaotis:** B · 11 · dependency-cruiseri kontrolli ulatus
- **Stsenaarium:** Eraldi minimaalne katse kasutas tipu tegelikku dependency-cruiseri konfiguratsiooni. Otsene features/demo/ui/control.ts → engine andis ootuspärase feature-ui-not-engine rikkumise. Kaks sammu features/demo/ui/probe.ts → ../glue.ts → engine andsid 0 rikkumist. Kontrollitud rakendustes sellist teed ei leidnud. Uue mooduli arendajal võib praegune kontroll seega anda eksitava rohelise tulemuse.
- **Soovitatud muudatus:** Kontrolli UI-st mootorini ulatuvat tegelikku sõltuvusteed või anna juurkausta abifailile selge kihi reegel. Säilita lubatud lepingute ja tüübiviidete teed ning lisa mõlemad näited kontrolli regressioonikatseks. [UI impordipiir](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/.dependency-cruiser.cjs#L51) · [Oma mooduli erand](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/.dependency-cruiser.cjs#L104) · [Moodulite imporditest](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/tooling/feature-deps.test.ts#L33)

### 12. [P2] Piiksu kaitse kinnitamine vajab moodulit, mida measurements oma sõltuvusena ei nõua

- **Jaotis:** B · 12 · valikulise moodulikooste leping
- **Stsenaarium:** Eemaldasin sünteetilisest moodulikoostest connections-i, jätsin kõik measurements.dependsOn moodulid ning märkisin vabad dokumendiväljad registri toetatud reserved-loendisse. Register käivitus ja beep.record salvestas kaitsega takisti mõõtmise ning sündmuse. Kaitse kinnituseks vajalik connections.add andis not_found. Täiskoostes tekkis sama katse järel 1 mõõtmine ja 1 ühendus. Tänased veebi- ja töölauarakendused kasutavad täiskoostet.
- **Soovitatud muudatus:** Deklareeri kinnituse tegelik käsusõltuvus või muuda kinnitus vastava käsu puudumisel kättesaamatuks. Testi toetatud minimaalset moodulikoostet. [Deklareeritud sõltuvus](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/measurements/engine/index.ts#L7) · [Kinnitus kasutab ühenduste käsku](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/measurements/ui/BeepTool.tsx#L165) · [Praegune impordikontroll](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/tooling/feature-deps.test.ts#L33)

### 13. [P2] Algfaili kaardilt taastades valitakse vaikimisi teise töökoopia varukoopia

- **Jaotis:** B · 13 · 17. novembri leiu korduskontroll
- **Stsenaarium:** Tegeliku RestoreDialogi katses olid A ja B sama projectId ning eri fileId-ga. A varukoopia oli kell 12.01 ja B oma kell 12.02. A kaardil avatud dialoog valis B ning „Taasta“ andis edasi B varukoopia tee. Vaates olid valiku eristamiseks üksnes aeg ja koopia liik. Katse kontrollis valikut ja kinnitusele edastatud teed. Taastamistoiming loob eraldi faili. Sama puudus oli kirjas 17. novembri ülevaatuses.
- **Soovitatud muudatus:** Eelista avatud lähtefaili fileId-ga varukoopiat ja näita teise lähtefaili koopiad selge nime all. Säilita võimalus valida neid teadlikult. [Nimekirja laadimine](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/ui/src/shell/RestoreDialog.tsx#L32) · [Vaikevalik](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/ui/src/shell/RestoreDialog.tsx#L50) · [Lähtefailide loend](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/apps/desktop/src-tauri/src/storage/backup/mod.rs#L249)

### 14. [P3] Avalik kontuurifunktsioon tagastab vahemälu muudetavad punktid

- **Jaotis:** B · 14 · uus geomeetria API · risk järgmisel tarbijal
- **Stsenaarium:** Küsisin 6,3 mm radiaalse korpuse esimese punkti, muutsin tagastatud objektil x-i 3,15→123 ja küsisin sõltumatule komponendile uuesti bodyOutline-i. Mõõtkaval 20 px/mm liikus selle esimese punkti x 173→2570. Dokument jäi puutumata. Joonistus ja tabamine kasutavad sama vahemälu. Praegused tarbijad punkte ei muuda, kuid avalik TypeScripti tüüp lubab seda hoolimata kirjutuskaitset eeldavast kommentaarist.
- **Soovitatud muudatus:** Tee jagatud punktid ja massiiv kirjutuskaitstuks ka avalikus tüübis ning kaitse neid tegeliku muutmise eest või tagasta omaette koopia. Lisa test kahe sõltumatu tarbijaga. [Avalik tagastus ja vahemälu](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/domain/src/footprints/body-outline.ts#L68) · [Avalik eksport](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/domain/src/footprints/index.ts#L41) · [Plaadi kontuur](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/domain/src/geometry/board.ts#L104)

### 15. [P3] Andmeomanike tabelist puudub uus mõõtkava kirjutaja

- **Jaotis:** B · 15 · 03 ja 05 võrdlus koodiga
- **Stsenaarium:** Võrdlesin omanike tabeli scale-rida registreeritud käsuga components.scaleFromPins. 05 nõuab iga alsoWrites erandi põhjendamist, kuid scale juures on ainsa kirjutajana photo ning teiste kirjutajate veerus kriips. Tegelik käsk deklareerib alsoWrites: ['scale']. Mootori omandikontroll ja õnnestunud Undo-katse kinnitavad, et erand toimib. 03 kirjeldab juba rakendatud ADR-005 üleviimist ühes lõigus endiselt tulevikutööna.
- **Soovitatud muudatus:** Lisa tabelisse konkreetne käsk ja põhjus ning uuenda 03-s ADR-005 teostuse staatust. Ühenda dokumentide parandamine järgmise lepinguülevaatusega. [Omanike tabel](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/docs/05-moodulid.md#L60) · [Tegelik kirjutusõigus](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/features/components/engine/scale-from-pins.ts#L10) · [ADR-005 käsitlus](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/docs/03-arhitektuur.md#L193)

## Muu

### Kalibreerimisaken, foto ja vanad projektid

- **Käsitsi kalibreerimine.** Chromiumis ootasid kõik kuus kiirvalikut kinnitust ja andsid fookuse tagasi mm-väljale. Tühi sisend, 0 ja 1000,1 ei muutnud dokumenti. Ühe piksli pikkusel lõigul tuli veateade. 200 px ja 10 mm andsid 20,00 px/mm ning 50 µm/px. Foto 800 × 600 px oli 40 × 30 mm ja veerandpöörde järel 30 × 40 mm.
- **Pööratud foto ja alumine pool.** Märkisin sünteetilise foto punktid (350; 280) ja (414; 328) eri värvidega. Pärast foto 90° pööret ja peegeldust klappisid kuvatõmmiselt leitud keskmed sõltumatult arvutatud asukohtadega (584; 390) ja (632; 454). Alumise poole 0805 jalgade joondus andis 80 px / 2 mm = 40,00 px/mm. Mõlemad jalad jäid värvimärgist alla 0,001 ekraanipiksli kaugusele. Päris hiireklõpsud avasid vastavalt R1.1 ja R1.2.
- **Kujud ja märgid.** 16 korpust × 4 pööret × 2 plaadipoolt × 2 mõõtkava × 2 kohalikku skaalat andsid 512 SVG-juhtu. Teegi ja lõuendi märgipunktid kattusid sõltumatult arvutatud teisendusega. 448 märgisuuna kontrolli ja 1024 kontuuri sise-/välispunkti kontrolli läbisid. Ühel radiaalsel korpusel kontrollisin lisaks päris Chromiumis kahe jala ja fotomärkide kattumist foto kõigi kaheksa pöörde-peegelduse korral (suurim hälve 0 px). Korpuse kontuur ja tabamispolügoon kattusid. Ovaalse **padjandi** täidet puudutab leid 05.
- **Failivorming.** Rust avas ajutistes koopiates repo kuus väljalaskefaili v0.1.0, v0.1.1, v0.2.0, v0.3.0, v0.4.0 ja v0.5.0. Sõltumatus katses laadisin kõigi kuue dokumendirea läbi uue migratsiooni ja mootori ning võrdlesin sisu. V0.6.0 sünteetilise SQLite’i faili lõin selle sildi mootori ja Rusti salvestajaga. Selles olid kalibreeritud 0805, positiivne läbivus, ühendus ja rolliga võrgusilt. Kandidaat avas faili, parandas mõõtkava 15→20 px/mm, salvestas ja avas uuesti. Faili tunnus, võrgusilt, ✓ ning mõõtmine säilisid. Salvestatud dokument vastas oodatule tervikuna. Dokumendi, scale’i ja korpuse väljanimed jäid samaks, formaadiversioon oli 1. Rusti salvestuskoodi, mudeli ja migratsioonide diff oli tühi.
- **Ühilduvustestide piir.** Kaart 5 jättis vormingu püsimise tõttu uue fikstuuri teadlikult lisamata. Rusti automaattest leiab ainult kataloogis juba olevad failid ja TypeScripti fikstuurikataloogis on v0.1.0 dokument. 03 § 9 üldreegel ootab mõlemat fikstuuri iga väljalaske kohta. [03 üldreegel](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/docs/03-arhitektuur.md#L405) · [TypeScripti fikstuuride valik](https://github.com/Fuuduuu/BB/blob/2eb1a1c5a7324bf55507dc4d6553dbc84dcc43f8/packages/domain/src/release-files.test.ts#L8)

### Jõudlus ja teadaolevad otsused

Üleandmise kolme jooksu mediaanid olid 984,2 ms (töölaud ja foto), 59,01 fps (panoraam), 60,00 fps (rattasuum) ja 41,86 fps (lohistus). Kõik täitsid oma kaardipiiri. 60 radiaali, neist 9 all, ning 60 SOIC-ut, neist 7 all, vastasid seemnele 127. Kolme jooksu mediaan sobib sama sünteetilise koormuse võrdlemiseks. Tuhande ühenduse 2000 otsa olid eri jalgadel, ühegi jala aste ei ületanud ühte. Hargnenud GND-võrgu tööd sellest järeldada ei saa. Uut Tauri kaadrisageduse mõõtmist auditis ei tehtud.

**Teadaolev.** Kuju ja märgid on FootprintDef-is ning fikstuuriga kaetud FootprintGeom säilitab oma kuju. THT LED-i katoodi näitab lame serv. Tantaalil on ainult triip, elektrolüüdi triip asub miinusjalal. QFP nurgalõige on väike ja heleda teema märgitäidis nõrk. Laia components-sisendi kitsendamine on M2.3 töö. 

## Arhitektuur ja modulaarsus

**Praeguse jaotusega saab M2.3 ehitada.** Mõlema rakenduse koostepunktid ühendavad moodulid. Domeeni arvutused töötasid Node’is ilma renderdaja või Tauri hostita. Mootor hoiab registrit, hetkeseisu, valideerimist ja ajalugu. M2.2b lisas mõõtkava reegli domeeni ja registreeris komponendikäsu selgesõnalise erandiga. Mootor, lepingute põhipakett ja adapterid selleks ei muutunud. Kolm otsest tootmiskoodi importi ühe feature’i kaustast teise kasutasid sihtmooduli lepingut ning neil oli deklareeritud sõltuvus. Kaudne käsusõltuvus on erand (12).

**Avalik pind ja kordused.** Neljas API-failis lisandus 16 sümboli pealkirja. Enamikul on tarbija teegi eelvaates, joonistuses või joonduses. FootprintDef-i täpsustavad tüübid ei anna põhjust eraldi paketti luua. Domeen annab korpuse tegeliku kontuuri. HoverLayer lisab sellele 3 ekraanipiksli kuvamisvaru ja 4-punktilise ristküliku ning tihedama polügooni jaoks kasutatakse eri paisutust. See on vaate ülesanne. Tegelikud kulukad kordused asuvad hoopis sondi- ja joondustööriistade jala- ja fookusevalikus (01, 03, 05).

**Maht ja testid.** Suurimad tootefailid repo mittetühjade ridade mõõdiku järgi on Canvas.tsx (400), use-workbench.ts (399), domain/rules/connections.ts (397) ja BeepTool.tsx (394). Üle 400 oli neli testifaili, üle 600 polnud ühtegi. Matemaatika testid on domeeni juures, renderdus ja tööriista olek feature’i juures, kasutajateekonnad Chromiumis ning SQLite’i regressioonid Rusti integratsioonitestides. Joondustestid saab eraldada koos 01–04 parandustega.

**Varasemad ülevaatused.** [15. novembri viis leidu](2026-11-15-m1-3-arhitektuuri-ulevaatus.md) on kaetud teostuse ja praeguse testijooksuga: fotoimport seotakse seansiga, automaatne faililoome on eksklusiivne, vasaku paneeli muutus säilib, UI eeldab mootoripaarilist ja kesta reserveeritud klahvid on kaitstud. [17. novembri ülevaatest](2026-11-17-toovoo-ja-arhitektuuri-hinnang.md) tõrjub pingeparser nüüd sisendi `3 5 V`, `5 mV` annab 0,005 V. Jala ajaloos näeb sondipaari ja toiteolekut, otse lõuendi näidusildilt seda avada veel ei saa. Taastamise puudus kordus (13). Žestijärgset halvimat kaadrivahet mõõdetakse ning ADR-005 üldkäsud kasutavad nüüd domeeni objektireegleid.

**Laaditud oskused.** `superpowers:using-superpowers`, `superpowers:systematic-debugging`, `superpowers:verification-before-completion`, põhikausta commit’imata `code-review`, `bb-check-canvas`, `bb-review-storage`, kasutaja näidatud `high-end-visual-design` ja `codex-security:check-skills`. Viimase eraldi paigalduseelse turvaauditi hinnang on **INCOMPLETE**: nimetatud kohalikud oskused olid juba kasutusel või avastatavad. Eraldi puhast paigalduseelset seanssi sellel koodiauditil polnud. Üldotstarbelisi `engineering:architecture` ja `engineering:tech-debt` oskusi aktiivses kataloogis ei olnud. Arhitektuurijäreldused põhinevad tegelikul sõltuvusgraafil, registri- ja API-katsetel.

## Soovitus enne M2.3-t

| Järjekord | Töö ja hinnanguline kulu | Kasu ja vastuvõtu tõend |
|---|---|---|
| 1 | Ühenda Joonda ja Piiksu täpne padjandivalik ning HUD-i klahvide fookusereegel (1–2 arenduspäeva). | Parandab 01, 03 ja 05. Chromiumis jääb kõrvalnupu Enter selle nupule ning tihedal plaadil salvestuvad oodatud jala UID, ühendus ja mõõtkava. |
| 2 | Seo mõõtkavapakkumine korpuse hetkeseisu ja füüsilise mõõdu päritoluga (0,5–1,5 päeva). | Parandab 02, 04 ja 06. Pärast korpusevahetust kehtib uus kinnitus, ilma teadaoleva pikkuseta jääb foto kalibreerimata ja piiri ületamise korral saab kasutaja selgituse. |
| 3 | Kinnista kolme jooksu Tauri proov repos ja lisa sama ankruga hargnenud võrk (1–2 päeva). | Muudab 08 korratavaks ning annab M2.3 sisendite kitsendamisele mõõdetava võrdlusaluse. |
| 4 | Sulge moodulite liideste lüngad ja otsusta esimese skeemituletise sõltuvusleping (1–2 päeva). | Eksporditav UI laheneb, lubamatu transitiivne tee ja puuduv vajalik moodul tuvastatakse ning inkrementaalne skeemivaade võrdub värske arvutusega (09–12). |
| 5 | Lisa polaarsusmärgile kontrastne alusjoon ja kontrolli mõlemat fototausta (0,5 päeva). | Parandab 07 mõõdetavalt ning aitab tehnikul elektrolüüdi polaarsust fotolt lugeda. |

**Liitmise eeltingimus** on leidude 01–05 parandamine ja samade kordusjuhtumite läbimine. Lase tavakeskkonnas uuesti läbi ka `pnpm check` ning `pnpm e2e`. Ülejäänud leiud saab arhitekt triaažida enne nende puudutatud M2.3 töö algust.

## Arhitekti triaaž (2026-11-26)

Leiud 01–06 ja 09 kontrollisin koodis tipul `2eb1a1c`. Kõik on õiged:
- `AlignTool.onKey` kinnitab mõõtkava iga fookuse korral, välja arvatud küsimuse enda nupud.
- `scaleFromPins` arvutab jalgade vahe kinnitamise hetke korpusest.
- Joonda kasutab `hitIndex.query`-t, mitte täpset tabamust.
- Käsitsi lisatud jala `local` tuleb praegusest mõõtkavast.
- Ovaalse padjandi tabamiskuju on nurkadega ristkülik.
- Lubamatu pakkumise korral lõpeb joondus vaikselt.
- `nets/ui/index.ts` ei vasta ekspordimustrile.

Ülejäänud leiud võtan vastu Astra katsete põhjal.

Leiud 01 ja 03 on samad vead, mis M2.2 ülevaatusel Piiksus parandati ([M2.2 ül. 8](../plans/M2-2-piiksumisreziim.md)). Joonda kordas Piiksu vana jalavalikut ja Enteri käsitlust. Seepärast tuleb parandus ühise reeglina mõlemale tööriistale (Astra soovitus 1).

Liitmisele eelnevad parandused on [plaani Osa D](../plans/M2-2b-korpused-ja-mootkava.md#ülesanded):

| Kaart | Leiud | Rada | Sisu |
|---|---|---|---|
| ül. 6 · Ühine jalavalik ja klahvifookus | 01, 03, 05 | B | Joonda ja Piiks valivad jala ühe funktsiooniga: nähtava padjandi täpne tabamus läheb enne laiendatud ala. Ovaalse padjandi tabamiskuju vastab joonistusele. Tööriista `Enter` töötab ainult lõuendi või tööriista enda HUD-i fookusest. |
| ül. 7 · Mõõtkavapakkumise kehtivus, loetavus ja näidisfailid | 02, 04, 06, 07 | B | Salvestub ainult kuvatud mõõtkava; aluse muutumisel küsimus sulgub. Mõõtkava pakutakse ainult teegi padjanditega. Lubamatu pakkumise korral tuleb teade. Plussil ja triibul on kontrastne alusjoon. Lisanduvad väljalaske näidisfailid `v0.6.0` ja `v0.7.0`. |

Edasi lükatud leiud:

| Leid | Otsus |
|---|---|
| 08 | M2.3 plaani esimene jõudlustöö. Vastuvõtuproov tuleb reposse, praegu on see tööpuu `output/` kaustas. Enne ajastamist kontrollitakse andmete arvu ja lisatakse sama ankruga hargnenud võrk. Seni on M2-2b-5 arvud sama sünteetilise koormuse võrdlus, mitte iseseisvalt korratav tõend. |
| 09, 11, 12, 14 | M2.3 plaani mooduliliideste töö (Astra soovitus 4). Rakendus ega praegused tarbijad neid teid ei kasuta. |
| 10 | M2.3 plaan otsustab enne esimest sõltuvat skeemituletist, kas leping keelab tuletisel teise tuletise lugemise või deklareerib sõltuvused. |
| 13 | Järgmine salvestuse kaart koos salvestuse leidudega 04–06 (hiljemalt M4.3). Taastamine loob eraldi faili, nii et andmed ei kao. |
| 15 | Parandatud: 05 omanike tabelis on `components.scaleFromPins`, 03-s on ADR-005 teostus märgitud tehtuks. |
| Muu · näidisfailid | Lähevad ül. 7-sse. M2-2-11 ja M2-2b-5 jätsid näidisfaili lisamata, sest vorming ei muutunud. 03 § 9 nõuab aga faili iga väljalaske kohta ja `v0.6.0` on esimene, kus on piiksud ja ühenduse tase. |

Liitmine ja `v0.7.0` tulevad pärast ül. 7 raja B täisringi. Kaartide regressioonitestid kordavad Astra kordusjuhtumeid. Jõudlust uuesti ei mõõdeta, sest alusjoon lisab alla 1 % lõuendi elementidest.
