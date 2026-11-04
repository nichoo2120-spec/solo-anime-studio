// GitHub Actions uses its short-lived GITHUB_TOKEN. No token is shipped in the app.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');
const root = path.resolve(__dirname, '..');

function verifyAssets(directory, version) {
  const manifest = yaml.load(fs.readFileSync(path.join(directory, 'latest.yml'), 'utf8'));
  const name = `SoloAnimeStudio-Setup-${version}.exe`;
  if (manifest.version !== version || manifest.path !== name || manifest.files?.length !== 1 || manifest.files[0].url !== name) throw Error('Update manifest does not match this exact version/installer');
  const exe = fs.readFileSync(path.join(directory, name));
  const sha512 = crypto.createHash('sha512').update(exe).digest('base64');
  if (manifest.sha512 !== sha512 || manifest.files[0].sha512 !== sha512 || manifest.files[0].size !== exe.length) throw Error('Installer checksum or size does not match latest.yml');
  if (!fs.statSync(path.join(directory, name + '.blockmap')).size) throw Error('Missing differential update blockmap');
  return [name, name + '.blockmap', 'latest.yml'];
}

function compareVersions(a, b) {
  const parse = value => { if (!/^\d+\.\d+\.\d+$/.test(value)) throw Error('Desktop releases must have a stable x.y.z version'); return value.split('.').map(Number); };
  const aa = parse(a), bb = parse(b);
  for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return Math.sign(aa[i] - bb[i]);
  return 0;
}

async function publish({ directory, version, release, sha, token, request = fetch }) {
  if (!token || !/^[a-f0-9]{40}$/.test(sha || '')) throw Error('A GitHub Actions token and exact source commit are required');
  const files = verifyAssets(directory, version);
  compareVersions(version, version);
  const repo = `${release.owner}/${release.repo}`, api = `https://api.github.com/repos/${repo}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  async function call(url, options = {}, allow404 = false) {
    const response = await request(url, { ...options, headers: { ...headers, ...options.headers } });
    if (response.status === 404 && allow404) return null;
    if (!response.ok) throw Error(`GitHub release request failed (${response.status})`);
    return response.status === 204 ? null : response.json();
  }
  const latest = await call(api + '/releases/latest', {}, true);
  const existing = await call(api + `/releases/tags/v${version}`, {}, true);
  if (existing && !existing.draft) { console.log(`v${version} is already published; preserving it.`); return; }
  if (latest && compareVersions(version, latest.tag_name.replace(/^v/, '')) <= 0) throw Error('Refusing a downgrade or replacement of an existing release');
  // The feed remains on the old release until ALL verified assets have uploaded.
  const draft = existing || await call(api + '/releases', { method: 'POST', body: JSON.stringify({ tag_name: `v${version}`, target_commitish: sha, name: `Solo Anime Studio ${version}`, body: 'Desktop update delivery improvements. Existing brush rendering is unchanged. Updates download inside the installed app; save your drawing, then choose Install and restart.', draft: true, prerelease: false }) });
  for (const name of files) {
    const previous = draft.assets?.find(asset => asset.name === name);
    if (previous) await call(api + `/releases/assets/${previous.id}`, { method: 'DELETE' });
    const bytes = fs.readFileSync(path.join(directory, name));
    const asset = await call(draft.upload_url.replace(/\{.*$/, '') + '?name=' + encodeURIComponent(name), { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes });
    const digest = 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
    if (asset.size !== bytes.length || (asset.digest && asset.digest !== digest)) throw Error(`Uploaded asset failed integrity check: ${name}`);
  }
  const ready = await call(api + `/releases/${draft.id}`);
  for (const name of files) if (!ready.assets.some(asset => asset.name === name && asset.state === 'uploaded' && asset.size === fs.statSync(path.join(directory, name)).size)) throw Error('The draft release is incomplete; keeping it hidden');
  const result = await call(api + `/releases/${draft.id}`, { method: 'PATCH', body: JSON.stringify({ draft: false, make_latest: 'true' }) });
  console.log(`Published ${result.html_url}`);
}

if (require.main === module) {
  const version = require('../package.json').version, directory = path.join(root, 'release');
  const task = process.argv[2];
  Promise.resolve().then(() => {
    if (task === 'verify') { console.log('Verified update assets:', verifyAssets(directory, version).join(', ')); return; }
    if (task !== 'publish') throw Error('Use verify or publish');
    if (process.env.GITHUB_REF !== 'refs/heads/main' || process.env.GITHUB_EVENT_NAME === 'pull_request') throw Error('Only the tested main branch may publish desktop updates');
    return publish({ directory, version, release: require('../release.config.json'), sha: process.env.GITHUB_SHA, token: process.env.GH_TOKEN });
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { verifyAssets, compareVersions, publish };
