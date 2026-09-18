using Nexus.Graph;

namespace Nexus.Risk.Decisions;

/// <summary>
/// Vue en mémoire du graphe, modifiable : la décision est APPLIQUÉE sur une
/// copie (ajouts, retraits, reconnexions) pour mesurer l'avant et l'après avec
/// exactement les mêmes règles.
///
/// Sens des arêtes : pour une relation de dépendance « A → B », A dépend de B.
/// HOSTS est inversé (« A HOSTS B » : B dépend de A). KNOWS / MAINTAINS relient
/// une personne au système dont elle détient le savoir.
/// </summary>
public sealed class GraphView
{
    public sealed record Node(string Id, string Name, string Type, int Criticality, double? CostPerHour);
    public sealed record Edge(string Source, string Target, string Type, double Confidence);

    private static readonly HashSet<string> DependencyTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "DEPENDS_ON", "RUNS_ON", "USES", "REQUIRES", "SUPPLIED_BY", "AUTHENTICATES", "USES_MODEL",
        "INVOKES", "SERVED_BY", "CAN_ACT_ON", "SENDS_DATA_TO", "ORCHESTRATES", "LOCATED_IN",
    };
    private static readonly HashSet<string> KnowledgeTypes = new(StringComparer.OrdinalIgnoreCase) { "KNOWS", "MAINTAINS" };
    private static readonly HashSet<string> RedundancyTypes = new(StringComparer.OrdinalIgnoreCase) { "BACKED_UP_BY", "REPLACED_BY", "RECOVERS_WITH" };
    private static readonly HashSet<string> AccessTypes = new(StringComparer.OrdinalIgnoreCase) { "AUTHENTICATES", "HAS_ACCESS_TO", "CAN_ACT_ON" };

    public static readonly HashSet<string> PeopleTypes = new(StringComparer.OrdinalIgnoreCase) { "Person", "Role", "Team" };
    public static readonly HashSet<string> ActivityTypes = new(StringComparer.OrdinalIgnoreCase) { "BusinessProcess", "BusinessService", "Process" };
    public static readonly HashSet<string> SupplierTypes = new(StringComparer.OrdinalIgnoreCase) { "Supplier", "AiProvider" };
    public static readonly HashSet<string> DataTypes = new(StringComparer.OrdinalIgnoreCase) { "Database", "DataStore", "Dataset" };

    private readonly Dictionary<string, Node> _nodes;
    private readonly List<Edge> _edges;

    private GraphView(Dictionary<string, Node> nodes, List<Edge> edges) { _nodes = nodes; _edges = edges; }

    public static GraphView From(IEnumerable<GraphEntityRecord> entities, IEnumerable<GraphEdgeRecord> edges)
    {
        // Les actions du plan (nœuds Control) ne décrivent pas l'organisation.
        var nodes = entities.Where(e => e.EntityType != "Control")
            .ToDictionary(e => e.Id.ToString(), e => new Node(e.Id.ToString(), e.Name, e.EntityType, e.Criticality, e.CostPerHour));
        var list = edges
            .Where(e => nodes.ContainsKey(e.Source.ToString()) && nodes.ContainsKey(e.Target.ToString()))
            .Select(e => new Edge(e.Source.ToString(), e.Target.ToString(), e.Type, e.Confidence))
            .ToList();
        return new GraphView(nodes, list);
    }

    public GraphView Clone() => new(new Dictionary<string, Node>(_nodes), [.. _edges]);

    public IReadOnlyCollection<Node> Nodes => _nodes.Values;
    public IReadOnlyList<Edge> Edges => _edges;
    public Node? Get(string id) => _nodes.GetValueOrDefault(id);
    public Node? Get(Guid? id) => id is { } g ? Get(g.ToString()) : null;

    // ── Mutations (application de la décision sur la copie) ─────────────────

    public void AddNode(Node n) => _nodes[n.Id] = n;
    public void AddEdge(string source, string target, string type) => _edges.Add(new Edge(source, target, type, 0.6));

    public List<Edge> RemoveNode(string id)
    {
        var removed = _edges.Where(e => e.Source == id || e.Target == id).ToList();
        _edges.RemoveAll(e => e.Source == id || e.Target == id);
        _nodes.Remove(id);
        return removed;
    }

    public int RemoveEdges(Func<Edge, bool> predicate) => _edges.RemoveAll(e => predicate(e));

    /// <summary>Transfère toutes les relations de <paramref name="from"/> vers <paramref name="to"/> (remplacement).</summary>
    public void Rewire(string from, string to)
    {
        for (var i = 0; i < _edges.Count; i++)
        {
            var e = _edges[i];
            if (e.Source == from) _edges[i] = e with { Source = to };
            else if (e.Target == from) _edges[i] = e with { Target = to };
        }
    }

    // ── Lectures ────────────────────────────────────────────────────────────

    public static bool IsDependency(string type) => DependencyTypes.Contains(type) || type.Equals("HOSTS", StringComparison.OrdinalIgnoreCase);
    public static bool IsKnowledge(string type) => KnowledgeTypes.Contains(type);

    /// <summary>Éléments qui dépendent directement de <paramref name="id"/>.</summary>
    public IEnumerable<string> DirectDependents(string id)
    {
        foreach (var e in _edges)
        {
            if (DependencyTypes.Contains(e.Type) && e.Target == id) yield return e.Source;
            else if (e.Type.Equals("HOSTS", StringComparison.OrdinalIgnoreCase) && e.Source == id) yield return e.Target;
        }
    }

    /// <summary>Éléments dont <paramref name="id"/> dépend directement.</summary>
    public IEnumerable<string> DirectDependencies(string id)
    {
        foreach (var e in _edges)
        {
            if (DependencyTypes.Contains(e.Type) && e.Source == id) yield return e.Target;
            else if (e.Type.Equals("HOSTS", StringComparison.OrdinalIgnoreCase) && e.Target == id) yield return e.Source;
        }
    }

    /// <summary>Tout ce qui tombe si <paramref name="id"/> tombe, avec la profondeur (1 = direct).</summary>
    public Dictionary<string, int> Dependents(string id, int maxDepth = 6)
    {
        var seen = new Dictionary<string, int>();
        var frontier = new Queue<(string Id, int Depth)>();
        frontier.Enqueue((id, 0));
        while (frontier.Count > 0)
        {
            var (cur, d) = frontier.Dequeue();
            if (d >= maxDepth) continue;
            foreach (var dep in DirectDependents(cur))
            {
                if (dep == id || seen.ContainsKey(dep)) continue;
                seen[dep] = d + 1;
                frontier.Enqueue((dep, d + 1));
            }
        }
        return seen;
    }

    /// <summary>Systèmes dont une personne détient le savoir (KNOWS / MAINTAINS) ou dont elle est une dépendance.</summary>
    public HashSet<string> HeldBy(string personId)
    {
        var set = new HashSet<string>();
        foreach (var e in _edges)
        {
            if (KnowledgeTypes.Contains(e.Type) && e.Source == personId) set.Add(e.Target);
            else if (DependencyTypes.Contains(e.Type) && e.Target == personId && !PeopleTypes.Contains(_nodes.GetValueOrDefault(e.Source)?.Type ?? "")) set.Add(e.Source);
        }
        return set;
    }

    /// <summary>Personnes qui détiennent le savoir d'un système.</summary>
    public HashSet<string> Holders(string systemId)
    {
        var set = new HashSet<string>();
        foreach (var e in _edges)
        {
            if (KnowledgeTypes.Contains(e.Type) && e.Target == systemId && IsPerson(e.Source)) set.Add(e.Source);
            else if (DependencyTypes.Contains(e.Type) && e.Source == systemId && IsPerson(e.Target)) set.Add(e.Target);
        }
        return set;
    }

    /// <summary>Accès d'une personne (à révoquer à son départ).</summary>
    public List<string> Accesses(string personId) =>
        _edges.Where(e => e.Source == personId && AccessTypes.Contains(e.Type)).Select(e => e.Target).Distinct().ToList();

    public bool HasRedundancy(string id) => _edges.Any(e => e.Source == id && RedundancyTypes.Contains(e.Type));

    public bool IsPerson(string id) => PeopleTypes.Contains(_nodes.GetValueOrDefault(id)?.Type ?? "");
    public bool IsActivity(string id) => ActivityTypes.Contains(_nodes.GetValueOrDefault(id)?.Type ?? "");
    public bool IsSupplier(string id) => SupplierTypes.Contains(_nodes.GetValueOrDefault(id)?.Type ?? "");

    /// <summary>Personnes reliées à un ensemble d'éléments (utilisateurs à former, équipes concernées).</summary>
    public HashSet<string> PeopleAround(IEnumerable<string> ids)
    {
        var target = ids.ToHashSet();
        var set = new HashSet<string>();
        foreach (var e in _edges)
        {
            if (target.Contains(e.Target) && IsPerson(e.Source)) set.Add(e.Source);
            if (target.Contains(e.Source) && IsPerson(e.Target)) set.Add(e.Target);
        }
        return set;
    }

    /// <summary>
    /// Point unique de défaillance : un élément dont dépend au moins une activité
    /// (ou au moins deux éléments), sans secours déclaré. Une personne l'est aussi
    /// si elle est la seule à détenir le savoir d'un système dont on dépend.
    /// </summary>
    public bool IsSinglePointOfFailure(string id)
    {
        if (HasRedundancy(id)) return false;
        var deps = Dependents(id, 4);
        if (deps.Count == 0) return false;
        return deps.Keys.Any(IsActivity) || deps.Count >= 2;
    }

    public Resilience Measure()
    {
        var spof = _nodes.Keys.Count(IsSinglePointOfFailure);

        var soleSystems = new HashSet<string>();
        var keyPeople = 0;
        foreach (var p in _nodes.Values.Where(n => PeopleTypes.Contains(n.Type)))
        {
            var sole = HeldBy(p.Id).Where(s => Holders(s).Count == 1 && Dependents(s, 4).Count > 0).ToList();
            if (sole.Count > 0) { keyPeople++; foreach (var s in sole) soleSystems.Add(s); }
        }

        var total = Math.Max(1, _nodes.Count);
        string? topSupplier = null;
        double topShare = 0;
        foreach (var s in _nodes.Values.Where(n => SupplierTypes.Contains(n.Type)))
        {
            var share = (double)Dependents(s.Id, 6).Count / total;
            if (share > topShare) { topShare = share; topSupplier = s.Name; }
        }

        // Score lisible, décomposable : chaque fragilité retire des points,
        // pondérés par la taille du graphe pour rester comparable entre espaces.
        var penalty = 100.0 * (spof * 1.0 + keyPeople * 1.5 + soleSystems.Count * 0.5) / (total + 4) + topShare * 25;
        var score = (int)Math.Clamp(Math.Round(100 - penalty), 0, 100);
        return new Resilience(score, spof, keyPeople, soleSystems.Count, Math.Round(topShare, 3), topSupplier, _nodes.Count);
    }
}
