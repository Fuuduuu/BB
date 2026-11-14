# M1.3 · Tööpind, valik ja korpuste teek: teostusplaan

**Olek:** kinnitatud 2026-11-14 (kasutaja: O1 jah, O2 jah). Kaardid kirjutatakse vahetult enne iga ülesannet ([snaipriülesanded](../tasks/README.md)); hetkeseis on [STATUS-es](../STATUS.md).

**Eesmärk** ([07 › M1.3](../07-teekaart.md#m13--korpuste-teek)): tehnik näeb plaati võimalikult suurelt, valib õige jala esimese klõpsuga ja mõõdab, nägemata kahtlust, kumb sond on kumb. Teegis on kõik umbes 40 korpust prototüübist, ka punktkomponendid. Korpust saab vahetada nii, et jalad ja mõõtmised jäävad seotuks.

**Alus:** `main` `3735a4b` (`v0.2.0`). Sisend:
- M1.2 plaani märkmed [Mis jääb järgmistesse plaanidesse](M1-2-foto-ja-kalibreerimine.md#mis-jääb-järgmistesse-plaanidesse);
- M1.2 suitsukatse 12. samm ja kasutaja katse 2026-11-14 (allpool).

Haru: uus tööpuu ja haru `codex/m1-3` alusest `3735a4b`.

**Kasutaja katse v0.2.0-ga (2026-11-14):**
- **Omaduste paneel:** plaadi paremas servas valiti järjest U1.3 ja U1.4. U1.3 valik avas paneeli uuesti, paneel kattis U1.4 ja järgmine klõps jättis valituks U1.3. Kordus nii 1100 kui ka 1280 px aknas.
- **Plaadi nähtav laius:**
  - navigaator ja omadused avatud: 452 / 632 px;
  - ainult navigaator: 796 / 976 px;
  - mõlemad peidus: 1100 / 1280 px.
- **Ülariba nupp:** tühja valiku korral oli paneel peidus, aga nupp ütles „Peida omadused“. Kood: `TopBar.tsx` võtab nime `contextOpen`-ist, aga `aria-expanded` tuleb `contextShown`-ist.
- **Mõõda-plokk:** pärast 4,73 V salvestamist paarile U1.4 → U1.3 jäi pingevälja juurde vihjetekst „nt 4,98“. Sondide sildid on „Koht“ ja „Vastaspunkt“.
- **SOIC-8 jalad:** kõrvuti jalgade märgid kattusid 100% suumil 2,8 px.
- **Brauseriprototüüp:** kolme valikuga menüüs langes vahekaardiriba kõrgus 85 px-lt 45 px-le. Alumise riba foto- ja kalibreerimisrühm kahanes 603 px-lt 225 px-le. Kalibreerimiseni jõudis kuue Tab-vajutuse asemel kahega.

**HUD-otsus:** ujuvaid paneele (HUD) ei tehta. Ruumi annavad tagasi peidetav omaduste paneel ja kompaktsemad menüüd. Kui M1.3 suitsukatse näitab, et ruumist jääb ikka puudu, tuleb otsus uuesti.

## Kavandatud otsused

1. **Paneeli avamine on tehniku otsus.** Käsitsi peidetud omaduste paneel jääb peitu ka uue valiku korral. Paneeli avavad:
   - ülariba nupp;
   - klahv `O`;
   - mõõtmise alustamine valitud jalal klahviga `M`.

   See muudab M1-2-6b otsust.
2. **Jalg on padjandi kujuga.** Märk ja tabamuse ala on pööratud `w × h` ristkülik. Tabamuse ala on vähemalt 5 ekraanipikslit ja naabrite vahel võidab lähim kese. Joonistatakse ka jala 1 punkt.
3. **Mõõda-plokk näitab sonde nimega ja viimast salvestatud näitu.** Viimase näidu rida loetakse dokumendist mõõtmise tunnuse järgi, seega järgib see tagasivõtmist.
4. **Vasakul on kolm valikut:** „Teek“, „Komponendid“ ja „Mõõtmised“. „Plaadil“ ja „Paigutamata“ on filtrid ning loendur on avatud vaate päises.
5. **Alumine riba on jagatud otstarbe järgi.** Viis fotoseadet on menüüs „Foto sätted“. Foto nähtavus, kalibreerimise olek ja suum on otse kättesaadavad.
6. **Korpused on andmed, mitte kood korpuse kohta.** Umbes 40 korpust tuleb prototüübi valemitest olemasolevatesse perekondadesse (`chip`, `soic`, `sot23`, `to220`, `header`) ja vajadusel uutesse perekondadesse. Punktkomponendid (testpunkt, via, padjand, ava) on ühe jalaga korpused.
7. **Korpuse vahetus on üks käsk.** Jalgade vastavus käib numbri järgi: sama numbriga jalg säilitab `uid`-i. Kaduvate jalgade mõõtmised muutuvad ajaloolisteks ([04 › Kustutamise reeglid](../04-andmemudel.md#kustutamise-reeglid)). Vähendamine küsib kinnitust ja loetleb mõju; `Ctrl+Z` taastab sama `uid`-i.

## Kasutaja otsused enne ehitust

- **O1 · Järjekord:** kõigepealt tööpind ja valik (osa A), siis korpuste teek (osa B). Põhjus: katse näitas, et vale jala valik ja paneeli taasavanemine segavad tööd juba praeguste korpustega. *Arhitekti soovitus: jah.*
- **O2 · Failivorming:** korpuse vahetus ja punktkomponendid peaksid mahtuma praegusesse `BoardDoc` skeemi. Kui kaart näitab, et skeem peab muutuma, peatub ehitaja ja küsib. Migratsioon vajab sinu eraldi luba.

## Globaalsed piirangud

Kehtivad M1.2 piirangud:
- strict TS;
- failid ≤ 400 rida;
- sõltuvusreeglid;
- tekstid mooduli `i18n/et.ts`-is;
- kümnendkoma.

Lisaks:
- SVG jääb (M1-2-7 otsus).
- Uusi sõltuvusi ei lisata.
- Visuaalne vastuvõtt tehakse Tauri aknas tehniku enda plaadifotoga. Repo testides on ainult sünteetilised fotod.

Rajad: ülesanded 9 ja 11 on **rada B**, ülejäänud **rada A** ([WORKFLOW](../WORKFLOW.md#kaks-rada-tavaline-ja-kaitstud-töö)).

## Ülesanded

**Osa A · Tööpind ja valik (rada A)**

1. **Omaduste paneel jääb kasutaja soovil peitu.**
   - Omaduste päisesse tuleb sulgemisnupp. Ülariba nupu nimi ja `aria-expanded` järgivad tegelikku nähtavust. Avatud paneelinupul on vaskne täide.
   - Testid:
     - `hidden_context_stays_hidden_on_new_component_and_pin_selection`
     - `o_key_topbar_and_m_on_pin_open_context`
     - `context_button_label_follows_visibility`
     - `second_pin_at_right_edge_is_selectable_with_context_hidden` (e2e, 1100 px)
2. **Jalg padjandi kujuga.**
   - Praegu: `geometry/board.ts` ja `hits.ts` kasutavad raadiust `max(w, h)/2`. Tuleb ristkülik, mis on pööratud koos korpusega, ja jala 1 punkt.
   - Testid:
     - `soic8_neighbour_pins_do_not_overlap_at_100_percent`
     - `pin_hit_picks_nearest_center_between_neighbours`
     - `pin_marker_rotates_with_component_under_all_8_transforms`
3. **Mõõda-plokk.**
   - Sondide read:
     - „Punane sond · U1.4“;
     - „Must sond · U1.3“ või „määramata“;
     - „Vali musta sondi jalg“ on musta sondi real ja on `PickRefTool` ajal esile tõstetud.
   - Pingevälja kõrval on „Viimati salvestatud 4,73 V · U1.4 → U1.3“.
   - Jala valikul näidatakse ainult jala kaarti ja Mõõda-plokki, mitte kogu `ComponentDetails`-i.
   - Testid:
     - `probe_rows_name_red_and_black_pins`
     - `last_saved_reading_follows_undo`
     - `pin_selection_shows_pin_card_not_component_form`
4. **Vasak menüü kolme valikuga.**
   - Valikud on „Teek“, „Komponendid“ ja „Mõõtmised“. „Komponendid“ all on filtrid „Plaadil“ (vaikimisi) ja „Paigutamata“. Loendur on vaate päises.
   - Testid:
     - `navigator_tabs_fit_one_row_at_300px_with_1500_measurements`
     - `component_filters_switch_placed_and_unplaced`
5. **Alumine riba otstarbe järgi.**
   - „Foto sätted“ on menüü, milles on läbipaistvus, kontrast, hall, pööramine ja peegeldus. `Esc` viib fookuse nupule tagasi.
   - Otse kättesaadavad on foto nähtavus, „Kalibreerimata“ otsetee, `−` 100% `+`, „Sobita“ ja koordinaadid.
   - Testid:
     - `photo_settings_menu_returns_focus_on_escape`
     - `uncalibrated_shortcut_starts_calibration`
     - olemasolev `bottom_bar_controls_fit_at_minimum_window_size` laieneb menüüle.
6. **Templirežiim ja `Tab` järgmisele jalale.**
   - `PlaceTool` jääb pärast paigutust samale korpusele aktiivseks ja `Escape` lõpetab.
   - Mõõtmisel viib `Tab` sama komponendi järgmisele jalale ning väärtuse väli jääb fookusesse.
   - Testid:
     - `place_tool_stays_armed_until_escape`
     - `tab_moves_measurement_to_next_pin`

**Osa B · Korpuste teek**

7. **Umbes 40 korpust ja punktkomponendid** (rada A, domeen). Arvud tulevad prototüübist; kaart loetleb korpused ja nende allika.
   - Testid:
     - `soic8_pin1_and_pin8_positions` (07 tingimus);
     - `qfp44_pin12_on_bottom_side`;
     - `every_footprint_matches_prototype_pin_count`;
     - `point_components_have_one_pin`.
8. **Korpuse eelvaade.**
   - Avatud teegireal on väike pealtvaade jalgadega ja jala 1 märgiga.
   - Paigutamisel liigub kursoriga kaasa kogu kuju koos jalgadega.
   - Test: `library_preview_updates_with_pin_count`.
9. **Korpuse vahetus** (rada B: jalgade `uid` ja ajaloolised mõõtmised).
   - Testid:
     - `soic8_to_soic14_keeps_pins_1_to_8_uid`
     - `shrinking_package_confirms_and_lists_lost_pins`
     - `growing_back_does_not_reactivate_old_measurements`
     - `undo_restores_same_uid_and_active_measurements`
10. **Näit ja tähis eraldi.**
    - Näit ei kata oma komponendi tähise kasti. Vajadusel nihkub näit ja lühike viitejoon näitab jalani.
    - Test: `reading_label_avoids_own_ref_label`.

**Osa C · Vastuvõtt**

11. **E2e, suitsukatse ja väljalase** (rada B).
    - M1.3 e2e, eelmise versiooni näidisfail `v0.2.0.pcbk` testandmetesse, kasutaja suitsukatse Tauri aknas oma plaadifotoga ja versioon `v0.3.0`.
    - Hooldusvoor on üks; see on kaardil märkusena, kui on midagi teha.

## M1.3 vastuvõtt: tingimus → tõend

| Tingimus | Tõend |
|---|---|
| Käsitsi peidetud omaduste paneel jääb uue valiku korral peitu | Ül. 1 testid, Ül. 11 suitsukatse |
| Kaks kõrvuti jalga plaadi paremas servas on järjest valitavad | Ül. 1 e2e, Ül. 2 |
| SOIC-8 naaberjalad ei kattu 100% suumil | Ül. 2 |
| Mõõtepaneelist on näha sondid ja viimane salvestatud näit | Ül. 3 |
| Navigaatori kolm valikut mahuvad 300 px laiusesse ühele reale | Ül. 4 |
| Alumine riba mahub fotoga projektis 1100 px aknas ühele 36 px reale | Ül. 5 |
| SOIC-8 jalg 1 (−2,775; −1,905) mm, jalg 8 (2,775; −1,905) mm; QFP-44 jalg 12 alumisel küljel | Ül. 7 |
| SOIC-8 → SOIC-14 → SOIC-8 vahetus hoiab `uid`-id ja mõõtmiste reeglid ([07](../07-teekaart.md#m13--korpuste-teek)) | Ül. 9 |
| Vana `v0.2.0` fail avaneb | Ül. 11 |

## Mis jääb järgmistesse plaanidesse

- **M1.4:**
  - suurus ja joondus, oma jalad;
  - renderdusparandus enne M1.4 lõppu (M1-2-7 otsus);
  - jõudluseelarve.
- **Hiljem:**
  - foto vahetus ja teine foto koos joondusega (`toBoard`);
  - korpuse joondus fotol;
  - PNG-ekspordi funktsioon ja tootmise CORS-päis (M4).
- **Väiksemad lahtised asjad:**
  - Katkenud impordi integratsioonitest (`test_writer` + prune) läheb järgmisele raja B salvestuskaardile.
  - `photo_orientation` tõstetakse tavaliseks mooduliks järgmisel Rusti puudutusel.
