namespace Nexus.Risk.Decisions;

/// <summary>
/// Moteur de décision fondé sur le graphe.
///
/// Une décision n'est pas une phrase traduite en variations de pourcentage :
/// c'est une MODIFICATION de l'organisation réelle. Le moteur l'applique sur une
/// copie du graphe, puis mesure ce qui change — savoir détenu, dépendances à
/// reconnecter, personnes à former, fournisseurs ajoutés, risque de transition —
/// et chiffre chaque ligne en disant d'où vient le montant.
///
/// Déterministe et sans IA : les mêmes entrées donnent toujours le même
/// rapport. Aucune règle n'est propre à un secteur ou à un pays ; le contexte
/// (devise, chiffre d'affaires, effectif, pays) vient du profil de l'espace.
/// </summary>
public sealed class DecisionEngine
{
    private const double WorkHoursPerYear = 1760;
    private const double WorkDaysPerYear = 220;

    private readonly GraphView _before;
    private readonly DecisionContext _ctx;
    private readonly bool _en;

    // Accumulateurs du rapport.
    private readonly List<Finding> _findings = [];
    private readonly List<CostLine> _costs = [];
    private readonly List<CostLine> _benefits = [];
    private readonly List<PlanPhase> _plan = [];
    private readonly List<string> _mustKnow = [];
    private readonly List<string> _missing = [];
    private readonly List<NodeRef> _addedNodes = [];
    private readonly List<EdgeRef> _addedEdges = [];
    private readonly List<NodeRef> _removedNodes = [];
    private readonly List<EdgeRef> _removedEdges = [];
    private readonly HashSet<string> _impacted = [];
    private double _transitionRisk;
    private GraphView _after = null!;

    public DecisionEngine(GraphView graph, DecisionContext ctx, string lang)
    {
        _before = graph;
        _ctx = ctx;
        _en = lang == "en";
    }

    private string L(string fr, string en) => _en ? en : fr;

    // ── Données de référence (saisies, sinon hypothèses signalées) ──────────

    private (double Value, string Source, string Basis) Salary(double? input)
    {
        if (input is > 0) return (input.Value, "input", L("Salaire chargé saisi", "Loaded salary entered"));
        if (_ctx.AverageSalary is > 0) return (_ctx.AverageSalary.Value, "profile", L("Salaire moyen du modèle d'entreprise", "Average salary from the enterprise model"));
        if (_ctx.AnnualRevenue > 0 && _ctx.Headcount > 0)
        {
            // Hypothèse prudente : la masse salariale chargée représente ~35 % du chiffre d'affaires.
            var est = Math.Round(_ctx.AnnualRevenue * 0.35 / _ctx.Headcount);
            _missing.Add(L("Salaire chargé du poste (estimé à partir du chiffre d'affaires et de l'effectif)", "Loaded salary for the role (estimated from revenue and headcount)"));
            return (est, "assumption", L("Estimé : 35 % du chiffre d'affaires ÷ effectif", "Estimated: 35% of revenue ÷ headcount"));
        }
        _missing.Add(L("Salaire chargé du poste", "Loaded salary for the role"));
        return (0, "assumption", L("Inconnu — à saisir", "Unknown — please enter"));
    }

    /// <summary>Coût horaire moyen d'une personne de l'organisation (sans signaler de champ manquant).</summary>
    private double HourlyLabour(double? salaryInput)
    {
        if (salaryInput is > 0) return salaryInput.Value / WorkHoursPerYear;
        if (_ctx.AverageSalary is > 0) return _ctx.AverageSalary.Value / WorkHoursPerYear;
        return _ctx.AnnualRevenue > 0 && _ctx.Headcount > 0 ? _ctx.AnnualRevenue * 0.35 / _ctx.Headcount / WorkHoursPerYear : 0;
    }

    private (double Value, string Source) DayRate(double? input)
    {
        if (input is > 0) return (input.Value, "input");
        var s = _ctx.AverageSalary is > 0 ? _ctx.AverageSalary.Value
              : _ctx.AnnualRevenue > 0 && _ctx.Headcount > 0 ? _ctx.AnnualRevenue * 0.35 / _ctx.Headcount : 0;
        return (Math.Round(s / WorkDaysPerYear * 1.5), "assumption");
    }

    /// <summary>
    /// Coût attendu d'une interruption de <paramref name="hours"/> heures d'un
    /// élément et de tout ce qui en dépend (même modèle que les simulations).
    /// </summary>
    private double OutageCost(GraphView g, string id, double hours)
    {
        var n = g.Get(id);
        if (n is null || hours <= 0) return 0;
        var total = BusinessImpactModel.CostPerHour(Crit(n), n.CostPerHour, _ctx.Tuning) * hours;
        foreach (var (dep, depth) in g.Dependents(id))
        {
            var d = g.Get(dep)!;
            total += BusinessImpactModel.CostPerHour(Crit(d), d.CostPerHour, _ctx.Tuning)
                     * BusinessImpactModel.FailureProbability(depth, _ctx.Tuning) * hours;
        }
        return Math.Round(total);
    }

    private readonly HashSet<string> _defaultedCriticality = [];

    /// <summary>
    /// Criticité effective. Un élément importé sans criticité (0) serait chiffré
    /// au plancher, ce qui sous-estime tout risque : on retient alors une valeur
    /// par défaut selon sa nature, et on le signale.
    /// </summary>
    private int Crit(GraphView.Node n)
    {
        if (n.Criticality > 0 || n.CostPerHour is > 0) return n.Criticality;
        _defaultedCriticality.Add(n.Id);
        return DefaultCriticality(n.Type);
    }

    public static int DefaultCriticality(string type) => type switch
    {
        "BusinessProcess" or "BusinessService" or "Process" => 70,
        "Database" or "DataStore" or "System" or "Application" or "Service" => 60,
        "Server" or "Infrastructure" or "Network" or "CloudResource" => 55,
        "Supplier" or "AiProvider" or "Location" => 55,
        "Person" or "Role" or "Team" => 50,
        _ => 45,
    };

    private NodeRef Ref(GraphView g, string id) { var n = g.Get(id)!; return new NodeRef(n.Id, n.Name, n.Type); }
    private IReadOnlyList<NodeRef> Refs(GraphView g, IEnumerable<string> ids) => ids.Where(i => g.Get(i) is not null).Select(i => Ref(g, i)).ToList();
    private string Names(GraphView g, IEnumerable<string> ids, int max = 4)
    {
        var list = ids.Select(i => g.Get(i)?.Name).Where(n => n is not null).ToList();
        if (list.Count == 0) return "—";
        return list.Count <= max ? string.Join(", ", list) : string.Join(", ", list.Take(max)) + L($" et {list.Count - max} autre(s)", $" and {list.Count - max} more");
    }

    private void Find(string severity, string code, string text, IEnumerable<string>? ids = null, GraphView? g = null)
        => _findings.Add(new Finding(severity, code, text, ids is null ? [] : Refs(g ?? _before, ids)));

    private void Cost(string key, string label, double year1, double recurring, string source, string basis)
    {
        if (Math.Abs(year1) < 0.5 && Math.Abs(recurring) < 0.5 && source != "assumption") return;
        _costs.Add(new CostLine(key, label, Math.Round(year1), Math.Round(recurring), source, basis));
    }

    private void Benefit(string key, string label, double year1, double recurring, string source, string basis)
        => _benefits.Add(new CostLine(key, label, Math.Round(year1), Math.Round(recurring), source, basis));

    private string NewId(string suffix) => $"new:{suffix}";

    private void AddNew(GraphView g, string id, string name, string type, int criticality = 50)
    {
        g.AddNode(new GraphView.Node(id, name, type, criticality, null));
        _addedNodes.Add(new NodeRef(id, name, type));
    }

    private void Link(GraphView g, string source, string target, string type)
    {
        if (g.Get(source) is null || g.Get(target) is null) return;
        g.AddEdge(source, target, type);
        _addedEdges.Add(new EdgeRef(source, g.Get(source)!.Name, target, g.Get(target)!.Name, type));
    }

    private void Remove(GraphView g, string id)
    {
        var n = g.Get(id);
        if (n is null) return;
        _removedNodes.Add(new NodeRef(n.Id, n.Name, n.Type));
        foreach (var e in g.RemoveNode(id))
            _removedEdges.Add(new EdgeRef(e.Source, _before.Get(e.Source)?.Name ?? e.Source, e.Target, _before.Get(e.Target)?.Name ?? e.Target, e.Type));
    }

    // ── Point d'entrée ──────────────────────────────────────────────────────

    public DecisionReport Analyze(DecisionSpec spec)
    {
        _after = _before.Clone();
        var subject = _before.Get(spec.SubjectId);

        switch (spec.Kind)
        {
            case DecisionKinds.Hire: Hire(spec); break;
            case DecisionKinds.Replace: PersonChange(spec, subject, replace: true); break;
            case DecisionKinds.Departure: PersonChange(spec, subject, replace: false); break;
            case DecisionKinds.NewTool: NewTool(spec); break;
            case DecisionKinds.ReplaceTool: ReplaceTool(spec, subject); break;
            case DecisionKinds.Upgrade: Upgrade(spec, subject); break;
            case DecisionKinds.ChangeSupplier: ChangeSupplier(spec, subject); break;
            case DecisionKinds.OpenSite: OpenSite(spec); break;
            case DecisionKinds.CloseSite: CloseSite(spec, subject); break;
            case DecisionKinds.Automate: Automate(spec, subject); break;
            default: throw new ArgumentException($"Type de décision inconnu : {spec.Kind}");
        }

        // Outils apportés par la décision (valable pour tous les types).
        if (spec.Kind != DecisionKinds.NewTool) Tools(spec, anchor: _addedNodes.FirstOrDefault()?.Id ?? subject?.Id);

        if (spec.OneOffCost is > 0 && spec.Kind is not (DecisionKinds.NewTool or DecisionKinds.ReplaceTool))
            Cost("oneoff", L("Coûts ponctuels déclarés", "Declared one-off costs"), spec.OneOffCost.Value, 0, "input", L("Saisi", "Entered"));

        if (spec.ExpectedAnnualGain is > 0)
            Benefit("gain", L("Gain annuel attendu", "Expected annual gain"), spec.ExpectedAnnualGain.Value, spec.ExpectedAnnualGain.Value, "input",
                string.IsNullOrWhiteSpace(spec.GainRationale) ? L("Saisi par le décideur", "Entered by the decision-maker") : spec.GainRationale!);
        else if (_benefits.Count == 0)
            _missing.Add(L("Gain attendu (chiffre d'affaires, économies, temps libéré) — sans lui, aucun retour sur investissement n'est calculé",
                           "Expected gain (revenue, savings, time freed) — without it, no payback is computed"));

        if (_defaultedCriticality.Count > 0)
            _missing.Add(L($"Criticité de {_defaultedCriticality.Count} élément(s) concerné(s) ({Names(_before, _defaultedCriticality, 3)}) : non renseignée, une valeur par défaut selon leur nature a été retenue pour chiffrer le risque",
                           $"Criticality of {_defaultedCriticality.Count} element(s) involved ({Names(_before, _defaultedCriticality, 3)}): not set, a default by type was used to price the risk"));

        var before = _before.Measure();
        var after = _after.Measure();
        CompareResilience(before, after);

        var year1 = _costs.Sum(c => c.Year1) + _transitionRisk;
        var recurring = _costs.Sum(c => c.Recurring);
        var benefitY1 = _benefits.Sum(b => b.Year1);
        var benefitRec = _benefits.Sum(b => b.Recurring);
        double? payback = null;
        var netMonthly = (benefitRec - recurring) / 12;
        if (benefitRec > 0 && netMonthly > 0) payback = Math.Round(Math.Max(0, year1 - recurring) / netMonthly, 1);
        var assumptions = _costs.Count(c => c.Source == "assumption") + _benefits.Count(b => b.Source == "assumption");

        var totals = new DecisionTotals(Math.Round(year1), Math.Round(recurring), Math.Round(benefitY1), Math.Round(benefitRec),
            Math.Round(_transitionRisk), payback, assumptions);

        var (verdict, verdictText) = Verdict(before, after, totals);
        var confidence = Confidence(spec, assumptions);

        return new DecisionReport(
            spec.Kind,
            Headline(spec, subject),
            subject is null ? null : new NodeRef(subject.Id, subject.Name, subject.Type),
            _findings.OrderBy(f => f.Severity switch { "danger" => 0, "warning" => 1, "positive" => 2, _ => 3 }).ToList(),
            new GraphDiff(_addedNodes, _addedEdges, _removedNodes, _removedEdges, Refs(_before, _impacted)),
            before, after,
            _costs, _benefits, totals, _plan, _mustKnow.Distinct().ToList(), _missing.Distinct().ToList(),
            verdict, verdictText, confidence, _ctx.Currency);
    }

    private string Headline(DecisionSpec s, GraphView.Node? subject)
    {
        if (!string.IsNullOrWhiteSpace(s.Title)) return s.Title!;
        var sub = subject?.Name ?? "";
        var neu = s.NewName ?? "";
        return s.Kind switch
        {
            DecisionKinds.Hire => L($"Recruter : {neu}", $"Hire: {neu}"),
            DecisionKinds.Replace => L($"Remplacer {sub}{(neu != "" ? $" par {neu}" : "")}", $"Replace {sub}{(neu != "" ? $" with {neu}" : "")}"),
            DecisionKinds.Departure => L($"Départ de {sub}", $"Departure of {sub}"),
            DecisionKinds.NewTool => L($"Introduire {neu}", $"Introduce {neu}"),
            DecisionKinds.ReplaceTool => L($"Remplacer {sub} par {neu}", $"Replace {sub} with {neu}"),
            DecisionKinds.Upgrade => L($"Mettre à jour {sub}", $"Upgrade {sub}"),
            DecisionKinds.ChangeSupplier => L($"Changer de fournisseur : {sub} → {neu}", $"Change supplier: {sub} → {neu}"),
            DecisionKinds.OpenSite => L($"Ouvrir le site {neu}", $"Open site {neu}"),
            DecisionKinds.CloseSite => L($"Fermer le site {sub}", $"Close site {sub}"),
            DecisionKinds.Automate => L($"Automatiser {sub}", $"Automate {sub}"),
            _ => s.Kind,
        };
    }

    // ── Personnes ───────────────────────────────────────────────────────────

    private void Hire(DecisionSpec s)
    {
        var name = string.IsNullOrWhiteSpace(s.NewName) ? L("Nouveau poste", "New role") : s.NewName!;
        var id = NewId("hire");
        AddNew(_after, id, name, string.IsNullOrWhiteSpace(s.NewType) ? "Role" : s.NewType!, 60);

        var uses = (s.Uses ?? []).Select(u => u.ToString()).Where(u => _before.Get(u) is not null).ToList();
        var serves = (s.Serves ?? []).Select(u => u.ToString()).Where(u => _before.Get(u) is not null).ToList();
        foreach (var u in uses) Link(_after, id, u, "KNOWS");
        foreach (var a in serves) Link(_after, a, id, "DEPENDS_ON");
        foreach (var x in uses.Concat(serves)) _impacted.Add(x);

        if (serves.Count == 0 && uses.Count == 0)
        {
            Find("warning", "hire.unanchored", L(
                "Le poste n'est rattaché à aucune activité ni à aucun système existant : impossible de mesurer ce qu'il apporte ou ce dont il aura besoin. Indiquez au moins les activités qu'il sert.",
                "The role is not linked to any existing activity or system: its contribution and needs cannot be measured. Specify at least the activities it serves."));
            _missing.Add(L("Activités servies et systèmes utilisés par le poste", "Activities served and systems used by the role"));
        }

        // Savoir : la personne devient-elle un secours, ou un nouveau point de fragilité ?
        var reliefs = uses.Where(u => _before.Holders(u).Count == 1).ToList();
        if (reliefs.Count > 0)
            Find("positive", "hire.backup", L(
                $"Le recrutement crée un second détenteur du savoir pour {Names(_before, reliefs)}, aujourd'hui entre les mains d'une seule personne.",
                $"The hire creates a second knowledge holder for {Names(_before, reliefs)}, currently held by a single person."), reliefs);

        var fresh = uses.Where(u => _before.Holders(u).Count == 0).ToList();
        if (fresh.Count > 0 || s.Tools is { Count: > 0 })
            Find("warning", "hire.new-key-person", L(
                $"{name} sera le seul à maîtriser {(fresh.Count > 0 ? Names(_before, fresh) : L("les nouveaux outils", "the new tools"))} : une nouvelle dépendance à une personne. Prévoir documentation et binôme dès l'arrivée.",
                $"{name} will be the only one mastering {(fresh.Count > 0 ? Names(_before, fresh) : "the new tools")}: a new dependency on one person. Plan documentation and a buddy from day one."), fresh);

        var data = uses.Where(u => GraphView.DataTypes.Contains(_before.Get(u)!.Type)).ToList();
        if (s.Tools?.Any(t => IsAi(t.Type, t.Name)) == true || IsAi(s.NewType, name))
        {
            if (data.Count == 0)
                Find("warning", "hire.ai-no-data", L(
                    "Aucune source de données n'est rattachée à ce poste orienté IA / données. Sans accès identifié aux données, l'apport restera théorique : indiquez les bases ou systèmes qu'il exploitera.",
                    "No data source is linked to this AI / data role. Without identified data access, the value stays theoretical: specify the databases or systems it will use."));
            else
                Find("info", "hire.ai-data", L(
                    $"Données exploitées : {Names(_before, data)}. Qualité, droits d'accès et cadre d'utilisation de ces données conditionnent le résultat.",
                    $"Data used: {Names(_before, data)}. Data quality, access rights and usage rules determine the outcome."), data);
            _mustKnow.Add(L("Définir qui valide les résultats produits par l'IA avant qu'ils n'influencent une décision (crédit, client, embauche…).",
                            "Define who validates AI outputs before they influence a decision (credit, customer, hiring…)."));
        }

        var (salary, src, basis) = Salary(s.AnnualSalary);
        var n = Math.Max(1, s.Headcount ?? 1);
        Cost("salary", L($"Rémunération chargée ({n} pers.)", $"Loaded pay ({n} pers.)"), salary * n, salary * n, src, basis);
        Cost("recruit", L("Recrutement (annonce, cabinet, temps interne)", "Recruitment (ads, agency, internal time)"), salary * n * 0.15, 0, "assumption",
            L("Hypothèse : 15 % du salaire annuel", "Assumption: 15% of annual salary"));
        Cost("ramp", L("Montée en compétence (3 mois à mi-productivité)", "Ramp-up (3 months at half productivity)"), salary * n * 0.125, 0, "assumption",
            L("Hypothèse : 3 mois × 50 % du salaire", "Assumption: 3 months × 50% of salary"));

        var weeksIntegration = Math.Max(2, uses.Count);
        _plan.Add(new PlanPhase(L("Recrutement", "Recruitment"), 8, [L("Fiche de poste liée aux activités servies", "Job description tied to the activities served"), L("Sélection et offre", "Selection and offer")]));
        _plan.Add(new PlanPhase(L("Intégration", "Onboarding"), weeksIntegration,
            uses.Select(u => L($"Accès et prise en main : {_before.Get(u)!.Name}", $"Access and onboarding: {_before.Get(u)!.Name}")).DefaultIfEmpty(L("Accès aux outils de travail", "Access to work tools")).ToList()));
        if (reliefs.Count > 0 || fresh.Count > 0)
            _plan.Add(new PlanPhase(L("Partage du savoir", "Knowledge sharing"), 4,
                reliefs.Select(r => L($"Binôme avec le détenteur actuel de {_before.Get(r)!.Name}", $"Pair with the current holder of {_before.Get(r)!.Name}"))
                    .Concat(fresh.Select(f => L($"Documenter {_before.Get(f)!.Name}", $"Document {_before.Get(f)!.Name}"))).ToList()));
    }

    private void PersonChange(DecisionSpec s, GraphView.Node? person, bool replace)
    {
        if (person is null)
        {
            Find("danger", "person.missing", L("Choisissez la personne ou le rôle concerné dans votre graphe.", "Choose the person or role in your graph."));
            _missing.Add(L("Personne ou rôle concerné", "Person or role concerned"));
            return;
        }

        var held = _before.HeldBy(person.Id).ToList();
        var sole = held.Where(h => _before.Holders(h).Count == 1).ToList();
        var shared = held.Except(sole).ToList();
        var affected = new Dictionary<string, int>();
        foreach (var h in held) foreach (var (k, d) in _before.Dependents(h)) affected.TryAdd(k, d);
        foreach (var (k, d) in _before.Dependents(person.Id)) affected.TryAdd(k, d);
        var activities = affected.Keys.Where(_before.IsActivity).ToList();
        foreach (var x in held.Concat(affected.Keys)) _impacted.Add(x);

        if (held.Count == 0)
            Find("info", "person.no-holdings", L(
                $"Le graphe ne relie {person.Name} à aucun système. Si cette personne détient un savoir important, déclarez-le (relation « connaît » / « maintient ») : sinon ce risque reste invisible.",
                $"The graph does not link {person.Name} to any system. If this person holds important knowledge, record it (\"knows\" / \"maintains\"): otherwise this risk stays invisible."));
        var plannedOverlap = replace && (s.OverlapMonths ?? 0) >= 1;
        if (sole.Count > 0 && plannedOverlap)
            Find("warning", "person.sole-holder", L(
                $"{person.Name} est le SEUL à détenir le savoir de {Names(_before, sole)}. Le recouvrement de {s.OverlapMonths} mois permet la transmission, à condition de la planifier dès maintenant (procédures écrites, accès, cas particuliers).",
                $"{person.Name} is the ONLY holder of the knowledge of {Names(_before, sole)}. The {s.OverlapMonths}-month overlap allows the handover, provided it is planned now (written procedures, access, edge cases)."), sole);
        else if (sole.Count > 0)
            Find("danger", "person.sole-holder", L(
                $"{person.Name} est le SEUL à détenir le savoir de {Names(_before, sole)}. Sans transmission, personne ne pourra intervenir sur ces systèmes après son départ.",
                $"{person.Name} is the ONLY holder of the knowledge of {Names(_before, sole)}. Without handover, nobody can intervene on these systems after the departure."), sole);
        if (shared.Count > 0)
            Find("info", "person.shared", L(
                $"Savoir partagé avec d'autres personnes : {Names(_before, shared)}.",
                $"Knowledge shared with others: {Names(_before, shared)}."), shared);
        if (activities.Count > 0)
            Find(sole.Count > 0 ? "warning" : "info", "person.activities", L(
                $"Activités qui en dépendent, directement ou par ces systèmes : {Names(_before, activities)}.",
                $"Activities depending on it, directly or through these systems: {Names(_before, activities)}."), activities);

        var access = _before.Accesses(person.Id);
        if (access.Count > 0)
            _mustKnow.Add(L($"Révoquer {access.Count} accès le jour du départ : {Names(_before, access, 6)}.",
                            $"Revoke {access.Count} access right(s) on departure day: {Names(_before, access, 6)}."));
        else
            _mustKnow.Add(L("Recenser et révoquer les comptes et accès de la personne le jour de son départ.",
                            "List and revoke the person's accounts and access rights on departure day."));

        var overlap = Math.Max(0, s.OverlapMonths ?? 0);
        string? successor = null;
        if (replace)
        {
            var name = string.IsNullOrWhiteSpace(s.NewName) ? L($"Remplaçant de {person.Name}", $"Successor of {person.Name}") : s.NewName!;
            successor = NewId("successor");
            AddNew(_after, successor, name, person.Type, person.Criticality);
            // Le remplaçant reprend les liens… mais pas le savoir tant qu'il n'a pas été transmis.
            _after.Rewire(person.Id, successor);
            _after.RemoveNode(person.Id);
            // Sans recouvrement, le savoir n'est pas transmis : le remplaçant n'en hérite pas.
            if (overlap == 0) _after.RemoveEdges(e => e.Source == successor && GraphView.IsKnowledge(e.Type));
            _removedNodes.Add(new NodeRef(person.Id, person.Name, person.Type));
            if (overlap == 0 && sole.Count > 0)
                Find("warning", "person.no-overlap", L(
                    "Aucun recouvrement prévu entre le départ et l'arrivée : le transfert de savoir repose alors sur la documentation existante.",
                    "No overlap planned between departure and arrival: knowledge transfer then relies on existing documentation."));
        }
        else
        {
            Remove(_after, person.Id);
        }

        // Risque de transition : probabilité qu'un incident survienne sur un système
        // dont le savoir est perdu ou en cours de transmission, sur la première année.
        var p = !replace ? 0.35 : overlap >= 2 ? 0.05 : overlap == 1 ? 0.12 : 0.25;
        var risk = sole.Sum(h => OutageCost(_before, h, BusinessImpactModel.RtoHours(_before.Get(h)!.Type, _before.Get(h)!.Criticality, _ctx.Tuning) * 2));
        _transitionRisk += risk * p;
        if (risk > 0)
            Cost("transition-risk", L("Risque de transition (incident sans personne compétente)", "Transition risk (incident with nobody competent)"), risk * p, 0, "engine",
                L($"Coût d'un arrêt prolongé (2 × délai de rétablissement) des systèmes détenus seul × probabilité {p:P0} (selon le recouvrement)",
                  $"Cost of an extended outage (2 × recovery time) of solely held systems × probability {p:P0} (depending on overlap)"));

        if (replace)
        {
            var (salary, src, basis) = Salary(s.AnnualSalary);
            Cost("recruit", L("Recrutement du remplaçant", "Recruiting the successor"), salary * 0.15, 0, "assumption", L("Hypothèse : 15 % du salaire annuel", "Assumption: 15% of annual salary"));
            if (overlap > 0)
                Cost("overlap", L($"Double rémunération pendant le recouvrement ({overlap} mois)", $"Double pay during overlap ({overlap} months)"), salary / 12 * overlap, 0, src, basis);
            Cost("ramp", L("Montée en compétence du remplaçant", "Successor ramp-up"), salary * (overlap >= 2 ? 0.08 : 0.15), 0, "assumption",
                L("Hypothèse : 1 à 2 mois à mi-productivité selon le recouvrement", "Assumption: 1 to 2 months at half productivity depending on overlap"));
        }
        else
        {
            var (salary, src, basis) = Salary(s.AnnualSalary);
            if (salary > 0) Benefit("payroll", L("Masse salariale libérée", "Payroll freed"), salary, salary, src, basis);
            if (sole.Count > 0)
                Find("danger", "person.departure-gap", L(
                    "Départ sans remplaçant : les systèmes détenus seul deviennent orphelins. Désignez un repreneur interne ou un prestataire.",
                    "Departure without successor: solely held systems become orphans. Designate an internal owner or a provider."), sole);
        }

        var handover = sole.Concat(shared).Select(h => L($"Transmettre {_before.Get(h)!.Name} (procédures, accès, cas particuliers)",
                                                           $"Hand over {_before.Get(h)!.Name} (procedures, access, edge cases)")).ToList();
        if (handover.Count > 0) _plan.Add(new PlanPhase(L("Transfert de savoir", "Knowledge transfer"), Math.Max(2, sole.Count * 2 + shared.Count), handover));
        if (replace) _plan.Add(new PlanPhase(L("Recrutement et recouvrement", "Recruitment and overlap"), 8 + overlap * 4,
            [L("Recrutement du remplaçant", "Recruit the successor"), L($"Recouvrement : {overlap} mois", $"Overlap: {overlap} month(s)")]));
        _plan.Add(new PlanPhase(L("Bascule", "Switch-over"), 1,
            [L("Révocation des accès", "Revoke access"), L("Mise à jour des responsables dans le graphe", "Update owners in the graph")]));
    }

    // ── Outils et systèmes ──────────────────────────────────────────────────

    private void NewTool(DecisionSpec s)
    {
        var name = string.IsNullOrWhiteSpace(s.NewName) ? L("Nouvel outil", "New tool") : s.NewName!;
        var tool = new ToolSpec(name, s.NewType, null, s.External, s.OutsideCountry, s.OneOffCost, s.AnnualCost);
        var id = AddTool(tool, anchor: null, (s.Serves ?? []).Select(x => x.ToString()).ToList(), (s.Uses ?? []).Select(x => x.ToString()).ToList(), s);

        var serves = (s.Serves ?? []).Select(x => x.ToString()).Where(x => _before.Get(x) is not null).ToList();
        // Doublon fonctionnel : un outil du même type sert déjà ces activités.
        var type = s.NewType ?? "Application";
        var overlaps = serves.SelectMany(a => _before.DirectDependencies(a))
            .Where(x => _before.Get(x)!.Type.Equals(type, StringComparison.OrdinalIgnoreCase)).Distinct().ToList();
        if (overlaps.Count > 0)
            Find("warning", "tool.overlap", L(
                $"Ces activités s'appuient déjà sur un outil du même type : {Names(_before, overlaps)}. S'agit-il d'un remplacement, d'un complément, ou d'un doublon à éviter ?",
                $"These activities already rely on a tool of the same type: {Names(_before, overlaps)}. Is this a replacement, a complement, or a duplicate to avoid?"), overlaps);

        Find("warning", "tool.new-spof", L(
            $"{name} devient une nouvelle dépendance pour {(serves.Count > 0 ? Names(_before, serves) : L("les activités qu'il servira", "the activities it will serve"))}. Prévoir une procédure de secours en cas d'indisponibilité.",
            $"{name} becomes a new dependency for {(serves.Count > 0 ? Names(_before, serves) : "the activities it will serve")}. Plan a fallback procedure in case of outage."), serves);
        _ = id;
    }

    /// <summary>Ajoute un outil au graphe « après » et chiffre intégrations, formation et fournisseur.</summary>
    private string AddTool(ToolSpec t, string? anchor, List<string> serves, List<string> uses, DecisionSpec s)
    {
        var id = NewId("tool:" + t.Name);
        AddNew(_after, id, t.Name, string.IsNullOrWhiteSpace(t.Type) ? "Application" : t.Type!, 60);
        if (anchor is not null) Link(_after, anchor, id, "USES");
        serves = serves.Where(x => _before.Get(x) is not null).ToList();
        uses = uses.Where(x => _before.Get(x) is not null).ToList();
        foreach (var a in serves) Link(_after, a, id, "DEPENDS_ON");
        foreach (var u in uses) Link(_after, id, u, "DEPENDS_ON");
        foreach (var x in serves.Concat(uses)) _impacted.Add(x);

        if (t.External)
        {
            var supplierName = string.IsNullOrWhiteSpace(t.Supplier) ? L($"Fournisseur de {t.Name}", $"{t.Name} provider") : t.Supplier!;
            var existing = _before.Nodes.FirstOrDefault(n => _before.IsSupplier(n.Id) && n.Name.Equals(supplierName, StringComparison.OrdinalIgnoreCase));
            string sid;
            if (existing is not null)
            {
                sid = existing.Id;
                var share = _before.Dependents(sid).Count;
                Find("warning", "tool.supplier-concentration", L(
                    $"{existing.Name} fournit déjà {share} élément(s) : cette décision renforce la concentration sur ce fournisseur.",
                    $"{existing.Name} already supplies {share} element(s): this decision increases concentration on that supplier."), [sid]);
            }
            else
            {
                sid = NewId("supplier:" + supplierName);
                AddNew(_after, sid, supplierName, IsAi(t.Type, t.Name) ? "AiProvider" : "Supplier", 60);
                Find("info", "tool.new-supplier", L(
                    $"Nouveau fournisseur externe : {supplierName}. Contrat, niveau de service, réversibilité (récupération des données en fin de contrat) à négocier.",
                    $"New external supplier: {supplierName}. Contract, service level and reversibility (data return at contract end) to negotiate."));
            }
            Link(_after, id, sid, "SUPPLIED_BY");
            _mustKnow.Add(L($"{t.Name} : exiger un engagement de disponibilité et une clause de réversibilité des données.",
                            $"{t.Name}: require an availability commitment and a data reversibility clause."));
        }
        if (t.OutsideCountry)
            _mustKnow.Add(L($"{t.Name} traite des données hors {(_ctx.Country is { Length: > 0 } c ? $"du pays du siège ({c})" : "du pays du siège")} : vérifier la réglementation applicable aux transferts de données (autorisation, consentement, clauses contractuelles).",
                            $"{t.Name} processes data outside {(_ctx.Country is { Length: > 0 } c2 ? $"the head-office country ({c2})" : "the head-office country")}: check the rules applicable to data transfers (authorisation, consent, contractual clauses)."));

        // Intégrations : chaque système existant à connecter.
        var (rate, rateSrc) = DayRate(s.DayRate);
        var days = s.IntegrationDaysEach ?? 5;
        if (uses.Count > 0)
            Cost("integration:" + t.Name, L($"Intégration de {t.Name} ({uses.Count} système(s) : {Names(_before, uses, 3)})", $"Integrating {t.Name} ({uses.Count} system(s): {Names(_before, uses, 3)})"),
                uses.Count * days * rate, 0, rateSrc == "input" && s.IntegrationDaysEach is not null ? "input" : "graph",
                L($"{uses.Count} système(s) comptés dans le graphe × {days} j × {rate:N0} {_ctx.Currency}/j{(rateSrc == "assumption" ? " (tarif estimé)" : "")}",
                  $"{uses.Count} system(s) counted in the graph × {days} d × {rate:N0} {_ctx.Currency}/d{(rateSrc == "assumption" ? " (estimated rate)" : "")}"));
        else
            _missing.Add(L($"Systèmes existants auxquels {t.Name} devra être connecté", $"Existing systems {t.Name} must connect to"));

        // Formation : les personnes reliées aux activités et systèmes concernés.
        var people = _before.PeopleAround(serves.Concat(uses)).Count;
        var hours = s.TrainingHoursPerPerson ?? 8;
        if (people > 0)
            Cost("training:" + t.Name, L($"Formation des utilisateurs de {t.Name} ({people} pers.)", $"Training {t.Name} users ({people} pers.)"),
                people * hours * HourlyLabour(null), 0, "graph",
                L($"{people} personne(s) reliées aux activités et systèmes concernés × {hours} h × coût horaire moyen",
                  $"{people} person(s) linked to the activities and systems involved × {hours} h × average hourly cost"));
        else if (serves.Count > 0)
            _missing.Add(L($"Nombre d'utilisateurs de {t.Name} (aucune personne n'est reliée à ces activités dans le graphe)", $"Number of {t.Name} users (no person linked to these activities in the graph)"));

        if (t.OneOffCost is > 0) Cost("oneoff:" + t.Name, L($"{t.Name} : acquisition et mise en service", $"{t.Name}: purchase and setup"), t.OneOffCost.Value, 0, "input", L("Saisi (devis)", "Entered (quote)"));
        if (t.AnnualCost is > 0) Cost("annual:" + t.Name, L($"{t.Name} : abonnement / licences / maintenance", $"{t.Name}: subscription / licences / maintenance"), t.AnnualCost.Value, t.AnnualCost.Value, "input", L("Saisi", "Entered"));
        if (t.OneOffCost is null && t.AnnualCost is null)
            _missing.Add(L($"Coût de {t.Name} (devis, licences, abonnement)", $"Cost of {t.Name} (quote, licences, subscription)"));

        _plan.Add(new PlanPhase(L($"Mise en place de {t.Name}", $"Set up {t.Name}"), Math.Max(2, (int)Math.Ceiling(uses.Count * days / 5.0) + 1),
            new[] { t.External ? L("Contrat fournisseur (disponibilité, réversibilité)", "Supplier contract (availability, reversibility)") : L("Installation", "Installation") }
                .Concat(uses.Select(u => L($"Connexion à {_before.Get(u)!.Name}", $"Connect to {_before.Get(u)!.Name}")))
                .Append(L("Formation des utilisateurs", "User training"))
                .Append(L("Procédure de secours documentée", "Documented fallback procedure")).ToList()));
        return id;
    }

    private void Tools(DecisionSpec s, string? anchor)
    {
        if (s.Tools is null) return;
        foreach (var t in s.Tools.Where(t => !string.IsNullOrWhiteSpace(t.Name)))
            AddTool(t, anchor, (s.Serves ?? []).Select(x => x.ToString()).ToList(), (s.Uses ?? []).Select(x => x.ToString()).ToList(), s);
    }

    private void ReplaceTool(DecisionSpec s, GraphView.Node? old)
    {
        if (old is null) { Find("danger", "tool.missing", L("Choisissez l'outil à remplacer.", "Choose the tool to replace.")); _missing.Add(L("Outil remplacé", "Tool being replaced")); return; }
        var name = string.IsNullOrWhiteSpace(s.NewName) ? L($"Remplaçant de {old.Name}", $"Replacement for {old.Name}") : s.NewName!;
        var id = NewId("replacement");
        AddNew(_after, id, name, string.IsNullOrWhiteSpace(s.NewType) ? old.Type : s.NewType!, old.Criticality);

        var dependents = _before.Dependents(old.Id);
        var direct = _before.DirectDependents(old.Id).Distinct().ToList();
        var upstream = _before.DirectDependencies(old.Id).Distinct().ToList();
        var interfaces = direct.Concat(upstream).Distinct().ToList();
        foreach (var x in dependents.Keys.Concat(upstream)) _impacted.Add(x);

        _after.Rewire(old.Id, id);
        _after.RemoveNode(old.Id);
        _removedNodes.Add(new NodeRef(old.Id, old.Name, old.Type));

        Find(dependents.Count > 0 ? "warning" : "info", "replace.blast", L(
            $"{interfaces.Count} liaison(s) directe(s) à refaire ({Names(_before, interfaces)}) et {dependents.Count} élément(s) qui dépendent de {old.Name} au total : tous doivent fonctionner avec {name} le jour de la bascule.",
            $"{interfaces.Count} direct link(s) to rebuild ({Names(_before, interfaces)}) and {dependents.Count} element(s) depending on {old.Name} overall: all must work with {name} on switch-over day."), interfaces);

        var data = _before.Edges.Where(e => (e.Source == old.Id || e.Target == old.Id) && (e.Type is "STORES" or "PROCESSES")).Any()
                   || GraphView.DataTypes.Contains(old.Type);
        _mustKnow.Add(data
            ? L($"Migration des données de {old.Name} : volume, qualité, historique à conserver, test de réconciliation avant bascule.",
                $"Data migration from {old.Name}: volume, quality, history to keep, reconciliation test before switch-over.")
            : L($"Vérifier si {old.Name} contient des données ou un historique à reprendre dans {name}.",
                $"Check whether {old.Name} holds data or history to carry over into {name}."));

        var holders = _before.Holders(old.Id).ToList();
        if (holders.Count > 0)
            Find("info", "replace.skills", L(
                $"Le savoir sur {old.Name} ({Names(_before, holders)}) devient obsolète : ces personnes doivent être formées sur {name}, sinon plus personne ne le maîtrisera.",
                $"Knowledge of {old.Name} ({Names(_before, holders)}) becomes obsolete: these people must be trained on {name}, otherwise nobody will master it."), holders);

        var cut = s.CutoverHours ?? 8;
        var risk = OutageCost(_before, old.Id, cut);
        var p = (s.OverlapMonths ?? 0) > 0 ? 0.3 : 0.6;
        _transitionRisk += risk * p;
        Cost("cutover", L($"Risque de bascule ({cut} h d'interruption prévue)", $"Switch-over risk ({cut} h planned interruption)"), risk * p, 0, "engine",
            L($"Coût d'un arrêt de {cut} h de {old.Name} et de ses dépendants × probabilité de débordement {p:P0}{((s.OverlapMonths ?? 0) > 0 ? " (fonctionnement en parallèle prévu)" : " (sans fonctionnement en parallèle)")}",
              $"Cost of a {cut} h outage of {old.Name} and its dependents × overrun probability {p:P0}{((s.OverlapMonths ?? 0) > 0 ? " (parallel run planned)" : " (no parallel run)")}"));

        var (rate, rateSrc) = DayRate(s.DayRate);
        var days = s.IntegrationDaysEach ?? 5;
        if (interfaces.Count > 0)
            Cost("integration", L($"Reconnexion des {interfaces.Count} liaison(s)", $"Rebuilding {interfaces.Count} link(s)"), interfaces.Count * days * rate, 0, "graph",
                L($"{interfaces.Count} liaison(s) comptées dans le graphe × {days} j × {rate:N0} {_ctx.Currency}/j{(rateSrc == "assumption" ? " (tarif estimé)" : "")}",
                  $"{interfaces.Count} link(s) counted in the graph × {days} d × {rate:N0} {_ctx.Currency}/d{(rateSrc == "assumption" ? " (estimated rate)" : "")}"));
        var users = _before.PeopleAround(dependents.Keys.Append(old.Id)).Count;
        var hours = s.TrainingHoursPerPerson ?? 8;
        if (users > 0)
            Cost("training", L($"Formation ({users} pers.)", $"Training ({users} pers.)"), users * hours * HourlyLabour(null), 0, "graph",
                L($"{users} personne(s) reliées à {old.Name} et à ses dépendants × {hours} h", $"{users} person(s) linked to {old.Name} and its dependents × {hours} h"));
        if ((s.OverlapMonths ?? 0) > 0 && s.AnnualCostRemoved is > 0)
            Cost("parallel", L($"Fonctionnement en parallèle ({s.OverlapMonths} mois)", $"Parallel run ({s.OverlapMonths} months)"), s.AnnualCostRemoved.Value / 12 * s.OverlapMonths!.Value, 0, "input", L("Coût annuel de l'ancien outil × durée", "Old tool annual cost × duration"));
        if (s.OneOffCost is > 0) Cost("oneoff", L($"{name} : acquisition et mise en service", $"{name}: purchase and setup"), s.OneOffCost.Value, 0, "input", L("Saisi (devis)", "Entered (quote)"));
        if (s.AnnualCost is > 0) Cost("annual", L($"{name} : coût annuel", $"{name}: annual cost"), s.AnnualCost.Value, s.AnnualCost.Value, "input", L("Saisi", "Entered"));
        else _missing.Add(L($"Coût annuel de {name}", $"Annual cost of {name}"));
        if (s.AnnualCostRemoved is > 0)
            Benefit("removed", L($"Fin du coût de {old.Name}", $"End of {old.Name} cost"), s.AnnualCostRemoved.Value * Math.Max(0, 12 - (s.OverlapMonths ?? 0)) / 12, s.AnnualCostRemoved.Value, "input", L("Coût annuel actuel saisi", "Current annual cost entered"));
        else _missing.Add(L($"Coût annuel actuel de {old.Name} (pour mesurer l'économie)", $"Current annual cost of {old.Name} (to measure savings)"));

        _plan.Add(new PlanPhase(L("Préparation", "Preparation"), 3, [L("Inventaire des liaisons et des données", "Inventory of links and data"), L("Plan de retour arrière", "Rollback plan")]));
        _plan.Add(new PlanPhase(L("Reconstruction des liaisons", "Rebuilding links"), Math.Max(2, (int)Math.Ceiling(interfaces.Count * days / 5.0)),
            interfaces.Select(i => L($"{_before.Get(i)!.Name} ↔ {name}", $"{_before.Get(i)!.Name} ↔ {name}")).ToList()));
        if ((s.OverlapMonths ?? 0) > 0)
            _plan.Add(new PlanPhase(L("Fonctionnement en parallèle", "Parallel run"), s.OverlapMonths!.Value * 4, [L("Comparaison des résultats ancien / nouveau", "Compare old / new results")]));
        _plan.Add(new PlanPhase(L("Bascule", "Switch-over"), 1, [L($"Fenêtre de {cut} h, hors période de pointe", $"{cut} h window, off-peak"), L("Formation des utilisateurs", "User training"), L($"Arrêt de {old.Name}", $"Decommission {old.Name}")]));
    }

    private void Upgrade(DecisionSpec s, GraphView.Node? sys)
    {
        if (sys is null) { Find("danger", "upgrade.missing", L("Choisissez le système à mettre à jour.", "Choose the system to upgrade.")); _missing.Add(L("Système à mettre à jour", "System to upgrade")); return; }
        var direct = _before.DirectDependents(sys.Id).Concat(_before.DirectDependencies(sys.Id)).Distinct().ToList();
        var all = _before.Dependents(sys.Id);
        foreach (var x in all.Keys.Concat(direct)) _impacted.Add(x);
        Find(direct.Count > 0 ? "warning" : "info", "upgrade.regression", L(
            $"{direct.Count} liaison(s) à re-tester après la mise à jour : {Names(_before, direct)}. Une incompatibilité se propagerait à {all.Count} élément(s).",
            $"{direct.Count} link(s) to re-test after the upgrade: {Names(_before, direct)}. An incompatibility would spread to {all.Count} element(s)."), direct);
        var cut = s.CutoverHours ?? 4;
        var risk = OutageCost(_before, sys.Id, cut);
        _transitionRisk += risk * 0.3;
        Cost("cutover", L($"Risque d'interruption ({cut} h)", $"Interruption risk ({cut} h)"), risk * 0.3, 0, "engine",
            L($"Arrêt de {cut} h de {sys.Name} et de ses dépendants × 30 % (probabilité de débordement)", $"{cut} h outage of {sys.Name} and dependents × 30% (overrun probability)"));
        var (rate, _) = DayRate(s.DayRate);
        if (direct.Count > 0) Cost("tests", L($"Tests de non-régression ({direct.Count} liaison(s))", $"Regression tests ({direct.Count} link(s))"), direct.Count * 1 * rate, 0, "graph", L("1 j par liaison", "1 d per link"));
        if (s.OneOffCost is > 0) Cost("oneoff", L("Coût de la mise à jour", "Upgrade cost"), s.OneOffCost.Value, 0, "input", L("Saisi", "Entered"));
        if (s.AnnualCost is > 0) Cost("annual", L("Variation du coût annuel", "Change in annual cost"), s.AnnualCost.Value, s.AnnualCost.Value, "input", L("Saisi", "Entered"));
        _mustKnow.Add(L("Sauvegarde complète et plan de retour arrière testés avant l'intervention.", "Full backup and tested rollback plan before the intervention."));
        _plan.Add(new PlanPhase(L("Préparation", "Preparation"), 2, [L("Sauvegarde et plan de retour arrière", "Backup and rollback plan"), L("Environnement de test", "Test environment")]));
        _plan.Add(new PlanPhase(L("Tests", "Tests"), Math.Max(1, (int)Math.Ceiling(direct.Count / 5.0)), direct.Select(d => L($"Tester {_before.Get(d)!.Name}", $"Test {_before.Get(d)!.Name}")).ToList()));
        _plan.Add(new PlanPhase(L("Mise à jour", "Upgrade"), 1, [L($"Fenêtre de {cut} h hors pointe", $"{cut} h off-peak window")]));
    }

    private void ChangeSupplier(DecisionSpec s, GraphView.Node? old)
    {
        if (old is null) { Find("danger", "supplier.missing", L("Choisissez le fournisseur actuel.", "Choose the current supplier.")); _missing.Add(L("Fournisseur actuel", "Current supplier")); return; }
        var name = string.IsNullOrWhiteSpace(s.NewName) ? L("Nouveau fournisseur", "New supplier") : s.NewName!;
        var existing = _before.Nodes.FirstOrDefault(n => _before.IsSupplier(n.Id) && n.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
        var supplied = _before.DirectDependents(old.Id).Distinct().ToList();
        var all = _before.Dependents(old.Id);
        foreach (var x in all.Keys) _impacted.Add(x);

        string nid;
        if (existing is not null)
        {
            nid = existing.Id;
            Find("warning", "supplier.concentration", L(
                $"{existing.Name} fournit déjà {_before.Dependents(existing.Id).Count} élément(s) : vous remplacez une dépendance par une concentration plus forte.",
                $"{existing.Name} already supplies {_before.Dependents(existing.Id).Count} element(s): you are replacing a dependency with a stronger concentration."), [existing.Id]);
        }
        else { nid = NewId("supplier"); AddNew(_after, nid, name, old.Type, old.Criticality); }
        _after.Rewire(old.Id, nid);
        _after.RemoveNode(old.Id);
        _removedNodes.Add(new NodeRef(old.Id, old.Name, old.Type));

        Find(supplied.Count > 0 ? "warning" : "info", "supplier.scope", L(
            $"{supplied.Count} élément(s) fournis par {old.Name} passent chez {name} : {Names(_before, supplied)} ({all.Count} élément(s) dépendants au total).",
            $"{supplied.Count} element(s) supplied by {old.Name} move to {name}: {Names(_before, supplied)} ({all.Count} dependent element(s) overall)."), supplied);
        _mustKnow.Add(L($"Conditions de sortie du contrat avec {old.Name} (préavis, pénalités, restitution des données).", $"Exit terms with {old.Name} (notice, penalties, data return)."));
        _mustKnow.Add(L($"Niveau de service de {name} au moins équivalent, par écrit.", $"{name}'s service level at least equivalent, in writing."));

        var cut = s.CutoverHours ?? 12;
        var risk = OutageCost(_before, old.Id, cut);
        var p = (s.OverlapMonths ?? 0) > 0 ? 0.25 : 0.5;
        _transitionRisk += risk * p;
        Cost("cutover", L($"Risque de transition ({cut} h)", $"Transition risk ({cut} h)"), risk * p, 0, "engine",
            L($"Arrêt de {cut} h de {old.Name} et de ses dépendants × {p:P0}", $"{cut} h outage of {old.Name} and dependents × {p:P0}"));
        if (s.OneOffCost is > 0) Cost("oneoff", L("Frais de changement (sortie, mise en place)", "Switching costs (exit, setup)"), s.OneOffCost.Value, 0, "input", L("Saisi", "Entered"));
        if (s.AnnualCost is > 0) Cost("annual", L($"{name} : coût annuel", $"{name}: annual cost"), s.AnnualCost.Value, s.AnnualCost.Value, "input", L("Saisi", "Entered"));
        else _missing.Add(L($"Coût annuel de {name}", $"Annual cost of {name}"));
        if (s.AnnualCostRemoved is > 0) Benefit("removed", L($"Fin du contrat {old.Name}", $"End of {old.Name} contract"), s.AnnualCostRemoved.Value, s.AnnualCostRemoved.Value, "input", L("Saisi", "Entered"));
        else _missing.Add(L($"Coût annuel actuel de {old.Name}", $"Current annual cost of {old.Name}"));

        _plan.Add(new PlanPhase(L("Contractualisation", "Contracting"), 6, [L("Appel d'offres ou négociation", "Tender or negotiation"), L("Niveau de service et réversibilité", "Service level and reversibility")]));
        _plan.Add(new PlanPhase(L("Transition", "Transition"), Math.Max(2, supplied.Count), supplied.Select(x => L($"Basculer {_before.Get(x)!.Name}", $"Switch {_before.Get(x)!.Name}")).ToList()));
        _plan.Add(new PlanPhase(L("Sortie", "Exit"), 2, [L($"Restitution des données par {old.Name}", $"Data return by {old.Name}"), L("Résiliation", "Termination")]));
    }

    // ── Sites ───────────────────────────────────────────────────────────────

    private void OpenSite(DecisionSpec s)
    {
        var name = string.IsNullOrWhiteSpace(s.NewName) ? L("Nouveau site", "New site") : s.NewName!;
        var id = NewId("site");
        AddNew(_after, id, name, "Location", 50);
        var uses = (s.Uses ?? []).Select(x => x.ToString()).Where(x => _before.Get(x) is not null).ToList();
        var serves = (s.Serves ?? []).Select(x => x.ToString()).Where(x => _before.Get(x) is not null).ToList();
        foreach (var u in uses) Link(_after, id, u, "DEPENDS_ON");
        foreach (var a in serves) Link(_after, a, id, "DEPENDS_ON");
        foreach (var x in uses.Concat(serves)) _impacted.Add(x);

        var fragile = uses.Where(_before.IsSinglePointOfFailure).ToList();
        if (fragile.Count > 0)
            Find("warning", "site.inherits", L(
                $"Le site dépendra de {Names(_before, fragile)}, déjà points uniques de défaillance : une panne toucherait aussi ce nouveau site.",
                $"The site will depend on {Names(_before, fragile)}, already single points of failure: an outage would hit this new site too."), fragile);
        if (uses.Count == 0) _missing.Add(L("Systèmes centraux dont le site dépendra (réseau, logiciels, électricité…)", "Central systems the site will depend on (network, software, power…)"));
        _mustKnow.Add(L("Connectivité et alimentation du site : fournisseur principal et solution de secours.", "Site connectivity and power: primary provider and backup."));

        var n = Math.Max(0, s.Headcount ?? 0);
        if (n > 0)
        {
            var (salary, src, basis) = Salary(s.AnnualSalary);
            Cost("staff", L($"Personnel du site ({n} pers.)", $"Site staff ({n} pers.)"), salary * n, salary * n, src, basis);
        }
        else _missing.Add(L("Effectif du site", "Site headcount"));
        if (s.OneOffCost is > 0) Cost("capex", L("Aménagement et équipement", "Fit-out and equipment"), s.OneOffCost.Value, 0, "input", L("Saisi", "Entered"));
        if (s.AnnualCost is > 0) Cost("opex", L("Loyer, charges, connectivité", "Rent, utilities, connectivity"), s.AnnualCost.Value, s.AnnualCost.Value, "input", L("Saisi", "Entered"));
        _plan.Add(new PlanPhase(L("Préparation du site", "Site preparation"), 8, [L("Bail et aménagement", "Lease and fit-out"), L("Connectivité et alimentation de secours", "Connectivity and backup power")]));
        _plan.Add(new PlanPhase(L("Ouverture", "Opening"), 4, uses.Select(u => L($"Accès à {_before.Get(u)!.Name}", $"Access to {_before.Get(u)!.Name}")).Append(L("Recrutement et formation", "Hiring and training")).ToList()));
    }

    private void CloseSite(DecisionSpec s, GraphView.Node? site)
    {
        if (site is null) { Find("danger", "site.missing", L("Choisissez le site à fermer.", "Choose the site to close.")); _missing.Add(L("Site à fermer", "Site to close")); return; }
        var located = _before.DirectDependents(site.Id).Distinct().ToList();
        var all = _before.Dependents(site.Id);
        foreach (var x in all.Keys) _impacted.Add(x);
        var people = located.Where(_before.IsPerson).ToList();
        var systems = located.Where(x => !_before.IsPerson(x) && !_before.IsActivity(x)).ToList();
        var activities = all.Keys.Where(_before.IsActivity).ToList();
        Remove(_after, site.Id);

        if (systems.Count > 0)
            Find("danger", "site.systems", L($"Systèmes hébergés ou rattachés au site, à déménager avant fermeture : {Names(_before, systems)}.", $"Systems hosted at or tied to the site, to move before closing: {Names(_before, systems)}."), systems);
        if (people.Count > 0)
            Find("warning", "site.people", L($"Personnes / rôles rattachés au site : {Names(_before, people)}.", $"People / roles tied to the site: {Names(_before, people)}."), people);
        if (activities.Count > 0)
            Find("warning", "site.activities", L($"Activités touchées : {Names(_before, activities)}. Prévoir comment elles seront assurées ailleurs.", $"Activities affected: {Names(_before, activities)}. Plan how they will be delivered elsewhere."), activities);

        var cut = s.CutoverHours ?? 24;
        var risk = systems.Sum(x => OutageCost(_before, x, cut));
        _transitionRisk += risk * 0.4;
        if (risk > 0) Cost("move-risk", L($"Risque pendant le déménagement ({cut} h par système)", $"Risk during the move ({cut} h per system)"), risk * 0.4, 0, "engine", L("Arrêt des systèmes déplacés × 40 %", "Outage of moved systems × 40%"));
        if (s.OneOffCost is > 0) Cost("closing", L("Coûts de fermeture (déménagement, résiliation)", "Closing costs (move, termination)"), s.OneOffCost.Value, 0, "input", L("Saisi", "Entered"));
        if (s.AnnualCostRemoved is > 0) Benefit("savings", L("Économie annuelle (loyer, charges)", "Annual savings (rent, utilities)"), s.AnnualCostRemoved.Value, s.AnnualCostRemoved.Value, "input", L("Saisi", "Entered"));
        else _missing.Add(L("Coût annuel actuel du site (pour mesurer l'économie)", "Current annual cost of the site (to measure savings)"));
        _plan.Add(new PlanPhase(L("Relocalisation", "Relocation"), Math.Max(4, systems.Count * 2), systems.Select(x => L($"Déplacer {_before.Get(x)!.Name}", $"Move {_before.Get(x)!.Name}")).Concat(people.Select(p => L($"Réaffecter {_before.Get(p)!.Name}", $"Reassign {_before.Get(p)!.Name}"))).ToList()));
        _plan.Add(new PlanPhase(L("Fermeture", "Closing"), 2, [L("Information des clients et partenaires", "Inform customers and partners"), L("Résiliation du bail et des contrats", "Terminate lease and contracts")]));
    }

    // ── Automatisation ──────────────────────────────────────────────────────

    private void Automate(DecisionSpec s, GraphView.Node? process)
    {
        if (process is null) { Find("danger", "auto.missing", L("Choisissez l'activité ou le processus à automatiser.", "Choose the activity or process to automate.")); _missing.Add(L("Processus à automatiser", "Process to automate")); return; }
        _impacted.Add(process.Id);
        var actors = _before.PeopleAround([process.Id]).ToList();
        if (actors.Count > 0)
            Find("info", "auto.people", L(
                $"Personnes qui réalisent aujourd'hui ce processus : {Names(_before, actors)}. Leur rôle évolue (contrôle, cas particuliers) : à anticiper avec elles.",
                $"People currently doing this process: {Names(_before, actors)}. Their role changes (control, exceptions): to plan with them."), actors);
        else
            _missing.Add(L("Personnes qui réalisent le processus aujourd'hui", "People currently doing the process"));

        var tools = s.Tools is { Count: > 0 } ? s.Tools : [new ToolSpec(string.IsNullOrWhiteSpace(s.NewName) ? L("Outil d'automatisation", "Automation tool") : s.NewName!, s.NewType, null, s.External, s.OutsideCountry, s.OneOffCost, s.AnnualCost)];
        foreach (var t in tools)
            AddTool(t, null, [process.Id], (s.Uses ?? []).Select(x => x.ToString()).ToList(), s);

        Find("warning", "auto.dependency", L(
            $"{process.Name} dépendra désormais d'un outil : en cas de panne ou d'erreur de l'outil, qui reprend la main et comment ? Conserver une procédure manuelle.",
            $"{process.Name} will now depend on a tool: if it fails or errs, who takes over and how? Keep a manual procedure."), [process.Id]);
        if (tools.Any(t => IsAi(t.Type, t.Name)))
            _mustKnow.Add(L("Automatisation par IA : contrôle humain des décisions sensibles, suivi de la qualité des résultats, traçabilité.",
                            "AI automation: human review of sensitive decisions, output quality monitoring, traceability."));

        if (s.HoursSavedPerMonth is > 0)
        {
            var hourly = HourlyLabour(null);
            Benefit("time", L($"Temps libéré ({s.HoursSavedPerMonth:N0} h/mois)", $"Time freed ({s.HoursSavedPerMonth:N0} h/month)"),
                s.HoursSavedPerMonth.Value * 12 * hourly * 0.75, s.HoursSavedPerMonth.Value * 12 * hourly, "input",
                L("Heures saisies × coût horaire moyen (75 % la première année, le temps de la montée en charge)", "Hours entered × average hourly cost (75% in year one for ramp-up)"));
        }
        else _missing.Add(L("Heures de travail libérées par mois", "Work hours freed per month"));
    }

    private static bool IsAi(string? type, string? name)
    {
        var t = (type ?? "") + " " + (name ?? "");
        return t.Contains("Ai", StringComparison.Ordinal) || t.Contains(" IA", StringComparison.OrdinalIgnoreCase)
            || t.Contains("IA ", StringComparison.OrdinalIgnoreCase) || t.Contains("AI ", StringComparison.Ordinal)
            || t.Contains("intelligence artificielle", StringComparison.OrdinalIgnoreCase) || t.Contains("machine learning", StringComparison.OrdinalIgnoreCase)
            || t.Contains("data scien", StringComparison.OrdinalIgnoreCase) || t.Contains("LLM", StringComparison.Ordinal) || t.Contains("Dataset", StringComparison.Ordinal);
    }

    // ── Synthèse ────────────────────────────────────────────────────────────

    private void CompareResilience(Resilience b, Resilience a)
    {
        var d = a.Score - b.Score;
        if (d >= 2)
            Find("positive", "resilience.up", L($"Résilience : {b.Score} → {a.Score}. La décision rend l'organisation plus robuste.", $"Resilience: {b.Score} → {a.Score}. The decision makes the organisation more robust."));
        else if (d <= -2)
            Find("warning", "resilience.down", L($"Résilience : {b.Score} → {a.Score}. La décision crée plus de fragilités qu'elle n'en retire — à compenser (secours, documentation, second fournisseur).",
                                                 $"Resilience: {b.Score} → {a.Score}. The decision creates more fragility than it removes — compensate (backup, documentation, second supplier)."));
        if (a.KeyPeople > b.KeyPeople)
            Find("warning", "resilience.key-people", L($"Personnes clés (seules à détenir un savoir) : {b.KeyPeople} → {a.KeyPeople}.", $"Key people (sole knowledge holders): {b.KeyPeople} → {a.KeyPeople}."));
        else if (a.KeyPeople < b.KeyPeople)
            Find("positive", "resilience.key-people", L($"Personnes clés (seules à détenir un savoir) : {b.KeyPeople} → {a.KeyPeople}.", $"Key people (sole knowledge holders): {b.KeyPeople} → {a.KeyPeople}."));
    }

    private (string, string) Verdict(Resilience b, Resilience a, DecisionTotals t)
    {
        var dangers = _findings.Count(f => f.Severity == "danger");
        if (_findings.Any(f => f.Code.EndsWith(".missing", StringComparison.Ordinal)))
            return ("insufficient", L("Informations insuffisantes pour conclure.", "Not enough information to conclude."));
        if (dangers > 0)
            return ("conditional", L($"Faisable, à condition de traiter d'abord {dangers} point(s) bloquant(s) signalé(s) en rouge.", $"Feasible, provided the {dangers} blocking point(s) flagged in red are handled first."));
        var worse = a.Score < b.Score - 1;
        if (t.PaybackMonths is { } pb && pb <= 24 && !worse)
            return ("favorable", L($"Favorable : retour sur investissement en ~{pb:N0} mois, sans perte de résilience.", $"Favourable: payback in ~{pb:N0} months, with no loss of resilience."));
        if (t.RecurringBenefit == 0 && t.Year1Benefit == 0)
            return ("conditional", L("Coûts et risques chiffrés ; le gain n'est pas renseigné, le retour sur investissement ne peut pas être établi.", "Costs and risks are quantified; the gain is not entered, so payback cannot be established."));
        if (worse)
            return ("conditional", L("Rentable sur le papier, mais la résilience baisse : prévoir les mesures de compensation.", "Profitable on paper, but resilience drops: plan compensating measures."));
        if (t.PaybackMonths is null)
            return ("unfavorable", L("Les coûts récurrents dépassent les gains attendus.", "Recurring costs exceed expected gains."));
        return ("conditional", L($"Retour sur investissement long (~{t.PaybackMonths:N0} mois) : à justifier par d'autres bénéfices.", $"Long payback (~{t.PaybackMonths:N0} months): to be justified by other benefits."));
    }

    private double Confidence(DecisionSpec s, int assumptions)
    {
        var c = 0.9 - 0.06 * assumptions - 0.04 * _missing.Distinct().Count();
        // Solidité des dépendances sur lesquelles repose le diagnostic.
        var touched = _impacted.ToHashSet();
        if (s.SubjectId is { } sid) touched.Add(sid.ToString());
        var edges = _before.Edges.Where(e => touched.Contains(e.Source) || touched.Contains(e.Target)).ToList();
        if (edges.Count > 0 && edges.Average(e => e.Confidence) < 0.6) c -= 0.15;
        if (edges.Count == 0) c -= 0.2;
        return Math.Round(Math.Clamp(c, 0.15, 0.95), 2);
    }
}
