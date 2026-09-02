# Sécurité — Lenexus

Ce document décrit le modèle de sécurité de Lenexus pour une revue de diligence
(design partners / pilotes). Il reflète l'état actuel et liste honnêtement les
travaux restants avant la mise en marché générale (GA).

## Modèle multi-tenant et isolation

- **Isolation par tenant** : chaque espace client a un `tenantId`. Le tenant est
  résolu depuis la revendication `tenant` du jeton JWT (`ClaimTenantProvider`).
- **Requêtes filtrées** : toutes les requêtes Neo4j filtrent les nœuds ET les
  relations par `tenantId` (`{ tenantId: $t }` + `WHERE r.tenantId = $t`) ; tous
  les stores Postgres filtrent par `tenant_id`. Audit du code effectué.
- **Tenant par en-tête** : le mode `X-Tenant-Id` (`AllowHeaderTenant`) sert
  uniquement aux démos. Il est **désactivé par défaut**, activable seulement via
  `NEXUS_ALLOW_HEADER_TENANT`, et **forcé à OFF en environnement Production**
  (ceinture de sécurité au démarrage).

## Authentification

- JWT signé (clé via `NEXUS_JWT_KEY` en production ; clé de dev sinon, avec
  avertissement au démarrage).
- SSO Microsoft Entra ID optionnel.
- Auto-inscription désactivable (`NEXUS_ALLOW_REGISTRATION=false`).
- Mots de passe hachés (jamais stockés en clair).

## Connecteurs (anti-SSRF)

- Le connecteur REST/JSON résout l'hôte (DNS) et **refuse** loopback, plages
  privées RFC1918, lien-local (dont `169.254.169.254` — métadonnées cloud),
  CGNAT, ULA IPv6 et multicast (`SsrfGuard`, 21 tests unitaires).
- Client HTTP dédié avec **redirections désactivées** (anti-contournement) et
  timeout de connexion.
- Connecteurs **lecture seule** par défaut.
- Risque résiduel connu : DNS-rebinding (atténué par la désactivation des
  redirections ; durcissement possible via connexion sur IP validée).

## Durcissement en place

- Rate limiting (limitation de débit) applicatif.
- Journalisation structurée (Serilog) + traçage/mesures OpenTelemetry.
- IA : les clés sont stockées **par tenant** ; les données client ne servent pas
  à entraîner de modèles.

## À faire avant la GA (honnête)

- [ ] **Pentest indépendant** de l'isolation multi-tenant et des connecteurs.
- [ ] Gestion de secrets robuste (coffre) et rotation des clés.
- [ ] Sauvegardes + plan de reprise (Postgres et Neo4j) documentés et testés.
- [ ] Monitoring/alerting et objectifs de niveau de service (SLO).
- [ ] Plafond de coût/quota LLM par tenant.
- [ ] Tests d'intégration d'isolation exécutés en CI (avec bases éphémères).
- [ ] Revue juridique des documents (`/legal`) et DPA finalisé.

## Signalement

Vulnérabilité : [courriel sécurité à définir]. Merci de ne pas divulguer
publiquement avant correction.
