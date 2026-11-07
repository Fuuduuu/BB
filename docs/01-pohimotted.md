# 01 · Põhimõtted

## Kellele ja milleks

**Kasutaja:** elektroonika parandaja töölaua taga. Tal on käes plaat, multimeeter ja telefon või kaamera. Skeemi tal pole.

**Olukord:** seade ei tööta. Parandaja peab aru saama, kust toide tuleb, kuhu see jõuab ja kus see kaob. Selleks peab ta teadma, mis komponendid plaadil on, kuidas need on ühendatud ja mida ta on juba mõõtnud.

**Äpi lubadus:** *pildista → märgi → ühenda → mõõda → leia viga → skeem valmis.* Ühes töölaual, plaadi foto peal, ilma et peaks täitma tabeleid või pidama paberil märkmeid.

**Lõpptulemus:**
- plaadi kaart: foto ja selle peal komponendid, jalad, rajad ja mõõdud millimeetrites;
- võrguloend koos rollidega (GND, 5V, 12V …);
- loogiline skeem, mis tekib kaardistusest automaatselt;
- mõõtmiste ja remonditoimingute logi;
- remondiraport (PDF/HTML), võrguloend (CSV), BOM (CSV) ja joonised (SVG/PNG).

## Kasutajakogemuse põhimõtted

Need on tähtsuse järjekorras. Kui kaks põhimõtet lähevad vastuollu, võidab ülemine.

1. **Plaat on keskel ja kasutaja jääb plaadi juurde.** Kõik põhitöö käib lõuendil ja selle kõrval olevas kontekstipaneelis. Eraldi vorme, tabeleid ja viisardeid põhitöö jaoks ei tehta.
2. **Kohe tööle.** Äpi avamisest esimese komponendi paigutamiseni on maksimaalselt 3 klõpsu ja 0 kohustuslikku välja. Foto, mõõtkava, seadme nimi ja probleemi kirjeldus on soovitatavad, mitte kohustuslikud.
3. **Üks asi = üks objekt.** Füüsiline komponent on äpis täpselt üks objekt. See on sama objekt, mida lohistad, mille suurust muudad, mida mõõdad ja mis on skeemil. Kandidaati ja kinnitatud koopiat eraldi ei ole.
4. **Otsene muutmine, alati tagasivõetav.** Muudatus jõustub kohe, eraldi „Salvesta“ nuppu komponendi muutmiseks ei ole. `Ctrl+Z` võtab tagasi kõik, ka kustutamise. Projekt salvestub ise. Ainus teadlik kinnitus on mõõtmise salvestamine (`Enter`), sest mõõtmine on kirje.
5. **Valik ei kao ega vahetu iseenesest.** Kui kasutaja valis jala U1.4, jääb see sihtmärgiks seni, kuni ta ise valib teise. Tööriista, filtri või paneeli vahetus valikut ei muuda (BenchBeepi vead BB-01, BB-04 ja BB-11).
6. **Äpp juhatab, aga ei sunni.** Paneel „Järgmine samm“ soovitab, mida teha (nt „Kalibreeri mõõtkava“). Töövoo sammud on edenemise näitaja, mitte väravad: iga tööriist on alati kasutatav.
7. **Klaviatuur kiirendab, hiir piisab.** Kõik on tehtav hiirega. Korduvtegevustel (mõõtmine, ühendamine, paigutamine) on kiirklahvid ja `Ctrl+K` käsupalett.
8. **Ausus.** Viga ei näidata kunagi õnnestumisena. Salvestamise olek on alati näha. Kahtlane või ebakindel info on visuaalselt eristatud.
9. **Eesti keel, töökoja sõnavara.** Kasutatakse sõnu Koht, Väärtus, Ühik, Võrk, Roll, Jalg, Rada, „Mõõdetud siin“, „Võrdluseks“ ja „Kinnitamata“, mitte tehnilisi ega programmeerimise termineid.

## Info usaldusväärsus: kolm taset

Remondis on tähtis teada, kust mingi teadmine pärineb. BenchBeep tegi selle jaoks keeruka sündmuste torustiku. Siin on see lihtne: ühendusel on väli `basis` (oletatud või nähtud) ja tase „mõõdetud“ arvutatakse kehtivatest läbivusmõõtmistest ([04 › Ühenduse tase](04-andmemudel.md#ühenduse-tase-connectionlevels)):

| Tase | Tähendus | Näide | Välimus |
|---|---|---|---|
| **Oletatud** | kasutaja arvab, et nii on | „see jalg läheb ilmselt GND-sse“ | katkendjoon |
| **Nähtud** | paistab fotol või plaadil | rada on fotol selgelt näha | pidev joon |
| **Mõõdetud** | multimeeter kinnitas | läbivuse test piiksus | pidev joon ja väike ✓-märk |

Reeglid:
- Ühenduse vaikimisi tase sõltub sellest, kuidas see tekkis: rajatööriist annab *nähtud*, piiksumisrežiim annab *mõõdetud*, kiirühendus (`C`) annab *oletatud*.
- *Mõõdetud* on ühendus seni, kuni samade jalgade vahel on kehtiv piiksuv läbivusmõõtmine. Mõõtmise kustutamise või remondi järel langeb ühendus tagasi *nähtud* või *oletatud* tasemele. Käsitsi mõõdetuks märkimist ei ole.
- Piiks tõendab väikest takistust, mitte tingimata sama vaskrada. Mõõtmine salvestatakse alati, aga jalad samasse võrku ühendada on tehniku otsus ([04 › Piiks](04-andmemudel.md#piiks-ei-tõenda-sama-vaskrada)).
- Komponendil on olek **Tuvastatud / Tuvastamata**. Tuvastamata on kõik, mille väärtus või tüüp on kahtlane; nimekirjas ja skeemil kuvatakse see küsimärgiga.
- Mõõtmine on alati kasutaja sisestatud väärtus. Äpp ega AI ei loo mõõtmisi kunagi ise.
- Remondi järel jäävad varasemad mõõtmised alles märkega **„enne remonti“** ja neid ei kasutata enam kehtivate hinnangutena.

## Mida v1 teeb

- Projekt: loomine, avamine, viimased projektid, automaatsalvestus, üks fail `.pcbk`.
- Foto: avamine, lohistamine, kleepimine; nähtavus, kontrast, hall; pööramine ja peegeldamine.
- Mõõtkava: kahe punktiga kalibreerimine või teadaoleva korpuse joondamisest.
- Komponendid: parameetriline teek (~40 korpust, prototüübist), paigutamine, liigutamine, pööramine, **suuruse muutmine**, **kahe jala joondus**, teisele poolele, dubleerimine, kohandatud komponent.
- Jalad: automaatselt korpusest, oma jalgade lisamine, nimed, **selgelt eristatavad olekud**.
- Ühendused: rajatööriist vahepunktidega, kiirühendus, **piiksumisrežiim** (läbivuse mõõtmisega võrkude kaardistamine).
- Võrgud: automaatne tekkimine, nimed, **rollid koos värvidega** (GND, 3V3, 5V, 12V, signaal, oma rollid), rollikonflikti hoiatus.
- Mõõtmised: pinge, takistus, diood, läbivus; toite olek; kiirsisestus; automaatne hinnang (OK / madal / kõrge / lühise kahtlus); mõõtmiste nimekiri.
- Vigade otsing: kahtlaste jalgade vaade, märkused, kahjustatud alad fotol, remonditoimingud koos „enne remonti“ märkimisega.
- Mõõtjooned ja plaadi kontuur millimeetrites.
- Skeemivaade: automaatselt genereeritud loogiline skeem (sümbolid, võrgusildid, toite- ja maandussümbolid), mida saab ümber paigutada.
- Kaardistuse valmidus: edenemine ja kontrollnimekiri.
- Eksport: SVG 1:1 mm, PNG, võrguloend CSV, BOM CSV, mõõtmised CSV, remondiraport (HTML/PDF), projekti JSON.
- Prototüübi `.pcbmap.json` import.

## Mida v1 ei tee (hiljem)

- AI: fotoanalüüs, komponentide tuvastus, soovitused, remondikokkuvõtted ([03 › AI liides](03-arhitektuur.md#13-ai-liides-hilisem)).
- Kahe poole (pealmine ja alumine) fotode joondus üksteise peale ja perspektiivi parandus (M5).
- Mõõteriista otseühendus (seriaal/Bluetooth-multimeeter).
- Telefoni abirakendus pildistamiseks.
- KiCadi eksport (skeem/netlist), andmelehtede automaatne otsing.
- Pilv, kontod, mitme kasutaja koostöö.

## Sõnastik

| Sõna | Tähendus äpis |
|---|---|
| **Plaat** | üks projekt: üks trükiplaat koos fotode ja kogu kaardistusega |
| **Komponent** | füüsiline detail plaadil (R1, U2, J1); on alati üks objekt |
| **Korpus** | komponendi füüsiline kuju ja jalgade paigutus (SOIC-8, 0805, TO-220) |
| **Jalg** | komponendi kontakt või padjand (U1.4); võib olla ka plaadi punkt (testpunkt, via) |
| **Punkt** | üksikjalaga objekt plaadil: testpunkt, via, padjand, juhtme jootekoht, kinnitusava |
| **Ühendus** | kahe koha vaheline elektriline side: joonistatud rada, juhe või mõõdetud läbivus |
| **Võrk** | kõik omavahel ühendatud jalad; tekib ühendustest ise |
| **Roll** | võrgu tähendus: GND, 5V, 12V, signaal …; määrab värvi ja oodatava pinge |
| **Mõõtmine** | kasutaja sisestatud näit: koht, väärtus, ühik, toite olek |
| **Hinnang** | äpi võrdlus oodatuga: OK, madal, kõrge, lühise kahtlus, — |
| **Remonditoiming** | kasutaja märgitud tegevus (vahetasin C3); muudab varasemad mõõtmised „enne remonti“ olekusse |
| **Mõõtkava** | pikslite arv millimeetri kohta fotol (`px/mm`) |
| **Skeem** | loogiline vaade: sümbolid ja võrgud ilma füüsilise asukohata |
