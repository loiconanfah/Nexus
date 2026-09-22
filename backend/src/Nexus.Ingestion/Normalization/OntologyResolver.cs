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
    // Minuscules, sans accents ni séparateurs : « Base de données » devient « basededonnees ».
    private static string Norm(string s) => new(TextFold.RemoveDiacritics(s).Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());

    // --- Types d'entités : forme normalisée -> nom canonique du registre ---
    private static readonly Dictionary<string, string> EntitySynonyms = Build(new()
    {
        ["Server"] = "server srv vm virtualmachine host node compute machine baremetal hypervisor cacheserver webserver appserver serveur serveurs machinevirtuelle",
        ["Database"] = "db database rdbms sqlserver oracledb postgres postgresql mysql mariadb mongodb nosql dbinstance basededonnees bdd sgbd",
        ["DataStore"] = "datastore objectstore blobstore warehouse datalake",
        ["Application"] = "app application webapp webapplication software program erp crm frontend backend logiciel progiciel applicatif",
        ["Service"] = "service microservice api webservice endpoint function lambda",
        ["System"] = "system platform middleware mainframe legacy systeme plateforme",
        ["BusinessProcess"] = "process businessprocess workflow businessfunction procedure operation processus processusmetier activite activitemetier fonctionmetier",
        ["BusinessService"] = "businessservice capability offering servicemetier serviceclient offre produit",
        ["Supplier"] = "supplier vendor provider saas thirdparty partner externalprovider fournisseur prestataire partenaire soustraitant operateur editeur tiers",
        ["Contract"] = "contract sla agreement license subscription contrat convention accord licence abonnement",
        ["Person"] = "person people employee user staff member individual contact human personne employe collaborateur agent salarie utilisateur",
        ["Role"] = "role position title poste fonction",
        ["BusinessUnit"] = "businessunit direction departement division unite",
        ["Team"] = "team squad group department unit crew equipe cellule",
        ["Network"] = "network lan wan vlan subnet sdwan mpls circuit link reseau liaison lienreseau vsat fibre",
        ["Device"] = "device appliance hardware iot sensor router switch firewall equipement appareil terminal routeur commutateur parefeu tpe gab dab",
        ["CloudResource"] = "cloud cloudresource aws azure gcp s3 bucket ec2 vmss functionapp",
        ["Infrastructure"] = "infrastructure infra facility groupeelectrogene onduleur energie climatisation",
        ["Location"] = "location site datacenter datacentre region office building campus rack zone agence siege lieu bureau entrepot succursale centrededonnees",
        ["Control"] = "control safeguard countermeasure controle mesure mesuredesecurite",
        ["Policy"] = "policy standard guideline politique norme directive",
        ["Document"] = "document doc runbook procedure wiki page procedure manuel",
        ["Incident"] = "incident outage ticket panne interruption sinistre",
        ["Risk"] = "risk threat risque menace",
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
        ("serveur", "Server"), ("basede", "Database"), ("fournisseur", "Supplier"), ("prestataire", "Supplier"),
        ("agence", "Location"), ("reseau", "Network"), ("processus", "BusinessProcess"), ("logiciel", "Application"),
        ("equipe", "Team"), ("personne", "Person"), ("systeme", "System"), ("contrat", "Contract"),
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
        ["DEPENDS_ON"] = "dependson depends dependsupon requires needs relieson dependde depend abesoinde necessite reposesur sappuiesur",
        ["RUNS_ON"] = "runson runs executeson deployedon hostedon tournesur fonctionnesur hebergesur deployesur executesur",
        ["HOSTS"] = "hosts hostedby heberge accueille",
        ["USES"] = "uses consumes calls invokes reads readsfrom integrateswith utilise consomme appelle integre sinterfaceavec",
        ["SUPPLIED_BY"] = "suppliedby vendor providedby sourcedfrom fournipar fourniepar livrepar assurepar",
        ["AUTHENTICATES"] = "authenticates auth authenticateswith authvia authentifie",
        ["KNOWS"] = "knows knowledgeof expertise skilledin connait maitrise",
        ["MAINTAINS"] = "maintains owns ownedby responsiblefor manages managedby operatedby maintient administre",
        ["CONNECTS_TO"] = "connectsto connects connectedto communicateswith peers connectea reliea communiqueavec",
        ["STORES"] = "stores persists writesto writes savesto stocke conserve enregistre",
        ["PROTECTS"] = "protects secures defends protege securise",
        ["PART_OF"] = "partof belongsto memberof componentof faitpartiede appartienta composantde",
        ["LOCATED_IN"] = "locatedin hostedin residesin situatedin situea situedans localisea installea basea implantea",
        ["MANAGED_BY"] = "gerepar pilotepar",
        ["OPERATED_BY"] = "exploitepar operepar",
        ["RESPONSIBLE_FOR"] = "responsablede enchargede",
        ["BACKED_UP_BY"] = "backedupby secourupar sauvegardepar doublepar",
        ["REPLACED_BY"] = "replacedby remplacepar",
        ["IMPACTS"] = "impacts affects impacte affecte atouche perturbe",
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
