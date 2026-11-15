---
name: bb-review-storage
description: Kasuta BB fotoimpordi, salvestamise, projekti vahetamise, kopeerimise või taastamise ülevaatusel, kui tööjärjekord, salvestusseanss või sihtfail võib toimingu ajal muutuda.
---

# BB salvestuse ja seansivahetuse ülevaatus

Loe töökaardilt, millist projekti või faili tohib toiming muuta. Jälgi üht kasutaja tegevust selle algusest esimese tegeliku kirjutuseni. Kasuta sünteetilisi projekte ja ajutist kausta. Vali allpool muudatusele vastav katse.

## Fotoimport projekti vahetamise ajal

1. Ava A ja valmista ette B. Alusta A-s eristatavate baitidega foto importi. Hoia faili lugemise vastus ootel, näiteks olemasoleva [`deferred`-abifunktsiooniga](../../../packages/engine/src/__tests__/project-helpers.ts).
2. Käivita B avamine ja peata see hoidla vastuse juures, kuni A on veel aktiivne. Lase lugemisel lõppeda. Et teada, millal import on B avamise järel järjekorras, lase testi vaatlejal kutsuda välja päris `projects.importPhoto`, anda kohe seejärel signaal ja tagastada sama `Promise`. Signaali järel vabasta B avamine ning oota mõlema toimingu lõppu.
3. Salvesta fotopordi `importBytes` kutsed koos hoidla seansitunnusega. Seo tunnused avamisel A ja B-ga. Aegunud impordi ootus on `stale_session`, **B fotopordile 0 kirjutuskutset** ja B dokumendis 0 uut fotoviidet. Kontrolli ka A dokumendi algseisu. Kui katse kasutab tegelikku salvestusadapterit, otsi B hoidlast katsepildi baite ka pärast taasavamist. Hilisem koristus võib kirjutuse jälje kaotada, seetõttu säilita ka kutsete logi.
4. Positiivses katses peab sama import ilma projektivahetuseta kirjutama A fotopordile ühe korra ja lisama A dokumenti õige viite. Kui muudatus puudutab koopiat, erista mootori loogilist seanssi ja hoidla avatud faili tunnust. Koopia võib saada uue hoidlatunnuse sama loogilise seansi ajal.

Kasuta [fotoimpordi UI-teste](../../../packages/features/photo/ui/add-photo.test.ts) ja [projektiteenuse fotopordi teste](../../../packages/engine/src/project-photo-import.test.ts). Käivita sihitud testid ülevaadatava tööpuu juurest:

```powershell
pnpm exec vitest run packages/features/photo/ui/add-photo.test.ts packages/engine/src/project-photo-import.test.ts
```

## Automaatne failinimi, kinnitatud asendus ja taastamine

| Toiming | Sünteetiline katse ja oodatav tulemus |
|---|---|
| Automaatse nimega loomine | Lase adapteril valida vaba tee. Tekita enne lõplikku loomist sellele teele teadaoleva sisuga fail. Jälgi, millise käsu ja argumendid Rust saab ning kas need eristavad uue faili loomist kinnitatud asendusest. Võrdle hõivatud faili baite algseisuga. Kui leping lubab uut nime proovida, ava loodud projekt uuelt teelt ja kontrolli selle identiteeti. |
| Kasutaja kinnitatud asendus | Kontrolli nii eduka asenduse järel taasavatud projekti identiteeti kui ka ebaõnnestunud asenduse järel vana faili baite. [Rusti loomistestid](../../../apps/desktop/src-tauri/tests/storage.rs) sisaldavad selleks näidet. |
| Koopia või taastamine | Märgi lähtefaili ja sihtfaili algseis eraldi. Kontrolli tulemust sulgemise ja taasavamise järel ning võrdle kaitstud faili baite algseisuga. [Koopiatestid](../../../apps/desktop/src-tauri/tests/copy.rs) ja [taastamistestid](../../../apps/desktop/src-tauri/tests/recent_restore.rs) katavad erinevad lepingud. |

Jälgi automaatset loomist läbi [TypeScripti adapteri](../../../packages/adapters/src/storage-tauri.ts) [Rusti loomiskäsu salvestuseni](../../../apps/desktop/src-tauri/src/storage/mod.rs). Näiteks `restore_publication_never_replaces_a_late_destination` kontrollib taastamist. Automaatse nimega loomise kohta saab järelduse teha selle enda kooditee ja testi põhjal.

```powershell
pnpm exec vitest run packages/adapters/src/storage-tauri.test.ts
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml --test storage
```

Taastamise hilise nimekonflikti kontrolliks käivita Rusti teegi üksustest eraldi:

```powershell
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml --lib restore_publication_never_replaces_a_late_destination
```

## Üleandmine

Kirjuta üles kontrollitud haru või commit, sündmuste järjekord, oodatud ja mõõdetud siht ning andmete lõppseis. Lisa käivitatud testi nimi ja tulemus. Erista fotopordi väljakutse, faili baitide võrdlust ja taasavatud dokumendi sisu. Kui ülevaadatavas versioonis leidub ainult kõrvaltoimingu test või filter käivitas null testi, märgi konkreetne tõendamata juhtum.
