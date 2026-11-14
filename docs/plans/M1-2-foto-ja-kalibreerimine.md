# M1.2 · Foto ja kalibreerimine: teostusplaan

**Olek:** kinnitatud 2026-11-11 (kasutaja: O1 jah, O2 jah; O3 otsustatakse Ül. 9-s). Kaardid kirjutatakse vahetult enne iga ülesannet ([snaipriülesanded](../tasks/README.md)); hetkeseis on [STATUS-es](../STATUS.md).

**Eesmärk** ([07 › M1.2](../07-teekaart.md#m12--foto-ja-kalibreerimine)): kasutaja lohistab plaadi foto avalehele, saab kohe töölaua fotoga, pöörab või peegeldab selle õigeks, kalibreerib mõõtkava ja paigutab esimese komponendi kõige rohkem 3 tegevusega. Foto ja kaardistus liiguvad koos, failid jäävad terviklikuks.

**Alus:** `main` `1e5108b` (M1.1 + M1 hooldus, `v0.1.1`). Arhitektuur on juba kirjas: [03 §7.1](../03-arhitektuur.md#71-koordinaadid) (stseeni teisendus), [03 §9](../03-arhitektuur.md#9-salvestus-ja-projekti-fail) (tabel `photos`, terviklik import, `pcbk://photo`, ≤ 12 MP kuvamisvariant), [05](../05-moodulid.md) (moodul `photo` omab välju `photos`, `activePhotoId`, `scale`), [02 §1 ja §4](../02-kasutaja-teekond.md#4-foto-ettevalmistus).

**Failivorming ei muutu:** `photos` ja `scale` on `BoardDoc`-is olemas, `file_id` on `meta` tabeli rida ja foto nähtavus elab vaates. Skeemi valvur (M1-H-1) peab jääma roheliseks; kui ülesanne seda muudab, peatub ehitaja ja küsib.

## Kavandatud otsused

1. **`meta.file_id` enne fotosid** (STATUS-e „Enne fotoimporti“, Fable soovitus). Iga füüsiline fail saab oma `file_id`; `project_id` jääb loogilise projekti tunnuseks. Varukoopiate kaust ja dokumendikoopia alus seotakse `file_id`-ga. Uus `file_id` tuleb: loomisel, taastamisel ja „Salvesta mujale…“ täiskoopial. Vana fail (`file_id` puudub) saab selle esimesel kirjutataval avamisel; vanad `project_id` kaustad jäävad loetavaks. „Salvesta mujale…“ dialoog eristab **täielikku koopiat** ja **päästekoopiat ilma fotodeta** (kui algne fail pole loetav).
2. **Foto import on Rustis ja terviklik:** loe → kontrolli → EXIF-orientatsioon → kuvamisvariant (> 12 MP korral) → üks tehing tabelisse `photos` → tagasta `PhotoRef`. Alles siis kutsub kasutajaliides käsu `photo.add`. Kui käsk ebaõnnestub, jääb tabelisse viitamata foto, mis koristatakse järgmisel kirjutataval avamisel (03 §9). Toetatud: JPEG ja PNG; HEIC mitte v1-s (selge veateade).
3. **Moodul `photo`** (`features/photo`, mootor + UI): käsud `photo.add { photo: PhotoRef }`, `photo.setTransform { id, transform }`, `photo.setScale { pxPerMm, calib }`; `activePhotoId` seatakse esimese foto lisamisel. Foto vahetus ja teine foto (joondus) on hiljem.
4. **Stseen:** lõuendi `sceneTransform` = aktiivse foto `transform` (M1.1 lõuend toetab juba 8 teisendust). Tööpind = foto originaalmõõdud; fotota jääb 2000 × 1400. Fotokiht z 0 (`<image href="pcbk://photo/<id>?v=display" width/height = originaal>`). M1.1 märkused lahendatakse siin: `PlaceTool` paigutab uue komponendi ekraanil püstiselt (kompenseerib `rotationDeg` ja `side`), näidu sildi suund arvestab ekraani, mitte maailma vasakut/paremat.
5. **Foto nähtavus, kontrast ja hall** on vaate olek, mitte dokument: `ViewState.modules: Record<string, unknown>` (moodul loeb oma pesa tolerantselt, vigane pesa → vaikeväärtus). Ainult vaate muutus ei muuda `rev`-i.
6. **Kalibreerimine:** tööriist „Kalibreeri“ (`K`): kaks klõpsu fotol → mm-väli → `photo.setScale` (üks käsk, tagasivõetav). Komponentide keskpunktid jäävad pikslitesse, korpuste mõõdud järgivad uut `pxPerMm`-i (jalad sobituvad fotoga). Mõõtkava ja „kalibreerimata“ märge on alumisel ribal.
7. **Uus plaat fotost:** foto lohistamine või `Ctrl+V` avalehel loob projekti (nimi failinimest), impordib foto ja avab töölaua ilma dialoogita. Töölaual lisab foto nupp „Lisa foto“ või lohistamine lõuendile.
8. **Jõudlusproov ja PNG-eksport on proovid, mitte funktsioonid:** tulemus kirjutatakse üles ja see määrab M1.4 otsuse (SVG või Canvas jalgadele) ning ekspordi tee M4-s.

## Kasutaja otsused enne ehitust

- **O1 · Rusti pilditeegid (uued sõltuvused, vajavad võrku):** `image` (JPEG/PNG dekodeerimine, kuvamisvariandi vähendamine) ja `kamadak-exif` (orientatsioon). Alternatiivi ilma teekideta pole: WebView ei tohi pilti pöörata ega 48 MP faili ise vähendada. *Arhitekti soovitus: jah.*
- **O2 · Veebiversioon:** fotod IndexedDB-s ja väike TS EXIF-lugeja adapteris (uue npm-paketita), et e2e saaks fototeekonda kontrollida. *Soovitus: jah.*
- **O3 · Suitsukontrolli automatiseerimine** (07 › M1.2): otsus tehakse ülesandes 9 proovi põhjal; enne seda midagi ei automatiseerita.

## Globaalsed piirangud

M0/M1.1 piirangud kehtivad (strict TS, failid ≤ 400 rida, sõltuvusreeglid, tekstid mooduli `ui/i18n/et.ts`-is, numbrid kümnendkomaga). Lisaks: fotobaidid ei ole kunagi hetktõmmises ega JSON-is; frontend ei loe faile otse; `pcbk://` protokoll serveerib ainult avatud seansi fotosid. Rajad: ülesanded 1, 2 ja 9 on **rada B**, ülejäänud **rada A** ([WORKFLOW](../WORKFLOW.md#kaks-rada-tavaline-ja-kaitstud-töö)).

## Ülesanded

**Osa A · Andmed ja import (rada B)**

1. **`file_id` ja varukoopiad.** Rust `meta.file_id`, varukoopiad `file_id` kaupa, taastamine ja täiskoopia saavad uue tunnuse, vana faili täiendamine, „Salvesta mujale…“ eristab täis- ja päästekoopia. Testid: `restored_and_original_file_keep_separate_backups`, `doc_backup_restores_only_onto_its_own_file`, `old_file_gets_file_id_on_first_writable_open`, `read_only_open_writes_nothing`, `rescue_copy_is_labelled_without_photos`.
2. **Foto import ja `pcbk://photo`.** Rusti käsud `photo_import_path`/`photo_import_bytes`, EXIF, kuvamisvariant, tehing, viitamata fotode koristus avamisel, protokoll, `photos_meta` avamisel; `PhotoStore` Tauri- ja veebiadapter. Testid: `exif_orientation_maps_to_photo_transform` (kõik 8), `photo_over_12mp_gets_display_variant`, `failed_import_leaves_no_reference`, `unreferenced_photo_removed_on_open`, `copy_contains_original_photo`, `heic_is_rejected_with_reason`.

**Osa B · Moodul `photo` ja lõuend (rada A)**

3. **Moodul `photo` (mootor):** käsud, omand, `activePhotoId`, lepingutestid; tööpinna mõõdud fotost.
4. **Fotokiht ja stseen** (jagatud kaheks kaardiks: M1-2-4 fotokiht ja stseen, M1-2-4b alumine riba ja `ViewState.modules`): kiht z 0, `sceneTransform` aktiivsest fotost, alumine riba (nähtavus, kontrast, hall, pööra, peegelda), `ViewState.modules`; `PlaceTool` püstine paigutus ja näidu sildi suund pööratud/peegeldatud stseenis. Testid: `pins_stay_on_photo_under_all_8_transforms`, `new_component_upright_on_screen_under_all_8_transforms`, `photo_view_settings_survive_reopen_without_rev`. Ülevaatuse leiud 2026-11-12 (koodis kontrollitud):
   - `sceneMatrix` on ilma nihketa, seega pööratud foto jääb negatiivsetesse koordinaatidesse. Vaade peab arvestama pööratud piirkasti (`photo_stays_in_view_after_rotation`).
   - Komponendi sildi tabamusala (`hits.ts` `component-label`) on maailma telgede järgi, aga `SceneText` hoiab teksti ekraanil püsti. Pööratud stseenis tuleb ala pöörata ekraani järgi, mistõttu `LayerSpec.hits` vajab `sceneTransform`-i (`label_hit_area_matches_screen_text_under_all_8_transforms`).
   - `ReadingLabels` otsustab sildi poole ekraanisuunalise vektori `at − center` järgi, mitte maailma `x` järgi.
   - Töövoo ülevaatus 2026-11-12: alumise riba staatiline „Valmis“ (`et.shell.ready`) kaob. Riba jaguneb kaheks: vasakul fototööriistad, paremal mõõtkava kiip, suum ja kursori asukoht mm-des.
5. **Kalibreerimine:** tööriist `K`, kaks punkti + mm, üks käsk, riba näit. Testid: `calibration_sets_px_per_mm_in_one_undoable_step`, `calibration_keeps_component_centers`.
6. **Uus plaat fotost ja „Lisa foto“:** avalehe lohistamine/kleepimine, töölaua nupp ja lohistamine. Test: `first_component_within_three_actions_after_photo` (e2e). Töövoo ülevaatus 2026-11-12:
   - Avalehel on suur lohistusala.
   - „Uus plaat“ dialoog jääb fotota alustamiseks.
   - Teema valik („Välimus“) liigub ülaribalt avalehele.

**Osa C · Proovid ja vastuvõtt**

6b. **Tööpind suuremaks** (kasutaja otsus 2026-11-13: tööpind peab olema võimalikult suur; BenchBeepis võtsid menüüd liiga palju ruumi). Teha enne Ül. 7 jõudlusproovi, et lõuendit mõõdetaks õiges suuruses. Koodis on praegu: vasak paneel 300 px ja seda ei saa peita; parempoolse paneeli saab peita ainult ülariba nupust ja valik avab selle uuesti; ülariba 52 px. Sisu:
   - vasak paneel on peidetav ja seis jääb vaatesse meelde;
   - parempoolne paneel on kinni, kui midagi pole valitud;
   - ülariba ja alumine riba on madalamad;
   - mõlemal paneelil on kiirklahv.

   Ujuvad paneelid (HUD) jäävad eraldi otsuseks (vt „Mis jääb järgmistesse plaanidesse“).
7. **Sünteetilise plaadi generaator** (`tooling/fixtures`, tavaliste käskudega: 300 komponenti, 3000 jalga, mõõtmised, 12 MP foto) ja **jõudlusproov päris Tauri aknas**: pan/suum fps, lohistamine fps, avamise aeg. Tulemus ja SVG/Canvas otsus `M1-2-uleandmine.md`-sse.
8. **PNG-ekspordi proov:** kas `pcbk://` foto ja SVG kihid saab ühte PNG-sse (lõuendi „tainted“ oht) või peab Rust komponeerima; otsus kirja, funktsiooni ei ehitata.
9. **E2e, suitsukontroll ja väljalase:** M1.2 e2e, Windowsi eelkontroll (portreefoto EXIF-iga, 48 MP, „Salvesta mujale…“ koos fotoga, katkenud import), kasutaja suitsukontroll, `v0.1.1` näidisfail testandmetesse, O3 otsus.

## M1.2 vastuvõtt: tingimus → tõend

| [07 › M1.2](../07-teekaart.md#m12--foto-ja-kalibreerimine) tingimus | Tõend |
|---|---|
| esimene komponent ≤ 3 tegevusega pärast foto valimist | Ül. 6 e2e |
| EXIF-pöördega portreefoto on lõuendil ja ekspordis õigetpidi | Ül. 2 test, Ül. 8 proov, Ül. 9 suitsukontroll |
| pööramine ja peegeldamine ei muuda jalgade asendit foto suhtes | Ül. 4 `pins_stay_on_photo_under_all_8_transforms` |
| 48 MP foto kuvatakse ≤ 12 MP variandina; koopia avaneb koos originaaliga | Ül. 2 testid, Ül. 9 |
| katkenud import ei jäta viidet puuduvale fotole | Ül. 2 `failed_import_leaves_no_reference` |
| jõudlusproovi tulemus ja SVG/Canvas otsus kirjas | Ül. 7 |
| taastatud ja algne fail ei sega teineteise varukoopiaid | Ül. 1 testid |
| foto lohistamine avalehele avab uue plaadi | Ül. 6 |

## Mis jääb järgmistesse plaanidesse

- **Pärast Ül. 7 mõõtmist** ([M1-2-7](../tasks/M1-2-7.md#arhitekti-ülevaatus-2026-11-14)): `validateDocument` jagamist pole vaja, sest avamine võtab 590 ms ja käsk umbes 5 ms.
  - Pan (50 fps), suum (7,5 fps) ja lohistus (22 fps) ei pea eelarvet. Kulu on brauseri ümberjoonistus, mitte React.
  - Enne M1.4 lõppu tuleb renderduskaart:
    1. profiil;
    2. žesti ajal bitmap-teisendus;
    3. foto eraldi kiht SVG all;
    4. lohistuse eelvaade ainult lohistatavale grupile;
    5. kordusmõõtmine ja `perf.spec.ts`.
  - Jalad Canvas'ele ainult siis, kui pärast seda eelarve ikka ei pea.
- **M1.3 töövoo lihtsustus** (töövoo ülevaatus 2026-11-12, koodis kontrollitud):
  - Jala valimisel näitab kontekstipaneel Mõõda-plokki ja ainult selle jala kaarti: nimi, NC, mõõtmised ja „← Komponent“. Komponendi täisvormi ja jalgade tabelit näidatakse ainult komponendi valimisel. Praegu näidatakse jala valimisel kogu `ComponentDetails`.
  - ~~Vahekaart „Paigutamata“ ühendatakse „Plaadil“ vahekaardiga ülemiseks rühmaks.~~ Asendatud: „Komponendid“ filtritega, vt allpool „Tööpinna paigutus“, punkt 2.
  - Ülevaates tagasi lükatud, sest kood juba töötab nii:
    - lõuendil pole 12–14 nupuga tööriistariba (tööriistad käivituvad teegist ja klahvidega);
    - must sond püsib valituna, kuni kasutaja selle eemaldab, nii et eraldi lukku pole vaja;
    - väärtuse väli saab fookuse ainult `M` klahvist ja pärast salvestamist, mitte jala klõpsust.
  - Paigutuse ülevaatusest (2026-11-13, koodis kontrollitud) lisandub:
    - **Templirežiim:** `PlaceTool` jääb pärast paigutust aktiivseks samale korpusele, nii et tehnik saab paigutada mitu komponenti järjest; `Escape` lõpetab. Praegu läheb tööriist pärast ühte paigutust tagasi `select`-ile.
    - **Tab järgmisele jalale:** mõõtmisel viib `Tab` sama komponendi järgmisele jalale, väärtuse väli jääb fookusesse.
    - **Paneelide tihedus** (fondi, nuppude ja vahede suurus) vaadatakse üle pärast kasutaja enda fototööd.
  - Mõõda-ploki ülevaatusest (2026-11-14, koodis kontrollitud `MeasureBlock.tsx`) lisandub:
    - **Sondid nimega:** sildid „Koht“ ja „Vastaspunkt“ asenduvad ridadega „Punane sond · U1.3“ ja „Must sond · U1.4“. Kui musta sondi pole valitud, on real „Must sond · määramata“. Iga rea ees on väike värvimärk, aga tekst on loetav ka ilma värvita.
    - **Viimati salvestatud** näit on püsivalt pingevälja juures, näiteks „Viimati salvestatud 4,98 V“ ja selle all `U1.3 → U1.4`. Kontaktipaar on salvestatud näidu tegelik paar.
      - Rida loetakse dokumendist viimati lisatud mõõtmise tunnuse järgi.
      - Kui see mõõtmine on tagasi võetud või kustutatud, rida kaob.
      - Sisestusväli jääb pärast salvestamist tühjaks nagu praegu.
    - **Musta sondi valik real:** „Vali jalg“ liigub musta sondi reale ja selle nimi on „Vali musta sondi jalg“.
      - Kui `PickRefTool` on aktiivne, on rida esile tõstetud tekstiga „Klõpsa plaadil musta sondi jalal“.
      - Pärast valikut asendub juhis kontaktitähisega.
  - Komponentide vaate ülevaatusest (2026-11-14, koodis kontrollitud) lisandub. Punkt 1 tuleb kohe pärast tööpinna paigutuse punkti 1:
    1. **Jalg padjandi kujuga.**
       - Praegu on jala märk ring raadiusega `max(w, h) / 2` (`geometry/board.ts`) ja tabamuse ala on sama ring (`hits.ts`).
       - SOIC-i padjand on 1,55 × 0,60 mm ja samm 1,27 mm, nii et naabermärgid ja tabamuse alad kattuvad. Tehnik võib valida vale jala.
       - Joonista jalg padjandi `w × h` ristkülikuna, mis on pööratud koos korpusega.
       - Tabamuse ala on sama ristkülik, aga vähemalt 5 ekraanipikslit, ja naabrite vahel valitakse lähim kese.
       - Esimese jala nurka tuleb väike punkt. `pin1` on footprint'is olemas, aga seda ei joonistata.
       - Test: SOIC-8 naaberjalgade märgid ja tabamuse alad ei kattu sobival suumil.
    2. **Korpuse eelvaade.**
       - Avatud teegireal on väike pealtvaade jalgade ja esimese jala märgiga. Pealtvaade muutub kohe, kui jalgade arv muutub (8 → 16).
       - Paigutamisel liigub kursoriga kaasa sama kuju jalgadega, mitte ainult kere kontuur.
    3. **Tähis ja näit eraldi.**
       - Esimene reegel: näit ei lähe oma komponendi tähise kasti peale. Vajadusel nihkub näit lähimasse vabasse kohta ja lühike viitejoon näitab jalani.
       - Üldine siltide paigutus ümber takistuste otsustatakse alles siis, kui see reegel ei piisa.
  - **Tööpinna paigutus** (ülevaatus 2026-11-14, kasutaja kinnitas). Mõõdud: ülariba 40 px ja alumine riba 36 px. 1280 px aknas jääb plaadile navigaatoriga 976 px ning navigaatori ja omadustega umbes 632 px; 1100 px aknas 796 ja umbes 452 px. Punkt 1 on **M1.3 esimene kaart**, enne komponentide vaate punkti 1:
    1. **Omaduste paneel jääb kasutaja soovil peitu.** See **muudab M1-2-6b otsust**, mille järgi uus valik avab paneeli uuesti.
       - Omaduste päisesse tuleb nähtav sulgemisnupp.
       - Käsitsi peidetud paneel jääb peitu ka uue komponendi või jala valimisel.
       - Paneeli avavad ainult ülariba nupp, klahv `O` ja mõõtmise alustamine valitud jalal klahviga `M`.
       - Ülariba kahel paneelinupul on avatud oleku märgiks vaskne täide, nii et olek on näha ka ilma hiirt nupule viimata.
       - Vastuvõtt: tehnik peidab paneeli, valib teise komponendi ja seejärel jala; paneel püsib mõlemal korral peidus. Ülariba nupp, `O` ja `M` avavad selle.
       - M1.2 suitsukatsel vali järjest mitu jalga plaadi paremas servas: nii on näha, kui palju paneeli uuesti avanemine praegu segab.
    2. **Vasak menüü kolme valikuga:** „Teek“, „Komponendid“, „Mõõtmised“.
       - „Plaadil“ ja „Paigutamata“ on „Komponendid“ all filtrid; vaikimisi on avatud „Plaadil“. See asendab ülal oleva „Paigutamata“ rühma ettepaneku.
       - Aktiivse valiku vaskne allajoon jääb.
       - Loendur (näiteks „1500 mõõtmist“) on avatud vaate päises, mitte menüüs.
       - Vastuvõtt: 300 px laiuses navigaatoris mahuvad kolm valikut ühele reale ka suure mõõtmiste arvuga.
    3. **Alumine riba otstarbe järgi.**
       - Vasakul on foto näitamise ja peitmise nupp. Selle kõrval avab „Foto sätted“ menüü, kus on läbipaistvus, kontrast, halltoon, pööramine ja peegeldus.
       - Kalibreerimise olek on alati nähtav. „Kalibreerimata“ otsetee kalibreerimisse peab säilima.
       - Paremal on `−` 100% `+`, „Sobita“ ja koordinaadid.
       - Vastuvõtt: fotoga projektis mahub riba 1100 px aknas ühele 36 px reale.
  - Paigutuse ülevaatusest lükati tagasi või lükati edasi:
    - Väide „dialoog enne lõuendit“ ei pea paika: teegist valitud korpus läheb kohe kursori külge ja üks klõps paigutab selle. `AddComponentDialog` on eraldi, mittekohustuslik tee.
    - Kitsas aknas on kontekstipaneel juba ujuv ja „Sobita“ arvestab sellega.
    - Ujuvad paneelid (HUD) püsivate külgpaneelide asemel on suur tooteotsus. See otsustatakse pärast M1.2 suitsukontrolli, kui on näha, kas ruumist jääb päriselt puudu.
- **M1.3 ja hiljem:** foto vahetus, teine foto ja joondus (`toBoard`), korpuse joondus fotol, foto ekspordi funktsioon (M4).
