# M1.3 üleandmine ja kasutaja suitsukatse

2026-11-16. Tööpuu `C:/Users/TRUMPIT/.codex/worktrees/bb-m1-3/BB`, haru `codex/m1-3`, alus `9aa5eb3`. Ehitaja kasutab ainult sünteetilisi faile. Kasutaja visuaalne vastuvõtt ja uus roheline kaug-CI on eraldi kontrollid; versiooni, silti ega `main`-i ei ole muudetud.

## Vastuvõtt: tingimus → tõend

Alus on [põhikausta M1.3 vastuvõtutabel](C:/Users/TRUMPIT/Desktop/BB/docs/plans/M1-3-toopind-ja-korpused.md#m13-vastuvõtt-tingimus--tõend). Tabeli automaattestid kuuluvad allpool viidatud rohelisse lõppkäiku; kasutaja suitsukatse ootab eraldi vastuvõttu.

| Tingimus | Tõend |
|---|---|
| Käsitsi peidetud omaduste paneel jääb uue valiku korral peitu | E2E `second_pin_at_right_edge_is_selectable_with_context_hidden` ja uus `m1_3_technician_flow`; suitsukatse samm 5 |
| Kaks kõrvuti jalga plaadi paremas servas on järjest valitavad | E2E `second_pin_at_right_edge_is_selectable_with_context_hidden`, seal päris koordinaatidega tabamus; suitsukatse samm 5 |
| SOIC-8 naaberjalad ei kattu 100% suumil | TS `soic8_neighbour_pins_do_not_overlap_at_100_percent`; suitsukatse samm 5 |
| Mõõtepaneelist on näha sondid ja viimane salvestatud näit | TS `probe_rows_name_red_and_black_pins`, `last_saved_row_shows_value_and_probe_pair`; E2E `measure_panel_fits_280px_and_history_fits_240px`, `m1_3_technician_flow`; samm 6 |
| Sisendite raami kontrast on vähemalt 3 : 1 mõlemas teemas | TS `input_border_contrast_at_least_3_to_1_in_both_themes`; suitsukatse samm 11 on inimese loetavuse hinnang |
| Navigaatori kolm valikut mahuvad 300 px laiusesse ühele reale | E2E `navigator_tabs_fit_one_row_at_240_and_300px`; suitsukatse samm 3 |
| Alumine riba mahub fotoga projektis 1100 px aknas ühele 36 px reale | E2E `bottom_bar_controls_fit_at_minimum_window_size`; suitsukatse samm 2 |
| SOIC-8 jalg 1 (−2,775; −1,905) mm, jalg 8 (2,775; −1,905) mm; QFP-44 jalg 12 alumisel küljel | Domeenitestid `soic8_pin1_and_pin8_positions`, `qfp44_pin12_on_bottom_side`; suitsukatse samm 3 |
| SOIC-8 → SOIC-14 → SOIC-8 vahetus hoiab uid-d ja mõõtmiste reeglid | TS `soic8_to_soic14_keeps_pins_1_to_8_uid`; E2E `soic8_14_8_swap_keeps_and_historizes_measurements`, `m1_3_technician_flow`; sammud 8–9 |
| Vana v0.2.0 fail avaneb | Rust `old_files_open_and_get_file_id_on_first_writable_open` kõigi kolme väljalaskefailiga, `v0_2_0_photo_scale_and_measurement_survive_open`; samm 10 |

## Vastu võetud ehituskaardid

Need on kaartide vastuvõtu commit'id, mitte selle kaardi uued commit'id.

| Kaart | Commit | Tulemus |
|---|---|---|
| M1-3-1 | `4a4a70b` | Omaduste paneeli püsiv peitmine |
| M1-3-2 | `5e7c0f6` | Padjandi kujuga joonistus ja tabamus |
| M1-3-3 | `4d5049a` | Sondid, viimane näit ja jala kaart |
| M1-3-4 | `033acea` | Navigaatori kolm valikut |
| M1-3-5 | `da5d804` | Kompaktne alumine riba ja foto sätete menüü |
| M1-3-6 | `badd1c8` | Templirežiim ja järgmise jala otsetee |
| M1-3-7 | `a752b56` | 40-kirjeline korpuste teek |
| M1-3-8 | `adc8fb4` | Pealtvaate eelvaade ja jalgadega kummitus |
| M1-3-9 | `43749fd` | Korpuse vahetus jalgade vastavusega |
| M1-3-H | `e43d830` | Seansiga seotud import, turvaline automaatne failinimi, täielik vaate võrdlus ja registrikaitsed |
| M1-3-10 | `f58c219` | Näidu ja tähise eraldi paigutus |
| M1-3-10b | `d3e4cb7` | Mõõtmise loetavus ja juhtelementide kontrast |
| M1-3-10c | `9aa5eb3` | Automaatse tähise padjandi alammõõt |

## Selle kaardi tõendid

- Varem 400 DOM-renderdust teinud testifail kasutab nüüd kastide jaoks puhtaid funktsioone ja üht renderdatud kombinatsiooni. Kõik kolm testinime, mõlemad pooled, kaheksa teisendust, nurgad ning mõõtkava/suumi äärejuhud säilisid; ajapiir jäi 5000 ms.
- Täiskatvuse käigus oli QFP-test enne 3162,29 ms ja pärast 173,22 ms, header-test 1766,57 → 205,20 ms. Mõlemas käigus 1445/1445 testi. Padjandi alammõõdu ajutine eemaldamine pani ka uue testi õigesti läbi kukkuma: header 1,15 px², QFP 3,75 px². Tootekood taastati.
- GitHubi [jooks 43810855659](https://github.com/Fuuduuu/BB/actions/runs/43810855659) mõõtis vana QFP-testi katvusega 7562 ms. Uue paranduse kaug-CI vajab hilisemat lubatud commiti ja push'i.
- Uus E2E järgib arhitekti täpsustust: 4,73 V mõõtmine U2.4 → U1.4 säilib; lisatud U1.12 näit 3,3 V muutub kitsendamisel ajalooliseks ja `Ctrl+Z` taastab selle aktiivsuse. Seejärel kontrollitakse foto pikslite, komponentide, mõõtmiste ja vaate säilimist taasavamisel.
- UI API ülevaate 424-realise faili asemel on `ui-shell-chrome.md` 54, `ui-shell-feedback.md` 59 ja `ui-shell-state.md` 321 rida. Kõik 70 juurtee ja 31 shelli eksporti ning nende tüübid säilisid; tööriistu ei muudetud.
- Detailid tööpuu ignoreeritud `output/playwright/m1-3-11/` kaustas: katvuse enne/pärast JSON-id, alammõõdu RED-katsed, `flow-GREEN.log`, `old-files-*.log` ja `api-maintenance/comparison.json`.

### Lõppkontrollid ja brauseritõend

Põhikaustast `pnpm bb-review-card M1-3-11` läbis koodiga 0: [kokkuvõte ja logid](C:/Users/TRUMPIT/Desktop/BB/output/review-card/M1-3-11-zcILxa/summary.json). Kõik kolm kaardil nimetatud testi läbisid; vahele jäetud ja kordusel läbinud teste ei olnud.

| Kontroll | Tegelik tulemus |
|---|---|
| `pnpm api` | Genereeritud API ülevaade ajakohane, UI pikkuse hoiatus eemaldatud |
| `pnpm check` | Tüübid, lint, sõltuvusreegel, failipikkused, 1445/1445 testi ja API kontroll läbisid |
| `pnpm coverage` | 1445/1445; read 100%, harud 99,25%, funktsioonid 100%, laused 99,74%; läved muutmata |
| `pnpm format:check`, `pnpm api:check` | Mõlemad exit 0 |
| `pnpm e2e` | 33/33, sh `m1_3_technician_flow`; vahele jäetud ja kordusel läbinud 0 |
| `cargo test --locked --offline` | 88/88; mõlemad nimetatud ühilduvustestid läbisid |
| `pnpm tauri build --debug` | Tavaline EXE ja `PCB Kaardistaja_0.2.0_x64_et-EE.msi` ehitatud, exit 0; versioon jäi samaks |
| `git diff --check` | Exit 0 |

Lõppkatvuses kulutas header-test 143,44 ms, QFP-test 133,36 ms ja käsitsi nihke test 1,28 ms. Lisakontrollid: Rusti fmt ja uue testifaili Clippy `-D warnings`, sõltumatu diffi ülevaatus ning tööpuu dokumendikontroll läbisid. Ülevaatusel leitud kolm suitsujuhendi täpsustust parandati; testikoodi ega API leide ei olnud.

Koondkäigu Cargo käsk oli `cargo test --locked`; lisaks jooksutatud `cargo test --locked --offline` läbis samuti 88/88 (0 ebaõnnestunud, 0 ignoreeritud). Võrguühenduseta käigu logi on tööpuus `output/playwright/m1-3-11/cargo-offline-final.log`.

Kasutaja suitsukatse on allpool ja on veel tegemata. Kaug-CI rohelist tulemust ei väideta enne kasutaja lubatud commiti/push'i ja uut CI-jooksu.

Põhikaustast `pnpm proof M1-3-10` läbis 4/4 (2026-11-16): [kokkuvõte ja kuvatõmmised](C:/Users/TRUMPIT/Desktop/BB/output/playwright/proof/M1-3-10-TLudiz/summary.json). Mõlemas teemas `autoRefPinOverlapPx2 = 0`; pärast tahtlikku käsitsi lohistamist on infomõõt `refPinOverlapPx2 = 239,46 px²`.

## Ühilduvusfailid

Kõiki näidisfaile avatakse testides ajutistes koopiates. Kirjutuskaitstud avamine ja algfailide baitide säilimine on kontrollitud. Väljalasked 0.1.x eelnevad `file_id`-le; 0.2.0 juba salvestab tunnuse loomisel ja selle tunnus säilib.

| Fail | Lähteversioon | SHA-256 |
|---|---|---|
| `tests/fixtures/v0.1.0.pcbk` | Sünteetiline M0 näidis | `b9f9535bde765a9affe23d5ad8eea3a11af40323b5ce199b3877519c382e8d9f` |
| `tests/fixtures/v0.1.1.pcbk` | Sildi v0.1.1 kasutajaliides | `caef9d0ac7d3deaad032522527f6556aea04fe637355b82520206f7922a36a65` |
| `tests/fixtures/v0.2.0.pcbk` | Sildi v0.2.0 (`3735a4b`) kasutajaliides, loodud 2026-11-16 | `7c5ffa0662ad1927a7c990f41bbbc9924fd0768d7fa8e6cd994a23cb238b6177` |

v0.2.0 faili loomise ümbris muutis ainult loomisteed: `%TEMP%/bb-m1-3-katse/v0.2.0-ui-orig.pcbk`. Dokumendiandmed tehti päris debug-ehituse nuppude, klõpsude ja sisestusväljadega; SQL-i kaudu midagi ei kirjutatud.

Failis on 4000 × 3000 JPEG EXIF 6, `PhotoRef.transform = rot90`, 73,8905527054134 px/mm mõõtkava (738,905527054134 px / 10 mm), R1 ja SOIC-8 U1, U1.3 nimi FB, U1.8 NC ning U1.3 näit 4,98 V. Navigaator on salvestatud peidetuna; vana versioon vajas peitmise järel veel suumimuutust. See andis enne lõplikku koopiat uuele testile sisulise RED-i.

Foto originaalblob: 162457 baiti, SHA-256 `33afd1c2e74e7d8f2a7f17e4585f31dbe6ce312fab7d9c6b0a4ddd1964c026cf`. `original` tagastab samad baidid, `display` neutraliseerib Orientation-i väärtuseks 1; salvestatud blob säilib. Loomise kuvatõmmised ja ümbrise diff on `%TEMP%/bb-m1-3-katse/` kaustas.

## Piirangud ja järgmine töö

- Kasutaja suitsukatset ei asenda ehitaja automaattestid, kuvatõmmised ega sünteetilise faili loomine.
- J29 tõendiproov lohistab lõppkaadris tähise tahtlikult jala peale. Automaatse faasi nõue on `autoRefPinOverlapPx2 = 0`; käsitsi lõppasendi kattumine on lubatud info.
- Suure plaadi SVG-jõudluse parandus ja jõudluseelarve jäävad M1.4-sse. Foto vahetus/teine foto ja joondus, PNG-ekspordi funktsioon, tootmise CORS ning teegi nimekirja siluetid jäävad [põhikausta järgmiste plaanide loendisse](C:/Users/TRUMPIT/Desktop/BB/docs/plans/M1-3-toopind-ja-korpused.md#mis-jääb-järgmistesse-plaanidesse).
- Ajutise v0.2.0 tööpuu Giti kirje eemaldati. Pikkade teedega failijäägid on `%TEMP%/bb-m1-3-katse/v0.2.0-worktree/` kaustas: `git worktree remove` lõpetas kustutamise veaga „Filename too long“ ja automaatne heakskiidukontroll lükkas sihitud järelkoristuse tagasi põhjusega „blocked by policy“. Ülejäänud katsefailid ja EXE jäävad suitsukatseks TEMP-i.
- Uue versiooni, sildi, `main`-i liitmise ja avaldamise otsustab kasutaja koos arhitektiga pärast vastuvõttu. Selles kaardis ei tehta commiti ega push'i.

## Kasutaja suitsukatse: kuni 12 sammu

Staatus: **kasutaja teeb pärast arhitekti ülevaatust**. Ehitaja pole kasutaja fotot avanud ega kasutanud. Katse-EXE on `%TEMP%/bb-m1-3-katse/pcbk-m1-3-11-katse.exe`; uue projekti ja „Salvesta mujale…“ vaiketeed on samas TEMP-kaustas. EXE SHA-256: `3c7c2ec35042116808fdfdd3da7c3d6b2c0c3752b5bf90a395cb5d4dde28cbce`. Enne alustamist sule teised BB aknad.

1. Käivita katse-EXE ja lohista **enda plaadifoto** avalehele. Oodatav: uus plaat, õige orientatsiooniga foto ja projekti fail TEMP-kaustas; veateadet ei ole.
2. Sea aken umbes 1100 × 700. Proovi foto sätteid, pööret ja peegeldust, suumi, „Sobita“ ja kursorit; kalibreeri K-ga tuntud vahe. Oodatav: alumine riba mahub ühele reale, juhikud on nähtavad, mõõtkava ja kursori millimeetrid on arusaadavad.
3. Kui navigaator on peidus, ava see N-ga; vaata Teek/Komponendid/Mõõtmised valikuid 300 px laiuses. Ava SOIC-8 ja QFP pealtvaade, seejärel vali enne paigutamist uuesti SOIC-8. Oodatav: kolm valikut on ühel real, SOIC-i jalg 1 on üleval vasakul ja 8 üleval paremal; jalgade järjestus on loetav.
4. Vajuta SOIC-8 „Paiguta“ ja klõpsa kaks korda fotol; vajuta Escape ning klõpsa tühja kohta. Oodatav: kaks komponenti U1/U2, pealtvaatega kummitus lõpeb Escape'iga ja kolmandat komponenti ei teki.
5. Paiguta või nihuta U1 plaadi parema serva juurde, sea 100% suum ja peida omadused O-ga. Vali kõrvuti U1.3 ja U1.4. Oodatav: valik liigub õigele jalale, naaberpadjandid ei kattu ja omadused jäävad peitu. O avab paneeli teadlikult uuesti.
6. Vali U2.4, vajuta M ja vali mustaks sondiks U1.4; sisesta 4,73 ja salvesta. Oodatav: Mõõda-plokk avaneb, mõlemad sondid on nimega, pinge sisend on selge ning viimati salvestatud plokk näitab 4,73 V ja sama sondipaari.
7. Vali U2 kere ja ava vajaduse korral omadused O-ga. Sisesta väljale „Väärtus või mudel“ `LONG CONNECTOR VALUE` ja kinnita Enteriga. Vaata fotol tähist, väärtust ja 4,73 V näitu; proovi foto pöördeid/peegeldust ning soovi korral lohista tähist. Oodatav: automaatne tähis ja väärtus jäävad oma jalgadest välja, näit ei kata tähist ning vajaduse korral on viitejoon nähtav. Käsitsi nihutatud tähist ei tõsteta ise ümber.
8. Vaheta U1 SOIC-14-ks, vali U1.12, tühjenda must sond ja salvesta 3,3 V. Vaheta tagasi SOIC-8-ks. Oodatav: dialoog loetleb jalad 9–14 ja ühe mõõtmise; kinnituse järel on 3,3 V ajaloos kontakt kustutatud, 4,73 V on endiselt aktiivne.
9. Vajuta lõuendil Ctrl+Z. Oodatav: U1 on taas SOIC-14, 3,3 V on aktiivne ja 4,73 V jääb alles; kumbki mõõtmine pole kadunud.
10. Ava ettevalmistatud koopia `%TEMP%/bb-m1-3-katse/v0.2.0-suitsukatse.pcbk`. Oodatav: portreefoto, kalibreeritud mõõtkava, R1/U1, FB/NC, 4,98 V ja peidetud navigaator on alles. Ava seejärel enda katseplaat viimastest projektidest.
11. Vali avalehe „Välimus“ kaudu kord hele ja kord tume teema ning ava projekt. Oodatav: pinge sisend, sondide nupud, viimase näidu plokk ja mõõtmiste ajalugu on loetavad; juhtväljade raamid eristuvad taustast.
12. Peida navigaator ja omadused, muuda suumi ning sule aken tavaliselt. Käivita EXE uuesti ja ava katseplaat viimastest projektidest. Oodatav: foto, komponendid, mõõtmised ja valitud vaade on alles; uus jalavalik ei ava käsitsi peidetud omadusi. Kirjuta iga sammu tulemus arhitektile.
