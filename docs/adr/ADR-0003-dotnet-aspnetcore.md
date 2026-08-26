# ADR-0003 — .NET 10 / ASP.NET Core pour le backend

Statut : **Accepté** · Date : Phase 0

## Contexte / Problème
Le backend doit être robuste, performant, orienté entreprise et attractif pour un acquéreur (intégrateurs, éditeurs enterprise, écosystème Microsoft/Azure — articles 61-62). Le master prompt fixe C# / .NET comme socle.

## Options
1. **.NET 10 / ASP.NET Core** — écosystème mature, EF Core, intégration Azure/Entra native, performances élevées.
2. Node/TypeScript backend — cohérent avec le frontend mais moins aligné avec la cible enterprise/Azure.
3. JVM (Java/Kotlin) — solide mais hors de la stack demandée.

## Décision
Option 1 : **.NET 10** (version installée : `10.0.101`), ASP.NET Core (contrôleurs), EF Core, FluentValidation, Serilog, OpenTelemetry. `Directory.Build.props` impose `nullable enable`, `ImplicitUsings`, `LangVersion latest`.

## Conséquences
- ✅ Alignement fort avec Azure / Entra ID / Azure OpenAI → réduit le coût d'intégration et augmente l'attrait pour un acquéreur de l'écosystème Microsoft.
- ✅ Outillage de test, d'analyse et de sécurité mature.
- ⚠️ `Microsoft.OpenApi` du template webapi présentait une vulnérabilité (NU1903) → épinglé en 2.12.2 dès la Phase 0. Les mises à jour majeures de packages seront validées (compat. source generators).
- ➡️ MediatR utilisé **seulement si réellement utile** (article 5).
