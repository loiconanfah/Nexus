#!/usr/bin/env bash
# Installation des dépendances sur Vercel.
#
# Le pré-rendu ouvre chaque page dans Chrome. Le navigateur est fourni par
# puppeteer, mais l'image de construction de Vercel n'embarque pas les
# bibliothèques système dont il a besoin : il s'arrête sur « libnspr4.so:
# cannot open shared object file ».
#
# On les ajoute donc ici. L'échec est toléré (« || true ») : sans elles le
# pré-rendu est simplement ignoré, avec un avertissement bien visible, alors
# qu'une erreur ici bloquerait TOUT le déploiement, correctifs compris.
set -u

LIBS="nspr nss nss-util atk at-spi2-atk at-spi2-core cups-libs libdrm \
libxkbcommon libX11 libXcomposite libXdamage libXext libXfixes libXrandr \
mesa-libgbm alsa-lib pango cairo expat"

echo "[install] bibliothèques système pour Chrome"
if command -v dnf > /dev/null 2>&1; then
  dnf install -y $LIBS > /dev/null 2>&1 || echo "[install] dnf indisponible ou refusé, pré-rendu possiblement ignoré"
elif command -v yum > /dev/null 2>&1; then
  yum install -y $LIBS > /dev/null 2>&1 || echo "[install] yum indisponible ou refusé, pré-rendu possiblement ignoré"
elif command -v apt-get > /dev/null 2>&1; then
  apt-get update > /dev/null 2>&1 && apt-get install -y libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libpango-1.0-0 > /dev/null 2>&1 || echo "[install] apt indisponible ou refusé, pré-rendu possiblement ignoré"
else
  echo "[install] aucun gestionnaire de paquets, pré-rendu possiblement ignoré"
fi

npm install
