# M1.3 üleandmine Claude’ile · mõõtmine ja siltide paigutus

Esimene skeem kirjeldab tehniku mõõtmistöövoogu. Teine näitab, kuidas moodulite väljundid töölaual kokku saavad ja kus võiks lahendada J29 tähise ning mõõtenäidu kattumise. Koodi lähtekoht on haru `codex/m1-3` commit `adc8fb4`. Mõlemad skeemid on siin muudetava Mermaidi lähtekoodina.

## 1. Tehnik valib sondi ja salvestab näidu

```mermaid
flowchart TD
    H["Omaduste paneel peidus"] -->|"Vali teine jalg"| H
    H -->|"Vajuta valitud jalal M"| R["Mõõtepaneel avatud"]
    R -->|"Vali musta sondi jalg"| B["Ootel on musta sondi asukoht"]
    B -->|"Klõpsa plaadil jalal"| R
    R -->|"Sisesta näit ja vajuta Enter"| S["Näit salvestatud koos kontaktipaariga"]
    S -->|"Vali järgmine punase sondi jalg"| R
    R -->|"Peida omadused"| H
```

**Kontrollnäide.** Vali punasele sondile U1.4 ja mustale U1.3. Sisesta `4,73` ja vajuta `Enter`. Vali järgmiseks punase sondi jalaks U1.5. Paneel peab korraga näitama uut asukohta **Punane sond · U1.5** ja eelmist tulemust **Viimati salvestatud 4,73 V · U1.4 → U1.3**. Skeem näitab mõlema sondiga mõõtmist. Musta sondi võib jätta määramata. [Paneeli käitumine](../tasks/M1-3-1.md) ja [sondide ning viimase näidu reeglid](../tasks/M1-3-3.md).

## 2. Moodulite vastutus ja J29 mõõtenäit

Pidev nool näitab praegust seost töölaual. Katkendlik nool näitab siltide paigutuse ettepanekut. Nooled kirjeldavad kuvatava info liikumist.

```mermaid
flowchart TD
    subgraph modules["BenchBeepi moodulid"]
        P["project · projekti andmed"]
        F["photo · foto ja mõõtkava"]
        C["components · korpused ja jalad"]
        M["measurements · sondid ja näidud"]
    end
    subgraph desk["Töölaud praegu"]
        T["Ülariba"]
        A["Plaadi lõuend"]
    end
    P -->|"Tagasi avalehele"| T
    F -->|"Plaadifoto ja kalibreerimismärgid"| A
    C -->|"Tähis J29 ja jalgade asukohad"| A
    M -->|"Jala 15 näit 3,651 V"| A
    C -.->|"Tähise piirid ekraanil"| L
    M -.->|"Näidu piirid ja jala asukoht"| L
    L["Ettepanek · ühine siltide paigutus"] -.->|"Nihutatud näit ja vajadusel viitejoon"| A
```

**Kust koodis alustada.** Komponendi tähise asukoht arvutatakse failis `packages/features/components/ui/layers/hits.ts` ja tekst joonistatakse samas kaustas failis `ComponentShape.tsx`. Mõõtenäidu teksti ning nihke määrab `packages/features/measurements/ui/layers/ReadingLabels.tsx`. Mõlemad kihid joonistab lõuend `packages/ui/src/canvas/Canvas.tsx`.

## Claude’ile · otsustuskoht M1-3-10 kaardi jaoks

**Vastuvõtutingimus on plaanis juba olemas.** 15-jalalise sünteetilise pistiku J29 jalal 15 mõõdeti 3,651 V. 100% suumil kattusid tähise „J29 ?“ ja näidu tekstikastid umbes 20 × 18 px. Pärast parandust peavad mõlemad olema korraga loetavad. Plaanis on selle jaoks testid `reading_label_avoids_own_ref_label` ja `j29_reading_does_not_overlap_ref_label`. [M1.3 plaani ülesanne 10 „Näit ja tähis eraldi“](../plans/M1-3-toopind-ja-korpused.md#ülesanded).

**Palun otsusta kaardi koostamisel**, kus võrrelda tähise ja näidu piire nii, et moodulid saaksid jääda teineteisest sõltumatuks. Ettepanek on jätta komponendi tähis tehniku valitud kohta ja nihutada kattuvat näitu ekraanikoordinaatides. Vajadusel seob lühike viitejoon näidu jalaga 15. Kontrolli sama juhtumit ka pööratud ja peegeldatud plaadivaates.
