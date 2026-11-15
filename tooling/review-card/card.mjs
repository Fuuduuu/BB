import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/** @typedef {'unit' | 'e2e' | 'rust' | 'any'} Kind */
/** @typedef {Record<string, Kind[]>} TestKinds */

/** Extract only the requested Markdown section, not the later handoff or review. @param {string} text @param {string} heading */
function section(text, heading) {
  const match = new RegExp('^## ' + heading + '[ \\t]*\\r?$', 'im').exec(text);
  return match
    ? (text
        .slice(match.index + match[0].length)
        .split(/^## /m)[0]
        ?.trim() ?? '')
    : '';
}

/** @param {string} label @returns {Kind} */
function testKind(label) {
  if (/rust|cargo/i.test(label)) return 'rust';
  if (/e2e/i.test(label)) return 'e2e';
  if (/^(TS|UI|engine)\b/i.test(label)) return 'unit';
  return 'any';
}

// Drop parenthesized descriptions but keep parentheses inside quoted test titles.
/** @param {string} text */
function withoutNotes(text) {
  let depth = 0;
  let inCode = false;
  let result = '';
  for (const ch of text) {
    if (ch === '`') inCode = !inCode;
    if (!inCode && ch === '(') depth++;
    else if (!inCode && ch === ')' && depth) depth--;
    else if (!depth) result += ch;
  }
  return result;
}

/** @param {string} markdown */
export function parseCard(markdown) {
  const header = markdown.split(/^## /m)[0] ?? '';
  const lane = header.match(/\bRada:\s*\**\s*([AB])\b/i)?.[1]?.toUpperCase() ?? null;
  const requirements =
    markdown.split(/^## (?:Üleandmine|Arhitekti ülevaatus|Varasema kontrolli leiud)\b/im)[0] ?? '';
  const testEvidence = section(requirements, 'Tõend');
  // A first-step prerequisite can have its own “Tõend:” before the main checklist.
  const extraEvidence = [
    ...requirements.matchAll(/^[ \t]*(?:[-*]\s+)?(?:\*\*)?Tõend:(?:\*\*)?[ \t]*(.+)$/gim),
  ].map((row) => row[1]);
  const evidence = [testEvidence, ...extraEvidence].filter(Boolean).join('\n');
  /** @type {string[]} */
  const warnings = [];
  /** @type {TestKinds} */
  const kinds = Object.create(null);
  /** @param {string} name @param {Kind} kind */
  function add(name, kind) {
    const all = (kinds[name] ??= []);
    if (!all.includes(kind)) all.push(kind);
  }

  /** Read a leading list of test names, stopping where explanatory prose starts.
   * @param {string} text @param {Kind} kind */
  function readList(text, kind) {
    let remaining = withoutNotes(text).trim();
    while (remaining) {
      const entry = /^(?:(uus|olemasolev|rust|laiendatud e2e)\s+)?`([^`]+)`\s*/i.exec(remaining);
      if (!entry) break;
      const name = entry[2];
      if (!name) break;
      if (!/^(?:pnpm(?:\.cmd)?|cargo|git|node|npm|rustup)\s/i.test(name)) {
        const explicit = testKind(entry[1] ?? '');
        add(name, explicit === 'any' ? kind : explicit);
      }
      const rest = remaining.slice(entry[0].length);
      const separator = /^(?:[,;]\s*|ja\s+)/i.exec(rest);
      if (!separator) break;
      remaining = rest.slice(separator[0].length);
    }
  }

  /** @type {Kind|null} */
  let group = null;
  let fenced = false;
  for (const line of testEvidence.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const bullet = /^(\s*)(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
    if (!bullet) continue;
    const text = (bullet[2] ?? '').replaceAll('**', '').trim();
    if (!bullet[1]) group = null;
    const labeled = /^(TS|Rust|E2e|UI|engine|Testid|Lisaks)(?:\s*\([^)]*\))?\s*:\s*(.*)$/i.exec(
      text,
    );
    const explicitE2e = /^E2e\s+`([^`]+)`/i.exec(text);
    if (labeled) {
      group = testKind(text.slice(0, text.indexOf(':')));
      const value = labeled[2] ?? '';
      if (/ülaltoodud testi/i.test(value)) {
        // Older milestone cards refer to an explicitly titled E2E list earlier in the card.
        const decisions = section(requirements, 'Otsused ja liidesed');
        const subsection = decisions.match(
          /^### E2e\b[^\n]*\n([\s\S]*?)(?=^### |(?![\s\S]))/im,
        )?.[1];
        const instructions = subsection ?? decisions;
        const expected = Number(value.match(/(\d+)\s+ülaltoodud/i)?.[1]);
        const names = [
          ...instructions.matchAll(/^-\s*(?:\*\*)?`([a-z0-9]+(?:_[a-z0-9]+)+)`(?:\*\*)?\s*:/gm),
        ];
        for (const [, name] of names) if (name) add(name, 'e2e');
        const other = instructions.match(/^-\s*\*\*Ülejäänud e2e:\*\*\s*(.+)$/im)?.[1];
        if (other) readList(other, 'e2e');
        const found = Object.values(kinds).filter((items) => items.includes('e2e')).length;
        if (found !== expected) warnings.push('Kontrolli viidatud E2E-nimekirja käsitsi: ' + value);
      } else {
        readList(value, group);
        if (value && !/^(?:`|olemasolev\s|uus\s)/i.test(value)) {
          warnings.push('Kontrolli kaardil nimetamata või kirjeldatud juhtumeid: ' + text);
        }
      }
    } else if (explicitE2e?.[1]) {
      add(explicitE2e[1], 'e2e');
    } else if (group && bullet[1]) {
      if (/^(?:uus\s+)?`/i.test(text)) readList(text, group);
      else warnings.push('Kontrolli tingimuslikku või kirjeldatud testi käsitsi: ' + text);
    } else if (/^(?:Kirjuta testid|Test)\s+`/i.test(text)) {
      readList(text.replace(/^(?:Kirjuta testid|Test)\s+/i, ''), 'any');
    } else if (/^Kirjuta regressioonid\b/i.test(text)) {
      group = 'any';
    } else if (/^`[a-z0-9]+(?:_[a-z0-9]+)+`/.test(text) && /^\s*\d+\./.test(line)) {
      // Early cards list unlabelled numbered tests.
      readList(text, 'any');
    } else if (/^Olemasolevad e2e\b/i.test(text) && /\bsh .+`/.test(text)) {
      const name = text.match(/\bsh [^`]*`([^`]+)`/)?.[1];
      if (name) add(name, 'e2e');
    }
    // M0-15 explicitly names additional regressions in subsequent sentences.
    if (/^\s*\d+\./.test(line)) {
      for (const m of text.matchAll(
        /(?:\.\s+|^Test\s+)`([a-z0-9]+(?:_[a-z0-9]+)+)`\s+(?:kontrollib|kasutab)/g,
      )) {
        if (m[1]) add(m[1], 'any');
      }
    }
  }
  const amendment = section(requirements, 'Arhitekti täpsustus(?: [^\\r\\n]+)?');
  for (const row of amendment.matchAll(/^\s*-\s*(?:\*\*)?Lisatest:(?:\*\*)?\s*(.+)$/gim)) {
    readList(row[1] ?? '', 'any');
  }
  if (!lane) warnings.push('Kaardi päises puudub rada A/B. Kontrolli nõutud käske käsitsi.');
  if (!testEvidence) warnings.push('Kaardil puudub jaotis „Tõend“.');
  else if (!Object.keys(kinds).length)
    warnings.push('Jaotises „Tõend“ polnud otsesõnu nimetatud teste.');
  const waivedCargo = /`cargo test[^`]*`\s+(?:pole vaja|ei ole vaja|ei nõuta)/i.test(evidence);
  const waivedTauri =
    /`pnpm(?:\.cmd)?\s+tauri build[^`]*`\s+(?:pole vaja|ei ole vaja|ei nõuta)/i.test(evidence);
  return {
    lane,
    names: Object.keys(kinds),
    kinds,
    warnings,
    evidence,
    cargoTest: !waivedCargo && (lane === 'B' || /`cargo test\b/i.test(evidence)),
    tauriBuild: !waivedTauri && /`pnpm(?:\.cmd)?\s+tauri build\b/i.test(evidence),
  };
}

/** @param {string} source @param {string} file @returns {Set<string>} */
function tsTests(source, file) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false);
  const names = new Set();
  /** @param {ts.Node} node */
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const [title] = node.arguments;
      const call = node.expression;
      const curried = ts.isCallExpression(call);
      const signature = curried ? call.expression.getText(tree) : call.getText(tree);
      if (
        /^(?:it|test|describe|suite)(?:\.|$)/.test(signature) &&
        (/\.(?:skip|todo|fixme)(?:\.|$)/.test(signature) ||
          (curried &&
            /\.skipIf$/.test(signature) &&
            call.arguments[0]?.kind === ts.SyntaxKind.TrueKeyword) ||
          (curried &&
            /\.runIf$/.test(signature) &&
            call.arguments[0]?.kind === ts.SyntaxKind.FalseKeyword))
      )
        return; // Also prune a disabled suite before visiting its test declarations.
      if (/^(?:xdescribe|xsuite|xit|xtest)$/.test(signature)) return;
      if (
        title &&
        ts.isStringLiteralLike(title) &&
        /^(?:it|test)(?:\.(?:only|fails|concurrent|sequential))*(?:\.(?:each|for|skipIf|runIf))?$/.test(
          signature,
        ) &&
        curried === /\.(?:each|for|skipIf|runIf)$/.test(signature)
      ) {
        names.add(title.text);
        // Modern cards name the case once, while Vitest appends its parameter values.
        if (/\.(?:each|for)$/.test(signature)) {
          const base = /^(\S+)\s+(?:[\s()[\],-]*(?:%[sdifjoO#$]|\$[\w.]+))+[\s()[\],-]*$/.exec(
            title.text,
          )?.[1];
          if (base) names.add(base);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return names;
}

// Ignore literal and commented Rust examples before recognizing #[test] functions.
/** @param {string} source @returns {Set<string>} */
function rustTests(source) {
  const token =
    /(?:b?r)(#*)"[\s\S]*?"\1|"(?:\\[\s\S]|[^"\\])*"|'(?:\\.|[^'\\\r\n])'|\/\/[^\n]*|\/\*/g;
  const boundary = /\/\*|\*\//g;
  let withoutLiterals = '';
  let start = 0;
  for (let match; (match = token.exec(source));) {
    withoutLiterals += source.slice(start, match.index) + ' ';
    if (match[0] === '/*') {
      // Rust block comments nest; quoted text and line comments inside them have no meaning.
      boundary.lastIndex = token.lastIndex;
      let depth = 1;
      for (let delimiter; depth && (delimiter = boundary.exec(source));) {
        depth += delimiter[0] === '/*' ? 1 : -1;
      }
      token.lastIndex = depth ? source.length : boundary.lastIndex;
    }
    start = token.lastIndex;
  }
  withoutLiterals += source.slice(start);
  const matches = withoutLiterals.matchAll(
    /((?:#\s*\[[^\]]*\]\s*)+)(?:(?:pub|async|unsafe)\s+)*fn\s+(\w+)\b/g,
  );
  const names = new Set();
  for (const [, attrs = '', name] of matches) {
    if (
      name &&
      /#\s*\[\s*(?:\w+::)*test(?:\([^)]*\))?\s*\]/.test(attrs) &&
      !/#\s*\[\s*ignore\b/.test(attrs)
    )
      names.add(name);
  }
  return names;
}

const ignored = new Set([
  'node_modules',
  'dist',
  'target',
  'coverage',
  'test-results',
  'playwright-report',
  'fixtures',
  '__fixtures__',
  'bindings',
]);

/** @param {string} root @param {string[]} names @param {TestKinds} [kinds] */
export function findMissingTests(root, names, kinds = {}) {
  const available = { rust: new Set(), unit: new Set(), e2e: new Set() };
  /** @param {string} directory @param {'rust'|'unit'|'e2e'} kind @param {RegExp} pattern */
  function scan(directory, kind, pattern) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name) && !entry.name.startsWith('.')) scan(file, kind, pattern);
        continue;
      }
      if (!entry.isFile() || !pattern.test(entry.name)) continue;
      const source = readFileSync(file, 'utf8');
      if (!names.some((name) => source.includes(name)) && !source.includes('\\')) continue;
      for (const title of kind === 'rust' ? rustTests(source) : tsTests(source, file))
        available[kind].add(title);
    }
  }
  if (!names.length) return [];
  // Mirror Vitest/Playwright discovery and include the .test-d.ts contracts read by tsc.
  for (const area of ['packages', 'apps/web/src', 'apps/desktop/src']) {
    scan(join(root, area), 'unit', /\.test(?:-d)?\.tsx?$/);
  }
  scan(join(root, 'tooling'), 'unit', /\.test(?:-d)?\.ts$/);
  scan(join(root, 'apps/web/e2e'), 'e2e', /\.spec\.ts$/);
  scan(join(root, 'apps/desktop/src-tauri'), 'rust', /\.rs$/);
  return names.filter(
    (name) =>
      !(kinds[name] ?? ['any']).every((kind) =>
        kind === 'any'
          ? Object.values(available).some((suite) => suite.has(name))
          : available[kind].has(name),
      ),
  );
}
