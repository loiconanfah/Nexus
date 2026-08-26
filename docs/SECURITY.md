# NEXUS — Sécurité

Version : 1.0 (Phase 0) · Articles 3, 22, 41-46

La sécurité est structurante, pas un ajout. NEXUS manipule la carte des dépendances critiques d'une organisation : cette donnée est elle-même sensible et doit être protégée en conséquence.

---

## 1. Modèle de menace (résumé)

| Actif à protéger | Menace | Contre-mesure |
|---|---|---|
| Carte des dépendances (graphe) | fuite inter-tenant | isolation `tenantId` systématique + tests d'isolation |
| Secrets de connecteurs | vol de credentials sources | Azure Key Vault, managed identities, jamais en base ni en clair |
| Systèmes sources | écriture accidentelle/malveillante | **read-only first** (article 3), écriture désactivée par défaut |
| API | abus, injection, escalade | OIDC, RBAC, validation, rate limiting, OWASP |
| Réponses IA | inférence présentée comme fait, action destructive | guardrails (article 22) |

---

## 2. Read-only first (article 3)

Toutes les premières intégrations sont **en lecture seule**. NEXUS lit, normalise, corrèle, analyse, simule, recommande — il **ne modifie pas** les systèmes sources.

Toute capacité d'écriture éventuelle est :
- **désactivée par défaut** (`connector.is_read_only = true`) ;
- **explicitement autorisée** (permission dédiée + configuration) ;
- **auditée** (chaque écriture journalisée) ;
- **limitée** (portée minimale).

---

## 3. Identité & authentification

- **OAuth 2.0 / OpenID Connect** via **Microsoft Entra ID**.
- **MFA** délégué au fournisseur d'identité.
- Les utilisateurs NEXUS sont liés à Entra via `app_user.external_id` (claim `sub`).
- En développement local, un stub d'authentification permet de travailler sans Entra (jamais activé hors `local`/`development`).

---

## 4. Autorisation — RBAC (articles 41-42)

**Rôles** : `platform_admin`, `org_admin`, `risk_manager`, `security_analyst`, `it_manager`, `executive`, `auditor`, `read_only`.

**Permissions granulaires** (extrait) :

```text
assets.read        assets.write
graph.read         risks.read        risks.manage
simulations.execute
documents.read     ai.use
reports.generate   integrations.manage
admin.manage
```

- Principe du **moindre privilège** : chaque rôle ne reçoit que les permissions nécessaires.
- L'autorisation est vérifiée côté API (policies ASP.NET Core) **et** filtrée par `tenantId`.

---

## 5. Isolation multi-tenant (article 41)

- Chaque entité PostgreSQL et chaque noeud/relation Neo4j porte `tenantId`.
- Le `tenantId` provient **du token** (jamais d'un paramètre client).
- Toute requête (SQL, Cypher, vectorielle) est filtrée par `tenantId`.
- Durcissement prévu : Row-Level Security PostgreSQL ; bases/labels séparés en mode *private cloud*/*on-prem*.
- **Tests d'isolation** obligatoires (article 51) : un tenant ne doit jamais lire les données d'un autre.

---

## 6. Zero Trust (article 46)

- Chaque utilisateur est **non fiable par défaut**.
- Chaque appel API est **authentifié**.
- Chaque service est **explicitement autorisé** (managed identities côté Azure).
- Segmentation réseau et moindre privilège partout.

---

## 7. Secrets

- **Aucun secret dans Git** (article 72) — `.gitignore` bloque `.env`, clés, `secrets.json`.
- Configuration par **variables d'environnement** (local) et **Azure Key Vault + managed identities** (cloud).
- Rotation des secrets prévue via Key Vault.

---

## 8. Durcissement applicatif (OWASP — article 45)

- HTTPS partout, HSTS, en-têtes de sécurité (CSP, X-Content-Type-Options, etc.).
- **Validation des entrées** (FluentValidation) et **encodage des sorties**.
- Requêtes paramétrées (EF Core, Cypher paramétré) — pas de concaténation.
- **Rate limiting** sur l'API.
- **Dependency scanning** (Dependabot/Renovate) + **container scanning** dans le pipeline.
- `NU1903` (vulnérabilités NuGet) traité en build — cf. correction de `Microsoft.OpenApi` en Phase 0.

---

## 9. Garde-fous IA (article 22)

L'IA doit :
- ne **pas inventer** ; citer ses **sources** ;
- distinguer **faits** et **hypothèses**, afficher le **niveau de confiance** ;
- signaler les **informations manquantes** ;
- ne jamais présenter une **inférence** comme un fait ;
- ne **jamais** modifier de données critiques sans validation, ni exécuter d'action destructive.

---

## 10. Audit (article 43)

Journalisation immuable (`audit_log`) de : login/logout, import, modification de données, validation de relation, modification de risque, simulation, requête IA, accès document, changement de permission, changement de connecteur. Rétention et export dédiés au rôle `auditor`.

---

## 11. Conformité & déploiements sensibles

Le mode **on-premises / hybride** (article 47) permet aux organisations hautement sensibles (gouvernement, santé, infrastructure) de garder l'ensemble des données dans leur périmètre. Architecture portable via Docker.
