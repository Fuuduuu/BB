# M1.4 üleandmine ja kasutaja suitsukatse

Tööpuu `C:/Users/TRUMPIT/.codex/worktrees/bb-m1-4/BB`, haru `codex/m1-4`, alus `ea60389`. Ehitaja katsed kasutasid sünteetilisi faile. Kaug-CI ja kasutaja suitsukatse on eraldi kontrollid.

## Vastuvõtt

| Tingimus | Tõend |
|---|---|
| 02 § 16 sammud 1–5 | E2E `full_flow_steps_1_to_5`. Sünteetiline foto lohistati avalehele, 76 mm andis 10 px/mm lubatud vahemikus ning taasavamisel säilisid komponendid, kalibreering, joondus, suurus, nimed ja oma jalg. Test kasutab kaardil täpsustatud `R` ja `Shift+R` klahve. |
| Kahe jala joondus taastab asendi alla 0,01 px ja nurga alla 0,01° veaga | M1-4-6 `345791a`. Võrdlustest `align_by_two_pins_restores_known_pose_within_0_01px_and_0_01deg` ja läbiv E2E. |
| Jõudluseelarve on täidetud | Allolevad kolm Tauri jooksu. E2E `perf_board_pan_and_zoom_do_not_rerender_layers` ning `perf_board_drag_rerenders_only_dragged_component` kaitsevad žestifaasi DOM-i käitumist. |
| Paremklõps komponendil, jalal ja tühjal alal ning sulgemine `Esc`-ga | M1-4-9 `d909fe9`. TS `context_menu_items_run_same_commands_as_keys`, `escape_closes_menu_without_change`, `shift_f10_opens_menu_for_selection` ja `empty_area_menu_places_component_here`. |
| Suurus käepidemetega ja numbritega | M1-4-5 `8f3d54f` ja läbiv E2E. |
| Oma jalg ja kohandatud korpus | M1-4-7 `d275566`, M1-4-8 `dc124bf` ja läbiv E2E. |
| Vana `v0.3.0` fail avaneb | Rust `old_files_open_and_get_file_id_on_first_writable_open` ja `v0_3_0_label_probes_and_scale_survive_open`. Vt allolevat ühilduvustabelit. |
| Faili ja diagnostika rakenduse versioon | TS `app_version_has_one_source` võrdleb `Cargo.toml`-i, lukku ning veebi, töölaua ja Vitesti Vite konstandi väärtust. Veebisalvestuse test kontrollib uue faili metaandmeid. |

## CI otsus 0

Commit’i `ea60389` katvusega jooksus aegus `home_photo_import_disables_workspace_and_queues_second_drop` pealkirja `Second` oodates. DOM-is oli endiselt `First`, töölaud oli hõivatud ja esimene projekt salvestatud. Kontrollitud viivitus teise projekti loomisel kordas sama olukorda. Viivituse vabastamisel jõudis teise foto import lõpuni. See eristab testi ajastusviga foto kadumisest. [GitHubi jooks 44381408072](https://github.com/Fuuduuu/BB/actions/runs/44381408072)

Test ootab nüüd esimese dekodeerimise algust ja teise foto jõudmist mootori dokumenti. Mõlema verstaposti järel loputab asünkroonne `act` Reacti uuendused. Seejärel kontrollib test pealkirju ja töölauda. Ajapiirid ja tootekood säilisid. Moodulitaseme siluettide arvutus toimub enne testikeha. Selle seost aegumisega ei kinnitatud. Kontrollitud RED ja GREEN ning kolm 10/10 sihitud katvusega jooksu on kaustas `C:/Users/TRUMPIT/.codex/worktrees/bb-m1-4/BB/output/playwright/m1-4-11`.

## Automaatsed ja võrdlustõendid

- Põhikausta `pnpm bb-review-card M1-4-11` läbis. Vitest 1591/1591, Playwright 42/42 ja Rust 96/96. Kõik kuus kaardi tõendustesti ning katvus, API, vorming ja diff läbisid. Koond ja logid `C:/Users/TRUMPIT/Desktop/BB/output/review-card/M1-4-11-u7X5gI`.
- `pnpm tauri build --debug` ehitas Windowsi EXE ja `PCB Kaardistaja_0.3.0_x64_et-EE.msi`. `cargo fmt --check` läbis. Failipikkuse kontrollis on `old_files.rs` 445 rea hoiatus.
- Tööpuu dokumendikontrollis on kuus varasemat puuduvat M1.3 output-viidet. Leiud on failis `C:/Users/TRUMPIT/.codex/worktrees/bb-m1-4/BB/output/playwright/m1-4-11/worktree-docs-check.log`.
- Põhikausta `pnpm proof M1-3-10` läbis 4/4. Mõlemas teemas oli automaatse tähise ja näidu kattuvus 0 px². Logid `C:/Users/TRUMPIT/Desktop/BB/output/playwright/proof/M1-3-10-esH2mK`.
- M1-4-10 `ObstacleGrid` on eraldi failis. Enne ja pärast tõstmist läbisid sama ruudustiku ja sildipaigutuse kontrollid.

## Tauri jõudlus

Kolm kehtivat jooksu kasutasid sama sünteetilist generaatorit seemnega 127. Proovis oli 300 komponenti, 3000 jalga, 1500 mõõtmist, 12 MP foto ja 1280 × 800 Tauri kliendiala. IPC aegu mõõdeti pärast žeste sama faili avamisel ja täisdokumendi salvestamisel käsu väljakutsest vastuseni.

| Mõõt | M1-2-7 | M1-4-11 mediaan | Eelarve või märkus |
|---|---:|---:|---|
| Töölaud ja foto valmis | 590 ms | 714,5 ms | < 1500 ms |
| Panoraam | 49,8 fps | 59,3 fps | ≥ 57 fps |
| Rattasuum | 7,5 fps | 60,0 fps | ≥ 57 fps |
| Komponendi lohistus | 22,3 fps | 50,7 fps | ≥ 45 fps |
| Suumi rahunemise pikim kaader | — | 50,0 ms | 1000 ms vaatlus |
| `project_open` | — | 81,0 ms | Suurim 81,5 ms |
| `project_save` | — | 56,8 ms | Suurim 56,9 ms |
| Žestifaasi skriptiaeg ühe rattasündmuse kohta | 35 ms | Mõõtmata | Tauri proov kogub kaadriaegu. Rattasündmuse JS-aega selles jooksus ei profileeritud. |

Canvas-üleminekut M1.4-s ei tehta. Kolme jooksu lähteandmed ja arvutus on `C:/Users/TRUMPIT/.codex/worktrees/bb-m1-4/BB/output/playwright/m1-4-11/native-acceptance-summary.json`. Brauseri DOM-valvuri avamisajad ja kaadriarvud on testi märkustes.

## Vastu võetud ehituskaardid

| Kaart | Commit | Tulemus |
|---|---|---|
| M1-4-1 | `09383e4` | Bitmap-teisendus žesti ajal |
| M1-4-1b | `d126c09` | Paneelid väldivad vaatemuutuse taasrenderdust |
| M1-4-H | `7fb0de2` | Vormingu kaitse, kettavead ja pinge sisestus |
| M1-4-2 | — | Tingimuslik. Kordusmõõtmine läbis eelarve. |
| M1-4-3 | `9f25688` | Lohistuse eelvaade nihutab liigutatavat gruppi |
| M1-4-3b | `dde0424` | Suumi rahunemine |
| M1-4-4 | M1-4-11 | Kordusmõõtmine ja brauseri DOM-valvurid |
| M1-4-5 | `8f3d54f` | Suurus käepidemete ja numbritega |
| M1-4-6 | `345791a` | Joondus kahe jalaga |
| M1-4-7 | `d275566` | Oma jalad |
| M1-4-8 | `dc124bf` | Kohandatud korpus |
| M1-4-9 | `d909fe9` | Kontekstimenüü |
| M1-4-9b | `8193de7` | Loendi eelvaade, päise tähis ja näidu asukoht |
| M1-4-10 | `ea60389` | Sildi külje valik ja teegi siluetid |
| M1-4-11 | `bbb0920` | Vastuvõtutõendid, versioon ühest allikast ja suitsukatse |

## Ühilduvusfailid

Rusti testid avavad ajutisi koopiaid. `file_id` tekib kirjutataval avamisel, kui see puudub. Olemasolev tunnus, sealhulgas v0.3.0 näidisfaili UUID-v4, säilib.

| Repos olev fail | Lähteversioon | SHA-256 |
|---|---|---|
| `tests/fixtures/v0.1.0.pcbk` | Sünteetiline M0 näidis | `b9f9535bde765a9affe23d5ad8eea3a11af40323b5ce199b3877519c382e8d9f` |
| `tests/fixtures/v0.1.1.pcbk` | v0.1.1 kasutajaliides | `caef9d0ac7d3deaad032522527f6556aea04fe637355b82520206f7922a36a65` |
| `tests/fixtures/v0.2.0.pcbk` | v0.2.0 kasutajaliides `3735a4b` | `7c5ffa0662ad1927a7c990f41bbbc9924fd0768d7fa8e6cd994a23cb238b6177` |
| `tests/fixtures/v0.3.0.pcbk` | v0.3.0 kasutajaliides `a995825` | `c7835130797a17e8d6c10b3044bdfd535026a4393cdaab12a2d37bff19871eb0` |

v0.3.0 debug-rakenduse ajutine ümbris suunas projekti loomise `%TEMP%/bb030-m1411/v0.3.0-ui-orig.pcbk` faili. Kasutajaliidesest salvestati EXIF 6 foto, `rot90` vaade, 4,025256739675138 px/mm kalibreering, SOIC-8 U1 ja R1, U1.8 nimi VCC ja U1.7 NC. U1 tähis lohistati käsitsi. Näit 4,98 V salvestati punase sondiga U1.8 ja musta sondiga R1.1. Navigaator peideti ning salvestati 457% suum.

Foto originaal on 162 457 baiti ja SHA-256 on `33afd1c2e74e7d8f2a7f17e4585f31dbe6ce312fab7d9c6b0a4ddd1964c026cf`. Avamine säilitab algfaili ja originaalblobi baidid. Näidisfaili ajalooline `app_version` on `0.0.0`, mis oli sildi Cargo versioon. Selle sildi Tauri väljalaske versioon oli `0.3.0`. Ümbrise diff, kasutajaliidese kuvatõmmis ja koostise tõend on `C:/Users/TRUMPIT/.codex/worktrees/bb-m1-4/BB/output/playwright/m1-4-11` failides `v030-*`. Vana rakenduse viimaste projektide loendisse lisandus selle sünteetilise faili kirje.

## Teadaolevad piirid

- Dubleerimine ja `Ctrl+D` kuuluvad M2-sse.
- Automaatne silt väldib keret ja padjandeid. Sildid võivad omavahel kattuda.
- Mitmikvaliku pööramine, poolevahetus ja paigutuse eemaldamine kasutavad üht ajaloosammu komponendi kohta.
- Pärast oma jalgadega komponendi paigutuse eemaldamist jäävad jalad alles. Senise tavakorpuse ja lisajalgade arv ei klapi. Paigutuse saab taastada `Ctrl+Z`-ga või valida „Ala“.
- Edasised tööd: [Mis jääb järgmistesse plaanidesse](M1-4-suurus-joondus-joudlus.md#mis-jääb-järgmistesse-plaanidesse).

## Kasutaja suitsukatse

Staatus: **läbis 2026-11-19**. Kasutaja tegi kõik 12 sammu oma tiheda plaadi fotoga, kaasa arvatud järgmise päeva taasavamise; paneelide mõõtude kohta märkusi ei tulnud. Väljalase `v0.4.0` (liidetud `7e37c59`). Katse-EXE on `%TEMP%/bb-m1-4-katse/pcbk-m1-4-11-katse.exe`, SHA-256 `a9662d8ee14d6282d78d504afc1e7e2b4dfe1789e7bc704ae1f8e14b3a9dfc76`. Uue projekti ja „Salvesta mujale…“ vaikimisi kaust on `%TEMP%/bb-m1-4-katse`. Vana faili katsel kasuta `%TEMP%/bb-m1-4-katse/v0.3.0-suitsukatse.pcbk` koopiat.

Ehitaja käivitas kopeeritud EXE ja lõi sünteetilise projekti. Fail tekkis ettenähtud kausta ning selle `app_version` oli `0.3.0`. „Salvesta mujale…“ vaikekataloogi kontrolliti ümbrise koodist. Ehitaja katses ei olnud salvestusviga, mis avaks selle dialoogi. Tõend on `C:/Users/TRUMPIT/.codex/worktrees/bb-m1-4/BB/output/playwright/m1-4-11/smoke-exe-proof.json`.

1. Käivita katse-EXE ja lohista oma tiheda plaadi foto avalehele. Näed uut projekti ja õiges suunas fotot. Projekt salvestub TEMP-kausta.
2. Liiguta vaadet, suumi mitmes astmes ja lohista üht komponenti. Plaat liigub sujuvalt ja suumi lõppedes ilmuvad uue suumi detailsusega jalad ning sildid.
3. Kalibreeri `K`-ga teadaolev vahe. Kontrolli, kas mõõtkava ja millimeetrites kursori asukoht vastavad fotole.
4. Paiguta SOIC-8 ja joonda kahe fotojalaga `A` abil. Muuda suurust nurga- ja külgkäepidemega. Proovi `R` ning `Shift+R`. Jalgade asukohad langevad fotoga kokku ja pöörded on vastassuunalised.
5. Lisa samale komponendile `J`-ga oma jalg. Padjand ilmub klõpsukohta ning jala nimeväli on kättesaadav. Üks `Ctrl+Z` eemaldab selle jala. Lisa jalg uuesti.
6. Ava teegis „Kohandatud“. Vali „4 külge“ ja 12 jalga, vaata eelvaadet ning paiguta. Igal küljel on kolm padjandit. Proovi ka tühja paigutust ja lisa sellele `J`-ga jalg.
7. Ava komponendi või jala menüü paremklõpsuga ja komponendi menüü `Shift+F10`-ga. Näed sihiga sobivaid toiminguid. `Esc` sulgeb menüü ning senine valik säilib.
8. Liigu hiirega üle komponentide loendi rea. Plaadil tõstetakse õige objekt esile. Vali jalg. Omaduste päis näitab selle jala täpset tähist.
9. Lisa komponendile pikk väärtus tihedas kohas. Vaba külje olemasolul jääb tekst naabri padjanditest eemale. Kitsas teegis kontrolli, kas QFP siluett on äratuntav. Pane tähele fonte, nuppe ja vahesid ning kirjuta sobimatud mõõdud M2 märkmetesse.
10. Ava v0.3.0 suitsukatse koopia. Näed portreefotot, mõõtkava, U1 VCC- ja NC-jalga, nihutatud tähist ning 4,98 V näitu koos sondidega. Naase seejärel oma katseprojekti.
11. Vali üks must sond ja salvesta sama musta sondiga kolme eri jala pinged. Veendu, et iga näidu juures saab tuvastada punase jala ja ühise võrdluspunkti. Sule projekt tavaliselt.
12. Ava projekt järgmisel päeval. Vasta kuvatud näitude ja ajaloo põhjal küsimusele „Mida ma mõõtsin ja mille suhtes?“ Kirjuta arhitektile, kas vastus oli vahetult loetav, ning lisa paneelide mõõtude märkmed.
