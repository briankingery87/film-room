#!/usr/bin/env python3
"""
The Film Room - build step.

    python build.py

Reads src/app.template.html and writes index.html.

Unlike Ask the Atlas and Tux's Take there is NO vendor inlining step, because
this app draws no maps. Every visual here is inline SVG or CSS the file writes
itself, so there is no Leaflet to inline and no vendor/ folder to keep in sync.
The build still exists for two reasons that have nothing to do with bundling:

  1. index.html stays a GENERATED artifact. Nobody hand-edits the published
     file, which is the rule the other two apps run on.
  2. It extracts the app script to .appcheck.js so `node --check` can catch a
     syntax error in about a second, before a browser is involved.
"""
import re, pathlib

root = pathlib.Path(__file__).parent
tpl  = (root / 'src' / 'app.template.html').read_text(encoding='utf-8')

if '<script>' not in tpl:
    raise SystemExit('ERROR: template has no script block.')

(root / 'index.html').write_text(tpl, encoding='utf-8')

blocks = re.findall(r'<script>(.*?)</script>', tpl, re.S)
(root / '.appcheck.js').write_text(blocks[-1], encoding='utf-8')

print('built index.html  {:,} bytes  ({} script blocks)'.format(len(tpl), len(blocks)))
print('now run:  node --check .appcheck.js')
