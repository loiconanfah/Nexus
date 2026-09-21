/*
  Listes partagées par l'inscription et l'assistant de démarrage : les réponses
  données à l'inscription pré-remplissent l'assistant, les valeurs doivent donc
  être strictement les mêmes (et les mêmes que côté serveur).
*/

export const SECTOR_LABELS: Record<string, [string, string]> = {
  microfinance: ['Microfinance', 'Microfinance'],
  banking: ['Banque', 'Banking'],
  insurance: ['Assurance', 'Insurance'],
  telecom: ['Télécommunications', 'Telecommunications'],
  health: ['Santé', 'Healthcare'],
  public: ['Secteur public', 'Public sector'],
  energy: ['Énergie & services publics', 'Energy & utilities'],
  manufacturing: ['Industrie', 'Manufacturing'],
  logistics: ['Transport & logistique', 'Transport & logistics'],
  retail: ['Commerce & distribution', 'Retail & distribution'],
  'it-services': ['Services informatiques', 'IT services'],
  education: ['Éducation', 'Education'],
  other: ['Autre', 'Other'],
}

export const SIZE_LABELS: Record<string, [string, string]> = {
  '1-49': ['Moins de 50 personnes', 'Fewer than 50 people'],
  '50-199': ['50 à 199 personnes', '50 to 199 people'],
  '200-999': ['200 à 999 personnes', '200 to 999 people'],
  '1000-1999': ['1 000 à 1 999 personnes', '1,000 to 1,999 people'],
  '2000+': ['2 000 personnes et plus', '2,000 people or more'],
}

// Pays proposés, avec leur devise usuelle (même table que le serveur).
export const COUNTRIES: { code: string; fr: string; en: string; currency: string }[] = [
  { code: 'CM', fr: 'Cameroun', en: 'Cameroon', currency: 'XAF' },
  { code: 'CA', fr: 'Canada', en: 'Canada', currency: 'CAD' },
  { code: 'FR', fr: 'France', en: 'France', currency: 'EUR' },
  { code: 'BE', fr: 'Belgique', en: 'Belgium', currency: 'EUR' },
  { code: 'CH', fr: 'Suisse', en: 'Switzerland', currency: 'CHF' },
  { code: 'SN', fr: 'Sénégal', en: 'Senegal', currency: 'XOF' },
  { code: 'CI', fr: 'Côte d’Ivoire', en: 'Côte d’Ivoire', currency: 'XOF' },
  { code: 'GA', fr: 'Gabon', en: 'Gabon', currency: 'XAF' },
  { code: 'CG', fr: 'Congo', en: 'Congo', currency: 'XAF' },
  { code: 'TD', fr: 'Tchad', en: 'Chad', currency: 'XAF' },
  { code: 'CF', fr: 'Centrafrique', en: 'Central African Republic', currency: 'XAF' },
  { code: 'GQ', fr: 'Guinée équatoriale', en: 'Equatorial Guinea', currency: 'XAF' },
  { code: 'BJ', fr: 'Bénin', en: 'Benin', currency: 'XOF' },
  { code: 'BF', fr: 'Burkina Faso', en: 'Burkina Faso', currency: 'XOF' },
  { code: 'ML', fr: 'Mali', en: 'Mali', currency: 'XOF' },
  { code: 'NE', fr: 'Niger', en: 'Niger', currency: 'XOF' },
  { code: 'TG', fr: 'Togo', en: 'Togo', currency: 'XOF' },
  { code: 'MA', fr: 'Maroc', en: 'Morocco', currency: 'MAD' },
  { code: 'US', fr: 'États-Unis', en: 'United States', currency: 'USD' },
  { code: 'GB', fr: 'Royaume-Uni', en: 'United Kingdom', currency: 'GBP' },
  { code: 'LU', fr: 'Luxembourg', en: 'Luxembourg', currency: 'EUR' },
  { code: 'ZZ', fr: 'Autre pays', en: 'Other country', currency: 'USD' },
]
