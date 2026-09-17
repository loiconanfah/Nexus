# -*- coding: utf-8 -*-
"""Brochure Lenexux — 4 pages A4, registre marketing.

Tout est vectoriel : le logo, les icônes, la constellation de fond et le code QR.
Aucune image matricielle, donc un PDF net à toute taille et un fichier léger.
"""
import io
import math
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
QR = io.open(os.path.join(HERE, 'qr-path.txt'), encoding='utf-8').read().strip()

# ── Marque ────────────────────────────────────────────────────────────────────
INK_PATH = ('M295 660H408V1222H706L860 1000L688 754H538L481 660H728L907 917L1075 660H1197'
            'L973 1000L1197 1340H1068L907 1087L732 1340H295Z')
ACC_PATH = ('M458 784H554L706 1000L572 1195H473L611 1000Z M590 784H674L824 1000L691 1195H608'
            'L741 1000Z M765 660H846L945 803L906 866Z M906 1139L945 1200L850 1340H766Z')

INK = '#0d0d0d'
CYAN = '#16b3ce'
DEEP = '#0b7f94'
PALE = '#e7f5f8'
MUTED = '#5b6870'


def mark(ink=INK, acc=CYAN, w=54):
    h = round(w / (925 / 700), 2)
    return (f'<svg class="mk" width="{w}" height="{h}" viewBox="285 650 925 700" aria-hidden="true">'
            f'<path fill="{ink}" d="{INK_PATH}"/><path fill="{acc}" d="{ACC_PATH}"/></svg>')


def lockup(w=54, word=34, ink=INK, acc=CYAN, color=None, tagline=True):
    c = color or ink
    tag = ('<span class="lock-tag">Intelligence des dépendances<br>et d’impact opérationnel</span>'
           if tagline else '')
    return (f'<div class="lock"><div class="lock-top">{mark(ink, acc, w)}'
            f'<b style="font-size:{word}px;color:{c}">Lenexux</b></div>{tag}</div>')


# ── Icônes (trait, 24×24) ─────────────────────────────────────────────────────
ICONS = {
    'graph':    '<circle cx="5" cy="6" r="2.4"/><circle cx="19" cy="7" r="2.4"/><circle cx="12" cy="18" r="2.4"/><path d="M7 7.6 17 8.4M6.3 8.2 10.7 15.9M17.8 9.2 13.4 16.1"/>',
    'server':   '<rect x="3.5" y="4" width="17" height="6" rx="1.6"/><rect x="3.5" y="14" width="17" height="6" rx="1.6"/><path d="M7 7h.01M7 17h.01"/>',
    'database': '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
    'cloud':    '<path d="M7 18.5h10.2a3.8 3.8 0 0 0 .4-7.6 5.6 5.6 0 0 0-10.8-1.3A4.4 4.4 0 0 0 7 18.5Z"/>',
    'app':      '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 9h18M6.5 6.7h.01M9 6.7h.01"/>',
    'users':    '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 5.6a3.2 3.2 0 0 1 0 6M17.5 14.9c1.8.6 3 2.4 3 4.6"/>',
    'process':  '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.6M12 17.9v2.6M20.5 12h-2.6M6.1 12H3.5M18 6l-1.8 1.8M7.8 16.2 6 18M18 18l-1.8-1.8M7.8 7.8 6 6"/>',
    'chart':    '<path d="M4 20h16"/><rect x="5.5" y="12" width="3.4" height="5"/><rect x="10.3" y="8" width="3.4" height="9"/><rect x="15.1" y="4.5" width="3.4" height="12.5"/>',
    'shield':   '<path d="M12 3.2 5 6v6c0 4 3 7.2 7 8.8 4-1.6 7-4.8 7-8.8V6Z"/><path d="m9 12 2.2 2.2L15.4 10"/>',
    'brain':    '<path d="M12 5.2a3.2 3.2 0 0 0-5.8 1.9A3 3 0 0 0 5 12a3 3 0 0 0 1.6 5.2 3.1 3.1 0 0 0 5.4 1.4Z"/><path d="M12 5.2a3.2 3.2 0 0 1 5.8 1.9A3 3 0 0 1 19 12a3 3 0 0 1-1.6 5.2A3.1 3.1 0 0 1 12 18.6Z"/><path d="M12 5.2v13.4"/>',
    'eye':      '<path d="M2.6 12S6 6.2 12 6.2 21.4 12 21.4 12 18 17.8 12 17.8 2.6 12 2.6 12Z"/><circle cx="12" cy="12" r="2.8"/>',
    'target':   '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/><path d="M12 1.8v3M12 19.2v3M22.2 12h-3M4.8 12h-3"/>',
    'play':     '<circle cx="12" cy="12" r="8.4"/><path d="m10.2 8.6 5.4 3.4-5.4 3.4Z"/>',
    'clock':    '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.2V12l3.2 2"/>',
    'bolt':     '<path d="M13.2 2.8 5.4 13.4h5.6l-.6 7.8 7.8-10.6h-5.6Z"/>',
    'down':     '<path d="M12 4v11M7.4 10.6 12 15.2l4.6-4.6M4.5 19.5h15"/>',
    'lock':     '<rect x="4.8" y="10.4" width="14.4" height="9.4" rx="2"/><path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6"/>',
    'file':     '<path d="M13.6 3.2H7a2 2 0 0 0-2 2v13.6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.6Z"/><path d="M13.4 3.4v5.2h5.4M8.4 13h7M8.4 16.4h5"/>',
    'building': '<rect x="4.5" y="4" width="15" height="16" rx="1.6"/><path d="M8.2 8h.01M12 8h.01M15.8 8h.01M8.2 12h.01M12 12h.01M15.8 12h.01M10.2 20v-4h3.6v4"/>',
    'link':     '<path d="M10 13.8a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7l-1.5 1.5"/><path d="M14 10.2a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.5-1.5"/>',
    'money':    '<circle cx="12" cy="12" r="8.4"/><path d="M12 6.8v10.4M14.6 9.4a2.8 2.8 0 0 0-2.6-1.4c-1.6 0-2.8.9-2.8 2.2 0 3 5.6 1.6 5.6 4.4 0 1.4-1.3 2.3-3 2.3a3 3 0 0 1-2.8-1.6"/>',
}


def icon(name, size=24, color=CYAN, stroke=1.7):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" '
            f'stroke="{color}" stroke-width="{stroke}" stroke-linecap="round" '
            f'stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>')


def badge(name, size=48, icon_size=22):
    return f'<span class="badge" style="width:{size}px;height:{size}px">{icon(name, icon_size)}</span>'


# ── Constellation de dépendances ──────────────────────────────────────────────
def constellation(width=760, height=760, seed=7, nodes=54, cx=None, cy=None):
    """Nuage de nœuds reliés, dense au centre — l'image du produit lui-même.

    Les positions suivent une graine fixe : la brochure se régénère à l'identique.
    """
    rnd = random.Random(seed)
    cx = width * 0.52 if cx is None else cx
    cy = height * 0.5 if cy is None else cy
    radius = min(width, height) * 0.46

    pts = []
    for _ in range(nodes):
        # Distribution en disque, légèrement plus dense au centre.
        a = rnd.uniform(0, math.tau)
        r = radius * (rnd.random() ** 0.62)
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r * 0.94, rnd.random()))

    # Arcs : chaque nœud rejoint ses deux plus proches voisins, en courbe douce.
    edges = []
    for i, (x1, y1, _) in enumerate(pts):
        near = sorted(
            ((math.dist((x1, y1), (x2, y2)), j) for j, (x2, y2, _) in enumerate(pts) if j != i)
        )[:3]
        for dist, j in near:
            if (j, i) in edges or (i, j) in edges or dist > radius * 0.5:
                continue
            edges.append((i, j))

    parts = [
        '<defs>'
        '<radialGradient id="halo" cx="50%" cy="50%">'
        f'<stop offset="0%" stop-color="{CYAN}" stop-opacity=".30"/>'
        f'<stop offset="55%" stop-color="{CYAN}" stop-opacity=".07"/>'
        f'<stop offset="100%" stop-color="{CYAN}" stop-opacity="0"/>'
        '</radialGradient>'
        '<radialGradient id="dot" cx="50%" cy="50%">'
        f'<stop offset="0%" stop-color="{CYAN}" stop-opacity=".55"/>'
        f'<stop offset="100%" stop-color="{CYAN}" stop-opacity="0"/>'
        '</radialGradient>'
        '</defs>',
        f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{radius * 1.5:.0f}" fill="url(#halo)"/>',
    ]

    # Anneaux d'orbite : ils donnent la profondeur sans image.
    for k, rr in enumerate((0.55, 0.78, 1.0)):
        parts.append(
            f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{radius * rr:.0f}" ry="{radius * rr * 0.93:.0f}" '
            f'fill="none" stroke="{CYAN}" stroke-opacity="{0.20 - k * 0.05:.2f}" stroke-width="1"/>'
        )

    for i, j in edges:
        x1, y1, _ = pts[i]
        x2, y2, _ = pts[j]
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        # Courbure vers le centre : les liens épousent la forme du nuage.
        qx, qy = mx + (cx - mx) * 0.14, my + (cy - my) * 0.14
        parts.append(
            f'<path d="M{x1:.0f} {y1:.0f} Q{qx:.0f} {qy:.0f} {x2:.0f} {y2:.0f}" fill="none" '
            f'stroke="{CYAN}" stroke-opacity=".30" stroke-width="1"/>'
        )

    for x, y, w in pts:
        r = 2.0 + w * 4.2
        parts.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r * 3.4:.1f}" fill="url(#dot)"/>')
        col = INK if w > 0.82 else CYAN
        parts.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.1f}" fill="{col}" '
                     f'fill-opacity="{0.55 + w * 0.45:.2f}"/>')

    return (f'<svg class="constel" viewBox="0 0 {width} {height}" aria-hidden="true">'
            + ''.join(parts) + '</svg>')


# ── Fragments réutilisés ──────────────────────────────────────────────────────
def head(num, total='04', label='Prospectus<br>de présentation'):
    return ('<div class="phead">'
            f'<span class="phead-l"><i></i>{label}</span>'
            f'<span class="phead-n">{num}/{total}</span></div>')


def foot(left, right):
    return f'<div class="pfoot"><span>{left}</span><span>{right}</span></div>'


def step(n, ic, title, body):
    return (f'<div class="step">{badge(ic, 54, 24)}'
            f'<b>{n}. {title}</b><span>{body}</span></div>')


def family(title, items):
    lis = ''.join(f'<li>{it}</li>' for it in items)
    return f'<div class="fam"><b>{title}</b><ul>{lis}</ul></div>'


def card(ic, title, body):
    return (f'<div class="card">{badge(ic, 46, 21)}<b>{title}</b><span>{body}</span></div>')


def stat(ic, value, label):
    return (f'<div class="stat">{icon(ic, 26, DEEP, 1.6)}<b>{value}</b><span>{label}</span></div>')


def chain(items):
    out = []
    for k, (ic, label) in enumerate(items):
        if k:
            out.append('<span class="arrow">→</span>')
        out.append(f'<div class="chain-i">{badge(ic, 46, 21)}<span>{label}</span></div>')
    return '<div class="chain">' + ''.join(out) + '</div>'


CSS = """
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: "Inter", system-ui, sans-serif; color: #0d0d0d; font-size: 10pt; line-height: 1.55; }

  .page { width: 210mm; height: 297mm; position: relative; overflow: hidden;
          page-break-after: always; background: #fff;
          background-image: radial-gradient(120% 70% at 88% 4%, #eef8fb 0%, #ffffff 58%); }
  .page:last-child { page-break-after: auto; }
  .inner { position: relative; z-index: 2; height: 100%; padding: 16mm 15mm 13mm; display: flex; flex-direction: column; }

  .constel { position: absolute; z-index: 1; pointer-events: none; width: 100%; height: 100%;
             -webkit-mask-image: radial-gradient(closest-side, #000 52%, transparent 96%);
             mask-image: radial-gradient(closest-side, #000 52%, transparent 96%); }

  /* En-tête et pied de page communs */
  .phead { display: flex; align-items: flex-start; justify-content: flex-end; gap: 14px; }
  .phead-l { font-family: "JetBrains Mono"; font-size: 7pt; letter-spacing: .16em; text-transform: uppercase;
             color: #37424a; text-align: right; line-height: 1.7; position: relative; }
  .phead-l i { position: absolute; left: -40px; top: 7px; width: 28px; height: 1.5px; background: #0d0d0d; }
  .phead-n { font-family: "Geist"; font-weight: 500; font-size: 15pt; color: #16b3ce; letter-spacing: .02em; }
  .pfoot { margin-top: auto; padding-top: 7mm; display: flex; justify-content: space-between; gap: 20px;
           font-family: "JetBrains Mono"; font-size: 6.6pt; letter-spacing: .13em; text-transform: uppercase;
           color: #8a97a0; border-top: 1px solid #e3edf0; }

  /* Verrou logo + nom */
  .lock-top { display: flex; align-items: center; gap: 14px; }
  .lock-top b { font-family: "Geist"; font-weight: 700; letter-spacing: -.035em; line-height: 1; }
  .lock-tag { display: block; margin-top: 9px; font-family: "Inter"; font-weight: 400; font-size: 8.4pt;
              letter-spacing: .22em; color: #5b6870; line-height: 1.7; text-transform: none; }

  h1 { font-family: "Geist"; font-weight: 700; letter-spacing: -.035em; line-height: 1.04; margin: 0; }
  h1 em { font-style: normal; color: #16b3ce; }
  h2 { font-family: "Geist"; font-weight: 700; font-size: 25pt; letter-spacing: -.035em; line-height: 1.06; margin: 0 0 10px; }
  h2 em { font-style: normal; color: #16b3ce; }
  .sub { font-size: 10.4pt; color: #37424a; line-height: 1.6; max-width: 105mm; margin: 0; }
  .eyebrow { font-family: "JetBrains Mono"; font-size: 7.2pt; letter-spacing: .18em; text-transform: uppercase;
             color: #0b7f94; margin: 0 0 8px; }
  .rule { width: 34px; height: 3px; background: #16b3ce; margin-bottom: 14px; }

  .badge { display: inline-grid; place-items: center; border-radius: 50%;
           background: #eaf6f9; border: 1px solid #d5ebf1; flex-shrink: 0; }

  /* Page 1 */
  .cover-cta { font-family: "JetBrains Mono"; font-size: 7.4pt; letter-spacing: .2em; text-transform: uppercase;
               color: #5b6870; line-height: 2; }
  .cover-lines { margin-top: 16px; font-family: "Geist"; font-weight: 500; font-size: 12.5pt; color: #37424a; line-height: 1.75; }
  .cover-lines span { color: #0d0d0d; }

  /* Deux colonnes numérotées */
  .duo { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-top: 8mm; }
  .duo > div { padding: 0 18px; border-left: 1px solid #e3edf0; }
  .duo > div:first-child { padding-left: 0; border-left: 0; }
  .num { font-family: "Geist"; font-weight: 500; font-size: 19pt; color: #bcd9e2; line-height: 1; }
  .duo b { font-family: "Geist"; font-weight: 600; font-size: 12pt; display: block; margin: 6px 0 7px; }
  .duo p { font-size: 9.2pt; color: #5b6870; margin: 0; line-height: 1.6; }

  /* Étapes */
  .steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 6mm; }
  .step { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 7px; }
  .step b { font-family: "Geist"; font-weight: 600; font-size: 9.6pt; }
  .step span { font-size: 8.2pt; color: #5b6870; line-height: 1.5; }

  /* Chaîne d'exemple */
  .chain { display: flex; align-items: flex-start; justify-content: space-between; gap: 4px; margin-top: 5mm; }
  .chain-i { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 62px; text-align: center; }
  .chain-i span { font-size: 7.4pt; color: #37424a; line-height: 1.35; }
  .arrow { color: #a8ccd7; font-size: 12pt; margin-top: 14px; }

  /* Cartes de capacités */
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 3.5mm; }
  .card { border: 1px solid #e3edf0; border-radius: 10px; padding: 11px 12px 12px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fcfd 100%); }
  .card b { font-family: "Geist"; font-weight: 600; font-size: 9.6pt; display: block; margin: 7px 0 4px; }
  .card span { font-size: 8.1pt; color: #5b6870; line-height: 1.5; display: block; }

  /* Catalogue complet des capacités */
  .fams { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; margin-top: 4mm; }
  .fam { padding: 0 9px; border-left: 1px solid #e3edf0; }
  .fam:first-child { padding-left: 0; border-left: 0; }
  .fam b { font-family: "JetBrains Mono"; font-size: 6.8pt; letter-spacing: .13em;
           text-transform: uppercase; color: #0b7f94; display: block; margin-bottom: 6px; }
  .fam ul { list-style: none; margin: 0; padding: 0; }
  .fam li { font-size: 7.6pt; color: #37424a; line-height: 1.45; padding: 1.8px 0 1.8px 9px; position: relative; }
  .fam li::before { content: ""; position: absolute; left: 0; top: 9px; width: 3px; height: 3px;
                    border-radius: 50%; background: #16b3ce; }

  /* Bandeau de chiffres */
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 4mm;
           border: 1px solid #dceaee; border-radius: 12px; background: #f6fbfc; overflow: hidden; }
  .stat { padding: 11px 10px; text-align: center; border-left: 1px solid #e3edf0;
          display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .stat:first-child { border-left: 0; }
  .stat b { font-family: "Geist"; font-weight: 700; font-size: 19pt; letter-spacing: -.03em; line-height: 1.1; }
  .stat span { font-family: "JetBrains Mono"; font-size: 6.6pt; letter-spacing: .13em;
               text-transform: uppercase; color: #5b6870; }

  /* Bandeau public visé */
  .who { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0; margin-top: 4mm; }
  .who > div { text-align: center; padding: 0 5px; border-left: 1px solid #e8f0f2;
               display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .who > div:first-child { border-left: 0; }
  .who span { font-size: 7.6pt; color: #37424a; line-height: 1.3; }

  /* Page 4 */
  .points { margin-top: 6mm; display: grid; gap: 8px; }
  .point { display: flex; align-items: center; gap: 13px; font-family: "Geist"; font-weight: 500; font-size: 12pt; }
  .cta { margin-top: 6mm; display: inline-flex; align-items: center; gap: 14px;
         background: #0d0d0d; color: #fff; border-radius: 999px; padding: 13px 26px;
         font-family: "Geist"; font-weight: 600; font-size: 12pt; }
  .cta i { font-style: normal; color: #22c9e4; font-size: 14pt; }
  .cta-note { margin-top: 10px; font-family: "JetBrains Mono"; font-size: 7.4pt;
              letter-spacing: .16em; text-transform: uppercase; color: #5b6870; }

  .trust { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; margin-top: auto;
           border-top: 1px solid #e3edf0; border-bottom: 1px solid #e3edf0; padding: 11px 0; }
  .trust > div { display: flex; align-items: center; gap: 9px; padding: 0 10px; border-left: 1px solid #eef4f6; }
  .trust > div:first-child { border-left: 0; padding-left: 0; }
  .trust span { font-size: 7.8pt; color: #37424a; line-height: 1.35; }

  .endband { position: absolute; left: 0; right: 0; bottom: 0; z-index: 3; background: #0d0d0d; color: #fff;
             padding: 9mm 15mm; display: flex; align-items: center; justify-content: space-between; gap: 22px; }
  .endband .who-b { font-family: "Geist"; font-weight: 600; font-size: 11pt; }
  .endband .who-b span { display: block; font-family: "JetBrains Mono"; font-weight: 400;
                         font-size: 7.6pt; color: #8fa0a6; margin-top: 6px; line-height: 1.8; }
  .endband .who-b span em { font-style: normal; color: #22c9e4; }
  .qr { background: #fff; padding: 6px; border-radius: 4px; }
  .qr svg { width: 21mm; height: 21mm; display: block; }
"""


def build():
    p1_art = constellation(820, 820, seed=11, nodes=74)
    p4_art = constellation(700, 700, seed=23, nodes=58)

    page1 = f'''
<div class="page">
  <div style="position:absolute;right:-64mm;top:62mm;width:215mm;height:215mm;z-index:1">{p1_art}</div>
  <div class="inner">
    {head('01')}
    <div style="margin-top:14mm">{lockup(w=78, word=50)}</div>
    <div class="rule" style="margin-top:16mm"></div>
    <h1 style="font-size:31pt;max-width:120mm">La plateforme qui transforme le risque
      opérationnel invisible <em>en décisions chiffrées.</em></h1>
    <div class="cover-lines">
      <span>Cartographier</span> les dépendances.<br>
      <span>Simuler</span> les pannes et les attaques.<br>
      <span>Décider</span> avec des montants, pas des intuitions.
    </div>
    <div style="margin-top:auto">
      <div class="rule" style="width:28px;height:2px;margin-bottom:10px"></div>
      <div class="cover-cta">Des organisations plus résilientes.<br>Des décisions enfin chiffrées.</div>
    </div>
    {foot('Lenexux · SplitsPay inc.', 'lenexux.com')}
  </div>
</div>'''

    page2 = f'''
<div class="page">
  <div class="inner">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px">
      {lockup(w=46, word=27)}
      {head('02')}
    </div>

    <div style="display:grid;grid-template-columns:1.05fr .85fr;gap:14px;align-items:center;margin-top:11mm">
      <div>
        <h2 style="font-size:23pt">Tout est relié,<br><em>mais personne n’a la carte.</em></h2>
        <p class="sub">Vos activités reposent sur des applications, des serveurs, des fournisseurs,
          des données et des personnes clés. Ces dépendances vivent dans des outils séparés,
          et presque jamais au même endroit.</p>
        <p style="margin-top:12px;font-family:JetBrains Mono;font-size:7.2pt;letter-spacing:.17em;
                  text-transform:uppercase;color:#8a97a0;line-height:1.9">Des liens aujourd’hui invisibles.<br>
          Des décisions possibles demain.</p>
      </div>
      <div style="position:relative;height:62mm">
        <div style="position:absolute;inset:-14mm -6mm">{constellation(560, 560, seed=5, nodes=40)}</div>
      </div>
    </div>

    <div class="duo">
      <div>
        <div class="num">01</div><b>Le constat</b>
        <p>Les dépendances sont dispersées dans de multiples sources, souvent incomplètes
          et difficiles à relier. Personne n’a de vision fiable de l’ensemble — et surtout
          pas de ce qui n’a aucune solution de repli.</p>
      </div>
      <div>
        <div class="num">02</div><b>Ce qu’est Lenexux</b>
        <p>Une couche d’intelligence au-dessus de vos outils : elle relie, analyse et chiffre
          vos dépendances opérationnelles, sans rien remplacer et sans accès privilégié
          à vos systèmes.</p>
      </div>
    </div>

    <div style="margin-top:9mm">
      <div class="num">03</div>
      <b style="font-family:Geist;font-weight:600;font-size:12pt;display:block;margin:6px 0 0">Comment ça fonctionne</b>
      <div class="steps">
        {step(1, 'down', 'Importer', 'Un export CSV suffit. Aucun accès à vos systèmes.')}
        {step(2, 'graph', 'Cartographier', 'Systèmes, fournisseurs et personnes en une seule carte.')}
        {step(3, 'shield', 'Révéler', 'Points uniques de défaillance et rayon d’impact.')}
        {step(4, 'play', 'Simuler', 'Pannes, cyberattaques et décisions, rejouées.')}
        {step(5, 'target', 'Décider', 'Actions priorisées et rapport exécutif.')}
      </div>
    </div>

    <div style="margin-top:9mm">
      <p class="eyebrow">Un exemple concret</p>
      {chain([('cloud', 'Fournisseur cloud'), ('server', 'Serveur'), ('database', 'Base de données'),
            ('app', 'Application'), ('users', 'Équipe'), ('process', 'Processus métier'), ('money', 'Revenus')])}
      <p style="text-align:center;margin-top:9px;font-size:9pt;color:#0b7f94">
        Une seule dépendance peut arrêter une chaîne entière — et personne ne l’avait vue.</p>
    </div>

    {foot('Lenexux · Intelligence des dépendances', 'Cartographier · Simuler · Décider')}
  </div>
</div>'''

    page3 = f'''
<div class="page">
  <div class="inner">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px">
      {lockup(w=46, word=27)}
      {head('03')}
    </div>

    <div style="margin-top:10mm">
      <h2 style="font-size:27pt">De la donnée <em>à la décision</em></h2>
      <p style="font-family:Geist;font-weight:500;font-size:12.5pt;color:#0b7f94;margin:6px 0 0;
                letter-spacing:.01em">Voir. Comprendre. Anticiper. Décider.</p>
      <p class="sub" style="margin-top:10px;max-width:125mm">Lenexux transforme la complexité de vos
        dépendances en analyses claires, en simulations réalistes et en décisions chiffrées —
        en affichant toujours le degré de confiance de ce qu’il avance.</p>
    </div>

    <div class="cards">
      {card('graph', 'Graphe et jumeau numérique', 'Vos dépendances en 2D et en 3D, avec l’historique daté de chaque changement.')}
      {card('shield', 'Score de risque explicable', 'Un score décomposé en six facteurs mesurables, et les points uniques de défaillance.')}
      {card('play', 'Simulation et cyberattaque', 'Rejouez une panne ou une intrusion : cascade, temps de reprise, contre-mesures.')}
      {card('money', 'Impact et modèle d’entreprise', 'Vos revenus, coûts et effectifs convertissent une panne technique en dollars.')}
      {card('users', 'Fournisseurs et personnes', 'Concentration des fournisseurs, et savoirs détenus par une seule personne.')}
      {card('file', 'Confiance et preuves', 'Chaque dépendance affiche d’où vient l’information et à quel point elle est sûre.')}
    </div>

    <div style="margin-top:4.5mm">
      <p class="eyebrow">Les vingt-cinq écrans de la plateforme</p>
      <div class="fams">
        {family('Intelligence', ['Tableau de bord', 'Modèle d’entreprise', 'Décision &amp; simulation',
                                 'Impact transversal', 'Graphe de dépendances', 'Jumeau numérique',
                                 'Historique du jumeau'])}
        {family('Analyse', ['Dépendances', 'Centre de risques', 'Alerte anticipée',
                            'Simulation d’attaque', 'Impact de changement', 'Confiance &amp; audit'])}
        {family('Résilience', ['Fournisseurs', 'Dépendances humaines', 'Plan d’action',
                               'Simulations « et si ? »'])}
        {family('Connaissance', ['Analyste IA', 'Extraction documentaire', 'Rapports exécutifs'])}
        {family('Données', ['Inventaire des actifs', 'Import &amp; intégration',
                            'Dépendances inférées', 'Connecteurs &amp; sonde'])}
      </div>
    </div>

    <div style="margin-top:5mm">
      <p class="eyebrow">Exemple illustratif — panne d’un fournisseur d’identité</p>
      <div class="stats">
        {stat('app', '16', 'éléments impactés')}
        {stat('money', '1,70 M$', 'impact attendu')}
        {stat('clock', '4,9 h', 'temps de reprise')}
        {stat('shield', '88 %', 'confiance du calcul')}
      </div>
      <p style="font-size:7.8pt;color:#8a97a0;margin-top:7px;font-style:italic">
        Chiffres issus du jeu de démonstration fourni avec la plateforme, reproductibles en séance.</p>
    </div>

    {foot('Lenexux · Des décisions appuyées sur des preuves', 'Système Lenexux · Dépendances · Impact')}
  </div>
</div>'''

    page4 = f'''
<div class="page">
  <div style="position:absolute;right:-52mm;top:52mm;width:185mm;height:185mm;z-index:1">{p4_art}</div>
  <div class="inner" style="padding-bottom:46mm">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px">
      {lockup(w=62, word=40)}
      {head('04')}
    </div>

    <div style="margin-top:14mm;max-width:112mm">
      <h1 style="font-size:28pt">Anticiper avant que<br><em>l’activité n’en pâtisse.</em></h1>
      <p class="sub" style="margin-top:14px">Lenexux relie la donnée, le risque et la décision dans une
        seule plateforme d’intelligence des dépendances — déterministe, explicable, et honnête
        sur ce qu’elle ne sait pas.</p>

      <div class="points">
        <div class="point">{badge('eye', 44, 21)} Voir les dépendances</div>
        <div class="point">{badge('chart', 44, 21)} Mesurer les fragilités</div>
        <div class="point">{badge('play', 44, 21)} Simuler les scénarios</div>
        <div class="point">{badge('target', 44, 21)} Prioriser les actions</div>
      </div>

      <div class="cta">Demander une démonstration <i>→</i></div>
      <div class="cta-note">Cartographier. Simuler. Décider.</div>
    </div>

    <div style="margin-top:7mm">
      <p class="eyebrow">Une solution pour tous les acteurs de l’organisation</p>
      <div class="who">
        <div>{icon('building', 22, DEEP, 1.6)}<span>Direction<br>générale</span></div>
        <div>{icon('server', 22, DEEP, 1.6)}<span>DSI / IT</span></div>
        <div>{icon('lock', 22, DEEP, 1.6)}<span>Cybersécurité</span></div>
        <div>{icon('process', 22, DEEP, 1.6)}<span>Continuité /<br>résilience</span></div>
        <div>{icon('shield', 22, DEEP, 1.6)}<span>Gestion<br>des risques</span></div>
        <div>{icon('money', 22, DEEP, 1.6)}<span>Finance</span></div>
        <div>{icon('chart', 22, DEEP, 1.6)}<span>Opérations</span></div>
      </div>
    </div>

    <div class="trust">
      <div>{icon('brain', 22, DEEP, 1.6)}<span>IA explicable,<br>jamais inventive</span></div>
      <div>{icon('down', 22, DEEP, 1.6)}<span>Import simple,<br>sans accès privilégié</span></div>
      <div>{icon('server', 22, DEEP, 1.6)}<span>Sonde interne,<br>aucun port ouvert</span></div>
      <div>{icon('users', 22, DEEP, 1.6)}<span>Comptes, rôles<br>et SSO Entra ID</span></div>
      <div>{icon('file', 22, DEEP, 1.6)}<span>Pensé pour la<br>Loi 25 et le RGPD</span></div>
    </div>
  </div>

  <div class="endband">
    <div style="display:flex;align-items:center;gap:16px">
      {mark('#ffffff', '#22c9e4', 46)}
      <div class="who-b">Lenexux
        <span>Yvan Loic Nanfah Wamba · SPLITSPAY INC.<br>
        <em>yvanloic@lenexux.com</em> · lenexux.com</span>
      </div>
    </div>
    <div class="qr"><svg viewBox="0 0 29 29"><path fill="#0d0d0d" d="{QR}"/></svg></div>
  </div>
</div>'''

    html = (
        '<!doctype html>\n<html lang="fr"><head><meta charset="utf-8">'
        '<title>Brochure Lenexux</title>'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
        'family=Geist:wght@400;500;600;700&family=Inter:wght@400;500;600&'
        'family=JetBrains+Mono:wght@400;500&display=block">'
        f'<style>{CSS}</style></head><body>'
        + page1 + page2 + page3 + page4 +
        '</body></html>\n'
    )
    out = os.path.join(HERE, 'brochure.html')
    io.open(out, 'w', encoding='utf-8').write(html)
    print('écrit :', out, len(html), 'octets')


if __name__ == '__main__':
    build()
