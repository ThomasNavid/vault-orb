const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error('The native Control shortcut currently builds on Apple Silicon macOS only.');
}

const nodeBinary = fs.realpathSync(process.execPath);
const include = path.resolve(path.dirname(nodeBinary), '../include/node');
if (!fs.existsSync(path.join(include, 'node_api.h'))) {
  throw new Error(`Node headers were not found at ${include}. Install a Node.js distribution with headers.`);
}

const root = path.resolve(__dirname, '..');
const result = spawnSync('clang++', [
  '-std=c++17', '-bundle', '-undefined', 'dynamic_lookup',
  `-I${include}`, '-framework', 'ApplicationServices',
  path.join(root, 'native/shortcut.cc'), '-o', path.join(root, 'native/orb-shortcut.node')
], {stdio: 'inherit'});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

const location = spawnSync('clang++', [
  '-std=c++17', '-fobjc-arc', '-bundle', '-undefined', 'dynamic_lookup',
  `-I${include}`, '-framework', 'Foundation', '-framework', 'CoreLocation',
  path.join(root, 'native/location.mm'), '-o', path.join(root, 'native/orb-location.node')
], {stdio: 'inherit'});
if (location.error) throw location.error;
if (location.status !== 0) process.exit(location.status || 1);
