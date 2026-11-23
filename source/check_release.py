"""Rerun supported checks and validate the portable offline build."""
import hashlib
import base64
import json
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent

class ReleaseHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.inline_scripts = []
        self.styles = []
        self.csp = ""
        self.in_script = False
        self.in_style = False

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        assert len(attributes) == len(attrs), f'Duplicate attribute on {tag}'
        if identifier := attributes.get('id'):
            assert identifier not in self.ids, f'Duplicate ID: {identifier}'
            self.ids.add(identifier)
        if tag == 'meta' and attributes.get('http-equiv') == 'Content-Security-Policy':
            self.csp = attributes['content']
        if tag == 'style':
            self.in_style = True
            self.styles.append('')
        if tag == 'script':
            assert 'src' not in attributes, 'Offline app requires an external script'
            self.in_script = True
            self.inline_scripts.append('')

    def handle_data(self, data):
        if self.in_script:
            self.inline_scripts[-1] += data
        if self.in_style:
            self.styles[-1] += data

    def handle_endtag(self, tag):
        if tag == 'script':
            self.in_script = False
        if tag == 'style':
            self.in_style = False

def run(*command):
    subprocess.run(command, cwd=ROOT, check=True)

for suite in ('test', 'test_final', 'test_scope', 'evaluate_model'):
    run('node', f'source/{suite}.js')
run(sys.executable, 'source/build_site.py')
run('node', '--test', 'source/test_api.js')
html = (ROOT / 'CampusCompass.html').read_text()
assert html == (ROOT / 'dist/index.html').read_text(), 'Offline and hosted builds differ'
page = ReleaseHTML()
page.feed(html)
assert {'question', 'askbtn', 'answer', 'proofs', 'prompttext', 'validation', 'runbench', 'bench'} <= page.ids
assert len(page.inline_scripts) == 3 and len(page.styles) == 1, 'Expected three scripts and a style block'
for inline in page.inline_scripts + page.styles:
    sha = base64.b64encode(hashlib.sha256(inline.encode()).digest()).decode('ascii')
    assert "'sha256-" + sha + "'" in page.csp, 'Bundled content is blocked by its content security policy'
assert html.count('data:image/webp;base64,') == 1, 'The hero image must be embedded once'
assert (ROOT / 'package.json').is_file()
with tempfile.TemporaryDirectory() as directory:
    script = Path(directory) / 'bundle.js'
    script.write_text('\n'.join(page.inline_scripts))
    run('node', '--check', str(script))
model = json.loads((ROOT / 'evidence/model_summary.json').read_text())
assert model['total_runs'] == 48
assert [row['contract_pass'] for row in model['versions']] == [0, 0, 0, 1, 6, 8]
print('Release checks passed for routing, citations, scope, historical model scores, runtime APIs, and both builds.')
