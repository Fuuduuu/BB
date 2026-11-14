# M1.2 · Foto ja kalibreerimine: üleandmine

2026-11-14 · M1-2-9 · rada B · `codex/m1-2`, alus `42d84bf`.
Tööpuu: `C:/Users/TRUMPIT/.codex/worktrees/bb-m1-2/BB`.
Ülesandekaartide ajakohane allikas on `C:/Users/TRUMPIT/Desktop/BB`; allpool nimetatud `docs/tasks/M1-2-*.md` teed on selle põhikausta suhtes.
Ehitaja tõendid, arhitekti otsused ja kasutaja visuaalne vastuvõtt on eraldi.
Versioon, silt, commit, push ja main-i liitmine ootavad kasutaja otsust.

**2026-11-14 EXIF-parandus:** arhitekti vastus on teostatud. Fotoprotokoll neutraliseerib ainult kuvamisvastuse Orientation-sildi, originaal ja andmebaasi blobid säilivad. Uus päris WebView2 portreekontroll läbis nii enne kui ka pärast kasutaja 90° pööret; Windowsi teiste punktide kordus on eraldi allpool.

## Tingimus → tõend

Read pärinevad [M1.2 vastuvõtutabelist](M1-2-foto-ja-kalibreerimine.md#m12-vastuvõtt-tingimus--tõend).

| Tingimus | Tõend |
|---|---|
| Esimene komponent ≤ 3 tegevusega pärast foto valimist | E2E `first_component_within_three_actions_after_photo` (`docs/tasks/M1-2-6.md`). |
| EXIF-pöördega portreefoto on lõuendil ja ekspordis õigetpidi | Parandatud natiivne lõuend läbis sõltumatu tsentroidikontrolli enne ja pärast 90° pööret (suurim hälve 0,460 px ≤ 2 px). M1-2-8 P3 ekspordikontrollid läbivad. E2E `exif_portrait_is_upright_on_canvas` kasutab sama päritoluga `blob:` URL-i ja üksi seda ristpäritolu WebView2 juhtumit ei kata. |
| Pööramine ja peegeldamine ei muuda jalgade asendit foto suhtes | `pins_stay_on_photo_under_all_8_transforms` (`docs/tasks/M1-2-4.md`); E2E `pin_stays_on_photo_mark_after_rotate_and_mirror` (≤ 3 px). |
| 48 MP foto kuvatakse ≤ 12 MP variandina; koopia avaneb koos originaaliga | `docs/tasks/M1-2-2.md` imporditestid; Windowsi punktid 2 ja 4 allpool. |
| Katkenud import ei jäta viidet puuduvale fotole | Rusti `failed_import_leaves_no_rows` (`apps/desktop/src-tauri/tests/photos.rs`, `docs/tasks/M1-2-2.md`); E2E `broken_image_leaves_no_photo_reference`; Windowsi punkt 5 allpool. |
| Jõudlusproovi tulemus ja SVG/Canvas otsus kirjas | `docs/tasks/M1-2-7.md`, tulemused ja arhitekti otsus allpool. |
| Taastatud ja algne fail ei sega teineteise varukoopiaid | `docs/tasks/M1-2-1.md` faili identiteedi ja failikausta testid. |
| Foto lohistamine avalehele avab uue plaadi | E2E `first_component_within_three_actions_after_photo`, `exif_portrait_is_upright_on_canvas`; Windowsi punkt 1 allpool. |

Lisaks läbivad E2E `calibration_shows_scale_and_undo_restores`, `add_photo_to_board_without_photo` ja `photo_and_view_settings_survive_reopen`.

## Ühilduvus ja hooldus

Rusti `every_invoke_command_is_permitted` võrdleb kõiki registreeritud käske lubadega mõlemas suunas.
Puuduv `photo_import_path` lisati; test kukkus enne parandust ning ka üleliigse loa kontrollmutatsiooniga.
`old_files_open_and_get_file_id_on_first_writable_open` avab v0.1.0 ja v0.1.1 ajutised koopiad.
Test kontrollib kirjutuskaitstud avamise muutumatust, esimese kirjutatava avamise `file_id`-d, dokumendi ja jalgade `uid`-de säilimist ning tühja `photos` tabelit.

Kasutuseta `use-wide-layout.ts` on eemaldatud. UI API on jaotatud lähtefailide järgi; kõik 61 avalikku nime ja signatuuri säilisid.
`contracts.test-d.ts` kontrollib tüüpe. UI API suurim fail on 367 rida.
Veebisalvestuse 15 testiplokki jagati kaheks failiks (269 ja 177 rida): kõik 20 käivitatud juhtumit ja nende nimed jäid samaks.

## M1-2-7 jõudlusproov

Järgnev on koopia `docs/tasks/M1-2-7.md` „Üleandmise“ tabelist, mitte uus mõõtmine.
Tauri/WebView2: 1280 × 800, DPR 1,25, 12 lõime, aken nähtav ja fookuses; 300 komponenti, 3000 jalga, 1500 mõõtmist ning 12 MP foto.

| Mõõdik | Eelarve |
|---|---|
| pan ja suum | 60 fps |
| lohistamine | ≥ 45 fps |
| projekti avamine | < 1,5 s |

| Mõõdik | Tulemus | p95 / halvim kaader | Eelarve | Kas peab |
|---|---:|---:|---:|---|
| Avamine, mediaan | 589,7 ms | — | < 1500 ms | Jah |
| Pan | 49,77 fps | 33,4 / 83,3 ms | 60 fps | Ei |
| Suum | 7,54 fps | 283,5 / 316,8 ms | 60 fps | Ei |
| Lohistamine | 22,29 fps | 50,1 / 150,0 ms | ≥ 45 fps | Ei |
| Loomine | 9642,7 ms | — | Eelarveta | Ei hinnata |

**Arhitekti otsus (2026-11-14): SVG jääb.** M1.3 töövoog ehitatakse SVG peale edasi; `validateDocument` jagamist praegu vaja pole.
Renderdusparandus tuleb eraldi kaardina enne M1.4 lõppu: enne WebView2 Performance-profiil, siis žesti ajal bitmap-teisendus, foto eraldi kiht ja ainult lohistatava komponendi eelvaate liigutamine ning sama proov uuesti.
Jalad lähevad Canvas'ele ainult siis, kui pärast neid muudatusi jääb lohistus alla 45 fps või pan alla 60 fps. See töö ei sisalda neid parandusi.

## M1-2-8 PNG-proov

Järgnevad tabelid on koopia `docs/tasks/M1-2-8.md` „Üleandmisest“, mitte uus mõõtmine.
Kehtiv jooks: 2026-11-14 16:15:03 UTC, tegelik dekodeeritud PNG ja foto-only PNG, aken nähtav ning fookuses.

| Rada | Foto | Variant | Tulemus | Kogu ms | toBlob ms | PNG baite | Pikslikontroll |
|---|---|---|---|---:|---:|---:|---|
| P1 | märkidega | display | photo_missing | 215,7 | 31,4 | 250508 | märgid puuduvad |
| P2-normal | märkidega | display | tainted | 65,9 | — | 0 | — |
| P2-anonymous | märkidega | display | error:image load failed (anonymous) | 3,8 | — | 0 | — |
| P3 | märkidega | display | ok | 447,0 | 28,8 | 336993 | läbis |
| P1 | märkidega | original | photo_missing | 410,9 | 41,9 | 250814 | märgid puuduvad |
| P2-normal | märkidega | original | tainted | 56,1 | — | 0 | — |
| P2-anonymous | märkidega | original | error:image load failed (anonymous) | 8,8 | — | 0 | — |
| P3 | märkidega | original | ok | 458,4 | 42,0 | 336993 | läbis |
| P1 | EXIF6 portree | display | photo_missing | 392,2 | 29,3 | 255538 | märgid puuduvad |
| P2-normal | EXIF6 portree | display | tainted | 153,5 | — | 0 | — |
| P2-anonymous | EXIF6 portree | display | error:image load failed (anonymous) | 6,9 | — | 0 | — |
| P3 | EXIF6 portree | display | ok | 536,2 | 35,0 | 905442 | läbis |
| P1 | EXIF6 portree | original | photo_missing | 238,8 | 39,9 | 255856 | märgid puuduvad |
| P2-normal | EXIF6 portree | original | tainted | 150,8 | — | 0 | — |
| P2-anonymous | EXIF6 portree | original | error:image load failed (anonymous) | 3,8 | — | 0 | — |
| P3 | EXIF6 portree | original | ok | 568,5 | 35,1 | 905442 | läbis |

| P3 foto / variant | Siht | Oodatud (x; y) | Mõõdetud (x; y) | Δ (x; y) / ok |
|---|---|---:|---:|---|
| märkidega / display | punane | (99,50; 99,50) | (99,00; 99,24) | (-0,50; -0,26) / jah |
| märkidega / display | sinine | (3899,50; 2899,50) | (3900,05; 2900,05) | (0,55; 0,55) / jah |
| märkidega / display | R1 | (99,50; 99,50) | (98,86; 99,50) | (-0,64; 0,00) / jah |
| märkidega / display | U1 | (3899,50; 2899,50) | (3899,40; 2899,33) | (-0,10; -0,17) / jah |
| märkidega / original | punane | (99,50; 99,50) | (99,00; 99,24) | (-0,50; -0,26) / jah |
| märkidega / original | sinine | (3899,50; 2899,50) | (3900,05; 2900,05) | (0,55; 0,55) / jah |
| märkidega / original | R1 | (99,50; 99,50) | (98,86; 99,50) | (-0,64; 0,00) / jah |
| märkidega / original | U1 | (3899,50; 2899,50) | (3899,40; 2899,33) | (-0,10; -0,17) / jah |
| EXIF6 portree / display | punane | (99,50; 99,50) | (99,24; 99,00) | (-0,26; -0,50) / jah |
| EXIF6 portree / display | sinine | (2899,50; 3899,50) | (2900,01; 3900,07) | (0,51; 0,57) / jah |
| EXIF6 portree / display | R1 | (99,50; 99,50) | (99,50; 98,86) | (0,00; -0,64) / jah |
| EXIF6 portree / display | U1 | (2899,50; 3899,50) | (2899,77; 3899,13) | (0,27; -0,37) / jah |
| EXIF6 portree / original | punane | (99,50; 99,50) | (99,24; 99,00) | (-0,26; -0,50) / jah |
| EXIF6 portree / original | sinine | (2899,50; 3899,50) | (2900,01; 3900,07) | (0,51; 0,57) / jah |
| EXIF6 portree / original | R1 | (99,50; 99,50) | (99,50; 98,86) | (0,00; -0,64) / jah |
| EXIF6 portree / original | U1 | (2899,50; 3899,50) | (2899,77; 3899,13) | (0,27; -0,37) / jah |

**Arhitekti otsus (2026-11-14, M4 jaoks): PNG komponeeritakse veebivaates P3 mustri järgi.** Foto dekodeeritakse toorelt, EXIF rakendub üks kord, kihtidele rakendub ekspordimaatriks ning SVG rasterdatakse valiku ja ülekatteta.
Tootmisekspordi protokoll saab ainult veebivaate enda päritoluga CORS-päise (Windowsis `http://tauri.localhost`, mujal `tauri://localhost`); fondid manustatakse SVG-sse.
Rusti komponeerimine P4 lükati tagasi. Praegune debug-päis ja URL-i parameeter jäävad proovi instrumendiks kuni M4 kaardini.
48 MP piiride katse on Windowsi punkt 3; võimaliku piirangu varuplaan on plokkide kaupa eksport.

## Windowsi eelkontroll

### EXIF-paranduse natiivne tsentroidikontroll

EXIF-i mõõtmisel kasutatud katse-EXE sisaldas lõplikku PNG-järelbaitide ja lukuvabastuse parandust; SHA-256 `78cb9d27267da31083e41c468a08047ea1122d070c934536237d618b5b076fb0`. Hilisem jaluse CSS-parandus fotoprotokolli ei muutnud; selle uue artefakti P7 kordus on allpool.
Sama 4000 × 3000 / EXIF 6 JPEG lisati päris avalehe failivalijaga ja vajutati „Sobita“. Pärast kasutaja „Pööra 90°“ vajutati uuesti „Sobita“.
Kuvatõmmised on 1102 × 731 (katseakna seadistus 1100 × 700). Rohelise foto ristkülik tuvastati pikslitest sõltumatult; märgid mõõdeti JPEG-le sobivate värvimaskide tsentroididena. Ootused arvutati lähtefoto punktidest (100; 100), (2900; 3900) ja käsitsi tuletatud 90° pöördest, tootmise `sceneMatrix`-it kasutamata. Koordinaadid on pidevad kuvatõmmise pikslikeskmed (indeks + 0,5).

| Seis / märk | Oodatud (x; y) | Mõõdetud (x; y) | Eukleidiline hälve | Piir / tulemus |
|---|---:|---:|---:|---|
| Algne / punane | (506,033; 115,050) | (505,576; 115,007) | 0,460 px | ≤ 2 px / läbis |
| Algne / sinine | (898,967; 648,950) | (898,981; 649,019) | 0,070 px | ≤ 2 px / läbis |
| Pööra 90° / punane | (1043,075; 130,933) | (1042,986; 131,014) | 0,121 px | ≤ 2 px / läbis |
| Pööra 90° / sinine | (361,925; 633,067) | (362,000; 633,000) | 0,100 px | ≤ 2 px / läbis |

Tõendid katsekaustas: `exif-native-initial.jpg`, `exif-native-rotate90.jpg` ja sama algusega `*.centroid.json`; mõõteskript `check-native-centroids.ps1`.
Vana vigane `quiet-portrait-fit.jpg` annab sama mõõtemeetodiga umbes 461 px vea; kaks eraldi sünteetilist JPEG-kontrollnäidet läbivad. Need kontrollnäited valideerivad mõõteskripti, mitte uut natiivset kuvamist. Tegelikud uue versiooni tulemused on ülal.
Rusti testid `display_response_neutralizes_exif_orientation_and_original_stays_identical` ja `large_display_variant_has_no_orientation` katavad JPEG II/MM, PNG II/MM, originaali-asenduse ja salvestatud display, sama pikkuse, CRC, vigase EXIF-i muutumatuse, PNG järelbaidid ning DB/original täpse säilimise. Mõlemad seansilukud vabastatakse pärast omandatud SQL-tulemust enne pildi läbimist.

### Seitsme punkti tulemused

Katsekaust ja allolevate kuvatõmmiste juur: `C:/Users/TRUMPIT/AppData/Local/Temp/bb-m1-2-katse/`.
P1, P3, P6 ja P7 läbivad. P2 foto import, kuvamisvariant, suum ja pan läbivad; mälutipp loeti CLI kaudu. P4 ja Task Manageri täpsed kasutussammud on allpool eraldi piirangutena, seega ei esitata tulemust märkusteta 7/7 läbimisena.

| Punkt | Tulemus ja tõend | Kuvatõmmis katsekaustas |
|---|---|---|
| 1. EXIF-portree Explorerist | Läbis parandatud versiooniga: natiivsed algse/pööratud foto tsentroidid ≤ 2 px. Tööriist ei toeta ristakna lohistust, seepärast tegi kasutaja mõlemad päris Exploreri lohistused: avalehele ja olemasolevale tühjale plaadile. Mõlemad kinnitas kasutaja; esimese uus foto oli näha ka järelkaadris, teise sama „Lohistuse kontroll“ faili JSON ja muutmata originaalblob kinnitati pärast kasutaja aknasulgemist (`quick_check=ok`). Teise lohistuse järelkaadrit ei saadud, sest kasutaja sulges akna enne jäädvustamist. | `exif-native-initial.jpg`, `exif-native-rotate90.jpg`, `exif-human-home-drop-confirmed.jpg`, `exif-human-canvas-drop-ready.jpg`; järelkaadri asemel `exif-human-canvas-sqlite-proof.json` |
| 2. 48 MP JPEG | Funktsionaalne osa läbis. Varasem päris „Lisa foto“ import 19 200,2 ms; hosti mälutipp CLI `PeakWorkingSet64` 606 470 144 B (578,375 MiB), ei hõlma WebView2/GPU protsesse. Originaal 8000 × 6000 / 767 928 B, display 4000 × 3000 / 709 978 B = 12 MP. Suum/Sobita töötas; uues natiivses korduses `H` ja vasaku nupuga lohistus nihutas fotot 30 / 20 px, kokkujooksmiseta. Task Manageri veerunäidu asemel kasutati sama protsessiloenduri CLI väärtust, sest tööriista ligipääs Task Managerile oli piiratud. | `02-48mp-photo-visible.jpg`, `02-48mp-fit.jpg`, `exif-48mp-before-pan.jpg`, `exif-48mp-after-pan.jpg` |
| 3. 48 MP PNG | Läbis: P3/original, 8000 × 6000, kõik pikslikontrollid rohelised. Täpne tabel allpool. | `03-48mp-png-result.jpg` |
| 4. „Salvesta mujale…“ | Osaline. Esimese katse koopia tekkis UIA sihisisendi tõrke tõttu Documents-kausta ja tõsteti TEMP-i `foto-koopia.pcbk`; päris taasavamine läbis. Mõlema fotovariandi SHA-256 ja PhotoRef kattusid allikaga; `quick_check=ok`. Viimastes on allikas ja TEMP-koopia eraldi; vana Documents-tee puuduv kirje jäi alles. Rahuliku akna katse-EXE dialoog pakkus õigesti TEMP sihti (`quiet-stop-save-dialog.jpg`), aga salvestamine katkestati EXIF-leiu STOP-i järel. | `04-save-elsewhere-source-readonly.jpg`, `04-temp-copy-reopened.jpg`, `quiet-stop-save-dialog.jpg` |
| 5. Katkenud import | Osaline Windowsi punkt, CLI taaste läbis. Task Manageri sisend oli piiratud. Oma protsess lõpetati CLI-ga pärast päris Rusti importi, enne foto viite tagastamist dokumendile (ajutine ootevärav). Enne taasavamist docPhotos=0 / storageRows=2; kirjutatava taasavamise järel 0 / 0 ning mõlemal korral `quick_check=ok`. Seega ühe viitamata foto originaal ja display koristati päriselt. Task Manageri täpne tegevus jäi kontrollimata. | `05-import-before-kill.jpg`, `05-reopened-without-dangling-photo.jpg` |
| 6. Tavaline sulgemine | Läbis. Värske akna X klõps, jälgitava EXE protsessi `ExitCode=0`; sama faili `quick_check=ok`. Seda ei tuletata Vite sulgemisest ega hilisema katseakna sundlõpetusest. | `07-panels-hidden.jpg` (vahetult enne X), `05-reopened-without-dangling-photo.jpg` |
| 7. Tööpind | Läbis pärast leitud jalusevea parandust. Päris 1100 × 700 aknas (kaader 1102 × 731) peideti ja taastati `N`/`O` paneelid mõlemas teemas. Esialgu murdus fotonuppude rida 52 px kõrguseks 36 px jaluses, põhjustades globaalsed kerimisribad. Alla 1280 px vaates muudetud ainult jaluse vahed/servatühimik (8 px); kõrgus jääb 36 px. Viimane natiivne hele/tume kordus näitab kõiki 10 juhikut ühe rea peal, globaalseid kerimisribasid pole ja omaduste paneel jääb üla-/alumise riba vahele. Lõpus taastati süsteemiteema ja X sulges akna koodiga 0. | `exif-p7-dark-restored.jpg`, `exif-p7-light-restored.jpg` (N/O); `exif-p7-fixed-light-context.jpg`, `exif-p7-fixed-dark-context.jpg`, `exif-p7-fixed-system-restored.jpg` (lõplik paigutus) |

Praeguse versiooni ajutine loomistee, impordi taimer ja katkestusvärav olid ainult katserakmestikus; `main.tsx` taastati täpselt alusega samaks. Repo Tauri seadistus ei muutunud. Lõpp-ehitus taastab tavalise 1280 × 800 akna. Kõik katses käivitatud BB ja Vite protsessid on suletud.
Täisraport: `%TEMP%/bb-m1-2-katse/native-report.log`. Punkti 5 enne/pärast JSON-id säilivad tööpuu ignoreeritud `m129-review.log`-is.

Enne parandust tehtud rahuliku akna lisakatse raport on `%TEMP%/bb-m1-2-katse/native-quiet-report.log` ja tööpuu `m129-quiet-native.log`.
Sõltumatu kontroll: sisend JPEG toormõõt 4000 × 3000, EXIF 6; Edge'i `from-image` dekodeerimine annab 3000 × 4000, TL RGB(254,0,0), BR RGB(0,0,254). Sisendi ja salvestatud originaali SHA-256 on `33afd1c2e74e7d8f2a7f17e4585f31dbe6ce312fab7d9c6b0a4ddd1964c026cf`.
`quiet-portrait-fit.jpg` pärineb 18:13:23 UTC; päeviku esimene `photo.setTransform` on alles 18:14:19 UTC. Lõplikus katsefailis on pärast üht kasutaja pööramiskäsku `transform=rot180`; seda ei esitata esialgse importseisundina. Fail ja metaandmete/pikslite JSON-tõendid säilivad katsekaustas.
Parandatud protokolli, pani, kasutaja lohistuste ja viimase P7 korduse raport on `%TEMP%/bb-m1-2-katse/exif-native-report.log` ning tööpuu `m129-exif-native.log`. Kasutaja lohistuste SQLite'i tõendid on `exif-human-home-sqlite-proof.json` ja `exif-human-canvas-sqlite-proof.json` katsekaustas. Need ei ole automaatse aknajuhtimise testid.

48 MP P3 proovi kehtiv jooks: `valid=true`, `invalidReasons=[]`, nähtav ja fookuses Tauri aken, klient 1280 × 800, DPR 1,25.
Logi: `C:/Users/TRUMPIT/AppData/Local/ee.pcbkaardistaja.desktop/logs/pcbk.log`, `[png-probe]` 2026-11-14 17:20:09 UTC.
Toor-JSON: `%TEMP%/bb-m1-2-katse/png48-raw.log`; kuvatõmmis `%TEMP%/bb-m1-2-katse/03-48mp-png-result.jpg`.

| Rada / variant | PNG mõõdud | Kogu aeg | `toBlob` | PNG baite | Piirang / pikslikontroll |
|---|---|---:|---:|---:|---|
| P3 / original | 8000 × 6000 | 1780,6 ms | 95,4 ms | 1 038 830 | Canvas'e suuruse ega mälu piir vastu ei tulnud; kõik märgid ja komponendid läbisid. |

Oodatud punane keskpunkt oli (99,5; 99,5), mõõdetud (99,00; 99,24); sinine (7899,5; 5899,5) ja (7900,06; 5900,05).
Komponentide suurim teljehälve oli 0,60 px (lubatud 2 px). Protsessi `PeakWorkingSet64` oli 605 814 784 baiti; see ei sisalda WebView2 alamprotsesse.

## Kontrollid ja O3

| Kontroll | Tegelik tulemus |
|---|---|
| `pnpm api` ja `pnpm api:check` | Läbisid. |
| `pnpm check` | Läbis: 126 faili, 1117/1117 testi, tüübid, lint, sõltuvusreegel, failipikkused ja API. |
| `pnpm coverage` | Läbis: laused 99,5%, harud 98,31%, funktsioonid 100%, read 100%; läved muutmata. |
| `pnpm format:check` | Läbis. |
| `pnpm e2e` | Uuesti läbis: 23/23, sh kuus foto vootesti ja uus `bottom_bar_controls_fit_at_minimum_window_size` mõlema teemaga. |
| `cargo test --locked --offline` | Uuesti läbis: 86/86, sh mõlemad EXIF-regressioonid, õigused ja väljalaskefailid. |
| `cargo clippy --locked --offline --all-targets -- -D warnings` ning `cargo fmt --check` | Läbisid hoiatusteta. |
| `pnpm tauri build --debug` | Läbis: tavaline EXE ja 0.1.1 debug-MSI; versiooni ei muudetud. Production JS ei sisalda perf/PNG proove. |
| `git diff --check` ja dokumendikontroll | Läbisid; tööpuu dokumendikontroll kontrollis 98 Markdowni faili. |

v0.1.1 näidisfail (49 152 baiti) loodi sildi `v0.1.1` (`6119ff1`) ehituse päris kasutajaliidesega: R1 ja U1 paigutatud, U1.3 nimi FB, U1.8 NC, üks 4,98 V mõõtmine U1.3-l.
Ajutise vana versiooni ainus testikohandus suunas `projects.create` tee katsekausta; vana mootor ja salvestus kirjutasid faili.
SHA-256: `caef9d0ac7d3deaad032522527f6556aea04fe637355b82520206f7922a36a65`.
Ajutine tööpuu eemaldati Giti registrist. `%TEMP%/bb-m1-2-katse/v0.1.1-worktree/` jääkide eemaldamine jäi pikkade teede taha; automaatne kontroll keelas täpse tee järelkoristuse teatega „blocked by policy“.

O3 stopper: 19:09:01,407–19:30:40,919 EET = **21 min 39,512 s** abistatud Windowsi eelkontrollile. Koos vana versiooni näidisfaili UI tööga 26 min 1,622 s; vana EXE ehitusaeg, raport ja koristus ei kuulu sellesse.
See aeg sisaldab UI samme, proove, tööriistakutseid, fookuse taastamist ja ootamist. Puhast inimese sisendiaega eraldi ei mõõdetud; seda baasaega siit välja arvutada ei saa.

| Punktid | Automatiseeritav olemasolevate sõltuvustega |
|---|---|
| 1 | EXIF ja joondus on brauseris automatiseeritud. Päris Exploreri lohistus jääb praeguse tööriistaga inimese suitsukontrolli. |
| 2 ja 4 | Rusti testid kontrollivad mõõte, 12 MP varianti ja koopia baite. Olemasolev proov + PowerShelli protsessinäit annavad native aja/mälu; dialoogi täpne käsitsemine vajab päris akna kontrolli. |
| 3 | Lipuga PNG-proov ja JSON-logi on juba automaatsed; nähtavuse/fookuse valvur peab säilima. |
| 5 | Olemasoleva `test_writer` protsessi ja SQLite kontrollidega saab teha crash-before-PhotoRef ning writable-open-prune integratsioonikatse. Ajutist UI rakmestikku tootesse ei jäeta. |
| 6 | EXE handle / ExitCode ja SQLite `quick_check` on PowerShelli/Pythoniga automatiseeritavad; X sisend vajab inimest või olemasolevat aknajuhtimist. |
| 7 | Teemad ja paneeliolekud on osalt brauseri/komponenditestidega kaetud; päris Windowsi fookus, DPI ja kattuvus vajavad inimese vaatlust. |

O3 lahenduse valib arhitekt ülevaatuses. Uut WebDriverit ega muud sõltuvust ei lisatud.
Rahuliku akna lisakatse 18:10:50,472–18:14:44,219 UTC kestis 3 min 53,747 s; X-ga koristus lõppes 18:15:08 UTC väljumiskoodiga 0. See peatati uue EXIF-leiu tõttu. P2 pan ja P7 täiendused jäid tegemata.
Pärast parandust kulus natiivsele EXIF-/pan-/paneelikordusele ligi 9 min 30 s; inimese kahe lohistuse ja nende ootamise aeg ei olnud eraldi mõõdetud. Viimase CSS-paranduse natiivse P7 stopper oli 19:22:50,445–19:26:20,145 UTC ehk 3 min 29,700 s (algne käivitusootamine väljas). X väljumine 19:26:20,224 ületas kokku lepitud 19:26:10 piiri 10,224 sekundiga; seda ei esitata tähtajaks lõppenud katsena. Süsteemiteema taastati, protsesse ei jäänud elama.
Ka eelmine automaatne failinähtavuse ettevalmistus lõppes 19:05:14 UTC, 8 sekundit pärast 19:05:06 piiri. Mõlemad ajaületused on töö korraldamise vead; kasutaja lohistused on eraldi inimese tehtud sammud, mitte automaatika tulemus.
P7 põhjus kontrolliti ka 40 isoleeritud brauserimõõtmisega (teemad, toetatud 1100/1101/1279/1280 laiused ja DPR 1 / 1,25). Alla kokkulepitud miinimumi 1099 × 699 jääb olemasolev miinimumsuuruse kerimine; seda ei loeta läbinuks. Püsivasse E2E-sse lisati üks sisuline geomeetriaregressioon, mitte kogu diagnostikamaatriks.

## Kasutaja suitsukontroll

Enne katset sule kõik BB aknad. Käivita `%TEMP%/bb-m1-2-katse/pcbk-m1-2-9-exif-katse.exe`.
See eraldi katse-EXE suunab uued projektid ja koopiad vaikimisi katsekausta; tavaline EXE loob uue projekti Documents-kausta. Katse-EXE muudab ainult neid teevalikuid, mitte mootorit ega salvestust. Repo lähtekoodis seda kohandust ei ole.
Kasuta ainult sünteetilisi `portree-exif6.jpg`, `foto-48mp.jpg` ja `.pcbk`-faile kaustas `%TEMP%/bb-m1-2-katse/`. Katse-EXE ei tohi töötada samaaegselt tavalise BB-ga.
Viimane katse-EXE sisaldab nii protokolli- kui ka jaluseparandust: 19 228 160 baiti, SHA-256 `209fe7da346889f27e7881d580d5c46188444e4c1e38f0a935837c96c837c0ce`. See avaneb P7 jaoks 1100 × 700 suuruses aknas. Ajutine lähtekood/diff, akna CLI-ülekirjutus ja ehituslogi on katsekausta failides `exif-main-harness.tsx`, `exif-harness.diff`, `exif-window-override.json`, `p7-final-harness-build.log`; tavaline 1280 × 800 EXE ehitati pärast lähtekoodi taastamist uuesti. Kasutaja kaks päris lohistust on tõendatud varasema sama protokolliga katse-EXE-ga; alloleva kogu suitsuloendi kasutajapoolne läbimine ja verstaposti vastuvõtt on veel eraldi.

1. Lohista Explorerist `portree-exif6.jpg` avalehele. Avaneb uus plaat nimega „portree-exif6“. Märginurkade vaatamiseks vajuta „Sobita“: portree on püsti, punane märk üleval vasakul ja sinine all paremal. See on allpool esimene projekt.
2. Vali Teegist takisti, vajuta „Paiguta“ ja klõpsa fotol. Komponent ilmub nende kolme paigutustegevusega.
3. Vajuta `K`, klõpsa kahel punktil, sisesta `10` mm ja kinnita. Alumisel ribal on mõõtkava; „Võta tagasi“ toob kalibreerimata oleku tagasi. Vajuta „Tee uuesti“: mõõtkava taastub ja jääb järgmisteks sammudeks alles.
4. Vajuta „Pööra 90°“ ja „Peegelda“. Foto ning komponendi jalad liiguvad koos ja jäävad samade märkide peale.
5. Muuda läbipaistvus 50 protsendile ja lülita sisse „Hall“. Sulge projekt ja ava see viimastest uuesti; foto vaate seaded säilivad.
6. Mine avalehele ja loo fotota plaat nimega „Lisa foto katse“. Vajuta „Lisa foto“, vali `foto-48mp.jpg` ning vajuta „Sobita“. Foto ilmub ja lõuendit saab nihutada ning suumida.
7. Mine avalehele ja loo fotota plaat nimega „Lohistuse katse“. Lohista Explorerist portreefoto selle lõuendile. Foto lisandub olemasolevale plaadile.
8. Jäta „Lohistuse katse“ BB-s lahti. Exploreris ava katsekausta faili `katse-Lohistuse katse-*.pcbk` Atribuudid (Properties), märgi „Kirjutuskaitstud“ (Read-only) ja vajuta „Rakenda“ (Apply). Muuda ainult seda sünteetilist katsefaili.
9. Vajuta BB-s „Pööra 90°“ ja oota salvestusviga (ainult `N` ei tekitanud lisakatses viga). Vali veateatest „Salvesta mujale…“ ning kinnita dialoogi pakutud uus koopia katsekaustas. Eemalda seejärel algse katsefaili kirjutuskaitse Exploreris. Mine avalehele ja ava koopia: foto on alles, algne ja koopia on viimastes eraldi.
10. Ava viimastest esimene projekt „portree-exif6“ ja vali selle takisti. Sea aken 1100 × 700 suuruseks ning proovi heledat ja tumedat teemat. `N` peidab/toob navigaatori; `O` peidab/toob valitud takisti omadused. Paneel ei kata ribade nuppe.
11. Sulge aken ristist, käivita katse-EXE ja ava esimene projekt „portree-exif6“ uuesti. Foto, takisti, 3. sammus taastatud kalibreering ja foto vaate seaded on alles ning veateadet pole.
12. Paiguta plaadi paremasse serva SOIC ja vali järjest mitu selle jalga. Pane kirja, kas omaduste paneeli taasavanemine katab plaati ja segab tööd. See on sisend M1.3 esimesele kaardile (plaani „Tööpinna paigutus“, punkt 1).

Kui kirjutuskaitsega katse katkestad, eemalda 8. sammus pandud märge katsefaililt ka siis, kui ülejäänud loendit lõpuni ei tee.
Kasutaja visuaalne vastuvõtt ja luba väljalaske tegemiseks on veel ootel.
