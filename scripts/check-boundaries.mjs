import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

const root = resolve('src');
const allowed = {
  domain: new Set(['domain']),
  application: new Set(['application', 'domain']),
  infrastructure: new Set(['infrastructure', 'application', 'domain']),
  presentation: new Set(['presentation', 'application', 'domain']),
  app: new Set(['app', 'presentation', 'infrastructure', 'application', 'domain']),
};
const errors = [];
const layer = file => relative(root, file).split(sep)[0];

function checkImport(file, specifier) {
  const from = layer(file);
  if (!specifier.startsWith('.')) {
    if (from === 'domain' || from === 'application') {
      errors.push(`${relative(root, file)}: ${from} cannot import external module ${specifier}`);
    }
    return;
  }
  const to = layer(resolve(dirname(file), specifier));
  if (!allowed[from]?.has(to)) errors.push(`${relative(root, file)}: ${from} cannot import ${specifier}`);
}

function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) { inspect(file); continue; }
    if (!/\.[jt]sx?$/.test(file)) continue;
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        checkImport(file, node.moduleSpecifier.text);
      }
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
        checkImport(file, node.argument.literal.text);
      }
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteral(argument)) checkImport(file, argument.text);
        else errors.push(`${relative(root, file)}: computed module imports are not allowed`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
inspect(root);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('Architecture dependency boundaries passed.');
