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
7. Vali U2 kere ja ava vajaduse korral omadused O-ga. Sisesta väljale „Väärtus või mudel“ `LONG CONNECTOR VALUE` ja kinnita Enteriga. Vaata fotol tähist, väärtust ja 4,73 V näitu; proovi foto pöördeid/peegeldust ning soovi korral lohista tähist. Oodatav: automaatne tähis ja väärtus jäävad oma jalgadest välja ja näit ei kata tähist. Kui näit pidi nihkuma, seob selle jalaga viitejoon (käsitsi nihutatud tähisel viitejoont ei ole). Käsitsi nihutatud tähist ei tõsteta ise ümber. Pikk väärtus võib väikesel suumil ulatuda naaberkomponendile; see on teadaolev piirang.
8. Vaheta U1 SOIC-14-ks, vali U1.12, tühjenda must sond ja salvesta 3,3 V. Vaheta tagasi SOIC-8-ks. Oodatav: dialoog loetleb jalad 9–14 ja ühe mõõtmise; kinnituse järel on 3,3 V ajaloos kontakt kustutatud, 4,73 V on endiselt aktiivne.
9. Vajuta lõuendil Ctrl+Z. Oodatav: U1 on taas SOIC-14, 3,3 V on aktiivne ja 4,73 V jääb alles; kumbki mõõtmine pole kadunud.
10. Ava ettevalmistatud koopia `%TEMP%/bb-m1-3-katse/v0.2.0-suitsukatse.pcbk`. Oodatav: portreefoto, kalibreeritud mõõtkava, R1/U1, FB/NC, 4,98 V ja peidetud navigaator on alles. Ava seejärel enda katseplaat viimastest projektidest.
11. Vali avalehe „Välimus“ kaudu kord hele ja kord tume teema ning ava projekt. Oodatav: pinge sisend, sondide nupud, viimase näidu plokk ja mõõtmiste ajalugu on loetavad; juhtväljade raamid eristuvad taustast.
12. Peida navigaator ja omadused, muuda suumi ning sule aken tavaliselt. Käivita EXE uuesti ja ava katseplaat viimastest projektidest. Oodatav: foto, komponendid, mõõtmised ja valitud vaade on alles; uus jalavalik ei ava käsitsi peidetud omadusi. Kirjuta iga sammu tulemus arhitektile.

## Ehitaja suitsukatse (sünteetiline)

2026-11-16 · `codex/m1-3`, HEAD `f16d420`. Kasutati ülal nimetatud katse-EXE-t (SHA-256 `3c7c2ec35042116808fdfdd3da7c3d6b2c0c3752b5bf90a395cb5d4dde28cbce`). See on ehitaja eelkontroll; kasutaja enda suitsukatse ja visuaalne vastuvõtt jäävad eraldi.

Kasutaja sulges enne katset ise varem avatud projekti. Selle sisu ei kasutatud. Uus projekt loodi ainult sünteetilisest EXIF 6 fotost `%TEMP%/bb-m1-3-katse/smoke-20261116/m1311-sunteetiline.jpg`; foto SHA-256 `33afd1c2e74e7d8f2a7f17e4585f31dbe6ce312fab7d9c6b0a4ddd1964c026cf`. Oma katseprojekt on `%TEMP%/bb-m1-3-katse/m1311-sunteetiline.pcbk`. Vana faili katses avati ainult ettevalmistatud TEMP-koopia. Kasutaja päris faile ega fotosid ei avatud.

Sammud 2–11 ja sulgemiseelne kaader tehti 1100 × 700 kliendialas (aknaraamiga 1102 × 731). EXE taaskäivitus avas vaikimisi 1280 × 800 kliendiala; salvestatud lõuendivaade säilis. Tõendid on [suitsukatse kaustas](../../output/playwright/m1-3-11/smoke-20261116/), kokku 43 muutmata JPEG-kuvatõmmist; [loend](../../output/playwright/m1-3-11/smoke-20261116/screenshots.json) sisaldab ajatemplid.

| Samm | Tulemus | Tegelik vaatlus ja kuvatõmmis |
|---|---|---|
| 1. Foto avalehele | Ei läbinud täies mahus: tööriistapiirang | Explorerist BB-sse lohistamise keelas aknajuhtimise tööriist: lõpp-punkt jäi lähteakna piiridest välja. Tegelik lohistus jäi kontrollimata. Sama sünteetilise foto import avalehe failivalijaga läbis: uus plaat ja fail TEMP-is, veata; portree punane märk üleval vasakul ja sinine all paremal. [Import](../../output/playwright/m1-3-11/smoke-20261116/step-01-import.jpg), [terve portree](../../output/playwright/m1-3-11/smoke-20261116/step-02-layout.jpg). |
| 2. Aken, fotojuhikud ja K | Läbis | 1100 × 700; alumine riba ühel real. Läbipaistvus 50%, kontrast 150%, halltoon, pööre ja peegeldus toimisid; taastati 100%/100%/värviline. Suum ja Sobita toimisid. K-ga 712,3 px vahele sisestatud sünteetiline `10,0` mm andis 71,23 px/mm; kursori X/Y olid mm-des. [Riba](../../output/playwright/m1-3-11/smoke-20261116/step-02-layout.jpg), [foto sätted](../../output/playwright/m1-3-11/smoke-20261116/step-02-photo-settings.jpg), [teisendus](../../output/playwright/m1-3-11/smoke-20261116/step-02-rotate-mirror.jpg), [K dialoog](../../output/playwright/m1-3-11/smoke-20261116/step-02-calibration-dialog.jpg), [suum](../../output/playwright/m1-3-11/smoke-20261116/step-02-zoom.jpg), [kursor](../../output/playwright/m1-3-11/smoke-20261116/step-02-cursor-mm.jpg). |
| 3. Navigaator ja pealtvaated | Läbis | 300 px navigaatoris Teek/Komponendid/Mõõtmised ühel real. SOIC-8 ja QFP-44 pealtvaated nähtavad; enne paigutamist valiti uuesti SOIC-8. SOIC-i jala 1 märk oli üleval vasakul, 8 paremal; suurema suumi kinnitus sammus 5. [SOIC-8](../../output/playwright/m1-3-11/smoke-20261116/step-03-soic8-preview.jpg), [QFP-44](../../output/playwright/m1-3-11/smoke-20261116/step-03-qfp44-preview.jpg). |
| 4. Kaks templit ja Escape | Läbis | Kummitusel kere ja 8 padjandit. Kaks klõpsu lõid U1/U2; Escape lõpetas režiimi ja järgnev tühja koha klõps ei loonud kolmandat. [Kummitus](../../output/playwright/m1-3-11/smoke-20261116/step-04-ghost.jpg), [kaks komponenti](../../output/playwright/m1-3-11/smoke-20261116/step-04-two-components-after-escape.jpg). |
| 5. Parema serva jalavalik | Läbis | U1 nihutati paremale, suuminäit 100%. U1.3 ja U1.4 valiti järjest õigesti; naaberpadjandid olid lahus ning O-ga peidetud omadused jäid mõlema valiku ajal peitu. O avas need uuesti. [U1.3](../../output/playwright/m1-3-11/smoke-20261116/step-05-pin3-hidden.jpg), [U1.4](../../output/playwright/m1-3-11/smoke-20261116/step-05-pin4-hidden.jpg), [O avab](../../output/playwright/m1-3-11/smoke-20261116/step-05-o-opens-properties.jpg). |
| 6. Sondipaar ja 4,73 V | Läbis | U2.4 valik + M avas mõõtmise; mustaks valiti U1.4. Sisestus `4,73` salvestus ning viimane näit oli 4,73 V, U2.4 → U1.4. [Nimega sondid ja viimane näit](../../output/playwright/m1-3-11/smoke-20261116/step-06-saved-probe-pair.jpg). |
| 7. Pikk väärtus ja teisendused | Ei läbinud täies mahus | `LONG CONNECTOR VALUE` kinnitati Enteriga. Kõigi 8 teisenduse automaatkaadrid tehti enne käsitsi nihutamist: U2 tähis ja väärtus jäid U2 enda jalgadest välja, 4,73 V ei katnud tähist. [Automaatne 0](../../output/playwright/m1-3-11/smoke-20261116/step-07-auto-0.jpg), [1](../../output/playwright/m1-3-11/smoke-20261116/step-07-auto-1.jpg), [2](../../output/playwright/m1-3-11/smoke-20261116/step-07-auto-2.jpg), [3](../../output/playwright/m1-3-11/smoke-20261116/step-07-auto-3.jpg), [4](../../output/playwright/m1-3-11/smoke-20261116/step-07-auto-4.jpg), [5](../../output/playwright/m1-3-11/smoke-20261116/step-07-auto-5.jpg), [6](../../output/playwright/m1-3-11/smoke-20261116/step-07-auto-6.jpg), [7](../../output/playwright/m1-3-11/smoke-20261116/step-07-auto-7.jpg). Käsitsi lohistatud tähis säilis pööramisel ja pöörde tagasivõtmisel, kuid selle juurde viitejoont ei näinud; sammu viitejoone ootust ei kinnitatud. [Enne](../../output/playwright/m1-3-11/smoke-20261116/step-07-manual-before.jpg), [pööratud](../../output/playwright/m1-3-11/smoke-20261116/step-07-manual-rotated.jpg), [taastatud](../../output/playwright/m1-3-11/smoke-20261116/step-07-manual-restored.jpg). Naaberkomponendi kattumine on kirjeldatud allpool. |
| 8. Korpuse kitsendamine | Läbis | U1 laiendati SOIC-14-ks; U1.12-le salvestati 3,3 V tühja musta sondiga. Kitsendamise dialoog: „Kaovad jalad 9–14: 1 mõõtmine.“ Kinnituse järel oli 3,3 V juures „kontakt kustutatud“, 4,73 V jäi aktiivseks. [Enne](../../output/playwright/m1-3-11/smoke-20261116/step-08-before-shrink.jpg), [dialoog](../../output/playwright/m1-3-11/smoke-20261116/step-08-impact-dialog.jpg), [ajalugu](../../output/playwright/m1-3-11/smoke-20261116/step-08-history.jpg). |
| 9. Ctrl+Z | Läbis | Lõuendil Ctrl+Z taastas 14-jalalise U1 ja 3,3 V aktiivsuse; 4,73 V jäi alles. Ajaloos kaks mõõtmist, kustutatud kontakti märget enam pole. [Taastatud seis](../../output/playwright/m1-3-11/smoke-20261116/step-09-undo-restores-active.jpg). |
| 10. Vana v0.2.0 koopia | Läbis | TEMP-koopia avanes peidetud navigaatori, portreefoto, 73,89 px/mm, R1/U1, U1.3 FB, U1.8 NC ja 4,98 V näiduga. Oma plaat avati seejärel viimaste projektide hulgast. [Esimene vaade](../../output/playwright/m1-3-11/smoke-20261116/step-10-legacy-open.jpg), [portree](../../output/playwright/m1-3-11/smoke-20261116/step-10-legacy-photo-fit.jpg), [FB](../../output/playwright/m1-3-11/smoke-20261116/step-10-legacy-fb.jpg), [NC](../../output/playwright/m1-3-11/smoke-20261116/step-10-legacy-nc.jpg), [oma plaat](../../output/playwright/m1-3-11/smoke-20261116/step-10-returned-own.jpg). |
| 11. Hele ja tume teema | Läbis | Mõlemad valiti avalehe Välimusest. Samal U1.12 mõõtekohal olid sondi juhikud, `3,3` sisend, viimase 3,3 V plokk ja ajalugu loetavad; raamid eristusid taustast. Viimase näidu näitamiseks salvestati kummaski teemas üks ajutine 3,3 V lisamõõtmine ja võeti see lõuendil Ctrl+Z-ga tagasi. Alles jäi kaks algset mõõtmist. [Hele sisend](../../output/playwright/m1-3-11/smoke-20261116/step-11-light-input.jpg), [hele viimane näit](../../output/playwright/m1-3-11/smoke-20261116/step-11-light-last-saved.jpg), [tume sisend](../../output/playwright/m1-3-11/smoke-20261116/step-11-dark-input.jpg), [tume viimane näit](../../output/playwright/m1-3-11/smoke-20261116/step-11-dark-last-saved.jpg). See on visuaalne vaatlus, mitte uus kontrastisuhte mõõtmine. Algne „Süsteemi järgi“ eelistus taastati. |
| 12. Sulgemine ja taasavamine | Läbis | Navigaator peideti N-ga, omadused O-ga, suum muudeti 18%-le. Tavaline Alt+F4 sulges akna; sama EXE taaskäivitati ja oma plaat avati viimastest projektidest. Foto, U1/U2, 3,3/4,73 V, suum ja peidetud paneelid säilisid. Uus U1 jalavalik ei avanud omadusi. [Enne sulgemist](../../output/playwright/m1-3-11/smoke-20261116/step-12-before-close.jpg), [taasavatud](../../output/playwright/m1-3-11/smoke-20261116/step-12-reopened.jpg), [uus jalavalik](../../output/playwright/m1-3-11/smoke-20261116/step-12-new-pin-context-hidden.jpg). |

**Paigutusvaatlused, tootekoodi ei parandatud:** [automaatkaadris 2](../../output/playwright/m1-3-11/smoke-20261116/step-07-auto-2.jpg) ulatub U2 pikk väärtus naaberkomponendi U1 kere ja parempoolsete padjandite peale, [kaadris 5](../../output/playwright/m1-3-11/smoke-20261116/step-07-auto-5.jpg) U1 kere ja vasakpoolsete padjandite peale. U2 enda jalad ning tema tähis ja 4,73 V näit jäävad lahku. Oma jalgade nõue läbis, naaberkomponenti selles paigutuses ei väldita. Lisaks ei näe käsitsi eemale viidud tähise juurde viitejoont üheski kolmest käsitsi nihke kaadrist; see on vaatlus, viitejoone täpne rakendumistingimus vajab arhitekti hinnangut.

**Lõppseis:** katse-EXE suleti lõpus uuesti tavaliselt; [akende lõppkontrollis](../../output/playwright/m1-3-11/smoke-20261116/final-window-check.json) on selle EXE aknaid 0. Pärast sulgemist loeti ainult oma sünteetilise faili salvestatud seisu: [võrdlus](../../output/playwright/m1-3-11/smoke-20261116/persistence-check.json) kinnitab dokumendi, kogu vaate ja fotobaitide võrdsust enne/pärast taasavamist ning `quick_check = ok`. U1-l 14 ja U2-l 8 jalga. Foto originaalblob ja repo `v0.2.0.pcbk` fikstuur säilitasid ülal toodud SHA-256.

Kokku: **10 sammu läbis; sammud 1 ja 7 jäid osaliseks**. Sammuni 1 kuuluv tegelik Explorerist lohistus jäi tööriistapiirangu tõttu kontrollimata, failivalijaga foto import läbis. Sammus 7 läbis oma jalgade vältimine ja käsitsi nihke säilimine, kuid viitejoone ootust ei kinnitatud; naaberkattumine on eraldi kirjeldatud. Tootekoodi ei muudetud, commit'i ega push'i ei tehtud.

Selle dokumendimuudatuse kontrollid: `pnpm format:check`, tööpuu ja põhikausta dokumendikontroll ning mõlema repo `git diff --check` läbisid. Kõik 49 uut kohalikku tõendiviidet on olemas. Sõltumatu kuvatõmmiste ja raporti ülevaatus kinnitas koondi ning piirangute sõnastuse. Varasema ehituse täiskontrolle selles ainult suitsukatse tulemusi lisavas töös ei korratud.
