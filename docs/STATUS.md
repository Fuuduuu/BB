# BB: jooksev seis ja üleandmine

Uuendatud: **2026-11-11**. Hoia see fail lühikese hetkeseisuna, soovitatavalt kuni 80 rida. Varasem ajalugu on Git-is; siia jäävad järgmisele tegijale vajalikud faktid.

## Eesmärk praegu

**Rollid.** Claude on arhitekt ja Codex on ehitaja. [Tööjaotus](07-teekaart.md#rollid)

**M0 on valmis ja avaldatud** (`v0.1.0`). **M1.1 on valmis, kasutaja poolt vastu võetud ja liidetud `main`-i (2026-11-10), väljalase `v0.1.1`** ([plaan](plans/M1-1-louend-ja-mootmine.md), arhitekt kinnitas 2026-11-10): tööpuu `C:/Users/TRUMPIT/.codex/worktrees/bb-m1-1/BB`, haru `codex/m1-1` (pole pushitud). Vastu võetud: M1-1-1…2 (`406b3fa`), M1-1-3…5 (`3e794f9`) ja M1-1-6…9 (`6efa841`). [M1-1-6](tasks/M1-1-6.md) (lõuendi baas) [M1-1-7](tasks/M1-1-7.md) (komponentide kiht) [M1-1-8](tasks/M1-1-8.md) (teek ja paigutus) ja [M1-1-9](tasks/M1-1-9.md) (mõõtmise UI) on **vastu võetud** (`6efa841`; 2026-11-10: `pnpm check` 735/735, `format:check`, `api:check`, `e2e` 8/8).

`main` sisaldab M1.1 liitmist (`8d1df37`) ja versioonitõstu `0.1.1`; silt `v0.1.1` (tag-jooks loob GitHubi Release'i koos `.msi`-ga, tulemus kasutaja kinnitada). Silt `v0.1.0` on commit’il `7dacff8`.

## Mis on olemas

- Toote- ja ehitusdokumendid [01–08](README.md) ning käivitatav veebiprototüüp kaustas `prototype/`.
- [ADR-002](adr/ADR-002-typescript-tauri.md), [ADR-003 v2](adr/ADR-003-frontend-backend.md) ja [ADR-004](adr/ADR-004-kaks-vaadet-ja-uhendused.md) on vastu võetud kasutaja otsusega 2026-11-07.
- Claude on viinud põhidokumendid kehtivate otsustega kooskõlla. Põhjendused, neljanda ringi parandused ja kasutaja otsused: [ülevaatuste otsused](review/2026-11-07-ulevaatuste-otsused.md). Codexi varasem tervikplaan on lähtematerjal, ehituse alus on kehtiv ADR ja arhitekti verstaposti plaan.
- M0 [teostusplaan](plans/M0-vundament.md) ja [ehituse üleandmine](plans/M0-uleandmine.md) kirjeldavad varasema töö ning tehtud kontrollid.
- Ühine AI sisenemine, töö- ja mälureeglid ning oskuste valik: [AGENTS](../AGENTS.md), [WORKFLOW](WORKFLOW.md), [SKILLS](SKILLS.md).
- [BB MCP server](../tools/mcp-bb/README.md) on olemas: ühine Git-i/seisu vaade, dokumentide lugemine ja staatilised kontrollid. Postkasti kirjutamine on eraldi kasutaja tellitud tegevus.

## Pooleliolev töö ja järgmine samm

- **M0-15** on vastu võetud (2026-11-10, `2f140f2`, juba `main`-is). Märkus: taastamise VFS-kaitse on kirjeldatud 03 §9-s; `storage/backup.rs` (419 rida) jagatakse M1 hoolduskaardis.
- **M1.2 on käimas.** [Plaan](plans/M1-2-foto-ja-kalibreerimine.md) on kinnitatud (kasutaja 2026-11-11: O1 Rusti teegid `image` + `kamadak-exif` jah, O2 veebi fotod jah; O3 otsustatakse Ül. 9-s). [M1-2-1](tasks/M1-2-1.md) (`file_id`, varukoopiad faili kaupa, päästekoopia märge) on **vastu võetud** (`88fdb10`) harus `codex/m1-2` (tööpuu `C:/Users/TRUMPIT/.codex/worktrees/bb-m1-2/BB`; 789/789, Rust 60/60, e2e 15/15). [M1-2-2](tasks/M1-2-2.md) (foto import Rustis ja veebis, `pcbk://photo`, EXIF, ≤ 12 MP kuvamisvariant; rada B) on üle vaadatud (**sobib**, 815/815, Rust 81/81) ja **vastu võetud** (`61e6cfd`) harus `codex/m1-2`. [M1-2-3](tasks/M1-2-3.md) (moodul `photo` mootoris, tööpind fotost; rada A) on üle vaadatud (**sobib**, 861/861, Rust 81/81) ja **vastu võetud** (`b37407d`). [M1-2-4](tasks/M1-2-4.md) (fotokiht ja stseen kõigi 8 teisendusega; rada A) on üle vaadatud (**sobib**, 905/905, veebitestid 10× rohelised) ja **vastu võetud** (`682dd34`); [M1-2-4b](tasks/M1-2-4b.md) (alumine riba, `ViewState.modules`; rada A) on üle vaadatud (**sobib**, 957/957, Rust 81/81) ja **vastu võetud** (`f9016b5`). [M1-2-5](tasks/M1-2-5.md) (kalibreerimistööriist `K`; rada A) on ehitamiseks samas harus.
- **M1.1 on vastu võetud ja liidetud** (kasutaja suitsukontroll 11/11, 2026-11-10; liidetud `main`-is `pnpm check` sammud 739/739 (lint ilma kohaliku `.claude/worktrees` kaustata), e2e 15/15; Rust 53/53 identse koodiga harus). Järgmine: M1 hoolduskaart (enne M1.2) ja M1.2 plaan (arhitekt). Lahtised M2.1-le: klõps rühma liikmel jätab rühma valituks, jala valik näitab ühte jalga komponendi kohta; nooled ja `R`/`F` toimivad ka külgpaneeli fookusega. M1.2-le: näidu sildi suund peegeldatud stseenis. Hoolduskaardile: ESLint peab ignoreerima `.claude/worktrees/` (teise seansi tööpuu põhikaustas murrab `pnpm check`-i).
- **Avaldamine.** `main` ja silt `v0.1.1` pushitud 2026-11-10; haru `codex/m1-1` on liidetud (eraldi pushimata). Koodiallkirjastamine ootab kasutaja otsust.
- `v0.1.0` faili ühilduvus on M1-H-1 testidega tõendatud; enne M1.2 jääb mõõta SVG jõudlust päris Tauri aknas.
- **M1 hooldus on valmis ja liidetud `main`-i** (`1e5108b`): [M1-H-1](tasks/M1-H-1.md) failivormingu valvur, näidisfail, `internal`; [M1-H-2](tasks/M1-H-2.md) salvestusvea dialoogid, `stale_rev`, veebi `discard`; [M1-H-3](tasks/M1-H-3.md) `backup.rs` jagamine, domeeni alamteed, katvus. `main`-is `pnpm check` 773/773. Pushimata. Invariantide kiirendus (A3) pärast M1.2 jõudlusproovi.
- GitHub CLI oli üleandmisel kontole sisse logimata. CI jooksud ja väljalaske avaldamine on eraldi kohalikest kontrollidest.

## Arenduskeskkond

- Node.js **26.13.0** ja npm **11.20.0** olid olemas. Paigaldatud Corepack **0.36.0** ning pnpm **12.18.0**; M0 lukustab projekti täpse versiooni.
- Paigaldatud Rust/Cargo **1.99.1**, host `stable-x86_64-pc-windows-msvc`, koos `rustfmt`-i ja `clippy`-ga. Olemas C++ Build Tools 2022, Windows SDK **10.0.26100.0** ja WebView2 **157.0.4341.42**.
- Paigaldatud eraldi Python **3.13.17**. Codexi `bb` server osutab nüüd sellele Pythonile; senisest seadistusest tehti varukoopia. Muud MCP seaded ja õigused säilisid.
- Paigaldatud Playwright CLI **0.1.23** ja Playwright **1.65.0** Chromium. Projekti tööriistade versioonid on lukustatud `m0` tööpuu `pnpm-lock.yaml`-is.
- `playwright` ja `gh-fix-ci` oskused paigaldatud Codexile. Superpowers, GitHub ja brauseri/arvuti tööriistad olemas; täpne valik [SKILLS-is](SKILLS.md).

## Viimased kontrollid

- 2026-11-09 M1.1 ülesanded 1–2. `pnpm api`, `pnpm check` (**515/515**), `pnpm format:check` ja `pnpm api:check` läbisid enne koondcommiti. Genereeritud domeeni API ülevaade andis 662 rea pikkuse hoiatuse.

- 2026-11-09 M0-15 varasemad kontrollid. `cargo test --locked --offline` 53/53, `pnpm check` 495/495, vormindus, API ja töölaua Clippy läbisid. Sünteetiline 40 katsega Windowsi kordus ja puhta taaste kirjutuskatse läbisid.

- 2026-11-09 taastamiskaardi ja M1.1 kavandi kontroll. `bb_task M0-15` avab kaardi koos kahe viidatud jaotisega. `bb_check_docs` ja `git diff --check` läbisid.

- 2026-11-09 arhitekti ülevaatus `7dacff8` koodil. `pnpm check` 493/493 testi ja 0 sõltuvusrikkumist, `pnpm format:check` läbis, Chromiumi e2e 8/8, `cargo test --locked --offline` 46/46, Rusti vormindus ja Clippy `desktop` läbisid. Sünteetiline Windowsi taastekatse kinnitas olemasoleva faili ülekirjutamise.

- 2026-11-09: `pnpm.cmd check` **463/463 testi 43 failis**, mõlemad TS kontrollid, ESLint, sõltuvused (162 moodulit/519 seost) ja failipikkus läbisid. E2E **8/8**, paneeli kordus **5/5**; sõltumatu sihitud ülevaatus **134/134**, uusi leide pole. Tootmisjärgu veebiehitus, vormindus, lukustatud võrguühenduseta paigaldus ja diff-kontroll läbisid.

- 2026-11-08 kell 22:42: `pnpm.cmd check` läbis **373/373 testi 38 failis**, mõlemad TS kontrollid, ESLint, sõltuvused (156 moodulit/501 seost) ja failipikkus. `pnpm.cmd e2e` **6/6**, veebirakenduse tootmisjärgu ehitus läbis. Sõltumatu paranduste ülevaatus 43/43 puhas. Brauseris hele/tume/1100 × 700, 0 viga/hoiatust ja väliseid päringuid pole.

- 2026-11-08 kell 18:50: `pnpm.cmd check` läbis kõik väravad ja **319/319 testi 33 failis**; UI 40 testi jsdom'is, backend Node'is. Mõlemad TS kontrollid, ESLint, sõltuvused (121 moodulit/379 seost) ja failipikkus läbisid. Sõltumatu lõppülevaatus: 40/40, uusi leide pole. Vormindus ja lukustatud võrguühenduseta paigaldus läbisid.
- 2026-11-08 kell 18:15: `pnpm.cmd check` läbis kõik väravad ja **279/279 testi 27 failis**. Mõlemad TS kontrollid, ESLint, sõltuvused (88 moodulit/270 seost) ja failipikkus läbisid. Kliendi 17 testi on jsdom'is; backend-testid jäävad Node'i. Ülevaataja käivitas klienditestid eraldi 17/17. Päris äpi visuaalset vastuvõttu pole tehtud.
- 2026-11-07: Tauri CLI **2.12.4** keskkonnakontroll korras; värske PowerShell leiab Node'i, pnpm-i, Rusti ja eraldi Pythoni. VBScripti käivituskontroll läbis.
- Repo välises sünteetilises Rusti/SQLite'i proovis läbisid `cargo test --locked` (1 test), `cargo fmt --check` ja `cargo clippy --all-targets -- -D warnings`. See kontrollis ka kaasapakitud SQLite'i C-koodi kompileerimist MSVC-ga; ei ole BB rakenduse test.
- Codexi seadistusloendis on `bb` lubatud. Selle kontrollvestluse otseses tööriistaloendis BB kutseid veel polnud; iga järgmine AI kontrollib kättesaadavust oma seansis.
- 2026-11-07: Claude Code'i seansis on BB MCP tööriistad olemas. `bb_status` ja `bb_check_docs` andsid edukad vastused, nii et Claude'i ühendus `.mcp.json` kaudu töötab.
- 2026-11-08, ülesande 7 lõpus: BB dokumentide kontrollfunktsioon läbis põhikaustas (25 faili) ja `m0` tööpuus (26 faili); probleeme pole. Vormindus, lukustatud paigaldus ja `git diff --check` läbisid; ülesande diff on 12 faili, kuus stardifaili on commit'ist väljas, HEAD `983e9c6`.
- Gemini CLI käivitamine on kontrollitud: `0.67.0` nii otse paigaldatud Node'iga kui värskes Windows PowerShellis käsuga `gemini.cmd --version`. Windowsi salvestatud PATH sisaldab Node'i ja npm-i; olemasoleva protsessi keskkond võib olla vananenud. Uut paigaldust ei tehtud.
- Gemini `mcp list` leiab BB seadistuse, kuid näitab serverit keelatuna, sest BB kaust pole Gemini jaoks veel usaldatud. Kausta usaldamine ja Google'i sisselogimine jäävad kasutajale; Gemini kaudu serveri ühendust pole veel kinnitatud.

## M0 lõppülevaatuse ja väljalaske ajalugu (2026-11-09)
- **Tõendatud:** CI `checks` roheline GitHubis (483 testi, e2e, Rust 46); sõltuvusreegel ja mootori Node-testid (`tooling/depcruise.test.ts`); `base_rev`, tapetud kirjutaja, teise protsessi lukk, taastamine Rustis (`save_rejects_wrong_base_rev`, `killed_writer_leaves_consistent_file`, `second_process_cannot_open_locked_file`, `restore_full_and_doc_backup_into_new_file`); omandi/invariandi kontroll ilma dev-only haruta (`NODE_ENV`/`import.meta.env` mootoris ja domeenis puuduvad); migratsioonieelne koopia; `.msi` kohalik ehitus ja paigaldus/eemaldus (kasutaja).
- **AUK:** 07 › M0 tingimus „Taastamine avalehelt uude faili on läbi proovitud“ ei ole täidetud. `StartScreen.tsx` „Taasta varukoopiast…“ nupp on alati `disabled` (tekst „saadaval töölauarakenduses“), ka töölaual. Rust (`project_restore`), `ProjectService.restore` ja `storage-tauri.restore` on olemas ja testitud, kuid UI-d, mis loetleb varukoopiad (`project_backups`), laseb valida ühe ja uue faili tee ning kutsub `restore`-i, pole. Vajab kaarti M0-14.
- **Avatud (tõend puudub):** CI `installer` töö pole kunagi jooksnud (jookseb ainult `main`/`v*`); `.pcbk` topeltklõps ja teise käivituse akna ettetoomine päris süsteemis; kasutuskatse täisjada paigaldatud äpis.
- **Mitteblokeerivad:** versioon `0.0.0` → `0.1.0` enne esimest silti; `.msi` allkirjastamata; `SaveStatus` ei erista `stale_rev`-i (M1); `validateDocument` täis-Zod igal käsul (M1 jõudlus).
- **M0-14 (2026-11-09):** taastamine avalehelt on teostatud (`ProjectService.backups({ projectId })`, `RestoreDialog`), arhitekt: **sobib**, commit ootab kasutaja luba. Ehitaja päris Windowsi aknas: taastamine olemasolevalt ja puuduvalt kaardilt andis avatud projekti koos `R1`-ga. Eelmise lõppülevaatuse AUK on sellega suletud; M0 jääb avatuks vaid kolmes tõendamata kohas (`installer`-töö GitHubis, `.pcbk` topeltklõps, kasutuskatse).
- **Kasutaja suitsukontroll (2026-11-09, `e75e7ac`, kõik 21 sammu „all pass“):** põhijada, undo/redo, valiku puhastus, salvestus ja sulgemine, kirjutuskaitse + „Salvesta mujale…“, taastamine avalehelt (olemasolev ja puuduv fail, tühistamine), `.pcbk` topeltklõps ja üks eksemplar (variant B), diagnostika, eemaldus. Seega on suletud ka `.pcbk` topeltklõpsu ja kasutuskatse tõendamata kohad. **M0 on tehniliselt valmis**; jääb `installer`-töö esimene jooks GitHubis (alles `main`-il), versioon `0.0.0` → `0.1.0` ja otsus kuue stardifaili commitimise kohta.
- **`main` CI (2026-11-09, `7fc9e32`, jooks #6):** `checks` ✔ (6 m 16 s), `installer` ✔ (11 m 24 s, 1 artefakt `pcbk-msi`), `release` vahele jäetud (ootuspäraselt, silti pole). **M0 on valmis**: kõik teekaardi „valmis kui“ tingimused on tõendatud. Järgmine: versioon `0.0.0` → `0.1.0`, otsus stardifailide kohta, esimene silt `v0.1.0` (kontrollib `release`-tööd), seejärel M1 plaan (arhitekt).
- **Väljalase 0.1.0 (2026-11-09):** `tauri.conf.json` versioon `0.1.0` (`9d850cc` harus `main`), silt `v0.1.0` pushitud. Tag-jooks (`checks` → `installer` → `release`) ootab; `release` loob GitHubi Release'i ja lisab `.msi`. Tulemus kasutaja kinnitada.
- **Väljalaske parandus (2026-11-09):** tag-jooksu `checks` kukkus tooling-testi ajalimiidi tõttu; commit `7dacff8` annab kõigile `tooling/*.test.ts` failidele 60 s faili-taseme limiidi. `main` kiirühendatud `7dacff8`-ni, silt `v0.1.0` tõsteti (force) sellele commitile (Release'i polnud loodud). Uus tag-jooks ootab kinnitust.
- **Release `v0.1.0` loodud (2026-11-09, kasutaja kinnitusel):** tag-jooks `checks` → `installer` → `release` läbis, GitHubi Release on olemas koos `.msi`-ga. **M0 on avaldatud.** Järgmine: M1 teostusplaan (arhitekt); otsus kuue stardifaili commitimise kohta; koodiallkirjastamine enne laiemat jagamist.
- **Teekaardi parandused Gemini ülevaatuse järel (2026-11-09, kasutaja kinnitas):** M2 jaotatud M2.1 (ühendused ja võrgud plaadil), M2.2 (piiks ja ühenduse tase), M2.3 (skeem, sümbolid kõigile `ComponentKind` tüüpidele); `textNotes` M2-st M4-sse (omanik `dimensions`); korpuste teek ainult M1.3, M4 duplikaat eemaldatud; paremklõpsu menüü baas M1.4, `Ctrl+K` M3, Näidisprojekt M4; `tooling/fixtures` generaator M1.2; v1.0 allkirjastamine tingimuslik (kasutaja otsus A2). M1.1 plaan: stseeniteisendus ja tekstide vastuteisendus lõuendi baasis (otsus 9). Prototüübi import jääb M4-sse. `.msi` on juba võrguühenduseta (`offlineInstaller`).
- **Teekaardi täiendus Fable ülevaatuse järel (2026-11-10, kasutaja kinnitas):** ajastatud raam-/mitmikvalik (M2.1), punktkomponendid (M1.3), foto lohistamine avalehele, `file_id`, PNG-ekspordi proov ja suitsukontrolli otsus (M1.2), kiirklahvide abi (M3), seadete vaade (M4.1), uuema faili vaatamine (M4.2), pisipilt ja edenemisriba (M4.3), manused (Hiljem). M2.3 jagatud M2.3 (sümbolid, algab lõuendi taaskasutuse prooviga) ja M2.4 (juhtmed, sildid); M4 jagatud M4.1–M4.3; jõudlustingimus lisatud M2.1-le ja M2.3-le.
