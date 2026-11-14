---
name: bb-check-canvas
description: "Kasuta BB (PCB Kaardistaja) foto, komponendijala, hiiretabamuse või PNG-ekspordi joonduse kontrollimisel, kui tulemus sõltub EXIF-suunast, pöördest, peegeldusest, kuvamisvariandi mõõtkavast või vaate suumist."
---

# BB lõuendi joonduse kontroll

Võta ülesandekaardilt kontrollitav tegevus, sihtkeskkond ja lubatud viga. Koosta sünteetiline näide, milles parandaja osutatud jalg või komponendi kese on fotol ette teada. Kasuta olemasolevat proovi kaardil näidatud tööpuust.

## Määra ootus enne renderdamist

- Kirjuta üles alguspunkti ühik ja ruum. Erista JPEG toorandmed, impordil õigeks pööratud foto, plaadi koordinaadid, ekraan ja väljundpilt. Rakenda EXIF-suuna parandus üks kord. Võta kummagi pildivariandi mõõdud tegelikust failist.
- Vali ristkülikukujuline foto ning kaks eristatavat orientiiri. Paiguta vähemalt üks märk telgedest, diagonaalidest ja keskpunktist kõrvale. Arvuta nähtavasse pilti oodatavad punktid katse sisendist sõltumatult. Sama `sceneMatrix` kasutamine nii oodatava kui ka tegeliku asukoha leidmiseks peidab ühise vea.
- Arvesta pööramise ja peegeldamise järjekorda. Nullist algavate piksliindeksite korral viib 90° päripäeva pööre punkti `(x, y)` asukohta `(H − 1 − y, x)`. Pidevates SVG koordinaatides asub sama sisendpiksli kese punktis `(x + 0,5; y + 0,5)`. Rakenda väljundi skaala keskmele ja vali seejärel väljundpiksel. Kahe jala joondust mõõda kaardil nõutud plaadiühikutes enne rasterdamist.
- PNG-proovis vaheta vaate suumi ja nihet. Sama foto ja variandi märgid peavad jääma samadele väljundpikslitele. Hiiretabamuse puhul klõpsa liigutatud vaates nähtaval jalal ja kontrolli tabatud jala `uid`-d. Kui kaart nõuab kõiki kaheksat stseeniteisendust, kontrolli igaüht.

## Mõõda tulemust väljundist

Töölaua ekspordi korral dekodeeri Tauri proovist saadud PNG. Kontrolli foto orientiire ja nende kohal olevaid komponente eraldi. Komponendi värvi leidmine oodatud punktis tõendab kattumist. Keskpunkti leidmiseks mõõda kogu märgi asukohta. Kontrolli ekspordist väljajäetavaid kihte, kui kaart seda nõuab.

Sünteetilise läbipaistmatu ühevärvilise ristküliku jaoks kasuta kaasasolevat [pikslikontrolli](scripts/check_marks.py). Määra igale märgile ainult selles ristkülikus esinev täpne RGB-värv. JPEG, pehmendatud servadega detaili või komponendiga kaetud fotomärgi jaoks vali muu tunnus, näiteks kahe vastasserva keskkoht ja katmata nurgalaigud.

Näide skilli kaustast Pythoni ja Pillow'ga. Käsus on katseandmetest ette teada olevad mõõdud, värv ja keskpunkt. Lubatud hälve on kummalgi teljel neli väljundpikslit.

```powershell
python scripts/check_marks.py proov.png --size 200 250 --mark C040A0 90 162 --tolerance 4
```

Esita variandi kohta väljundmõõdud, oodatud ja mõõdetud keskpunkt, hälve ning katse keskkond. Kui saadaval on ainult brauseritest või Tauri logis puuduvad mõõdetud pikslid, nimeta täpselt, milline väide jäi lahtiseks. Hoia proovi tulemus, arhitekti lahendusevalik ja kasutaja visuaalne vastuvõtt eraldi.
