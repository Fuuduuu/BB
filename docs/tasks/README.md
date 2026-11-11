# Snaipriülesanded

Snaipriülesanne on **üks kaart** `docs/tasks/<id>.md`, kus on kõik, mida ehitaja ühe ülesande jaoks vajab. Kogu dokumentatsiooni ja koodi pole vaja iga kord läbi lugeda. Ehitaja loeb [AGENTS](../../AGENTS.md)-i, kaardi ja kaardi „Loe“-loendi, mitte rohkem.

Verstaposti plaan (`docs/plans/Mx-*.md`) jääb ülevaateks: ülesannete järjekord, ühised piirangud ja vastuvõtt. Kaart on ühe ülesande täitmise ühik. Arhitekt kirjutab kaardi vahetult enne ülesande algust, kui eelmine ülesanne on vastu võetud ja tegelik seis teada.

Kaardid asuvad põhikaustas `C:\Users\TRUMPIT\Desktop\BB\docs\tasks\`, samamoodi nagu ühine STATUS. Eraldi tööpuus töötav ehitaja loeb kaarti sealt ja kirjutab üleandmise sama kaardi lõppu. Koodi ja testid teeb ta oma tööpuus.

Kaarte on kõige lihtsam lugeda MCP tööriistaga `bb_task`. See tagastab kaardi koos „Loe“-loendi dokumendijaotistega ühe päringuga. Ilma MCP-ta loe kaart ja loendi read käsitsi.

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

## Tõend
- Testid (nimega): …
- Käsud: `…` → oodatav tulemus

## Valmis kui
- [ ] …

## Üleandmine
<ehitaja täidab: muudetud failid; käsk → tegelik tulemus; kõrvalekalle ja põhjus; küsimus arhitektile>
```
