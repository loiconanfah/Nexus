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
