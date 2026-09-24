using Nexus.Graph;

namespace Nexus.Risk;

/// <summary>Qui détient quoi, et par quel lien on l'a établi.</summary>
public sealed record KnowledgeHold(Guid PersonId, Guid SystemId, string Via, bool Direct);

/// <summary>
/// Rattachement des personnes aux systèmes qu'elles font tourner.
///
/// L'écran de dépendance humaine restait VIDE sur des référentiels d'entreprise
/// réels, pour une raison qui n'avait rien à voir avec les données : il
/// n'acceptait que KNOWS et MAINTAINS, avec la personne en SOURCE. Or un
/// document d'entreprise n'écrit jamais « Samuel connaît le core banking ». Il
/// écrit « l'unité informatique a pour responsable PER-006 » et « le core
/// banking appartient à l'unité informatique » : la personne y est la CIBLE du
/// lien, et le rattachement passe par son unité.
///
/// On accepte donc les deux directions, les liens de responsabilité, et UN saut
/// par l'unité d'organisation. Un rattachement indirect est marqué comme tel :
/// il ne sera pas présenté comme un fait direct.
/// </summary>
public static class HumanKnowledgeMap
{
    /// <summary>La personne est la SOURCE : elle sait, elle maintient, elle est responsable.</summary>
    private static readonly HashSet<string> FromPerson = new(StringComparer.OrdinalIgnoreCase)
    {
        "KNOWS", "MAINTAINS", "RESPONSIBLE_FOR", "OPERATED_BY", "CAN_ACT_ON", "HAS_ACCESS_TO",
    };

    /// <summary>La personne est la CIBLE : le système la désigne comme son référent.</summary>
    private static readonly HashSet<string> ToPerson = new(StringComparer.OrdinalIgnoreCase)
    {
        "MANAGED_BY", "OWNED_BY", "MAINTAINS", "OPERATED_BY", "SUPPLIED_BY", "SERVED_BY",
    };

    /// <summary>Le rattachement d'un système à une unité d'organisation.</summary>
    private static readonly HashSet<string> ToUnit = new(StringComparer.OrdinalIgnoreCase)
    {
        "OWNED_BY", "PART_OF", "MANAGED_BY", "OPERATED_BY",
    };

    private static readonly HashSet<string> UnitTypes = new(StringComparer.Ordinal) { "BusinessUnit", "Team", "Organization" };

    /// <summary>Ce qui n'est pas un savoir-faire : on ne « connaît » pas une unité ni un risque.</summary>
    private static readonly HashSet<string> NotKnowledge = new(StringComparer.Ordinal)
    {
        "BusinessUnit", "Team", "Organization", "Person", "Role", "Risk", "Incident", "Contract", "Policy",
    };

    public static IReadOnlyList<KnowledgeHold> Build(
        IReadOnlyList<GraphEntityRecord> entities,
        IReadOnlyList<GraphEdgeRecord> relations)
    {
        var byId = entities.ToDictionary(e => e.Id);
        bool IsPerson(Guid id) => byId.TryGetValue(id, out var e) && e.EntityType == "Person";
        bool IsUnit(Guid id) => byId.TryGetValue(id, out var e) && UnitTypes.Contains(e.EntityType);
        bool IsKnowledge(Guid id) => byId.TryGetValue(id, out var e) && !NotKnowledge.Contains(e.EntityType);

        var holds = new List<KnowledgeHold>();

        foreach (var r in relations)
        {
            if (FromPerson.Contains(r.Type) && IsPerson(r.Source) && IsKnowledge(r.Target))
                holds.Add(new KnowledgeHold(r.Source, r.Target, r.Type, true));
            else if (ToPerson.Contains(r.Type) && IsPerson(r.Target) && IsKnowledge(r.Source))
                holds.Add(new KnowledgeHold(r.Target, r.Source, r.Type, true));
        }

        // Le saut par l'unité, tel que les référentiels l'écrivent.
        var unitLeads = relations
            .Where(r => ToPerson.Contains(r.Type) && IsUnit(r.Source) && IsPerson(r.Target))
            .GroupBy(r => r.Source)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Target).Distinct().ToList());

        foreach (var r in relations)
        {
            if (!ToUnit.Contains(r.Type) || !IsUnit(r.Target) || !IsKnowledge(r.Source)) continue;
            if (!unitLeads.TryGetValue(r.Target, out var leads)) continue;
            foreach (var lead in leads)
                holds.Add(new KnowledgeHold(lead, r.Source, $"{r.Type} → {byId[r.Target].Name}", false));
        }

        // Un lien direct l'emporte sur le même rattachement déduit par l'unité.
        return [.. holds
            .GroupBy(h => (h.PersonId, h.SystemId))
            .Select(g => g.FirstOrDefault(x => x.Direct) ?? g.First())];
    }

    /// <summary>
    /// Le métier d'une personne, tel que le document l'écrit (« Poste :
    /// Responsable informatique ; Unite : UNI-IT ; … »). Sans lui, l'écran
    /// affichait « Knowledge Holder » pour tout le monde, alors que c'est le
    /// poste qui dit si la personne est remplaçable.
    /// </summary>
    public static string? Job(string? description)
    {
        if (string.IsNullOrWhiteSpace(description)) return null;
        string[] keys = ["poste", "fonction", "titre", "role", "job", "title", "position"];
        foreach (var part in description.Split(';'))
        {
            var i = part.IndexOf(':');
            if (i <= 0) continue;
            var key = part[..i].Trim().ToLowerInvariant();
            var value = part[(i + 1)..].Trim();
            if (value.Length is > 1 and < 80 && keys.Any(k => key.Contains(k, StringComparison.Ordinal))) return value;
        }
        return null;
    }
}
