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

function ensureCursorSdk(options = {}) {
  const root = options.root ?? path.resolve(__dirname, '..', '..');
  const sdkPackage = path.join(root, SDK_RELATIVE);
  if (fs.existsSync(sdkPackage)) {
    return { generated: false };
  }
  const projectDir = path.join(root, 'infra', 'cursor-automations');
  const env = options.env ?? process.env;
  const pulumiBin = options.pulumiBin ?? findPulumi(env) ?? (options.installPulumi ?? defaultInstallPulumi)();
  const result = spawnSync(pulumiBin, ['install', '--no-dependencies', '--non-interactive'], {
    cwd: projectDir,
    env,
    stdio: 'inherit'
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`pulumi install --no-dependencies failed in ${projectDir}`);
  }
  if (!fs.existsSync(sdkPackage)) {
    throw new Error(`pulumi install did not write ${sdkPackage}`);
  }
  return { generated: true };
}

function preResolution() {
  ensureCursorSdk();
}

module.exports = { ensureCursorSdk, preResolution };
