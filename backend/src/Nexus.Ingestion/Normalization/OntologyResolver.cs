using Nexus.Domain.Ontology;

namespace Nexus.Ingestion.Normalization;

/// <summary>
/// Résolution TOLÉRANTE des types d'ontologie à l'ingestion. Les exports réels
/// contiennent des types « en langage naturel » (web application, virtual
/// machine, db…) qui ne correspondent pas exactement au registre. Plutôt que
/// d'ignorer ces lignes, on résout : exact → synonyme → mot-clé → repli.
/// Déterministe (aucune IA requise) et cohérent entre entités et relations.
/// </summary>
public static class OntologyResolver
{
    private static string Norm(string s) => new(s.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());

    // --- Types d'entités : forme normalisée -> nom canonique du registre ---
    private static readonly Dictionary<string, string> EntitySynonyms = Build(new()
    {
        ["Server"] = "server srv vm virtualmachine host node compute machine baremetal hypervisor cacheserver webserver appserver",
        ["Database"] = "db database rdbms sqlserver oracledb postgres postgresql mysql mariadb mongodb nosql dbinstance",
        ["DataStore"] = "datastore objectstore blobstore warehouse datalake",
        ["Application"] = "app application webapp webapplication software program erp crm frontend backend",
        ["Service"] = "service microservice api webservice endpoint function lambda",
        ["System"] = "system platform middleware mainframe legacy",
        ["BusinessProcess"] = "process businessprocess workflow businessfunction procedure operation",
        ["BusinessService"] = "businessservice capability offering",
        ["Supplier"] = "supplier vendor provider saas thirdparty partner externalprovider",
        ["Contract"] = "contract sla agreement license subscription",
        ["Person"] = "person people employee user staff member individual contact human",
        ["Role"] = "role position title",
        ["Team"] = "team squad group department unit crew",
        ["Network"] = "network lan wan vlan subnet sdwan mpls circuit link",
        ["Device"] = "device appliance hardware iot sensor router switch firewall",
        ["CloudResource"] = "cloud cloudresource aws azure gcp s3 bucket ec2 vmss functionapp",
        ["Infrastructure"] = "infrastructure infra facility",
        ["Location"] = "location site datacenter datacentre region office building campus rack zone",
        ["Control"] = "control safeguard countermeasure",
        ["Policy"] = "policy standard guideline",
        ["Document"] = "document doc runbook procedure wiki page",
        ["Incident"] = "incident outage ticket",
        ["Risk"] = "risk threat",
        ["Vulnerability"] = "vulnerability cve weakness",
    });

    // Mots-clés testés en sous-chaîne (du plus spécifique au plus général).
    private static readonly (string Kw, string Type)[] EntityKeywords =
    {
        ("database", "Database"), ("datastore", "DataStore"), ("server", "Server"),
        ("microservice", "Service"), ("webservice", "Service"), ("service", "Service"),
        ("application", "Application"), ("webapp", "Application"), ("app", "Application"),
        ("network", "Network"), ("cloud", "CloudResource"), ("supplier", "Supplier"),
        ("vendor", "Supplier"), ("person", "Person"), ("employee", "Person"),
        ("team", "Team"), ("process", "BusinessProcess"), ("location", "Location"),
        ("site", "Location"), ("device", "Device"), ("system", "System"), ("contract", "Contract"),
    };

    public static EntityType ResolveEntityType(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return EntityType.Asset;
        var exact = EntityType.FromName(raw.Trim());
        if (exact.IsSuccess) return exact.Value;
        var key = Norm(raw);
        if (EntitySynonyms.TryGetValue(key, out var canon)) return EntityType.FromName(canon).Value;
        foreach (var (kw, type) in EntityKeywords)
            if (key.Contains(kw)) return EntityType.FromName(type).Value;
        return EntityType.Asset;   // repli : ne jamais ignorer une ligne pour un type flou
    }

    // --- Types de relations : forme normalisée -> nom canonique ---
    private static readonly Dictionary<string, string> RelationSynonyms = Build(new()
    {
        ["DEPENDS_ON"] = "dependson depends dependsupon requires needs relieson",
        ["RUNS_ON"] = "runson runs executeson deployedon hostedon",
        ["HOSTS"] = "hosts hostedby",
        ["USES"] = "uses consumes calls invokes reads readsfrom integrateswith",
        ["SUPPLIED_BY"] = "suppliedby vendor providedby sourcedfrom",
        ["AUTHENTICATES"] = "authenticates auth authenticateswith authvia",
        ["KNOWS"] = "knows knowledgeof expertise skilledin",
        ["MAINTAINS"] = "maintains owns ownedby responsiblefor manages managedby operatedby",
        ["CONNECTS_TO"] = "connectsto connects connectedto communicateswith peers",
        ["STORES"] = "stores persists writesto writes savesto",
        ["PROTECTS"] = "protects secures defends",
        ["PART_OF"] = "partof belongsto memberof componentof",
        ["LOCATED_IN"] = "locatedin hostedin residesin situatedin",
    });

    public static RelationType ResolveRelationType(string? raw)
    {
        if (!string.IsNullOrWhiteSpace(raw))
        {
            var exact = RelationType.FromName(raw.Trim());
            if (exact.IsSuccess) return exact.Value;
            if (RelationSynonyms.TryGetValue(Norm(raw), out var canon)) return RelationType.FromName(canon).Value;
        }
        return RelationType.DependsOn;   // repli sûr
    }

    private static Dictionary<string, string> Build(Dictionary<string, string> spec)
    {
        var map = new Dictionary<string, string>();
        foreach (var (canonical, words) in spec)
            foreach (var w in words.Split(' ', StringSplitOptions.RemoveEmptyEntries))
                map[w] = canonical;
        return map;
    }
}
