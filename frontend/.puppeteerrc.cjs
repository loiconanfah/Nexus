/*
  Où puppeteer installe son navigateur.

  Par défaut il l'écrit dans le dossier personnel de l'utilisateur, qui n'est
  pas conservé entre deux constructions sur Vercel : le pré-rendu se retrouvait
  alors sans navigateur et se contentait d'un avertissement, si bien que le
  site partait en production sans aucune page pré-rendue.

  En le plaçant dans node_modules, il est présent qu'il vienne du cache de
  construction ou d'une installation neuve.
*/
const { join } = require('node:path')

module.exports = {
  cacheDirectory: join(__dirname, 'node_modules', '.cache', 'puppeteer'),
}
