# M2.2 vastuvõtt ja suitsukatse

Kaart [M2-2-11](../tasks/M2-2-11.md), haru `codex/m2-2`, alus `3656947`. Tööpuu `C:/Users/TRUMPIT/.codex/worktrees/bb-m2-2/BB`. Ehitaja kasutas sünteetilisi fotosid ja projekte.

**Väljalase:** haru liideti `main`-i `3b5a65c` (2026-11-24), versioon 0.6.0 `b7ecf03`, silt `v0.6.0`.

## Vastuvõtt

| Tingimus | Tõend |
|---|---|
| Piiksu töövoog | `beep_flow_end_to_end` kontrollib Enterit ja ühist tagasivõtmist, `Shift+Enter`-it, `N`-i, `Esc`-i, takisti kaitseküsimust ja tööriistariba fookust. Iga salvestuse järel kontrollitakse mõõtmiste ja ühenduste arvu ning mõlemat jala UID-d. |
| Ühenduse taseme säilimine ja taastamine | Sama E2E kontrollib mõõdetud õhujoone joonistamist, haru mõlemat ✓-märki ning mõõtmise kustutamist ja taastamist Mõõda-plokist. |
| Suure plaadi jõudlus | Kolmes kehtivas Tauri jooksus jäi viis eelarvet täitmata. Kasutaja aktsepteeris mõõdetud piirid väljalaske `v0.6.0` jaoks 2026-11-24. |
| v0.4.0 ja v0.5.0 ühilduvus | `v0_5_0_file_opens_and_keeps_data` ja `every_release_pcbk_opens_without_modifying_source` läbisid. Kahel taasavamisel säilisid faili ID, dokument ja algse foto baidid. |
| Kasutaja suitsu- ja kasutuskatse | 2026-11-24: kasutaja proovis katse-EXE-d oma plaadi fotoga ja andis tagasisidet suuruste ja korpuste graafika kohta ([tulemus](#kasutaja-suitsukatse-ja-kasutuskatse)). Piiksu samme 2–9 ja 50 jala kasutuskatset kasutaja ei raporteerinud. Kasutaja otsustas avaldada `v0.6.0` ja teha graafika järgmisena. |

## Automaatsed tõendid

`beep_flow_end_to_end` läbis eraldi Chromiumi jooksus 19,4 sekundiga. `v0_5_0_file_opens_and_keeps_data` ning senine väljalaskefailide test läbisid. Logid on tööpuus `output/playwright/m2-2-11/beep-e2e.log` ja `output/playwright/m2-2-11/compatibility-green.log`. Raja B täisring läbis (`ok: true`, `missing: []`). Ühiktestid 1729/1729, E2E 44/44, Rust 108 läbis ja 2 jäeti vahele. Kaarditestid 2/2. `pnpm check`, API-, vormingu-, katvuse- ja diffikontroll, `cargo test` ning `pnpm tauri build --debug` läbisid. Kokkuvõte on põhikaustas `output/review-card/M2-2-11-BesMrv/summary.json`.

Lisandusid täpselt kaks nimetatud testi. Seniste testide sisu ja ootused säilisid, sealhulgas generaatoritestid ning `synthetic_board_commands_pass_engine`.

## Tauri jõudlus

Võrdlusalus on [M2.1 vastuvõtu viimane mõõtmine](M2-1-uleandmine.md#tauri-jõudlus). Kolm kehtivat jooksu kasutasid Tauri WebView2, 1280 × 800 kliendiala, seemet 127 ja eraldatud katseprofiili. Plaadil oli 300 komponenti, 3000 jalga, 1000 rada, 12 nimega võrku, 12 MP sünteetiline foto, 1500 pingemõõtmist ja 500 läbivust (450 positiivset, 50 negatiivset). Panoraam ja rattasuum olid kumbki 180 kaadrit, komponendi lohistus 120 kaadrit ja üks käsk. Fookus püsis kõigis kolmes jooksus.

| Mõõt | M2-1-11 mediaan | M2-2-11 jooksud | M2-2-11 mediaan | Eelarve |
|---|---:|---:|---:|---:|
| Töölaud ja foto valmis | 1033,6 ms | 1048,7 ms / 1163,9 ms / 1098,6 ms | 1098,6 ms | < 1500 ms |
| Panoraam | 58,38 fps | 55,38 fps / 56,84 fps / 57,14 fps | **56,84 fps** | ≥ 57 fps, täitmata, kasutaja aktsepteeris `v0.6.0` jaoks |
| Rattasuum | 59,67 fps | 60,00 fps / 60,00 fps / 60,00 fps | 60,00 fps | ≥ 57 fps |
| Komponendi lohistus | 40,68 fps | 40,00 fps / 40,22 fps / 40,22 fps | **40,22 fps** | ≥ 40,68 fps, täitmata, kasutaja aktsepteeris `v0.6.0` jaoks |
| Suumi rahunemise pikim kaader | 66,7 ms | 83,4 ms / 133,3 ms / 133,3 ms | 133,3 ms | 1000 ms vaatlus |
| `project_open` | 147,4 ms | 179,1 ms / 173,7 ms / 172,1 ms | 173,7 ms | Võrdluseks |
| `project_save` | 93,6 ms | 102,6 ms / 104,2 ms / 104,0 ms | 104,0 ms | Võrdluseks |

| Käsk | Valideerimine | Kõik tuletised | `nets` | `connectionLevels` | Valideerimine + tuletised M2-1-11 → M2-2-11 (≤ 16 ms) | Kogu `execute` | Olek |
|---|---:|---:|---:|---:|---:|---:|---|
| `items.translate` | 9,1 ms | 12,5 ms | 6,4 ms | 3,5 ms | 12,9 ms → **20,0 ms** | 25,1 ms | täitmata, kasutaja aktsepteeris `v0.6.0` jaoks |
| `connections.add` | 8,2 ms | 8,6 ms | 5,8 ms | 2,7 ms | 9,5 ms → **17,1 ms** | 25,6 ms | täitmata, kasutaja aktsepteeris `v0.6.0` jaoks |
| `beep.record` | 8,0 ms | 11,7 ms | 5,7 ms | 3,4 ms | — → **20,2 ms** | 32,7 ms | täitmata, kasutaja aktsepteeris `v0.6.0` jaoks |

Iga käsku mõõdeti viiel proovikorral jooksu kohta, käsk võeti iga kord tagasi. Tabel näitab kolme jooksu mediaanide mediaani. Valideerimine ja tuletised liideti iga proovi sees. `nets` ja `connectionLevels` sisalduvad tuletiste ajas. `beep.record` lisas positiivse mõõtmise ja ühenduse. Toorandmed ja kokkuvõte on tööpuus `output/playwright/m2-2-11/acceptance-{1,2,3}-perf.json` ja `output/playwright/m2-2-11/native-acceptance-summary.json`.

## Ühilduvusfailid

Rusti testid avavad ajutised koopiad. Näidisfailid asuvad tööpuus `apps/desktop/src-tauri/tests/fixtures/`.

| Fail | Baiti | SHA-256 |
|---|---:|---|
| `v0.4.0.pcbk` | 208896 | `d30ce7bf14b9e460c92d0279056af2e851ad23b4c227436f6f19f760a1f7944a` |
| `v0.5.0.pcbk` | 49152 | `de7f9bbe6266ed88e04fee80588b3b3489d6fed87c2677c4007af7e2f7611961` |

Näidis loodi `v0.5.0` sildi (`0bc063b`) töölaualiideses eraldatud katseprofiiliga. Failis on 800 × 600 sünteetiline PNG, 76 mm kalibreering, SOIC-8 ja SMD-takisti, käänupunktiga rada ja liitepunktiga haru, `Võrdlusvõrk` rolliga GND ning 4,98 V näit. Õhujoon loodi „Ühenda võrguga…“ kaudu ja ajutine rada eemaldati. Salvestatud `assumed`-ühenduse kuju vastab kiirühenduse õhujoonele. Foto algbaitide SHA-256 on `bad0b63dd9920f3b44692d3b51da7f78ee69a0cc4945773ed8f2983df9f6aa74`. SQLite `quick_check` andis `ok`. Lähteandmed on tööpuus `output/playwright/m2-2-11/v050-fixture-proof.json`.

## Teadaolevad piirid

- Panoraam, lohistus ja kolme käsu aeg jäid tabelis märgitud eelarvest välja. Kasutaja aktsepteeris mõõdetud piirid `v0.6.0` jaoks. `connectionLevels`-i ja `nets`-i tuletise sisendis on terve `components`, mistõttu arvutatakse mõlemad ka komponendi liigutuse järel uuesti. Sisendi kitsendamine on M2.3 plaanis. [Järgmised tööd](M2-2-piiksumisreziim.md#mis-jääb-järgmistesse-plaanidesse).
- Kasutaja otsustas avaldada 2026-11-24. Katse-EXE versiooniväärtus oli 0.5.0, väljalase saab väärtuse 0.6.0.

## Kasutaja suitsukatse ja kasutuskatse

**Tulemus 2026-11-24.** Kasutaja lõi katse-EXE-s oma plaadi fotoga uue projekti, kalibreeris selle ja paigutas 28 komponenti. Tagasiside: suurused pole reaalsed, korpuste graafika on kehv ja segane. Arhitekti triaaž:

- **Suurus:** kalibreerimisjoon kattis kogu foto laiuse (2716 px) ja selle pikkuseks sisestati 30 mm. Elektrolüütide läbimõõdu järgi on plaat umbes 150–160 mm lai, seega joonistati kõik umbes 5 korda liiga suurena. Joonistus järgib mõõtkava õigesti. Kalibreerimisdialoog näitab ainult punktide vahet pikslites, mitte foto suurust millimeetrites, ja seepärast jäi viga märkamata.
- **Graafika:** iga korpus joonistatakse ristkülikuna (`body` sisaldab ainult laiust, kõrgust ja 1. jala punkti). Ümar elektrolüüt tuleb ruuduna, polaarsust, dioodi triipu ega mikroskeemi sälku pole. Kasutaja valis elektrolüütidele „Kondensaator THT“ (ketas), mitte „Elektrolüüt THT“.
- Mõlemad on varasemad puudused (M1.2 kalibreerimine, M1.3 korpuste teek), mitte M2.2 vead. Kasutaja otsustas avaldada `v0.6.0` ja teha korpuste graafika ning mõõtkava kontrolli järgmisena.

Katse-EXE on `%TEMP%/bb-m2-2-katse/pcbk-m2-2-11-katse.exe`, SHA-256 `b76aab0f2033a940d0156e6ec41bff4dd79cab5e6bc0b1bb06dbafbbbc9565a4`.

Uue projekti ja „Salvesta mujale…“ vaikekaust on `%TEMP%/bb-m2-2-katse/`. Katsejärgu eraldi rakendusetunnus hoiab selle hiljutiste projektide loendi eraldi. Salvestusdialoogist tagastatakse tee ja `replaceToken` koos. Ehituslogi on tööpuus `output/playwright/m2-2-11/smoke-build-final.log`.

Ehitaja lõi katse-EXE-s uue sünteetilise projekti, kinnitas faili asukoha katsekaustas ja avas projekti hiljutiste loendist uuesti. Kontroll on tööpuus `output/playwright/m2-2-11/smoke-exe-proof.json`. Vana faili avamist saab proovida sünteetilise koopiaga `%TEMP%/bb-m2-2-katse/v0.5.0-suitsukatse.pcbk`.

1. Käivita katse-EXE ja ava oma plaadi foto. Kalibreeri `K`-ga, kui projekt on uus.
2. Mõõda Mõõda-plokis pinge ja seejärel `Alt+4`-ga läbivus. Proovi „Piiksub“ ja „Ei piiksu“. Mõõtmiste loendis on „Läbivus · piiksub“ või „Läbivus · ei piiksu“.
3. Vajuta `B`, klõpsa jalal (must sond) ja siis teisel jalal. Nupud on jala juures. `Enter` ühendab ja ühendusel on ✓. `Ctrl+Z` võtab mõlemad tagasi.
4. Proovi `Shift+Enter`, `N` ja `Esc`. Ainult `Esc` ei salvesta midagi. Teine `Esc` lõpetab režiimi.
5. Piiksu takisti mõlemat otsa. Tuleb küsimus „Piiksub läbi komponendi …“. Proovi mõlemat vastust.
6. Vali mõõdetud õhujoon ja vajuta „Joonista rada fotol“. Tee rajale haru. ✓ jääb mõlemale lõigule.
7. Kustuta piiksu mõõtmine. ✓ kaob ja nupp „Mõõda uuesti“ / „Mõõda piiksuga“ avab Piiksu kohe õigete sondidega.
8. Joonista pealmine rada üle teise pealmise raja. See on keelatud ja vihje pakub `L`-i. Alumisel kihil on sama lõik lubatud.
9. Vahekaardil „Võrgud“ on mõõdetud ühenduste arv ja läbivuse read on loetavad.
10. Ava oma `v0.5.0` ajal tehtud projekt. See avaneb ja andmed on alles.
11. **Kasutuskatse:** kaardista piiksuga 50 jalga (näiteks GND-võrk) ja võta aega. Eesmärk on alla 2 minuti. Kirjuta arhitektile aeg ning see, mis oli segane või aeglane.
