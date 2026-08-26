# ADR-0008 — Intégrations read-only par défaut

Statut : **Accepté** · Date : Phase 0

## Contexte / Problème
NEXUS se connecte à des systèmes critiques (ERP, IAM, cloud, réseau, cybersécurité). Une écriture accidentelle ou malveillante dans une source serait catastrophique et détruirait la confiance. Le master prompt (article 3) impose le *read-only first*.

## Options
1. **Lecture/écriture dès le départ** — puissant mais dangereux, surface d'attaque et de bug élevée.
2. **Read-only par défaut**, écriture opt-in strictement encadrée.

## Décision
Option 2. NEXUS **lit, normalise, corrèle, analyse, simule, recommande** ; il ne modifie pas les systèmes sources. `connector.is_read_only = true` par défaut. Toute écriture éventuelle est désactivée par défaut, explicitement autorisée (permission dédiée), limitée en portée et **auditée**.

## Conséquences
- ✅ Sécurité et confiance maximales ; adoption facilitée (pas de risque pour les systèmes en place).
- ✅ Réduit la surface d'attaque et de responsabilité.
- ⚠️ Certaines fonctionnalités « d'action » (remédiation) seront limitées au MVP — cohérent avec les non-buts (article 55).
- ➡️ Un cadre d'écriture auditée pourra être conçu post-MVP si un cas d'usage le justifie.
