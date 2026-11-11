# Arhitekti töövõte (Claude)

Claude loeb selle faili **iga vastuse alguses esimesena**. Fail on lühike ja ainult Claude'ile; ühised reeglid on [AGENTS](../AGENTS.md)-is, [WORKFLOW](WORKFLOW.md)-s ja [kaartide README](tasks/README.md)-s. Siin on, **kuidas** arhitekt neid odavalt täidab.

## 1. Kolm esimest sammu (alati)

1. `bb_status` (Git + STATUS ühe päringuga). Ilma MCP-ta: `git status --short`, `git log --oneline -3` põhikaustas **ja** aktiivses Codexi tööpuus (tee on STATUS-es).
2. Määra töö liik: **kaart**, **ülevaatus**, **commit/väljalase** või **küsimus**. Iga liigi käik on allpool.
3. Määra rada ([WORKFLOW › Kaks rada](WORKFLOW.md#kaks-rada-tavaline-ja-kaitstud-töö)): **A** tavaline või **B** kaitstud. Rada määrab lugemise ja kontrolli mahu.

**Toode ees.** Eesmärk on kasutajale nähtav töövõime, mitte testide ega hoolduse ring. Hooldus- või testikaart tuleb ainult siis, kui see blokeerib järgmist verstaposti või kaitseb andmeid. Muul juhul pane see märkusena järgmise ehituskaardi juurde. Ühele verstapostile on kuni üks hooldusvoor. Kontroll on raja suurune: rada A puhul piisab kaardi testidest ja `pnpm check`-ist, täisring tehakse ainult rajal B ja enne liitmist. Ülevaatus ei lisa uusi teste, mida kaart ei nõudnud, välja arvatud leitud vea jaoks.

STATUS-e ja vestluse kokkuvõtte väited kontrolli Git-i vastu. Ära kanna commit'e, testide arve ega haru seisu mälust.

## 2. Lugemise eelarve

- **Ära loe** 01–08 tervikuna, vanu kaarte, ülevaatusi ega arhiivi. Avaliku liidese allikas on genereeritud `docs/api/<pakett>.md` (**tööpuust**, kui kood pole veel `main`-is).
- **Mooduliga töö:** loe ainult `docs/api/features-<moodul>-*.md`, mooduli kausta ja selle teste. Sõltuvusreegel (`pnpm check` › depcruise) tagab, et teised moodulid ei sõltu sisemusest; nende koodi pole vaja avada.
- **Otsi, ära sirvi:** `rg`/Grep täpse sümboli või veakoodi järgi, siis `Read` ainult vajalikud read (`offset`/`limit`). Laienda **üks sõltuvushüpe** ainult konkreetse lahtise riski korral.
- Dokumendist loe jaotis (`bb_outline` → `bb_read_section`), mitte faili.
- Laia otsingu (> 10 faili) võib anda Explore-alamagendile; tavaliselt mitte.

## 3. Kaardi kirjutamine

1. Loe plaani vastav ülesanne (`bb_read_section`) ja ainult need liidesed, mida kaart muudab.
2. Kontrolli **tegelikku** koodi: olemasolevad nimed, failid, ekspordid (`grep -n`). Kaardi vead tulid varem eeldustest (`doc.board.scale` vs `doc.scale`, puuduv alamtee).
3. Kirjuta kaart [malli](tasks/README.md#mall) järgi; päisesse **Rada: A/B**. Otsused, signatuurid, tekstid ja testinimed välja kirjutatud; „Loe“ ≤ 5 viidet, iga viide eraldi real (`bb_task` loeb rea esimese viite).
4. `bb_task <id>` (kas „Loe“ laheneb?) ja `bb_check_docs`.
5. **Commit kaart `main`-i enne, kui Codex tööpuu loob** (kasutaja loal), siis anna kasutajale Codexi ülesande tekst ühes koodiplokis. Ehitaja küsimuse vastus läheb kaardile („Arhitekti vastus ehitajale“).

## 4. Ülevaatus

1. Loe kaardi üleanne **põhikaustas** ja `git status` tööpuus. Kui ehitaja kirjutas kaardi/STATUS-e tööpuusse, kanna sisu põhikausta ja eemalda tööpuu koopia enne commit'i.
2. `git diff` ainult põhifailidele (mitte genereeritud `docs/api`, mitte testid tervikuna); testidest kontrolli, et kaardi testinimed on olemas (`grep -c`).
3. Kontrolli kaardi otsuseid koodis, eriti: andmete säilimine, ajalugu üks samm, katkestus jäljetult, tekstid, sõltuvuse suund.
4. Käsud (rada A: `check`; rada B ja enne liitmist: kõik) — kasuta allolevaid lühiväljundiga käske.
5. Kui UI muutus ja ekraanipilti pole, kontrolli brauseris (veebiäpp tööpuust) või DOM-i mõõtudega; nimeta, kumba tegid.
6. Kirjuta kaardile „Arhitekti ülevaatus (kuupäev)“: mida kontrollisid, tegelikud tulemused, **Otsus: sobib / vajab parandust** (parandused nummerdatult koos testinimedega), mitteblokeerivad märkused. Uuenda STATUS-e üks rida.
7. Üks paranduse ring; ära loo eraldi „kinnitus“- või „sulgemis“-samme.

## 5. Lühiväljundiga käsud (PowerShell, tööpuus)

```powershell
pnpm.cmd check 2>&1 | Select-String "Tests |violations|Test Files|rror|warn\]"; "EXIT=$LASTEXITCODE"
pnpm.cmd format:check 2>&1 | Select-Object -Last 1; pnpm.cmd api:check *> $null; "API=$LASTEXITCODE"
pnpm.cmd e2e 2>&1 | Select-Object -Last 2; "E2E=$LASTEXITCODE"
cargo test --locked --offline 2>&1 | Select-String "^test result" | ForEach-Object { $_.Line }   # kaustas apps\desktop\src-tauri
```

## 6. Commit, liitmine, väljalase

- Iga commit, push, silt ja liitmine vajab kasutaja luba sellele sammule. Autor: `git -c user.name="Fuuduuu" -c user.email="elarvaltri@gmail.com" commit …` (Giti identiteeti pole seadistatud).
- Kood: Codexi harus (`git add -A` ainult siis, kui tööpuus pole võõraid faile — vaata enne `git status --untracked-files=all`). Dokumendid: otse `main`-i, nimeliselt lisatud failid.
- Pärast commit'i: kaardi päisesse `vastu võetud <hash>`, STATUS-esse sama.
- Liitmine: `git merge-tree --write-tree main <haru>` (konfliktide eelkontroll) → `merge --no-ff` → kontrollid `main`-is → versioon `tauri.conf.json`-is → push `main` → annoteeritud silt → push silt. CI tulemust `gh` puudumisel ei näe; ütle seda.

## 7. Keskkonna lõksud

- Kasutaja kasutab **Windows PowerShell 5.1**: käskudes `;`, mitte `&&`; tee `C:\…`.
- Põhikaustas võib olla teise seansi `.claude/worktrees/` (ESLint ignoreerib, M1-H-1). Põhikausta `cargo test` võib SQLite'i kompileerimisel kukkuda (`cl.exe` D8050); Rusti kontrolli tööpuus, kus ehitus on vahemälus, ja kinnita, et Rusti kood on identne (`git diff <haru> main -- apps/desktop/src-tauri`).
- Brauseripaani ekraanipilt võib aknast sõltuvalt ebaõnnestuda; siis `get_page_text`/DOM-i mõõdud.
- Ajutised failid scratchpad'i, mitte repo.

## 8. Vastus kasutajale

Eesti keeles, lühidalt: tulemus → mida ise kontrollisid (tegelikud arvud) → mis jäi kontrollimata → järgmine samm. Codexi tekst eraldi koodiplokis. Ära korda kaardi sisu vastuses.
