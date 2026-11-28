import ts from 'typescript';
import type { Plugin } from 'vite';

const engineDirectory = '/packages/engine/src/';
const probeDirectory = '/apps/desktop/src/perf/';
const phaseModule = 'virtual:pcbk-probe-phase';

function timed(phase: ts.Expression, run: ts.ConciseBody) {
  const { factory: f } = ts;
  return f.createCallExpression(f.createIdentifier('measureProbePhase'), undefined, [
    phase,
    f.createArrowFunction(undefined, undefined, [], undefined, undefined, run),
  ]);
}

function isCall(node: ts.Node, name: string, argument: string) {
  if (!ts.isCallExpression(node) || node.arguments.length !== 1) return false;
  const [param] = node.arguments;
  return (
    ts.isIdentifier(node.expression) &&
    node.expression.text === name &&
    param !== undefined &&
    ts.isIdentifier(param) &&
    param.text === argument
  );
}

function isSpecCall(node: ts.Node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  const [arg] = node.arguments;
  const { expression, name } = node.expression;
  return (
    name.text === 'parse' &&
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === 'schema' &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'spec' &&
    arg !== undefined &&
    ts.isCallExpression(arg) &&
    ts.isPropertyAccessExpression(arg.expression) &&
    arg.expression.name.text === 'run' &&
    ts.isIdentifier(arg.expression.expression) &&
    arg.expression.expression.text === 'spec'
  );
}

// Observe the actual engine calls in probe builds without text markers or runtime engine hooks.
export function probeTimingPlugin(): Plugin {
  return {
    name: 'pcbk-probe-timing',
    apply: 'serve',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id !== phaseModule || !importer) return;
      const [root] = importer.replaceAll('\\', '/').split(engineDirectory);
      return root + probeDirectory + 'probe-phase.ts';
    },
    transform(code, id) {
      const path = id.replaceAll('\\', '/');
      const engine = path.endsWith(engineDirectory + 'engine.ts');
      const derivation = path.endsWith(engineDirectory + 'derivation.ts');
      if (!engine && !derivation) return;

      const { factory: f } = ts;
      let validations = 0;
      let slots = 0;
      let derivations = 0;
      const raw = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const transformed = ts.transform(raw, [
        (context) => {
          const visit: ts.Visitor = (node) => {
            if (engine && ts.isCallExpression(node) && isCall(node, 'validateDocument', 'next')) {
              validations++;
              return timed(f.createStringLiteral('validateDocument'), node);
            }
            if (derivation && ts.isCallExpression(node) && isSpecCall(node)) {
              slots++;
              return timed(
                f.createPropertyAccessExpression(f.createIdentifier('spec'), 'key'),
                node,
              );
            }
            if (
              derivation &&
              ts.isFunctionDeclaration(node) &&
              node.name?.text === 'makeSnapshot' &&
              node.body
            ) {
              const updated = ts.visitEachChild(node, visit, context);
              const [first, initial, loop, result, ...extra] = updated.body!.statements;
              if (
                !first ||
                !initial ||
                !loop ||
                !result ||
                extra.length ||
                !ts.isVariableStatement(initial) ||
                !initial.declarationList.declarations.some(
                  ({ name }) => ts.isIdentifier(name) && name.text === 'derived',
                ) ||
                !ts.isForOfStatement(loop) ||
                !ts.isReturnStatement(result)
              )
                throw new Error('Unexpected probe snapshot builder');
              derivations++;
              const calculate = timed(
                f.createStringLiteral('derived'),
                f.createBlock(
                  [initial, loop, f.createReturnStatement(f.createIdentifier('derived'))],
                  true,
                ),
              );
              const derived = f.createVariableStatement(
                undefined,
                f.createVariableDeclarationList(
                  [f.createVariableDeclaration('derived', undefined, undefined, calculate)],
                  ts.NodeFlags.Const,
                ),
              );
              return f.updateFunctionDeclaration(
                updated,
                updated.modifiers,
                updated.asteriskToken,
                updated.name,
                updated.typeParameters,
                updated.parameters,
                updated.type,
                f.updateBlock(updated.body!, [first, derived, result]),
              );
            }
            return ts.visitEachChild(node, visit, context);
          };
          return (source) =>
            f.updateSourceFile(source, [
              f.createImportDeclaration(
                undefined,
                f.createImportClause(
                  false,
                  undefined,
                  f.createNamedImports([
                    f.createImportSpecifier(
                      false,
                      undefined,
                      f.createIdentifier('measureProbePhase'),
                    ),
                  ]),
                ),
                f.createStringLiteral(phaseModule),
              ),
              ...ts.visitNodes(source.statements, visit, ts.isStatement),
            ]);
        },
      ]);
      try {
        if ((engine && validations !== 2) || (derivation && (slots !== 1 || derivations !== 1)))
          throw new Error(`Unexpected timing call sites in ${path}`);
        return ts.createPrinter().printFile(transformed.transformed[0]!);
      } finally {
        transformed.dispose();
      }
    },
  };
}
