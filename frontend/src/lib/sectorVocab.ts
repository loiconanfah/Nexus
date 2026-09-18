/**
 * Vocabulaire des leviers financiers selon le secteur de l'organisation.
 *
 * Le moteur financier reste le même (volume × prix − coûts), mais chacun le lit
 * dans ses propres termes : « prêts actifs » pour une banque, « polices » pour un
 * assureur, « panier moyen » pour un commerce. Un secteur absent garde les
 * libellés génériques.
 */
type Label = { fr: string; en: string }
type Vocab = Partial<Record<'units' | 'avgPrice' | 'cogsPercent' | 'churnRate' | 'billableRatio' | 'marketing' | 'rnd', Label>>

const V: Record<string, Vocab> = {
  microfinance: {
    units: { fr: 'Prêts et comptes actifs (par an)', en: 'Active loans and accounts (per year)' },
    avgPrice: { fr: 'Produit moyen par prêt ou compte (intérêts + frais)', en: 'Average income per loan or account (interest + fees)' },
    cogsPercent: { fr: 'Coût du risque + refinancement (% du produit)', en: 'Cost of risk + funding (% of income)' },
    churnRate: { fr: 'Clients perdus par an (%)', en: 'Customers lost per year (%)' },
    billableRatio: { fr: 'Part du personnel en agence / terrain (%)', en: 'Share of staff in branches / field (%)' },
    marketing: { fr: 'Commercial & sensibilisation', en: 'Sales & outreach' },
    rnd: { fr: 'Nouveaux produits & digital', en: 'New products & digital' },
  },
  banking: {
    units: { fr: 'Prêts et comptes actifs (par an)', en: 'Active loans and accounts (per year)' },
    avgPrice: { fr: 'Produit net moyen par client', en: 'Average net income per customer' },
    cogsPercent: { fr: 'Coût du risque + refinancement (% du produit)', en: 'Cost of risk + funding (% of income)' },
    churnRate: { fr: 'Clients perdus par an (%)', en: 'Customers lost per year (%)' },
    billableRatio: { fr: 'Part du personnel en réseau d’agences (%)', en: 'Share of staff in branch network (%)' },
    rnd: { fr: 'Nouveaux produits & digital', en: 'New products & digital' },
  },
  insurance: {
    units: { fr: 'Contrats en portefeuille', en: 'Policies in force' },
    avgPrice: { fr: 'Prime moyenne annuelle', en: 'Average annual premium' },
    cogsPercent: { fr: 'Sinistralité (% des primes)', en: 'Loss ratio (% of premiums)' },
    churnRate: { fr: 'Résiliations par an (%)', en: 'Cancellations per year (%)' },
    billableRatio: { fr: 'Part du personnel en gestion des sinistres (%)', en: 'Share of staff in claims handling (%)' },
  },
  telecom: {
    units: { fr: 'Abonnés actifs', en: 'Active subscribers' },
    avgPrice: { fr: 'Revenu annuel moyen par abonné', en: 'Average annual revenue per subscriber' },
    cogsPercent: { fr: 'Réseau, interconnexion & terminaux (% du revenu)', en: 'Network, interconnect & devices (% of revenue)' },
    churnRate: { fr: 'Désabonnement annuel (%)', en: 'Annual churn (%)' },
    billableRatio: { fr: 'Part du personnel technique & réseau (%)', en: 'Share of technical & network staff (%)' },
  },
  health: {
    units: { fr: 'Patients ou actes par an', en: 'Patients or procedures per year' },
    avgPrice: { fr: 'Recette moyenne par patient ou acte', en: 'Average revenue per patient or procedure' },
    cogsPercent: { fr: 'Médicaments & consommables (% des recettes)', en: 'Drugs & consumables (% of revenue)' },
    churnRate: { fr: 'Patients perdus par an (%)', en: 'Patients lost per year (%)' },
    billableRatio: { fr: 'Part du personnel soignant (%)', en: 'Share of care staff (%)' },
  },
  public: {
    units: { fr: 'Dossiers ou usagers servis par an', en: 'Cases or users served per year' },
    avgPrice: { fr: 'Ressource moyenne par dossier (budget, recettes)', en: 'Average resource per case (budget, revenue)' },
    cogsPercent: { fr: 'Coûts directs de service (% des ressources)', en: 'Direct service costs (% of resources)' },
    churnRate: { fr: 'Variation annuelle d’usagers (%)', en: 'Annual change in users (%)' },
    billableRatio: { fr: 'Part des agents au contact des usagers (%)', en: 'Share of front-line staff (%)' },
    marketing: { fr: 'Communication', en: 'Communication' },
  },
  energy: {
    units: { fr: 'Clients ou volume livré (MWh, m³…)', en: 'Customers or volume delivered (MWh, m³…)' },
    avgPrice: { fr: 'Prix moyen par client ou par unité livrée', en: 'Average price per customer or unit delivered' },
    cogsPercent: { fr: 'Achat d’énergie & réseau (% du revenu)', en: 'Energy purchase & grid (% of revenue)' },
    billableRatio: { fr: 'Part du personnel d’exploitation (%)', en: 'Share of operations staff (%)' },
  },
  manufacturing: {
    units: { fr: 'Unités produites vendues', en: 'Units produced and sold' },
    avgPrice: { fr: 'Prix de vente moyen', en: 'Average selling price' },
    cogsPercent: { fr: 'Matières & coûts de production (% du revenu)', en: 'Materials & production costs (% of revenue)' },
    churnRate: { fr: 'Clients perdus par an (%)', en: 'Customers lost per year (%)' },
    billableRatio: { fr: 'Part du personnel de production (%)', en: 'Share of production staff (%)' },
  },
  logistics: {
    units: { fr: 'Expéditions ou tournées par an', en: 'Shipments or routes per year' },
    avgPrice: { fr: 'Tarif moyen par expédition', en: 'Average price per shipment' },
    cogsPercent: { fr: 'Carburant, sous-traitance & péages (% du revenu)', en: 'Fuel, subcontracting & tolls (% of revenue)' },
    billableRatio: { fr: 'Part du personnel d’exploitation (%)', en: 'Share of operations staff (%)' },
  },
  retail: {
    units: { fr: 'Tickets / transactions par an', en: 'Receipts / transactions per year' },
    avgPrice: { fr: 'Panier moyen', en: 'Average basket' },
    cogsPercent: { fr: 'Coût des marchandises vendues (% du revenu)', en: 'Cost of goods sold (% of revenue)' },
    churnRate: { fr: 'Clients perdus par an (%)', en: 'Customers lost per year (%)' },
    billableRatio: { fr: 'Part du personnel en magasin (%)', en: 'Share of in-store staff (%)' },
  },
  education: {
    units: { fr: 'Apprenants inscrits', en: 'Enrolled learners' },
    avgPrice: { fr: 'Frais moyens par apprenant', en: 'Average fees per learner' },
    cogsPercent: { fr: 'Coûts pédagogiques directs (% des recettes)', en: 'Direct teaching costs (% of revenue)' },
    churnRate: { fr: 'Abandons par an (%)', en: 'Drop-outs per year (%)' },
    billableRatio: { fr: 'Part du personnel enseignant (%)', en: 'Share of teaching staff (%)' },
  },
  'it-services': {
    units: { fr: 'Jours ou projets facturés par an', en: 'Days or projects billed per year' },
    avgPrice: { fr: 'Prix moyen par jour ou projet', en: 'Average price per day or project' },
    billableRatio: { fr: 'Taux facturable (%)', en: 'Billable ratio (%)' },
  },
}

/** Libellé d'un levier pour le secteur donné, ou le libellé générique fourni. */
export function driverLabel(sector: string | undefined | null, key: string, fallback: Label): Label {
  const v = sector ? V[sector] : undefined
  return (v?.[key.toLowerCase() === 'rnd' ? 'rnd' : (key as keyof Vocab)] ?? fallback)
}
