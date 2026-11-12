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
4. **Fotokiht ja stseen:** kiht z 0, `sceneTransform` aktiivsest fotost, alumine riba (nähtavus, kontrast, hall, pööra, peegelda), `ViewState.modules`; `PlaceTool` püstine paigutus ja näidu sildi suund pööratud/peegeldatud stseenis. Testid: `pins_stay_on_photo_under_all_8_transforms`, `new_component_upright_on_screen_under_all_8_transforms`, `photo_view_settings_survive_reopen_without_rev`. Ülevaatuse leiud 2026-11-12 (koodis kontrollitud):
   - `sceneMatrix` on ilma nihketa, seega pööratud foto jääb negatiivsetesse koordinaatidesse. Vaade peab arvestama pööratud piirkasti (`photo_stays_in_view_after_rotation`).
   - Komponendi sildi tabamusala (`hits.ts` `component-label`) on maailma telgede järgi, aga `SceneText` hoiab teksti ekraanil püsti. Pööratud stseenis tuleb ala pöörata ekraani järgi, mistõttu `LayerSpec.hits` vajab `sceneTransform`-i (`label_hit_area_matches_screen_text_under_all_8_transforms`).
   - `ReadingLabels` otsustab sildi poole ekraanisuunalise vektori `at − center` järgi, mitte maailma `x` järgi.
5. **Kalibreerimine:** tööriist `K`, kaks punkti + mm, üks käsk, riba näit. Testid: `calibration_sets_px_per_mm_in_one_undoable_step`, `calibration_keeps_component_centers`.
6. **Uus plaat fotost ja „Lisa foto“:** avalehe lohistamine/kleepimine, töölaua nupp ja lohistamine. Test: `first_component_within_three_actions_after_photo` (e2e).

**Osa C · Proovid ja vastuvõtt**

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

- **Pärast Ül. 7 mõõtmist:** `validateDocument` jagamine (`parseDocument` + muudetud väljade invariandid, A3), kui proov näitab vajadust.
- **M1.3 ja hiljem:** foto vahetus, teine foto ja joondus (`toBoard`), korpuse joondus fotol, foto ekspordi funktsioon (M4).
