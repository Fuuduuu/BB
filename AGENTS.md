# BB / PCB Kaardistaja: AI töö algus

BB on kohalik PCB kaardistamise ja remondi töölaud. Kasutaja mugavus, lihtsus ja andmete õigsus on esikohal. Toote eesmärgi omanik on [01-pohimotted](docs/01-pohimotted.md).

## Rollid

Claude on arhitekt. Ta hoiab arhitektuuri, andmemudelit ja ADR-e, kirjutab verstapostide teostusplaanid ning vaatab ehitaja muudatused enne commiti üle. Codex on ehitaja. Ta teeb kasutaja ülesandel plaani järgi koodi ja testid, jooksutab kontrollid ning annab tulemuse üle. Kasutaja kinnitab ADR-id ja verstapostid, teeb visuaalse vastuvõtu ning annab loa commitiks ja pushiks. Täpne tööjaotus on [teekaardil](docs/07-teekaart.md#rollid).

Ehitaja esitab arhitektuuri, andmemudeli või lepingu vajaliku muudatuse arhitektile ettepanekuna. Verstaposti ehitus algab arhitekti teostusplaani (`docs/plans/Mx-*.md`) ja kasutaja ülesande alusel.

## Uue AI seansi, üleandmise ja konteksti taastamise alguses

1. Loe [STATUS](docs/STATUS.md): mis on tehtud, mis on pooleli ja mida teha järgmisena.
2. Loe [WORKFLOW](docs/WORKFLOW.md): töö piir, kontrollid, mälu ja üleandmine.
3. Tee [SKILLS](docs/SKILLS.md) järgi oskuste valik ja lae asjakohased juhised enne muudatusi.
4. Kui ülesandel on kaart `docs/tasks/<id>.md`, loe kaart ja selle „Loe“-loend (`bb_task <id>`), rohkem mitte; vt [snaipriülesanded](docs/tasks/README.md). Muul juhul loe ainult ülesannet puudutavad tootedokumendid, lähtekood ja testid; kasuta [dokumendikaarti](docs/README.md).
5. Kontrolli päris repo, haru, HEAD-i ja tööpuu muudatusi. STATUS ja vestluse kokkuvõte ei asenda Git-i ega koodi.

See on lühike stardikomplekt. Sama seansi järgmise ülesande puhul kontrolli muutunud seisu ja tee uus oskuste valik; muutumata juhiseid pole vaja uuesti tervikuna laadida. Kõiki spetsifikatsioone, ülevaatusi ja arhiive ei loeta iga kord uuesti.

Kui selles seansis on BB MCP tööriistad saadaval, alusta `bb_status`-est: see sisaldab päris Git-i seisu ja STATUS-e sisu, mida ei pea kohe uuesti failist lugema. Leia vajalik jaotis `bb_outline` ja `bb_read_section` abil ning pärast dokumendimuutust käivita `bb_check_docs`. Täpne kasutus ja piirangud on [WORKFLOW-s](docs/WORKFLOW.md#bb-mcp-ühised-repo-tööriistad) ning [serveri juhendis](tools/mcp-bb/README.md).

Kontrolli tööriistade olemasolu oma aktiivses seansis. Kui BB MCP pole saadaval, kasuta samu repo faile ja Git-i otse; serveri puudumine ei peata tavapärast tööd. Ülevaatuse postkasti saatmine on eraldi kasutaja tellitud kirjutav tegevus.

## Kust leida vajalik teadmine

| Küsimus | Allikas |
|---|---|
| Mis on eesmärk ja mida v1 teeb? | [01](docs/01-pohimotted.md) ja [07](docs/07-teekaart.md) |
| Kuidas kasutaja töötab? | [02](docs/02-kasutaja-teekond.md) ja [06](docs/06-kasutajaliides.md) |
| Kuidas kihid, käsud ja salvestus töötavad? | [03](docs/03-arhitektuur.md), asjakohane [ADR](docs/adr/) |
| Millised on andmereeglid ja moodulite vastutused? | [04](docs/04-andmemudel.md) ja [05](docs/05-moodulid.md) |
| Mis vigu tuleb vältida? | [08](docs/08-benchbeepi-opetused.md); konkreetse probleemi test ja sihitud ülevaatus |
| Kus töö pooleli jäi? | [STATUS](docs/STATUS.md) |

## Töö piirid

- Järgi kasutaja viimast ülesannet. Teekaart, ülevaatus või varasema AI soovitus ei käivita iseenesest uut tööd.
- Erista ettepanek, vastu võetud otsus, teostatud kood, läbitud kontroll ja inimese visuaalne vastuvõtt. Ära märgi neid üheks staatuseks.
- ADR staatusega „Ettepanek“ ei muutu AI heakskiiduga kehtivaks otsuseks. Vastuolu korral nimeta täpne otsust vajav koht ja jätka sellest sõltumatut tööd.
- Hoia kasutaja ja teiste AI-de pooleliolevad muudatused alles. Ära kirjuta teise tegija muudetavat faili üle; vajadusel eralda tööd failide või tööpuudega.
- Commit, push, avaldamine ning üldiste AI-seadistuste või pluginapaigalduse muutmine vajavad vastavat kasutaja ülesannet.
- Kasuta katsetes sünteetilisi või eraldi kopeeritud projekte. Ära katseta andmekadu päris kasutajaprojektiga.

## Töö lõpus

Kontrolli tulemust tehtud muudatusele vastavalt. Uuenda [STATUS](docs/STATUS.md), kui teostus, pooleliolev töö, kontrollid või järgmine samm muutusid. Püsiv teadmine läheb oma olemasolevasse dokumenti; selle käsitlus on [WORKFLOW](docs/WORKFLOW.md) mälutabelis.

Vasta eesti keeles: tulemus, tegelikud kontrollid, oluline piirang ja järgmine nähtav samm. Sama reeglistik kehtib Codexile, Claude'ile, Geminile ja teistele abilistele.
