const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('acorn');

const root = path.resolve(__dirname, '..');
const files = fs
  .readdirSync(root)
  .filter((file) => file.endsWith('.cjs'))
  .concat(
    ['js', 'scripts', 'tests'].flatMap((directory) =>
      fs
        .readdirSync(path.join(root, directory), { recursive: true })
        .filter((file) => /\.(?:js|mjs|cjs)$/.test(file))
        .map((file) => path.join(directory, file)),
    ),
  );
const modules = new Map();
for (const file of files) {
  const isModule = file.endsWith('.mjs') || file === path.join('js', 'app.js');
  let ast;
  try {
    ast = parse(fs.readFileSync(path.join(root, file), 'utf8'), {
      ecmaVersion: 'latest',
      sourceType: isModule ? 'module' : 'script',
    });
  } catch (error) {
    throw new Error(`${file}: ${error.message}`);
  }
  if (isModule) modules.set(file, ast);
}
const dependencies = new Map();
const exported = (ast) =>
  new Set(
    ast.body.flatMap((node) => {
      if (node.type !== 'ExportNamedDeclaration') return [];
      if (node.declaration?.type === 'VariableDeclaration')
        return node.declaration.declarations.map((item) => item.id.name);
      if (node.declaration) return [node.declaration.id.name];
      return node.specifiers.map((item) => item.exported.name);
    }),
  );
for (const [file, ast] of modules) {
  const imports = ast.body.filter(
    (node) =>
      node.type === 'ImportDeclaration' ||
      ((node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') &&
        node.source),
  );
  dependencies.set(
    file,
    imports.map((node) => {
      const target = path.normalize(path.join(path.dirname(file), node.source.value));
      if (!modules.has(target)) throw new Error(`${file}: missing module ${node.source.value}`);
      const names = exported(modules.get(target));
      for (const specifier of node.specifiers || []) {
        const name =
          specifier.type === 'ImportSpecifier'
            ? specifier.imported.name
            : specifier.type === 'ExportSpecifier'
              ? specifier.local.name
              : null;
        if (name && !names.has(name)) throw new Error(`${file}: ${target} does not export ${name}`);
      }
      return target;
    }),
  );
}
const checked = new Set();
function visit(file, stack = []) {
  if (stack.includes(file))
    throw new Error('Circular UI dependency: ' + [...stack, file].join(' -> '));
  if (checked.has(file)) return;
  for (const dependency of dependencies.get(file)) visit(dependency, [...stack, file]);
  checked.add(file);
}
for (const file of modules.keys()) visit(file);
console.log(
  `Checked ${files.length} JavaScript files; ${modules.size} modules have valid imports and no circular dependencies.`,
);
