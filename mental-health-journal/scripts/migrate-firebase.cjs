/* Copy only journal accounts/documents. Existing supplement data is read-only.
 * Default: preview. --apply writes the new project; no user content is logged.
 * Run again immediately before cutover. Refuses to replace data edited there.
 */
const crypto = require('node:crypto');
const { Command } = require('firebase-tools/lib/command');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const SOURCE = 'dicky-supplement-tracker-2026';
const TARGET = 'dicky-heartland-journal-2026';
const firestore = new Client({ urlPrefix: 'https://firestore.googleapis.com', auth: true });
const identity = new Client({ urlPrefix: 'https://identitytoolkit.googleapis.com', auth: true });
const privateLog = { skipLog: { body: true, response: true } };
const prefix = (project) => 'projects/' + project + '/databases/(default)/documents/';
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}
function digest(fields) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical(fields)))
    .digest('hex');
}
function documentWrite(name, fields, target, previousHash) {
  if (target && (!previousHash || digest(target.fields) !== previousHash))
    throw Error('The new project has records changed since migration; no documents were written');
  return {
    update: { name, fields },
    currentDocument: target ? { updateTime: target.updateTime } : { exists: false },
  };
}
async function getDocument(name) {
  const response = await firestore.post(
    '/v1/' + prefix(TARGET).slice(0, -1) + ':batchGet',
    { documents: [name] },
    privateLog,
  );
  return response.body.find((result) => result.found)?.found || null;
}

async function migrate(apply) {
  const response = await firestore.post(
    '/v1/' + prefix(SOURCE).slice(0, -1) + ':runQuery',
    {
      structuredQuery: { from: [{ collectionId: 'mentalHealthJournal', allDescendants: true }] },
    },
    privateLog,
  );
  const documents = response.body.filter((r) => r.document).map((r) => r.document);
  const users = new Set();
  for (const document of documents) {
    const relative = document.name.slice(prefix(SOURCE).length);
    const match =
      /^users\/([^/]+)\/mentalHealthJournal\/(core|ci-[0-9]{4}|dr-[0-9]{4}-(?:0[1-9]|1[0-2]))$/.exec(
        relative,
      );
    if (!match) throw Error('Unexpected journal document path; review before migrating');
    users.add(match[1]);
  }
  if (documents.length > 400)
    throw Error('More than 400 documents; split migration into reviewed batches');
  const receiptName = prefix(TARGET) + 'journalMigrations/cutover';
  const receipt = await getDocument(receiptName);
  const previous = receipt ? JSON.parse(receipt.fields.hashes.stringValue) : {};
  const writes = [],
    hashes = {};
  for (const source of documents) {
    const relative = source.name.slice(prefix(SOURCE).length);
    const name = prefix(TARGET) + relative;
    const target = await getDocument(name);
    hashes[relative] = digest(source.fields);
    writes.push(documentWrite(name, source.fields, target, previous[relative]));
  }
  const accounts = [];
  for (const uid of users) {
    const source = (
      await identity.post(
        '/v1/projects/' + SOURCE + '/accounts:lookup',
        { localId: [uid] },
        privateLog,
      )
    ).body.users?.[0];
    if (!source || !source.providerUserInfo?.some((p) => p.providerId === 'google.com'))
      throw Error('A journal account is missing its Google identity');
    const target = (
      await identity.post(
        '/v1/projects/' + TARGET + '/accounts:lookup',
        { localId: [uid] },
        privateLog,
      )
    ).body.users?.[0];
    const google = source.providerUserInfo.filter((p) => p.providerId === 'google.com');
    if (target) {
      if (
        !target.providerUserInfo?.some(
          (p) => p.providerId === 'google.com' && p.rawId === google[0].rawId,
        )
      )
        throw Error('Existing destination account does not match');
    } else {
      accounts.push({
        localId: uid,
        email: source.email,
        emailVerified: source.emailVerified === true,
        displayName: source.displayName,
        photoUrl: source.photoUrl,
        disabled: source.disabled === true,
        providerUserInfo: google.map((p) =>
          Object.fromEntries(
            ['providerId', 'rawId', 'email', 'displayName', 'photoUrl']
              .filter((k) => p[k] !== undefined)
              .map((k) => [k, p[k]]),
          ),
        ),
      });
    }
  }
  console.log(
    JSON.stringify({
      mode: apply ? 'apply' : 'preview',
      source: SOURCE,
      target: TARGET,
      journalAccounts: users.size,
      accountsToImport: accounts.length,
      documents: documents.length,
    }),
  );
  if (!apply || !documents.length) return;
  if (accounts.length) {
    const imported = (
      await identity.post(
        '/v1/projects/' + TARGET + '/accounts:batchCreate',
        { users: accounts },
        privateLog,
      )
    ).body;
    if (imported.error?.length) throw Error('Account import incomplete; documents were not copied');
  }
  writes.push({
    update: {
      name: receiptName,
      fields: {
        sourceProject: { stringValue: SOURCE },
        hashes: { stringValue: JSON.stringify(hashes) },
        copiedAt: { timestampValue: new Date().toISOString() },
      },
    },
    currentDocument: receipt ? { updateTime: receipt.updateTime } : { exists: false },
  });
  await firestore.post('/v1/' + prefix(TARGET).slice(0, -1) + ':commit', { writes }, privateLog);
  for (const source of documents) {
    const copied = await getDocument(prefix(TARGET) + source.name.slice(prefix(SOURCE).length));
    if (!copied || digest(copied.fields) !== digest(source.fields))
      throw Error('Copied data did not match');
  }
  console.log('Journal data verified; original project unchanged.');
}
if (require.main === module) {
  const apply = process.argv.includes('--apply');
  const index = process.argv.indexOf('--account');
  const account = index >= 0 ? process.argv[index + 1] : undefined;
  new Command('journal:migrate')
    .before(requireAuth)
    .action(() => migrate(apply))
    .runner()({ project: TARGET, account, nonInteractive: true })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
module.exports = { canonical, digest, documentWrite };
