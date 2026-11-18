# BB kogu koodibaasi ülevaatus

19. november 2026 · `main` · `00a424e` · v0.4.0 järgne seis

Leidsin praeguses rakenduses 24 probleemi. Lisaks on kuus leidu arendustööriistades ja neli eraldi käivitatavas HTML-prototüübis. Kaks esimest puudutavad kasutaja projektifaili terviklust. Enne M2.1 arendust parandaksin need ja lisaksin mõlemale regressioonitesti, mis kontrollib ka pärast sulgemist uuesti avatud faili sisu.

P1 tähendab katses kinnitatud andmekao või vale sisu salvestamise ohtu. P2 mõjutab töövoogu, taastamist või kontrolli usaldusväärsust. P3 tähistab väiksema mõjuga või kitsama eeldusega juhtumit.

## Ulatus ja läbitud kontrollid

Läbi vaadati töölaua Tauri/Rusti failikiht ja IPC, brauseri IndexedDB-adapterid, TypeScripti andmemudel, mootor ja klient, funktsioonimoodulid, Reacti töölaud ja SVG-lõuend. Arendustööriistade osas hõlmas ülevaatus kaardikontrolli, MCP-d, jõudlusproove, Playwrighti ja CI konfiguratsiooni. Eraldi vaadati vana prototüüpi. See on lähtekoodi ülevaatus koos sihitud katsetega. Päris kasutajaprojekte katsetes ei kasutatud.

| Kontroll | Tegelik tulemus |
|---|---|
| Rust | `cargo test --locked --offline --no-fail-fast` läbis tavalises Windowsi ajutises kaustas 96/96 testi. Pikema teega ajutises kaustas ilmnenud tõrge uuriti eraldi läbi (leid 04). `cargo fmt --check` läbis. |
| Chromium | Kõik 42 olemasolevat E2E-testi läbisid, 0 vahele jäetud. Keskkond keelas ühenduse `127.0.0.1:5173`, seetõttu teenindasin sama tööpuu Vite’i väljalaset Chromiumile projekti võrguühenduseta tõendusskripti abil. Testide sisu jäi samaks. |
| Vitest | Täiskäigus läbis 1588/1592. Üks ajapiiri ületanud test läbis korduskatsel. Kolm tööriistatesti jäid korduskatselgi keskkonna õiguste taha (`EPERM` Windowsi kataloogilingi ehk junction’i loomisel). Kokku nähti 1589 eri testi läbimist. |
| Domeeni katvus | Ainult `packages/domain` katvuskäik läbis 188/188 testi. Ridakate 100%, harukate 98,95%, funktsioonikate 100% ja lausendikate 99,54%. Need arvud ei kirjelda tervet rakendust. |
| Staatilised kontrollid | Mõlemad TypeScripti konfiguratsioonid, ESLint, Prettier ning genereeritud API kontroll läbisid. Moodulisõltuvuste kontrollis oli 488 moodulit, 1868 sõltuvust ja 0 rikkumist. Failipikkuse kontroll lõpetas hoiatustega; need jäid funktsionaalsete vigade loendist välja. |

Windowsi MSI käsitsi vastuvõttu, päris remondiseanssi ega kõiki riistvara ja failisüsteemide kombinatsioone see ülevaatus ei katnud. Allpool tähendab „kooditee“, et järeldus põhineb kutsuja ja teostuse lugemisel. Sünteetilise katse tulemus on toodud eraldi.

## Töölaua salvestus ja taastamine

### 01 · P1 · Vana SQLite’i taastepäevik võib asendatud faili sisu muuta

Katkestatud kirjutuse järel jäi sihtfaili kõrvale aktiivne `-journal`. Uue projekti loomine olemasoleva asemele ja „Salvesta mujale“ mõlemad teatasid katses edust. Tagasi lugedes oli projekti ID uus, dokumendi nimi vana ning varasem päevik kustunud. Sama kasutajaprobleem puudutab kaht kooditeed.

Rusti salvestuskihi katse kahe sünteetilise projektiga ja päris katkestatud SQLite’i tehinguga. Enne asendamist ja uuesti avamist tuleb kaitsta ka SQLite’i kõrvalfaile, nagu taastamiskäsk juba teeb.

[apps/desktop/src-tauri/src/storage/mod.rs:248](../../apps/desktop/src-tauri/src/storage/mod.rs#L248) · [apps/desktop/src-tauri/src/storage/mod.rs:290](../../apps/desktop/src-tauri/src/storage/mod.rs#L290) · [apps/desktop/src-tauri/src/storage/restore.rs:34](../../apps/desktop/src-tauri/src/storage/restore.rs#L34)

### 02 · P1 · Automaatne päästekoopia võib teise projekti üle kirjutada

Päästenupp leiab vaba failinime. Kui mõni muu protsess jõuab sellele teele oma projekti salvestada enne koopia valmimist, asendatakse vahepeal tekkinud fail kinnitust küsimata.

Rusti katses oli sihtfaili projekti ID enne `different-owner`, pärast taasavamist `source`. Automaatne koopia peab hõivatud nime korral valima uue nime või tagastama konflikti. Failivalijas kinnitatud asendus vajab eraldi käsitlust.

[packages/ui/src/app/use-workbench.ts:272](../../packages/ui/src/app/use-workbench.ts#L272) · [apps/desktop/src-tauri/src/desktop_paths.rs:22](../../apps/desktop/src-tauri/src/desktop_paths.rs#L22) · [apps/desktop/src-tauri/src/storage/copy.rs:131](../../apps/desktop/src-tauri/src/storage/copy.rs#L131)

### 03 · P2 · Päästenupp jääb proovima algset ketast

Kokkujooksu järel suunatakse päästekoopia algse faili kõrvale. Täis või kirjutuskaitstud kettal või eemaldatud irdketta puhul puudub sellel veakuval tee teise kausta valimiseks.

UI-katses kordus mõlemal päästmiskatsel sama sihtkoht ja toimivat failivalijat kutsuti null korda. Pärast automaatse salvestuse nurjumist peaks saama valida teise ketta.

[packages/ui/src/app/use-workbench.ts:272](../../packages/ui/src/app/use-workbench.ts#L272) · [apps/desktop/src/desktop-host.ts:61](../../apps/desktop/src/desktop-host.ts#L61)

### 04 · P2 · Pikk Windowsi tee võib takistada uue projekti või varukoopia loomist

Tavalises Windowsi ajutises kaustas avanesid 215–235 märgi pikkuste absoluutsete teedega olemasolevad failid. Samadele teedele uue projekti loomine andis `Unknown`. Eraldi pika rakenduse andmekausta katses nurjus täisvarukoopia ning loend jäi tühjaks. Automaatse varunduse tõrge läheb ainult logisse.

Võrdluskatsed lühikeste ja pikkade teedega. Arvud kirjeldavad katses kasutatud nimesid. Kontrollida tuleb lõplikku ajutist teed koos UUID ja SQLite’i kõrvalfailidega ning näidata kasutajale, kui varukoopiat ei tekkinud.

[apps/desktop/src-tauri/src/storage/mod.rs:67](../../apps/desktop/src-tauri/src/storage/mod.rs#L67) · [apps/desktop/src-tauri/src/storage/backup/mod.rs:138](../../apps/desktop/src-tauri/src/storage/backup/mod.rs#L138) · [apps/desktop/src-tauri/src/storage/mod.rs:202](../../apps/desktop/src-tauri/src/storage/mod.rs#L202)

### 05 · P2 · Puuduvaks märgitud projekt jääb pärast edukat avamist avalehel suletuks

Kui avamiskatse ajal eemaldatakse näiteks mälupulk, salvestab UI tee puuduvate failide hulka. Pärast pulga tagasipanekut saab faili valijast avada. Avalehele naastes jääb sama projekti nupp keelatuks.

UI-integratsioonikatses andis hoidla pärast taastamist `missing:false`, kuid nupp jäi `disabled`. Edukas avamine peab eemaldama tee kohalikust puuduvate failide loendist.

[packages/ui/src/app/use-workbench.ts:145](../../packages/ui/src/app/use-workbench.ts#L145) · [packages/ui/src/app/use-workbench.ts:303](../../packages/ui/src/app/use-workbench.ts#L303) · [packages/ui/src/shell/StartScreen.tsx:38](../../packages/ui/src/shell/StartScreen.tsx#L38)

### 06 · P2 · Ebaõnnestunud avamine lisab vigase projekti hiljutiste loendisse

Piisab loetavast päisest ja tekstilisest nimest, et salvestusadapter lisaks projekti hiljutiste hulka. Dokumendi komponentide ja viidete kontroll toimub alles seejärel. Mitme eri vigase faili avamise katse võib tõrjuda loendist välja töötavad projektid.

Kooditee kontroll töölaual ja veebis. Hiljutiste kirje tuleks kinnitada pärast projekti edukat valideerimist ja aktiveerimist.

[packages/adapters/src/storage-tauri.ts:98](../../packages/adapters/src/storage-tauri.ts#L98) · [packages/adapters/src/storage-web.ts:257](../../packages/adapters/src/storage-web.ts#L257) · [packages/engine/src/project-service.ts:163](../../packages/engine/src/project-service.ts#L163)

### 07 · P3 · Sulgemisdialoog varjab päästekoopia uut veapõhjust

Kui algne salvestus nurjub täis ketta tõttu ja valitud päästekoopia asukoht on kirjutuskaitstud, näitab avatud dialoog endiselt esimest põhjust. Uus põhjus ilmub modaalist väljapoole.

UI-katse kinnitas mõlema teate asukoha. Kuvada kopeerimise tulemus aktiivses dialoogis, kust kasutaja saab tõrke lahendada.

[packages/ui/src/app/use-workbench.ts:278](../../packages/ui/src/app/use-workbench.ts#L278) · [packages/ui/src/app/Workbench.tsx:172](../../packages/ui/src/app/Workbench.tsx#L172)

### 08 · P3 · Olemasoleva koopia päritolu võib „Salvesta mujale“ järel kaduda

Kui lähtefailil on juba `copied_from_project_id`, kirjutab sama identiteediga kopeerimine Rustis selle väärtuse tühjaks. Fail jääb avatavaks, kuid info algse projekti kohta kaob.

Kooditee võrdlus mäluadapteriga. Selle eelduse täidab näiteks API-ga varem loodud uue identiteediga koopia. Sama identiteediga koopias tuleb olemasolev päritolu säilitada.

[apps/desktop/src-tauri/src/storage/copy.rs:114](../../apps/desktop/src-tauri/src/storage/copy.rs#L114) · [packages/engine/src/project-service.ts:310](../../packages/engine/src/project-service.ts#L310) · [packages/adapters/src/storage-memory.ts:129](../../packages/adapters/src/storage-memory.ts#L129)

## Plaadi töövoog, foto ja mõõtmised

### 09 · P2 · Stantsimisel pöörab R eelmist komponenti

Asetasin R1, liikusin järgmisse kohta ja vajutasin R. R1 kere muutus mõõdust 20 × 12,5 mõõtu 12,5 × 20. Eelvaade ja järgmine R2 jäid pööramata. Muutus jõuab juba paigutatud komponendi andmetesse.

Chromiumi katse. Aktiivne paigutustööriist peab klahvi töötlema enne valitud komponendi globaalset pööramiskäsku.

[packages/ui/src/canvas/use-canvas-keys.ts:75](../../packages/ui/src/canvas/use-canvas-keys.ts#L75) · [packages/features/components/ui/PlaceTool.ts:98](../../packages/features/components/ui/PlaceTool.ts#L98) · [docs/02-kasutaja-teekond.md:130](../../docs/02-kasutaja-teekond.md)

### 10 · P2 · Stants paigutab korpuse eelmiste parameetritega

Aktiivse stantsi ajal muutsin SOIC-i jalgade arvu 8 pealt 16 peale. Teegi eelvaade näitas 16, plaadile salvestati 8. Sama kordus takistiga, kus 0805 asendati teegis suurusega 2512, kuid järgmine takisti jäi 0805.

Reacti ja Chromiumi katsed. Teegi vormi ja aktiivse paigutustööriista parameetrid peavad pärinema samast seisust.

[packages/features/components/ui/Library.tsx:65](../../packages/features/components/ui/Library.tsx#L65) · [packages/features/components/ui/place-store.ts:29](../../packages/features/components/ui/place-store.ts#L29) · [packages/features/components/ui/PlaceTool.ts:105](../../packages/features/components/ui/PlaceTool.ts#L105)

### 11 · P2 · Akna vahetamine kustutab poolelioleva kalibreerimise

Kahe punkti valimise ja 17 mm sisestamise järel kaotas akna fookusekaotus nii dialoogi, väärtuse kui ka punktid. See tabab tehnikut näiteks siis, kui ta vaatab mõõtu teisest aknast.

Chromiumis edastatud `window.blur` sulges dialoogi. Poolelioleva lohistuse võib katkestada, avatud arvuvorm peab alles jääma.

[packages/ui/src/canvas/use-canvas-keys.ts:91](../../packages/ui/src/canvas/use-canvas-keys.ts#L91) · [packages/features/photo/ui/CalibrateTool.ts:45](../../packages/features/photo/ui/CalibrateTool.ts#L45)

### 12 · P2 · 32 jalaga QFN ilma keskpadjata märgitakse sobimatuks

Paigutamata 32 jalaga komponendi puhul öeldi „komponendil 32, korpusel 33“. Teek suudab sama QFN-i ilma keskpadjata luua täpselt 32 jalaga. Sobivuse otsing muudab ainult jalgade arvu ning jätab keskpadja alati sisse.

Reacti ja geomeetria katse. Sobivuse otsing peab arvestama ka parameetreid, mis lisavad või eemaldavad elektrilise padjandi.

[packages/features/components/ui/placement.ts:82](../../packages/features/components/ui/placement.ts#L82)

### 13 · P2 · Vormist loodud kinnitusava ei saa oma korpust

„Lisa komponent“ loob kinnitusava null jalaga ja lukustab jalgade arvu. Sama kinnitusava korpus tekib teegis ühe jalaga. Esimesel viisil loodud objekti paigutamisel lükatakse selle oma korpus tagasi.

Vormi ja teegi katses olid tulemused vastavalt 0 ja 1. Enne parandust tuleb kokku leppida, kumba kirjeldust see kinnitusava esindab, ning kasutada seda mõlemas kohas.

[packages/features/components/ui/AddComponentDialog.tsx:44](../../packages/features/components/ui/AddComponentDialog.tsx#L44) · [packages/domain/src/footprints/points.ts:31](../../packages/domain/src/footprints/points.ts#L31)

### 14 · P2 · Foto mahupiiri kontrollitakse pärast faili mällu lugemist

Üle 200 000 000 baidi foto puhul kutsub UI ikkagi välja `arrayBuffer()`. Veebiadapter teeb enne mahukontrolli veel koopia. Töölaual jõuavad baidid ka IPC kaudu Rusti. Lugemishäire korral näeb kasutaja eksitavat vigase pildi teadet.

Üle piiri suurust deklareeriva sünteetilise failiga kutsuti lugemine välja ja saadi `corrupt_image`. Tegelikku suurt mälueraldust polnud katses vaja. Kontrollida `File.size`-i enne lugemist ja puhvri pikkust enne kopeerimist.

[packages/features/photo/ui/add-photo.ts:43](../../packages/features/photo/ui/add-photo.ts#L43) · [packages/adapters/src/photos-web.ts:73](../../packages/adapters/src/photos-web.ts#L73) · [apps/desktop/src-tauri/src/ipc_photo.rs:48](../../apps/desktop/src-tauri/src/ipc_photo.rs#L48)

### 15 · P2 · Erinevate sondipaaride mõõtmismustandid võivad seguneda

Kui failis olevad jala-UID-d sisaldavad püstkriipsu, võivad kaks eri sondipaari saada sama võtme. Ühe paari salvestamata väärtus võib teise paari valimisel ilmuda valesse mõõtmisse. BB enda tavaline ID-generaator selliseid tunnuseid ei loo.

Mootor laadis katseprojekti nelja erineva UID-ga. Paaridele `('pin_a|pin_b','pin_c')` ja `('pin_a','pin_b|pin_c')` saadi sama võti. Võtmes tuleb mõlema tunnuse piir üheselt säilitada.

[packages/features/measurements/ui/measure-store.ts:37](../../packages/features/measurements/ui/measure-store.ts#L37)

### 16 · P3 · Punktkomponendi leidmine loendist ei tõsta seda plaadil esile

TP1 reale osutades jäi lõuendi esiletõstukiht tühjaks. Sama kooditee puudutab läbiviike, padjandeid, juhtmepunkte ja kinnitusavasid. Nende graafikal puudub kontuuriga komponendikere.

Reacti katses ei tekkinud TP1-le kontuuri. Sellise komponendi esiletõstmiseks saab kasutada padjandi mõõte.

[packages/features/components/ui/layers/HoverLayer.tsx:12](../../packages/features/components/ui/layers/HoverLayer.tsx#L12) · [packages/domain/src/geometry/board.ts:87](../../packages/domain/src/geometry/board.ts#L87)

### 17 · P3 · Ristkülikukujuline kasutaja padjand muutub ringiks

Failivorming lubab kasutaja padjandil kuju `rect`, kuid `boardPads` annab selle alati edasi ringina. See muudab nii pilti kui ka nurkade hiiretabamust. Praeguse vormi kaudu loodud ümarad padjandid käituvad ootuspäraselt.

Geomeetria katses sisestati `rect` ja väljund oli `circle`. Kuju tuleb võtta padjandi andmetest.

[packages/domain/src/geometry/board.ts:80](../../packages/domain/src/geometry/board.ts#L80) · [packages/features/components/ui/layers/ComponentShape.tsx:150](../../packages/features/components/ui/layers/ComponentShape.tsx#L150)

### 18 · P3 · Võrdse ajatempliga näidud on eri vaadetes erinevas järjekorras

Kui samale jalale salvestati sama ajatempliga esmalt 3 V ja seejärel 8 V, oli üldajaloo esimene näit 3 V. Jala ajalugu asetas esimeseks 8 V ja sama väärtus kuvati plaadil.

Mõõtmiste UI-katse. Kasutada ajatempli võrdsuse korral kõigis vaadetes sama lisamisjärjekorda.

[packages/features/measurements/ui/MeasurementList.tsx:27](../../packages/features/measurements/ui/MeasurementList.tsx#L27) · [packages/features/measurements/ui/PinMeasurements.tsx:24](../../packages/features/measurements/ui/PinMeasurements.tsx#L24) · [packages/domain/src/measure/pin-readings.ts:55](../../packages/domain/src/measure/pin-readings.ts#L55)

### 19 · P3 · Fotoviite nimi erineb dokumenteeritud impordireeglist

Brauseris salvestus foto nimeks `audit.png`. Projekti leping näeb failist importimisel ette nime `audit` ja kleepimisel „Kleebitud foto“. Ühine failiimpordi kood edastab täisnime. Töölaua eraldi failiteelt importimise kood eemaldab laiendi.

Kontrollisin tegelikku `PhotoRef`-i Chromiumi IndexedDB-s ning võrdlesin mõlemat importimisteed. Nime tuleks töödelda ühes kohas ja säilitada teave, kas pilt kleebiti.

[packages/features/photo/ui/add-photo.ts:53](../../packages/features/photo/ui/add-photo.ts#L53) · [apps/desktop/src-tauri/src/storage/photos.rs:242](../../apps/desktop/src-tauri/src/storage/photos.rs#L242) · [docs/03-arhitektuur.md:413](../../docs/03-arhitektuur.md)

## Brauseriversiooni andmed

### 20 · P2 · Ühe projekti avamine loeb ka teiste projektide fotokirjed

Tühja projekti avamisel luges IndexedDB kõigi 20 kõrvalise projekti fotokirjed ning filtreeris need alles JavaScriptis välja. Avamise töömaht kasvab seega koos kogu fotokoguga.

Mõõtsin päritud kirjete arvu. Mälumahtu ja millisekundeid sellest katsest ei järeldatud. Kasutada konkreetse projekti võtmeprefiksi vahemikku.

[packages/adapters/src/photos-web.ts:55](../../packages/adapters/src/photos-web.ts#L55)

### 21 · P2 · Puuduv fotokirje viib veebis terve lõuendi veakuvale

Kui terve plaadidokument viitab fotole, mille kirje IndexedDB-s puudub, näitab töölaud olekut „Salvestatud“, aga lõuendi asemel kuvatakse „Selle osa kuvamisel tekkis viga“. Puuduv fail takistab töötamist ka ülejäänud plaadiga.

Chromiumi katses avasin sellise sünteetilise projekti. Kuvada tuleks ülejäänud lõuend ning öelda, milline foto puudub.

[packages/adapters/src/photos-web.ts:145](../../packages/adapters/src/photos-web.ts#L145) · [packages/features/photo/ui/PhotoLayer.tsx:13](../../packages/features/photo/ui/PhotoLayer.tsx#L13)

### 22 · P2 · Uuema vorminguga veebiprojekti muudetakse enne avamisest keeldumist

Vormingu 2 kirje, millel puudus `meta.file_id`, sai üksnes avamiskatsega uue UUID. Samal ajal näitas UI õigesti, et fail on tehtud uuema äpiga. Muutus toimus hoidlakirje metas.

Tegeliku Chromiumi IndexedDB kirje võrdlus enne ja pärast. Kontrollida toetatud vormingut enne pärandkirjele ID lisamist.

[packages/adapters/src/storage-web.ts:245](../../packages/adapters/src/storage-web.ts#L245) · [packages/engine/src/project-service.ts:151](../../packages/engine/src/project-service.ts#L151)

### 23 · P2 · PNG suunamärgendit tõlgendatakse veebis ja töölaual erinevalt

Kehtiva PNG `eXIf` suunaga 6 salvestas brauser foto teisenduseks `none`. Töölaud loeb sama tüüpi märgendit ja vastendab 6 teisenduseks `rot90`. Sama sisend võib seega anda erineva plaadivaate.

Importisin Chromiumis sünteetilise 9 × 6 PNG ja lugesin `PhotoRef`-i. Töölaua võrdlusalus on Rusti suunalugemine ning läbiv PNG EXIF-i test. Brauseri piksliväljundit selles katses ei mõõdetud.

[packages/adapters/src/exif.ts:20](../../packages/adapters/src/exif.ts#L20) · [packages/adapters/src/photos-web.ts:133](../../packages/adapters/src/photos-web.ts#L133) · [apps/desktop/src-tauri/src/storage/photos.rs:36](../../apps/desktop/src-tauri/src/storage/photos.rs#L36)

### 24 · P3 · Rikutud vaate-eelistus võib terve veebiprojekti avamise nurjata

IndexedDB lubab salvestada ka tsüklilist objekti või `BigInt`-i. Kui selline väärtus satub `view.modules` alla, viskab JSON-iks teisendamine erindi. Plaadidokument võib ise täiesti korras olla.

Sünteetilises IndexedDB katses nurjus avamine veaga `unknown` ning ühe ettevalmistatud fotoseansi vabastamine jäi vahele. Vaateinfo tõrkel saab taastada vaikeseaded ja avada dokumendi.

[packages/contracts/src/view-state.ts:80](../../packages/contracts/src/view-state.ts#L80) · [packages/adapters/src/storage-web.ts:186](../../packages/adapters/src/storage-web.ts#L186)

## Ülevaatus-, ehitus- ja arendustööriistad

### 25 · P2 · Kaardikontroll jätab nõutud regressioone vaikselt välja

Päris kaardi M1-4-3b aruandesse ei jõudnud `sharp_redraw_after_lod_delay` ega `early_commit_keeps_lod_until_settle`. Kaartidelt M1-4-1b ja M1-4-H puudus kummastki veel üks nimi. Kõigil kolmel juhul oli hoiatuste loend tühi.

Käivitasin olemasoleva parseri nende kaartide sisul. Nõutud test võib nii kaduda või vahele jääda ilma, et kaardi kontroll sellest teada annaks.

[tooling/review-card/card.mjs:145](../../tooling/review-card/card.mjs#L145) · [docs/tasks/M1-4-3b.md:34](../../docs/tasks/M1-4-3b.md)

### 26 · P2 · Kohalik E2E võib kontrollida teise tööpuu rakendust

Otsene `pnpm e2e` kasutab kõigis tööpuudes porti 5173 ja lubab väljaspool CI-d sellel pordil töötavat serverit uuesti kasutada. Kui seal töötab haru A, võivad haru B testid anda tulemuse A rakenduse kohta.

Kontrollitud Playwrighti konfiguratsioonist. `bb-review-card` määrab CI-režiimi. Otsene käsk vajab oma porti või kontrolli, millise tööpuu server vastab.

[playwright.config.ts:8](../../playwright.config.ts#L8) · [playwright.config.ts:17](../../playwright.config.ts#L17)

### 27 · P2 · Kahe samaaegse ülevaatuse puhul võib üks üleandmine kaduda

Kaks sama nimega ülevaatust kontrollivad faili olemasolu enne selle kirjutamist. Sünteetilises ajutises postkastis tagastasid mõlemad saatmised edu ja sama nime. Alles jäi üks fail.

Kahe kattuva kirjutuse katse. Luua fail eksklusiivselt ning proovida nimekonflikti korral järgmist numbrit.

[tools/mcp-bb/bb_mcp.py:398](../../tools/mcp-bb/bb_mcp.py#L398) · [tools/mcp-bb/bb_mcp.py:415](../../tools/mcp-bb/bb_mcp.py#L415)

### 28 · P2 · `bb_task` ei leia kaardil viidatud olemasolevat koodi

TOOL-1 viide `tooling/check-file-length.mjs` tagastas `No document matches`. M1-4-1 `Canvas.tsx` reavahemikud on sulgudes väljaspool koodimärke ja kaovad juba enne faili lahendamist.

Käivitati `expand_ref` päris kaardi viitega. Lahendada faili tüüp enne dokumendinime otsingut ning säilitada kaardis tegelikult kasutatud reavahemikud.

[tools/mcp-bb/bb_mcp.py:223](../../tools/mcp-bb/bb_mcp.py#L223) · [tools/mcp-bb/bb_mcp.py:232](../../tools/mcp-bb/bb_mcp.py#L232) · [docs/tasks/M1-4-1.md:15](../../docs/tasks/M1-4-1.md)

### 29 · P3 · Jõudlusaruanne lükkab vastuvõetud kaadrisageduse tagasi

Kaardil on vastuvõtupiir vähemalt 57 fps, kuid töölauaproov kasutab 60 fps. Avaldatud tulemus 59,3 fps saab vormindajalt vastuse „Ei“.

Kontrollitud päris aruandevormindajaga. Proov ja vastuvõtukaart vajavad sama lävendit.

[apps/desktop/src/perf/probe.ts:230](../../apps/desktop/src/perf/probe.ts#L230) · [docs/tasks/M1-4-11.md:67](../../docs/tasks/M1-4-11.md)

### 30 · P3 · Korduva pealkirjaga jaotisi ei saa dokumenditööriistast eraldi lugeda

M0 üleandmises esineb „Tegelikud kontrollid“ kümme korda. Kõigile antakse sama ankur ning lugemispäring valib esimese. Ülejäänud üheksat ei saa pakutud ankru abil avada.

Kontrollisin päris dokumendi jaotisi. Moodustada kordustele erinevad ankrud ning lahendada päring täpse ankru alusel.

[tools/mcp-bb/bb_mcp.py:97](../../tools/mcp-bb/bb_mcp.py#L97) · [tools/mcp-bb/bb_mcp.py:211](../../tools/mcp-bb/bb_mcp.py#L211)

## Varasem eraldi HTML-prototüüp

### 31 · P2 · Pööramise tagasivõtmine jätab foto ja komponendid eri asendisse

7 × 4 fotol asus komponent punktis (2, 1). Pärast pööramist oli foto 4 × 7 ja komponent punktis (3, 2). Undo taastas punkti (2, 1), aga foto jäi mõõtu 4 × 7.

Kontrollitud Chromiumis prototüübi tegelike pööramis- ja tagasivõtufunktsioonidega. Foto ja sellel olevad koordinaadid peavad kuuluma samasse ajaloosammu.

[prototype/src/js/02-state.js:137](../../prototype/src/js/02-state.js#L137) · [prototype/src/js/06-io.js:186](../../prototype/src/js/06-io.js#L186)

### 32 · P2 · Uus projekt võib kustutada foto ja mõõdud kinnitust küsimata

Foto, kalibreeringu ja mõõtmega töö asendati tühja projektiga, kui ühtegi komponenti ega rada polnud veel lisatud. Kontroll loendab kinnituse näitamiseks ainult komponente ja radu.

Sünteetilises katses oli kinnituste arv 0 ja foto ning mõõdud kadusid aktiivsest projektist. Hinnata tuleb ka foto ja muude kaardistusandmete olemasolu.

[prototype/src/js/06-io.js:192](../../prototype/src/js/06-io.js#L192)

### 33 · P2 · Vigase JSON-faili avamine asendab toimiva projekti mälus

Õige rakendusetunnusega JSON, mille `comps` väärtus on `null`, jõuab aktiivse dokumendi asemele enne täielikku kontrolli. Veateade jätab mulje, et import lihtsalt nurjus, kuigi varasem töö on mälus juba asendatud.

Korrati prototüübi laadimisfunktsiooniga sünteetilisel andmestikul. Valideerida ja ette valmistada tuleb kogu kandidaat enne aktiivse seisu või pildi muutmist.

[prototype/src/js/06-io.js:38](../../prototype/src/js/06-io.js#L38)

### 34 · P3 · JSON-eksport märgitakse lõpetatuks ka salvestamisest loobumisel

JSON-i eksport ei oota salvestusfunktsiooni tulemust. Kui kasutaja katkestab salvestamise, jääb toiming töövoos ikkagi lõpetatuks märgituks.

Kooditee kontroll. `saveProject` peaks tagastama salvestuse tulemuse ja `runExport` seda ootama.

[prototype/src/js/06-io.js:62](../../prototype/src/js/06-io.js#L62) · [prototype/src/js/06-io.js:133](../../prototype/src/js/06-io.js#L133)

## Taastamise piirang

Kui mälust tehtud päästekoopia lähtefoto baite ei sisalda, jääb koopiasse fotoviide. Praegune kasutajaliides keelab selle viite tõttu ka algse JPG uuesti lisamise. Olemasoleva käitumise järgi hoiatab rakendus puuduva meedia eest ja foto asendamise töövoog on kavandatud hilisemaks. Seda piirangut tasub päästekoopia teates konkreetselt kirjeldada. See on väljaspool ülaltoodud 34 vea arvestust.

[Foto lisamine](../../packages/features/photo/ui/add-photo.ts#L40) · [Mälust taastatud koopia](../../docs/03-arhitektuur.md) · [Foto asendamise ulatus](../../docs/04-andmemudel.md)


## Arhitekti triaaž (2026-11-19)

Arhitekt kontrollis koodis leide 01, 02, 09, 10 ja 11. Kõik viis on koodis olemas.

| Leiud | Kuhu | Põhjus |
|---|---|---|
| 01, 02, 03, 07, 08 | [M2-1-H](../tasks/M2-1-H.md), rada B, enne M2.1 tööd | Projektifaili terviklus ja päästekoopia. See on M2.1 ainus hooldusvoor. |
| 09, 10, 11 | M2-1-1, rada A | Igapäevase töövoo vead: `R` paigutamisel, teegi parameetrid paigutamise ajal, kalibreerimine akna vahetusel. |
| 25, 26, 27, 28, 29, 30 | Astra tööriistad (`tooling/`, `tools/mcp-bb/`) | Esimesena 25: kaardikontroll ei tohi nõutud testi vaikselt välja jätta. |
| 04, 05, 06, 12–24 | M2.1 plaani väiksemate tööde loend | Kitsam eeldus või veebiversiooni piir. |
| 31–34 | Ei paranda | Vana HTML-prototüüp on ainult võrdlusalus. |
