# -*- coding: utf-8 -*-
"""Construit le prospectus recto-verso de Lenexux (HTML -> PDF via Chrome).

Le logo et le code QR sont des tracés vectoriels inclus dans la page : le PDF
reste net à l'impression, quelle que soit la taille.
"""
import io
import os

HERE = os.path.dirname(os.path.abspath(__file__))
QR = io.open(os.path.join(HERE, 'qr-path.txt'), encoding='utf-8').read().strip()

INK = ('M295 660H408V1222H706L860 1000L688 754H538L481 660H728L907 917L1075 660H1197'
       'L973 1000L1197 1340H1068L907 1087L732 1340H295Z')
ACC = ('M458 784H554L706 1000L572 1195H473L611 1000Z M590 784H674L824 1000L691 1195H608'
       'L741 1000Z M765 660H846L945 803L906 866Z M906 1139L945 1200L850 1340H766Z')


def mark(ink, acc):
    return ('<svg viewBox="285 650 925 700" aria-hidden="true">'
            '<path fill="%s" d="%s"/><path fill="%s" d="%s"/></svg>' % (ink, INK, acc, ACC))


CSS = """
  @page { size: Letter; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: "Inter", system-ui, sans-serif; color: #0d0d0d; background: #fff;
         font-size: 10.2pt; line-height: 1.5; }

  .page { width: 8.5in; height: 11in; position: relative; overflow: hidden;
          page-break-after: always; display: flex; flex-direction: column; }
  .page:last-child { page-break-after: auto; }
  .pad { padding: 0 0.72in; }

  /* Bandeau de tete */
  .band { background: #0d0d0d; color: #fff; padding: 0.4in 0.72in; display: flex;
          align-items: center; justify-content: space-between; gap: 24px; }
  .lock { display: flex; align-items: center; gap: 13px; }
  .lock svg { width: 42px; height: 32px; }
  .lock b { font-family: "Geist"; font-weight: 700; font-size: 23px; letter-spacing: -.035em; }
  .band .tag { font-family: "JetBrains Mono"; font-size: 8.2pt; letter-spacing: .12em;
               text-transform: uppercase; color: #22c9e4; text-align: right; line-height: 1.7; }

  h1 { font-family: "Geist"; font-weight: 700; font-size: 32pt; line-height: 1.03;
       letter-spacing: -.035em; margin: .3in 0 0; }
  h1 em { font-style: normal; color: #0b7f94; }
  .lede { font-size: 11.2pt; line-height: 1.5; color: #37424a; margin: 13px 0 0; max-width: 6.1in; }

  h2 { font-family: "Geist"; font-weight: 600; font-size: 14pt; letter-spacing: -.015em; margin: 0 0 9px; }
  .kicker { font-family: "JetBrains Mono"; font-size: 7.8pt; letter-spacing: .13em;
            text-transform: uppercase; color: #0b7f94; margin: 0 0 6px; }
  section { margin-top: .24in; }
  p { margin: 0 0 9px; }

  .three { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
           background: #dfe5e7; border: 1px solid #dfe5e7; }
  .three > div { background: #fff; padding: 12px 14px; }
  .three b { font-family: "Geist"; font-weight: 600; display: block; font-size: 10.4pt; margin-bottom: 3px; }
  .three span { font-size: 9pt; color: #5b6870; line-height: 1.45; }

  .story { background: #f4f7f8; border-left: 3px solid #16b3ce; padding: 11px 16px; }
  .beat { display: grid; grid-template-columns: 50px 1fr; gap: 12px; padding: 3px 0; }
  .beat time { font-family: "JetBrains Mono"; font-size: 8.8pt; color: #0b7f94;
               font-variant-numeric: tabular-nums; }
  .beat span { font-size: 9.4pt; line-height: 1.45; }
  .beat.last span { font-weight: 600; }

  .figures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
             background: #2a3134; border: 1px solid #0d0d0d; margin-top: 13px; }
  .fig { background: #0d0d0d; color: #fff; padding: 12px 14px; }
  .fig b { font-family: "Geist"; font-weight: 700; font-size: 19pt; letter-spacing: -.03em;
           display: block; line-height: 1; }
  .fig b.acc { color: #22c9e4; }
  .fig span { font-family: "JetBrains Mono"; font-size: 7.4pt; letter-spacing: .06em;
              text-transform: uppercase; color: #8fa0a6; display: block; margin-top: 5px; }
  .fignote { font-size: 8.2pt; color: #5b6870; margin-top: 7px; font-style: italic; }

  .steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px;
           background: #dfe5e7; border: 1px solid #dfe5e7; }
  .step { background: #fff; padding: 11px 11px 13px; }
  .step i { font-family: "JetBrains Mono"; font-style: normal; font-size: 7.8pt; color: #16b3ce; }
  .step b { font-family: "Geist"; font-weight: 600; font-size: 10.2pt; display: block; margin: 5px 0 3px; }
  .step span { font-size: 8.6pt; color: #5b6870; line-height: 1.4; }

  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eaeef0;
           font-size: 9.2pt; vertical-align: top; }
  th { font-family: "JetBrains Mono"; font-size: 7.6pt; letter-spacing: .07em;
       text-transform: uppercase; color: #5b6870; font-weight: 500; border-bottom: 1px solid #dfe5e7; }
  td.tool { font-family: "Geist"; font-weight: 600; width: 33%; }
  td.gap { color: #37424a; }

  .phases { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
            background: #dfe5e7; border: 1px solid #dfe5e7; }
  .phase { background: #fff; padding: 12px 14px; }
  .phase i { font-family: "JetBrains Mono"; font-style: normal; font-size: 7.6pt;
             letter-spacing: .09em; text-transform: uppercase; color: #0b7f94; }
  .phase p { font-size: 9.1pt; color: #37424a; margin: 6px 0 0; line-height: 1.45; }

  .offer { border: 2px solid #0d0d0d; margin-top: .28in; }
  .offer-h { background: #0d0d0d; color: #fff; padding: 11px 17px; display: flex;
             justify-content: space-between; align-items: baseline; gap: 16px; }
  .offer-h b { font-family: "Geist"; font-weight: 700; font-size: 12.5pt; }
  .offer-h span { font-family: "JetBrains Mono"; font-size: 8.2pt; color: #22c9e4; }
  .offer-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #eaeef0; }
  .offer-grid > div { background: #fff; padding: 10px 14px; }
  .offer-grid dt { font-family: "JetBrains Mono"; font-size: 7.2pt; letter-spacing: .08em;
                   text-transform: uppercase; color: #5b6870; }
  .offer-grid dd { margin: 4px 0 0; font-family: "Geist"; font-weight: 600; font-size: 12pt; }
  .offer-foot { padding: 10px 17px; border-top: 1px solid #eaeef0; font-size: 9pt; color: #37424a; }

  .foot { margin-top: auto; background: #0d0d0d; color: #fff; padding: .3in .72in;
          display: flex; justify-content: space-between; align-items: center; gap: 28px; }
  .foot .who b { font-family: "Geist"; font-weight: 600; font-size: 11.5pt; display: block; }
  .foot .who span { font-family: "JetBrains Mono"; font-size: 8.4pt; color: #8fa0a6;
                    display: block; margin-top: 4px; line-height: 1.7; }
  .foot .who span em { font-style: normal; color: #22c9e4; }
  .qr { background: #fff; padding: 7px; }
  .qr svg { width: 1in; height: 1in; display: block; }
  .qr-cap { font-family: "JetBrains Mono"; font-size: 6.8pt; color: #8fa0a6;
            text-align: center; margin-top: 5px; }
  .legal { font-family: "JetBrains Mono"; font-size: 7pt; color: #8fa0a6; line-height: 1.8; }
"""

BODY = u"""
<div class="page">
  <div class="band">
    <div class="lock">__MARK_DARK__<b>Lenexux</b></div>
    <div class="tag">Intelligence des dependances<br>et d&rsquo;impact operationnel</div>
  </div>

  <div class="pad">
    <h1>Sachez ce qui casse<br><em>avant</em> que l&rsquo;activite<br>n&rsquo;en patisse.</h1>
    <p class="lede">
      Quand un systeme, un fournisseur ou une personne cle devient indisponible, trois questions
      se posent d&rsquo;un coup : qu&rsquo;est-ce qui s&rsquo;arrete derriere, jusqu&rsquo;ou, et
      combien cela coute par heure. Lenexux y repond sur vos dependances reelles.
    </p>

    <section>
      <p class="kicker">Le probleme</p>
      <h2>Chaque outil voit son silo. Personne ne voit l&rsquo;ensemble.</h2>
      <div class="three">
        <div><b>Angles morts</b><span>Les dependances qui traversent l&rsquo;informatique, les achats et les ressources humaines ne vivent dans aucun outil.</span></div>
        <div><b>Surprises couteuses</b><span>On decouvre qu&rsquo;un element n&rsquo;avait aucune solution de repli le jour ou il tombe &mdash; pas avant.</span></div>
        <div><b>Decisions a l&rsquo;aveugle</b><span>Impossible de chiffrer l&rsquo;arret d&rsquo;une activite sans un modele relie a vos vrais chiffres.</span></div>
      </div>
    </section>

    <section>
      <p class="kicker">Un lundi matin</p>
      <h2>De la panne a la decision, en treize minutes.</h2>
      <div class="story">
        <div class="beat"><time>09:02</time><span>Votre fournisseur d&rsquo;identite &mdash; celui qui laisse entrer vos employes dans leurs outils &mdash; tombe. Personne ne sait encore jusqu&rsquo;ou cela va.</span></div>
        <div class="beat"><time>09:04</time><span>Vous ouvrez Lenexux et tapez la question telle quelle : &laquo;&nbsp;et si nous perdons notre fournisseur d&rsquo;identite ?&nbsp;&raquo;</span></div>
        <div class="beat"><time>09:05</time><span>Reponse : 16 elements touches, dont 8 sans aucune solution de repli. Chaque chiffre est cliquable jusqu&rsquo;a sa source.</span></div>
        <div class="beat"><time>09:07</time><span>Lenexux dit aussi sur quoi il s&rsquo;avance : 21 dependances traversees, confiance moyenne de 88&nbsp;%, et le maillon le plus faible est nomme.</span></div>
        <div class="beat last"><time>09:15</time><span>Vous arbitrez avec des montants, pas des intuitions &mdash; et le rapport pour la direction est deja ecrit.</span></div>
      </div>
      <div class="figures">
        <div class="fig"><b class="acc">1,70 M$</b><span>impact estime</span></div>
        <div class="fig"><b>16</b><span>elements touches</span></div>
        <div class="fig"><b>4,9 h</b><span>reprise de service</span></div>
        <div class="fig"><b>88 %</b><span>confiance du calcul</span></div>
      </div>
      <p class="fignote">Chiffres issus du jeu de demonstration fourni avec la plateforme, reproductibles en seance.</p>
    </section>
  </div>

  <div class="foot">
    <div class="who">
      <b>Voyez vos angles morts des aujourd&rsquo;hui.</b>
      <span><em>lenexux.com</em> &middot; yvanloic@lenexux.com</span>
    </div>
    <div>
      <div class="qr"><svg viewBox="0 0 29 29"><path fill="#0d0d0d" d="__QR__"/></svg></div>
      <div class="qr-cap">Demo en un clic</div>
    </div>
  </div>
</div>

<div class="page">
  <div class="pad" style="padding-top:.6in">
    <section style="margin-top:0">
      <p class="kicker">Comment ca marche</p>
      <h2>Du fichier brut a la decision chiffree, en cinq temps.</h2>
      <div class="steps">
        <div class="step"><i>01</i><b>Importer</b><span>Un export CSV suffit. Aucun acces a vos systemes n&rsquo;est demande.</span></div>
        <div class="step"><i>02</i><b>Cartographier</b><span>Systemes, fournisseurs, personnes et IA deviennent une seule carte.</span></div>
        <div class="step"><i>03</i><b>Reveler</b><span>Points uniques de defaillance, concentration, rayon d&rsquo;impact.</span></div>
        <div class="step"><i>04</i><b>Simuler</b><span>Panne, cyberattaque ou decision : la cascade se propage et se chiffre.</span></div>
        <div class="step"><i>05</i><b>Decider</b><span>Mitigations priorisees et rapport executif, chiffres a l&rsquo;appui.</span></div>
      </div>
    </section>

    <section>
      <p class="kicker">En quoi c&rsquo;est different</p>
      <h2>Nous ne remplacons rien de ce que vous avez.</h2>
      <table>
        <tr><th>Ce que vous avez deja</th><th>Ce qui manque &mdash; et que Lenexux apporte</th></tr>
        <tr><td class="tool">CMDB ou outil ITSM</td><td class="gap">Il sait ce que vous <b>avez</b>. Il ignore ce que vous <b>perdez</b> si cela tombe &mdash; et ne connait ni vos fournisseurs, ni les savoirs detenus par une seule personne.</td></tr>
        <tr><td class="tool">Outil de risque ou de conformite</td><td class="gap">Les risques y sont saisis a la main et notes &laquo;&nbsp;eleve / moyen / faible&nbsp;&raquo;. Ici ils sont <b>calcules</b> a partir de dependances reelles, et chiffres en dollars.</td></tr>
        <tr><td class="tool">Plan de continuite en tableur</td><td class="gap">Il n&rsquo;a jamais ete teste et vieillit des le lendemain de sa redaction. Ici le scenario se rejoue a la demande, sur des donnees rafraichies.</td></tr>
      </table>
    </section>

    <section>
      <p class="kicker">Ce que cela vous demande</p>
      <h2>Pas de projet d&rsquo;integration, pas d&rsquo;acces administrateur.</h2>
      <div class="phases">
        <div class="phase"><i>Le premier jour</i><p>Un espace, et un premier export de votre inventaire. Une personne, aucune installation.</p></div>
        <div class="phase"><i>La premiere semaine</i><p>Vos fournisseurs et vos personnes cles, puis la validation de ce que vous savez juste.</p></div>
        <div class="phase"><i>Le premier mois</i><p>Vos sources vivantes branchees en lecture seule, et vos premiers scenarios en comite.</p></div>
      </div>
    </section>

    <div class="offer">
      <div class="offer-h"><b>Pilote &laquo;&nbsp;Chaine critique&nbsp;&raquo;</b><span>Un processus metier, cartographie, chiffre et presente</span></div>
      <div class="offer-grid">
        <div><dt>Duree</dt><dd>6 semaines</dd></div>
        <div><dt>Votre temps</dt><dd>6 heures</dd></div>
        <div><dt>Perimetre</dt><dd>1 processus</dd></div>
        <div><dt>Vous fournissez</dt><dd>3 exports</dd></div>
      </div>
      <div class="offer-foot">
        <b>Engagement ecrit :</b> au terme des six semaines, au moins trois points uniques de
        defaillance que vous ne connaissiez pas, chacun chiffre. A defaut, vous ne payez que la moitie.
      </div>
    </div>
  </div>

  <div class="foot">
    <div class="who">
      <b>Yvan Loic Nanfah Wamba</b>
      <span>SPLITSPAY INC. &middot; 905, rue Sainte-Cecile<br><em>yvanloic@lenexux.com</em> &middot; lenexux.com</span>
    </div>
    <div class="legal">
      Donnees hebergees au Canada et aux Etats-Unis.<br>
      Loi 25 et RGPD &mdash; sous-traitants nommes.<br>
      Espaces clients cloisonnes &middot; aucun acces a vos systemes.
    </div>
  </div>
</div>
"""

# Les accents sont ecrits en clair ici, puis reinjectes : le fichier reste lisible
# et l'encodage traverse sans risque les outils intermediaires.
ACCENTS = [
    ('dependances', 'dépendances'), ('dependance', 'dépendance'), ('Dependances', 'Dépendances'),
    ('operationnel', 'opérationnel'), ('activite', 'activité'), ('patisse', 'pâtisse'),
    ('systeme', 'système'), ('Systemes', 'Systèmes'), ('systemes', 'systèmes'),
    ('cle devient', 'clé devient'), ('arrete', 'arrête'), ('derriere', 'derrière'),
    ('jusqu&rsquo;ou', 'jusqu&rsquo;où'), ('coute par heure', 'coûte par heure'),
    ('repond', 'répond'), ('reelles', 'réelles'), ('probleme', 'problème'),
    ('couteuses', 'coûteuses'), ('decouvre', 'découvre'), ('element', 'élément'),
    ('elements', 'éléments'), ('ou il tombe', 'où il tombe'), ('Decisions a l', 'Décisions à l'),
    ('chiffrer l&rsquo;arret', 'chiffrer l&rsquo;arrêt'), ('modele relie a', 'modèle relié à'),
    ('decision, en treize', 'décision, en treize'), ('identite', 'identité'),
    ('employes', 'employés'), ('cela va', 'cela va'), ('Reponse', 'Réponse'),
    ('touches', 'touchés'), ('cliquable jusqu&rsquo;a', 'cliquable jusqu&rsquo;à'),
    ('traversees', 'traversées'), ('nomme.', 'nommé.'), ('deja ecrit', 'déjà écrit'),
    ('estime', 'estimé'), ('demonstration', 'démonstration'), ('reproductibles en seance',
    'reproductibles en séance'), ('ca marche', 'ça marche'), ('decision chiffree', 'décision chiffrée'),
    ('acces a vos', 'accès à vos'), ('demande.</span>', 'demandé.</span>'),
    ('Reveler', 'Révéler'), ('defaillance', 'défaillance'), ('Simuler</b><span>Panne',
    'Simuler</b><span>Panne'), ('decision : la cascade', 'décision : la cascade'),
    ('Decider', 'Décider'), ('Mitigations priorisees', 'Mitigations priorisées'),
    ('rapport executif, chiffres a l', 'rapport exécutif, chiffres à l'),
    ('c&rsquo;est different', 'c&rsquo;est différent'), ('remplacons', 'remplaçons'),
    ('avez deja', 'avez déjà'), ('si cela tombe', 'si cela tombe'), ('connait', 'connaît'),
    ('detenus', 'détenus'), ('conformite', 'conformité'), ('saisis a la main et notes',
    'saisis à la main et notés'), ('eleve / moyen', 'élevé / moyen'), ('calcules', 'calculés'),
    ('a partir de dependances', 'à partir de dépendances'), ('chiffres en dollars',
    'chiffrés en dollars'), ('continuite', 'continuité'), ('ete teste', 'été testé'),
    ('vieillit des le lendemain', 'vieillit dès le lendemain'), ('redaction', 'rédaction'),
    ('scenario se rejoue a la demande', 'scénario se rejoue à la demande'),
    ('donnees rafraichies', 'données rafraîchies'), ('cela vous demande', 'cela vous demande'),
    ('d&rsquo;integration', 'd&rsquo;intégration'), ('acces administrateur', 'accès administrateur'),
    ('premiere semaine', 'première semaine'), ('cles, puis', 'clés, puis'),
    ('branchees', 'branchées'), ('scenarios en comite', 'scénarios en comité'),
    ('Chaine critique', 'Chaîne critique'), ('processus metier, cartographie, chiffre et presente',
    'processus métier, cartographié, chiffré et présenté'), ('Duree', 'Durée'),
    ('Perimetre', 'Périmètre'), ('Engagement ecrit', 'Engagement écrit'),
    ('terme des six semaines', 'terme des six semaines'), ('chacun chiffre. A defaut',
    'chacun chiffré. À défaut'), ('la moitie', 'la moitié'), ('Sainte-Cecile', 'Sainte-Cécile'),
    ('Donnees hebergees', 'Données hébergées'), ('Etats-Unis', 'États-Unis'),
    ('sous-traitants nommes', 'sous-traitants nommés'), ('cloisonnes', 'cloisonnés'),
    ('Demo en un clic', 'Démo en un clic'), ('angles morts des aujourd', 'angles morts dès aujourd'),
    ('demonstration fourni', 'démonstration fourni'), ('panne a la', 'panne à la'),
]

body = BODY.replace('__MARK_DARK__', mark('#ffffff', '#22c9e4')).replace('__QR__', QR)
for plain, accented in ACCENTS:
    body = body.replace(plain, accented)

html = (
    '<!doctype html>\n<html lang="fr"><head><meta charset="utf-8">'
    '<title>Prospectus Lenexux</title>'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
    'family=Geist:wght@400;500;600;700&family=Inter:wght@400;500;600&'
    'family=JetBrains+Mono:wght@400;500&display=block">'
    '<style>' + CSS + '</style></head><body>' + body + '</body></html>\n'
)
out = os.path.join(HERE, 'prospectus.html')
io.open(out, 'w', encoding='utf-8').write(html)
print('ecrit :', out, len(html), 'octets')
