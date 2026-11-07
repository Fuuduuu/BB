# PCB Kaardistaja (töölaud): disain

> **ASENDATUD.** Kehtiv kirjeldus on [docs/README.md](../../README.md) dokumentides 01–08. Siinsed mõõtmiste hindamise reeglid ja jala olekud on üle viidud failidesse [02-kasutaja-teekond.md](../../02-kasutaja-teekond.md) ja [04-andmemudel.md](../../04-andmemudel.md).

**Kuupäev:** 2026-11-07 · **Keel ja platvorm:** [ADR-001](../../adr/ADR-001-keel-ja-platvorm.md) · **Prototüüp:** [PCB-Kaardistaja.html](../../../prototype/PCB-Kaardistaja.html), lähtekood `prototype/src/`

## Eesmärk

Kohalik Windowsi äpp, millega elektroonikaparandaja kaardistab skeemita plaadi foto põhjal. Ta paneb paika komponendid ja jalad, märgib ühendused ja annab võrkudele rolli (GND, 5 V, 12 V …). Seejärel kirjutab ta üles oma mõõtmised ja näeb kohe, kus mõõdetud väärtus ei vasta oodatule. Kood on moodulipõhine, et uue võimaluse saaks lisada eraldi kaustana.

## Kasutaja töövoog

1. **Foto:** ava plaadi foto. Muuda nähtavust (liugur foto all), kontrasti, halltooni; pööra või peegelda (alumine pool).
2. **Mõõtkava:** märgi kaks punkti ja sisesta kaugus millimeetrites. Kõik korpused ja mõõdud on edaspidi millimeetrites.
3. **Komponendid:** vali teegist parameetriline korpus ja paiguta. **Suurust saab muuta** käepidemetega, numbritega (laius, kõrgus, samm) ja **kahe jala joondusega**: lohista jalg 1 ja viimane jalg foto peale ning asukoht, pööre ja mõõtkava arvutatakse ise.
4. **Jalad:** jalad on **selgelt eristatavad**. Igal jalal on number, jalg 1 on ruudukujuline, ekraanil on jalg alati vähemalt 10 px suurune ning olek on näha värvi ja kujuga (tabel allpool). Juurde saab lisada omi jalgu ja anda neile nimesid.
5. **Ühendused:** joonista rada jalalt jalale (vahepunktidega). Igal ühendusel on **alus**: *nähtud* (fotol), *mõõdetud* (läbivuse piiks) või *oletatud*. Ühendustest tekivad võrgud automaatselt.
6. **Võrgu roll:** igale võrgule saab anda rolli. Vaikimisi rollid on GND (0 V), 3V3 (3,3 V), 5V (5 V), 12V (12 V), signaal ja teadmata; oma rolle saab juurde lisada (nt 24V, VBAT). Rajad ja jalad võtavad rolli värvi.
7. **Mõõtmised:** vali jalg ja salvesta mõõtmine. Režiimid on pinge, takistus, diood ja läbivus; lisaks toite olek (toitega / toiteta) ja märkus. Pinge vaikimisi vastaspunkt on GND-võrk. Äpp võrdleb tulemust võrgu rolliga ja märgib jala roheliseks (OK) või punaseks (madal/kõrge/lühis kahtlus).
8. **Mõõtjooned:** füüsilised mõõdud millimeetrites (jalgade külge haakuvad mõõtjooned) ja plaadi kontuur koos laiuse ja kõrgusega. Kontuuri vasak ülanurk on koordinaatide nullpunkt.
9. **Eksport:** projektifail, SVG 1:1 mm, PNG ning CSV (võrguloend, komponendid, mõõtmised).

## Jala olekud (prioriteedi järjekorras)

| Olek | Kuidas tekib | Välimus |
|---|---|---|
| Kahtlane | viimane mõõtmine on madal, kõrge või lühise kahtlusega | punane paks rõngas |
| Mõõdetud OK | viimane mõõtmine OK | roheline rõngas, väärtus väikese sildina |
| Ühendatud | jalg on võrgus | täidetud võrgu rolli värviga |
| Ühendamata | võrku pole | ainult kontuur |
| Valitud (lisaks) | kasutaja valis | paks valikurõngas, kogu võrk esile tõstetud |

## Mõõtmise hindamine (fikseeritud väärtused)

- **Pinge, toitega**, kui võrgu rollil on nimipinge `V0`: OK, kui `|v − V0| ≤ max(0,1 V; 0,1·V0)`; madalam on `low`, kõrgem on `high`.
- **Takistus toitevõrgu ja GND vahel** alla 1,0 Ω: `shortSuspected`.
- **Läbivus = jah** kahe võrgu vahel, mille rollid on erinevad ja kumbki pole `signal`/`unknown`: `shortSuspected`.
- Kõik muu (ka siis, kui võrgul pole nimipinget): `noExpectation`, kuvatakse neutraalselt.
- Kui kaks eri rolliga võrku saavad ühenduse kaudu ühte liidetud, ei kirjutata ühtegi rolli üle. Võrk saab oleku **rollikonflikt** ja kasutajale näidatakse hoiatust „Võimalik lühis või vale ühendus“.

## Arhitektuur

- **`core/`**: puhas Dart, ilma Flutteri sõltuvuseta. Mudel (Board, Component, Pin, Connection, NetRole, Measurement), geomeetria, võrkude arvutus, käsud koos tagasivõtmisega (Command-muster) ja JSON-salvestus.
- **`modules/<nimi>/`**: iga võimalus on klass, mis realiseerib liidese `AppModule`. Moodul toob kaasa oma tööriistad, külgpaneeli vahekaardid, lõuendi kihid ja käsud. Registreerimine käib ühes failis `app/module_registry.dart`.
- **`app/`**: kest (ülariba, tööriistariba, külgpaneel, lõuend, alumine riba), mis küsib registrilt, mida näidata. Kest ei tea konkreetsetest moodulitest midagi.
- **Olek:** Riverpod (`flutter_riverpod`, sama mis BenchBeepis). `ProjectController` hoiab tahvlit ja käsupinu.
- **Salvestus:** projektikaust `Nimi.pcbk/` sisaldab faile `project.json` ja `photos/`. JSON-võtmed on snake_case kujul ja BenchBeepiga ühilduvad (`component_id`, `pin_id`, `mode`, `power_state`, `confirmation_basis`). Skeemi versioon on `schema_version: 1`.
- **Prototüübist import:** veebiversiooni `.pcbmap.json` saab avada (komponendid, jalad, rajad, mõõdud, foto).

## Pole selles versioonis

Mõõteriista otseühendus, BenchBeepi otseimport, mitme foto joondamine (pealmine ja alumine pool üle teineteise), automaatne komponendituvastus, pilvesünk.
