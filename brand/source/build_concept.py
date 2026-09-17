# -*- coding: utf-8 -*-
"""Document de concept Lenexux — 8 pages A4, même registre que la brochure.

Réutilise le logo, les icônes, les constellations et la feuille de style de
`build_brochure` : les deux documents ne peuvent pas diverger visuellement.
"""
import io
import os

import build_brochure as bb

HERE = os.path.dirname(os.path.abspath(__file__))
INK, CYAN, DEEP = bb.INK, bb.CYAN, bb.DEEP

mark, icon, badge, constellation = bb.mark, bb.icon, bb.badge, bb.constellation
lockup, head, foot, card, stat, family = bb.lockup, bb.head, bb.foot, bb.card, bb.stat, bb.family

# Fiabilités et demi-vies réelles du moteur (Nexus.Domain/ValueObjects/EvidenceSource.cs).
SOURCES = [
    ('Validation humaine', 0.98, '365 j', 'Quelqu’un a confirmé la dépendance.'),
    ('Observation technique', 0.90, '90 j', 'Flux réseau, configuration, processus observés.'),
    ('API interrogée en direct', 0.85, '90 j', 'Source vivante lue à la demande.'),
    ('Déduction du moteur', 0.75, '180 j', 'Règle déterministe appliquée au graphe.'),
    ('Fichier importé', 0.70, '180 j', 'Export CSV ou Excel daté.'),
    ('Saisie manuelle', 0.60, '365 j', 'Déclaré par un utilisateur.'),
    ('Document analysé', 0.50, '180 j', 'Contrat, plan de reprise, schéma.'),
    ('Proposition de l’IA', 0.35, '180 j', 'Suggérée, en attente de validation.'),
]

CSS_EXTRA = """
  /* Pipeline d'architecture */
  .flow { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; margin-top: 5mm; }
  .flow > div { padding: 0 8px; position: relative; }
  .flow > div::after { content: "→"; position: absolute; right: -7px; top: 15px;
                       color: #a8ccd7; font-size: 12pt; }
  .flow > div:last-child::after { content: ""; }
  .flow .fnum { font-family: "JetBrains Mono"; font-size: 6.8pt; letter-spacing: .12em; color: #16b3ce; }
  .flow b { font-family: "Geist"; font-weight: 600; font-size: 9.6pt; display: block; margin: 5px 0 4px; }
  .flow span { font-size: 7.8pt; color: #5b6870; line-height: 1.45; display: block; }
  .flow ul { list-style: none; margin: 6px 0 0; padding: 0; }
  .flow li { font-size: 7.2pt; color: #37424a; padding: 1.5px 0 1.5px 8px; position: relative; line-height: 1.4; }
  .flow li::before { content: ""; position: absolute; left: 0; top: 7px; width: 3px; height: 3px;
                     border-radius: 50%; background: #bcd9e2; }

  /* Barres de fiabilité des preuves */
  .ev { display: grid; gap: 5px; margin-top: 4mm; }
  .evr { display: grid; grid-template-columns: 46mm 1fr 13mm 46mm; gap: 10px; align-items: center; }
  .evr b { font-family: "Geist"; font-weight: 600; font-size: 8.6pt; }
  .evbar { height: 7px; border-radius: 4px; background: #eef4f6; overflow: hidden; }
  .evbar i { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg,#16b3ce,#7fd8e8); }
  .evr .val { font-family: "JetBrains Mono"; font-size: 8pt; color: #0b7f94; text-align: right;
              font-variant-numeric: tabular-nums; }
  .evr .note { font-size: 7.6pt; color: #5b6870; line-height: 1.35; }

  /* Tableau comparatif */
  .vs { width: 100%; border-collapse: collapse; margin-top: 4mm; }
  .vs th, .vs td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #eef4f6;
                   font-size: 8.2pt; vertical-align: top; }
  .vs th { font-family: "JetBrains Mono"; font-size: 6.8pt; letter-spacing: .1em; text-transform: uppercase;
           color: #5b6870; font-weight: 500; border-bottom: 1px solid #dceaee; }
  .vs td.n { font-family: "Geist"; font-weight: 600; width: 30%; }
  .vs td.g { color: #37424a; }

  /* Jalons */
  .mile { display: grid; grid-template-columns: 26mm 1fr; gap: 12px; padding: 5.5px 0;
          border-top: 1px solid #eef4f6; }
  .mile:last-child { border-bottom: 1px solid #eef4f6; }
  .mile .when { font-family: "JetBrains Mono"; font-size: 7.4pt; letter-spacing: .1em;
                text-transform: uppercase; color: #0b7f94; padding-top: 2px; }
  .mile b { font-family: "Geist"; font-weight: 600; font-size: 9.6pt; display: block; }
  .mile span { font-size: 7.9pt; color: #5b6870; line-height: 1.45; }
  .done { display: inline-block; font-family: "JetBrains Mono"; font-size: 6.6pt; letter-spacing: .08em;
          text-transform: uppercase; padding: 1px 6px; border-radius: 3px; margin-left: 7px;
          background: #e6f6ee; color: #2e7d5b; vertical-align: 2px; }
  .todo { background: #eef4f6; color: #5b6870; }

  /* Principes */
  .prin { display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px; margin-top: 4mm; }
  .pr { border: 1px solid #e3edf0; border-radius: 10px; padding: 13px 15px;
        background: linear-gradient(180deg,#fff,#f8fcfd); }
  .pr b { font-family: "Geist"; font-weight: 600; font-size: 10.4pt; display: block; margin: 8px 0 5px; }
  .pr span { font-size: 8.4pt; color: #5b6870; line-height: 1.55; display: block; }
  .pr em { font-style: normal; color: #0b7f94; }

  .seeks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 3mm; }
  .seek { display: flex; align-items: flex-start; gap: 11px; }
  .seek b { font-family: "Geist"; font-weight: 600; font-size: 9.4pt; display: block; margin-bottom: 2px; }
  .seek span { font-size: 7.8pt; color: #5b6870; line-height: 1.45; display: block; }

  .quote { border-left: 3px solid #16b3ce; padding: 10px 0 10px 16px; margin-top: 5mm;
           font-family: "Geist"; font-weight: 500; font-size: 11.5pt; line-height: 1.45; }
  .quote span { color: #0b7f94; }
"""


def flow(n, title, body, items):
    lis = ''.join(f'<li>{i}</li>' for i in items)
    return (f'<div><span class="fnum">{n}</span><b>{title}</b>'
            f'<span>{body}</span><ul>{lis}</ul></div>')


def ev_rows():
    out = []
    for name, weight, half, note in SOURCES:
        out.append(
            f'<div class="evr"><b>{name}</b>'
            f'<span class="evbar"><i style="width:{weight * 100:.0f}%"></i></span>'
            f'<span class="val">{weight:.2f}</span>'
            f'<span class="note">{note} <span style="color:#8a97a0">Demi-vie {half}.</span></span></div>'
        )
    return '<div class="ev">' + ''.join(out) + '</div>'


def milestone(when, title, body, state):
    tag = ('<span class="done">livré</span>' if state == 'done'
           else '<span class="done todo">à venir</span>' if state == 'todo' else '')
    return (f'<div class="mile"><span class="when">{when}</span>'
            f'<div><b>{title}{tag}</b><span>{body}</span></div></div>')


def seek(ic, title, line):
    return (f'<div class="seek">{badge(ic, 38, 18)}'
            f'<div><b>{title}</b><span>{line}</span></div></div>')


def principle(ic, title, body):
    return f'<div class="pr">{badge(ic, 44, 20)}<b>{title}</b><span>{body}</span></div>'


HEAD_LABEL = 'Document<br>de concept'


def page(num, inner, art=None, pad_bottom=None):
    style = f' style="padding-bottom:{pad_bottom}"' if pad_bottom else ''
    return (f'<div class="page">{art or ""}<div class="inner"{style}>'
            f'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px">'
            f'{lockup(w=46, word=27)}{head(num, "08", HEAD_LABEL)}</div>{inner}</div></div>')


def build():
    p1 = f'''
<div class="page">
  <div style="position:absolute;right:-64mm;top:66mm;width:215mm;height:215mm;z-index:1">
    {constellation(820, 820, seed=31, nodes=70)}</div>
  <div class="inner">
    {head('01', '08', HEAD_LABEL)}
    <div style="margin-top:14mm">{lockup(w=78, word=50)}</div>
    <div class="rule" style="margin-top:15mm"></div>
    <h1 style="font-size:29pt;max-width:118mm">Rendre visible le risque
      opérationnel <em>que personne ne voit.</em></h1>
    <p class="sub" style="margin-top:14px;max-width:104mm">Document de concept — la raison d’être
      du produit, son architecture, ce qui le distingue, et son état d’avancement réel.</p>
    <div class="cover-lines" style="font-size:11pt">
      <span>Pour</span> les investisseurs, les incubateurs<br>
      et les organisations pilotes.
    </div>
    <div style="margin-top:auto">
      <div class="rule" style="width:28px;height:2px;margin-bottom:10px"></div>
      <div class="cover-cta">Version 1.0 · Septembre 2026<br>SPLITSPAY INC. · Québec, Canada</div>
    </div>
    {foot('Document de concept · Lenexux', 'lenexux.com')}
  </div>
</div>'''

    p2 = page('02', f'''
    <div style="margin-top:10mm">
      <p class="eyebrow">Le point de départ</p>
      <h2 style="font-size:24pt">Une question simple<br><em>à laquelle rien ne répond.</em></h2>
      <p class="sub" style="max-width:128mm;margin-top:10px">« Si ce système, ce fournisseur ou cette
        personne devient indisponible, qu’est-ce qui s’arrête derrière, jusqu’où, et combien cela
        coûte par heure ? » Cette question traverse l’informatique, les achats, les ressources
        humaines et la finance. Aucun outil ne la couvre de bout en bout.</p>
    </div>

    <div class="quote">Les organisations ne manquent pas de données.
      <span>Elles manquent du lien entre ces données.</span></div>

    <div class="prin" style="grid-template-columns:repeat(3,1fr);margin-top:7mm">
      {principle('link', 'Le savoir est éclaté', 'L’ERP connaît les fournisseurs, l’ITSM les serveurs, le SIRH les personnes. Personne ne détient la chaîne complète, et elle n’est écrite nulle part.')}
      {principle('eye', 'La carte est déclarative', 'Quand elle existe, elle vient d’un questionnaire annuel. Elle est périmée trois mois plus tard, et nul ne sait dire à quel point elle est fiable.')}
      {principle('money', 'Le coût reste théorique', 'Les registres de risque notent « élevé / moyen / faible ». Un comité de direction n’arbitre pas sur une couleur : il arbitre sur un montant.')}
    </div>

    <div style="margin-top:7mm">
      <p class="eyebrow">Ce que cela produit, concrètement</p>
      <div class="prin">
        {principle('shield', 'On découvre le point unique de défaillance le jour de la panne', 'Un site, un fournisseur, un expert : l’élément dont tout dépend et qui n’a aucun remplaçant se révèle au pire moment.')}
        {principle('clock', 'Le plan de continuité n’a jamais été éprouvé', 'Rédigé une fois, il vieillit dès le lendemain. Personne ne rejoue le scénario, faute de pouvoir le calculer.')}
      </div>
    </div>
    ''')

    p3 = page('03', f'''
    <div style="margin-top:10mm">
      <p class="eyebrow">La proposition</p>
      <h2 style="font-size:24pt">Une couche d’intelligence<br><em>au-dessus de vos outils.</em></h2>
      <p class="sub" style="max-width:128mm;margin-top:10px">Lenexux ne remplace ni l’ERP, ni l’ITSM,
        ni l’outil de supervision. Il les relie en un graphe unique, y calcule ce qui casse et ce que
        cela coûte, et dit toujours sur quelles preuves il s’avance.</p>
    </div>

    <div style="margin-top:6mm">
      <p class="eyebrow">Quatre partis pris fondateurs</p>
      <div class="prin">
        {principle('graph', 'Un seul graphe, toutes les natures de dépendance', 'Systèmes, fournisseurs, personnes, contrats et services d’IA cohabitent dans le même modèle. Une cascade peut donc partir d’un contrat et finir sur un agent IA.')}
        {principle('chart', 'Le calcul est déterministe', 'La propagation, les scores et les montants sont calculés par des règles explicites et reproductibles. <em>L’IA reformule et explique ; elle ne produit jamais un chiffre.</em>')}
        {principle('file', 'La confiance vient des preuves', 'Chaque dépendance porte ses sources, leur fiabilité et leur fraîcheur. Le score se recalcule, et <em>une information non rafraîchie perd de la valeur toute seule.</em>')}
        {principle('lock', 'Aucun accès privilégié', 'Le client n’expose que ce qu’il choisit : un export, une API en lecture seule, ou une sonde qui sort en HTTPS depuis son réseau. <em>Aucun port entrant à ouvrir.</em>')}
      </div>
    </div>

    <div style="margin-top:6mm">
      <p class="eyebrow">Ce que le produit rend, au bout de la chaîne</p>
      <div class="stats">
        {stat('graph', 'La carte', 'ce qui dépend de quoi')}
        {stat('shield', 'Le point faible', 'ce qui n’a aucun repli')}
        {stat('money', 'Le montant', 'ce que l’arrêt coûte')}
        {stat('file', 'La confiance', 'à quel point on en est sûr')}
      </div>
    </div>
    ''')

    p4 = page('04', f'''
    <div style="margin-top:10mm">
      <p class="eyebrow">Architecture</p>
      <h2 style="font-size:24pt">De la source de données<br><em>au montant chiffré.</em></h2>
      <p class="sub" style="max-width:128mm;margin-top:10px">Cinq étages, chacun remplaçable
        indépendamment. Les connecteurs évoluent sans toucher aux moteurs, et les moteurs évoluent
        sans redéploiement chez le client.</p>
    </div>

    <div class="flow">
      {flow('01', 'Collecte', 'Ce que le client accepte d’exposer.', ['Fichiers CSV et Excel', 'API REST en lecture seule', 'Sonde installée chez le client', 'Extraction documentaire'])}
      {flow('02', 'Résolution', 'Un même actif vu par deux sources devient une seule entité.', ['Appariement inter-sources', 'Ontologie typée', 'Identifiants déterministes'])}
      {flow('03', 'Graphe', 'La mémoire du système.', ['Base de graphe', 'Historique daté', 'Espaces clients cloisonnés'])}
      {flow('04', 'Moteurs', 'Le cœur déterministe.', ['Score de risque à six facteurs', 'Propagation en cascade', 'Chiffrage par modèle d’entreprise', 'Moteur de confiance'])}
      {flow('05', 'Restitution', 'Ce que l’utilisateur voit.', ['25 écrans, 2 langues', 'Rapports exécutifs', 'Analyste IA ancré', 'API et webhooks'])}
    </div>

    <div style="margin-top:7mm">
      <p class="eyebrow">Deux choix d’architecture qui comptent</p>
      <div class="prin">
        {principle('server', 'La sonde renverse le sens du flux', 'Les systèmes internes ne sont pas joignables depuis Internet — et le garde anti-SSRF interdit, à raison, que le cloud y accède. La sonde s’installe chez le client, sort en HTTPS, réclame ses tâches et renvoie les enregistrements. <em>Elle ne fait que collecter : toute l’intelligence reste côté plateforme.</em>')}
        {principle('brain', 'L’IA est encadrée par construction', 'Elle sert à trois choses : structurer des données collées, proposer des dépendances à valider, et expliquer un résultat déjà calculé. <em>Sans clé d’IA, la plateforme reste entièrement fonctionnelle.</em>')}
      </div>
    </div>
    ''')

    p5 = page('05', f'''
    <div style="margin-top:10mm">
      <p class="eyebrow">Le cœur du produit</p>
      <h2 style="font-size:24pt">Un chiffre qui dit<br><em>à quel point il est sûr.</em></h2>
      <p class="sub" style="max-width:130mm;margin-top:10px">Une cartographie affirme qu’une
        dépendance existe. La nôtre dit d’où vient l’information, quelle confiance lui accorder, et
        quand elle a été établie. C’est ce qui sépare un outil crédible d’un outil qu’on cesse
        d’écouter au premier chiffre faux.</p>
    </div>

    <div style="margin-top:5mm">
      <p class="eyebrow">Huit origines, chacune avec sa fiabilité et sa demi-vie</p>
      {ev_rows()}
    </div>

    <div style="margin-top:6mm">
      <div class="prin">
        {principle('link', 'Les preuves s’accumulent, elles ne s’écrasent pas', 'Plusieurs sources concordantes renforcent une dépendance, à rendement décroissant : deux preuves moyennes ne valent pas une certitude. Valider à la main <em>ajoute</em> une preuve et préserve l’origine.')}
        {principle('clock', 'Une carte qui ne se rafraîchit pas se dégrade visiblement', 'Chaque preuve perd de la valeur avec le temps, selon sa demi-vie. Une cartographie abandonnée signale elle-même son vieillissement, au lieu d’inspirer une fausse confiance.')}
      </div>
    </div>
    ''')

    p6 = page('06', f'''
    <div style="margin-top:10mm">
      <p class="eyebrow">Positionnement</p>
      <h2 style="font-size:24pt">Nous ne remplaçons rien.<br><em>Nous relions.</em></h2>
      <p class="sub" style="max-width:128mm;margin-top:10px">Chaque catégorie d’outil fait très bien
        son métier. Aucune ne répond à la question de l’impact transversal chiffré — et c’est
        précisément l’espace que nous occupons.</p>
    </div>

    <table class="vs">
      <tr><th>Catégorie</th><th>Ce qu’elle fait très bien</th><th>Ce qui manque</th></tr>
      <tr><td class="n">CMDB / ITSM</td><td class="g">Inventorier les actifs techniques et leur exploitation.</td><td class="g">Ni fournisseurs, ni personnes, ni coût. Elle dit ce que vous avez, pas ce que vous perdez.</td></tr>
      <tr><td class="n">Découverte et APM</td><td class="g">Observer les dépendances techniques réelles, automatiquement.</td><td class="g">S’arrête au périmètre technique. Ne remonte ni au contrat, ni au compte de résultat.</td></tr>
      <tr><td class="n">Risque et conformité</td><td class="g">Tenir un registre et suivre les contrôles.</td><td class="g">Risques saisis à la main, notés par couleur, sans lien avec la topologie réelle.</td></tr>
      <tr><td class="n">Continuité d’activité</td><td class="g">Structurer plans et exercices.</td><td class="g">L’analyse d’impact reste un questionnaire annuel. Rien n’est calculé ni rejoué.</td></tr>
      <tr><td class="n">Planification financière</td><td class="g">Simuler le compte de résultat et la trésorerie.</td><td class="g">Ignore les dépendances opérationnelles : un fournisseur n’y est qu’une ligne de coût.</td></tr>
    </table>

    <div style="margin-top:6mm">
      <p class="eyebrow">Ce qui constitue une avance défendable</p>
      <div class="prin" style="grid-template-columns:repeat(3,1fr)">
        {principle('file', 'La confiance calculée', 'Rare, et difficile à rattraper : elle suppose de modéliser les preuves dès l’origine, pas de l’ajouter après coup.')}
        {principle('money', 'Le pont vers le compte de résultat', 'Les outils de risque ignorent la finance ; les outils financiers ignorent la topologie. Le pont n’existe pratiquement pas.')}
        {principle('users', 'Le graphe validé du client', 'Une cartographie enrichie et validée pendant deux ans ne se remplace pas. Elle se construit par l’usage.')}
      </div>
    </div>
    ''')

    p7 = page('07', f'''
    <div style="margin-top:10mm">
      <p class="eyebrow">Adoption</p>
      <h2 style="font-size:24pt">Un exercice court,<br><em>puis un usage continu.</em></h2>
      <p class="sub" style="max-width:128mm;margin-top:10px">Le blocage n’est jamais l’intérêt : c’est
        le temps que l’organisation peut y consacrer. Le parcours est donc conçu pour produire un
        résultat avant d’avoir consommé la patience du client.</p>
    </div>

    <div class="flow" style="grid-template-columns:repeat(3,1fr);margin-top:5mm">
      {flow('01', 'Le premier jour', 'Un export suffit.', ['Un espace de travail', 'Inventaire en CSV', 'Graphe, scores et premiers points faibles'])}
      {flow('02', 'La première semaine', 'La carte devient la leur.', ['Fournisseurs et personnes clés', 'Modèle d’entreprise renseigné', 'Validation des dépendances connues'])}
      {flow('03', 'Le premier mois', 'La carte se maintient seule.', ['API en lecture seule', 'Sonde pour les systèmes internes', 'Collecte récurrente', 'Premiers scénarios en comité'])}
    </div>

    <div style="margin-top:6mm">
      <p class="eyebrow">Marché visé et mise en marché</p>
      <div class="prin">
        {principle('building', 'Organisations de 200 à 2 000 personnes', 'En dessous, le risque opérationnel ne justifie pas la dépense. Au-dessus, les appels d’offres allongent le cycle de vente au-delà de ce qu’une jeune entreprise peut financer. <em>Les grands éditeurs ne descendent pas dans ce segment : leur structure de coûts l’interdit.</em>')}
        {principle('link', 'Deux canaux, dont un démultiplicateur', 'La vente directe auprès des responsables de continuité et de risque. Et surtout le canal partenaire — infogérants et cabinets de continuité — qui dispose déjà de la confiance et du rendez-vous. <em>Un partenaire peut apporter plusieurs pilotes.</em>')}
        {principle('clock', 'Pilote payant de six semaines', 'Un processus critique, six heures du client, un résultat présenté en comité. Le prix qualifie l’intérêt bien plus qu’il ne finance le développement.')}
        {principle('shield', 'Ancrage québécois', 'La Loi 25 impose de recenser ses sous-traitants et d’évaluer les risques. Peu d’outils l’outillent réellement — et l’exigence est locale, donc défendable face à un acteur nord-américain généraliste.')}
      </div>
    </div>
    ''')

    p8 = f'''
<div class="page">
  <div style="position:absolute;right:-52mm;top:118mm;width:185mm;height:185mm;z-index:1">
    {constellation(700, 700, seed=43, nodes=52)}</div>
  <div class="inner" style="padding-bottom:48mm">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px">
      {lockup(w=46, word=27)}{head('08', '08', HEAD_LABEL)}
    </div>

    <div style="margin-top:10mm">
      <p class="eyebrow">État d’avancement</p>
      <h2 style="font-size:24pt">Ce qui existe aujourd’hui,<br><em>et ce qui vient ensuite.</em></h2>
    </div>

    <div style="margin-top:4mm;max-width:134mm">
      {milestone('Fait', 'La plateforme est en production', 'Vingt-cinq écrans bilingues, moteur de risque explicable, propagation en cascade, chiffrage par modèle d’entreprise, simulation de panne et de cyberattaque.', 'done')}
      {milestone('Fait', 'Moteur de confiance et traçabilité', 'Huit origines de preuve pondérées, décote d’ancienneté, décomposition du score, validation humaine qui préserve les sources d’origine.', 'done')}
      {milestone('Fait', 'Collecte chez le client', 'Connecteurs fichier et API en lecture seule, sonde interne sans port entrant, collecte récurrente, extraction documentaire.', 'done')}
      {milestone('Fait', 'Exploitation multi-clients', 'Espaces cloisonnés, comptes et rôles, authentification unique Entra ID, révocation immédiate, quotas d’IA par client.', 'done')}
      {milestone('En cours', 'Premiers pilotes payants', 'Deux à trois organisations, par le réseau direct et le canal partenaire. C’est la seule métrique qui compte à ce stade.', '')}
      {milestone('Ensuite', 'Profils de connecteurs préréglés', 'Inventaire, supervision et annuaire d’entreprise configurés d’avance, pour supprimer l’étape la plus rebutante de la mise en route.', 'todo')}
      {milestone('Ensuite', 'Accompagnement et financement', 'Programme d’incubation, crédits à l’innovation, et renforcement de l’exploitation avant montée en charge.', 'todo')}
    </div>

    <div style="margin-top:6mm">
      <p class="eyebrow">Ce que nous cherchons</p>
      <div class="seeks">
        {seek('building', 'Des organisations pilotes', 'Un processus critique, six semaines, un résultat présenté à votre comité.')}
        {seek('users', 'Un accompagnement', 'Incubateur ou partenaire capable d’ouvrir des portes et de structurer la mise en marché.')}
        {seek('money', 'Un financement mesuré', 'De quoi tenir l’exploitation et les premiers déploiements.')}
      </div>
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
    <div class="qr"><svg viewBox="0 0 29 29"><path fill="#0d0d0d" d="{bb.QR}"/></svg></div>
  </div>
</div>'''

    html = (
        '<!doctype html>\n<html lang="fr"><head><meta charset="utf-8">'
        '<title>Document de concept Lenexux</title>'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
        'family=Geist:wght@400;500;600;700&family=Inter:wght@400;500;600&'
        'family=JetBrains+Mono:wght@400;500&display=block">'
        f'<style>{bb.CSS}{CSS_EXTRA}</style></head><body>'
        + p1 + p2 + p3 + p4 + p5 + p6 + p7 + p8 +
        '</body></html>\n'
    )
    out = os.path.join(HERE, 'concept.html')
    io.open(out, 'w', encoding='utf-8').write(html)
    print('écrit :', out, len(html), 'octets')


if __name__ == '__main__':
    build()
