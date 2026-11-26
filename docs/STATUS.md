# BB: jooksev seis ja üleandmine

Uuendatud: **2026-11-26**. See fail on lühike hetkeseis, kuni 80 rida. Ajalugu on Git-is, kaartidel ja verstapostide üleandmistes ([docs/README](README.md)). Kontrolli väiteid Git-i vastu.

## Rollid

Claude on arhitekt ja Codex on ehitaja; tööriistu ehitab ka Astra põhikaustas (`tooling/`). [Tööjaotus](07-teekaart.md#rollid) ja [töövõte](WORKFLOW.md).

## Avaldatud

| Versioon | Verstapost | Kuupäev | Märkus |
|---|---|---|---|
| `v0.6.0` | M2.2 piiksumisrežiim ja ühenduse tase | 2026-11-24 | liidetud `3b5a65c`, silt `v0.6.0`; viis jõudluspiiri aktsepteeris kasutaja; kasutaja katse oma fotoga andis tagasiside suuruste ja korpuste graafika kohta, piiksu samme ja kasutuskatset ei raporteeritud |
| `v0.5.0` | M2.1 ühendused ja võrgud plaadil | 2026-11-20 | liidetud `92f001c`, silt `v0.5.0`; Astra sõltumatu ülevaatuse parandused M2-1-12–14; kasutaja suitsukatsed 12/12 ja 6/6 oma plaadi fotoga |
| `v0.4.0` | M1.4 suurus, joondus, oma jalad ja jõudlus | 2026-11-19 | liidetud `7e37c59`, silt `v0.4.0`; kasutaja suitsukatse 12/12 oma tiheda plaadi fotoga |
| `v0.3.0` | M1.3 tööpind, valik, korpuste teek | 2026-11-17 | liidetud `6fa7a85`, silt `a995825`; kasutaja oma fotoga kontroll jäi vahele, ehitaja sünteetiline suitsukatse 10/12 |
| `v0.2.0` | M1.2 foto ja kalibreerimine | 2026-11-14 | |
| `v0.1.1` | M1.1 komponent fotol ja mõõtmine | 2026-11-10 | |
| `v0.1.0` | M0 vundament | 2026-11-09 | |

Iga verstaposti tõendid on teekaardi olekureal ([07](07-teekaart.md)) ja plaani vastuvõtutabelis.

## Järgmine: M2.2b korpuste kuju ja mõõtkava

- M2.2 on liidetud `main`-i `3b5a65c` (2026-11-24), versioon 0.6.0 `b7ecf03`, silt `v0.6.0`. Kaardid [M2-2-1](tasks/M2-2-1.md)–[M2-2-11](tasks/M2-2-11.md), jõudlus (viis piiri aktsepteeris kasutaja), ühilduvus ja kasutaja katse on [M2.2 üleandmises](plans/M2-2-uleandmine.md). Astra [M2.2 ülevaatuse](review/2026-11-21-m2-2-ulevaatus-5f4ffae.md) leiud 01–12 on parandatud.
- Kasutaja katse 2026-11-24 oma plaadi fotoga: suurused polnud reaalsed (kalibreerimine 30 mm üle kogu foto laiuse, dialoog ei näita foto suurust millimeetrites) ja korpuste graafika on kehv ning segane (iga korpus on ristkülik, polaarsust, triipu ega sälku pole). Kasutaja otsus: avalda `v0.6.0`, siis graafika. [M2.2b plaan](plans/M2-2b-korpused-ja-mootkava.md) on kinnitatud (2026-11-25, O1–O5): kalibreerimisaken, mõõtkava korpusest, korpuste kuju ja polaarsus, väljalase `v0.7.0`. Esimene kaart [M2-2b-1](tasks/M2-2b-1.md), kalibreerimisakna eelvaade ja kiirvalikud, on vastu võetud `4633242` (2026-11-25). [M2-2b-2](tasks/M2-2b-2.md), mõõtkava korpuse joondusest (rada B), on vastu võetud `0b8fde1` (2026-11-25). [M2-2b-3](tasks/M2-2b-3.md), korpuste kuju ja teegi eelvaade (rada A), on vastu võetud `b47d346` (2026-11-25). [M2-2b-4](tasks/M2-2b-4.md), polaarsuse ja suuna märgid (rada A), on vastu võetud `ff45a26` (2026-11-25). [M2-2b-5](tasks/M2-2b-5.md), vastuvõtt, jõudlus ja kasutaja suitsukatse, on vastu võetud `2eb1a1c` (2026-11-25); raja B täisring ja neli Tauri jõudluspiiri läbisid. Kasutaja vastas suitsukatse järel „korras“ (2026-11-25; 50 jala aega ei raporteeritud). Astra audit tipul `2eb1a1c` ([ülevaatus ja triaaž](review/2026-11-25-m2-2b-ulevaatus-2eb1a1c.md)) leidis 15 viga (5 P1) ja peatas liitmise. Parandused on plaani Osa D ül. 6–7 (rada B), kasutaja kinnitas need 2026-11-26. [M2-2b-6](tasks/M2-2b-6.md), ühine jalavalik ja klahvifookus (leiud 01, 03, 05), on vastu võetud `2a083fa` (2026-11-26); raja B täisring läbis. Järgmine on kaart M2-2b-7 (leiud 02, 04, 06, 07 ja väljalaskefailid `v0.6.0`/`v0.7.0`), seejärel liitmine ja `v0.7.0`. Leiud 08–12 ja 14 lähevad M2.3 plaani, leid 13 salvestuse kaardile. Kasutaja suitsu- ja kasutuskatse on [M2.2b üleandmises](plans/M2-2b-uleandmine.md#kasutaja-suitsukatse-ja-kasutuskatse).
- M2.3 plaani läheb jõudlus: `connectionLevels`-i ja `nets`-i tuletise sisend kitseneb jalgade topoloogiale ([M2.2 plaani järgmised tööd](plans/M2-2-piiksumisreziim.md#mis-jääb-järgmistesse-plaanidesse)).
- Lahtine: salvestuse leiud 04–06 ning lühinimega tee normaliseerimine (`absolute()`, M2-1-12 CI järelparandus) järgmisele salvestuse kaardile, hiljemalt M4.3.
- Astra tööriistad: leid 25 (kaardikontroll ei tohi nõutud testi vaikselt välja jätta), seejärel 26–30.
- 02 § 16 ja § 6.2 kasutavad pööramiseks `R`/`Shift+R`-i (O2). 03 § 7.3 kirjeldab M1-4-10 sildi külje valikut.

## Kehtivad otsused, mis pole veel koodis näha

- Failivorming ei muutu ilma kasutaja loata (M1.3 O2).
- SVG jääb lõuendi aluseks. M1.4 kordusmõõtmine täitis eelarve, seega jalgade Canvas-kihti ei tehta ([M1-4-11](tasks/M1-4-11.md)).
- PNG-eksport (M4) komponeeritakse veebivaates; fotoprotokoll saab tootmises oma päritolu CORS-päise.
- Windowsi eelkontroll jääb kasutaja suitsuloendiks; uut automaatikat ei lisata.
- `Tab` liigub vormis; järgmine jalg on `Alt+↓` (kasutaja 2026-11-15).
- Commit, silt ja liitmine vajavad kasutaja luba sammu kaupa; push käib commit'iga kaasas ([ARHITEKT §6](ARHITEKT.md)).
- Lahtised tööd järgmistele verstapostidele on M1.4 plaani jaotises „Mis jääb järgmistesse plaanidesse“.

## Kasutaja otsustada

- Otsust vajab: koodiallkirjastamine enne laiemat jagamist (v1.0 tingimuslik, A2).
- Otsust vajab: CLAUDE.md laadib ARHITEKT-i `@`-impordiga ja ARHITEKT §7 saab tööpuu-seansi lõksu (md-auditi ettepanek 2026-11-17).
- Koristamiseks (kasutaja võib kustutada): `%TEMP%\bb-m2-1-katse\`, `%TEMP%\bb-m1-4-katse\` (pärast varukoopia kontrolli), `%TEMP%\bb030-m1411\`, `%TEMP%\bb-m1-3-katse\v0.2.0-worktree\` ja `%TEMP%\bb-m1-2-katse\v0.1.1-worktree\`.

## Tööriistad

- [`pnpm bb-review-card <ID>`](tasks/README.md#kaardi-ülevaatus-ühe-käsuga) seob kaardi testinimed käigu tulemustega; [`pnpm proof M1-3-10`](tasks/README.md#m1-3-10-brauseritõend) kordab näitude brauserikatset mõlemas teemas.
- J29 tõend mõõdab nähtavust SVG nähtava konteineri järgi, nii et servapuhver seda ei lõdvenda (Astra 2026-11-17, `tooling/proof/proof.test.ts`).
- Oskused: [salvestuse ülevaatus](../tools/skills/bb-review-storage/SKILL.md) ja [foto ja lõuendi joondus](../tools/skills/bb-check-canvas/SKILL.md); valik [SKILLS-is](SKILLS.md).
- [BB MCP server](../tools/mcp-bb/README.md): Git-i ja seisu vaade, dokumentide lugemine ja kontroll. Dokumendikontroll pole CI-s; käivita `bb_check_docs` pärast dokumentide muutmist.
- CI (`.github/workflows/ci.yml`): `check`, `coverage`, `format:check`, e2e, Rusti `fmt`/`test`/`clippy`; `main` ja `v*` siltidel ka `.msi` ja Release. `gh` on sisse logitud.

## Arenduskeskkond

- Node.js **26.13.0**, npm **11.20.0**, Corepack **0.36.0**, pnpm **12.18.0** (täpne versioon on lukustatud projektis).
- Rust/Cargo **1.99.1** (`stable-x86_64-pc-windows-msvc`) koos `rustfmt`-i ja `clippy`-ga; C++ Build Tools 2022, Windows SDK **10.0.26100.0**, WebView2 **157.0.4341.42**.
- Eraldi Python **3.13.17**; Codexi ja Claude'i `bb` server kasutab seda.
- Playwright **1.65.0** Chromium ja Playwright CLI **0.1.23**.
- Põhikausta `cargo test` võib SQLite'i kompileerimisel kukkuda (`cl.exe` D8050); Rusti kontrolli Codexi tööpuus ([ARHITEKT §7](ARHITEKT.md)).
- Gemini CLI `0.67.0` leiab BB MCP seadistuse, kuid kausta usaldamine ja sisselogimine on kasutaja teha.
