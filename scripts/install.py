from pathlib import Path
import plistlib
import subprocess
import time

project = Path(__file__).resolve().parent.parent
source = project / 'dist/Vault Orb-darwin-arm64/Vault Orb.app'
destination = Path.home() / 'Applications/Vault Orb.app'
with (source / 'Contents/Info.plist').open('rb') as app_info:
    bundle_id = plistlib.load(app_info)['CFBundleIdentifier']
if destination.exists():
    raise SystemExit('Vault Orb already exists in Applications; refusing to overwrite it.')
destination.parent.mkdir(exist_ok=True)
subprocess.run(['ditto', str(source), str(destination)], check=True)
backup = Path('/private/tmp') / f'vault-orb-dock-before-{int(time.time())}.plist'
subprocess.run(['defaults', 'export', 'com.apple.dock', str(backup)], check=True, stdout=subprocess.DEVNULL)
preferences = plistlib.loads(backup.read_bytes())
url = destination.as_uri() + '/'
already_pinned = any(item.get('tile-data', {}).get('file-data', {}).get('_CFURLString') == url for item in preferences.get('persistent-apps', []))
if not already_pinned:
    entry = {'tile-data': {'file-data': {'_CFURLString': url, '_CFURLStringType': 15}, 'file-label': 'Vault Orb', 'bundle-identifier': bundle_id, 'file-type': 41}, 'tile-type': 'file-tile'}
    subprocess.run(['defaults', 'write', 'com.apple.dock', 'persistent-apps', '-array-add', plistlib.dumps(entry).decode()], check=True)
    subprocess.run(['killall', 'Dock'], check=False)
subprocess.run(['open', str(destination)], check=True)
print(f'Installed and opened {destination}')
print(f'Dock preferences backup: {backup}')
