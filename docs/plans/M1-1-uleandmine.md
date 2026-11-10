# M1.1 · Üleandmine

## M1-1-1 · Korpuste generaatorid

Haru `codex/m1-1`, alus `2f140f2`. Ava töökaart käsuga `bb_task M1-1-1`. Kaardi jaotis „Üleandmine“ sisaldab kontrollide tulemusi ja viidet selle tööpuu diffile.

## M1-1-2 · Plaadi geomeetria

Haru `codex/m1-1` jätkab M1-1-1 muudatustelt. Ava töökaart käsuga `bb_task M1-1-2`. Ülevaatuse diff on samas tööpuus.

## Ülesannete 1–2 koondcommiti üleandmine

Korpusegeneraatorid, plaadi geomeetria ja nende testid on Claude’i ülevaatusel. Kasutaja andis loa nende kahe ülesande koondcommitiks.

| Käsk | Tegelik tulemus |
| --- | --- |
| `pnpm api` | Läbis ja genereeris API ülevaated. |
| `pnpm check` | Läbis **515/515** testi 50 failis. Tüübikontroll, ESLint, sõltuvusreeglid ja API kontroll läbisid. |
| `pnpm format:check` | Kõik kontrollitud failid vastasid Prettieri vormingule. |
| `pnpm api:check` | Läbis. Genereeritud domeeni API ülevaade andis 662 rea pikkuse hoiatuse. |

## M1-1-10 ja M1.1 vastuvõtt

Haru `codex/m1-1`, alus `6efa841`. Brauseritestid kasutavad rakenduse kasutajaliidest. Projekti sulgeb ülariba nupp „Tagasi avalehele“. Tootekood ja M0 testid jäid samaks.

| Käsk | Tegelik tulemus |
| --- | --- |
| `pnpm check` | Läbis 735/735 testi 72 failis. Tüübikontroll, ESLint, sõltuvusreeglid, failipikkuse kontroll ja API kontroll läbisid. Pikkuse hoiatused olid failidel `backup.rs`, `workbench.test.tsx`, `docs/api/domain.md` ja `docs/api/ui.md`. |
| `pnpm format:check` | Läbis. |
| `pnpm e2e` | Chromiumis 15/15 (M0 8/8, M1.1 7/7). |
| `cargo test --locked --offline` | `apps/desktop/src-tauri` kaustas 53/53. |
| `pnpm tauri build --debug` | M1.1 debug-EXE ja x64 MSI valmisid. |
| `git diff --check` | Läbis. |

### Windowsi eelkontroll

Ekraanipildid ja ühilduvusfailid on kaustas `%TEMP%\bb-m1-1-katse\`. Uue katseplaadi lõi äpp enda projektikausta nimega „M1.1 Windowsi katse“. Kõik katsed kasutasid sünteetilisi projekte.

1. **Uus fail – läbis.** Paigutasin SOIC-8, salvestasin jalale 3 `4,98 V` ja avasin projekti viimaste seast uuesti. Lõuendil oli näit samal jalal ja Mõõtmiste vahekaardil kirje `U1.3`. [Taasavatud projekt](C:/Users/TRUMPIT/AppData/Local/Temp/bb-m1-1-katse/m11-uus-taasavatud.png)
2. **`v0.1.0` koopia – töövoog läbis, NC-risti kontroll ei läbinud.** M0 aknas loodud `R1` (2 jalga) ja `U1` (8 jalga) tulid M1.1-s paigutamata loendisse. Navigaatori 372 px laius säilis, paigutus ilmus vaikimisi vaates klõpsu kohale. SOIC-8 jalal 3 oli `FB`, `4,98 V` säilis taasavamisel ja kirje viitas algse jala UID-le. SQLite’i koopias säilisid ka jala 8 UID ja `nc: true`, kuid lõuendil ei olnud jala 8 juures oodatud NC-risti näha. [M0 lähtefail](C:/Users/TRUMPIT/AppData/Local/Temp/bb-m1-1-katse/v010-algne.png) · [Paigutamata](C:/Users/TRUMPIT/AppData/Local/Temp/bb-m1-1-katse/m11-v010-paigutamata.png) · [FB ja jalg 8](C:/Users/TRUMPIT/AppData/Local/Temp/bb-m1-1-katse/m11-v010-fb-nc.png) · [Taasavatud koopia](C:/Users/TRUMPIT/AppData/Local/Temp/bb-m1-1-katse/m11-v010-taasavatud.png) Paranduse järel läbis NC-risti regressioonitest. Uus Windowsi ekraanipilt jäi tegemata, sest füüsiline Esc peatas automaatika enne parandatud äpi avamist.
3. **Hele ja tume, 1100 × 700 – läbis.** Kliendiala oli 1100 × 700 (koos Windowsi raamiga 1102 × 731). Teek, lõuend ja Mõõda-plokk olid korraga kasutatavad, kerimisribad jäid nuppudest kõrvale. [Hele](C:/Users/TRUMPIT/AppData/Local/Temp/bb-m1-1-katse/m11-hele-1100x700.png) · [Tume](C:/Users/TRUMPIT/AppData/Local/Temp/bb-m1-1-katse/m11-tume-1100x700.png)
4. **Lohistamine ja kiirklahvid – osaliselt kontrollitud.** Tähise nähtavast tekstist lohistades liikus tähis, kere jäi samasse kohta. Valitud kerega pööras üks R-vajutus korpust 90° ning üks F-vajutus muutis poole alumiseks. Chromiumis läbis `drag_with_escape_leaves_no_trace`. Windowsis jäävad keset lohistamist vajutatud Esc ning all hoitud R/F kasutaja käsitsi vastuvõttu. [Tähise lohistamine](C:/Users/TRUMPIT/AppData/Local/Temp/bb-m1-1-katse/m11-sildi-lohistamine.png) · [R](C:/Users/TRUMPIT/AppData/Local/Temp/bb-m1-1-katse/m11-r-uksikvajutus.png) · [F](C:/Users/TRUMPIT/AppData/Local/Temp/bb-m1-1-katse/m11-f-uksikvajutus.png)

`v0.1.0` (`7dacff8`) ehitati ajutises tööpuus. `pnpm install --frozen-lockfile --offline` läbis. Esimese debug-ehituse lõpus oli käivitatud EXE lukus (Windowsi viga 32). Pärast akna sulgemist läbis kordus ja valmis ka MSI. M0 lõi faili äpi vaikekausta. Pärast sulgemist tõstsin sünteetilise faili ajutisse kausta ja tegin varukoopia `uhilduvus-0.1.0-orig.pcbk`. Enne M1.1-ga muutmist olid failide SHA-256 räsid võrdsed, varukoopia räsi jäi samaks. Ajutine `bb-v010` tööpuu eemaldati.

### Tingimus → tõend

| Tingimus | Tõend |
| --- | --- |
| Esimene läbiv töövoog päris äpis, mõõtmine samal jalal | `first_through_flow_measurement_survives_reopen` ja Windowsi uus fail läbisid. |
| Sondipaari mustand ja Koht püsivad ka üldvaliku tühjendamisel | Ül. 9 sondipaari, tühja klõpsu ja kontaktikao katsed ning `blank_click_and_tab_keep_measure_location`. |
| Must sond jääb määramata kuni kasutaja valikuni | Ül. 9 `black_probe_is_never_chosen_automatically` ja `suggestion_sets_reference_only_after_click`. |
| M0 fail avaneb, suum ja nihe taastuvad | Ül. 6 vana vaate test, `board_zoom_pan_survive_view_only_close_and_reopen` ja Windowsi ühilduvuskoopia avamine. |
| Uue komponendi väärtus ja märgistus on tühjad | Ül. 8 `new_component_value_and_marking_are_empty`. |
| Lohistamine Esc/pointercancel ei jäta jälge | Ül. 6 `cancelled_drag_leaves_no_trace` ja `drag_with_escape_leaves_no_trace`. Windowsi füüsiline Esc-katse on veel lahti. |
| Viis põhikorpust, plaadipaigutus ja liigutamine, tundmatu komponent, jalad ja olekud, tähis lohistatava sildiga | Ül. 1, 2, 4, 7 ja 8 testid, Windowsis tähise lohistamine. Ühilduvuskoopia NC-rist on lahtine leid. |
| SOIC-8 jalad 1 ja 8 on õiges kohas | Ül. 1 `soic8_pin1_and_pin8_positions`. |

### Kasutaja suitsukontroll

1. Loo töölauaäpis uus katseplaat. **Oodatav:** avaneb tühi lõuend.
2. Vali Teegis SOIC, jäta jalgade arvuks 8 ja paiguta see lõuendile. **Oodatav:** tekib kaheksa jalaga U1, väärtus ja korpuse märgistus on tühjad.
3. Klõpsa jalal 3, kirjuta pingeväljale `4,98` ja vajuta Enter. **Oodatav:** Koht on U1.3, must sond on määramata ja jala juurde ilmub `4,98 V`.
4. Oota „Salvestatud“, vajuta „Tagasi avalehele“ ning ava projekt viimastest. **Oodatav:** näit on endiselt samal jalal ja Mõõtmiste vahekaardil on üks U1.3 kirje.
5. Tee `uhilduvus-0.1.0-orig.pcbk` failist värske katsekoopia ja ava koopia. **Oodatav:** R1 ja U1 on paigutamata, vasak paneel on 372 px lai ning lõuend avaneb vaikimisi vaates.
6. Paiguta olemasolev U1 SOIC-8-na ning suumi jalgadele lähemale. **Oodatav:** jala 3 nimi on FB ja jalal 8 on NC-rist jala kõrval.
7. Mõõda koopias jalga U1.3, nihuta ja suumi vaadet, sulge ning ava uuesti. **Oodatav:** näit, vaade ja FB jäävad alles.
8. Proovi heledat ja tumedat teemat 1100 × 700 kliendialal. **Oodatav:** Teek ja Mõõda-plokk on kasutatavad, kerimisribad ei kata nuppe.
9. Vali U1 kere ja alusta lohistamist. Vajuta enne hiirenupu vabastamist Esc. **Oodatav:** kere jääb paigale ja uut tagasivõtmise sammu ei teki.
10. Lohista U1 tähist selle nähtavast tekstist. **Oodatav:** liigub tähis, kere jääb paigale.
11. Vali U1 kere ja hoia R ning seejärel F umbes sekund all. **Oodatav:** üks 90° pööre ja üks küljevahetus.

### Kasutaja vastuvõtt

2026-11-10: kasutaja läbis päris Windowsi aknas kõik 11 suitsukontrolli sammu. Arhitekti otsus: **M1.1 on vastu võetud.**
