# Ülevaatus: BB arhitektuuri ja modulaarsuse audit · codex/m2-3 · cbd4d42 · 27.11.2026

- **Ülevaataja:** astra
- **Kuupäev:** 2026-11-27
- **Git HEAD:** 9cbfe7f docs: Astra architecture audit ordered at cbd4d42
- **Üldhinnang:** JAH, PÄRAST PARANDUSI

## Kokkuvõte

**BB on ühe tiimi kohaliku redaktori jaoks õiges mõõdus.** Säilita domeen, käsud ja Undo, üks SVG-lõuend ning SQLite-fail. 331 tootmismooduli graafis oli 0 käitusaegset tsüklit. Täpseid TS/TSX tokenikordusi oli tootekoodis 0,31%. Suurim risk on sama kasutajaotsuse erinev tõlgendus kahes tööriistas.
**22 leidu: 1 P1, 15 P2, 6 P3.** P1 kordus nii mõõtmise kui ka raja salvestamisel. Kihireeglite ja käsutüüpide nõrkused ilmnesid kontrollkatsetes. Kõik kaheksa väljalaske näidisfaili läbisid tipu domeenikontrolli. Kontrollisin ainult sünteetilisi andmeid ja repo näidiseid.

## Top 5 soovitust

| Jrk | Millal ja mida teha | Maht ja risk |
|---|---|---|
| 1 | Enne M2-3-4 ühenda musta sondi ja Raja jalavaliku reegel. Mõlemad peavad samal padjal salvestama sama jala (01). | S · väike, kui eri kihtide ja harude prioriteedid saavad regressioonitesti |
| 2 | Paranda skeemikaamera koopia ning kasuta vahetusel jaluses ja lõuendil sama tööriista (02, 17). | S · väike, katse mõlema vaate ja kordusavamisega |
| 3 | Otsusta kahe vaate harutamine enne M2.4 juhtmeid. Lisa üks kahe joonistuse ja Undo vastuvõtukatse (03). | M · keskmine, puudutab jagatud dokumendi tähendust |
| 4 | Seo lõuendi indeks ja pingenäidud nende tegelike sisenditega. Alusta väiksemast pingenäitude parandusest, mõõda tulemus Tauris (05–06). | S + M · keskmine, aegunud tabamisgeomeetria oleks uus õigsusviga |
| 5 | Käivita CI-s kogu Vitest üks kord. Seo kaardi koodilõik ja kohalik E2E sama koodiversiooniga (11–13). | S eri sammudena · väike, säilita testide nimelised tulemused ja punase käigu diagnostika |

## Käivitatud kontrollid

| Käsk ja versioon | Tulemus selles auditis |
|---|---|
| Vitest 5.1.0 + V8 5.1.0, `vitest run --coverage --config <ajutine konfiguratsioon>` | 1747/1761 läbis, 14 ebaõnnestus tööriistatestides. Kõik tootekatsed läbisid. Kolmel juhul keelas Windows testifixtuuri kataloogilingi loomise (EPERM), 11 juhul erines ajutise paketipeegli füüsiline require.resolve tee. Lukufail kattus kasutatud sõltuvuste peegliga. Tavapärane pnpm check ei saanud siit rohelist tulemust. |
| Laiendatud V8 katvus | 303 tootmise TS/TSX faili, 7509/8416 rida (89,22%), 5650/6597 haru (85,64%). Tüübikatsete ja veebitesti abifailid eemaldati koondist. Domeen 99,91% ridu / 94,00% harusid, engine 98,54% ridu, features 97,41%, ui 93,87%, adapters 92,02%. Püsiv CI künnis katab ainult domeeni. See mõõtmine ei hõlma Rusti ega päris WebView2-d. [Katvuse ulatus](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/vitest.config.ts#L16) |
| Playwright 1.65.0, `playwright test --config <offline>` | 47/47 läbis, 0 korduskatsega läbinut ja 0 vahele jäetud. 191,9 s. Testid kasutasid selle tipu Vite’i väljastust Chromiumis repo offline-ruutimisega. Brauserile antud failide SHA-256 algus e0c00f2ebbff. Tavalist 5173 arendusserverit selles jooksus ei kasutatud. |
| Rust 1.99.1, `cargo test --locked --offline` | 108 läbis, 0 ebaõnnestus. Kaks ignore-märgisega abijuhtu käivitatakse alamprotsessina. |
| Sihitud katsed | Vitest 5.1.0 + jsdom: 5/5 kordusjuhtumit kinnitasid leide 01, 03, 05 ja 17. Node 26.13.0 avalike käskudega kordasin skeemikaamera, ajatäpsuse, dokumendi avamise ja tuletiste juhtumid. |
| Tüübid, API, stiil ja faili pikkus | TypeScript 5.9.3 `tsc --noEmit` ja `tsc --noEmit -p tsconfig.backend.json`, ESLint 10.14.0 `. --max-warnings 0` ning Prettier 3.9.10 `--check .` läbisid. `node tooling/api-digest.mjs --check` läbis ühe 416-realise faili märkusega, `node tooling/check-file-length.mjs` nelja testifaili märkusega. Käivitasin need otse. Repo pnpm-versioon on 12.18.0. |
| Muu | Fikseeritud tipu dokumendikontroll läbis 199 Markdown-faili. Git 2.56.0.windows.4: `git diff --check 419ab44..cbd4d42` läbis. Kontrollid ja paketid jäid ajutisse koopiasse. |

## Leiud

### 1. [P1] Musta sondi ja Raja tööriist võivad salvestada kõrvaljala

- **Jaotis:** A, B · tabamisindeks ja andmete õigsus
- **Stsenaarium:** Kaks Canvas + Engine katset. U1.1 padja raadius oli 10, U1.2 raadius 2,5 ja keskmed 15 ühiku kaugusel. Klõps (129,5; 100) asus ainult U1.1 padjas. Musta sondi valikuga salvestus mõõtmine U1.4↔U1.2. Samast punktist alustatud rada salvestus U1.2↔U1.4. Indeksis oli U1.1 täpne tabamus, U1.2 ainult tabamisvaru sees. Mõlemad tööriistad valisid U1.2. [Sond](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/measurements/ui/PickRefTool.ts#L19) · [Raja algus](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/connections/ui/TraceTool.ts#L269) · [täpse tabamuse abiline](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/ui/src/canvas/hit-index.ts#L34)
- **Soovitatud muudatus:** S · Paranda enne M2-3-4. Eelista otspunkti valides tegelikku padjapinda tabamisvarule, säilita Raja kihireegel ning raja ja liitepunkti prioriteedid. Kata must sond ja raja mõlemad otsad. Vastasel juhul saab tehnik usutava, vale kontaktiga mõõtmise või võrgu.

### 2. [P2] Avalikust vaatevastusest saab muuta salvestuskoordinaatori skeemikaamerat

- **Jaotis:** A, B · skeemikaamera salvestus
- **Stsenaarium:** Sünteetiline projekt. Pärast salvestust muutsin open-vastuse schematicView.pan.x väärtuse 10→999 ja kordasin open/saveView/flush. Teenus näitas 999, hoidlas oli 10, kirjutusi endiselt üks. Sama katse plaadiga jättis väärtuseks 10. Praegune UI hüdratsioon teeb oma koopia. [Kopeerimine](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/engine/src/save-coordinator.ts#L20) · [avalik vaade](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/engine/src/save-coordinator.ts#L199) · [seni plaati kaitsev test](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/engine/src/project-view.test.ts#L139)
- **Soovitatud muudatus:** S · Kopeeri mõlema kaamera muutuvad väljad teenuse piiril sama teed pidi ja kontrolli mõlemat vaadet ühe parameetrilise testiga. Järgmine API-tarbija võib muidu näha kordusavamisel endise asukoha taastumist.

### 3. [P2] Plaadil haru loomine jätab skeemitee vana kuju uute otste vahele

- **Jaotis:** A, E · kaks vaadet, M2.4
- **Stsenaarium:** Kahes vaates joonistatud sünteetilisel ühendusel A–B oli skeemis kaks vahepunkti. Avalik connections.branch õnnestus. Kogu skeemitee jäi A–D lõigule, uuel D-l puudus skeemikoordinaat ja D–B lõigul puudus skeemijoonistus. Mudel lubab seda sisendit juba täna, skeemijuhtmete joonistamine UI-s on kavandatud M2.4-sse. [Failimudel](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/domain/src/model/connection.ts#L5) · [haru arvutus](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/domain/src/rules/connections.ts#L378) · [käsu kirjutused](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/connections/engine/index.ts#L86)
- **Soovitatud muudatus:** M · Enne M2.4 määra, kuidas teise vaate tee ja paigutamata liitepunkt jagamisel säilivad. Lisa kahes vaates joonistatud tee ja ühe Undo katse. Vastasel juhul saab esimese skeemijuhtme kasutaja lõhkuda selle kuju tavapärase plaaditoiminguga.

### 4. [P2] Üks vahefail laseb kihireeglist mööda

- **Jaotis:** A · paketi- ja moodulipiirid
- **Stsenaarium:** Nelja sünteetilise sõltuvustee katse sama dependency-cruiser’i konfiguratsiooniga. Mootor → UI ja UI → node:path keelati 2/2. Mootor → moodulijuure abifail → UI ning UI → moodulijuure abifail → node:path pääsesid läbi 2/2. Tipu tegelikus tootmisgraafis sellist rikkumist ei leidnud. [Kihireeglid](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/.dependency-cruiser.cjs#L55) · [hosti piir](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/.dependency-cruiser.cjs#L120) · [lubatud kihid](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/docs/03-arhitektuur.md#L65)
- **Soovitatud muudatus:** S · Piira mõlemalt poolt imporditavat moodulijuure abikoodi ning lisa vahendatud tee lubav ja keelav kontroll. M2.4 ja M4 ajal võib muidu brauser eeldada Node’i olemasolu või mootor saada UI-sõltuvuse rohelise CI-ga.

### 5. [P2] Ühegi objekti asukoht ei muutu, kuid projektinime muutus ehitab tabamisindeksi uuesti

- **Jaotis:** A, D · SVG ja tabamisindeks
- **Stsenaarium:** Seemnega 42 plaadil (300 komponenti, 3000 jalga, 1000 rada) tegin üheksa project.rename käsku. Komponentide massiivi viide säilis. Igal korral küsiti uuesti üheksa kihi tabamusi ja koguti 8494 tabamisobjekti. jsdom-i Reacti uuenduse mediaan oli 24,1 ms (21,3–33,9 ms), SVG-kihtide joonistamine oli mõõtmisest väljas. [Indeksi sõltuvused](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/ui/src/canvas/Canvas.tsx#L103) · [ümbernimetamine](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/project/engine/index.ts#L5) · [komponentide objektid](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/components/ui/layers/hits.ts#L13)
- **Soovitatud muudatus:** M · Alusta katsest, mis nõuab muutumatu geomeetriaga käsul null uut indeksiehitust. Seo invalidatsioon registri tegelike sisenditega, säilita vajadusel suumi, mõõtkava, siltide, komponentide ja liitepunktide uuendus. Muidu makstakse seda hinda ka dokumenti muutva M3 sisestuse ajal. Tauri kaadrisagedus vajab eraldi mõõtmist.

### 6. [P2] Komponendi liigutamine arvutab uuesti ka 1500 muutumata pingenäitu

- **Jaotis:** A, D · tuletiste vahemälu
- **Stsenaarium:** 40 sammu avaliku items.translate käsuga. nets ja connectionLevels säilitasid 40/40 korral sama viite. pinReadings arvutati ja parsiti 40/40 uuesti. Esimesed viis sammu välja jättes oli käsu mediaan 10,98 ms ja pingenäitude arvutuse ning parsimise mediaan 1,94 ms (Node, renderita). [Sisendid](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/measurements/engine/derive.ts#L6) · [kasutatud väljad](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/domain/src/measure/pin-readings.ts#L33) · [olemasolev valikumehhanism](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/engine/src/derivation.ts#L48)
- **Soovitatud muudatus:** S · Kasuta olemasolevat inputs.select mehhanismi komponentide ID-de ja jalgade jaoks. Võrdle tulemust täisarvutusega asendi muutusel, jala asendusel ja Undo järel. Muidu kasvab M3 mõõteajaloo hind ka geomeetriamuudatustel.

### 7. [P2] Ühel dokumendil on kaks erinevat „viimase mõõtmise“ reeglit

- **Jaotis:** B, E · mõõtmisandmete tõlgendamine
- **Stsenaarium:** Avaliku käsu katse. Samale jalale lisasin 9 V kell .123900Z, seejärel 1 V kell .123100Z. Mõlemad käsud õnnestusid ja dokumendis säilisid täpsed ajad. Lõuendile antud pinReadings valis 1 V. Läbivuse arvutus kasutab kogu ajatemplit. Kolmes ajaloo vaates on sama millisekundini ümardamine. [Pingenäit](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/domain/src/measure/pin-readings.ts#L53) · [täpne võrdlus](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/domain/src/rules/compare-timestamps.ts#L18) · [teadlik varasem piir](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/docs/tasks/M2-2-10.md#L29)
- **Soovitatud muudatus:** S · Kasuta üht ajavõrdlejat neljas tarbijas. Võrdse aja korral säilita viimati lisatud kirje eelis. Tavaline UI kell salvestab millisekundeid. Täpsema faili või M4 impordi korral kuvatakse muidu varasem pinge värskeimana.

### 8. [P2] Sama dokument läbib avamisel kolm täisparsimist

- **Jaotis:** A, D · avamine ja tulevane import
- **Stsenaarium:** 12 sünteetilise avamise mõõtmine. 873 705-baidises projektis (300 komponenti, 3000 jalga, 1000 ühendust, 2000 mõõtmist) loendasin avamise kohta kolm BoardDocSchema.parse-kutset ja kuue terviklusreegli kaks läbimist. Üheteistkümne soojendatud mälust avamise mediaan oli 162,97 ms, kolme parsimise summa mediaan 40,07 ms. Kettalugemist ei mõõdetud. [Ettevalmistus](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/engine/src/project-service.ts#L168) · [üleandmine](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/engine/src/project-service.ts#L203) · [reeglite käitamine](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/engine/src/invariants.ts#L7)
- **Soovitatud muudatus:** S · Eemalda esmalt vahetult üksteisele järgnev sama skeemi parsimine ja võrdle tulemust suure dokumendiga. Hoia avalik host.load ning valideerimine enne fotode koristamist. M4 impordis korrutub muidu kogu dokumendi töö igal avamisel.

### 9. [P2] Võrgu nime leidmiseks on kaks indeksit ja kolmas otsing

- **Jaotis:** A, B · moodulite andmeomand
- **Stsenaarium:** Kahel WeakMap-il on sama nets.list lähteandmestik. Valitud ühendusel lisandub nimetu võrgu korral lineaarne find. Raja silt vajab kasutaja antud nime, omaduste paneel peab näitama ka automaatset nime. [Koostes olev indeks](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/ui.ts#L15) · [võrgumooduli indeks](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/nets/contract.ts#L54) · [paneeli varuotsing](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/connections/ui/ConnectionProperties.tsx#L34)
- **Soovitatud muudatus:** S · Anna võrgu lepingust üks liikme järgi otsitav võrguinfo, milles on nimi ja selle päritolu. Hoia kahe vaate kuvamisotsused eraldi. M2.4 juhtmesildist võib muidu saada sama reegli neljas omanik.

### 10. [P2] Tüübikontroll lubab tootmiskliendil testikäsku ja registril kirjaveaga nime

- **Jaotis:** A, C · avalik käsuleping
- **Stsenaarium:** TS 5.9.3 katse tootmisfrontendi virtuaalfailiga. execute('test.mutate', {}) ja CommandSpec-i id 'project.renaem' andsid kumbki 0 diagnostikat. Sama kirjaveaga kliendikutse sai ootuspäraselt TS2345. Tootmiskäskudes kirjaviga ei leidnud. [Testi laiendus](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/engine/src/__tests__/helpers.ts#L9) · [käsu ID tüüp](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/engine/src/types.ts#L15) · [registreerimine](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/engine/src/registry.ts#L56)
- **Soovitatud muudatus:** M · Piira testide käsulaiendused testi tüübiprojektiga ja kontrolli lõppkoostes registreeritud ID-de vastavust tootmiskäskudele. Muidu võib uue käsu puhul esimene tagasiside tulla alles kasutaja klõpsust.

### 11. [P2] bb_task võib anda ehitajale teise haru koodirea

- **Jaotis:** F · MCP ja kaardid
- **Stsenaarium:** M2-3-1 neljast „Loe“ koodilõigust kolm erinesid dokumentide lähteversiooni aec7dcc ja auditeeritud tipu vahel. Näiteks nets/derive alguses asendus täiskomponendisisend kitsama topoloogiaga. Server avab olemasoleva faili oma juurkaustast ja jätab lõigule Git-revisjoni lisamata. [Faili valimine](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/tools/mcp-bb/bb_mcp.py#L230) · [kaardi koodiviited](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/docs/tasks/M2-3-1.md#L13)
- **Soovitatud muudatus:** S · Lase bb_task’il võtta koodirevisjon või tööharu ning näita lõigu juures lahendatud SHA-d. Dokumendid võivad edasi tulla main-ist. Praegu võib ülevaataja anda tagasisidet juba parandatud koodile.

### 12. [P2] Kohalik Playwright võib testida naabertööpuu rakendust

- **Jaotis:** F · kohaliku E2E tõendi päritolu
- **Stsenaarium:** Kooditee. Kui teise BB koopia Vite teenindab juba porti 5173, lubab reuseExistingServer kohalikul Playwright 1.65.0-l kasutada seda rakendust. Testifailid jäävad käivitaja koopiast. Serveri SHA-d ei võrrelda. Kaardijooks ja GitHub CI lülitavad taaskasutuse CI-lipuga välja. [Playwrighti valik](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/playwright.config.ts#L12) · [kaart](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/tooling/review-card/runner.mjs#L84) · [CI](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/.github/workflows/ci.yml#L54)
- **Soovitatud muudatus:** S · Käivita vaikimisi oma server eraldi pordil või seo taaskasutus kontrollitava versiooniga. Hõivatud pordi korral anna üheselt mõistetav teade. Muidu võib kohaliku rohelise tulemuse saada koodimuudatust üldse käivitamata.

### 13. [P2] CI ja kaardiülevaatus maksavad sama Vitesti käigu eest kaks korda

- **Jaotis:** C, F · testide käitamine
- **Stsenaarium:** CI käivitab järjest check ja coverage. Rohelises 1761 testiga komplektis tähendab see 3522 Vitesti testikäivitust. Kaardiskript kordab ka check’i sees olevat api:check’i. Need on käivituste arvud, CI minutivõitu ei mõõdetud. [Skriptid](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/package.json#L13) · [CI](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/.github/workflows/ci.yml#L49) · [kaardikontroll](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/tooling/review-card/runner.mjs#L59)
- **Soovitatud muudatus:** S · Jäta arendaja senine check-käsk alles. CI ja kaart tarbigu ühe katvusega jooksu testiotsust, nimelist JSON-i ja katvust ning ühte API-kontrolli. Võrdle enne lülitamist ka veajuhtumi väljundeid. Muidu kasvab kordustöö iga uue testiga.

### 14. [P2] Ainult Markdownit muutnud main-i tõuge ehitab ka Windowsi installeri

- **Jaotis:** F · dokumentatsioon ja väljalase
- **Stsenaarium:** Versioonide v0.1.0 ja v0.7.0 vahel muutis 197/223 esimese vanema commit’ist ainult docs/ faile. Iga main-i push käivitab reegli järgi täielikud kontrollid ja MSI ehituse. Tegelikku push’ide ega Actionsi minutite arvu sellest statistikast tuletada ei saa. [Käivitajad](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/.github/workflows/ci.yml#L4) · [installeri tingimus](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/.github/workflows/ci.yml#L84)
- **Soovitatud muudatus:** M · Lisa sama kohustusliku töö sisse muudatuste liigitus. Puhas dokumendimuudatus saab lingi- ja vajadusel API-kontrolli. Koodi, lukufaili, CI ja paketimuudatuste ning väljalaskesildi puhul säilita kogu värav. Muidu käivitub installer ka igal pelgalt kaardi või arhitekti märkuse uuendamisel main-is.

### 15. [P2] Kohalik salvestustee jääb CI-s veebirakenduse ja Rusti testide vahele

- **Jaotis:** E · töölaua väljalaske tõend
- **Stsenaarium:** Playwright avab veebiversiooni, Tauri adapteri test asendab invoke’i ning Rusti ühilduvustest kutsub hoidlat otse. MSI töö ehitab ja avaldab sama artefakti. Nende sammude hulgas puudub WebView2-st IPC kaudu salvestatud faili taasavamine. [Playwright](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/playwright.config.ts#L4) · [adapteri test](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/adapters/src/storage-tauri.test.ts#L26) · [MSI avaldamine](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/.github/workflows/ci.yml#L124)
- **Soovitatud muudatus:** M · Enne M4 impordi ja v1.0 vastuvõttu käivita väljalaskekandidaadil üks sünteetiline loo → salvesta → sule → ava voog ja võrdle olulisi välju. Säilita M4.3 päris paigalduse ja offline-kontroll. Muidu võib WebView2 ja IPC sidumise tõrge ilmneda alles kasutajal.

### 16. [P2] Kaheksast SQLite-näidisest jõuab automaatses domeenitestis kontrolli kolm

- **Jaotis:** C, E · failivormingu ühilduvus
- **Stsenaarium:** Lugesin kaheksa repo .pcbk-näidise document-tabelit kirjutuskaitstult. Kõik 8/8 läbisid tipu migratsiooni ning invariantide kontrolli. Püsiv TS-test kasutab kolme .document.json koopiat, mis kattusid vastavate failide sisuga. Rust avab kõik kaheksa ning kontrollib teistsuguseid tunnuseid. [Domeenitest](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/domain/src/release-files.test.ts#L7) · [SQLite-faili test](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/apps/desktop/src-tauri/tests/release_files.rs#L8)
- **Soovitatud muudatus:** S · Toida TS migratsiooni- ja invariantide test päris väljalaskefailide tabelist. Säilita Rusti avamise ja failibaitide katse. Võimalikest JSON-koopiatest loobu tarbijate üleviimisel. M4 imporditöö ajal jääks viie vana versiooni puhul domeenireegli regressioon muidu nähtamatuks.

### 17. [P3] Skeemil lubab jalus joonistada rada, klõps teeb valiku

- **Jaotis:** A, E · kahe vaate tööriistad
- **Stsenaarium:** Workbench-katse. Plaat → T → Skeem jättis olekusse connections.trace ja jalusesse „Rada · pealmine“. Skeemi Canvas valis puuduva tööriista asemel select’i. [Vaatevahetus](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/ui/src/shell/view-store.ts#L64) · [tegelik tööriist](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/ui/src/canvas/Canvas.tsx#L172) · [jaluse tekst](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/connections/ui/TraceHint.tsx#L22)
- **Soovitatud muudatus:** S · Anna jalusele ja hiirekäitumisele sama aktiivse vaate tööriist. Lisa olemasolevale vahetustestile Plaat → T → Skeem. Muidu saab sama eksitava oleku ka järgmine tööriist, mis on ainult ühes vaates.

### 18. [P3] Foto ja lõuend defineerivad samad kaheksa pöörde- ja peegeldusmaatriksit

- **Jaotis:** B, D · geomeetria
- **Stsenaarium:** Kahes tootmisfailis on 109 järjestikust ühesugust tokenit. Lõuendis kordub ka teisendatud ristküliku nullpunkti arvutus joonistamisel ja pöördteisendusel. [Foto](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/photo/transform.ts#L7) · [lõuend](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/ui/src/canvas/stage.ts#L7) · [pöördteisendus](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/ui/src/canvas/stage.ts#L54)
- **Soovitatud muudatus:** S · Jaga maatriksitabelit ja puhtalt arvulist nihke arvutust, jäta SVG-string kuva juurde. Säilita kõigi kaheksa teisenduse edasi-tagasi test. Eraldi muutmisel võivad pööratud foto, osuti ja tulevane eksport lahkneda.

### 19. [P3] Moodulijoonise nooled ei kirjelda kõiki praegusi dependsOn-sõltuvusi

- **Jaotis:** A, F · moodulikaart
- **Stsenaarium:** 05 seletab noolt dependsOn-ina. Kuue olemasoleva mooduli deklaratsioonides on neli serva. Jooniselt puuduvad näiteks measurements→components ja nets→components. See mõjutab kaardi põhjal tehtavaid otsuseid. [Joonis](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/docs/05-moodulid.md#L19) · [measurements](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/measurements/engine/index.ts#L7) · [nets](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/nets/engine/index.ts#L121)
- **Soovitatud muudatus:** S · Erista kavandatud sõltuvused tänastest ning kasuta tegelike nelja serva näitamiseks registriandmeid. Muidu võib järgmine kaart eeldada sõltuvust, mida kooste ei nõua.

### 20. [P3] Genereeritud API kirjeldus võib juhatada teise samanimelise tüübini

- **Jaotis:** C, F · avaliku liidese dokument
- **Stsenaarium:** bindHistoryKeys viitab HistoryActions-ile ilma kujuta. Digestis leitav samanimeline kuju sisaldab canUndo/onUndo, tegelik klahvikäsitleja ootab undo/redo. TypeScript eristab tüübid algkoodis. [Käsu digest](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/docs/api/ui-shell-state.md#L9) · [teine HistoryActions](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/docs/api/ui-shell-chrome.md#L23) · [tegelik kuju](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/ui/src/shell/keymap.ts#L3)
- **Soovitatud muudatus:** S · Lisa avalikus signatuuris kasutatud kohalikule tüübile täpne lähteviide või lühike väljade loend. Säilita genereeritud API kontroll. Muidu kulub käsitsi aega vale näite diagnoosimisele.

### 21. [P3] Testiseadistus kordub seal, kus kontrollitav käitumine erineb

- **Jaotis:** B, C · testide kordus
- **Stsenaarium:** Kahes veebisalvestuse testifailis kordub 38 rida ehk 245 tokenit seadistust. Üheksa testifaili või -abi muudavad HTMLDialogElement.prototype’i. Kloonidetektori tulemus loeb ka seadistust. [Salvestus](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/adapters/src/storage-web.test.ts#L11) · [hiljutised projektid](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/adapters/src/storage-web-recents.test.ts#L11) · [dialoogi seadistus](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/ui/src/kit/kit.test.tsx#L8)
- **Soovitatud muudatus:** S · Jaga seadistust sama testipere piires ja taasta dialoogi prototüüp ühises abis. Jäta eri käitumiste väited eraldi. Muidu tuleb brauseri või andmehoidla muutust parandada mitmes testifailis.

### 22. [P3] Kaardi git diff --check jätab indeksis ja commit’is oleva vea vahele

- **Jaotis:** F · kaardi kontrolli usaldatavus
- **Stsenaarium:** Ajutises Git-repos lisasin indeksi reale kaks lõputühikut. Tavaline git diff --check tagastas 0 ja git diff --cached --check 2. Kaardiskript käivitab esimese kuju. [Kontrolli käsk](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/tooling/review-card/runner.mjs#L90)
- **Soovitatud muudatus:** S · Kontrolli ka indeksit ja kaardi tegelikku baasist tipuni ulatuvat vahemikku. Muidu võib kaardi koondtulemus olla roheline juba stage’itud või commit’itud vormistusveaga.

## Muu

## Ulatus ja mõõtmised

| Küsimus | Tulemuse ulatus |
|---|---|
| Millist koodi kontrolliti? | Eraldiseisev, puhas Git-koopia, HEAD `cbd4d42e158e9731aca0c86236ca36dcc3ebd11f`. Haru sisaldab M2-3-1 ja M2-3-2. Auditi piiriks oli M2-3-2. MCP päise Git HEAD kirjeldab postkasti hoidvat põhikausta. |
| Kui suur on repo? | Gitiga jälgitavad TS/TSX, JS/MJS, Rust, CSS ja HTML: apps + packages 32 740 tootmisrida / 366 faili ja 43 566 testirida / 273 faili. Rusti tootmisfailis olevad inline-testid on siin tootmisridades. docs/ 196 Markdownit / 25 252 rida, sh 94 kaardifaili / 11 169 ja 52 genereeritud API-faili / 3947. tools + tooling 5233 koodirida, neist review-card 1792, proof 842, MCP Python 647. Loendus: `git ls-files -z`, Python 3.13.17 `bytes.splitlines()`. |
| Mida näitas sõltuvusgraaf? | dependency-cruiser 18.7.2, `depcruise --config .dependency-cruiser.cjs --output-type json packages apps`: 621 moodulit / 2486 serva / 0 viga. Teine jooks lahendas tööruumi paketid otse nende exports-kaartidega: 614 moodulit / 2486 serva / 0 lahendamata / 0 rikkumist. Tarjani analüüs 331 tootmismoodulil: 0 käitusaegset tsüklirühma, tüübiimporte kaasates 3. Kolm feature’ite otseimporditud käitussõltuvust läbisid components/contract.ts-i. |
| Kui palju on kordusi? | `node clones.cjs`, Node 26.13.0 + TS Compiler API 5.9.3. Eri failides ≥60 ühesugust järjestikust tokenit ja ≥6 rida, kommentaarid ning tühikud väljas. TS/TSX tootekood 310 faili, 4 plokipaari, 608/193 284 tokenit (0,31%). Testid ja abid 252 faili, 94 paari, 7826/362 650 (2,16%). Identifikaatorid jäid algkujule. Rusti eraldi `node rust-clones.cjs`: ≥8 samasugust rida ja vähemalt 150 märki esimeses kaheksas reas, tootekoodis 0 ja testides 7 paari. Semantiliselt sama käitumist võivad need meetodid vahele jätta. |
| Kas teste või eksporditud koodi saab kustutada? | TS-süntaksipuu järgi 1278 otsese nimega testiplokis üks täpselt sama keha, mis kontrollis kahte eri teostust. `node exports.cjs` (TS 5.9.3): 609 sisendfailis 842 otse eksporditud nimelist tootmisdeklaratsiooni, sh arendustööriistad. 21 esialgset kandidaati vajas käsitsi kontrolli. Näiteks CalibrationLayer ja sameLayerCrossing on oma failis kasutusel, eemaldada saab ekspordimärke. Vite pluginal on tegelik tarbija. Automaatne masskustutus pole põhjendatud. [Sama faili tarbija](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/photo/ui/CalibrationLayer.tsx#L64) · [Vite konfiguratsioon](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/apps/desktop/vite.config.ts#L7) |

## Hoia alles

- **Üks dokumendimudel, käsud ja Undo.** Immer annab ühest toimingust edasised ja pöördpaigad ning mootor kontrollib kirjutusõigusi. Komponendi nihutamise järel taastas Undo algasukoha. KiCad koondab mitme EDA objekti muudatused samuti üheks tagasivõetavaks toiminguks. See on hea alus ka tulevasele automaatpaigutusele. [Käsu täitmine](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/engine/src/engine.ts#L150) · [KiCadi tööriistaraamistik](https://dev-docs.kicad.org/en/components/tool-framework/index.html#commit-objects)
- **Kuus moodulit ja ühine kooste.** Domeen hoiab reegleid, engine käske ja ajalugu, contracts lepinguid, client seob UI mootoriga ning apps valib salvestusadapteri. Üheteistkümnest UI panuseloendist kümnel on juba tootja, üheteistkümnendat loeb skeemilõuend ja kolmas kaart näeb ette selle täitmise. Joondusel, kalibreerimisel ja rajal on erinevad olekud ning ühine seansi lähtestamise leping. 26 mudelitüüpi kümnes failis tuletatakse Zodist. Praegune maht ei põhjenda uut paketti, üht üldpoodi ega käsitsi paralleeltüüpe. [Register](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/ui/src/shell/UiRegistry.ts#L66) · [Kooste](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/composition.ts#L4) · [mudeli tüüp](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/domain/src/model/board.ts#L19)
- **Üks SVG-lõuend ja jagatud geomeetria.** Mõlemad vaated kasutavad sama Canvas’t. Korpuse joonistamine, tabamine ja hõljumine lähtuvad samast kehakujust. Hõljumise 3 ekraanipiksli varu on vaate ülesanne. Ka tldraw kasutab kuju geomeetriat tabamiseks ja piirideks. Suurim tootmise TS/TSX fail on 400 rida, järgmised 399 ja 397. Failipikkus üksi ei õigusta jagamist. [Vaadete kooste](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/ui/src/app/Workbench.tsx#L130) · [Tabamine](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/packages/features/components/ui/layers/hits.ts#L16) · [tldraw geomeetrialeping](https://tldraw.dev/sdk-features/shapes)
- **Lokaalne SQLite ja adapteripiir.** Dokument ja päevik lähevad revisjonikontrolliga samasse tehingusse, fotod on samas failis eraldi. SQLite sobib selleks töölauafaili vorminguks. Veebi kiireid katseid, päris SQLite ühilduvust ning faililuku ja säilitamise Rusti teste tasub jätkata koos. [Salvestustehing](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/apps/desktop/src-tauri/src/storage/db.rs#L231) · [SQLite rakenduse failivorminguna](https://www.sqlite.org/appfileformat.html)
- **Kaart seob nõude tõendiga.** review-card eristab nõutud testi läbimist, vahelejätmist ja oodatud ebaõnnestumist. proof räsib Chromiumile antavad failid. STATUS sobib järgmise sammu leidmiseks, detailne tõend jäägu kaardile või artefakti. Kaheksa versioonisilti 9.–26. novembril näitavad tempot. Sildi ja Cargo versiooni kontroll ning sama MSI avaldamine annavad väljalaskele jälgitavuse. [Tulemus](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/tooling/review-card/outcomes.mjs#L105) · [Räsi](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/tooling/proof/offline-app.mjs#L26) · [Väljalase](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/.github/workflows/ci.yml#L91)

## Tee v1.0-ni

| Etapp | Vastuvõtuotsus |
|---|---|
| M2.3–M2.4 | Enne M2-3-4 paranda vale jala valik (01) ning kontrolli skeemikaamera omandit (02). Enne esimese skeemijuhtme salvestamist kinnita kahe vaate harutamise reegel (03). Korda suure sünteetilise skeemi pan/zoom/lohista mõõtmist WebView2-s. Plaani vastuvõtu piirid juba kirjeldavad kasutajaootust. [M2.3 vastuvõtt](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/docs/plans/M2-3-skeemi-sumbolid-ja-paigutus.md#L139) |
| M3 | Mõõda tehniku tegelik 50 jala aeg ja 20 järjestikuse sisestuse voog, sh musta sondi ja mustandi püsimine vaatevahetusel. 50 jalga alla 120 sekundi jäi v0.6.0-s teadlikult mõõtmata. Hinda tehniku eksimusi koos ajaga. [Avatud kasutuskatse](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/docs/07-teekaart.md#L175) · [M3 nõue](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/docs/07-teekaart.md#L231) |
| M4.1–M4.3 | Automaatpaigutus: 20–50 sümbolit, muuda üksnes valitud või paigutamata objekte, üks Undo taastab algseisu. Ekspordiproov eemaldab praegu kihid lubatud loendi alusel. Päris ekspordis kontrolli 1 rada, 1 võrgusilti ja 1 redigeerimispidet: kaks esimest peavad väljundisse jõudma, pide peab kaduma. Kinnita SVG 1:1 mõõtkava, tagasilükatud impordi järel avatud dokumendi säilimine, uuema faili kirjutuskaitstud avamine ning puhtas Windowsis võrguühenduseta paigaldus. [Praegune PNG-proov](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/apps/desktop/src/perf/png-svg.ts#L2) · [M4 vastuvõtt](https://github.com/Fuuduuu/BB/blob/cbd4d42e158e9731aca0c86236ca36dcc3ebd11f/docs/07-teekaart.md#L239) |

Sihitud lisakatsed kasutasid Node 26.13.0 (`probe-run.cjs`, `projection.cjs`, `fixtures.cjs`, `mod-rules.cjs`, `mod-typed.cjs`), Git 2.56.0.windows.4 ning `rg` 15.2.0. S/M/L tähistab hinnangulist muudatuse mahtu.

## Arhitekti triaaž (2026-11-27)

**Üldotsus:** arhitektuuri ei ehitata ümber. Jaotis „Hoia alles“ kehtib lihtsustamise piirina. Kasutaja küsimusele „kas me üle ei engineeri“ vastab audit kolme mõõtmisega: tootekoodis 0 imporditsüklit, 0,31% kordusi ja ükski fail pole üle 400 rea. Kulu tekib töövõttes ja CI-s (leiud 11–14), mitte rakenduse ülesehituses.

Kontrollisin koodis tipul `cbd4d42` leiud 01, 02 ja 13. Kõik kolm on õiged:
- **01.** Lõuendi `hit` tuleb `hitIndex.query`-st (`Canvas.tsx:289`). See võrdleb sama prioriteediga kandidaate ainult keskpunkti kauguse järgi. Raja algus võtab `queryAll`-i esimese vaste (`TraceTool.ts:270-272`), mis on järjestatud samamoodi. Täpset tabamust eelistab ainult `pickHit`, mida kasutavad Joonda ja Piiks. M2.2b triaaž parandas sama vea neis kahes tööriistas (M2.2b leid 03), kuid reegel jäi tööriistapõhiseks. Seetõttu said must sond ja Rada vana valiku. Sama `query`-t kasutab ka `OwnPinTool`.
- **02.** `copyView` (`save-coordinator.ts:20-29`) kopeerib `boardView`-d, aga mitte `schematicView`-d. M2-3-2 ülevaatusel jäi see mul märkamata.
- **13.** CI käivitab järjest `pnpm check` ja `pnpm coverage` (`ci.yml:49-50`) ning mõlemas jookseb kogu Vitest.

Ülejäänud leiud võtan vastu Astra katsete põhjal.

**Leid 01 parandatakse indeksis, mitte tööriistades.** Sama prioriteedi korral eelistavad `query` ja `queryAll`-i järjestus täpset tabamust varule. Siis kehtib üks reegel kõigile tööriistadele, ka tulevastele skeemitööriistadele, ja `pickHit` jääb ainult liigi filtriks. Raja kihireegel ning raja ja liitepunkti prioriteedid jäävad samaks.

**Ettepanek kasutajale (muudab plaani):** enne paigutust tuleb plaani uus ülesanne 4. Praegused ülesanded 4–6 saavad numbrid 5–7.

| Kaart | Leiud | Rada | Sisu |
|---|---|---|---|
| M2-3-4 · Täpne jalavalik ja kahe vaate parandused | 01, 02, 17 | B | Indeks eelistab täpset tabamust; regressioonikatse katab musta sondi, raja mõlemad otsad ja Piiksu. Skeemikaamera kopeeritakse teenuse piiril nagu plaadi kaamera. Vaatevahetusel kuvab jalus sama tööriista, mida lõuend tegelikult kasutab. Kaasa tulevad ka M2-3-3 märkused tähise vahe ja kasti laiuse kohta. |

Edasilükatud leiud:

| Leid | Otsus |
|---|---|
| 03 | M2.4 plaani esimene otsus enne skeemijuhtme salvestamist: kuidas plaadil loodud haru säilitab teise vaate tee. Vastuvõtukatse kahe joonistuse ja ühe `Ctrl+Z`-ga. |
| 06 | M2.3 vastuvõtu ja jõudluse ülesanne (uue numbriga 7) koos M2.2b leiuga 08. Seal korratakse ka suure skeemi pan, suum ja lohistus WebView2-s. |
| 05 | M3 plaani esimene jõudlustöö. Enne mõõdetakse Tauris, siis piiratakse indeksi ehitus geomeetria muutustega. |
| 07 | M3 mõõtmise voog: üks ajavõrdleja nelja tarbija jaoks. |
| 09 | M2.4 juhtmesiltide kaart: üks võrguinfo otsing võrgu lepingus. |
| 04, 10 | M2.4 ettevalmistav ülesanne: kihireegli vahefail ja testikäskude tüübid tootmiskoostes. |
| 08, 16 | Järgmine salvestuse kaart koos M2.2b salvestuse leidudega 04–06 ja 13 (hiljemalt M4.3). |
| 15 | M4.3 ja v1.0 vastuvõtt: väljalaskekandidaadil sünteetiline voog loo, salvesta, sulge ja ava Tauris. |
| 11, 12, 13, 14, 22 | Astra tööriistade järjekord pärast leidu 25. Suurima kokkuhoiu annavad 13 (üks Vitesti jooks) ja 14 (ainult dokumente muutev push ei ehita installerit). |
| 19 | Arhitekt joonistab 05 moodulikaardi registri tegelike `dependsOn`-servade järgi ümber. |
| 20 | Astra tööriistade järjekord (`api-digest`). |
| 18, 21 | Tehakse siis, kui neid faile niikuinii muudetakse: foto ja lõuendi teisendus M4 ekspordis, testiseadistus järgmise salvestuse kaardiga. |
