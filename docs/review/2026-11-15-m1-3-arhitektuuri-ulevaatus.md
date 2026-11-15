# BB arhitektuuri ülevaatus Claude’ile

15.11.2026 · `codex/m1-3` · `adc8fb4` · kuni M1-3-8 vastuvõtuni.

**Hinnang.** Praegune jaotus sobib BB kasvatamiseks. Mõõtmiste moodul näitab seda juba praktikas. Ta kasutab komponendi andmeid deklareeritud sõltuvuse kaudu, omab ise mõõtmisi ning lisab tööpinnale oma kasutajaliidese. Kõige kiiremat parandust vajab fotoimpordi seos avatud projektiga.

## Moodulid, funktsioonid ja klassid

| Kontrollitud koht | Hinnang |
|---|---|
| `domain`, `contracts`, `engine` | Geomeetria, andmekujust tulenevad reeglid ja dokumenti muutvad käsud on eraldatud. Näiteks `padToBoard` on puhas funktsioon. Mootori register kontrollib dokumendiväljade omanikke ja moodulite sõltuvusi ning mootor kontrollib käsu lubatud kirjutusvälju enne muutuse avaldamist. |
| `features`, `client`, `ui` | Neli tootemoodulit on `project`, `photo`, `components` ja `measurements`. Nende mootori- ja UI-kirjed klapivad. Mõõtmiste sõltuvus moodulist `components` on kirjas. Tootemoodulite tegelikke importe võrreldakse sõltuvusdeklaratsioonidega testis. |
| `adapters`, `apps/web`, `apps/desktop` | Mõlemad rakendused kasutavad sama mootorit ja projektiteenust. Käivitamisel antakse neile vastava platvormi projekti- ja fotosalvestus. See võimaldas projekti vahetust kontrollida mälus töötavas katses. |
| Klasside kasutus | `UiRegistry` haldab üht registrit ja kontrollib lisatavaid kirjeid. `createEngine` ja `createSaveCoordinator` hoiavad privaatset muutuvat olekut tehasefunktsioonis. Kõigil kolmel on selge vastutus. Uus klass annab siin väärtust siis, kui tal on oma olek või reegel, mida ta peab kaitsma. |

## Leiud ja vastuvõtukatsed

### 1. Fotoimport võib kirjutada vale projekti hoidlasse

**Katsega kinnitatud.** A-s alustati faili lugemist. B avamine pandi projektiteenuse järjekorda ajal, mil A oli veel aktiivne. Lugemise lõppedes läbis import A seansikontrolli, kuid teenus valis salvestuskoha alles järjekorrast tegevust alustades. Fotopordile anti B seanss. Kasutajaliides sai hiljem `stale_session` ja B dokumenti jäi null fotoviidet. Katses registreeris fotopordi testiasendus kirjutuse sihtkoha. Pärisadapterid salvestavad sellele sihile vastavalt IndexedDB kirje või SQLite’i BLOB-i.

Koodikoht: `packages/features/photo/ui/add-photo.ts:48`, `packages/engine/src/project-service.ts:267`. **Parandusettepanek.** Seo import algse projekti loogilise seansiga. Kontrolli järjekorras vahetult enne baidikirjutust, et siht on endiselt sama. Regressioonitest peab kontrollima ka seda, et B fotopordile tehakse null kirjutust. Ainult UI veakoodi kontrolliv test läheb praegugi läbi.

### 2. Automaatselt valitud projektifaili nimi võib vahepeal hõivatuks muutuda

**Koodist tuvastatud risk.** Töölauaadapter küsib vaba nime ja saadab selle eraldi käsuga loomiseks. Kui teine protsess loob vahepeal samanimelise kirjutatava suletud faili, võib loomise lõpus tehtav asendav ümbernimetamine selle üle kirjutada. Olemasolev Rusti test katab kasutaja kinnitatud asenduse. Automaatse nime konflikt vajab eraldi katset.

Koodikoht: `packages/adapters/src/storage-tauri.ts:120`, `apps/desktop/src-tauri/src/desktop_paths.rs:22`, `apps/desktop/src-tauri/src/storage/mod.rs:88` ja `:227`. **Parandusettepanek.** Erista automaatse nimega loomine kasutaja kinnitatud asendusest. Taastamisel on juba olemas ülekirjutust välistav `install_new`. Vastuvõtukatses peab nime valimise järel ilmunud sünteetiline fail säilima bait-baidi täpsusega.

### 3. Ainult vasaku paneeli sulgemine võib salvestamata jääda

**Katsega kinnitatud.** Salvestati avatud paneeliga vaade, muudeti ainult `navigatorOpen=false`, kutsuti välja `flush()` ning projekt suleti ja avati uuesti. Salvestuskutse õnnestus, kuid laetud väärtus oli `true`. Töölaud saadab muudatuse teenusele. Salvestusjuhi käsitsi kirjutatud võrdlus jätab selle välja vahele.

Koodikoht: `packages/ui/src/app/use-workbench.ts:171`, `packages/engine/src/save-coordinator.ts:193`. **Parandusettepanek.** Koonda salvestatava vaate võrdlus ühte kohta. Kontrolli silmusena üksikute vaateväljade muutmist ja taasavamist, et ka järgmine lisatud väli oleks kaetud.

### 4. Kasutajaliidese moodul saab registreeruda ilma mootoripaariliseta

**Koodist kontrollitud.** Arhitektuuri §4 näeb ette samanimelise mootorimooduli kontrolli. Mootori ja UI tootemoodulite nimekirjad koostab rakendus eraldi. Kumbki register kontrollib oma kirjeid, kuid koostekohas nimekirju omavahel ei võrrelda. Tänased neli paari klapivad. Uue mooduli nimeviga võib seetõttu jääda käivitamisel märkamata.

Koodikoht: `packages/features/engine.ts:7`, `packages/features/ui.ts:7`, `packages/ui/src/app/Workbench.tsx:62`. **Parandusettepanek.** Kontrolli tootemoodulite nimekirju mõlema rakenduse ühises koostekohas. Arvesta dokumenteeritud UI-erandeid `guide` ja `export`. Kesta enda `home-feedback` lisatakse alles pärast tootemooduleid. Vastuvõtukatses peab ühe tootemooduli UI ID muutmine andma vea enne töölaua avamist.

### 5. Register lubab moodulile kesta kasutatava kiirklahvi

**Registrikatse ja koodikontroll.** Katsemooduli `V` ja `H` lükati tagasi. `Escape`, `N` ja `O` registreeriti edukalt. Lõuend töötleb `Escape`-i alati enne mooduli käsku, nii et registreeritud käsk jääb kutsumata. `N` ja `O` on juba paneelide otseteed. See puudutab uue mooduli lisamist.

Koodikoht: `packages/ui/src/shell/UiRegistry.ts:106`, `packages/ui/src/canvas/Canvas.tsx:251`, `packages/ui/src/shell/keymap.ts:51`. **Parandusettepanek.** Kasuta kesta otseteede jaoks ühist kirjeldust nii registreerimisel kui klahvisündmuse töötlemisel. Testi, et kattuv kombinatsioon lükatakse tagasi ja vaba kombinatsioon käivitab mooduli käsu.

## Kontrollide ulatus

Lähtekoodi alus oli Git-objekt `adc8fb47518127d892d4e1615f31d26c191046ca`. Testide tööpuus võrreldi sellega 527 jälgitavat koodi- ja seadistusfaili. Erinevusi ei leitud. Tüübikontroll, ESLint, failipikkuse ja avaliku API kontroll läbisid. Sõltuvusanalüüs kontrollis 421 lähtekoodimoodulit ja 1526 sõltuvust ning leidis null reeglirikkumist.

| Kontroll | Tulemus |
|---|---|
| Vitest, paketid ja rakendused | 1221/1221 paketitesti ja 73/73 rakenduse testi läbisid. |
| Vitest, arendustööriistad | 46/49 läbisid, sh kõik 29 sõltuvusreeglite testi. Kaks tüübi- ja üks API-tööriista test peatusid katsekeskkonna loomisel. Windows keelas kataloogilingi loomise (`EPERM`). Kokku läbis 1340/1343 Vitesti testi. |
| Rust, vaikimisi konfiguratsioon | Esimesel käigul tagastas üks taastamistest varukoopia loomisel `Unknown`. Eraldi ajutise kaustaga korduskäigul läbisid kõik 86/86 testi, sh sama taastamistest. Esimese tõrke täpne põhjus jäi tuvastamata. |

Foto ja paneeli lisakatsed kasutasid sünteetilisi projekte, päris projektiteenust ja mälus töötavat projektihoidlat. Failinime konflikti hinnang põhineb koodil. Visuaalne vastuvõtt ja M1-3-9 ning M1-3-10 teostus jäävad selle ülevaatuse ulatusest välja.

**Claude’ile.** Esimesena tasub otsustada, kuidas fotopäringu algne seanss liigub teenuseni. Teisena vaata üle automaatse failinime ülekirjutuskäitumine. Mõlemad puudutavad projektiandmete säilimist. Ülejäänud leiud on lahendatavad väikeste eraldiseisvate muudatustena.
