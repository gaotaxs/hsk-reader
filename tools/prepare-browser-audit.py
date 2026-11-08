"""Create a browser QA copy with isolated synthetic storage and no service worker.
Usage: python tools/prepare-browser-audit.py /absolute/path/to/preview-directory
Serve that output with a static development server and open index.html.
Never point this at production hosting or an existing user profile.
"""
from pathlib import Path
import re
import shutil
import sys

source = Path(__file__).resolve().parent.parent
output = Path(sys.argv[1]).resolve()
if output == source or output in source.parents:
    raise SystemExit('Use a separate output directory.')
app = output / 'app'
app.mkdir(parents=True, exist_ok=True)
for name in ['index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']:
    shutil.copy2(source / name, app / name)
for name in ['assets', 'vendor']:
    shutil.copytree(source / name, app / name, dirs_exist_ok=True)
page = (app / 'index.html').read_text()
page = re.sub(r'<script src="\./assets/pwa.js" defer></script>',
              '<script src="./browser-audit.js" defer></script>', page)
(app / 'index.html').write_text(page)
code = (app / 'assets/app.js').read_text().replace('hskReader', 'hskSyntheticAudit117')
(app / 'assets/app.js').write_text(code)
shutil.copy2(source / 'tests/browser-audit.js', app / 'browser-audit.js')
shutil.copy2(source / 'tests/browser-audit.html', output / 'index.html')
print('Prepared isolated browser QA at', output)
