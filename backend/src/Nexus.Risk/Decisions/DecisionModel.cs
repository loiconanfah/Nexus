namespace Nexus.Risk.Decisions;

/// <summary>
/// Types de décision pris en charge. Volontairement génériques : ils décrivent
/// ce qui change dans l'organisation (une personne, un outil, un fournisseur,
/// un site, un processus), quel que soit le secteur ou le pays.
/// </summary>
public static class DecisionKinds
{
    public const string Hire = "hire";                 // recruter un rôle / une expertise
    public const string Replace = "replace";           // remplacer une personne par une autre
    public const string Departure = "departure";       // départ sans remplaçant désigné
    public const string NewTool = "new-tool";          // introduire un outil / système
    public const string ReplaceTool = "replace-tool";  // remplacer ou migrer un outil
    public const string Upgrade = "upgrade";           // mettre à jour un système existant
    public const string ChangeSupplier = "change-supplier";
    public const string OpenSite = "open-site";
    public const string CloseSite = "close-site";
    public const string Automate = "automate";         // automatiser un processus (IA, logiciel)

    public static readonly string[] All =
        [Hire, Replace, Departure, NewTool, ReplaceTool, Upgrade, ChangeSupplier, OpenSite, CloseSite, Automate];
}

/// <summary>Un outil ou service introduit par la décision (le nouvel expert apporte souvent ses outils).</summary>
public sealed record ToolSpec(
    string Name,
    string? Type = null,              // Application, AiService, CloudResource…
    string? Supplier = null,          // éditeur / fournisseur, s'il est externe
    bool External = false,            // hébergé hors de l'organisation (SaaS, cloud, API IA)
    bool OutsideCountry = false,      // données traitées hors du pays du siège
    double? OneOffCost = null,        // achat, installation, mise en service
    double? AnnualCost = null);       // abonnement, licences, maintenance

/// <summary>
/// Décision décrite de façon structurée. Tous les montants sont dans la devise
/// de l'espace. Un champ absent n'est jamais inventé en silence : il devient une
/// hypothèse explicitement signalée, ou une information manquante.
/// </summary>
public sealed record DecisionSpec(
    string Kind,
    string? Title = null,
    Guid? SubjectId = null,                   // élément existant concerné
    string? NewName = null,                   // rôle recruté, outil, fournisseur ou site nouveau
    string? NewType = null,                   // type d'entité du nouvel élément
    IReadOnlyList<Guid>? Serves = null,       // activités que le nouvel élément sert
    IReadOnlyList<Guid>? Uses = null,         // systèmes / données existants qu'il utilisera
    IReadOnlyList<ToolSpec>? Tools = null,    // outils nouveaux qu'il faut acquérir
    bool External = false,
    bool OutsideCountry = false,
    double? AnnualSalary = null,              // salaire chargé annuel (recrutement, remplaçant)
    int? Headcount = null,                    // nombre de personnes (site, équipe)
    double? OneOffCost = null,
    double? AnnualCost = null,                // coût annuel du nouvel élément
    double? AnnualCostRemoved = null,         // coût annuel qui disparaît (ancien outil, site fermé…)
    int? OverlapMonths = null,                // recouvrement / fonctionnement en parallèle
    double? DayRate = null,                   // tarif journalier d'intégration / de conseil
    int? IntegrationDaysEach = null,          // jours d'intégration par système connecté
    int? TrainingHoursPerPerson = null,
    int? CutoverHours = null,                 // durée d'interruption prévue à la bascule
    double? ExpectedAnnualGain = null,        // gain annuel attendu (saisi, ou suggéré et signalé comme tel)
    double? HoursSavedPerMonth = null,        // automatisation : heures libérées par mois
    string? GainRationale = null,
    // Champs proposés par l'assistant (IA ou graphe) et pas encore confirmés par
    // l'utilisateur : leurs montants restent affichés comme « suggérés ».
    IReadOnlyList<string>? Suggested = null);

/// <summary>Contexte chiffré de l'organisation (profil + réglages d'impact).</summary>
public sealed record DecisionContext(
    string Currency,
    double AnnualRevenue,
    int Headcount,
    string OperatingMode,
    double? AverageSalary,
    string? Country,
    ImpactTuning Tuning);

public sealed record NodeRef(string Id, string Name, string Type);

public sealed record EdgeRef(string Source, string SourceName, string Target, string TargetName, string Type);

/// <summary>Constat du diagnostic : ce que le graphe révèle sur la décision.</summary>
public sealed record Finding(string Severity, string Code, string Text, IReadOnlyList<NodeRef> Nodes);

public sealed record GraphDiff(
    IReadOnlyList<NodeRef> AddedNodes, IReadOnlyList<EdgeRef> AddedEdges,
    IReadOnlyList<NodeRef> RemovedNodes, IReadOnlyList<EdgeRef> RemovedEdges,
    IReadOnlyList<NodeRef> Impacted);

/// <summary>Résilience mesurée sur le graphe (avant / après la décision).</summary>
public sealed record Resilience(
    int Score, int SinglePointsOfFailure, int KeyPeople, int SoleKnowledgeSystems,
    double MaxSupplierShare, string? MostConcentratedSupplier, int Elements);

/// <summary>
/// Une ligne de chiffrage. <c>Source</c> dit d'où vient le montant :
/// input (saisi), graph (compté dans le graphe), engine (moteur d'impact),
/// assumption (hypothèse — à confirmer), suggested (proposé par l'assistant, non confirmé).
/// </summary>
public sealed record CostLine(string Key, string Label, double Year1, double Recurring, string Source, string Basis);

public sealed record PlanPhase(string Title, int Weeks, IReadOnlyList<string> Items);

public sealed record DecisionTotals(
    double Year1Cost, double RecurringCost, double Year1Benefit, double RecurringBenefit,
    double TransitionRisk, double? PaybackMonths, int AssumptionLines);

public sealed record DecisionReport(
    string Kind,
    string Headline,
    NodeRef? Subject,
    IReadOnlyList<Finding> Findings,
    GraphDiff Diff,
    Resilience Before,
    Resilience After,
    IReadOnlyList<CostLine> Costs,
    IReadOnlyList<CostLine> Benefits,
    DecisionTotals Totals,
    IReadOnlyList<PlanPhase> Plan,
    IReadOnlyList<string> MustKnow,
    IReadOnlyList<string> MissingInputs,
    string Verdict,
    string VerdictText,
    double Confidence,
    string Currency);
