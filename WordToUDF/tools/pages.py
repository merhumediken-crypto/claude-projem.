"""Generates the shared parts of the HTML pages (head, app bar, icon sprite).

Run after changing the header, navigation, icons or version:
    python3 tools/pages.py
Each page keeps its own body in tools/pages/<name>.body.html; this script wraps
it with the identical <head>, app bar, phone tab bar, footer and SVG sprite so
the five pages can never drift apart. CSP note: no inline style or script
anywhere; the guilloche of the app bar is a CSS background (data: image).
"""
from pathlib import Path
import json, re

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(__file__).resolve().parent / 'pages'
VERSION = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))['version']
CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'"
# (page, label, short label for phones, icon)
NAV = [('workspace.html', 'Dönüştür', 'Dönüştür', 'i-doc'), ('templates.html', 'Şablonlar', 'Şablonlar', 'i-grid'),
       ('reverse.html', 'UDF → Word / PDF', 'UDF→Word', 'i-swap'), ('sure.html', 'Süre hesabı', 'Süre', 'i-clock')]
# What the phone header says under the brand on each page.
SUBTITLE = {'workspace.html': 'Word → UYAP UDF', 'templates.html': 'Şablondan dilekçe', 'reverse.html': 'UDF → Word / PDF',
            'sure.html': 'Süre hesabı', 'index.html': 'Hukuk dilekçesi stüdyosu'}

def icon(name, cls='icon'):
    return f'<svg class="{cls}" aria-hidden="true"><use href="#{name}"/></svg>'

def head(title, extra_css=()):
    css = ''.join(f'<link rel="stylesheet" href="{c}">' for c in ('themes.css', 'workspace.css', *extra_css))
    return ('<!doctype html><html lang="tr"><head><meta charset="utf-8"><link rel="icon" href="icon48.png">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<meta name="color-scheme" content="light dark"><link rel="manifest" href="app.webmanifest">'
            '<meta name="theme-color" content="#0b1b42">'
            f'<meta http-equiv="Content-Security-Policy" content="{CSP}">'
            f'<title>{title}</title>{css}<script src="theme.js"></script></head>')

def appbar(current):
    cur = ' aria-current="page"'
    def text(label, short):
        return label if label == short else f'<span class="l-long">{label}</span><span class="l-short">{short}</span>'
    links = ''.join(f'<a href="{href}"{cur if href == current else ""}>{icon(ic)}{text(label, short)}</a>' for href, label, short, ic in NAV)
    return ('<header class="appbar"><div class="appbar-in">'
            '<a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">§</span>'
            f'<span class="brand-text"><strong>Word ↔ UDF</strong><small class="brand-sub">Hukuk dilekçesi stüdyosu</small><small class="brand-page">{SUBTITLE[current]}</small></span></a>'
            f'<nav class="appnav" aria-label="Bölümler">{links}</nav>'
            '<div class="appbar-end">'
            f'<button type="button" class="cmd-btn" id="cmdOpen" aria-haspopup="dialog" aria-keyshortcuts="Control+K" title="Komut ara (Ctrl+K)">{icon("i-search")}<span class="cmd-label">Komut ara</span><kbd>Ctrl K</kbd></button>'
            '<button type="button" class="theme-toggle" id="themeToggle" aria-label="Tema">'
            f'{icon("i-auto", "icon t-auto")}{icon("i-sun", "icon t-light")}{icon("i-moon", "icon t-dark")}</button>'
            f'<span class="version" title="Sürüm">v{VERSION}</span></div></div></header>')

def tabbar(current):
    """Bottom tab bar on phones (the app bar's links are hidden there)."""
    cur = ' aria-current="page"'
    links = ''.join(f'<a href="{href}"{cur if href == current else ""}>{icon(ic)}<span>{short}</span></a>' for href, label, short, ic in NAV)
    return f'<nav class="tabbar" aria-label="Sayfalar (alt çubuk)">{links}</nav>'

FOOTER = ('<footer class="app-foot">'
          f'<span class="foot-safe">{icon("i-lock")}İnternet bağlantısı yok · izin yok · belgeler cihazdan çıkmaz</span>'
          f'<span class="foot-ver">Word ↔ UDF v{VERSION} · <a href="index.html">Ana sayfa</a></span></footer>')

PAGES = {
    'workspace.html': ('Word → UDF Dönüştürücü', ()),
    'templates.html': ('Şablondan Dilekçe', ()),
    'reverse.html': ('UDF → Word / PDF', ('reverse.css',)),
    'sure.html': ('Süre hesabı', ()),
    'index.html': ('Word ↔ UDF', ()),
}

def main():
    sprite = (SRC / 'sprite.svg').read_text(encoding='utf-8').strip()
    for name, (title, css) in PAGES.items():
        body = (SRC / f'{name[:-5]}.body.html').read_text(encoding='utf-8').strip().replace('{{VERSION}}', VERSION)
        assert body.count('</main>') == 1, f'{name}: tek bir <main> bekleniyor'
        body = body.replace('</main>', FOOTER + '</main>')
        scripts = re.findall(r'<script src="[^"]+"></script>', body)
        # ui.js (toasts, command palette, shared helpers) runs before the page's own scripts.
        html = head(title, css) + '<body>' + sprite + appbar(name) + '<script src="ui.js"></script>' + body + tabbar(name) + '</body></html>\n'
        assert 'style="' not in html, f'{name}: inline style would violate the CSP'
        assert '<script>' not in html, f'{name}: inline script would violate the CSP'
        (ROOT / name).write_text(html, encoding='utf-8')
        print(f'{name}: {len(html)} bayt, {len(scripts) + 1} betik')

if __name__ == '__main__':
    main()
