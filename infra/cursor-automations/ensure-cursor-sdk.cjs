const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SDK_RELATIVE = path.join('infra', 'cursor-automations', 'sdks', 'cursor', 'package.json');
const PULUMI_VERSION = '3.255.0';
const PULUMI_SHA256 = {
  'darwin-arm64': 'adc6ae338ec877307869a26f74e5d3acc5fb2f590bfb19d00d50c3c8ed2e91b7',
  'darwin-x64': '19672db74cd9158ebde97877224c6cd18def1c8024340378e3208f6ad6539200',
  'linux-arm64': '699fbc6ea848d997e9b3645487f108d27b1b55ec807c7576406131e6e080f0e3',
  'linux-x64': 'cf559568e2c32f7fae56ea3de8ae5fa48973ba8c5aa9dd2b3dc0c8898fe50dba'
};

function findPulumi(env) {
  const result = spawnSync('pulumi', ['version'], { env, stdio: 'ignore' });
  if (result.status === 0) return 'pulumi';
  return null;
}

function defaultInstallPulumi() {
  const platformKey = `${process.platform}-${process.arch}`;
  const sha256 = PULUMI_SHA256[platformKey];
  if (!sha256) {
    throw new Error(`No pinned Pulumi ${PULUMI_VERSION} build for ${platformKey}`);
  }
  const root = path.join(os.homedir(), '.cache', 'waykit', 'pulumi', PULUMI_VERSION, platformKey);
  const bin = path.join(root, 'pulumi', 'pulumi');
  if (fs.existsSync(bin)) return bin;
  fs.mkdirSync(root, { recursive: true });
  const archive = path.join(root, 'pulumi.tar.gz');
  const name = `pulumi-v${PULUMI_VERSION}-${platformKey}.tar.gz`;
  const url = `https://github.com/pulumi/pulumi/releases/download/v${PULUMI_VERSION}/${name}`;
  const download = spawnSync(
    'curl',
    ['--proto', '=https', '--tlsv1.2', '-fsSL', url, '-o', archive],
    { stdio: 'inherit' }
  );
  if (download.status !== 0) {
    throw new Error(`failed to download ${url}`);
  }
  const digest = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
  if (digest !== sha256) {
    throw new Error(`Pulumi checksum mismatch for ${name}`);
  }
  const extract = spawnSync('tar', ['-xzf', archive, '-C', root], { stdio: 'inherit' });
  fs.unlinkSync(archive);
  if (extract.status !== 0 || !fs.existsSync(bin)) {
    throw new Error(`failed to extract Pulumi CLI from ${name}`);
  }
  return bin;
}

function readManifest(sdkPackage) {
  try {
    return JSON.parse(fs.readFileSync(sdkPackage, 'utf8'));
  } catch {
    return null;
  }
}

function manifestHasEntry(manifest) {
  if (!manifest || typeof manifest !== 'object') return false;
  if (typeof manifest.main === 'string' && manifest.main !== '') return true;
  return manifest.exports != null;
}

function relativeField(manifest, field) {
  const value = manifest && manifest[field];
  if (typeof value !== 'string' || value === '') return '';
  return value.replace(/^\.\//, '');
}

function declarationForEntry(entry) {
  if (entry.endsWith('.d.ts')) return entry;
  if (/\.(?:mjs|cjs|js)$/.test(entry)) return entry.replace(/\.(?:mjs|cjs|js)$/, '.d.ts');
  return `${entry}.d.ts`;
}

function onDisk(sdkDir, relativePath) {
  return relativePath !== '' && fs.existsSync(path.join(sdkDir, relativePath));
}

function readQuotedSpecifier(source, pattern) {
  const match = source.match(pattern);
  if (!match) return '';
  return match[1].replace(/^\.\//, '');
}

function cursorSdkIsGenerated(sdkPackage) {
  // The Dependabot stub commits package.json with no main or exports.
  // `pulumi install` rewrites that file; keep the stub. A gitignored shim counts
  // as generated only when the compiled JS entry and its declarations are on disk.
  if (!fs.existsSync(sdkPackage)) return false;
  const sdkDir = path.dirname(sdkPackage);
  const manifest = readManifest(sdkPackage);
  if (!manifestHasEntry(manifest)) return stubShimIsComplete(sdkDir);
  const main = relativeField(manifest, 'main');
  if (!onDisk(sdkDir, main)) return false;
  const types = relativeField(manifest, 'types') || declarationForEntry(main);
  return onDisk(sdkDir, types);
}

function stubShimIsComplete(sdkDir) {
  const shimPath = path.join(sdkDir, 'index.js');
  const typesShimPath = path.join(sdkDir, 'index.d.ts');
  if (!fs.existsSync(shimPath) || !fs.existsSync(typesShimPath)) return false;
  const target = readQuotedSpecifier(
    fs.readFileSync(shimPath, 'utf8'),
    /^'use strict';\nmodule\.exports = require\("(\.\/[^"]+)"\);\n$/
  );
  // Pulumi's generated main was already index.js, so the declaration beside it is the SDK.
  if (target === '') return true;
  if (!onDisk(sdkDir, target)) return false;
  const specifier = readQuotedSpecifier(
    fs.readFileSync(typesShimPath, 'utf8'),
    /^export \* from "(\.\/[^"]+)";\n$/
  );
  if (specifier === '') return false;
  return onDisk(sdkDir, declarationForEntry(specifier));
}

function restoreStub(sdkPackage, priorBytes) {
  fs.mkdirSync(path.dirname(sdkPackage), { recursive: true });
  fs.writeFileSync(sdkPackage, priorBytes);
}

function writeEntryShim(sdkDir, generatedManifest) {
  const declared = relativeField(generatedManifest, 'main');
  const main = declared !== '' ? declared : 'bin/index.js';
  if (main === 'index.js') return;
  const contents = `'use strict';\nmodule.exports = require(${JSON.stringify(`./${main}`)});\n`;
  fs.writeFileSync(path.join(sdkDir, 'index.js'), contents);
  const types = relativeField(generatedManifest, 'types') || declarationForEntry(main);
  if (types === 'index.d.ts') return;
  const specifier = types.endsWith('.d.ts') ? `./${types.slice(0, -5)}.js` : `./${types}`;
  fs.writeFileSync(path.join(sdkDir, 'index.d.ts'), `export * from ${JSON.stringify(specifier)};\n`);
}

function ensureCursorSdk(options = {}) {
  const root = options.root ?? path.resolve(__dirname, '..', '..');
  const sdkPackage = path.join(root, SDK_RELATIVE);
  if (cursorSdkIsGenerated(sdkPackage)) {
    return { generated: false };
  }
  const projectDir = path.join(root, 'infra', 'cursor-automations');
  const sdkDir = path.dirname(sdkPackage);
  const priorBytes = fs.existsSync(sdkPackage) ? fs.readFileSync(sdkPackage) : null;
  const preserveStub = priorBytes !== null && !manifestHasEntry(readManifest(sdkPackage));
  const workspaceFile = path.join(projectDir, 'pnpm-workspace.yaml');
  const priorWorkspace = fs.existsSync(workspaceFile) ? fs.readFileSync(workspaceFile) : null;
  const restoreTracked = () => {
    if (preserveStub) restoreStub(sdkPackage, priorBytes);
    if (priorWorkspace) fs.writeFileSync(workspaceFile, priorWorkspace);
  };
  const env = options.env ?? process.env;
  const pulumiBin = options.pulumiBin ?? findPulumi(env) ?? (options.installPulumi ?? defaultInstallPulumi)();
  const result = spawnSync(pulumiBin, ['install', '--no-dependencies', '--non-interactive'], {
    cwd: projectDir,
    env,
    stdio: 'inherit'
  });
  if (result.error) {
    restoreTracked();
    throw result.error;
  }
  if (result.status !== 0) {
    restoreTracked();
    throw new Error(`pulumi install --no-dependencies failed in ${projectDir}`);
  }
  if (!fs.existsSync(sdkPackage)) {
    restoreTracked();
    throw new Error(`pulumi install did not write ${sdkPackage}`);
  }
  if (preserveStub) {
    const generatedManifest = readManifest(sdkPackage);
    restoreStub(sdkPackage, priorBytes);
    writeEntryShim(sdkDir, generatedManifest);
  }
  if (priorWorkspace) fs.writeFileSync(workspaceFile, priorWorkspace);
  return { generated: true };
}

function preResolution() {
  ensureCursorSdk();
}

module.exports = { ensureCursorSdk, preResolution };
