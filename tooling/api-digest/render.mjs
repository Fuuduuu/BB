import { dirname, isAbsolute, relative } from 'node:path';
import ts from 'typescript';

const { factory } = ts;
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true });
const banner = '<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->';

/** @typedef {{ name: string, path: string }} Entrypoint */
/** @typedef {ts.DeclarationStatement | ts.VariableDeclaration} NamedDeclaration */
/** @typedef {Map<string, ts.SourceFile>} DeclarationFiles */

/** @param {ts.SourceFile} file @param {string} name @returns {NamedDeclaration[]} */
function namedDeclarations(file, name) {
  /** @type {NamedDeclaration[]} */
  const declarations = [];
  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement)) {
      declarations.push(
        ...statement.declarationList.declarations.filter(
          (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name,
        ),
      );
    } else if (
      ts.isDeclarationStatement(statement) &&
      (statement.name?.text === name ||
        (name === 'default' && hasModifier(statement, ts.SyntaxKind.DefaultKeyword)))
    ) {
      declarations.push(statement);
    }
  }
  return declarations;
}

/** @param {ts.Node} node @param {ts.SyntaxKind} kind */
function hasModifier(node, kind) {
  return (
    ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === kind)
  );
}

/** @param {ts.ClassElement} member */
function isPublic(member) {
  return (
    !(member.name && ts.isPrivateIdentifier(member.name)) &&
    !hasModifier(member, ts.SyntaxKind.PrivateKeyword) &&
    !hasModifier(member, ts.SyntaxKind.ProtectedKeyword)
  );
}

/**
 * @param {NamedDeclaration} declaration
 * @param {string} exportedName
 * @param {ts.Symbol} target
 * @param {ts.SourceFile} entry
 * @param {ts.TypeChecker} checker
 */
function asExport(declaration, exportedName, target, entry, checker) {
  const isDefault = exportedName === 'default';
  const name = factory.createIdentifier(exportedName);
  /** @type {ts.Modifier[]} */
  const modifiers = [factory.createModifier(ts.SyntaxKind.ExportKeyword)];
  if (isDefault) modifiers.push(factory.createModifier(ts.SyntaxKind.DefaultKeyword));
  const otherModifiers =
    (ts.canHaveModifiers(declaration) ? ts.getModifiers(declaration) : undefined) ?? [];
  modifiers.push(
    ...otherModifiers.filter(
      ({ kind }) =>
        ![
          ts.SyntaxKind.ExportKeyword,
          ts.SyntaxKind.DeclareKeyword,
          ts.SyntaxKind.DefaultKeyword,
        ].includes(kind),
    ),
  );

  if (ts.isFunctionDeclaration(declaration)) {
    return factory.updateFunctionDeclaration(
      declaration,
      modifiers,
      undefined,
      isDefault ? declaration.name : name,
      declaration.typeParameters,
      declaration.parameters,
      declaration.type,
      undefined,
    );
  }
  if (ts.isInterfaceDeclaration(declaration)) {
    return factory.updateInterfaceDeclaration(
      declaration,
      modifiers,
      name,
      declaration.typeParameters,
      declaration.heritageClauses,
      declaration.members,
    );
  }
  if (ts.isTypeAliasDeclaration(declaration)) {
    return factory.updateTypeAliasDeclaration(
      declaration,
      modifiers,
      name,
      declaration.typeParameters,
      declaration.type,
    );
  }
  if (ts.isClassDeclaration(declaration)) {
    return factory.updateClassDeclaration(
      declaration,
      modifiers,
      isDefault ? declaration.name : name,
      declaration.typeParameters,
      declaration.heritageClauses,
      declaration.members.filter(isPublic),
    );
  }
  if (ts.isEnumDeclaration(declaration)) {
    return factory.updateEnumDeclaration(declaration, modifiers, name, declaration.members);
  }
  if (ts.isModuleDeclaration(declaration)) {
    return factory.updateModuleDeclaration(declaration, modifiers, name, declaration.body);
  }
  if (ts.isVariableDeclaration(declaration)) {
    if (isDefault) return undefined;
    const flags = declaration.parent.flags & ts.NodeFlags.BlockScoped;
    // Declaration emit can represent a literal const as `const x = 1`.
    const type =
      declaration.type ??
      checker.typeToTypeNode(
        checker.getTypeOfSymbolAtLocation(target, entry),
        entry,
        ts.NodeBuilderFlags.NoTruncation,
      );
    const variable = factory.updateVariableDeclaration(
      declaration,
      name,
      undefined,
      type,
      undefined,
    );
    return factory.createVariableStatement(
      modifiers,
      factory.createVariableDeclarationList([variable], flags),
    );
  }
  return undefined;
}

/**
 * @param {ts.Symbol} symbol
 * @param {string} name
 * @param {ts.SourceFile} entry
 * @param {ts.TypeChecker} checker
 * @param {DeclarationFiles} files
 */
function symbolDeclarations(symbol, name, entry, checker, files) {
  const target = resolveAlias(symbol, checker);
  const sources = new Set(target.declarations?.map((declaration) => declaration.getSourceFile()));
  const declarations = [];
  for (const source of sources) {
    const file = files.get(source.fileName) ?? (source.isDeclarationFile ? source : undefined);
    if (!file) continue;
    for (const node of namedDeclarations(file, target.getName())) {
      const declaration = asExport(node, name, target, entry, checker);
      if (declaration)
        declarations.push(printer.printNode(ts.EmitHint.Unspecified, declaration, file));
    }
  }
  if (declarations.length) return declarations;

  // A default expression or a namespace re-export may have no named declaration.
  const type = checker.getTypeOfSymbolAtLocation(target, entry);
  const typeText = checker
    .typeToString(type, entry, ts.TypeFormatFlags.NoTruncation)
    .replace(/(?<=\bimport\()"(?:[^"\\]|\\.)*"(?=\))/gu, (literal) => {
      const path = JSON.parse(literal);
      if (!isAbsolute(path)) return literal;
      const local = relative(dirname(entry.fileName), path).replaceAll('\\', '/');
      return JSON.stringify(local.startsWith('../') ? local : `./${local}`);
    });
  return name === 'default'
    ? [`declare const defaultExport: ${typeText};`, 'export default defaultExport;']
    : [`export declare const ${name}: ${typeText};`];
}

/** @param {ts.Symbol} symbol @param {ts.TypeChecker} checker */
function resolveAlias(symbol, checker) {
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

/** @param {ts.Symbol} symbol */
function isZodSymbol(symbol) {
  return symbol.declarations?.some((declaration) =>
    /(?:^|\/)node_modules\/zod\//u.test(declaration.getSourceFile().fileName.replaceAll('\\', '/')),
  );
}

/** @param {ts.Symbol} target @param {ts.TypeChecker} checker */
function inferredSchema(target, checker) {
  const node = target.declarations?.find(ts.isTypeAliasDeclaration)?.type;
  if (!node || !ts.isTypeReferenceNode(node)) return undefined;
  const argument = node.typeArguments?.[0];
  if (!argument || !ts.isTypeQueryNode(argument)) return undefined;
  const inference = checker.getSymbolAtLocation(node.typeName);
  if (!inference) return undefined;
  const origin = resolveAlias(inference, checker);
  if (!['output', 'TypeOf', 'infer'].includes(origin.getName()) || !isZodSymbol(origin)) {
    return undefined;
  }
  const schema = checker.getSymbolAtLocation(argument.exprName);
  return schema && resolveAlias(schema, checker);
}

const expandedTypeFlags = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias;

/** @param {string} text @param {Map<string, string | null>} names */
function formatInferredType(text, names) {
  const file = ts.createSourceFile(
    'inferred.ts',
    `type Output = ${text};`,
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = file.statements[0];
  if (!declaration || !ts.isTypeAliasDeclaration(declaration)) return text;
  const shape = declaration.type;
  // Expand the exported shape. For nested shapes, reuse an unambiguous public
  // name when the checker printed exactly the same type in this entrypoint.
  const result = ts.transform(shape, [
    (context) => (root) => {
      /** @type {ts.Visitor} */
      const visit = (node) => {
        if (ts.isTypeLiteralNode(node) || ts.isUnionTypeNode(node)) {
          const name = names.get(node.getText(file));
          if (name) return factory.createTypeReferenceNode(name);
        }
        const child = ts.visitEachChild(node, visit, context);
        if (ts.isTypeLiteralNode(child)) ts.setEmitFlags(child, ts.EmitFlags.SingleLine);
        return child;
      };
      return ts.visitEachChild(root, visit, context);
    },
  ]);
  const rendered = printer.printNode(ts.EmitHint.Unspecified, result.transformed[0] ?? shape, file);
  result.dispose();
  return rendered;
}

/** @param {ts.Symbol[]} symbols @param {ts.SourceFile} entry @param {ts.TypeChecker} checker */
function zodDeclarations(symbols, entry, checker) {
  /** @type {Map<ts.Symbol, string>} */
  const inferred = new Map();
  /** @type {Map<ts.Symbol, string>} */
  const schemaNames = new Map();
  /** @type {Map<string, string | null>} */
  const shapeNames = new Map();
  const targets = symbols.map((symbol) => ({ symbol, target: resolveAlias(symbol, checker) }));
  for (const { symbol, target } of targets) {
    const schema = inferredSchema(target, checker);
    if (!schema) continue;
    const name = symbol.getName();
    const output = checker.getDeclaredTypeOfSymbol(target);
    const text = checker.typeToString(output, entry, expandedTypeFlags);
    inferred.set(symbol, text);
    if (!schemaNames.has(schema)) schemaNames.set(schema, name);
    shapeNames.set(text, shapeNames.has(text) ? null : name);
  }

  /** @type {Map<ts.Symbol, string>} */
  const declarations = new Map();
  for (const { symbol, target } of targets) {
    const name = symbol.getName();
    const text = inferred.get(symbol);
    if (text !== undefined) {
      declarations.set(symbol, `export type ${name} = ${formatInferredType(text, shapeNames)};`);
    } else if (target.flags & ts.SymbolFlags.Variable) {
      const schema = checker.getTypeOfSymbolAtLocation(target, entry);
      const output = checker.getPropertyOfType(schema, '_output');
      if (!output || !isZodSymbol(output)) continue;
      const type = checker.getTypeOfSymbolAtLocation(output, entry);
      const outputSymbol = type.aliasSymbol ?? type.getSymbol();
      const outputName = targets.find(({ target }) => target === outputSymbol)?.symbol.getName();
      const typeName =
        schemaNames.get(target) ??
        outputName ??
        checker.typeToString(type, entry, expandedTypeFlags);
      declarations.set(symbol, `export const ${name}: ZodType<${typeName}>;`);
    }
  }
  return declarations;
}

/** @param {ts.Symbol} symbol @param {ts.TypeChecker} checker */
function documentation(symbol, checker) {
  const target = resolveAlias(symbol, checker);
  const comment =
    ts.displayPartsToString(symbol.getDocumentationComment(checker)) ||
    ts.displayPartsToString(target.getDocumentationComment(checker));
  return comment
    .trim()
    .replace(/\s+/gu, ' ')
    .split(/(?<=[.!?])\s/u, 1)[0];
}

/**
 * @param {string} root
 * @param {Entrypoint} entry
 * @param {ts.Program} program
 * @param {ts.TypeChecker} checker
 * @param {DeclarationFiles} files
 */
export function renderDigest(root, entry, program, checker, files) {
  const source = program.getSourceFile(entry.path);
  if (!source) throw new Error(`Sisenemispunkti ei saa lugeda: ${entry.path}`);
  const module = checker.getSymbolAtLocation(source);
  const symbols = module ? checker.getExportsOfModule(module) : [];
  const lines = [
    banner,
    '',
    `# @pcbk/${entry.name}`,
    '',
    `Sisenemispunkt: \`${relative(root, entry.path).replaceAll('\\', '/')}\``,
  ];
  symbols.sort((left, right) => left.getName().localeCompare(right.getName(), 'en'));
  const compact = zodDeclarations(symbols, source, checker);
  for (const symbol of symbols) {
    const name = symbol.getName();
    const comment = documentation(symbol, checker);
    const declaration = compact.get(symbol);
    lines.push('', `### \`${name}\``);
    if (comment) lines.push('', comment, '');
    lines.push(
      '```ts',
      ...(declaration ? [declaration] : symbolDeclarations(symbol, name, source, checker, files)),
      '```',
    );
  }
  return `${lines.join('\n')}\n`;
}
