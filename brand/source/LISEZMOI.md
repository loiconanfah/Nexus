# Sources des documents de marque

## Régénérer le prospectus

    python brand/source/build_prospectus.py
    chrome --headless=new --no-pdf-header-footer --virtual-time-budget=15000 \
      --print-to-pdf=brand/Prospectus-Lenexux.pdf file:///<chemin>/prospectus.html

`build_prospectus.py` produit `prospectus.html` ; Chrome l'imprime en PDF.
Le logo et le code QR sont des tracés vectoriels inclus dans la page : le PDF
reste net quelle que soit la taille d'impression.

Le prix, la durée du pilote et les chiffres de démonstration sont dans la
constante `BODY` du script — c'est là qu'on les met à jour.

## Régénérer la brochure (4 pages A4)

    python brand/source/build_brochure.py
    chrome --headless=new --no-pdf-header-footer --virtual-time-budget=15000       --print-to-pdf=brand/Brochure-Lenexux.pdf file:///<chemin>/brochure.html

Registre marketing, à remettre en rendez-vous ou à joindre à un courriel.
Les constellations de fond sont dessinées par `constellation()` à partir d'une
graine fixe : la brochure se régénère à l'identique. Changer la graine change le
nuage.

Le prospectus dense (2 pages) reste disponible pour les échanges techniques.

## Régénérer le document de concept (8 pages A4)

    python brand/source/build_concept.py
    chrome --headless=new --no-pdf-header-footer --virtual-time-budget=18000       --print-to-pdf=brand/Concept-Lenexux.pdf file:///<chemin>/concept.html

Destiné aux investisseurs, aux incubateurs et aux prospects qui veulent
comprendre le fond : raison d'être, architecture, moteur de confiance,
positionnement, modèle d'adoption, état d'avancement.

`build_concept.py` IMPORTE `build_brochure.py` : logo, icônes, constellations et
feuille de style sont partagés, les deux documents ne peuvent donc pas diverger.
Modifier la mise en forme de la brochure modifie aussi le document de concept —
régénérer les deux après un changement de style.

Les fiabilités des sources de preuve (page 5) reprennent les valeurs réelles de
`backend/src/Nexus.Domain/ValueObjects/EvidenceSource.cs`. Si elles changent dans
le code, les mettre à jour dans la constante `SOURCES`.

## Régénérer le pitch deck (16 diapositives 16:9)

    python brand/source/build_pitch.py
    chrome --headless=new --no-pdf-header-footer --virtual-time-budget=20000       --print-to-pdf=brand/Pitch-Lenexux.pdf file:///<chemin>/pitch.html

Porte l'histoire du nom — Living Enterprise Nexus, dont le S devient un X — et
la promesse fondatrice : « Show me what breaks, why, what it affects, and what
to fix first. » Importe build_brochure.py, comme le document de concept.

## Régénérer la charte graphique

    chrome --headless=new --no-pdf-header-footer --virtual-time-budget=15000 \
      --print-to-pdf=brand/Charte-graphique-Lenexux.pdf file:///<chemin>/charte.html

## Le code QR

`qr-path.txt` contient le tracé du code QR vers https://lenexux.com/, en
correction d'erreur maximale (niveau H) : un code imprimé se salit, se plie et
se photographie de travers. Pour changer l'adresse :

    python -c "import qrcode,qrcode.image.svg; q=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H,border=0); q.add_data('https://…'); q.make(fit=True); q.make_image(image_factory=qrcode.image.svg.SvgPathImage).save('qr.svg')"

puis recopier l'attribut `d` du tracé dans `qr-path.txt`.

## Les fichiers maîtres du logo

`brand/lenexux-logo-*.svg` — principal, inversé, monochrome noir, monochrome
blanc. Ce sont eux qu'on remet à un imprimeur ou à un partenaire, jamais une
capture d'écran.
