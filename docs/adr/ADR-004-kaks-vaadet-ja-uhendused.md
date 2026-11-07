# ADR-004: Plaat ja Skeem ühel elektrilisel mudelil, teadlikud ühendused ja ehitusjärjekord

**Staatus:** Vastu võetud (kasutaja otsus 2026-11-07); dokumendid 01–08 on selle järgi muudetud
**Kuupäev:** 2026-11-07
**Otsustaja:** kasutaja
**Täpsustab:** [ADR-003](ADR-003-frontend-backend.md) (tehnoloogia ja mootori piir jäävad samaks)
**Alus:**
- Codexi [tervikplaan](../review/2026-11-07-codex-tervikplaan.md);
- Gemini vastulause, mille kohaselt Codexi 11 objektiga mudel on v1 jaoks liiga suur;
- Codexi täpsustused kompromissile.

Leidude kaupa otsused on failis [ülevaatuste otsused](../review/2026-11-07-ulevaatuste-otsused.md#kolmas-ring-codexi-tervikplaan).

## Kontekst

Kasutaja jaoks on kõige tähtsam järgmine töövoog: **foto taustaks → komponendid peale → muudetav skeem → ühenduste mõõtmine → märgistatud rajad**. Senises kavandis oli kolm põhimõttelist puudust:

1. **Skeem oli ainult tuletatud vaade ja tuli alles M4-s.** Komponent ei saanud olla olemas ilma fotol oleva asukohata. Nii ei saanud skeemil alustada ega plaadile paigutamata komponenti hoida.
2. **Elektriline ühendatus sõltus geomeetriast.** Raja vaba ots liitus teise rajaga, kui see oli `0,25 mm · pxPerMm + laius/2` kaugusel. Mõõtkava muutmine või joone nihutamine võis seega võrke muuta.
3. **Mõned piirjuhud olid lahendamata:**
   - piiks ühendas jalad vaikimisi;
   - `Esc` salvestas vastuse „ei“;
   - äpp valis musta sondi kasutaja eest;
   - uus komponent sai väljamõeldud väärtuse („10k“);
   - komponendi kustutamise järel ei läbinud oma eksport impordikontrolli.

Codex pakkus EDA tarkvara (KiCad, LibrePCB) eeskujul 11 eraldi andmeobjekti. Gemini leidis, et sama kasu saab väiksema mudeliga. Codex nõustus sellega viie täpsustusega.

## Otsus

### 1. Üks komponent, kaks valikulist paigutust

`Component` on endiselt **üks objekt**. Sellel on stabiilne jalgade loend ja kaks valikulist esitust:
- `board?`: korpus, asukoht fotol, pööre, pool ja suurus;
- `schematic?`: sümbol ja asukoht skeemil.

Kui `board` puudub, on komponent loendis „Plaadile paigutamata“. Kui `schematic` puudub, on see loendis „Skeemile paigutamata“. Paigutamine plaadile või skeemile **ei loo teist komponenti**: id, jalad, ühendused ja mõõtmised jäävad samaks.

**Jalgade vastavus:** iga korpuse padjand ja iga sümboli kontakt viitab samale stabiilsele jalale (`Pin.id`). Komponendi tähise või jala nime muutmine ühendusi ei muuda. Tundmatu korpusega komponent on skeemil nummerdatud kast, kuni kasutaja jalgade funktsiooni määrab. Korpuse numbrid `1, 2, 3` ei tähenda iseenesest `B, C, E`.

### 2. Ühendus on teadlik otsus, joonistus on eraldi

`Connection` on **üks objekt**:
- kahe otsaga, mis on kas jalad või liitepunktid (`Junction`);
- alusega „oletatud“ või „nähtud“;
- valikulise joonistusega fotol (`board?`: kiht, käänud, laius) ja skeemil (`schematic?`: käänud).

Fotojoonistuseta ühendus on õhujoon, mille saab peita.
- **Võrk** on jalgade ja liitepunktide ühendatud hulk, mis arvutatakse ainult ühendustest. Kaugus, ristumine, mõõtkava ega suum ei liida võrke.
- **Haru** loob nähtava liitepunkti ja jagab olemasoleva ühenduse ühe käsuga. Tühjal kohal lõppev rada lõpeb liitepunktis (lahtine ots), mitte varjatud ühendusega lähima rajaga.
- **Kaks eri tegevust:** „Eemalda joonistus“ jätab elektrilise ühenduse alles, „Kustuta ühendus“ eemaldab selle mõlemast vaatest. Mõlemad on tagasivõetavad.
- **Võrgu nimi või roll ei liida võrke.** Kaks eraldi GND-nimega ala võivad remondis olla just see leid, mida otsitakse.
- **Liitepunkti eemaldamine** käsitleb sellele ankurdatud sildid sama käsu sees: tõstab need asendavale jalale või allesjäänud võrguliikmele, muidu kustutab ja ütleb seda. Katkist ankrut ei teki.

### 3. Mõõtmine, piiks ja ajalugu

- **Musta sondi valib kasutaja.** Äpp võib pakkuda GND-jalga ühe klõpsuga soovitusena. Valik jääb mõõtmisjada ajaks lukku. Toite algolek on „Teadmata“.
- **Klaviatuur:** `Tab` liigub vormiväljade vahel, järgmisele või eelmisele jalale viib `Alt+↓` / `Alt+↑` (ja nupud). Sisestusväljas lõuendi täheklahvid ei tööta.
- **Piiksumisrežiim** on kaardistamise tööriist, seega:
  - `Enter` = nupp **„Piiksub ja ühenda“** (mõõtmine ja ühendus ühe käsuga);
  - `Shift+Enter` = **„Ainult mõõtmine“**;
  - `N` = **„Ei piiksu“**;
  - `Esc` katkestab ega salvesta midagi.

  Tavaline läbivusmõõtmine ei ühenda kunagi. Passiivkomponendi kaitse ja lühistatud komponendi hoiatus on abilised, mitte garantii. Eesmärk „50 jalga alla 2 minuti“ tuleb tõendada kasutuskatsega.
- **Mustand kuulub sondipaarile** (punane ja must sond). Kumma sondi muutmine tahes avab teise paari mustandi ega kanna vana väärtust kaasa.
- **Kustutatud mõõtepunkt:**
  - Mõõtmisel säilivad mõlema sondi id-d, jala eksemplari tunnus (`uid`) ja sildid.
  - Kui jalg või komponent on kustutatud või sama numbriga jalg on vahepeal uuesti loodud (uus `uid`), kuvatakse mõõtmine ajaloos märkega **„kontakt kustutatud“** ning see ei mõjuta võrke, hinnanguid ega ühenduse taset. Tagasivõtmine taastab sama jala ja mõõtmine on jälle aktiivne.
  - Puuduva viite erand kehtib ainult ajaloolisele mõõtmisele, mitte ühendustele ega siltidele.
- **Mõõdetud tase üle liitepunktide:** jalapaari A–B piiks kinnitab A ja B vahelise tee ühendusi, mis läbivad ainult liitepunkte. Haruks jagamine (A–J, J–B) ✓-märki ei kaota.
- **Remont** võib puudutada komponenti, valitud võrke või kogu plaati. Komponendita remondi puhul peab kasutaja ise valima, mida see mõjutab.

### 4. Märgistus

- **Väli `marking`** on korpuselt loetud kood („103“, „A7W“) ja see on tuvastatud väärtusest eraldi.
- **Väli `value`** on vaikimisi tühi. Teegi soovitus võib olla vihje, aga mitte salvestatud fakt.

### 5. Varundus

- **Täiskoopia koos fotodega** tehakse enne migratsiooni ja iga päeva esimesel avamisel.
- **Dokumendikoopia ilma fotodeta** tehakse pideva töö ajal kõige rohkem kord 30 minuti jooksul. See viitab täpselt oma täiskoopiale.
- Kui pärast viimast täiskoopiat on lisandunud foto või manus, tehakse järgmine taastepunkt täiskoopiana.
- Täiskoopiat ei kustutata enne, kui sellest sõltuvaid dokumendikoopiaid enam pole.

### 6. Prototüübi import

Vanad ühendused, mis tekkisid läheduse põhjal, ei tule uude mudelisse kindlate ühendustena:
- otsene jalaviide säilib;
- vaba ots saab lahtiseks liitepunktiks;
- läheduse põhjal arvatud liited lähevad nähtavasse nimekirja „Kontrolli neid ühenduskohti“, kus on valikud „Kinnita liide“ ja „Jäta lahti“.

Eri kihtide juhuslikust kattumisest läbiviiku ei tehta.

### 7. Ehitusjärjekord

- **M0:** vundament koos ühe päris komponendiga (lisa, nimeta, tagasi/uuesti, sulge/ava).
- **M1:** foto, komponendid ja minimaalne mõõtmine.
- **M2:** ühendused, liitepunktid, võrgud ja **lihtne muudetav skeem** (komponent mõlemas vaates, käsitsi paigutus, ühendusjooned skeemil, võrgusildid), piiksumisrežiim.
- **M3:** mõõtmise täisvoog ja remont.
- **M4:** automaatpaigutus abilisena (ELK-i proov), eksport, import kontrollnimekirjaga, väljalase.

Kasutamise järjekord ei pea olema sama mis arendamise järjekord. Parandaja saab mõõta juba M1-s ja kahe vaate koostöö kontrollitakse M2-s, enne kui rakendus suureks kasvab.

## Kaalutud variandid

| | Senine kavand | Codex: 11 objekti | **Kompromiss (valitud)** |
|---|---|---|---|
| Skeem enne fotot | ei | jah | jah |
| Topoloogia geomeetriast sõltumatu | ei | jah | jah |
| Mudeli suurus | väike | suur (Terminal, BoardPlacement, SymbolPlacement, BoardRoute, SchematicWire …) | väike: valikulised väljad komponendil ja ühendusel, lisaks `Junction` |
| Kustutatud jalgade ajalugu | vastuolu impordiga | arhiveeritud jalad | ajalooline viide koos siltidega, olek arvutatakse |
| Skeemi aeg | M4 | enne mõõtmisi | M2, pärast minimaalset mõõtmist |

## Tagajärjed

- **Lihtsamaks läheb:**
  - skeemil saab alustada;
  - komponendi saab lisada kummaski vaates;
  - topoloogia ei muutu kogemata;
  - oma eksport tuleb alati tagasi;
  - mõõtmise sihtmärk ei vahetu ise.
- **Raskemaks läheb:**
  - raja joonistamisel tuleb teha ka liitepunkti ja haru käsk;
  - M2 kasvab skeemivaate võrra;
  - jalgade loend on komponendil nüüd eraldi andmeosa.
- **Hiljem üle vaadata:**
  - ELK-i sobivus 20–50 komponendiga M4-s;
  - kas ühel ühendusel võib olla mitu fotojoonistust (v1: kõige rohkem üks).

## Seotud

[04 › Tüübid](../04-andmemudel.md#tüübid), [02 › Skeem](../02-kasutaja-teekond.md#13-skeem-ja-kaardistuse-valmimine), [05](../05-moodulid.md), [07](../07-teekaart.md)
