# 06 · Kasutajaliides

Visuaalne keel tuleb prototüübist ([prototype/src/app.css](../prototype/src/app.css)): vasepadjandite ja rajaga töövoo riba, solder-maski roheline, vase aktsent, Archivo ja Martian Mono. See dokument fikseerib mõõdud, värvid, olekud, klahvid ja tekstid.

## Paigutus

| Ala | Mõõt | Sisu |
|---|---|---|
| Ülariba | 40 px | navigaatori ja omaduste lülitid (`N`, `O`), projekti nimi ja salvestuse olek, edenemine, **Plaat \| Skeem**, ↶ ↷, `Ctrl+K`, Ekspordi |
| Navigaator (vasak) | 300 px, muudetav 240–420, peidetav (`N`) | Teek · Komponendid · Mõõtmised; vahekaardid ühel real ka 240 px laiuses |
| Lõuend (kesk) | ülejäänu | tööriistariba vasakus servas (40 px nupud), ankru- ja abisildid |
| Kontekstipaneel (parem) | 340 px, muudetav 280–460, alati ülekattena (`O`) | valitud objekti sektsioonid või nähtav kinnitatud sektsioon; peidetud, kui mõlemad puuduvad |
| Paneeli pealkiri | 36 px | paneeli nimi; omaduste paneelil paremal sulgemisnupp (`O`) |
| Mõõteriba (all) | 36 px | foto nähtavus (kohe foto all), kontrast, ⟳, ⇋, poole valik, kihid, „Näita kahtlaseid“, suum, mõõtkava, koordinaadid |

- Minimaalne akna suurus on 1100 × 700. Kontekstipaneel on igal laiusel ülekattena; lõuendi suurus ei muutu. Paneeli avab kasutaja ülariba nupust, `O`-ga või valitud jalal `M`-iga. Uus valik ega kinnitatud sektsiooni nähtavaks muutumine kasutaja peidetud paneeli ei ava.
- Omadused on nähtavad ainult avatud olekus ning valiku või nähtava kinnitatud sektsiooni korral. Ülariba nupp näitab tegeliku nähtavuse järgi „Näita omadusi“ või „Peida omadused“. Kui valikut ega kinnitatud sektsiooni pole, on nupp keelatud pealkirjaga „Omadused · vali komponent või jalg“ ning `O` ei muuda paneeli eelistust.
- Omaduste päise sulgemisnupp peidab paneeli ja viib fookuse ülariba omaduste nupule. Mõlema ülariba paneelinupu vaskne täide järgib `aria-expanded` olekut; täide on ainult avatud paneelil.
- Jala valikul on omadustes kinnitatud Mõõda-plokk, ainult valitud jala kaart (tähis, nimi, NC ja „← Komponent“) ning selle jala mõõtmised. Komponendi valikul jääb alles komponendi vorm koos jalgade tabeliga.
- Paneelide laius ja olek (avatud/kokku pandud) jäävad meelde.
- Navigaatori vahekaardinimed on ilma loendurita. Aktiivse paneeli kohal on 12 px kokkuvõte: näiteks „12 plaadil · 3 paigutamata“, „1 mõõtmine“ või „1500 mõõtmist“. Nulli korral vastav osa puudub; tühjal paneelil ja Teegis kokkuvõtet pole.
- „Komponendid“ all vahetavad filtrinupud „Plaadil (12)“ ja „Paigutamata (3)“ olemasolevaid loendeid. Kui filter on „Plaadil“ ja paigutamata komponente on, märgib neid teisel nupul aktsenditäpp; automaatset filtrivahetust pole. Filter jääb projekti vaates meelde dokumendi revisjoni muutmata; vigane või puuduv väärtus tähendab „Plaadil“.
- Vana vahekaardi `unplaced` id-d eraldi ei teisendata: tundmatu salvestatud id korral avaneb esimene vahekaart „Teek“.
- Tahvli paigutus tuleb M5-s (navigaator sahtlina, kontekst alt üles tõusva lehena).

## Disainitokenid

```css
/* heledas teemas; tumedad väärtused prototüübi prototype/src/app.css @media (prefers-color-scheme: dark) plokis */
--bg:#e8ede9; --panel:#f6f8f6; --well:#e0e6e2; --line:#d0d9d3; --line-2:#b9c6bd;
--ink:#16201c; --ink-2:#4a5852; --ink-3:#77847d;
--accent:#b35c22; --accent-hi:#c66a2c; --accent-soft:#f1dfcf;   /* vask */
--mask:#1e5a40;                                                  /* solder-mask */
--canvas:#d3dbd5; --pad:#d0a630; --pad-edge:#6a510b; --drill:#1e221f;
--top:#d9432b; --bottom:#2f6fd6; --wire:#c38410;                 /* rollita radade kihivärvid */
--dim:#a8329f;                                                   /* mõõtjooned ja kontuur */
--sel:#0a97a3; --sel-fill:rgba(10,151,163,.12);                  /* valik */
--ok:#2c8150; --warn:#a86f00; --danger:#bf3a2b; --area:#e07b16;  /* hinnangud, hoiatused, kahjustatud ala */
--f-ui:"Archivo", "Segoe UI", system-ui, sans-serif;
--f-mono:"Martian Mono", "Cascadia Mono", Consolas, monospace;
```
Teema järgib süsteemi (hele/tume), seadetes saab selle fikseerida. Tähised, väärtused ja numbrid on alati `--f-mono` ja `tabular-nums`.

## Jalad

Jalg peab olema eristatav igas suumis ja igal taustal.

| Omadus | Reegel |
|---|---|
| Kuju ja minimaalne suurus | padjandi pööratud ristkülik või ring; ristküliku kumbki külg ja ringi läbimõõt on ekraanil vähemalt 5 px |
| Jalg 1 | korpuse geomeetria määratud kohal punkt värviga `--body` ja haloga; raadius vähemalt 0,25 mm plaadil ja 2 px ekraanil. Padjandi kuju tuleb generaatorist |
| Number | nähtav, kui lühema külje pool on ≥ 7 px; nimi lisaks, kui lühema külje pool on ≥ 14 px; font vähemalt 8 px ekraanil |
| Halo | iga jala ümber 1,5 px kontrastne kontuur (`--halo`), et see paistaks fotol välja |
| Tabamusala | ristkülikul sama pööratud kuju, iga külg vähemalt 5 px ekraanil; ringil jääb raadius `max(tegelik, 6 px ekraanil)`. Sama prioriteedi korral võidab kursorile lähim kese |

| Olek | Täide | Rõngas | Lisaks |
|---|---|---|---|
| Ühendamata | puudub (ainult kontuur `--ink-3`) | 1,5 px | |
| Ühendatud | võrgu rolli värv (rollita `--pad`) | 1 px tumedam toon | |
| Mõõdetud OK | rolli värv | 2,5 px `--ok` | väärtuse silt (`4,98 V`) |
| Kahtlane | rolli värv | 3 px `--danger`, pulseerib 1× uue tulemuse järel | väärtuse silt punasena |
| NC (ühendamata kinnitatud) | puudub | 1 px | väike rist |
| Aegunud mõõtmine | | | silt kriipsutatud ja hall |
| Valitud | | +2 px `--sel` | kogu võrk esile tõstetud, teised 25 % läbipaistvusega |
| Piiksu ankur | | 3 px sinine | silt „Must sond“ |

## Ühendused

| Tüüp ja alus | Joon |
|---|---|
| Rada, nähtud | pidev, tegelik laius millimeetrites (vähemalt 1,4 px), rolli värv või kihi värv |
| Rada, mõõdetud | nagu üleval + väike ✓ märk raja keskel |
| Juhe | pidev, kumer kaar (juhe on plaadist kõrgemal) |
| Õhujoon, oletatud (ühendus ilma fotojoonistuseta) | 1,5 px katkendjoon `6 4`; kihina peidetav |
| Õhujoon, mõõdetud | 1,5 px punktiirjoon `2 3` + ✓ |
| Liitepunkt (haru) | täidetud täpp 2,5 × raja laius (vähemalt 5 px) nii plaadil kui ka skeemil; ristuvad jooned ilma täpita **ei ole** ühendatud |
| Lahtine ots | tühi ring raja lõpus |
| Mõõtmine aegunud või kustutatud | joonistatakse algse taseme järgi (nähtud rada või oletatud õhujoon) ilma ✓-märgita; kontekstis „Mõõda uuesti“ |
| Raja silt | võrgu nimi raja kõrval; lohistatav nihe, vaikimisi peidetud kaugel suumil |
| Alumine kiht | 70 % läbipaistvusega, kui vaadatakse pealmist poolt |
| Rollikonflikt | punane 2 px halo ümber kogu võrgu |

## Komponendid

- Kere on kontuurjoon (1,4 px, `--body`) ja kerge täide, et foto paistaks läbi. Halo 3,6 px tagab loetavuse.
- Alumise poole komponent: katkendjoonega kere.
- Tuvastamata: tähise juures väike „?“.
- DNP: kere 40 % läbipaistvusega, tähis läbikriipsutatud.
- Valitud: kontuur `--sel`, 8 käepidet (8 px ruudud), pöördekäepide üleval (ring, 16 px kaugusel).

## Mõõda-plokk

- Sondid on nimetatud: „Punane sond · U1.4“ ja „Must sond · U1.3“, jala nimi on vihjena. Punane täpp kasutab `--danger` värvi; mustal tumedal täpil on ääris. Tekst eristab sonde ka ilma värvita. Valimata must sond on „määramata“, kustutatud jalg „—“.
- Musta sondi real on „Vali musta sondi jalg“ ja „Tühjenda“. Valimise ajal on real aktsendivärvi ääris ning juhis „Klõpsa plaadil musta sondi jalal“; pärast valikut on real jälle jala tähis.
- Õnnestunud salvestuse järel jääb pinge sisestusväli tühjaks ja fookusesse. Selle all on näiteks „Viimati salvestatud 4,73 V · U1.4 → U1.3“, musta sondita ainult „U1.4“. Rida loeb väärtuse ja paari salvestatud mõõtmisest, mitte praegustest sondidest, ning asendab vihje „nt 4,98“.
- Tagasivõetud või kustutatud viimase mõõtmise rida kaob ja vihje taastub; uuesti tegemine toob näidu tagasi. Viimase mõõtmise viide nullitakse seansivahetusel ega kuulu dokumenti.
- Jala kaardilt saab muuta nime ja NC-d ning nupuga „← Komponent“ valida kogu komponendi. Mõõtmiste sektsioon näitab valitud jala `uid`-ga seotud kummagi sondi mõõtmiste koguarvu ja kuni viit uusimat salvestatud paariga. Tühi olek on „Selle jalaga mõõtmisi pole.“

## Klaviatuur

| Klahv | Tegevus | Klahv | Tegevus |
|---|---|---|---|
| `V` | Vali | `R` / `Shift+R` | pööra +90° / −90° |
| `H`, tühik + lohista | liiguta vaadet | `Q` / `E` (+Shift) | pööra ∓1° (∓15°) |
| `T` | Rada | `F` | teisele poolele |
| `C` | ühenda valitud jalad (õhujoon) | `L` | raja kiht (raja joonistamisel); võrgusilt (skeemil) |
| `B` | Piiksumisrežiim | `Ctrl+D` | dubleeri |
| `M` | Mõõda (fookus väärtusele) | `Del` | kustuta |
| `J` | Lisa jalg | nooled (+Shift) | nihuta 1 px (10 px) |
| `P` | Punkt plaadil | `Ctrl+Z` / `Ctrl+Y` | tagasi / uuesti |
| `A` | Joonda kahe jalaga | `Ctrl+K` | käsupalett |
| `D` | Mõõtjoon | `Ctrl+Tab` | Plaat ↔ Skeem |
| `O` | Kontuur | `0` / `+` / `−` | sobita / suumi |
| `K` | Kalibreeri | `Esc` | katkesta → tagasi Vali tööriista → tühjenda valik |
| `X` | Märgi kahjustatud ala | `?` | kiirklahvide abi |

**Skeemivaates** lisaks: `W` juhe · `L` võrgusilt · `R` pööra sümbolit. „Näita teises vaates“ on kontekstimenüüs ja käsupaletis.

**Väärtuse väljas** (mõõtmine): `Enter` salvesta · `Alt+↓` / `Alt+↑` järgmine/eelmine jalg · `Tab` / `Shift+Tab` järgmine/eelmine vormiväli · `Alt+1…4` režiim · `Alt+P` toide · `Esc` tühjenda mustand ja välju. Sisestusväljas ei käivitu ükski lõuendi täheklahv.
**Piiksumisrežiimi nuppudel:** `Enter` „Piiksub ja ühenda“ · `Shift+Enter` „Ainult mõõtmine“ · `N` „Ei piiksu“ · `Esc` katkesta (ei salvesta midagi). Klahvid on nuppude peal kirjas.

Kontekstiklahvid (piiksu nupud, raja joonistamine, skeemivaade) kehtivad ainult selles olekus ja on registris kontekstiga seotud.

Klahvid on registreeritud moodulite kaudu (`keymap`). Topeltregistreerimine on käivitusel viga.

## Hiir ja puude

- Rullik suumib kursori ümber; `Ctrl` + rullik teeb sama (puuteplaadi näpistus).
- Keskmine nupp lohistab vaadet. Parem klõps avab kontekstimenüü (komponent: pööra, pool, dubleeri, kustuta, remont; jalg: alusta rada, mõõda, nimeta, NC; tühi ala: lisa komponent siia).
- Lohistamine algab 3 px liikumise järel, väiksem liikumine on klõps. Haaramise koht jääb kursori alla (BenchBeepi viga BB-14).
- Kaks sõrme suumivad ja liigutavad (puuteekraan).

## Tagasiside

- **Salvestamine:** ülaribal „Salvestatud · 14:32“ (hall), „Salvestan…“ või punane riba vea korral. Eraldi teateid edukast salvestamisest ei näidata.
- **Teated (toast):** 2,5 s, all keskel, maksimaalselt 3 korraga. Ainult tegevuse tulemused: „U3 paigutatud“, „Rada J1.VBUS → C1.1 · võrk VBUS“, „Kustutatud · Ctrl+Z toob tagasi“.
- **Hoiatused** on objekti juures (konflikt võrgu paneelis, kalibreerimata mõõtkava kiibil), mitte hüpikaknas.
- **Hüpikaknad** ainult järgmiste puhul: kalibreerimise pikkus, rolli redaktor, remonditoiming, eksport, uus plaat, kiirklahvid ja tegelikult pöördumatu tegevus (projekti fail kustutatakse kettalt). Kõik muu on tagasivõetav ja kinnitust ei küsi.

## Tekstid

- Keel on eesti keel, sõnavara töökoja oma ([01 › Sõnastik](01-pohimotted.md#sõnastik)). Nupp ütleb, mis juhtub: „Salvesta mõõtmine“, „Märgi kaardistus valmis“, „Lae oma foto“.
- Numbrid kümnendkomaga (`4,98 V`, `14,05 px/mm`). Sisestus aktsepteerib nii koma kui punkti.
- Viga = mis juhtus + kuidas edasi. Vabandusi ega tehnilisi koode kasutajale ei näidata.

## Tühjad olekud

| Koht | Tekst ja tegevus |
|---|---|
| Lõuend ilma fotota | „Lohista plaadi foto siia või kleebi Ctrl+V“ · [Vali foto] · [Jätka ilma fotota] |
| Plaadil (tühi) | „Plaadil pole veel midagi. Ava **Teek** ja paiguta esimene komponent plaadile.“ |
| Võrgud (tühi) | „Võrgud tekivad ühendustest. Kasuta tööriista **Rada** (T) või **Piiks** (B).“ |
| Mõõtmised (tühi) | „Vali jalg ja sisesta väärtus. Esimene mõõtmine on tavaliselt toitesisend GND suhtes.“ |
| Skeem (komponente pole) | „Lisa komponent teegist või lohista see loendist **Skeemile paigutamata**. Skeemil lisatud komponendi saad hiljem fotole paigutada.“ |
| Plaadile paigutamata (tühi) | „Kõik komponendid on plaadil.“ |
| Otsing ei leidnud | „Sellist korpust ei leitud. Proovi **Kohandatud**: sellele saad ise jalad lisada.“ |

## Ligipääsetavus

- Kõik toimingud on tehtavad klaviatuuriga; fookus on alati nähtav (2 px `--accent`).
- Hinnang ei ole ainult värv: OK ✓, madal ↓, kõrge ↑, lühis ⚡ on ka ikoon või tekstiga.
- Teksti kontrast on vähemalt 4,5:1 mõlemas teemas. Väikseim tekst on 11 px (mono 10,5 px).
- Animatsioonid austavad `prefers-reduced-motion`.
