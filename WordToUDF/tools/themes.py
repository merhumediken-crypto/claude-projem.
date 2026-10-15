"""Generates themes.css: the colour palettes of the app (light and dark each).

Run after changing a palette:
    python3 tools/themes.py
Every palette sets the same tokens; workspace.css only uses tokens. The A4
paper stays white with black text in every palette (it shows the printed
document), so only the studio around it changes. The script refuses a
palette whose text colours do not reach WCAG AA contrast (4.5:1) on the
surfaces they are used on.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Shared by every palette unless a palette overrides them.
LIGHT_STATUS = dict(ok='#0f7a50', ok_soft='#e2f4eb', ok_line='#b5dfc9', on_ok='#ffffff',
                    warn='#9a5800', warn_soft='#fbf0dc', warn_line='#efd39f', warn_ring='#dc9a22',
                    danger='#b42318', danger_soft='#fce9e7', danger_line='#f2c3bd')
DARK_STATUS = dict(ok='#5ed3a0', ok_soft='#0f2a22', ok_line='#1f5a46', on_ok='#06261a',
                   warn='#f2b866', warn_soft='#2e2312', warn_line='#5e4719', warn_ring='#f2b866',
                   danger='#ff8c80', danger_soft='#33171a', danger_line='#6b2a24')

# chrome: the app bar, format bar and toasts (always dark); metal: its accent
# (gold, brass…); paper_accent: selection outlines on the white paper.
PALETTES = {
    'lacivert': dict(
        name='Lacivert & Altın', hint='Resmî, mahkeme salonu',
        chrome='#0b1b42', chrome_2='#14286a', chrome_hi='#24438f', chrome_lo='#0e1f4e', chrome_soft='#dce3f2', chrome_muted='#c9d3ea', chrome_faint='#aeb9d3',
        metal='#e2be6e', metal_2='#e9c77b', on_metal='#3a2a06', paper_accent='#2b59d6',
        light=dict(bg='#edf0f6', surface='#ffffff', surface_2='#f6f8fc', surface_3='#e3e8f1', ink='#0e1a33', ink_2='#2e3b57', muted='#56627d', faint='#6b778e',
                   line='#dce2ee', line_2='#c6d0e2', pri='#0e2150', pri_hover='#16306e', pri_ink='#ffffff',
                   accent='#2b59d6', accent_hover='#1f47b5', accent_soft='#e6edfc', accent_soft_2='#cfdcf8', accent_text='#2149b8', on_accent='#ffffff',
                   gold_ink='#8a6418', gold_soft='#f8ebcb', recess='#dce6fb', viewport_bg='#e3e8f1'),
        dark=dict(bg='#070c19', surface='#0f1930', surface_2='#13203b', surface_3='#0b1326', ink='#e9eef8', ink_2='#c4cde0', muted='#9aa7c2', faint='#8391ad',
                  line='#22314f', line_2='#30436a', pri='#e7c77f', pri_hover='#f0d597', pri_ink='#0b1326',
                  accent='#8daeff', accent_hover='#a9c2ff', accent_soft='#16264a', accent_soft_2='#24396a', accent_text='#a9c2ff', on_accent='#0b1326',
                  gold_ink='#e7c77f', gold_soft='#3a2f17', recess='#18284c', viewport_bg='#0b1326')),
    'bordo': dict(
        name='Bordo & Fildişi', hint='Sıcak, köklü büro',
        chrome='#3d0c18', chrome_2='#5a1424', chrome_hi='#7f2236', chrome_lo='#3d0c18', chrome_soft='#f2dfe2', chrome_muted='#e4c6cb', chrome_faint='#d2aab1',
        metal='#d9b06a', metal_2='#e4c084', on_metal='#3a2408', paper_accent='#9b2c42',
        light=dict(bg='#f3ede3', surface='#fffdf9', surface_2='#f8f2e8', surface_3='#ebe2d3', ink='#2b1418', ink_2='#4b2f34', muted='#665054', faint='#6f5a5d',
                   line='#e7dccb', line_2='#d5c4ab', pri='#6e1a2c', pri_hover='#86233a', pri_ink='#ffffff',
                   accent='#9b2c42', accent_hover='#7d2034', accent_soft='#f7e5e7', accent_soft_2='#edc8ce', accent_text='#862538', on_accent='#ffffff',
                   gold_ink='#7d5317', gold_soft='#f2e3c4', recess='#f1dcd6', viewport_bg='#e8dfcf'),
        dark=dict(bg='#120709', surface='#1e0f12', surface_2='#261418', surface_3='#170b0e', ink='#f4e9e4', ink_2='#dccac5', muted='#b8a19d', faint='#a68e8a',
                  line='#3b2227', line_2='#523038', pri='#e4c084', pri_hover='#edd09e', pri_ink='#1a0a0d',
                  accent='#f2909f', accent_hover='#f7adb8', accent_soft='#3a1820', accent_soft_2='#562532', accent_text='#f7adb8', on_accent='#1a0a0d',
                  gold_ink='#e4c084', gold_soft='#3a2a14', recess='#4a2028', viewport_bg='#170b0e', chrome='#2a0810')),
    'zeytin': dict(
        name='Zeytin & Kâğıt', hint='Göz yormayan, sakin',
        chrome='#243218', chrome_2='#34461f', chrome_hi='#4d6632', chrome_lo='#1d2913', chrome_soft='#e6ecd9', chrome_muted='#d3dcc0', chrome_faint='#b9c4a2',
        metal='#d8c47f', metal_2='#e3d297', on_metal='#2e2807', paper_accent='#557a2a',
        light=dict(bg='#edefe4', surface='#fdfdf8', surface_2='#f5f7ec', surface_3='#e3e7d5', ink='#1d2416', ink_2='#37422c', muted='#556048', faint='#5d6850',
                   line='#dce1cc', line_2='#c7cfb1', pri='#34461f', pri_hover='#435a29', pri_ink='#ffffff',
                   accent='#4f7227', accent_hover='#41601f', accent_soft='#e7efd8', accent_soft_2='#d0e0b4', accent_text='#415f1d', on_accent='#ffffff',
                   gold_ink='#6e5a18', gold_soft='#efe6c4', recess='#dfe8cb', viewport_bg='#e0e5d1'),
        dark=dict(bg='#0a0d08', surface='#141a10', surface_2='#1a2215', surface_3='#0f140b', ink='#e8eddf', ink_2='#c8d1b8', muted='#a5b094', faint='#939e82',
                  line='#283220', line_2='#39462d', pri='#d8c47f', pri_hover='#e4d49c', pri_ink='#10140b',
                  accent='#a9cd71', accent_hover='#bfdc90', accent_soft='#1e2a13', accent_soft_2='#2e4020', accent_text='#bfdc90', on_accent='#10140b',
                  gold_ink='#d8c47f', gold_soft='#2d2a14', recess='#26361a', viewport_bg='#0f140b', chrome='#131b0d')),
    'mermer': dict(
        name='Mermer & Pirinç', hint='Damarlı mermer, pirinç',
        chrome='#1f1f22', chrome_2='#2e2e33', chrome_hi='#4a4a52', chrome_lo='#19191c', chrome_soft='#ecebe7', chrome_muted='#d6d4ce', chrome_faint='#bdbab2',
        metal='#d2ac63', metal_2='#ddbd7c', on_metal='#2c1f05', paper_accent='#8b6a1f',
        art=True,
        light=dict(bg='#f1f0ec', surface='#ffffff', surface_2='#f7f6f3', surface_3='#e7e5df', ink='#1c1c1e', ink_2='#39393d', muted='#5e5d63', faint='#67666c',
                   line='#e3e1db', line_2='#cfccc4', pri='#26262a', pri_hover='#3a3a40', pri_ink='#ffffff',
                   accent='#836219', accent_hover='#6b5014', accent_soft='#f4ecd8', accent_soft_2='#e7d6ad', accent_text='#6f5315', on_accent='#ffffff',
                   gold_ink='#765815', gold_soft='#f3e8cd', recess='#ece3cc', viewport_bg='#e6e4de'),
        dark=dict(bg='#0c0c0d', surface='#17171a', surface_2='#1e1e21', surface_3='#111113', ink='#efeeea', ink_2='#d3d1cc', muted='#aaa8a1', faint='#97958f',
                  line='#2b2b2f', line_2='#3c3c42', pri='#ddbd7c', pri_hover='#e8cd98', pri_ink='#121214',
                  accent='#ddbd7c', accent_hover='#e8cd98', accent_soft='#2c2516', accent_soft_2='#463a20', accent_text='#e8cd98', on_accent='#121214',
                  gold_ink='#ddbd7c', gold_soft='#2c2516', recess='#3a3020', viewport_bg='#111113', chrome='#141416')),
    'grafit': dict(
        name='Grafit', hint='Sade, odak; koyuda tam siyah',
        chrome='#1c1f23', chrome_2='#2a2e33', chrome_hi='#40464e', chrome_lo='#16181b', chrome_soft='#e6e9ed', chrome_muted='#cfd3d9', chrome_faint='#b2b8c0',
        metal='#5fd0c8', metal_2='#7fdcd5', on_metal='#032220', paper_accent='#0b7d7a',
        light=dict(bg='#eff0f2', surface='#ffffff', surface_2='#f6f7f8', surface_3='#e5e7ea', ink='#15171a', ink_2='#33373d', muted='#575d66', faint='#5f656e',
                   line='#dfe2e6', line_2='#ccd0d6', pri='#1c1f23', pri_hover='#2d3137', pri_ink='#ffffff',
                   accent='#0a7774', accent_hover='#086360', accent_soft='#ddf2f1', accent_soft_2='#bce4e1', accent_text='#076260', on_accent='#ffffff',
                   gold_ink='#076260', gold_soft='#ddf2f1', recess='#d5ecea', viewport_bg='#e4e6e9'),
        dark=dict(bg='#000000', surface='#0a0b0c', surface_2='#111315', surface_3='#000000', ink='#eceef1', ink_2='#c9cdd3', muted='#9ea4ac', faint='#8b9199',
                  line='#1d2024', line_2='#2b2f34', pri='#5fd0c8', pri_hover='#7fdcd5', pri_ink='#001312',
                  accent='#5fd0c8', accent_hover='#7fdcd5', accent_soft='#0a2322', accent_soft_2='#123b39', accent_text='#7fdcd5', on_accent='#001312',
                  gold_ink='#7fdcd5', gold_soft='#0a2322', recess='#10302e', viewport_bg='#050606', chrome='#000000', chrome_2='#111315')),
    'kontrast': dict(
        name='Güneş · yüksek kontrast', hint='Güneş altında telefondan',
        chrome='#000000', chrome_2='#1a1a1a', chrome_hi='#333333', chrome_lo='#000000', chrome_soft='#ffffff', chrome_muted='#f2f2f2', chrome_faint='#e6e6e6',
        metal='#ffd400', metal_2='#ffe14d', on_metal='#000000', paper_accent='#0037b3',
        light=dict(bg='#ffffff', surface='#ffffff', surface_2='#f2f2f2', surface_3='#e6e6e6', ink='#000000', ink_2='#111111', muted='#2e2e2e', faint='#383838',
                   line='#6b6b6b', line_2='#000000', pri='#000000', pri_hover='#262626', pri_ink='#ffffff',
                   accent='#0037b3', accent_hover='#002a8a', accent_soft='#e3eaff', accent_soft_2='#b3c6ff', accent_text='#002f99', on_accent='#ffffff',
                   gold_ink='#000000', gold_soft='#fff1a8', recess='#c9d6ff', viewport_bg='#d9d9d9',
                   ok='#00613a', warn='#6a3b00', danger='#9a0000'),
        dark=dict(bg='#000000', surface='#000000', surface_2='#0f0f0f', surface_3='#1a1a1a', ink='#ffffff', ink_2='#f5f5f5', muted='#e0e0e0', faint='#d6d6d6',
                  line='#9a9a9a', line_2='#ffffff', pri='#ffd400', pri_hover='#ffe14d', pri_ink='#000000',
                  accent='#8fb8ff', accent_hover='#b3ceff', accent_soft='#0d1a33', accent_soft_2='#1f3566', accent_text='#b3ceff', on_accent='#000000',
                  gold_ink='#ffd400', gold_soft='#332b00', recess='#1f3566', viewport_bg='#141414',
                  ok='#7dffc0', warn='#ffd27a', danger='#ffa59c')),
}
DEFAULT = 'lacivert'

def rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def lum(h):
    def f(c):
        c /= 255; return c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4
    r, g, b = rgb(h); return .2126 * f(r) + .7152 * f(g) + .0722 * f(b)
def contrast(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True); return (x + .05) / (y + .05)
def triple(h):
    return ' '.join(str(c) for c in rgb(h))

# (text, background, minimum)
PAIRS = [('ink', 'surface', 7), ('ink', 'bg', 7), ('muted', 'surface', 4.5), ('muted', 'surface_2', 4.5), ('muted', 'bg', 4.5), ('faint', 'surface', 4.5),
         ('accent_text', 'surface', 4.5), ('accent_text', 'accent_soft', 4.5), ('pri_ink', 'pri', 4.5), ('on_accent', 'accent', 4.5),
         ('gold_ink', 'surface', 4.5), ('gold_ink', 'gold_soft', 4.5), ('ok', 'surface', 4.5), ('ok', 'ok_soft', 4.5), ('warn', 'surface', 4.5),
         ('warn', 'warn_soft', 4.5), ('danger', 'surface', 4.5), ('danger', 'danger_soft', 4.5), ('on_ok', 'ok', 4.5)]
CHROME_PAIRS = [('chrome_ink', 'chrome', 7), ('chrome_soft', 'chrome', 7), ('chrome_muted', 'chrome', 4.5), ('chrome_faint', 'chrome', 4.5),
                ('chrome_faint', 'chrome_2', 4.5), ('on_metal', 'metal', 4.5), ('metal', 'chrome', 4.5), ('metal', 'chrome_2', 3)]

def tokens(p, mode):
    """Full token map of one palette in one mode."""
    t = dict(LIGHT_STATUS if mode == 'light' else DARK_STATUS)
    t.update(chrome_ink='#ffffff')
    for k in ('chrome', 'chrome_2', 'chrome_hi', 'chrome_lo', 'chrome_soft', 'chrome_muted', 'chrome_faint', 'metal', 'metal_2', 'on_metal', 'paper_accent'):
        t[k] = p[k]
    t.update(p[mode])
    t.setdefault('info', t['accent_text']); t.setdefault('info_soft', t['accent_soft']); t.setdefault('info_line', t['accent_soft_2'])
    return t

def check():
    bad = []
    for pid, p in PALETTES.items():
        for mode in ('light', 'dark'):
            t = tokens(p, mode)
            for a, b, need in PAIRS + CHROME_PAIRS:
                c = contrast(t[a], t[b])
                if c < need: bad.append(f'{pid}/{mode}: {a} {t[a]} on {b} {t[b]} = {c:.2f} < {need}')
            if contrast(t['paper_accent'], '#ffffff') < 3: bad.append(f'{pid}: paper_accent on the white paper < 3')
    return bad

MARBLE = {
    # A soft vein texture (feTurbulence) on one fixed layer behind the page (workspace.css body::before):
    # no tile seams, and it stays still while the page scrolls, like a marble wall.
    'light': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='1000'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='turbulence' baseFrequency='.0018 .006' numOctaves='5' seed='11'/%3E%3CfeColorMatrix values='0 0 0 0 .36 0 0 0 0 .35 0 0 0 0 .33 -1.6 0 0 0 .9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23m)' opacity='.3'/%3E%3C/svg%3E\")",
    'dark': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='1000'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='turbulence' baseFrequency='.0018 .006' numOctaves='5' seed='11'/%3E%3CfeColorMatrix values='0 0 0 0 .85 0 0 0 0 .8 0 0 0 0 .7 -1.6 0 0 0 .9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23m)' opacity='.14'/%3E%3C/svg%3E\")",
}

def block(t, mode, art):
    css = lambda k: '--' + k.replace('_', '-')
    out = [f'{css(k)}: {v};' for k, v in t.items()]
    out += [f'--chrome-rgb: {triple(t["chrome"])};', f'--metal-rgb: {triple(t["metal"])};', f'--paper-accent-rgb: {triple(t["paper_accent"])};',
            f'--accent-rgb: {triple(t["accent"])};', f'--ink-rgb: {triple(t["ink"])};',
            f'--glass: rgb({triple(t["surface"])} / {".86" if mode == "light" else ".9"});',
            f'--bg-art: {MARBLE[mode] if art else "none"};',
            # aliases kept for the stylesheet's older names
            '--navy: var(--chrome); --navy-2: var(--chrome-2); --gold: var(--metal); --gold-2: var(--metal-2);',
            f'color-scheme: {mode};']
    if mode == 'dark':
        out.append('--shadow-1: 0 1px 2px rgba(0, 0, 0, .45), 0 14px 36px rgba(0, 0, 0, .45); --shadow-2: 0 18px 40px rgba(0, 0, 0, .5); '
                   '--shadow-3: 0 24px 60px rgba(0, 0, 0, .65); --shadow-pri: 0 6px 18px rgba(0, 0, 0, .45); '
                   '--paper-shadow: 0 2px 6px rgba(0, 0, 0, .5), 0 18px 44px rgba(0, 0, 0, .55); --ring: 0 0 0 3px rgb(var(--accent-rgb) / .5);')
    else:
        out.append('--shadow-1: 0 1px 2px rgb(var(--ink-rgb) / .06), 0 10px 28px rgb(var(--ink-rgb) / .08); --shadow-2: 0 2px 6px rgb(var(--ink-rgb) / .08), 0 18px 40px rgb(var(--ink-rgb) / .12); '
                   '--shadow-3: 0 24px 60px rgb(var(--chrome-rgb) / .28); --shadow-pri: 0 6px 18px rgb(var(--chrome-rgb) / .28); '
                   '--paper-shadow: 0 2px 4px rgba(0, 0, 0, .08), 0 18px 40px rgb(var(--chrome-rgb) / .18); --ring: 0 0 0 3px rgb(var(--accent-rgb) / .35);')
    return '\n  '.join(out)

def main():
    bad = check()
    if bad: raise SystemExit('Yetersiz kontrast:\n' + '\n'.join(bad))
    css = ['/* Generated by tools/themes.py — do not edit by hand. Colour palettes of the app,',
           '   each in a light and a dark mode; the A4 paper stays white in all of them. */']
    for pid, p in PALETTES.items():
        sel = ':root' if pid == DEFAULT else f':root[data-palette="{pid}"]'
        light, dark = tokens(p, 'light'), tokens(p, 'dark')
        art = p.get('art', False)
        css.append(f'{sel}{{\n  {block(light, "light", art)}\n}}')
        dsel = ':root' if pid == DEFAULT else f':root[data-palette="{pid}"]'
        css.append(f'@media (prefers-color-scheme: dark){{\n  {dsel}:not([data-theme="light"]){{\n  {block(dark, "dark", art)}\n  }}\n}}')
        css.append(f'{dsel}[data-theme="dark"]{{\n  {block(dark, "dark", art)}\n}}')
    # Swatches of the theme picker (theme.js).
    for pid, p in PALETTES.items():
        css.append(f'.tp-swatch[data-palette="{pid}"]{{ --sw-chrome: {p["chrome"]}; --sw-metal: {p["metal"]}; --sw-bg: {p["light"]["bg"]}; --sw-accent: {p["light"]["accent"]}; --sw-dark: {p["dark"]["bg"]}; }}')
        if p.get('art'): css.append(f'.tp-swatch[data-palette="{pid}"] .sw-art{{ background-image: {MARBLE["light"]}; background-size: cover; }}')
    (ROOT / 'themes.css').write_text('\n'.join(css) + '\n', encoding='utf-8')
    print(f'themes.css: {len(PALETTES)} tema, açık ve koyu; kontrast denetimi geçti')

if __name__ == '__main__':
    main()
