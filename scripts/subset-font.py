#!/usr/bin/env python3
"""Subset the CC0 CJK font to the characters the game actually uses (rerun after text edits).

Reads every source file under src/ plus index.html, keeps printable ASCII and common CJK
punctuation, and writes public/fonts/jinghua-subset.woff2 from the full font in assets/fonts/.
"""
import glob, os, subprocess, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
full = os.path.join(root, 'assets/fonts/ManusCC0SansCJKSC-Regular.woff2')
out = os.path.join(root, 'public/fonts/jinghua-subset.woff2')
chars = set(chr(c) for c in range(0x20, 0x7f)) | set('，。、；：？！…—·《》「」『』（）【】～　')
for p in glob.glob(os.path.join(root, 'src/**/*.*'), recursive=True) + [os.path.join(root, 'index.html')]:
    with open(p, encoding='utf8') as f:
        chars |= set(f.read())
text = ''.join(sorted(c for c in chars if c.isprintable()))
subprocess.run([sys.executable, '-m', 'fontTools.subset', full, f'--text={text}', '--flavor=woff2',
                f'--output-file={out}', '--layout-features=*', '--no-hinting'], check=True)
print(f'{len(text)} chars -> {out} ({os.path.getsize(out) // 1024} KB)')
