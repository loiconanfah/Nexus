# -*- coding: utf-8 -*-
"""Pitch deck Lenexux — 16 diapositives 16:9.

Reprend l'identité de la brochure (logo, icônes, constellations) en important
build_brochure. L'histoire du nom vient du fondateur ; tout ce qui décrit le
produit correspond à ce que la plateforme fait réellement aujourd'hui.
"""
import io
import os

import build_brochure as bb

HERE = os.path.dirname(os.path.abspath(__file__))
INK, CYAN, DEEP = bb.INK, bb.CYAN, bb.DEEP
mark, icon, badge, constellation = bb.mark, bb.icon, bb.badge, bb.constellation

TOTAL = 16

CSS = """
  @page { size: 13.333in 7.5in; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: "Inter", system-ui, sans-serif; color: #0d0d0d; font-size: 15px; line-height: 1.5; }

  .s { width: 13.333in; height: 7.5in; position: relative; overflow: hidden; page-break-after: always;
       background: #fff; background-image: radial-gradient(90% 80% at 92% 6%, #eef8fb 0%, #ffffff 55%); }
  .s:last-child { page-break-after: auto; }
  .s.dark { background: #0d0d0d; color: #fff; background-image: radial-gradient(70% 90% at 85% 50%, rgba(34,201,228,.16), rgba(13,13,13,0) 70%); }
  .in { position: relative; z-index: 2; height: 100%; padding: .55in .75in .5in; display: flex; flex-direction: column; }
  .art { position: absolute; z-index: 1; pointer-events: none; }
  .constel { width: 100%; height: 100%; display: block;
             -webkit-mask-image: radial-gradient(closest-side, #000 52%, transparent 96%);
             mask-image: radial-gradient(closest-side, #000 52%, transparent 96%); }

  /* En-tête de diapositive */
  .top { display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 10px; font-family: "Geist"; font-weight: 700;
           font-size: 17px; letter-spacing: -.03em; }
  .pg { font-family: "JetBrains Mono"; font-size: 11px; letter-spacing: .12em; color: #8a97a0; }
  .pg b { color: #16b3ce; font-weight: 500; }
  .dark .pg { color: #6f7f86; }

  .kick { font-family: "JetBrains Mono"; font-size: 12px; letter-spacing: .2em; text-transform: uppercase;
          color: #0b7f94; margin: 0 0 14px; }
  .dark .kick { color: #22c9e4; }
  h1 { font-family: "Geist"; font-weight: 700; letter-spacing: -.04em; line-height: 1.02; margin: 0; }
  h2 { font-family: "Geist"; font-weight: 700; font-size: 42px; letter-spacing: -.035em; line-height: 1.06; margin: 0; }
  h2 em, h1 em { font-style: normal; color: #16b3ce; }
  .dark h2 em, .dark h1 em { color: #22c9e4; }
  .lead { font-size: 18px; line-height: 1.6; color: #37424a; max-width: 7.2in; margin: 18px 0 0; }
  .dark .lead { color: #b8c4c8; }
  .note { font-size: 12px; color: #8a97a0; font-style: italic; }

  .body { flex: 1; display: flex; flex-direction: column; justify-content: center; }

  .badge { display: inline-grid; place-items: center; border-radius: 50%;
           background: #eaf6f9; border: 1px solid #d5ebf1; flex-shrink: 0; }
  .dark .badge { background: rgba(34,201,228,.10); border-color: rgba(34,201,228,.35); }

  /* Chaîne horizontale */
  .chain { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; margin-top: 30px; }
  .ci { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; flex: 1; min-width: 0; }
  .ci span { font-size: 13px; line-height: 1.3; color: #37424a; font-weight: 500; }
  .dark .ci span { color: #dfe7ea; }
  .ci.hot .badge { background: #16b3ce; border-color: #16b3ce; }
  .arw { color: #9fc9d5; font-size: 20px; margin-top: 18px; flex: 0 0 auto; }

  /* Silos */
  .silos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .silo { border: 1.5px dashed #cfdfe4; border-radius: 12px; padding: 14px 16px; background: #fff; }
  .silo b { font-family: "Geist"; font-weight: 700; font-size: 17px; display: block; }
  .silo span { font-size: 13px; color: #5b6870; }

  /* Trio */
  .trio { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; align-items: center; gap: 18px; margin-top: 34px; }
  .tri { text-align: center; }
  .tri b { font-family: "Geist"; font-weight: 700; font-size: 30px; letter-spacing: -.03em; display: block; margin-top: 14px; }
  .tri span { font-size: 14px; color: #5b6870; }
  .dark .tri span { color: #aab6ba; }
  .trio .arw { margin: 0; font-size: 30px; }

  /* Cartes */
  .cards { display: grid; gap: 14px; }
  .card { border: 1px solid #e3edf0; border-radius: 14px; padding: 18px 20px;
          background: linear-gradient(180deg,#fff,#f8fcfd); }
  .card b { font-family: "Geist"; font-weight: 600; font-size: 17px; display: block; margin: 12px 0 6px; }
  .card span { font-size: 13.5px; color: #5b6870; line-height: 1.5; display: block; }
  .card em { font-style: normal; color: #0b7f94; }

  /* Tableau */
  table { width: 100%; border-collapse: collapse; margin-top: 22px; }
  th, td { text-align: left; padding: 11px 14px; border-bottom: 1px solid #eaf0f2; font-size: 14px; vertical-align: top; }
  th { font-family: "JetBrains Mono"; font-size: 11px; letter-spacing: .12em; text-transform: uppercase;
       color: #5b6870; font-weight: 500; border-bottom: 1.5px solid #d7e6ea; }
  td.n { font-family: "Geist"; font-weight: 600; width: 22%; }
  td.m { color: #0b7f94; }

  /* Chiffres */
  .nums { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #dceaee; border-radius: 16px;
          background: #f6fbfc; overflow: hidden; }
  .num { padding: 22px 18px; border-left: 1px solid #e3edf0; text-align: center; }
  .num:first-child { border-left: 0; }
  .num b { font-family: "Geist"; font-weight: 700; font-size: 44px; letter-spacing: -.04em; display: block; line-height: 1; }
  .num span { font-family: "JetBrains Mono"; font-size: 11px; letter-spacing: .12em; text-transform: uppercase;
              color: #5b6870; display: block; margin-top: 10px; }

  .quote { font-family: "Geist"; font-weight: 600; font-size: 30px; letter-spacing: -.025em; line-height: 1.25; }
  .quote em { font-style: normal; color: #16b3ce; }
  .dark .quote em { color: #22c9e4; }

  /* Étymologie */
  .ety { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; margin-top: 30px; }
  .et { padding: 0 26px; border-left: 1px solid #e3edf0; }
  .et:first-child { padding-left: 0; border-left: 0; }
  .et .big { font-family: "Geist"; font-weight: 700; font-size: 60px; letter-spacing: -.05em; line-height: 1; color: #0d0d0d; }
  .et .big em { font-style: normal; color: #16b3ce; }
  .et b { font-family: "Geist"; font-weight: 600; font-size: 18px; display: block; margin-top: 14px; }
  .et span { font-size: 14px; color: #5b6870; line-height: 1.55; display: block; margin-top: 6px; }

  .steps5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-top: 34px; }
  .st { display: flex; flex-direction: column; gap: 10px; }
  .st i { font-family: "JetBrains Mono"; font-style: normal; font-size: 12px; color: #16b3ce; letter-spacing: .1em; }
  .st b { font-family: "Geist"; font-weight: 700; font-size: 22px; letter-spacing: -.02em; }
  .st span { font-size: 13.5px; color: #5b6870; line-height: 1.5; }
  .st .real { font-family: "JetBrains Mono"; font-size: 11px; color: #0b7f94; letter-spacing: .04em; line-height: 1.5; }

  .ask { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 28px; max-width: 9.6in; }
  .ask > div { border-top: 2px solid #16b3ce; padding-top: 16px; }
  .ask b { font-family: "Geist"; font-weight: 700; font-size: 22px; letter-spacing: -.02em; display: block; }
  .ask span { font-size: 14.5px; color: #b8c4c8; line-height: 1.55; display: block; margin-top: 8px; }

  .tag { display: inline-block; font-family: "JetBrains Mono"; font-size: 10.5px; letter-spacing: .1em;
         text-transform: uppercase; padding: 3px 8px; border-radius: 4px; margin-left: 8px; vertical-align: 3px; }
  .t-done { background: #e6f6ee; color: #2e7d5b; }
  .t-now { background: #fff3dc; color: #9a6a12; }
  .t-next { background: #eef4f6; color: #5b6870; }
"""


def top(n, dark=False):
    ink = '#ffffff' if dark else INK
    acc = '#22c9e4' if dark else CYAN
    return (f'<div class="top"><div class="brand" style="color:{ink}">{mark(ink, acc, 30)}Lenexux</div>'
            f'<div class="pg"><b>{n:02d}</b> / {TOTAL}</div></div>')


def slide(n, content, dark=False, art=''):
    cls = 's dark' if dark else 's'
    return f'<section class="{cls}">{art}<div class="in">{top(n, dark)}{content}</div></section>'


def chain(items, hot=None, size=58, isize=26):
    out = []
    for k, (ic, label) in enumerate(items):
        if k:
            out.append('<span class="arw">→</span>')
        cls = 'ci hot' if hot is not None and k in hot else 'ci'
        color = '#ffffff' if hot is not None and k in hot else CYAN
        ico = (f'<span class="badge" style="width:{size}px;height:{size}px">'
               f'{icon(ic, isize, color, 1.7)}</span>')
        out.append(f'<div class="{cls}">{ico}<span>{label}</span></div>')
    return '<div class="chain">' + ''.join(out) + '</div>'


def card(ic, title, body):
    return f'<div class="card">{badge(ic, 46, 21)}<b>{title}</b><span>{body}</span></div>'


def art(left, top_, size, seed, nodes):
    return (f'<div class="art" style="left:{left};top:{top_};width:{size};height:{size}">'
            f'{constellation(800, 800, seed=seed, nodes=nodes)}</div>')


def nexus_hub():
    """Le Nexus : cinq mondes qui se rencontrent en un point."""
    worlds = [('Business', -90), ('IT', -18), ('Cyber', 54), ('IA', 126), ('Finance', 198)]
    import math
    cx, cy, r = 260, 250, 175
    parts = [f'<circle cx="{cx}" cy="{cy}" r="{r + 40}" fill="none" stroke="{CYAN}" stroke-opacity=".12"/>',
             f'<circle cx="{cx}" cy="{cy}" r="{r - 60}" fill="none" stroke="{CYAN}" stroke-opacity=".10" stroke-dasharray="3 6"/>']
    pts = []
    for name, deg in worlds:
        a = math.radians(deg)
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        pts.append((name, x, y))
    for i, (_, x1, y1) in enumerate(pts):
        for _, x2, y2 in pts[i + 1:]:
            parts.append(f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" '
                         f'stroke="{CYAN}" stroke-opacity=".14"/>')
    for name, x, y in pts:
        parts.append(f'<line x1="{cx}" y1="{cy}" x2="{x:.0f}" y2="{y:.0f}" stroke="{CYAN}" stroke-width="2" stroke-opacity=".55"/>')
    for name, x, y in pts:
        parts.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="44" fill="#ffffff" stroke="#cfe6ec" stroke-width="1.5"/>')
        parts.append(f'<text x="{x:.0f}" y="{y + 6:.0f}" text-anchor="middle" font-family="Geist" '
                     f'font-weight="700" font-size="17" fill="{INK}">{name}</text>')
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="74" fill="{CYAN}" fill-opacity=".10"/>')
    parts.append(f'<circle cx="{cx}" cy="{cy}" r="56" fill="{INK}"/>')
    parts.append(f'<g transform="translate({cx - 32} {cy - 24}) scale(0.0692) translate(-285 -650)">'
                 f'<path fill="#ffffff" d="{bb.INK_PATH}"/><path fill="#22c9e4" d="{bb.ACC_PATH}"/></g>')
    return f'<svg viewBox="0 0 520 500" width="100%" height="100%">{"".join(parts)}</svg>'


def decision_x():
    """Deux décisions, deux impacts, une comparaison : le X comme geste de décision."""
    return f'''<svg viewBox="0 0 560 300" width="100%" height="100%">
  <g font-family="Geist" font-weight="600" font-size="17" fill="{INK}">
    <rect x="10" y="40" width="150" height="54" rx="12" fill="#fff" stroke="#cfe6ec"/><text x="85" y="73" text-anchor="middle">Décision A</text>
    <rect x="10" y="206" width="150" height="54" rx="12" fill="#fff" stroke="#cfe6ec"/><text x="85" y="239" text-anchor="middle">Décision B</text>
    <rect x="400" y="40" width="150" height="54" rx="12" fill="#fff" stroke="#cfe6ec"/><text x="475" y="73" text-anchor="middle">Impact A</text>
    <rect x="400" y="206" width="150" height="54" rx="12" fill="#fff" stroke="#cfe6ec"/><text x="475" y="239" text-anchor="middle">Impact B</text>
  </g>
  <path d="M160 67 L400 233" stroke="{CYAN}" stroke-width="3" fill="none"/>
  <path d="M160 233 L400 67" stroke="{INK}" stroke-width="3" fill="none"/>
  <circle cx="280" cy="150" r="30" fill="{CYAN}"/>
  <text x="280" y="156" text-anchor="middle" font-family="JetBrains Mono" font-size="13" fill="#fff" letter-spacing="1">×</text>
  <text x="280" y="205" text-anchor="middle" font-family="JetBrains Mono" font-size="12" fill="{DEEP}" letter-spacing="2">COMPARER</text>
</svg>'''


def build():
    S = []

    # 01 ─ Couverture
    S.append(f'''<section class="s dark">{art('6.2in', '-0.6in', '8.4in', 71, 80)}
<div class="in" style="justify-content:space-between">
  <div class="pg" style="align-self:flex-end"><b>01</b> / {TOTAL}</div>
  <div>
    <div style="display:flex;align-items:center;gap:18px">{mark('#ffffff', '#22c9e4', 86)}
      <span style="font-family:Geist;font-weight:700;font-size:62px;letter-spacing:-.04em">Lenexux</span></div>
    <p class="kick" style="margin-top:22px">Enterprise Dependency Intelligence</p>
    <h1 style="font-size:46px;max-width:7.4in;margin-top:26px">Tout est connecté.<br>Toute connexion crée une dépendance.<br><em>Toute dépendance peut créer un impact.</em></h1>
  </div>
  <div style="font-family:JetBrains Mono;font-size:12px;letter-spacing:.14em;color:#8fa0a6">
    SPLITSPAY INC. · LENEXUX.COM · 2026</div>
</div></section>''')

    # 02 ─ La question
    S.append(slide(2, f'''
<div class="body" style="align-items:flex-start">
  <p class="kick">La question</p>
  <div class="quote" style="font-size:52px;max-width:10in;line-height:1.12">« Si quelque chose change ici,<br><em>qu’est-ce que cela change ailleurs ?</em> »</div>
  <p class="lead" style="max-width:8.4in;margin-top:28px">Un fournisseur change. Une application est remplacée. Un employé quitte l’entreprise.
    Un serveur tombe. Une API externe devient indisponible. Un agent IA est introduit. Une cyberattaque survient.
    Chaque fois, la même question traverse toute l’organisation — et presque personne ne peut y répondre vite.</p>
</div>''', art=art('8.8in', '1.6in', '5.6in', 12, 44)))

    # 03 ─ Le problème : les silos
    S.append(slide(3, f'''
<div style="display:grid;grid-template-columns:1fr 1.15fr;gap:.6in;align-items:center;flex:1">
  <div>
    <p class="kick">Le problème</p>
    <h2>Les entreprises ont des données.<br><em>Pas la vue d’ensemble.</em></h2>
    <p class="lead">Chaque système possède sa propre vision, juste et incomplète. Le serveur, le client,
      le fournisseur, l’application, l’agent IA : tout est connu quelque part — jamais au même endroit.
      Le lien entre ces mondes n’est écrit nulle part.</p>
  </div>
  <div class="silos">
    <div class="silo"><b>ERP</b><span>Finance, opérations</span></div>
    <div class="silo"><b>CRM</b><span>Clients</span></div>
    <div class="silo"><b>SIRH</b><span>Employés</span></div>
    <div class="silo"><b>ITSM</b><span>Services informatiques</span></div>
    <div class="silo"><b>CMDB</b><span>Infrastructure</span></div>
    <div class="silo"><b>SIEM</b><span>Sécurité</span></div>
    <div class="silo"><b>Cloud</b><span>Ressources hébergées</span></div>
    <div class="silo"><b>IA</b><span>Agents et modèles</span></div>
    <div class="silo"><b>BI</b><span>Données, rapports</span></div>
  </div>
</div>'''))

    # 04 ─ L'intuition
    S.append(slide(4, f'''
<div class="body">
  <p class="kick">L’intuition fondatrice</p>
  <h2 style="font-size:50px;max-width:10.5in">Une organisation n’est pas une collection de systèmes.<br><em>C’est un réseau de dépendances.</em></h2>
  <div class="trio">
    <div class="tri">{badge('link', 78, 34)}<b>Connexion</b><span>Deux éléments sont liés.</span></div>
    <span class="arw">→</span>
    <div class="tri">{badge('graph', 78, 34)}<b>Dépendance</b><span>L’un a besoin de l’autre pour fonctionner.</span></div>
    <span class="arw">→</span>
    <div class="tri">{badge('bolt', 78, 34)}<b>Impact</b><span>Quand l’un tombe, l’autre s’arrête.</span></div>
  </div>
  <p class="lead" style="text-align:center;max-width:none;margin-top:30px">Lenexux intervient précisément entre les trois.</p>
</div>'''))

    # 05 ─ Le nom
    S.append(slide(5, f'''
<div class="body">
  <p class="kick">D’où vient le nom</p>
  <h2>Lenexux — <em>Living Enterprise Nexus.</em></h2>
  <p class="lead" style="max-width:9in">Le point de connexion vivant de l’entreprise. Pas un nom auquel on a cherché
    un sens après coup : le nom, le logo et l’architecture racontent la même chose.</p>
  <div class="ety">
    <div class="et"><div class="big">LE</div><b>Living Enterprise</b>
      <span>Une entreprise évolue sans cesse. Son modèle doit évoluer avec elle — et dans Lenexux, il le fait : la confiance de chaque lien décote avec le temps, la collecte se répète seule, le jumeau garde son historique.</span></div>
    <div class="et"><div class="big">NEXU<em>S</em></div><b>Du latin <i>nectere</i>, lier</b>
      <span>Le nexus est un point de connexion, un ensemble de relations : l’endroit où les dimensions de l’organisation se rencontrent enfin.</span></div>
    <div class="et"><div class="big" style="display:flex;align-items:center;gap:14px">{mark(INK, CYAN, 76)}</div><b>Le S devient un X</b>
      <span>Le X est la croisée : là où les silos se traversent, où les dépendances se croisent, où deux décisions se comparent. C’est le cœur du logo.</span></div>
  </div>
  <div style="margin-top:34px;border-left:3px solid #16b3ce;padding:4px 0 4px 20px;max-width:10.6in">
    <p class="quote" style="font-size:20px;font-weight:500;margin:0;color:#37424a">« Une entreprise est un immense réseau de dépendances.
      Quand une chose change, le vrai problème est de comprendre <em>jusqu’où l’impact peut se propager.</em> »</p>
    <p class="note" style="margin:8px 0 0;font-style:normal;font-family:JetBrains Mono;letter-spacing:.08em">YVAN LOIC NANFAH WAMBA · FONDATEUR</p>
  </div>
</div>'''))

    # 06 ─ La solution
    S.append(slide(6, f'''
<div style="display:grid;grid-template-columns:1.1fr 1fr;gap:.5in;align-items:center;flex:1">
  <div>
    <p class="kick">La solution</p>
    <h2>Le point où les mondes<br><em>de l’organisation se rencontrent.</em></h2>
    <p class="lead">Lenexux construit une représentation vivante de l’organisation, relie ses dimensions
      — métier, informatique, cybersécurité, IA, finance —, analyse comment un incident ou un
      changement se propage, et permet de simuler les scénarios avant d’agir.</p>
    <p class="quote" style="font-size:22px;margin-top:26px;color:#37424a">
      « Show me what breaks, why, what it affects,<br><em>and what to fix first.</em> »</p>
    <p class="note" style="margin-top:8px">La promesse écrite dans le cahier des charges fondateur.</p>
  </div>
  <div style="height:4.9in">{nexus_hub()}</div>
</div>'''))

    # 07 ─ La méthode
    S.append(slide(7, f'''
<div class="body">
  <p class="kick">La méthode</p>
  <h2>Modéliser → Relier → Comprendre → <em>Simuler → Décider.</em></h2>
  <div class="steps5">
    <div class="st">{badge('building', 56, 25)}<i>01</i><b>Modéliser</b><span>Représenter l’entreprise : activités, systèmes, fournisseurs, personnes, IA, chiffres.</span><span class="real">Import CSV · API · sonde · documents · modèle d’entreprise</span></div>
    <div class="st">{badge('link', 56, 25)}<i>02</i><b>Relier</b><span>Établir qui dépend de qui, avec la source et la fiabilité de chaque lien.</span><span class="real">Graphe unique · résolution d’entités · preuves</span></div>
    <div class="st">{badge('eye', 56, 25)}<i>03</i><b>Comprendre</b><span>Révéler les points uniques de défaillance et les chaînes cachées.</span><span class="real">Score de risque explicable · rayon d’impact</span></div>
    <div class="st">{badge('play', 56, 25)}<i>04</i><b>Simuler</b><span>Rejouer une panne, une attaque ou une décision, avant qu’elle n’arrive.</span><span class="real">14 perturbations · cyberattaque · « et si ? »</span></div>
    <div class="st">{badge('target', 56, 25)}<i>05</i><b>Décider</b><span>Arbitrer avec des montants, et savoir quoi corriger en premier.</span><span class="real">Impact en dollars · plan d’action · rapport</span></div>
  </div>
</div>'''))

    # 08 ─ Le produit
    S.append(slide(8, f'''
<div style="flex:1;display:flex;flex-direction:column;justify-content:center">
  <p class="kick">Le produit, aujourd’hui</p>
  <h2 style="font-size:38px">Une plateforme en production, <em>vingt-cinq écrans.</em></h2>
  <div class="cards" style="grid-template-columns:repeat(3,1fr);margin-top:24px">
    {card('graph', 'Graphe et jumeau numérique', 'L’organisation en 2D et en 3D, avec l’historique daté de chaque changement.')}
    {card('shield', 'Risque explicable', 'Un score décomposé en six facteurs mesurables. Les points uniques de défaillance nommés.')}
    {card('play', 'Simulation « et si ? »', 'Panne, perte de fournisseur, départ d’un employé clé : la cascade se propage sous vos yeux.')}
    {card('lock', 'Cyberattaque', 'La chaîne de compromission, l’impact par étape, et ce que chaque contre-mesure évite.')}
    {card('money', 'Impact financier', 'Le modèle d’entreprise convertit une interruption technique en dollars et en heures.')}
    {card('file', 'Confiance et preuves', 'Chaque dépendance dit d’où vient l’information <em>et à quel point elle est sûre.</em>')}
  </div>
</div>'''))

    # 09 ─ Cyber : le rayon d'impact organisationnel
    S.append(slide(9, f'''
<div class="body">
  <p class="kick">Cybersécurité</p>
  <h2>Le rayon d’impact <em>organisationnel.</em></h2>
  <p class="lead" style="max-width:9.5in">Une cyberattaque ne concerne pas « un serveur compromis ». La vraie question est :
    qu’est-ce qui en dépend, jusqu’où l’impact se propage, et combien il coûte.</p>
  {chain([('bolt', 'Incident<br>cyber'), ('server', 'Actif<br>compromis'), ('graph', 'Dépendances'),
          ('app', 'Services<br>métier'), ('process', 'Processus'), ('users', 'Clients'),
          ('chart', 'Opérations'), ('money', 'Impact<br>financier')], hot={0, 7})}
  <p class="note" style="margin-top:26px">Dans la plateforme : simulation d’attaque, chaîne de compromission, impact et contre-mesure par nœud.</p>
</div>'''))

    # 10 ─ IA : dépendances algorithmiques
    S.append(slide(10, f'''
<div class="body">
  <p class="kick">Intelligence artificielle</p>
  <h2>Les dépendances deviennent <em>algorithmiques.</em></h2>
  <p class="lead" style="max-width:9.5in">Une entreprise dépend désormais aussi d’agents, de modèles et d’API d’IA.
    Lenexux les traite comme des dépendances de premier rang — ce dont l’entreprise dépend,
    y compris quand une partie de cette dépendance est portée par l’IA.</p>
  {chain([('users', 'Employé'), ('app', 'Application'), ('brain', 'Agent IA'), ('brain', 'Modèle IA'),
          ('link', 'API'), ('cloud', 'Cloud'), ('database', 'Données')], hot={2, 3})}
  <p class="note" style="margin-top:26px">Dans la plateforme : sept types d’entités IA, et quatre perturbations dédiées —
    modèle indisponible, sortie erronée, fournisseur compromis, agent hors de contrôle.</p>
</div>'''))

    # 11 ─ Pourquoi on peut le croire
    S.append(slide(11, f'''
<div style="display:grid;grid-template-columns:1fr 1.05fr;gap:.55in;align-items:center;flex:1">
  <div>
    <p class="kick">Pourquoi le croire</p>
    <h2>Un chiffre qui dit<br><em>à quel point il est sûr.</em></h2>
    <p class="lead">Le calcul est déterministe : l’IA explique, elle ne produit jamais un montant.
      Et chaque dépendance porte ses preuves — leur origine, leur fiabilité, leur fraîcheur.
      Une carte non rafraîchie perd de la valeur toute seule, au lieu d’inspirer une fausse confiance.</p>
  </div>
  <div class="cards" style="grid-template-columns:1fr 1fr">
    {card('users', 'Validation humaine', 'Fiabilité <em>0,98</em>. Ajoutée aux sources, jamais à leur place.')}
    {card('eye', 'Observation technique', 'Fiabilité <em>0,90</em>. Flux et configurations observés.')}
    {card('link', 'API en direct', 'Fiabilité <em>0,85</em>. Source vivante, lue à la demande.')}
    {card('brain', 'Proposition de l’IA', 'Fiabilité <em>0,35</em>. Reste suggérée tant qu’un humain ne valide pas.')}
  </div>
</div>'''))

    # 12 ─ Le X comme décision
    S.append(slide(12, f'''
<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5in;align-items:center;flex:1">
  <div>
    <p class="kick">De l’impact à la décision</p>
    <h2>Comparer deux chemins<br><em>avant d’en prendre un.</em></h2>
    <p class="lead">Changer de fournisseur, externaliser, fermer un site : décrit en une phrase, chaque
      option est chiffrée sur l’opérationnel comme sur le compte de résultat. C’est le pont qui manque
      entre les outils de risque, qui ignorent la finance, et les outils financiers, qui ignorent les dépendances.</p>
  </div>
  <div style="height:3.4in">{decision_x()}</div>
</div>'''))

    # 13 ─ Positionnement
    S.append(slide(13, f'''
<div style="flex:1;display:flex;flex-direction:column;justify-content:center">
  <p class="kick">Positionnement</p>
  <h2 style="font-size:38px">Nous ne remplaçons rien. <em>Nous relions.</em></h2>
  <table>
    <tr><th>Catégorie</th><th>Ce qu’elle fait très bien</th><th>Ce qui lui manque</th></tr>
    <tr><td class="n">CMDB / ITSM</td><td>Inventorier les actifs techniques.</td><td class="m">Ni fournisseurs, ni personnes, ni coût.</td></tr>
    <tr><td class="n">Découverte / APM</td><td>Observer les dépendances techniques.</td><td class="m">S’arrête au périmètre technique.</td></tr>
    <tr><td class="n">Risque / conformité</td><td>Tenir le registre des risques.</td><td class="m">Risques saisis à la main, notés par couleur.</td></tr>
    <tr><td class="n">Continuité d’activité</td><td>Structurer les plans.</td><td class="m">Analyse d’impact déclarative, jamais recalculée.</td></tr>
    <tr><td class="n">Planification financière</td><td>Simuler le compte de résultat.</td><td class="m">Ignore les dépendances opérationnelles.</td></tr>
  </table>
  <p class="lead" style="font-size:15px;margin-top:18px;max-width:none">Critère posé dès l’origine pour chaque fonctionnalité :
    <b style="color:#0d0d0d">augmente-t-elle le coût de reproduction de la plateforme ?</b></p>
</div>'''))

    # 14 ─ Marché et mise en marché
    S.append(slide(14, f'''
<div style="flex:1;display:flex;flex-direction:column;justify-content:center">
  <p class="kick">Marché et mise en marché</p>
  <h2 style="font-size:38px">Là où une panne coûte cher, <em>et où les géants ne vont pas.</em></h2>
  <div class="cards" style="grid-template-columns:repeat(4,1fr);margin-top:26px">
    {card('building', '200 à 2 000 employés', 'Un risque opérationnel réel, sans budget pour un projet de dix-huit mois. <em>Les grands éditeurs ne descendent pas ici.</em>')}
    {card('clock', 'Pilote de six semaines', 'Un processus critique, six heures du client, un résultat présenté en comité.')}
    {card('link', 'Canal partenaire', 'Infogérants et cabinets de continuité : ils ont déjà la confiance et le rendez-vous.')}
    {card('shield', 'Ancrage québécois', 'La Loi 25 impose de recenser ses sous-traitants et d’évaluer les risques — une exigence locale, donc défendable.')}
  </div>
</div>'''))

    # 15 ─ Où nous en sommes
    S.append(slide(15, f'''
<div style="flex:1;display:flex;flex-direction:column;justify-content:center">
  <p class="kick">Où nous en sommes</p>
  <h2 style="font-size:38px">Construit, en ligne, <em>prêt pour les premiers pilotes.</em></h2>
  <div class="nums" style="margin-top:24px">
    <div class="num"><b>25</b><span>écrans en production</span></div>
    <div class="num"><b>14</b><span>perturbations simulables</span></div>
    <div class="num"><b>8</b><span>origines de preuve</span></div>
    <div class="num"><b>2</b><span>langues, FR et EN</span></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5in;margin-top:26px">
    <div>
      <p style="margin:0 0 8px;font-family:Geist;font-weight:600;font-size:17px">Livré <span class="tag t-done">fait</span></p>
      <p style="margin:0;font-size:14px;color:#5b6870;line-height:1.6">Moteur de risque et de propagation, chiffrage par modèle d’entreprise,
        simulation de panne et de cyberattaque, moteur de confiance, sonde de collecte sans port entrant,
        comptes et rôles, authentification unique Entra ID, espaces clients cloisonnés.</p>
    </div>
    <div>
      <p style="margin:0 0 8px;font-family:Geist;font-weight:600;font-size:17px">Maintenant <span class="tag t-now">en cours</span>
        &nbsp;Ensuite <span class="tag t-next">à venir</span></p>
      <p style="margin:0;font-size:14px;color:#5b6870;line-height:1.6">Premiers pilotes payants — la seule métrique qui compte à ce stade.
        Puis : connecteurs préréglés, et la réponse à la question fondatrice
        <b style="color:#0d0d0d">« où investir un million pour réduire le plus de risque ? »</b></p>
    </div>
  </div>
</div>'''))

    # 16 ─ Ce que nous cherchons / clôture
    S.append(f'''<section class="s dark">{art('8.3in', '0.2in', '6.2in', 88, 60)}
<div class="in">
  {top(16, True)}
  <div class="body">
    <p class="kick">Ce que nous cherchons</p>
    <h2 style="font-size:40px;max-width:8.4in">Rendre visible le réseau<br><em>dont chaque organisation dépend.</em></h2>
    <div class="ask">
      <div><b>Des organisations pilotes</b><span>Un processus critique, six semaines, un résultat présenté à votre comité.</span></div>
      <div><b>Un accompagnement</b><span>Un incubateur ou un partenaire pour ouvrir les portes et structurer la mise en marché.</span></div>
      <div><b>Un financement</b><span>De quoi tenir l’exploitation et accompagner les premiers déploiements.</span></div>
    </div>
  </div>
  <div style="display:flex;align-items:flex-end;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:16px">{mark('#ffffff', '#22c9e4', 52)}
      <div><div style="font-family:Geist;font-weight:700;font-size:20px">Yvan Loic Nanfah Wamba</div>
        <div style="font-family:JetBrains Mono;font-size:12px;color:#8fa0a6;margin-top:4px">Fondateur · SPLITSPAY INC. ·
          <span style="color:#22c9e4">yvanloic@lenexux.com</span> · lenexux.com</div></div></div>
    <div style="background:#fff;padding:7px;border-radius:6px"><svg viewBox="0 0 29 29" width="84" height="84"><path fill="#0d0d0d" d="{bb.QR}"/></svg></div>
  </div>
</div></section>''')

    html = ('<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><title>Pitch Lenexux</title>'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&'
            'family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=block">'
            f'<style>{CSS}</style></head><body>' + ''.join(S) + '</body></html>\n')
    out = os.path.join(HERE, 'pitch.html')
    io.open(out, 'w', encoding='utf-8').write(html)
    print('écrit :', out, len(S), 'diapositives')


if __name__ == '__main__':
    build()
