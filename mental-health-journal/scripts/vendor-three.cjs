// Copies the pinned three.js build from node_modules into vendor/three so the site stays a
// plain static site (no bundler). Run `npm run vendor:three` after changing the three version;
// `npm run vendor:check` (used in CI) fails when the vendored files differ from the npm package.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'node_modules', 'three');
const target = path.join(root, 'vendor', 'three');
const FILES = [
  ['build/three.module.min.js', 'three.module.min.js'],
  ['examples/jsm/controls/OrbitControls.js', 'addons/controls/OrbitControls.js'],
  ['LICENSE', 'LICENSE'],
];
const EXPECTED_VERSION = '0.170.0';

const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const version = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8')).version;
if (version !== EXPECTED_VERSION)
  throw new Error(`Expected three@${EXPECTED_VERSION} in node_modules, found ${version}`);

if (process.argv.includes('--check')) {
  const problems = [];
  for (const [from, to] of FILES) {
    const vendored = path.join(target, to);
    if (!fs.existsSync(vendored)) problems.push(`${to}: missing`);
    else if (hash(vendored) !== hash(path.join(source, from)))
      problems.push(`${to}: differs from three@${version}`);
  }
  const expected = new Set(FILES.map(([, to]) => to));
  const extra = fs.existsSync(target)
    ? fs
        .readdirSync(target, { recursive: true })
        .filter((file) => fs.statSync(path.join(target, file)).isFile())
        .map((file) => file.split(path.sep).join('/'))
        .filter((file) => !expected.has(file))
    : [];
  for (const file of extra) problems.push(`${file}: not part of the vendored file list`);
  if (problems.length) {
    console.error('vendor/three is out of date:\n  ' + problems.join('\n  '));
    console.error('Run `npm run vendor:three` and commit the result.');
    process.exit(1);
  }
  console.log(`vendor/three matches three@${version} (${FILES.length} files).`);
} else {
  fs.rmSync(target, { recursive: true, force: true });
  for (const [from, to] of FILES) {
    const destination = path.join(target, to);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(source, from), destination);
  }
  console.log(`Copied ${FILES.length} files from three@${version} to vendor/three.`);
}
