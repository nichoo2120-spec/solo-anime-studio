const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { verifyAssets, compareVersions, publish } = require('../scripts/release-desktop.cjs');
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sas-update-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const version = '0.5.178', name = `SoloAnimeStudio-Setup-${version}.exe`, exe = Buffer.from('MZ test installer');
  const sha512 = crypto.createHash('sha512').update(exe).digest('base64');
  const manifest = { version, path: name, sha512, files: [{ url: name, sha512, size: exe.length }] };
  fs.writeFileSync(path.join(directory, name), exe); fs.writeFileSync(path.join(directory, name + '.blockmap'), 'blockmap');
  fs.writeFileSync(path.join(directory, 'latest.yml'), JSON.stringify(manifest));
  return { directory, version, name, manifest };
}
test('manifest must identify the exact installer, version, bytes and blockmap', t => {
  const f = fixture(t); assert.equal(verifyAssets(f.directory, f.version).length, 3);
  fs.appendFileSync(path.join(f.directory, f.name), 'corrupt'); assert.throws(() => verifyAssets(f.directory, f.version), /checksum or size/);
});
test('mismatched manifests and absent blockmaps are rejected', t => {
  const f = fixture(t); assert.throws(() => verifyAssets(f.directory, '0.5.179'), /exact version/);
  fs.rmSync(path.join(f.directory, f.name + '.blockmap')); assert.throws(() => verifyAssets(f.directory, f.version));
});
test('stable version ordering prevents downgrades and prerelease feeds', () => {
  assert.equal(compareVersions('0.5.178', '0.5.177'), 1); assert.equal(compareVersions('0.5.9', '0.5.178'), -1);
  assert.equal(compareVersions('0.5.178', '0.5.178'), 0); assert.throws(() => compareVersions('0.5.179-beta', '0.5.178'));
});
test('release stays draft until three matching assets are uploaded and verified', async t => {
  const f = fixture(t), calls = [], assets = [], sha = 'a'.repeat(40);
  const request = async (url, options) => {
    calls.push([url, options]); let data, status = 200;
    if (url.endsWith('/latest') || url.includes('/tags/')) status = 404;
    else if (options.method === 'POST' && url.endsWith('/releases')) { assert.equal(JSON.parse(options.body).draft, true); data = { id: 7, upload_url: 'https://uploads.github.com/releases/7/assets{?name,label}', assets: [] }; }
    else if (url.includes('uploads.github.com')) { const name = new URL(url).searchParams.get('name'); data = { name, size: options.body.length, state: 'uploaded' }; assets.push(data); }
    else if (options.method === 'PATCH') { assert.equal(assets.length, 3); assert.equal(JSON.parse(options.body).draft, false); data = { html_url: 'https://github.com/release' }; }
    else data = { assets };
    return { ok: status === 200, status, json: async () => data };
  };
  await publish({ ...f, release: { owner: 'owner', repo: 'repo' }, sha, token: 'fake-test-only', request });
  assert.equal(calls.at(-1)[1].method, 'PATCH');
});
test('failed uploads never publish an incomplete draft', async t => {
  const f = fixture(t); let published = false;
  const request = async (url, options) => {
    if (options.method === 'PATCH') published = true;
    const missing = url.endsWith('/latest') || url.includes('/tags/');
    return { status: missing ? 404 : url.includes('uploads.') ? 500 : 200, ok: !missing && !url.includes('uploads.'), json: async () => ({ id: 7, assets: [], upload_url: 'https://uploads.github.com/assets{?name,label}' }) };
  };
  await assert.rejects(publish({ ...f, release: { owner: 'o', repo: 'r' }, sha: 'a'.repeat(40), token: 'fake', request }), /500/);
  assert.equal(published, false);
});
