# BB: jooksev seis ja üleandmine

Uuendatud: **2026-11-28**. See fail on lühike hetkeseis, kuni 80 rida. Ajalugu on Git-is, kaartidel ja verstapostide üleandmistes ([docs/README](README.md)). Kontrolli väiteid Git-i vastu.

## Rollid

Claude on arhitekt ja Codex on ehitaja; tööriistu ehitab ka Astra põhikaustas (`tooling/`). [Tööjaotus](07-teekaart.md#rollid) ja [töövõte](WORKFLOW.md).

## Avaldatud

| Versioon | Verstapost | Kuupäev | Märkus |
|---|---|---|---|
| `v0.7.0` | M2.2b korpuste kuju ja mõõtkava | 2026-11-26 | liidetud `02ac941`, versioon `419ab44`, silt `v0.7.0`; Astra auditi parandused M2-2b-6–7; näidisfailid `v0.6.0` ja `v0.7.0`; kasutaja vastas suitsukatse järel „korras“, samme ja 50 jala aega ei raporteeritud |
| `v0.6.0` | M2.2 piiksumisrežiim ja ühenduse tase | 2026-11-24 | liidetud `3b5a65c`, silt `v0.6.0`; viis jõudluspiiri aktsepteeris kasutaja; kasutaja katse oma fotoga andis tagasiside suuruste ja korpuste graafika kohta, piiksu samme ja kasutuskatset ei raporteeritud |
| `v0.5.0` | M2.1 ühendused ja võrgud plaadil | 2026-11-20 | liidetud `92f001c`, silt `v0.5.0`; Astra sõltumatu ülevaatuse parandused M2-1-12–14; kasutaja suitsukatsed 12/12 ja 6/6 oma plaadi fotoga |
| `v0.4.0` | M1.4 suurus, joondus, oma jalad ja jõudlus | 2026-11-19 | liidetud `7e37c59`, silt `v0.4.0`; kasutaja suitsukatse 12/12 oma tiheda plaadi fotoga |
| `v0.3.0` | M1.3 tööpind, valik, korpuste teek | 2026-11-17 | liidetud `6fa7a85`, silt `a995825`; kasutaja oma fotoga kontroll jäi vahele, ehitaja sünteetiline suitsukatse 10/12 |
| `v0.2.0` | M1.2 foto ja kalibreerimine | 2026-11-14 | |
| `v0.1.1` | M1.1 komponent fotol ja mõõtmine | 2026-11-10 | |
| `v0.1.0` | M0 vundament | 2026-11-09 | |

Iga verstaposti tõendid on teekaardi olekureal ([07](07-teekaart.md)) ja plaani vastuvõtutabelis.

## Järgmine: M2.3 skeemi sümbolid ja paigutus

- M2.2b on liidetud `main`-i `02ac941` (2026-11-26), versioon 0.7.0 `419ab44`, silt `v0.7.0`. Kaardid [M2-2b-1](tasks/M2-2b-1.md)–[M2-2b-7](tasks/M2-2b-7.md), jõudlus, näidisfailid ja kasutaja katse on [M2.2b üleandmises](plans/M2-2b-uleandmine.md). Astra auditi P1 leiud 01–05 ja leiud 06–07 on parandatud ([ülevaatus ja triaaž](review/2026-11-25-m2-2b-ulevaatus-2eb1a1c.md)). `main`-is läbisid `pnpm check` 1752/1752 ja E2E 46/46; Rusti kood on sama mis harus (108/110).
- [M2.3 plaan](plans/M2-3-skeemi-sumbolid-ja-paigutus.md) on kinnitatud (2026-11-26, O1–O6): ettevalmistav ülesanne, IEC sümbolid, A3 leht ja 2,54 mm ruudustik, jalgade vastavus nimede järgi, plaadipunktid skeemil, väljalase `v0.8.0`. Plaanis on seitse ülesannet; Astra M2.2b leiud 08–12 ja 14 ning tuletiste jõudlus on nende sees. [M2-3-1](tasks/M2-3-1.md), moodulite piirid ja tuletised (leiud 09–12), on vastu võetud `e1a8ac5` (2026-11-27); raja B täisring läbis. `items.translate` mediaan langes sünteetilisel plaadil 27,01 ms-lt 12,47 ms-ni. Kaart [M2-3-2](tasks/M2-3-2.md), skeemivaade ühe lõuendiga (rada A), on vastu võetud `cbd4d42` (2026-11-27): lüliti „Plaat | Skeem“, `Ctrl+Tab`, A3 leht 2,54 mm ruudustikuga ja eraldi suum kummalgi vaatel; raja A täisring läbis (1761 Vitesti, 47 E2E). Kaart [M2-3-3](tasks/M2-3-3.md), sümbolite teek (rada A, leid 14), on vastu võetud `8155d6e` (2026-11-27): 22 IEC sümbolit ühise joonistus- ja tabamisgeomeetriaga; ebaselge jalgade vastendusega komponent on nummerdatud kast; raja A täisring läbis (1765 Vitesti, 48 E2E). Kaart [M2-3-4](tasks/M2-3-4.md), täpne jalavalik ja kahe vaate parandused (rada B, auditi leiud 01, 02 ja 17), on vastu võetud `8bc79b1` (2026-11-27): must sond ja Rada võtavad padja kursori all, mõlemad kaamerad kopeeritakse, vaatevahetus lähtestab puuduva tööriista ning skeemitähistel ja kastidel on rohkem ruumi; raja B täisring läbis (1770 Vitesti, 48 E2E, 108 Rusti). Kaart [M2-3-5](tasks/M2-3-5.md), komponendid skeemil (rada B), on vastu võetud `a0393d9` (2026-11-28): lisamine teegist ja loendist „Paigutamata“, lohistamine, nooled, `R`/`Shift+R`, `F` ja „Eemalda skeemilt“ ruudustikul, iga tegevus üks `Ctrl+Z` samm; raja B täisring läbis (1775 Vitesti, 49 E2E, 108 Rusti). Kaart [M2-3-6](tasks/M2-3-6.md), jalgade funktsioon, ühine valik ja „Näita teises vaates“ (rada B), on vastu võetud `1acfaf8` (2026-11-28): kontaktide määramine teeb kastist sümboli ühe `Ctrl+Z` sammuga, „Näita skeemil/plaadil“ hoiab valiku ja suumi ning toob komponendi nähtava ala keskele (päris brauseris kontrollitud), skeemil on tuvastamata ja DNP tähistus; raja B täisring läbis (1779 Vitesti, 50 E2E, 108 Rusti). Järgmine on [M2-3-7](plans/M2-3-skeemi-sumbolid-ja-paigutus.md) (vastuvõtt, jõudlus, leid 06, `v0.8.0`); sinna läheb ka jaotise „Jalgade funktsioon“ 16 px vahe parandus.
- Leid 13 (algfaili taastamine) läheb järgmisele salvestuse kaardile. Kasutaja suitsukatse vastus „korras“ (2026-11-25) on M2.2b üleandmises; 50 jala aega ei raporteeritud.
- Lahtine: salvestuse leiud 04–06 ning lühinimega tee normaliseerimine (`absolute()`, M2-1-12 CI järelparandus) järgmisele salvestuse kaardile, hiljemalt M4.3.
- Astra [arhitektuuriaudit](review/2026-11-27-arhitektuuri-audit-cbd4d42.md) tipul `cbd4d42` (kasutaja tellis selle 2026-11-27 verstaposti keskel erandina) andis 22 leidu: 1 P1, 15 P2 ja 6 P3. Ümberehitust ei tule. P1: must sond ja Rada võivad salvestada kõrvaljala. Kasutaja kinnitas plaani uue ülesande 4 (leiud 01, 02 ja 17), mis tuleb enne paigutust; endised ülesanded 4–6 on nüüd 5–7.
- Astra tööriistad: leid 25 (kaardikontroll ei tohi nõutud testi vaikselt välja jätta), seejärel 26–30.
- 02 § 16 ja § 6.2 kasutavad pööramiseks `R`/`Shift+R`-i (O2). 03 § 7.3 kirjeldab M1-4-10 sildi külje valikut.

## Kehtivad otsused, mis pole veel koodis näha

- Failivorming ei muutu ilma kasutaja loata (M1.3 O2).
- SVG jääb lõuendi aluseks. M1.4 kordusmõõtmine täitis eelarve, seega jalgade Canvas-kihti ei tehta ([M1-4-11](tasks/M1-4-11.md)).
- PNG-eksport (M4) komponeeritakse veebivaates; fotoprotokoll saab tootmises oma päritolu CORS-päise.
- Windowsi eelkontroll jääb kasutaja suitsuloendiks; uut automaatikat ei lisata.
- `Tab` liigub vormis; järgmine jalg on `Alt+↓` (kasutaja 2026-11-15).
- Koodi commit, silt ja liitmine vajavad kasutaja luba sammu kaupa; dokumentide commit'id `main`-i on alalise loaga; push käib commit'iga kaasas ([ARHITEKT §6](ARHITEKT.md)).
- Ehitaja kohandab olemasolevat testi mehaaniliselt küsimata ning teeb otsuste kaardi, commit'i sõnumi mustandi ja versiooni tõstmise ise ([kaartide reeglid 9–10](tasks/README.md#reeglid), kasutaja 2026-11-27).
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
