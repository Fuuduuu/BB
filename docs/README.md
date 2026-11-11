# PCB Kaardistaja: ehituse dokumentatsioon

**PCB Kaardistaja** (töönimi) on kohalik töölaua-äpp elektroonika parandajale. Kui plaadi skeemi pole, kaardistab ta plaadi foto põhjal komponendid, jalad ja ühendused, annab võrkudele rolli (GND, 5 V, 12 V …), kirjutab üles oma mõõtmised ja jõuab lõpuks valmis skeemi ning remondiraportini.

Need dokumendid on ehituse alus. Kui kood ja dokumendid lähevad lahku, otsustab inimene, kumb muutub. Vaikimisi parandatakse koodi.

## AI lühike stardikomplekt

Alusta [AGENTS-ist](../AGENTS.md), seejärel loe [STATUS](STATUS.md), [WORKFLOW](WORKFLOW.md) ja [SKILLS](SKILLS.md). Claude-arhitekt loeb enne neid [ARHITEKT](ARHITEKT.md)-i. Need annavad jooksva seisu, töövõtted, mälu käsitluse ning enne töö alustamist vajalike oskuste valiku.

[Rollijaotus ja töö üleandmise järjekord](07-teekaart.md#rollid) on teekaardil.

Allolevad 01–08 on toote ja ehituse teemade omanikud. Loe neist ainult praeguse ülesandega seotud osi; arhitektuuri ADR-i või pika ülevaatuse lugemine on vajaduspõhine. Jooksev tööseis asub ainult STATUS-es.

Kui BB MCP on seansis saadaval, kasuta jaotiste lugemiseks ja ühisteks kontrollideks [serveri tööriistu](../tools/mcp-bb/README.md); tööjärjekord ja piirangud on [WORKFLOW-s](WORKFLOW.md#bb-mcp-ühised-repo-tööriistad). Vajadusel saab samu faile lugeda otse.

## Toote ja ehituse dokumendikaart

| # | Dokument | Mida see otsustab |
|---|---|---|
| 01 | [Põhimõtted](01-pohimotted.md) | Kellele äpp on, mis on tähtis, mida v1 teeb ja mida mitte, sõnastik |
| 02 | [Kasutaja teekond](02-kasutaja-teekond.md) | Kogu töövoog äpi avamisest kuni mõõtmiste ja valmis skeemini: ekraan ekraani haaval |
| 03 | [Arhitektuur](03-arhitektuur.md) | Tehnoloogia, kihid, moodulisüsteem, käsud ja tagasivõtmine, salvestus, AI liides, testimine |
| 04 | [Andmemudel](04-andmemudel.md) | Kõik andmeobjektid, väljad, ühikud, projekti fail, versioonid, hindamisreeglid |
| 05 | [Moodulid](05-moodulid.md) | Iga mooduli vastutus, tööriistad, paneelid ja käsud; uue mooduli mall |
| 06 | [Kasutajaliides](06-kasutajaliides.md) | Paigutus, värvid, jalgade ja võrkude tähistus, klahvid, tekstid, tühjad olekud |
| 07 | [Teekaart](07-teekaart.md) | Verstapostid M0–M6 ja iga verstaposti „valmis kui“ tingimused |
| 08 | [BenchBeepi õppetunnid](08-benchbeepi-opetused.md) | Mis vanast projektist võetakse üle ja mida enam kunagi ei korrata |

## Töö dokumendid

| Kus | Mis | Kes kirjutab |
|---|---|---|
| [STATUS](STATUS.md) | jooksev seis ja järgmine samm | iga tegija töö lõpus |
| [plans/](plans/) | verstaposti teostusplaan (ülesannete järjekord, ühised piirangud, vastuvõtt) | arhitekt |
| [tasks/](tasks/README.md) | ühe ülesande kaart koos otsuste, testide ja üleandmisega | arhitekt kirjutab, ehitaja täidab üleandmise |
| [api/](api/) | koodist genereeritud avalike liideste kokkuvõte (`pnpm api`), ära muuda käsitsi | tööriist |

Otsused: [ADR-002 TypeScript + Tauri](adr/ADR-002-typescript-tauri.md) (kehtiv), [ADR-003 frontend ja backend eraldi](adr/ADR-003-frontend-backend.md) (kehtiv), [ADR-004 Plaat ja Skeem ühel mudelil](adr/ADR-004-kaks-vaadet-ja-uhendused.md) (kehtiv), [ADR-001 Flutter](adr/ADR-001-keel-ja-platvorm.md) (asendatud).

Kasutaja tellitud [Codexi iseseisev tervikettepanek](review/2026-11-07-codex-tervikplaan.md): foto → komponendid → muudetav skeem → mõõtmised → märgistatud rajad. Uuring ja soovitus; ei asenda vastuvõetud otsuseid ega muuda 01–08 automaatselt.

## Lähtematerjal

- Veebiprototüüp: [prototype/PCB-Kaardistaja.html](../prototype/PCB-Kaardistaja.html), lähtekood [prototype/src/](../prototype/src/). Sealt porditakse korpuste generaatorid (`prototype/src/js/01-footprints.js`), joonistusloogika (`prototype/src/js/03-render.js`), eksport (`prototype/src/js/06-io.js`) ja visuaalne keel (`prototype/src/app.css` tokenid). Prototüübi läheduse põhjal võrke arvutavat `getNets`-i (`prototype/src/js/02-state.js`) uude äppi **ei porta**; seda kasutatakse ainult prototüübi impordi võrdluseks ([ADR-004](adr/ADR-004-kaks-vaadet-ja-uhendused.md)). Prototüüp on käitumise ja geomeetria allikas, mitte uue äpi tuum. Uue äpi kood (`apps/`, `packages/`) on prototüübist eraldi.
- BenchBeep (`C:\dev\TraceBench`): ainult ideed ja õppetunnid, mitte lõplik tõde. Vt [08](08-benchbeepi-opetused.md).

## Kolm reeglit, mis kehtivad kõikjal

1. **Kasutaja mugavus ja lihtsus on kõige tähtsam.** Iga uus nupp, väli või samm peab end ära teenima.
2. **Iga võimalus on eraldi moodul.** Moodul lisatakse ühe reaga registrisse; ühtegi „kõik ühes failis“ ekraani ei tehta.
3. **Äpp töötab täielikult ilma AI ja internetita.** AI on hiljem lisanduv abiline, kes pakub, aga ei otsusta.
