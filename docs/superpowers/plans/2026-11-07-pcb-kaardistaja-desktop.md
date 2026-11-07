# PCB Kaardistaja (töölaud): teostusplaan

> **ASENDATUD.** See Flutteri plaan ei kehti. Kehtiv suund: [ADR-002](../../adr/ADR-002-typescript-tauri.md) ja dokumentatsioon [docs/README.md](../../README.md). Faili hoitakse alles ainult ajaloo jaoks.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Eesmärk:** kohalik Flutteri Windowsi äpp, millega kaardistada skeemita trükiplaat foto põhjal: muudetava suurusega komponendid, selgelt eristatavad jalad, rollidega võrgud (GND/5V/12V …) ja mõõtmiste logi koos automaatse hinnanguga.

**Arhitektuur:** `lib/core/` on puhas Dart (mudel, geomeetria, võrgud, hindamine, käsud, salvestus, korpused). `lib/modules/<nimi>/` iga võimalus realiseerib liidese `AppModule` ning toob kaasa oma tööriistad, paneelid ja lõuendikihid. Moodulid registreeritakse ainult failis `lib/app/module_registry.dart`. Kest ja lõuend küsivad registrilt, mida näidata. Olekut hoiab Riverpodi `ProjectController`, mille aluseks on muutumatu `Board` ja hetktõmmistega `CommandStack`.

**Tehnoloogia:** Flutter 3.44.9 / Dart 3.12.2, flutter_riverpod, file_picker, path_provider, window_manager; joonistus `CustomPainter`iga, PNG `dart:ui` kaudu.

**Spetsifikatsioon:** [docs/superpowers/specs/2026-11-07-pcb-kaardistaja-desktop-design.md](../specs/2026-11-07-pcb-kaardistaja-desktop-design.md) · **Otsus:** [ADR-001](../../adr/ADR-001-keel-ja-platvorm.md) · **Prototüüp (portimise allikas):** `C:\Users\TRUMPIT\Desktop\BB\prototype\src\js\*.js`

## Global Constraints

- Repo: `C:\dev\PcbKaardistaja`, Dart-pakett `pcb_kaardistaja`, git-repo luuakse 1. ülesandes.
- SDK: `$flutter = 'C:\dev\flutter-tracebench\bin\flutter.bat'` (Flutter 3.44.9 / Dart 3.12.2). Ära muuda seda SDK-d ega `C:\dev\TraceBench` repot.
- Lubatud sõltuvused: `flutter_riverpod: ^2.5.0`, `file_picker: ^8.1.0`, `path_provider: ^2.1.0`, `window_manager: ^0.5.2`, `path: ^1.9.0`; dev: `flutter_test`, `flutter_lints: ^4.0.0`. Koodigeneraatoreid (freezed, json_serializable) ei kasutata.
- `lib/core/**` ei impordi `package:flutter` ega `dart:ui`. Seda kontrollib test `test/core/purity_test.dart`.
- Ühikud: asukohad foto pikslites (`Vec2`), korpuste geomeetria millimeetrites, teisendustegur `Board.pxPerMm`.
- JSON: võtmed snake_case kujul, `schema_version: 1`, BenchBeepiga ühilduvad nimed `component_id`, `pin_id`, `mode` (`voltage|resistance|diode|continuity`), `power_state` (`on|off|unknown`), `confirmation_basis` (`visual|measured|assumed`).
- Kasutajaliidese tekstid on eesti keeles, koodi nimed inglise keeles.
- Numbrisisend aktsepteerib koma: `"4,98"` → `4.98`.
- Platvormid: `flutter create --platforms=windows,android`. V1 testitakse ainult Windowsis.
- Testide abifunktsioonid (`comp`, `sampleBoard`, `boardWithU1At(Vec2 center, {double pxPerMm = 10, double rot = 0})`, `testLibrary`, `boardWithTraces`, `meas` jne) on failis `test/helpers/fixtures.dart`. Iga ülesanne lisab sinna need abifunktsioonid, mida tema testid esimest korda kasutavad. `boardWithU1At` sisaldab ühte mõõtmist.
- Iga ülesanne lõpeb commitiga. Commiti sõnumi lõpus on rida `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Eri rolliga võrgud liidetakse ühte** (rada GND-st 5V-sse): ühtegi rolli ei kirjutata vaikselt üle, võrk saab `roleConflict = true` ja paneel näitab hoiatust „Võimalik lühis või vale ühendus“. Test on 9. ülesandes.
2. **Mõõtkava muudetakse pärast paigutamist:** komponentide keskpunktid jäävad paigale, korpuse suurus muutub millimeetrite järgi, mõõtmised ei muutu. Test on 4. ülesandes.
3. **Kustutatakse komponent, millel on ühendused ja mõõtmised:** rada saab selle otsas vaba punkti, mõõtmine jääb alles koos loetava sildiga (`U1.4`) ja tagasivõtmine taastab kõik. Test on 3. ülesandes.
4. **Projekt avatakse, aga foto fail puudub:** projekt avaneb ikkagi, `LoadedProject.photoMissing == true` ja kasutaja saab foto uuesti valida. Test on 12. ülesandes.
5. **Komaga arv mõõtmise väljal** (`"4,98"`, `" 12 "`, `"abc"`): kaks esimest loetakse arvuks, viimane annab `null` ja vormi ei salvestata. Test on 2. ülesandes (`parseDecimal`).

---

## Failistruktuur

```
lib/
  main.dart
  app/
    app.dart                    # MaterialApp, teema (portida prototüübi värvitokenid prototype/src/app.css :root)
    app_shell.dart              # ülariba, tööriistariba, külgpaneel, lõuend, alumine riba
    module_registry.dart        # AINUS koht, kus moodulid loetletakse
    module/app_module.dart      # AppModule, CanvasToolSpec, CanvasTool, ToolContext, SidePanelSpec, CanvasLayerSpec
    canvas/board_canvas.dart    # žestid → aktiivne tööriist, kihtide joonistus, pan/zoom
    canvas/view_transform.dart  # ViewTransform (ekraan ↔ foto px)
  core/
    model/{vec2,board,component,pin,connection,net_role,measurement,photo}.dart
    geometry/{component_transform,two_pin_align,bounds}.dart
    footprints/{footprint,library,gen_chip,gen_sop,gen_quad,gen_headers,gen_connectors,gen_semis,gen_points}.dart
    nets/net_resolver.dart
    measure/evaluator.dart
    commands/{command_stack,board_commands}.dart
    io/{project_codec,project_store,prototype_import}.dart
    util/parse.dart
  state/{project_controller,selection,view_state}.dart
  modules/
    photo/ calibration/ components/ pins/ connections/ measurements/ dimensions/ export/
      <nimi>_module.dart + selle mooduli tööriistad, paneelid ja kihid
test/  (sama struktuur nagu lib/)
```

---

### Task 1: Repo, kest ja moodulisüsteem

**Files:**
- Create: `C:\dev\PcbKaardistaja` (`& $flutter create --platforms=windows,android --org ee.pcbkaardistaja pcb_kaardistaja`, siis kaust ümber nimetada), `lib/core/model/vec2.dart`, `lib/app/module/app_module.dart`, `lib/app/module_registry.dart`, `lib/app/app_shell.dart`, `lib/app/app.dart`, `lib/main.dart`, `docs/` (kopeeri ADR, spetsifikatsioon ja see plaan BB kaustast)
- Test: `test/app/module_registry_test.dart`, `test/app/app_shell_test.dart`, `test/core/purity_test.dart`

**Interfaces:**
- Produces:
  - `class Vec2 { const Vec2(this.x, this.y); static const zero = Vec2(0, 0); final double x, y; Vec2 operator +(Vec2 o); Vec2 operator -(Vec2 o); Vec2 scale(double k); double distanceTo(Vec2 o); }` (väärtusvõrdsus)
  - `abstract class AppModule { const AppModule(); String get id; List<CanvasToolSpec> get tools => const []; List<SidePanelSpec> get panels => const []; List<CanvasLayerSpec> get layers => const []; List<InspectorSectionSpec> get inspectorSections => const []; }`
  - `class InspectorSectionSpec { const InspectorSectionSpec({required String id, required int order, required Widget Function(BuildContext, String componentId) build}); }` — valitud komponendi inspektor koosneb kõigi moodulite sektsioonidest `order` järgi
  - `class CanvasToolSpec { const CanvasToolSpec({required String id, required String label, required IconData icon, String? shortcut, required CanvasTool Function() create, String? workflowStep}); }`
  - `abstract class CanvasTool { void onDown(ToolContext c, Vec2 photoPx, PointerDownEvent e) {} void onMove(ToolContext c, Vec2 photoPx, PointerEvent e) {} void onUp(ToolContext c, Vec2 photoPx, PointerUpEvent e) {} void paintOverlay(Canvas canvas, ToolContext c) {} bool onKey(ToolContext c, KeyEvent e) => false; }`
  - `class ToolContext { final WidgetRef ref; final ViewTransform view; ProjectController get project; }` (ProjectController tuleb 3. ülesandes; seni stub)
  - `class SidePanelSpec { const SidePanelSpec({required String id, required String label, required int order, required WidgetBuilder build}); }`
  - `class CanvasLayerSpec { const CanvasLayerSpec({required String id, required int z, required void Function(Canvas, LayerPaintContext) paint}); }`
  - `class ModuleRegistry { ModuleRegistry(List<AppModule> modules); List<CanvasToolSpec> get tools; List<SidePanelSpec> get panels; List<CanvasLayerSpec> get layers; }` — paneelid `order` järgi, kihid `z` järgi, korduv mooduli-, tööriista- või paneeli-id annab `ArgumentError`
  - `final appModulesProvider = Provider<ModuleRegistry>((ref) => ModuleRegistry(const [ /* moodulid lisatakse siia */ ]));`

- [ ] **Step 1: Kirjuta testid**

```dart
test('rejects duplicate module ids', () {
  expect(() => ModuleRegistry([_Fake('a'), _Fake('a')]), throwsArgumentError);
});
test('panels sorted by order, layers by z', () {
  final r = ModuleRegistry([_Fake('a', panelOrder: 20, z: 5), _Fake('b', panelOrder: 10, z: 1)]);
  expect(r.panels.map((p) => p.id), ['b.panel', 'a.panel']);
  expect(r.layers.map((l) => l.id), ['b.layer', 'a.layer']);
});
testWidgets('shell shows a registered module panel tab', (t) async {
  await t.pumpWidget(ProviderScope(overrides: [appModulesProvider.overrideWithValue(ModuleRegistry([_Fake('demo', panelLabel: 'Demo')]))], child: const PcbApp()));
  expect(find.text('Demo'), findsOneWidget);
});
test('core stays pure Dart', () {
  final bad = Directory('lib/core').listSync(recursive: true).whereType<File>()
      .where((f) => f.readAsStringSync().contains(RegExp(r"import 'package:flutter|import 'dart:ui")));
  expect(bad, isEmpty);
});
```

- [ ] **Step 2: Käivita, peab kukkuma.** `& $flutter test test/app test/core/purity_test.dart` → FAIL (`ModuleRegistry` puudub)
- [ ] **Step 3: Kirjuta `AppModule`, spec-klassid ja `ModuleRegistry`.** `AppShell` paigutus: ülariba (töövoo sammud tööriistade `workflowStep` järgi), vasakul vahekaardid `registry.panels`, keskel `BoardCanvas` (seni tühi `Container`), lõuendil vertikaalne tööriistariba `registry.tools`, all `BottomBar` slot.
- [ ] **Step 4: Käivita, peab läbima.** Sama käsk → PASS
- [ ] **Step 5: Commit.** `git init; git add -A; git commit -m "feat: app shell and module registry"`

### Task 2: Andmemudel ja JSON-kodek

**Files:**
- Create: `lib/core/model/*.dart`, `lib/core/nets/net_resolution.dart`, `lib/core/io/project_codec.dart`, `lib/core/util/parse.dart`, `test/helpers/fixtures.dart`
- Test: `test/core/model_codec_test.dart`, `test/core/parse_test.dart`

**Interfaces:**
- Consumes: `Vec2` (1. ülesanne).
- Produces (kõik muutumatud, `copyWith`, väärtusvõrdsus seal, kus märgitud):
  - `enum Verdict { ok, low, high, shortSuspected, noExpectation }` (failis `measurement.dart`; hindamise algoritm tuleb 10. ülesandes)
  - `class ResolvedNet { final String key; /* väikseim ühenduse id */ final Set<PinRef> pins; final Set<String> connectionIds; final String? name; final NetRole? role; final bool roleConflict; final List<NetRole> conflictingRoles; final double lengthMm; }` ja `class NetResolution { const NetResolution(this.nets); final List<ResolvedNet> nets; ResolvedNet? ofPin(PinRef p); ResolvedNet? ofConnection(String id); static const empty = NetResolution([]); }` failis `net_resolution.dart` (lahendaja algoritm tuleb 9. ülesandes)
  - `enum Side { top, bottom }`, `enum CopperLayer { top, bottom, wire }`, `enum ConnectionBasis { visual, measured, assumed }`, `enum NetRoleKind { ground, power, signal, unknown }`, `enum MeasurementMode { voltage, resistance, diode, continuity }`, `enum PowerState { on, off, unknown }`
  - `class PinRef { const PinRef(this.componentId, this.pinId); String get key => '$componentId:$pinId'; }` (==)
  - `class Endpoint { const Endpoint.pin(PinRef pin); const Endpoint.free(Vec2 point); final PinRef? pin; final Vec2? point; }`
  - `class CustomPin { final String id; final Vec2 localMm; final double sizeMm; }`
  - `class Component { final String id, ref, value, footprintKey, note; final Map<String, Object> params; final Vec2 center; final double rotationDeg, scaleX, scaleY; final Side side; final Map<String, String> pinNames; final List<CustomPin> extraPins; }`
  - `class Connection { final String id; final Endpoint a, b; final List<Vec2> waypoints; final double widthMm; final CopperLayer layer; final ConnectionBasis basis; }`
  - `class NetRole { final String id, label; final NetRoleKind kind; final double? nominalVolts; final int colorArgb; }`
  - `const defaultNetRoles = [NetRole(id:'gnd',label:'GND',kind:ground,nominalVolts:0,colorArgb:0xFF7B8A84), NetRole('v3v3','3V3',power,3.3,0xFF1F9E6E), NetRole('v5','5V',power,5.0,0xFFE0532F), NetRole('v12','12V',power,12.0,0xFFC0399B), NetRole('sig','Signaal',signal,null,0xFF2F74E0), NetRole('unk','Teadmata',unknown,null,0xFF9AA5A0)];`
  - `class NetLabel { final String anchorKey; /* PinRef.key või 'conn:<id>' */ final String? name; final String? roleId; }`
  - `class Measurement { final String id; final MeasurementMode mode; final PinRef probe; final PinRef? reference; final String probeLabel; final String? referenceLabel; final double? value; final bool? continuity; final PowerState powerState; final DateTime takenAt; final String note; }`
  - `class PhotoRef { final String fileName; final int widthPx, heightPx; final double opacity, contrast; final bool gray; }`
  - `class Board { final int schemaVersion; final String name; final double pxPerMm; final bool calibrated; final PhotoRef? photo; final List<Component> components; final List<Connection> connections; final List<NetLabel> netLabels; final List<NetRole> roles; final List<Measurement> measurements; final List<Dimension> dimensions; final BoardOutline? outline; factory Board.empty(); }`
  - `class Dimension { final String id; final Endpoint a, b; final double offsetPx; }`, `class BoardOutline { final double x, y, w, h; /* foto px */ final bool showDims; }` (tööriistad tulevad 11. ülesandes)
  - `Map<String, dynamic> encodeBoard(Board b)`, `Board decodeBoard(Map<String, dynamic> json)` failis `project_codec.dart`; tundmatu `schema_version` > 1 annab `FormatException`
  - `double? parseDecimal(String s)` failis `parse.dart`

- [ ] **Step 1: Kirjuta testid**

```dart
test('round-trips a board with every entity', () {
  final b = sampleBoard(); // abifunktsioon testis: 2 komponenti, 1 ühendus, 1 NetLabel, 1 mõõtmine, foto, mõõtjoon, kontuur
  expect(decodeBoard(jsonDecode(jsonEncode(encodeBoard(b)))), b);
});
test('uses BenchBeep-compatible keys', () {
  final j = encodeBoard(sampleBoard());
  expect(j['schema_version'], 1);
  final m = (j['measurements'] as List).first as Map;
  expect(m.keys, containsAll(['mode', 'power_state', 'probe']));
  expect((m['probe'] as Map).keys, containsAll(['component_id', 'pin_id']));
  expect(((j['connections'] as List).first as Map)['confirmation_basis'], 'visual');
});
test('rejects future schema', () => expect(() => decodeBoard({'schema_version': 2}), throwsFormatException));
test('parseDecimal', () {
  expect(parseDecimal('4,98'), 4.98);
  expect(parseDecimal(' 12 '), 12.0);
  expect(parseDecimal('-0,5'), -0.5);
  expect(parseDecimal('abc'), isNull);
  expect(parseDecimal(''), isNull);
});
```

- [ ] **Step 2: Käivita, peab kukkuma.** `& $flutter test test/core/model_codec_test.dart test/core/parse_test.dart` → FAIL
- [ ] **Step 3: Kirjuta mudel ja kodek.** Võrdsuse jaoks loendid ja kaardid `ListEquality`/`MapEquality` abil (`package:collection` tuleb Flutteri SDK-ga; lisa `collection: any` sõltuvustesse).
- [ ] **Step 4: Käivita, peab läbima.** → PASS
- [ ] **Step 5: Commit.** `git commit -am "feat(core): board model and JSON codec"`

### Task 3: Käsud ja tagasivõtmine

**Files:**
- Create: `lib/core/commands/command_stack.dart`, `lib/core/commands/board_commands.dart`, `lib/state/project_controller.dart`, `lib/state/selection.dart`
- Test: `test/core/commands_test.dart`

**Interfaces:**
- Consumes: Task 2 mudel.
- Produces:
  - `abstract class Command { String get label; Board apply(Board b); }`
  - `class CommandStack { CommandStack(Board initial); Board get board; bool get canUndo; bool get canRedo; void execute(Command c); void undo(); void redo(); void beginPreview(); void preview(Board b); void commitPreview(String label); void cancelPreview(); }` (hetktõmmised, maksimaalselt 200 sammu)
  - `typedef PinLocator = Vec2? Function(Board b, PinRef p);` (rakenduses antakse ette funktsioon, mis arvutab jala asukoha `FootprintLibrary` ja `ComponentTransform` abil)
  - Käsud: `AddComponent(Component)`, `UpdateComponent(String id, Component Function(Component))`, `DeleteItems(Set<String> ids, PinLocator locate)`, `AddConnection(Connection)`, `UpdateConnection(String id, Connection Function(Connection))`, `SetNetLabel(NetLabel)`, `AddRole(NetRole)`, `AddMeasurement(Measurement)`, `DeleteMeasurement(String id)`, `Recalibrate(double pxPerMm)`, `AddCustomPin(String componentId, CustomPin)`, `RemoveCustomPin(String componentId, String pinId)`
  - `DeleteItems` muudab kustutatud komponendi jalgadele viitavad `Endpoint.pin` otsad `Endpoint.free(locate(board, pin) ?? Vec2.zero)`-ks. Mõõtmised jäävad alles, nende `probeLabel` jääb samaks.
  - `final projectProvider = NotifierProvider<ProjectController, ProjectState>(ProjectController.new);` kus `ProjectState { Board board; bool canUndo, canRedo; }`, meetodid `execute`, `undo`, `redo`, `beginPreview`, `preview`, `commitPreview`, `cancelPreview`
  - `final selectionProvider = NotifierProvider<SelectionController, Selection>(...)`, `Selection { Set<String> ids; PinRef? pin; String? highlightedNetKey; }`

- [ ] **Step 1: Kirjuta testid**

```dart
test('undo/redo restores boards', () {
  final s = CommandStack(Board.empty());
  s.execute(AddComponent(comp('c1')));
  expect(s.board.components, hasLength(1));
  s.undo(); expect(s.board.components, isEmpty);
  s.redo(); expect(s.board.components, hasLength(1));
});
test('preview then commit is one undo step', () {
  final s = CommandStack(Board.empty())..execute(AddComponent(comp('c1')));
  s.beginPreview();
  for (var i = 1; i <= 5; i++) { s.preview(UpdateComponent('c1', (c) => c.copyWith(center: Vec2(i * 10, 0))).apply(s.board)); }
  s.commitPreview('Liiguta');
  expect(s.board.components.single.center, const Vec2(50, 0));
  s.undo(); expect(s.board.components.single.center, comp('c1').center);
});
test('deleting a component frees connection ends and keeps measurements', () {
  final s = CommandStack(boardWithU1ConnectedAndMeasured()); // U1.4 ühendatud C1.2-ga, mõõtmine U1.4 peal, probeLabel 'U1.4'
  s.execute(DeleteItems({'u1'}, (b, p) => const Vec2(10, 10)));
  final c = s.board.connections.single;
  expect(c.a.pin, isNull); expect(c.a.point, isNotNull);
  expect(s.board.measurements.single.probeLabel, 'U1.4');
  s.undo();
  expect(s.board.connections.single.a.pin, const PinRef('u1', '4'));
});
```

- [ ] **Step 2: Käivita, peab kukkuma.** `& $flutter test test/core/commands_test.dart` → FAIL
- [ ] **Step 3: Kirjuta `CommandStack`, käsud ja kontrollerid.**
- [ ] **Step 4: Käivita, peab läbima.** → PASS
- [ ] **Step 5: Commit.** `git commit -am "feat(core): command stack and board commands"`

### Task 4: Geomeetria: komponendi teisendus, vaade, kahe jala joondus

**Files:**
- Create: `lib/core/geometry/component_transform.dart`, `lib/core/geometry/two_pin_align.dart`, `lib/core/geometry/bounds.dart`, `lib/app/canvas/view_transform.dart`
- Test: `test/core/geometry_test.dart`, `test/app/view_transform_test.dart`

**Interfaces:**
- Produces:
  - `class ComponentTransform { ComponentTransform(Component c, double pxPerMm); Vec2 localToPhoto(Vec2 mm); Vec2 photoToLocal(Vec2 px); }` — järjekord: `(x·scaleX, y·scaleY)` → peegeldus `x = −x`, kui `side == bottom` → pööre `rotationDeg` (päripäeva, y alla) → `·pxPerMm` → `+ center`
  - `class AlignResult { final Vec2 center; final double rotationDeg; final double scale; }`
  - `AlignResult twoPinAlign({required Vec2 localA, required Vec2 localB, required Vec2 photoA, required Vec2 photoB, required double pxPerMm, required Side side})` — ühtlane mõõtkava `s = |photoB − photoA| / (|localB' − localA'| · pxPerMm)`, kus `'` tähendab peegeldust põhja poolel; pööre on `atan2(photoB − photoA) − atan2(localB' − localA')` kraadides, normaliseeritud vahemikku [0, 360)
  - `class Bounds { final double x0, y0, x1, y1; Bounds expand(double m); bool contains(Vec2 p); }`
  - `class ViewTransform { final double zoom; final Vec2 pan; Vec2 toPhoto(Offset screen); Offset toScreen(Vec2 photo); ViewTransform zoomAt(Offset screen, double factor); ViewTransform fit(Bounds content, Size viewport, {double padding = 40}); }` — `zoom` piiratud vahemikku [0.02, 80]

- [ ] **Step 1: Kirjuta testid**

```dart
test('localToPhoto and back are inverse, incl. bottom side and scale', () {
  final c = comp('c1').copyWith(center: const Vec2(100, 50), rotationDeg: 30, side: Side.bottom, scaleX: 1.2, scaleY: 0.8);
  final t = ComponentTransform(c, 14);
  final p = t.localToPhoto(const Vec2(2.8, -1.905));
  final back = t.photoToLocal(p);
  expect(back.x, closeTo(2.8, 1e-9)); expect(back.y, closeTo(-1.905, 1e-9));
});
test('rotation 90 maps +x local to +y photo', () {
  final t = ComponentTransform(comp('c1').copyWith(center: Vec2.zero, rotationDeg: 90), 10);
  final p = t.localToPhoto(const Vec2(1, 0));
  expect(p.x, closeTo(0, 1e-9)); expect(p.y, closeTo(10, 1e-9));
});
test('two-pin align recovers pose', () {
  final truth = comp('u').copyWith(center: const Vec2(400, 300), rotationDeg: 37, scaleX: 1.05, scaleY: 1.05);
  final t = ComponentTransform(truth, 14);
  const a = Vec2(-2.8, -1.905), b = Vec2(2.8, -1.905); // SOIC-8 jalg 1 ja jalg 8
  final r = twoPinAlign(localA: a, localB: b, photoA: t.localToPhoto(a), photoB: t.localToPhoto(b), pxPerMm: 14, side: Side.top);
  expect(r.center.distanceTo(truth.center), lessThan(1e-6));
  expect(r.rotationDeg, closeTo(37, 1e-6)); expect(r.scale, closeTo(1.05, 1e-9));
});
test('recalibration keeps component centres', () {
  final b0 = boardWithU1At(const Vec2(400, 300), pxPerMm: 10);
  final b1 = Recalibrate(14).apply(b0);
  expect(b1.components.single.center, const Vec2(400, 300));
  expect(b1.pxPerMm, 14); expect(b1.calibrated, isTrue);
  expect(b1.measurements, b0.measurements);
});
test('zoomAt keeps the point under the cursor fixed', () {
  final v = ViewTransform(zoom: 1, pan: const Vec2(10, 20));
  final before = v.toPhoto(const Offset(300, 200));
  final after = v.zoomAt(const Offset(300, 200), 1.7).toPhoto(const Offset(300, 200));
  expect(after.distanceTo(before), lessThan(1e-9));
});
```

- [ ] **Step 2: Käivita, peab kukkuma.** `& $flutter test test/core/geometry_test.dart test/app/view_transform_test.dart` → FAIL
- [ ] **Step 3: Kirjuta teisendused ja `twoPinAlign`.**
- [ ] **Step 4: Käivita, peab läbima.** → PASS
- [ ] **Step 5: Commit.** `git commit -am "feat(core): component/view transforms and two-pin align"`

### Task 5: Korpuste teek (prototüübist porditud)

**Files:**
- Create: `lib/core/footprints/footprint.dart`, `library.dart`, `gen_chip.dart` (chip, tant, diood-SMD, LED-SMD, elsmd, axial, disc, radial, LED-THT), `gen_sop.dart` (SOIC, TSSOP, DIP), `gen_quad.dart` (QFP, QFN), `gen_headers.dart` (hdr1, hdr2, JST, kruviklemm), `gen_connectors.dart` (USB-C, micro-USB, DC-pesa), `gen_semis.dart` (SOT-23/5/6, SOT-223, DPAK, TO-92, TO-220, kvartsid, nupp, trimmer), `gen_points.dart` (testpunkt, via, padi, juhe, ava, kohandatud)
- Test: `test/core/footprints_test.dart`

**Interfaces:**
- Produces:
  - `enum PinShape { rect, circle, oval }`, `enum FootprintCategory { passive, semi, ic, connector, misc, point }`
  - `class FootprintPin { final String id, name; final Vec2 pos; final double w, h, drill; final PinShape shape; }`
  - `sealed class FpShape` → `FpRect(x, y, w, h, r)`, `FpCircle(cx, cy, r)`, `FpPath(List<Vec2> points, {bool closed})`, `FpDot(cx, cy, r)`; kaared asendatakse 16-lõigulise polüjoonega
  - `class Footprint { final List<FpShape> body, marks; final List<FootprintPin> pins; final Bounds bounds; FootprintPin? pin(String id); }`
  - `class ParamSpec { final String key, label; final List<String>? options; final double? min, max, step; final Object defaultValue; }`
  - `abstract class FootprintGenerator { String get key; String get name; FootprintCategory get category; String get refPrefix; String get defaultValue; List<String> get keywords; List<ParamSpec> get params; Footprint generate(Map<String, Object> params); }`
  - `class FootprintLibrary { FootprintLibrary(List<FootprintGenerator> gens); List<FootprintGenerator> get all; FootprintGenerator byKey(String key); Footprint forComponent(Component c); /* vahemälu key+params järgi, lisab extraPins ja pinNames */ }`
  - `final footprintLibraryProvider = Provider((_) => FootprintLibrary(allGenerators));` (failis `lib/state/project_controller.dart`, sest provider on Flutteri pool)
- Portimise reegel: võtmed, nimed, prefiksid, parameetrid ja **kõik arvväärtused** võetakse 1:1 failist `BB\prototype\src\js\01-footprints.js` (`LIB`, `CHIP`, `TANT`, `DIO`, `JST` ja generaatorifunktsioonid `g*`). Nii avaneb prototüübi import (12. ülesanne) samade jalgadega.

- [ ] **Step 1: Kirjuta testid**

```dart
final lib = FootprintLibrary(allGenerators);
Footprint fp(String k, [Map<String, Object> p = const {}]) => lib.byKey(k).generate({...defaultsOf(lib.byKey(k)), ...p});
test('library has every prototype key', () {
  expect(lib.all.map((g) => g.key).toSet(), containsAll(['r_smd','c_smd','l_smd','f_smd','c_tant','c_elsmd','r_tht','c_disc','c_el','d_smd','d_tht','led_smd','led_tht','sot23','sot223','dpak','to92','to220','soic','tssop','dip','qfp','qfn','hdr1','hdr2','jst','term','usbc','musb','dcjack','xtal','xtal_smd','btn','pot','custom','tp','via','pad','wire','hole']));
});
test('SOIC-8 pin positions', () {
  final f = fp('soic');
  expect(f.pins, hasLength(8));
  expect(f.pin('1')!.pos, const Vec2(-2.8, -1.905));
  expect(f.pin('8')!.pos, const Vec2(2.8, -1.905));
});
test('QFP-44 numbering runs counter-clockwise from top-left', () {
  final f = fp('qfp'); // 44 jalga, samm 0.8, kere 10 mm
  expect(f.pins, hasLength(44));
  expect(f.pin('1')!.pos.x, lessThan(0)); expect(f.pin('1')!.pos.y, lessThan(0));
  expect(f.pin('12')!.pos.y, greaterThan(0));   // alumise külje esimene
  expect(f.pin('34')!.pos.y, lessThan(0));      // ülemise külje esimene (paremal)
});
test('USB-C names', () {
  final f = fp('usbc');
  expect(f.pins, hasLength(16));
  expect(f.pin('A4B9')!.name, 'VBUS'); expect(f.pin('B1A12')!.name, 'GND');
});
test('header 1x4 pitch 2.54', () => expect(fp('hdr1').pin('4')!.pos, const Vec2(3.81, 0)));
test('forComponent applies pinNames and extra pins', () {
  final c = comp('u').copyWith(footprintKey: 'soic', pinNames: {'4': 'GND'}, extraPins: [const CustomPin(id: '9', localMm: Vec2(0, 0), sizeMm: 1)]);
  final f = lib.forComponent(c);
  expect(f.pin('4')!.name, 'GND'); expect(f.pins, hasLength(9));
});
```

- [ ] **Step 2: Käivita, peab kukkuma.** `& $flutter test test/core/footprints_test.dart` → FAIL
- [ ] **Step 3: Pordi generaatorid.** Üks fail kategooria kohta, igaüks alla ~250 rea.
- [ ] **Step 4: Käivita, peab läbima.** → PASS
- [ ] **Step 5: Commit.** `git commit -am "feat(core): parametric footprint library ported from prototype"`

### Task 6: Lõuend, fotomoodul ja kalibreerimismoodul

**Files:**
- Create: `lib/app/canvas/board_canvas.dart`, `lib/state/view_state.dart`, `lib/modules/photo/photo_module.dart`, `lib/modules/photo/photo_layer.dart`, `lib/modules/photo/photo_controls.dart` (alumise riba liugur „Foto nähtavus“, kontrast, hall, pööra 90°, peegelda), `lib/modules/calibration/calibration_module.dart`, `lib/modules/calibration/calibration_tool.dart`, `lib/modules/calibration/calibration_dialog.dart`
- Modify: `lib/app/module_registry.dart` (lisa `PhotoModule()`, `CalibrationModule()`)
- Test: `test/modules/calibration_test.dart`, `test/modules/photo_transform_test.dart`

**Interfaces:**
- Consumes: `ViewTransform`, `projectProvider`, `ModuleRegistry.layers`.
- Produces:
  - `BoardCanvas`: joonistab `registry.layers` järjekorras ühe `CustomPainter`iga, millele antakse `LayerPaintContext { Board board; ViewTransform view; Footprint Function(Component) fp; Selection selection; NetResolution nets; }` (`nets` tuleb 9. ülesandes; seni tühi). Rullik suumib kursori ümber, keskmine nupp või tühik koos lohistamisega liigutab vaadet, klahv `0` sobitab vaate. Ülejäänud sündmused lähevad aktiivsele `CanvasTool`ile.
  - `final viewStateProvider` → `ViewState { ViewTransform view; String activeToolId; Map<String, bool> layerVisible; ui.Image? photoImage; }`
  - `double pxPerMmFromCalibration(Vec2 a, Vec2 b, double realMm)`, mis viskab `ArgumentError`, kui `realMm <= 0` või punktid ühtivad
  - `Board rotatePhoto90(Board b, int photoW, int photoH)` ja `Board mirrorPhoto(Board b, int photoW)`, mis teisendavad kõik koordinaadid (portida prototüübi `transformImage`, `prototype/src/js/06-io.js`)

- [ ] **Step 1: Kirjuta testid**

```dart
test('calibration from two points', () {
  expect(pxPerMmFromCalibration(const Vec2(0, 0), const Vec2(1064, 0), 76), closeTo(14, 1e-9));
  expect(() => pxPerMmFromCalibration(const Vec2(1, 1), const Vec2(1, 1), 10), throwsArgumentError);
  expect(() => pxPerMmFromCalibration(Vec2.zero, const Vec2(10, 0), 0), throwsArgumentError);
});
test('rotate photo 90 moves components and keeps pins on the same photo features', () {
  final b = boardWithU1At(const Vec2(100, 40), pxPerMm: 10);
  final r = rotatePhoto90(b, 800, 600);
  expect(r.components.single.center, const Vec2(560, 100)); // (H - y, x)
  expect(r.components.single.rotationDeg, 90);
});
test('mirror photo flips side and rotation', () {
  final b = boardWithU1At(const Vec2(100, 40), pxPerMm: 10, rot: 30);
  final m = mirrorPhoto(b, 800);
  expect(m.components.single.center, const Vec2(700, 40));
  expect(m.components.single.side, Side.bottom); expect(m.components.single.rotationDeg, 330);
});
```

- [ ] **Step 2: Käivita, peab kukkuma.** `& $flutter test test/modules/calibration_test.dart test/modules/photo_transform_test.dart` → FAIL
- [ ] **Step 3: Kirjuta lõuend, moodulid ja dialoog.** Dialoogis on kiirvalikud 2,54 / 10,16 / 25,4 / 10 / 50 / 100 ja `parseDecimal`.
- [ ] **Step 4: Käivita testid (PASS) ja käsitsi kontroll:** `& $flutter run -d windows` → foto avaneb, liugur muudab nähtavust, kalibreerimine muudab alumise riba näitu `px/mm`.
- [ ] **Step 5: Commit.** `git commit -am "feat: canvas host, photo and calibration modules"`

### Task 7: Komponentide moodul: teek, paigutus, liigutamine, suuruse muutmine, kahe jala joondus

**Files:**
- Create: `lib/modules/components/components_module.dart`, `library_panel.dart` (otsing, kategooriad, pisipildid generaatorist), `place_tool.dart`, `select_tool.dart` (valik, raamvalik, lohistamine, R = 90°, Q/E = ±1°, F = teisele poolele, Del), `resize_handles.dart`, `align_tool.dart`, `component_inspector.dart` (tähis, väärtus, parameetrid, X/Y mm, pööre, pool, laius/kõrgus %), `component_layer.dart`
- Modify: `lib/app/module_registry.dart` (lisa `ComponentsModule()`)
- Test: `test/modules/components_test.dart`

**Interfaces:**
- Consumes: `FootprintLibrary`, `ComponentTransform`, `twoPinAlign`, käsud `AddComponent`, `UpdateComponent`, `DeleteItems`.
- Produces:
  - `String nextRef(Board b, String prefix)`, mis annab `R1`, `R2` …; arvestab ainult kujuga `^PREFIX\d+$` tähiseid
  - `Component resizeByHandle(Component c, Footprint f, double pxPerMm, ResizeHandle h, Vec2 photoPx, {bool keepAspect = false})`, kus `enum ResizeHandle { n, s, e, w, ne, nw, se, sw }`. Vastasserv jääb paigale; `scaleX` ja `scaleY` on piiratud vahemikku [0.2, 5.0]; Shift = `keepAspect`.
  - Joondustööriist: vali komponent → klõpsa jalg A → klõpsa foto punkt A → klõpsa jalg B → klõpsa foto punkt B → `UpdateComponent` koos `twoPinAlign` tulemusega (`scaleX = scaleY = scale`).

- [ ] **Step 1: Kirjuta testid**

```dart
test('nextRef', () {
  final b = boardWithRefs(['R1', 'R3', 'RV1', 'C2']);
  expect(nextRef(b, 'R'), 'R4'); expect(nextRef(b, 'C'), 'C3'); expect(nextRef(b, 'U'), 'U1');
});
test('dragging east handle doubles width and keeps west edge', () {
  final f = testLibrary.forComponent(soic8At(const Vec2(500, 300))); // keha laius 3.9 mm
  final c = soic8At(const Vec2(500, 300));
  final westBefore = ComponentTransform(c, 10).localToPhoto(Vec2(f.bounds.x0, 0));
  final eastTarget = ComponentTransform(c, 10).localToPhoto(Vec2(f.bounds.x1 + (f.bounds.x1 - f.bounds.x0), 0));
  final r = resizeByHandle(c, f, 10, ResizeHandle.e, eastTarget);
  expect(r.scaleX, closeTo(2.0, 1e-6)); expect(r.scaleY, 1.0);
  expect(ComponentTransform(r, 10).localToPhoto(Vec2(f.bounds.x0, 0)).distanceTo(westBefore), lessThan(1e-6));
});
test('scale is clamped', () {
  final c = soic8At(Vec2.zero), f = testLibrary.forComponent(c);
  expect(resizeByHandle(c, f, 10, ResizeHandle.e, const Vec2(-1000, 0)).scaleX, 0.2);
});
```

- [ ] **Step 2: Käivita, peab kukkuma.** `& $flutter test test/modules/components_test.dart` → FAIL
- [ ] **Step 3: Kirjuta moodul, tööriistad, paneelid ja kiht.** Valitud komponendil on 8 käepidet (ekraanil 8 px ruudud) ja kontuur katkendjoonega.
- [ ] **Step 4: Käivita testid (PASS) ja käsitsi kontroll:** paiguta SOIC-8, venita käepidemega, joonda kahe jalaga foto peale.
- [ ] **Step 5: Commit.** `git commit -am "feat(components): place, move, resize and two-pin align"`

### Task 8: Jalgade moodul: eristatavad jalad, oma jalad, nimed

**Files:**
- Create: `lib/modules/pins/pins_module.dart`, `pin_style.dart`, `pin_layer.dart`, `pin_hit_test.dart`, `add_pin_tool.dart`, `pin_table_section.dart` (inspektori sektsioon: nr, nimi, võrgu kiip, ühendused „→ U2.3 · C1.1“, nupud „alusta rada siit“, „mõõda“, „kustuta“ (ainult oma jalgadel))
- Modify: `lib/app/module_registry.dart` (lisa `PinsModule()`)
- Test: `test/modules/pins_test.dart`

**Interfaces:**
- Consumes: `NetResolution`, `ResolvedNet`, `Verdict` (2. ülesanne; tegelikud väärtused tulevad 9. ja 10. ülesandest, seni `NetResolution.empty` ja tühi hinnangute kaart), `AddCustomPin`, `RemoveCustomPin`.
- Produces:
  - `enum PinVisualState { unconnected, connected, measuredOk, suspect }`
  - `PinVisualState pinVisualState(PinRef p, NetResolution nets, Map<PinRef, Verdict> verdicts)`, prioriteet: `suspect` (low/high/shortSuspected) > `measuredOk` (ok) > `connected` (jalg on võrgus) > `unconnected`
  - `class PinStyle { final int fillArgb; final int strokeArgb; final double strokeWidth; final bool hollow; final bool squareMarker; }`
  - `PinStyle stylePin(PinVisualState s, {required bool isPin1, required bool selected, NetRole? role})`, fikseeritud väärtused: suspect `stroke 0xFFD93B2B, 3.0`; measuredOk `stroke 0xFF2C8150, 2.5`; connected `fill = role?.colorArgb ?? 0xFFD0A630, hollow false`; unconnected `hollow true, stroke 0xFF9AA5A0, 1.5`; selected `strokeWidth += 2`; `squareMarker = isPin1`
  - `double screenPinRadius(FootprintPin p, double pxPerMm, double zoom)` = `max(min(p.w, p.h) / 2 * pxPerMm * zoom, 5.0)`; jala number joonistatakse, kui raadius ≥ 7, nimi lisaks siis, kui raadius ≥ 14
  - `PinRef? hitTestPin(Board b, FootprintLibrary lib, Vec2 photoPx, double zoom)` leiab lähima jala, kui kaugus ≤ `max(jala raadius foto px-s, 6 / zoom)`
  - `String nextPinId(Footprint f)` = suurim täisarvuline id + 1
  - Mooduli `inspectorSections` → `pin_table_section.dart`

- [ ] **Step 1: Kirjuta testid**

```dart
test('pin state priority', () {
  final p = const PinRef('u1', '4');
  final nets = netsWith({p});
  expect(pinVisualState(p, NetResolution.empty, {}), PinVisualState.unconnected);
  expect(pinVisualState(p, nets, {}), PinVisualState.connected);
  expect(pinVisualState(p, nets, {p: Verdict.ok}), PinVisualState.measuredOk);
  expect(pinVisualState(p, nets, {p: Verdict.low}), PinVisualState.suspect);
  expect(pinVisualState(p, NetResolution.empty, {p: Verdict.shortSuspected}), PinVisualState.suspect);
});
test('pins never shrink below 10 px on screen', () {
  expect(screenPinRadius(fpPin(w: .3, h: .3), 10, .5), 5.0);
  expect(screenPinRadius(fpPin(w: 2, h: 1), 10, 2), 10.0);
});
test('hit test picks the nearest of two close pins', () {
  final b = boardWithSoic8At(const Vec2(500, 300), pxPerMm: 14);
  final p1 = pinPhoto(b, '1'), p2 = pinPhoto(b, '2');
  expect(hitTestPin(b, testLibrary, p1 + (p2 - p1).scale(.3), 1), const PinRef('u1', '1'));
  expect(hitTestPin(b, testLibrary, const Vec2(0, 0), 1), isNull);
});
test('nextPinId', () => expect(nextPinId(testLibrary.byKey('soic').generate(defaultsOf(testLibrary.byKey('soic')))), '9'));
```

- [ ] **Step 2: Käivita, peab kukkuma.** `& $flutter test test/modules/pins_test.dart` → FAIL
- [ ] **Step 3: Kirjuta stiil, kiht, tabamuse test, jala lisamise tööriist ja inspektori sektsioon.**
- [ ] **Step 4: Käivita, peab läbima.** → PASS
- [ ] **Step 5: Commit.** `git commit -am "feat(pins): distinct pin states, custom pins and pin table"`

### Task 9: Ühendused, võrgud ja võrgu rollid

**Files:**
- Create: `lib/core/nets/net_resolver.dart`, `lib/modules/connections/connections_module.dart`, `trace_tool.dart`, `connection_layer.dart`, `nets_panel.dart`, `role_editor_dialog.dart`, `connection_inspector_section.dart`, `assign_net_role.dart`
- Modify: `lib/state/project_controller.dart` (lisa `netsProvider`), `lib/app/module_registry.dart` (lisa `ConnectionsModule()`)
- Test: `test/core/net_resolver_test.dart`, `test/modules/assign_role_test.dart`

**Interfaces:**
- Consumes: `ComponentTransform`, `FootprintLibrary`, `Connection`, `NetLabel`, `NetRole`, `ResolvedNet`, `NetResolution` (2. ülesanne), `hitTestPin`.
- Produces:
  - `NetResolution resolveNets(Board b, FootprintLibrary lib)` — union-find. Vaba ots liitub teise ühendusega, kui kaugus selle polüjoonest on ≤ `0.25 mm · pxPerMm + teise laius / 2`, või jalaga, kui ots on jala padjandi raadiuse sees. `NetLabel` kuulub võrku, kui `anchorKey` on selle võrgu jala võti või `'conn:<id>'` selle võrgu ühendusest. Kui siltidel on eri `roleId`, siis `roleConflict = true` ja `role = null`. Nimeks saab esimene mitte-null `name` ankrute järjekorras.
  - `final netsProvider = Provider<NetResolution>((ref) => resolveNets(ref.watch(projectProvider).board, ref.watch(footprintLibraryProvider)));`
  - `class AssignNetRole implements Command { AssignNetRole(ResolvedNet net, {String? roleId, String? name}); }` — eemaldab kõik selle võrgu sildid ja lisab ühe, mille ankur on esimene jalg (`pins` tähise ja jala järgi sorteeritult) või `'conn:<key>'`
  - Rajatööriist: alusta jalal, punktil või rajal; klõpsud lisavad vahepunkte; Shift = 45°; lõpeta jalal, rajal või topeltklõpsuga; Esc katkestab; Backspace eemaldab viimase punkti; valikud on kiht (pealmine/alumine/juhe), laius mm ja alus (nähtud/mõõdetud/oletatud)
  - Joonistus: rolli värv, kui roll on olemas, muidu kihi värv; `assumed` katkendjoonega; valitud võrk tõstetakse esile, teised tuhmistatakse 16 %-ni
  - Võrkude paneel: rolli kiip ja valik, nimeväli, jalakiibid (klõps valib jala), pikkus mm. Konflikti korral punane rida „Võimalik lühis või vale ühendus: GND + 5V“. Nupp „+ Uus roll“ avab `role_editor_dialog` (nimi, tüüp, nimipinge `parseDecimal`, värv 12 värvi paletist).

- [ ] **Step 1: Kirjuta testid**

```dart
test('connections sharing a pin form one net', () {
  final r = resolveNets(boardWithTraces([['u1:4', 'c1:2'], ['c1:2', 'j1:1']]), testLibrary);
  expect(r.nets, hasLength(1));
  expect(r.nets.single.pins, {const PinRef('u1', '4'), const PinRef('c1', '2'), const PinRef('j1', '1')});
});
test('free end within 0.25 mm of another trace joins it', () {
  final r = resolveNets(boardWithTJunction(gapMm: .2), testLibrary);
  expect(r.nets, hasLength(1));
  expect(resolveNets(boardWithTJunction(gapMm: .6), testLibrary).nets, hasLength(2));
});
test('label assigns role and name', () {
  final b = boardWithTraces([['u1:4', 'c1:2']]).copyWith(netLabels: [const NetLabel(anchorKey: 'c1:2', roleId: 'gnd')]);
  final n = resolveNets(b, testLibrary).nets.single;
  expect(n.role!.label, 'GND'); expect(n.roleConflict, isFalse);
});
test('merging GND and 5V nets flags a conflict instead of overwriting', () {
  final b = boardWithTraces([['u1:4', 'c1:2'], ['u1:8', 'c2:1'], ['c1:2', 'c2:1']])
      .copyWith(netLabels: [const NetLabel(anchorKey: 'u1:4', roleId: 'gnd'), const NetLabel(anchorKey: 'u1:8', roleId: 'v5')]);
  final n = resolveNets(b, testLibrary).nets.single;
  expect(n.roleConflict, isTrue); expect(n.role, isNull);
  expect(n.conflictingRoles.map((r) => r.id), unorderedEquals(['gnd', 'v5']));
});
test('AssignNetRole resolves a conflict to one label', () {
  final b0 = conflictedBoard(); final n = resolveNets(b0, testLibrary).nets.single;
  final b1 = AssignNetRole(n, roleId: 'gnd').apply(b0);
  final n1 = resolveNets(b1, testLibrary).nets.single;
  expect(n1.roleConflict, isFalse); expect(n1.role!.id, 'gnd'); expect(b1.netLabels, hasLength(1));
});
```

- [ ] **Step 2: Käivita, peab kukkuma.** `& $flutter test test/core/net_resolver_test.dart test/modules/assign_role_test.dart` → FAIL
- [ ] **Step 3: Kirjuta `resolveNets` (porditud prototüübi `getNets`-ist, `prototype/src/js/02-state.js`), käsk, tööriist, kiht ja paneel.**
- [ ] **Step 4: Käivita, peab läbima.** → PASS
- [ ] **Step 5: Commit.** `git commit -am "feat(connections): traces, nets and net roles with conflict warning"`

### Task 10: Mõõtmiste moodul ja hindamine

**Files:**
- Create: `lib/core/measure/evaluator.dart`, `lib/modules/measurements/measurements_module.dart`, `quick_measure_panel.dart`, `measurements_list_panel.dart` (filtrid: kõik / kahtlased / toitega / toiteta), `measurement_layer.dart` (väärtuse silt jala kõrval), `measure_inspector_section.dart` (valitud jala viimased mõõtmised)
- Modify: `lib/app/module_registry.dart` (lisa `MeasurementsModule()`), `lib/modules/pins/pin_layer.dart` (kasuta `latestVerdicts`)
- Test: `test/core/evaluator_test.dart`

**Interfaces:**
- Consumes: `NetResolution`, `Measurement`, `Verdict` (2. ülesanne), `AddMeasurement`, `DeleteMeasurement`, `parseDecimal`.
- Produces:
  - `Verdict evaluateMeasurement(Measurement m, NetResolution nets)` — reeglid 1:1 spetsifikatsiooni jaotisest „Mõõtmise hindamine“
  - `Map<PinRef, Verdict> latestVerdicts(Board b, NetResolution nets)` — iga jala kohta viimane mõõtmine `takenAt` järgi; takistuse ja läbivuse korral saavad hinnangu mõlemad otsad
  - `String formatReading(Measurement m)` → `"4,98 V"`, `"0,40 Ω"`, `"0,62 V (diood)"`, `"piiks"` / `"ei piiksu"`
  - `const verdictLabels = {Verdict.ok: 'OK', Verdict.low: 'madal', Verdict.high: 'kõrge', Verdict.shortSuspected: 'lühis?', Verdict.noExpectation: '—'};`
  - Kiirsisestus (valitud jalale): režiim (Pinge/Takistus/Diood/Läbivus), väärtus (`parseDecimal`; „Salvesta“ on keelatud, kui tulemus on `null` ja režiim pole läbivus), läbivuse lüliti, toite olek (vaikimisi viimati kasutatud), vastaspunkt (vaikimisi esimene jalg GND-rolliga võrgus; kui sellist pole, siis „vali jalg“). Enter salvestab ja fookus jääb väljale. `N` liigub sama komponendi järgmisele jalale.

- [ ] **Step 1: Kirjuta testid**

```dart
Verdict v(String net, double? value, {MeasurementMode mode = MeasurementMode.voltage, PowerState p = PowerState.on, String? refNet, bool? beep}) =>
    evaluateMeasurement(meas(net: net, value: value, mode: mode, power: p, refNet: refNet, continuity: beep), netsWithRoles());
// netsWithRoles: võrgud 'gnd'(GND), 'v5'(5V), 'v3'(3V3), 'v12'(12V), 'sig'(Signaal), 'none'(rollita)
test('voltage vs nominal with max(0.1 V, 10 %) tolerance', () {
  expect(v('v5', 4.55), Verdict.ok); expect(v('v5', 4.49), Verdict.low); expect(v('v5', 5.51), Verdict.high);
  expect(v('v3', 2.9), Verdict.low); expect(v('gnd', .05), Verdict.ok); expect(v('gnd', .2), Verdict.high);
});
test('no expectation without role, nominal or power', () {
  expect(v('none', 3.1), Verdict.noExpectation); expect(v('sig', 1.2), Verdict.noExpectation);
  expect(v('v5', 0, p: PowerState.off), Verdict.noExpectation);
});
test('short detection', () {
  expect(v('v5', .6, mode: MeasurementMode.resistance, refNet: 'gnd'), Verdict.shortSuspected);
  expect(v('v5', 1.0, mode: MeasurementMode.resistance, refNet: 'gnd'), Verdict.noExpectation);
  expect(v('v12', null, mode: MeasurementMode.continuity, refNet: 'v5', beep: true), Verdict.shortSuspected);
  expect(v('sig', null, mode: MeasurementMode.continuity, refNet: 'v5', beep: true), Verdict.noExpectation);
});
test('formatReading uses decimal comma', () {
  expect(formatReading(meas(net: 'v5', value: 4.98)), '4,98 V');
  expect(formatReading(meas(net: 'v5', mode: MeasurementMode.continuity, continuity: false)), 'ei piiksu');
});
```

- [ ] **Step 2: Käivita, peab kukkuma.** `& $flutter test test/core/evaluator_test.dart` → FAIL
- [ ] **Step 3: Kirjuta hindaja, paneelid, kiht ja sektsioon.**
- [ ] **Step 4: Käivita testid (PASS) ja käsitsi kontroll:** 5V võrgu jalg, sisend „4,2“ → jalal punane rõngas ja nimekirjas „madal“.
- [ ] **Step 5: Commit.** `git commit -am "feat(measurements): measurement log with expected-vs-measured verdicts"`

### Task 11: Mõõtjooned ja plaadi kontuur

**Files:**
- Create: `lib/modules/dimensions/dimensions_module.dart`, `dimension_tool.dart` (3 klõpsu: algus, lõpp, nihe; haakub jalgadega; Shift = horisontaalne/vertikaalne), `outline_tool.dart` (lohista ristkülik), `dimension_layer.dart`
- Modify: `lib/app/module_registry.dart` (lisa `DimensionsModule()`)
- Test: `test/modules/dimensions_test.dart`

**Interfaces:**
- Consumes: `Dimension { String id; Endpoint a, b; double offsetPx; }`, `BoardOutline { double x, y, w, h; }` (mudel 2. ülesandest), `ComponentTransform`.
- Produces: `double dimensionLengthMm(Dimension d, Board b, FootprintLibrary lib)`, `Vec2 originPx(Board b)` (kontuuri vasak ülanurk, muidu `Vec2.zero`), `Vec2 toBoardMm(Board b, Vec2 px)`

- [ ] **Step 1: Kirjuta testid**

```dart
test('dimension follows pin endpoints and reports mm', () {
  final b = boardWithHeader1x4At(const Vec2(200, 200), pxPerMm: 10)
      .copyWith(dimensions: [const Dimension(id: 'd1', a: Endpoint.pin(PinRef('j1', '1')), b: Endpoint.pin(PinRef('j1', '4')), offsetPx: 20)]);
  expect(dimensionLengthMm(b.dimensions.single, b, testLibrary), closeTo(7.62, 1e-9));
});
test('origin is outline top-left', () {
  final b = Board.empty().copyWith(pxPerMm: 10, outline: const BoardOutline(x: 50, y: 40, w: 760, h: 500));
  expect(toBoardMm(b, const Vec2(150, 140)), const Vec2(10, 10));
});
```

- [ ] **Step 2: Käivita, peab kukkuma.** `& $flutter test test/modules/dimensions_test.dart` → FAIL
- [ ] **Step 3: Kirjuta moodul.** Mõõtjoone joonistus porditakse prototüübi `dimMarkup`-ist (`prototype/src/js/03-render.js`).
- [ ] **Step 4: Käivita, peab läbima.** → PASS
- [ ] **Step 5: Commit.** `git commit -am "feat(dimensions): dimension lines and board outline"`

### Task 12: Projekti salvestus, automaatsalvestus ja prototüübi import

**Files:**
- Create: `lib/core/io/project_store.dart`, `lib/core/io/prototype_import.dart`, `test/fixtures/proto_small.pcbmap.json` (käsitsi: 2 komponenti (`soic` U1 `pn: {"4":"GND"}`, `c_smd` C1), 1 rada U1.4 → C1.2 `net: "GND"`, 1 rada vaba otsaga, 1 mõõtjoon, `ppm: 14`, `calibrated: true`, `img.src` = 1×1 PNG andme-URI)
- Modify: `lib/state/project_controller.dart` (autosave 2 s pärast viimast muudatust kausta `<path_provider applicationSupport>/autosave.pcbk`; käivitusel pakutakse taastamist), `lib/app/app_shell.dart` (ülariba nupud Uus / Ava / Salvesta / Salvesta nimega; Ava aktsepteerib `.pcbk` kausta ja `.pcbmap.json` faili)
- Test: `test/core/project_store_test.dart`, `test/core/prototype_import_test.dart`

**Interfaces:**
- Consumes: `encodeBoard`, `decodeBoard`.
- Produces:
  - `class LoadedProject { final Board board; final Directory dir; final File? photoFile; final bool photoMissing; }`
  - `Future<void> saveProject(Directory dir, Board b, {Uint8List? photoBytes})` — kirjutab `project.json.tmp`, seejärel nimetab ümber `project.json`-iks; foto läheb `photos/<b.photo.fileName>`
  - `Future<LoadedProject> loadProject(Directory dir)` — kui foto fail puudub, siis `photoMissing: true` (ei viska erindit)
  - `class PrototypeImport { final Board board; final Uint8List? photoBytes; final String? photoFileName; }`, `PrototypeImport importPrototype(Map<String, dynamic> json)` — vastavus: `doc.comps[] → Component` (`type → footprintKey`, `x,y → center`, `rot`, `side`, `params`, `pn → pinNames`, `extra[] → CustomPin(localMm: (x, y), sizeMm: d)`); `doc.traces[] → Connection` (`a/b` koos `c,p` → `Endpoint.pin`, muidu `Endpoint.free(x, y)`; `pts → waypoints`; `w → widthMm`; `layer`; `basis = visual`); `trace.net` (mitte tühi) → `NetLabel(anchorKey: esimene jala-ots, name: net)`; `doc.dims[] → Dimension`; `doc.outlines[0] → outline`; `doc.ppm`, `doc.calibrated`, `doc.name`; `img.src` (andme-URI) → `photoBytes`

- [ ] **Step 1: Kirjuta testid**

```dart
test('save/load round-trip', () async {
  final dir = await Directory.systemTemp.createTemp('pcbk');
  await saveProject(dir, sampleBoard(), photoBytes: Uint8List.fromList([1, 2, 3]));
  final l = await loadProject(dir);
  expect(l.board, sampleBoard()); expect(l.photoMissing, isFalse);
  expect(File(p.join(dir.path, 'project.json.tmp')).existsSync(), isFalse);
});
test('missing photo still opens', () async {
  final dir = await Directory.systemTemp.createTemp('pcbk');
  await saveProject(dir, sampleBoard()); // fotot ei kirjutata
  final l = await loadProject(dir);
  expect(l.photoMissing, isTrue); expect(l.board.components, isNotEmpty);
});
test('imports the web prototype format', () {
  final r = importPrototype(jsonDecode(File('test/fixtures/proto_small.pcbmap.json').readAsStringSync()));
  expect(r.board.components.map((c) => c.footprintKey), ['soic', 'c_smd']);
  expect(r.board.components.first.pinNames['4'], 'GND');
  expect(r.board.connections.first.a.pin, isNotNull);
  expect(r.board.connections.last.b.point, isNotNull);
  expect(r.board.netLabels.single.name, 'GND');
  expect(r.board.pxPerMm, 14); expect(r.board.calibrated, isTrue); expect(r.photoBytes, isNotEmpty);
});
```

- [ ] **Step 2: Käivita, peab kukkuma.** `& $flutter test test/core/project_store_test.dart test/core/prototype_import_test.dart` → FAIL
- [ ] **Step 3: Kirjuta salvestus, import, automaatsalvestus ja ülariba toimingud.**
- [ ] **Step 4: Käivita, peab läbima.** → PASS
- [ ] **Step 5: Commit.** `git commit -am "feat(io): project folder format, autosave and prototype import"`

### Task 13: Ekspordi moodul

**Files:**
- Create: `lib/modules/export/export_module.dart`, `export_dialog.dart`, `svg_exporter.dart`, `csv_exporter.dart`, `png_exporter.dart`
- Modify: `lib/app/module_registry.dart` (lisa `ExportModule()`)
- Test: `test/modules/export_test.dart`

**Interfaces:**
- Consumes: `FootprintLibrary`, `NetResolution`, `latestVerdicts`, `verdictLabels`, `toBoardMm`, `formatReading`.
- Produces:
  - `String exportSvg(Board b, FootprintLibrary lib, NetResolution nets, {String? photoDataUri})` — ala on kontuur + 5 mm igast küljest (kontuuri puudumisel foto mõõdud); `width`/`height` on `"<mm>mm"`, `viewBox` foto pikslites; komponentide joonepaksus 0,12 mm, padjandite oma 0,05 mm (portida prototüübi `buildSVG` palett, `prototype/src/js/06-io.js`)
  - `String netlistCsv(Board b, NetResolution nets)`, päis `Võrk;Roll;Tähis;Jalg;Jala nimi`
  - `String bomCsv(Board b, FootprintLibrary lib)`, päis `Tähis;Väärtus;Korpus;Pool;X (mm);Y (mm);Pööre (°);Jalgu;Märkused`
  - `String measurementsCsv(Board b, NetResolution nets)`, päis `Aeg;Jalg;Vastaspunkt;Režiim;Väärtus;Ühik;Toide;Hinnang;Märkus`
  - Kõik CSV-d: eraldaja `;`, kümnendkoma, algab UTF-8 BOM-iga, read eraldatud `\r\n`; režiimid `pinge|takistus|diood|läbivus`, toide `toitega|toiteta|teadmata`, hinnang `verdictLabels` järgi
  - `Future<Uint8List> exportPng(Board b, ..., {double scale = 2})`, mis kasutab samu kihijoonistajaid `PictureRecorder`iga

- [ ] **Step 1: Kirjuta testid**

```dart
test('svg is 1:1 in millimetres', () {
  final b = Board.empty().copyWith(pxPerMm: 10, outline: const BoardOutline(x: 50, y: 50, w: 760, h: 500));
  final s = exportSvg(b, testLibrary, NetResolution.empty);
  expect(s, contains('width="86mm"')); expect(s, contains('height="60mm"'));
});
test('measurements csv', () {
  final b = boardWithMeasurement(net: 'v5', value: 4.2); // U1.8 5V-võrgus, toitega
  final lines = measurementsCsv(b, resolveNets(b, testLibrary)).split('\r\n');
  expect(lines.first, '﻿Aeg;Jalg;Vastaspunkt;Režiim;Väärtus;Ühik;Toide;Hinnang;Märkus');
  expect(lines[1], contains(';U1.8;GND;pinge;4,2;V;toitega;madal;'));
});
test('netlist includes role', () {
  final b = boardWithTraces([['u1:4', 'c1:2']]).copyWith(netLabels: [const NetLabel(anchorKey: 'u1:4', name: 'GND', roleId: 'gnd')]);
  expect(netlistCsv(b, resolveNets(b, testLibrary)), contains('GND;GND;U1;4;'));
});
```

- [ ] **Step 2: Käivita, peab kukkuma.** `& $flutter test test/modules/export_test.dart` → FAIL
- [ ] **Step 3: Kirjuta eksportijad ja dialoog.** Failid salvestatakse `file_picker`i `saveFile` kaudu.
- [ ] **Step 4: Käivita, peab läbima.** → PASS
- [ ] **Step 5: Commit.** `git commit -am "feat(export): SVG 1:1, PNG and CSV reports"`

### Task 14: Windowsi ehitus, README ja lõppkontroll

**Files:**
- Create: `README.md` (eesti keeles: käivitamine, töövoog, **kuidas lisada uus moodul**: näide `lib/modules/notes/notes_module.dart`, mis lisab ühe paneeli, ja selle registreerimine failis `module_registry.dart`)
- Test: kogu komplekt

- [ ] **Step 1: Staatiline analüüs.** `& $flutter analyze` → `No issues found!`
- [ ] **Step 2: Kõik testid.** `& $flutter test` → `All tests passed!`
- [ ] **Step 3: Ehitus.** `& $flutter build windows --release` → `build\windows\x64\runner\Release\pcb_kaardistaja.exe` on olemas
- [ ] **Step 4: Käsitsi kontrollnimekiri** (iga punkt peab töötama): ava foto → kalibreeri 2 punktiga → paiguta SOIC-8 → venita käepidemega → joonda kahe jalaga → lisa oma jalg ja nimi → joonista rada GND-sse ja 5V-sse → anna rollid → ühenda GND 5V-ga ja näe konflikti hoiatust → võta tagasi → salvesta pinge 4,98 (OK, roheline) ja 4,2 (madal, punane) → mõõtjoon jalgade vahel → ekspordi SVG ja 3 CSV-d → salvesta, sulge ja ava uuesti → impordi veebiprototüübi `.pcbmap.json`.
- [ ] **Step 5: Commit.** `git commit -am "docs: README and module authoring guide; release build verified"`
