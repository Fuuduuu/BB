# BB: oskuste valik enne tööd

## Iga uue ülesande alguses

1. Vaata oma keskkonnas tegelikult saadaolevate oskuste nimesid ja kirjeldusi, repo juhiseid ning olemasolevaid abivahendeid.
2. Vali ülesandele sobivad oskused enne lahenduse või muudatuste alustamist. Vaata üle nii töövõte kui ka tehnoloogia/tööriista erioskused.
3. **Lae valitud oskuse juhis** keskkonna skill-käsuga või loe selle `SKILL.md`. Nime mainimine ei ole laadimine. Lisamaterjali loe ainult vajaduse järgi.
4. Kasuta allolevaid käivitustingimusi; kõiki oskusi korraga ei laadita. Oskuse soovitus ei anna luba kasutaja ülesannet, õigusi ega muudetavat ala laiendada.

Kui sama nimega oskust pole, otsi keskkonnast sama võimega oskust. Kui sobivat oskust pole, järgi siin kirjeldatud töövõtet ja teata olulisest piirangust. Ära väida, et puuduv oskus on laetud; ära paigalda selle nimel omal algatusel pluginaid ega muuda üldseadistusi.

Oskus juhib töövõtet; [BB MCP](WORKFLOW.md#bb-mcp-ühised-repo-tööriistad) annab ühised repo lugemis- ja kontrollivahendid. Kui server on seansis saadaval, kasuta selle lugemistööriistu koos valitud oskustega. Iga MCP tööriista jaoks pole eraldi skilli vaja.

## Enne ehitamist ja töö eri etappides

Nimed viitavad siin kasutatud oskustele; teises AI keskkonnas võib samaväärne oskus olla teise nimega.

| Millal | Laaditav oskus või võime | Mida see lahendab |
|---|---|---|
| Uue ülesande alguses, kui saadaval | `superpowers:using-superpowers` | sobiva töövõtte ja erioskuste valik |
| Uus võimalus või sisuline käitumise/UX-i otsus | `superpowers:brainstorming` | kasutaja eesmärk, lihtsaim sobiv lahendus ja vastuvõtt |
| Verstaposti plaani koostamine arhitekti rollis | `superpowers:writing-plans` | piiritletud sammud, failid, liidesed ja kontrollid; rollid [teekaardil](07-teekaart.md#rollid) |
| Arhitekti teostusplaani täitmine ehitaja rollis | `superpowers:executing-plans` | plaani järgi väikesed terviklikud sammud, tegelikud kontrollid ja üleandmine arhitektile |
| Viga, ebaõnnestunud test või ootamatu käitumine | `superpowers:systematic-debugging` | kordusjuhtum ja põhjuse tõendamine enne parandust |
| Uus loogika või veaparandus | `superpowers:test-driven-development` | tähenduslik läbikukkuv katse enne parandust; väike doc-/stiilimuutus ei vaja kunstlikku testi |
| Teostus vajab isoleerimist, eriti paralleeltöö korral | `superpowers:using-git-worktrees` | teiste töö säilitamine ja õige tööpuu valik |
| Saabunud ülevaatuse leidude hindamine | `superpowers:receiving-code-review` | kontrolli väidet koodi/lepingu vastu; ära rakenda soovitust pimesi |
| Suurema töö või andmelepingut muutva töö ülevaatus | `superpowers:requesting-code-review` | sõltumatu kontroll tegelikule muudatusele |
| Enne väidet „valmis“, „parandatud“ või „testid läbivad“ | `superpowers:verification-before-completion` | väitele vastav päriselt tehtud kontroll |
| UI käsitsi/automaatne vaatlus, Figma, dokumendid või muu erivahend | vastava tööriista oskus, nt `computer-use` | keskkonna õige kasutus ja tegeliku tulemuse vaatlus |
| Brauseri töövoo uurimine CLI kaudu, kui seansi brauserireeglid seda lubavad | `playwright` (Codexile paigaldatud) | vaatlused ja vooprobleemi tõendamine; olemasolev brauseri/arvuti tööriist jääb eelistatuks, kui keskkond seda nõuab |
| GitHub Actionsi ebaõnnestunud kontrolli uurimine | `gh-fix-ci` (Codexile paigaldatud) | kontrolli ja logi leidmine; CLI kasutamiseks kontrolli `gh` sisselogimist, koodiparandus järgib plaani ja rollijaotust |
| Uue korduskasutatava oskuse loomine | `skill-creator` ja olemasolul `superpowers:writing-skills` | kitsas kasutusjuht, selge käivitustingimus ja käitumise kontroll |

TypeScripti, Reacti, Tauri, SQLite'i ja testimise erioskusi otsi nende tegeliku töö järgi. Kohaliku repo kasutatav versioon ja lukufail on rakenduse kontrollide alus. Enne API või tööriista ebakindla käitumise peale ehitamist kontrolli asjakohast ametlikku dokumentatsiooni.

Codexi jaoks on Superpowersi ja GitHubi pluginad olemas ning brauseri/arvuti tööriistad saadaval. `playwright` ja `gh-fix-ci` on paigaldatud kasutaja Codexi oskustekausta; uued oskused muutuvad kättesaadavaks järgmisel pöördumisel. See ei tähenda nende olemasolu Claude'i või Gemini keskkonnas. Windowsis on Playwright CLI jaoks `playwright-cli.cmd`; BB enda e2e-testid kasutavad M0 plaanis projekti lukufailiga määratud Playwrighti. Kõiki oskusi korraga ei laadita.

## Kas sellest tööst tasub teha uus oskus?

Hinda seda iga uue töö alguses; loo oskus siis, kui kasu on konkreetne:

- töövõte kordub, on kergesti valesti tehtav või nõuab korduvat mitte-ilmset eriteadmist;
- olemasolev oskus või lihtne repo juhis seda piisavalt ei kata;
- kasu on kirjeldatav: vähem korduvat uurimist, kindlam kontroll või korduskasutatav töövahend.

Kui need tingimused kehtivad, piira käivitustingimus ja tulemus, lae oskuse loomise juhis ning kontrolli seda realistliku ülesandega eraldi katseandmetel. Pikk protsessijutt ei asenda oskuse tegelikku kasu.

Projekti püsireegel jääb [AGENTS](../AGENTS.md) või [WORKFLOW](WORKFLOW.md) faili. Mehaaniline korduskontroll sobib pigem skriptiks/CI-kontrolliks. Uus oskus ei dubleeri neid ega hoia projekti jooksvat seisu.

Repo jaoks loodud oskused hoia vajadusel kaustas `.agents/skills/<nimi>/SKILL.md`, et need liiguksid projektiga kaasa. Ära loo tühje kandidaadioskusi. Praegu BB-spetsiifilisi oskusi ei ole; kandidaat märgitakse STATUS-esse ainult siis, kui selle kasu ja puuduv olemasolev lahendus on selged.

Oskuse loomine kasutaja ülesande sees ei käivita eraldi kõrvalprojekti. Kui see muudaks töö mahtu märgatavalt, kirjelda kasu ja jäta ettepanek kasutajale otsustada; põhiülesandega saab edasi minna olemasoleva töövõtte abil.

## Juhiste allikad

[OpenAI AGENTS.md juhis](https://developers.openai.com/codex/guides/agents-md) ja [oskuste juhis](https://developers.openai.com/codex/skills). Need kirjeldavad Codexi käitumist; iga teise AI tööriista tegelik oskuste valik ja laadimine kontrollitakse tema keskkonnas.
