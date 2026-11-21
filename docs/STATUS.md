# BB: jooksev seis ja üleandmine

Uuendatud: **2026-11-21**. See fail on lühike hetkeseis, kuni 80 rida. Ajalugu on Git-is, kaartidel ja verstapostide üleandmistes ([docs/README](README.md)). Kontrolli väiteid Git-i vastu.

## Rollid

Claude on arhitekt ja Codex on ehitaja; tööriistu ehitab ka Astra põhikaustas (`tooling/`). [Tööjaotus](07-teekaart.md#rollid) ja [töövõte](WORKFLOW.md).

## Avaldatud

| Versioon | Verstapost | Kuupäev | Märkus |
|---|---|---|---|
| `v0.5.0` | M2.1 ühendused ja võrgud plaadil | 2026-11-20 | liidetud `92f001c`, silt `v0.5.0`; Astra sõltumatu ülevaatuse parandused M2-1-12–14; kasutaja suitsukatsed 12/12 ja 6/6 oma plaadi fotoga |
| `v0.4.0` | M1.4 suurus, joondus, oma jalad ja jõudlus | 2026-11-19 | liidetud `7e37c59`, silt `v0.4.0`; kasutaja suitsukatse 12/12 oma tiheda plaadi fotoga |
| `v0.3.0` | M1.3 tööpind, valik, korpuste teek | 2026-11-17 | liidetud `6fa7a85`, silt `a995825`; kasutaja oma fotoga kontroll jäi vahele, ehitaja sünteetiline suitsukatse 10/12 |
| `v0.2.0` | M1.2 foto ja kalibreerimine | 2026-11-14 | |
| `v0.1.1` | M1.1 komponent fotol ja mõõtmine | 2026-11-10 | |
| `v0.1.0` | M0 vundament | 2026-11-09 | |

Iga verstaposti tõendid on teekaardi olekureal ([07](07-teekaart.md)) ja plaani vastuvõtutabelis.

## Järgmine: M2.2 piiksumisrežiim ja ühenduse tase

- M2.1 on avaldatud versioonina `v0.5.0`: haru on liidetud `92f001c`, versioon `0bc063b`, silt `v0.5.0`.
  - Kaardid [M2-1-H](tasks/M2-1-H.md), [M2-1-1](tasks/M2-1-1.md)–[M2-1-14](tasks/M2-1-14.md), jõudlus, ühilduvus ja mõlemad suitsukatsed on [M2.1 üleandmises](plans/M2-1-uleandmine.md).
  - Astra [sõltumatu ülevaatuse](review/2026-11-20-m2-1-ulevaatus-8a2304d.md) P1-leiud parandati kaartidega M2-1-12–M2-1-14.
- [M2.2 teostusplaan](plans/M2-2-piiksumisreziim.md) on kinnitatud (2026-11-20, kasutaja kinnitas soovitused O1–O6). Esimene kaart on [M2-2-1](tasks/M2-2-1.md), läbivus Mõõda-plokis (A): **vastu võetud** `2c39900`, rada A täisring läbis. [M2-2-2](tasks/M2-2-2.md) ühenduse tase (B): **vastu võetud** `e30b5cd`, rada B täisring läbis; lohistuskäsu varu Tauris 0,2 ms. [M2-2-3](tasks/M2-2-3.md) `beep.record` ja kaitsed (B): **vastu võetud** `3ed369f`, rada B täisring läbis. [M2-2-4](tasks/M2-2-4.md) tööriist Piiks (A): **vastu võetud** `951e77b`, rada A täisring läbis. [M2-2-5](tasks/M2-2-5.md) taseme kuvamine ja „Mõõda uuesti“ (A): **vastu võetud** `4c4e971`, rada A täisring läbis. [M2-2-6](tasks/M2-2-6.md) võrgud ja kustutamine (A): **vastu võetud** `5f4ffae`, rada A täisring läbis. [M2-2-7](tasks/M2-2-7.md) lõuendi täpsus ja radade ristumine (A): **vastu võetud** `1ee7218`, rada A täisring läbis. [M2-2-8](tasks/M2-2-8.md) Piiksu sihtimine ja klahvid (A): **vastu võetud** `da58ddc`, rada A täisring läbis (Astra P1 01 ja 02 parandatud). [M2-2-9](tasks/M2-2-9.md) Piiksu olek ja näidud (A): **vastu võetud** `e140f7f`, rada A täisring läbis. [M2-2-10](tasks/M2-2-10.md) taseme täpsus ja jõudlus (B, kaart kirjutatud). Rada A täisring läbis. Astra [sõltumatu ülevaatus](review/2026-11-21-m2-2-ulevaatus-5f4ffae.md) (`5f4ffae`) leidis 2 P1, 8 P2 ja 2 P3 viga. Triaaž: plaani ülesanded 8–10 (Piiksu sihtimine ja klahvid, Piiksu olek ja näidud, taseme täpsus ja jõudlus) kinnitas kasutaja 2026-11-21, vastuvõtt on ül. 11. M2-2-9 kaarditestid 4/4, E2E 43/43 ja ühiktestid 1726/1726. Tööpuu `C:/Users/TRUMPIT/.codex/worktrees/bb-m2-2/BB`, haru `codex/m2-2`. Plaan seob need lahtised leiud:
  - Astra 2026-11-20 leiud 14–20;
  - [koodiülevaatuse 2026-11-19](review/2026-11-19-koodiulevaatus-00a424e.md) leiud 15 ja 18 (sondipaari mustand, võrdse ajatempliga näidud);
  - salvestuse leiud 04–06 ning lühinimega tee normaliseerimine (`absolute()`, M2-1-12 CI järelparandus) järgmisele salvestuse kaardile, hiljemalt M4.3.
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
