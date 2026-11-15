# Snaipriülesanded

Snaipriülesanne on **üks kaart** `docs/tasks/<id>.md`, kus on kõik, mida ehitaja ühe ülesande jaoks vajab. Kogu dokumentatsiooni ja koodi pole vaja iga kord läbi lugeda. Ehitaja loeb [AGENTS](../../AGENTS.md)-i, kaardi ja kaardi „Loe“-loendi, mitte rohkem.

Verstaposti plaan (`docs/plans/Mx-*.md`) jääb ülevaateks: ülesannete järjekord, ühised piirangud ja vastuvõtt. Kaart on ühe ülesande täitmise ühik. Arhitekt kirjutab kaardi vahetult enne ülesande algust, kui eelmine ülesanne on vastu võetud ja tegelik seis teada.

Kaardid asuvad põhikaustas `C:\Users\TRUMPIT\Desktop\BB\docs\tasks\`, samamoodi nagu ühine STATUS. Eraldi tööpuus töötav ehitaja loeb kaarti sealt ja kirjutab üleandmise sama kaardi lõppu. Koodi ja testid teeb ta oma tööpuus.

Kaarte on kõige lihtsam lugeda MCP tööriistaga `bb_task`. See tagastab kaardi koos „Loe“-loendi dokumendijaotistega ühe päringuga. Ilma MCP-ta loe kaart ja loendi read käsitsi.

## Kaardi ülevaatus ühe käsuga

Codex käivitab enne üleandmist ja Claude ülevaatusel põhikaustast sama käsu:

```sh
pnpm bb-review-card M1-3-8 --plan
pnpm bb-review-card M1-3-8
```

`--plan` loeb põhikausta kaarti ja otsib nõutud testide deklaratsioone kaardi päises nimetatud haru tööpuust. See näitab puuduvaid nimesid ning Cargo ja Tauri vajadust. Otsing jätab välja otseselt keelatud testid (`skip`, `todo`, `fixme`, Rusti `#[ignore]`). Käitusajal otsustatud vahelejätmised selguvad testiraportist. Kontrollitava tööpuu saab ise valida, näiteks `pnpm bb-review-card M1-2-4 --worktree .` pärast haru liitmist põhikausta.

Täiskäik jooksutab valitud tööpuus `check`, `api:check`, `format:check`, `coverage`, `e2e` ja `git diff --check`. Rajal B lisandub `cargo test`, kui kaart seda sõnaselgelt ära ei jäta. Tauri ehitus lisandub kaardi nõudel. Playwright käivitab rakenduse ise ja vajab konfiguratsioonis määratud vaba porti. Kaardil eraldi nõutud lisakatsed, näiteks `cargo clippy` või kümme järjestikust testikäiku, teeb ülevaataja eraldi.

Iga käigu logid ja `summary.json` asuvad põhikaustas `output/review-card/<kaart>-<käik>/`. Kokkuvõttes on kontrollitud haru, HEAD, tööpuu olek käigu alguses, käsud, puuduvad nimed ning testitulemused. Vitesti testiarv tuleb katvuskäigust ühe korra. Katvus käib valitud tööpuu Vitesti seadistuses määratud lähtekoodi kohta. E2E vaikimisi ajapiir on 15 minutit. Seda saab muuta keskkonnamuutujaga `BB_REVIEW_E2E_TIMEOUT_MS` (millisekundites), et ka takerdunud serveri korral jõuaks käik kokkuvõtteni. Väljumiskood 1 tähendab, et kontroll ebaõnnestus, nõutud tõend puudub või kaart vajab käsitsi tõlgendamist. Kaardi brauserivaatlus ja kasutaja visuaalne vastuvõtt märgitakse üleandmises eraldi.

Täiskäigu väljundis ja `summary.json` väljal `requiredTestResults` on iga kaardil nõutud nime tulemus. Allikateks on sama käigu Vitesti ja Playwrighti JSON-raportid ning Cargo logi. Parameetritega testil on näha üksikjuhud ja Playwrightil ka projekt. Nõutud testi viga, vahelejätmine, puuduv käivitus või ebapiisav tõend annab väljumiskoodi 1 ka siis, kui ülejäänud testid läbivad. Kordusel läbinud brauseritest ja eduka tüübikontrolliga kaetud `.test-d.ts` deklaratsioon saavad eraldi märke.

## M1-3-10 brauseritõend

```sh
pnpm proof M1-3-10
```

Käivita käsk põhikaustast. See leiab kaardi haru tööpuu või kasutab käsureal antud `--worktree <BB kaust>`. Proov kasutab selle kausta hetkeversiooni koos kohalike muudatustega. Kahe tulemuse võrdlemiseks vaata kokkuvõttest Git-i HEAD-i ja ehitatud veebifailide sõrmejälge `applicationSha256`. Kindla commiti kontrolliks anna selle puhas tööpuu. Tööpuus peavad olema kaardi E2E-testid ja paigaldatud projekti sõltuvused. Esmakordsel kasutamisel saab sobiva Chromiumi tööpuust paigaldada käsuga `pnpm exec playwright install chromium`.

Skript ehitab valitud tööpuu veebirakenduse ja avab selle failid otse uues Chromiumi brauserikontekstis. Igas katses luuakse oma sünteetiline plaat. Vaade on 1280 × 800, pikslitihedus 1. Heledas ja tumedas teemas jooksutatakse samad kaks testi, mis on rakenduse E2E-komplektis. J29 puhul mõõdetakse tähise ja näidu kattumist kaheksal stseeniteisendusel ning kontrollitakse viitejoont. Teisel plaadil mõõdetakse kahe kõrvutise näidu vahet.

Iga kord tekib uus `output/playwright/proof/M1-3-10-<käik>/`. Ava `summary.json` või võrdle faile `j29-light.png`, `j29-dark.png`, `adjacent-light.png` ja `adjacent-dark.png`. Sama nimega JSON-is on mõõdud. Väljumiskood 0 nõuab kõigi nelja juhtumi läbimist koos mõõtude ja kuvatõmmistega. Ebaõnnestumisel leiab detailid Playwrighti raportist `playwright.json`.

Mõlema teema J29 põhimõõt on `autoRefPinOverlapPx2`. See liidab automaatselt paigutatud tähise ja väärtuse rea tekstikastide lõikepindalad J29 enda 15 jalanumbri tekstikastidega vahetult enne lohistamist. Oodatav tulemus on 0 CSS px². Positiivne või puuduv automaatmõõt annab hoiatuse ja säilitab senise väljumiskoodi. Kuvatõmmise jaoks lohistab proov tähise jalale 15, et viitejoon nähtavale tuleks. Infoväli `refPinOverlapPx2` näitab kattumist „pärast käsitsi lohistust“. Puuduv mõõt kuvatakse JSON-is väärtusena `null`.

## Kes mida loeb

| Roll | Loeb | Ei loe |
|---|---|---|
| Ehitaja | AGENTS, kaart, kaardi „Loe“-loend, muudetavad failid ja nende testid | 01–08 tervikuna, teisi kaarte, varasemaid üleandmisi, ülevaatusi |
| Arhitekt, ülevaatus | kaart, `git diff`, kaardi „Üleandmine“, kontrollide väljund | muud koodi, välja arvatud leiu kontrollimiseks |
| Arhitekt, kaardi kirjutamine | verstaposti plaan, asjakohased 03/04/05/06 jaotised, liideste kokkuvõte | |

## Reeglid

1. **Kaart on iseseisev.** Otsused, signatuurid, konstandid, veakoodid ja kasutajale nähtavad tekstid on kaardil välja kirjutatud. Kaart ei ütle „vt 03“.
2. **„Loe“-loendis on kuni 5 täpset viidet** kujul `dokument#ankur` või `fail:algus-lõpp`. Viide on taust, mitte koht, kust otsuseid otsida.
3. **Kaart on lühike,** soovitatavalt kuni 80 rida. Kui sisu ei mahu, jaga ülesanne kaheks kaardiks.
4. **Puuduva info korral küsi, ära otsi laialt.** Ehitaja peatub ja esitab arhitektile ühe täpse küsimuse. Arhitekt vastab ja täiendab kaarti. Vastus läheb kaardile, mitte ainult vestlusesse.
5. **Kaardi ja kehtiva dokumendi vastuolu korral kehtib dokument.** Ehitaja nimetab vastuolu ja arhitekt parandab kaardi või dokumendi.
6. **Olemasolevaid liideseid ei loeta lähtekoodist.** Allikas on kaardi plokk „Otsused ja liidesed“ või genereeritud liideste kokkuvõte `docs/api/` (kaart [TOOL-1](TOOL-1.md)). Kokkuvõte tehakse koodist automaatselt ja kontroll kukub, kui see on aegunud. Seepärast ei ole see käsitsi peetav koodikaart, mis võiks vananeda.
7. **Üleandmine on kaardi lõpus jaotises „Üleandmine“, kuni 25 rida.** Pikk tõend (logid, ekraanipildid) jääb faili ja sellele viidatakse.
8. **Olek kaardi päises:** `kavand` → `ehitamiseks` → `ülevaatusel` → `parandamisel` → `vastu võetud <commit>`. Päises on ka **Rada: A/B** ([WORKFLOW › Kaks rada](../WORKFLOW.md#kaks-rada-tavaline-ja-kaitstud-töö)); see määrab kontrolli ja ülevaatuse mahu.

## Mall

```markdown
# <ID> · <pealkiri>

**Olek:** ehitamiseks · **Rada:** A | B · **Haru:** <haru> · **Alus:** <commit> · **Plaan:** [Mx › Ülesanne N](../plans/…)

## Eesmärk
<1–2 lauset: mis on pärast seda olemas ja kuidas seda märgata>

## Loe (ainult need)
- `03#9-salvestus-ja-projekti-fail`: miks seda vaja on

## Muuda
- Loo: …
- Muuda: …

## Ära puutu
- …

## Otsused ja liidesed
<täpsed signatuurid, DTO-d, konstandid, veakoodid, tekstid; kõik, mida ehitaja muidu otsima läheks>

## Skeem (valikuline)
<Mermaidi skeem, kui see teeb ülesande selgemaks: kasutaja töövoog, moodulite vastutus ja andmete liikumine (pidev nool = praegu, katkendlik = muudatus) või olekud. Väikesel või ilmselgel kaardil jäta ära.>

## Tõend
- Testid (nimega): …
- Käsud: `…` → oodatav tulemus

## Valmis kui
- [ ] …

## Üleandmine
<ehitaja täidab: muudetud failid; käsk → tegelik tulemus; kõrvalekalle ja põhjus; küsimus arhitektile>
```
