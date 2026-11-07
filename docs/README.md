# PCB Kaardistaja: ehituse dokumentatsioon

**PCB Kaardistaja** (töönimi) on kohalik töölaua-äpp elektroonika parandajale. Kui plaadi skeemi pole, kaardistab ta plaadi foto põhjal komponendid, jalad ja ühendused, annab võrkudele rolli (GND, 5 V, 12 V …), kirjutab üles oma mõõtmised ja jõuab lõpuks valmis skeemi ning remondiraportini.

Need dokumendid on ehituse alus. Kui kood ja dokumendid lähevad lahku, otsustab inimene, kumb muutub. Vaikimisi parandatakse koodi.

## Lugemise järjekord

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

Otsused: [ADR-002 TypeScript + Tauri](adr/ADR-002-typescript-tauri.md) (kehtiv), [ADR-003 frontend ja backend eraldi](adr/ADR-003-frontend-backend.md) (ettepanek), [ADR-001 Flutter](adr/ADR-001-keel-ja-platvorm.md) (asendatud).

## Lähtematerjal

- Veebiprototüüp: [prototype/PCB-Kaardistaja.html](../prototype/PCB-Kaardistaja.html), lähtekood [prototype/src/](../prototype/src/). Sealt porditakse korpuste generaatorid (`prototype/src/js/01-footprints.js`), võrkude arvutus (`prototype/src/js/02-state.js` → `getNets`), joonistusloogika (`prototype/src/js/03-render.js`), eksport (`prototype/src/js/06-io.js`) ja visuaalne keel (`prototype/src/app.css` tokenid). Uue äpi `src/` kaust on prototüübist eraldi.
- BenchBeep (`C:\dev\TraceBench`): ainult ideed ja õppetunnid, mitte lõplik tõde. Vt [08](08-benchbeepi-opetused.md).

## Kolm reeglit, mis kehtivad kõikjal

1. **Kasutaja mugavus ja lihtsus on kõige tähtsam.** Iga uus nupp, väli või samm peab end ära teenima.
2. **Iga võimalus on eraldi moodul.** Moodul lisatakse ühe reaga registrisse; ühtegi „kõik ühes failis“ ekraani ei tehta.
3. **Äpp töötab täielikult ilma AI ja internetita.** AI on hiljem lisanduv abiline, kes pakub, aga ei otsusta.
