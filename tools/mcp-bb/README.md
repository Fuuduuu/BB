# bb_mcp: BB projekti MCP server

Väike MCP server, mille kaudu Claude Code, Codex (GPT) ja Gemini CLI näevad BB projekti ühtemoodi. Server ei vaja paigaldamist: see on üks Pythoni fail, mis kasutab ainult standardteeki (Python 3.10+), ja suhtleb kliendiga stdio kaudu.

## Tööriistad

| Tööriist | Mida teeb | Muudab faile? |
|---|---|---|
| `bb_status` | päris git-seis (haru, HEAD, muudetud failid) ja `docs/STATUS.md` | ei |
| `bb_list_docs` | kõigi Markdown-dokumentide tabel: tee, pealkiri, ridade arv, ADR-i staatus | ei |
| `bb_outline` | ühe dokumendi pealkirjade puu koos ankrute ja reanumbritega | ei |
| `bb_read_section` | ühe jaotise tekst (nt `03`, „9. Salvestus“); säästab konteksti | ei |
| `bb_search` | otsing dokumentides; iga tulemuse juures on fail, rida ja jaotis | ei |
| `bb_check_docs` | puuduvad lingid ja ankrud, paaritud koodiplokid, `;` Mermaidi järjestusdiagrammis, vanade lahenduste terminid | ei |
| `bb_decisions` | ADR-id koos staatusega, kasutaja lahtised otsused ja ülevaatuste postkast | ei |
| `bb_submit_review` | salvestab ülevaatuse faili `docs/review/inbox/<kuupäev>-<ülevaataja>.md` | loob uue faili; ei kirjuta üle ega commiti |

Dokumendi nime võib anda lühidalt: `03`, `04-andmemudel`, `ADR-003`, `STATUS`, `AGENTS`.

## Ühendamine

Kõik kliendid käivitavad sama käsu: `python tools/mcp-bb/bb_mcp.py`. Repo juurkausta leiab server oma asukoha järgi (või keskkonnamuutujast `BB_ROOT`).

| Klient | Seadistus | Märkus |
|---|---|---|
| Claude Code | `.mcp.json` repo juurkaustas | Claude Code küsib esimesel käivitamisel, kas projekti serverit lubada |
| Codex (GPT) | `[mcp_servers.bb]` failis `%USERPROFILE%\.codex\config.toml` | lugevad tööriistad on lubatud ilma küsimata, `bb_submit_review` küsib iga kord |
| Gemini CLI | `.gemini/settings.json` repo juurkaustas | rakendub, kui Gemini CLI käivitatakse BB kaustas |

**Veebivestlused** (chatgpt.com, gemini.google.com) ei näe kohalikku stdio-serverit. Neile anna endiselt failid või ülevaatuse pakett käsitsi. Serveri avalikku internetti avamine pole soovitatav.

## Kontroll

```bash
python tools/mcp-bb/bb_mcp.py
```

Server ootab sisendit stdin-ist, nii et see käsk jääb lihtsalt ootama (`Ctrl+C` lõpetab). Põhjalikum kontroll on teha see MCP Inspectoriga või kliendi enda MCP-loendiga (Codexis `/mcp`, Claude Code'is `/mcp`).

## Piirangud

- `python` peab olema PATH-is. Praegu tuleb see Codexi kaasa pandud Pythonist. Kui Codexi uuendus selle eemaldab, paigalda eraldi Python 3.10+ ja server töötab muutmata kujul edasi.
- Server loeb ainult repo faile ja käivitab `git status` ning `git log` käske. Võrku see ei kasuta.
- Kui rakenduse kood tekib (M0+), saab samasse serverisse lisada tööriistad testide ja kontrollide jaoks. AI ligipääs päris projektiandmetele on eraldi teema ([03 § 13](../../docs/03-arhitektuur.md#13-ai-liides-hilisem)).
