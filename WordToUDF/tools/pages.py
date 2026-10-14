"""Generates the shared parts of the HTML pages (head, app bar, icon sprite).

Run after changing the header, navigation, icons or version:
    python3 tools/pages.py
Each page keeps its own body in tools/pages/<name>.body.html; this script wraps
it with the identical <head>, app bar and SVG sprite so the four pages can
never drift apart. CSP note: no inline style or script anywhere.
"""
from pathlib import Path
import json, re

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(__file__).resolve().parent / 'pages'
VERSION = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))['version']
CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'"
# (page, label, short label for phones, icon)
NAV = [('workspace.html', 'Dönüştür', 'Dönüştür', 'i-doc'), ('templates.html', 'Şablonlar', 'Şablon', 'i-layers'),
       ('reverse.html', 'UDF → Word / PDF', 'UDF→Word', 'i-swap'), ('sure.html', 'Süre hesapla', 'Süre', 'i-clock')]

def head(title, extra_css=()):
    css = ''.join(f'<link rel="stylesheet" href="{c}">' for c in ('workspace.css', *extra_css))
    return ('<!doctype html><html lang="tr"><head><meta charset="utf-8"><link rel="icon" href="icon48.png">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<meta name="color-scheme" content="light dark"><link rel="manifest" href="app.webmanifest">'
            '<meta name="theme-color" content="#1e3a8a">'
            f'<meta http-equiv="Content-Security-Policy" content="{CSP}">'
            f'<title>{title}</title>{css}<script src="theme.js"></script></head>')

def appbar(current):
    cur = ' aria-current="page"'
    def text(label, short):
        return label if label == short else f'<span class="l-long">{label}</span><span class="l-short">{short}</span>'
    links = ''.join(
        f'<a href="{href}"{cur if href == current else ""}><svg class="icon" aria-hidden="true"><use href="#{icon}"/></svg>{text(label, short)}</a>'
        for href, label, short, icon in NAV)
    return ('<header class="appbar">'
            '<a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">§</span>'
            '<span class="brand-text"><strong>Word ↔ UDF</strong><small>Hukuk dilekçesi araçları</small></span></a>'
            f'<nav class="appnav" aria-label="Bölümler">{links}</nav>'
            '<div class="appbar-end"><span class="offline-badge" title="Bütün işlemler bu cihazda yapılır; dosyalar hiçbir sunucuya gönderilmez.">Çevrimdışı</span>'
            '<button type="button" class="theme-toggle" id="themeToggle" aria-label="Tema">'
            '<svg class="icon t-auto" aria-hidden="true"><use href="#i-auto"/></svg>'
            '<svg class="icon t-light" aria-hidden="true"><use href="#i-sun"/></svg>'
            '<svg class="icon t-dark" aria-hidden="true"><use href="#i-moon"/></svg></button>'
            f'<span class="version" title="Sürüm">v{VERSION}</span></div></header>')

PAGES = {
    'workspace.html': ('Word → UDF Dönüştürücü', ()),
    'templates.html': ('Şablondan Dilekçe', ()),
    'reverse.html': ('UDF → Word / PDF', ('reverse.css',)),
    'sure.html': ('Süre hesapla', ()),
    'index.html': ('Word ↔ UDF', ()),
}

def main():
    sprite = (SRC / 'sprite.svg').read_text(encoding='utf-8').strip()
    for name, (title, css) in PAGES.items():
        body = (SRC / f'{name[:-5]}.body.html').read_text(encoding='utf-8').strip().replace('{{VERSION}}', VERSION)
        scripts = re.findall(r'<script src="[^"]+"></script>', body)
        html = head(title, css) + '<body>' + sprite + appbar(name) + body + '</body></html>\n'
        assert 'style="' not in html, f'{name}: inline style would violate the CSP'
        assert '<script>' not in html, f'{name}: inline script would violate the CSP'
        (ROOT / name).write_text(html, encoding='utf-8')
        print(f'{name}: {len(html)} bayt, {len(scripts)} betik')

if __name__ == '__main__':
    main()
