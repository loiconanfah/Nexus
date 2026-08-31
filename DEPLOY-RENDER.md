# Déploiement de NEXUS sur Render.com

Guide pas-à-pas pour mettre NEXUS en ligne. La stack complète (SPA + API .NET +
PostgreSQL + Neo4j) est décrite dans [`render.yaml`](render.yaml) et se déploie
en un blueprint. Render fournit le **HTTPS**, les **sauvegardes Postgres** et le
**redéploiement automatique à chaque `git push`**.

---

## 1. Prérequis (à faire une fois)

1. **Un compte GitHub** avec ce dépôt poussé (voir § 2).
2. **Un compte Render** : https://render.com (gratuit pour démarrer).
3. **Une clé API Gemini** (Google AI Studio) — tu la colleras dans Render, jamais dans Git.

---

## 2. Pousser le dépôt sur GitHub

Render déploie depuis un dépôt Git connecté. Le dépôt local n'a pas encore de remote.

> ⚠️ Avant tout : `.env` est bien ignoré par Git (vérifié). **Ne jamais commiter de secret.**

Dépôt **privé** recommandé :

```bash
gh repo create nexus --private --source=. --remote=origin --push
```

(ou manuellement : créer le repo sur GitHub, puis `git remote add origin <url>` et `git push -u origin main`.)

---

## 3. Déployer le blueprint

1. Render → **New +** → **Blueprint**.
2. Sélectionner le dépôt `nexus`.
3. Render lit `render.yaml` et propose de créer **4 ressources** :
   `nexus-postgres`, `nexus-neo4j`, `nexus-api`, `nexus-web`.
4. **Apply**.

Render demande alors les valeurs des secrets marqués `sync: false`.

---

## 4. Renseigner les secrets

| Service | Variable | Valeur à mettre |
|---|---|---|
| `nexus-neo4j` | `NEO4J_AUTH` | `neo4j/<MOT_DE_PASSE_FORT>` (choisir un mot de passe) |
| `nexus-api` | `Nexus__Neo4j__Password` | **le même** `<MOT_DE_PASSE_FORT>` (sans le `neo4j/`) |
| `nexus-api` | `NEXUS_ADMIN_PASSWORD` | mot de passe de l'admin (pour se connecter) |
| `nexus-api` | `GEMINI_API_KEY` | ta clé Gemini |

- `NEXUS_JWT_KEY` est **généré automatiquement** par Render (ne pas y toucher).
- `NEXUS_ADMIN_EMAIL` vaut `admin@cgi.demo` par défaut (modifiable).
- Démo à inscriptions ouvertes : passer `NEXUS_ALLOW_REGISTRATION` à `true`.

---

## 5. Extensions PostgreSQL (une fois, au premier déploiement)

La base managée n'exécute pas le script d'init automatiquement. Ouvrir le shell
PSQL de `nexus-postgres` (onglet **Connect → PSQL**) et exécuter :

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

Puis, dans Render, **Manual Deploy → Clear build cache & deploy** sur `nexus-api`
pour rejouer les migrations proprement.

---

## 6. Vérifier l'URL de l'API

Le service web relaie `/api` vers l'API via un proxy. `render.yaml` suppose l'URL
`https://nexus-api.onrender.com`. **Si Render a attribué une URL différente** à
`nexus-api` (visible en haut de sa page), corriger les 3 destinations `rewrite`
dans `render.yaml`, committer, pousser → Render redéploie.

---

## 7. Ouvrir l'application

L'URL publique est celle de **`nexus-web`** (ex. `https://nexus-web.onrender.com`).

- Page de connexion → bouton **« Accès démo (CGI Inc.) »** = entrée en un clic.
- Ou se connecter avec `NEXUS_ADMIN_EMAIL` / `NEXUS_ADMIN_PASSWORD`.

---

## 8. Coûts (ordre de grandeur)

| Ressource | Démo | Production always-on |
|---|---|---|
| `nexus-web` (statique) | gratuit | gratuit |
| `nexus-postgres` | gratuit (expire ~30 j) | ~7 $/mois (basic) |
| `nexus-api` | starter ~7 $/mois | ~7 $/mois |
| `nexus-neo4j` | standard ~25 $/mois (2 Go RAM) | ~25 $/mois |
| **Total** | **~30-35 $/mois** | **~40 $/mois** |

> Le poste le plus cher est Neo4j (besoin de RAM pour GDS/APOC). Pour réduire :
> retirer le plugin `graph-data-science` de `render.yaml` s'il n'est pas utilisé
> au runtime, et tester le plan `starter`.

---

## 9. Domaine personnalisé (optionnel)

Sur `nexus-web` → **Settings → Custom Domains** → ajouter `nexus.tondomaine.com`
et suivre les instructions DNS. Render émet le certificat TLS automatiquement.

---

## 10. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| API ne démarre pas | Neo4j injoignable au boot | vérifier que `nexus-neo4j` est *live* et même région ; mot de passe cohérent |
| Erreur migration au boot | extensions Postgres absentes | exécuter le SQL du § 5 puis redéployer l'api |
| `/api` renvoie 404/CORS | mauvaise URL de proxy | corriger les `rewrite` du § 6 |
| L'IA reste en mode « RÈGLES » | clé Gemini absente/invalide | vérifier `GEMINI_API_KEY` sur `nexus-api` |
| Neo4j redémarre en boucle | OOM (RAM insuffisante) | passer `nexus-neo4j` sur un plan supérieur |

---

### Rappel sécurité
- Aucun secret dans Git : tout passe par les variables Render (`sync: false`).
- `NEXUS_JWT_KEY` généré par Render : **stable** — le changer invaliderait toutes les sessions.
- Prod : garder `NEXUS_ALLOW_REGISTRATION=false` sauf besoin explicite.
