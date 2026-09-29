using Nexus.Ingestion.Mapping;

namespace Nexus.Ingestion.Vendors;

/// <summary>
/// Les connecteurs d'éditeurs réellement branchés.
///
/// Ce catalogue ne contient que des sources INTERROGÉES : chaque entrée nomme un
/// point d'accès, ce qu'il faut saisir pour y accéder, et ce que la réponse
/// devient dans l'ontologie. Un « connecteur » qui se résumerait à téléverser
/// l'export d'un produit n'en est pas un, et n'a pas sa place ici : la promesse
/// d'une carte vivante tient à ce que la source soit relue sans personne.
///
/// Le choix des dix suit les dépendances qui coûtent cher quand elles cassent :
/// l'identité et les personnes (Entra, Okta, Google Workspace), les nuages et
/// leur concentration (Azure, AWS), le référentiel de configuration (ServiceNow,
/// Freshservice), la topologie observée en production (Datadog, Dynatrace) et la
/// plateforme interne (Kubernetes).
/// </summary>
public static class VendorCatalog
{
    /// <summary>Les catégories, pour regrouper à l'écran.</summary>
    public const string Identity = "identity";
    public const string Cloud = "cloud";
    public const string Cmdb = "cmdb";
    public const string Observability = "observability";
    public const string Platform = "platform";

    public static IReadOnlyList<VendorRecipe> All { get; } =
    [
        Entra(), Okta(), GoogleWorkspace(),
        Azure(), Aws(),
        ServiceNow(), Freshservice(),
        Datadog(), Dynatrace(),
        Kubernetes(),
        // Les sources du monde de la livraison, déclarées à part pour garder
        // chaque fichier lisible.
        .. VendorCatalogDelivery.All,
    ];

    public static VendorRecipe? Find(string? id)
        => All.FirstOrDefault(r => string.Equals(r.Id, id, StringComparison.OrdinalIgnoreCase));

    // ─────────────────────────── Identité ───────────────────────────

    /// <summary>
    /// Microsoft Entra ID par Microsoft Graph. La source la plus précieuse du
    /// catalogue : elle apporte les PERSONNES avec leur poste, leur service et
    /// leur responsable, ce qui alimente la dépendance humaine, là où les autres
    /// outils ne voient que des machines.
    /// </summary>
    private static VendorRecipe Entra()
    {
        const string graph = "https://graph.microsoft.com/v1.0";
        return new VendorRecipe(
            Id: "entra",
            Name: "Microsoft Entra ID",
            Category: Identity,
            SummaryFr: "Personnes, postes, services, responsables, groupes et applications, lus dans l'annuaire.",
            SummaryEn: "People, job titles, departments, managers, groups and applications, read from the directory.",
            BringsFr: "Personnes avec leur poste, groupes, applications",
            BringsEn: "People with job titles, groups, applications",
            DocUrl: "https://learn.microsoft.com/graph/api/resources/users",
            Internal: false,
            Auth: new VendorAuth(
                VendorAuthKind.OAuth2ClientCredentials,
                TokenUrl: "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token",
                Scope: "https://graph.microsoft.com/.default"),
            Fields:
            [
                new VendorField("tenantId", "Identifiant du locataire", "Directory (tenant) ID",
                    HelpFr: "Entra ID, page Vue d'ensemble.", HelpEn: "Entra ID, Overview page."),
                new VendorField("clientId", "Identifiant de l'application", "Application (client) ID",
                    HelpFr: "L'inscription d'application créée pour Lenexux.", HelpEn: "The app registration created for Lenexux."),
                new VendorField("clientSecret", "Secret de l'application", "Client secret", Secret: true,
                    HelpFr: "Permissions d'application requises, en lecture seule : User.Read.All, Group.Read.All, Application.Read.All.",
                    HelpEn: "Required read-only application permissions: User.Read.All, Group.Read.All, Application.Read.All."),
            ],
            Datasets:
            [
                new VendorDataset("users",
                    $"{graph}/users?$top={{pageSize}}&$select=id,displayName,jobTitle,department,mail,userPrincipalName&$expand=manager($select=id,displayName)",
                    RecordsPath: "value", Page: PageMode.NextLink, NextPath: "@odata.nextLink", PageSize: 200),
                new VendorDataset("groups",
                    $"{graph}/groups?$top={{pageSize}}&$select=id,displayName,description",
                    RecordsPath: "value", Page: PageMode.NextLink, NextPath: "@odata.nextLink", PageSize: 200),
                new VendorDataset("group-members",
                    $"{graph}/groups/{{parent}}/members?$select=id,displayName,jobTitle",
                    RecordsPath: "value", ParentDataset: "groups", ParentKey: "id",
                    ParentColumns: ["displayName"], MaxParents: 200),
                new VendorDataset("apps",
                    $"{graph}/servicePrincipals?$top={{pageSize}}&$select=id,appId,displayName,servicePrincipalType",
                    RecordsPath: "value", Page: PageMode.NextLink, NextPath: "@odata.nextLink", PageSize: 200),
                new VendorDataset("app-owners",
                    $"{graph}/servicePrincipals/{{parent}}/owners?$select=id,displayName",
                    RecordsPath: "value", ParentDataset: "apps", ParentKey: "id",
                    ParentColumns: ["displayName"], MaxParents: 200),
            ],
            Profile: new MappingProfile("Microsoft Entra ID (API)",
                Entities:
                [
                    new EntityMapping("users", "Person", "displayName",
                        AliasColumns: ["userPrincipalName", "mail", "id"], DescriptionColumn: "jobTitle"),
                    new EntityMapping("users", "BusinessUnit", "department"),
                    new EntityMapping("groups", "Team", "displayName",
                        AliasColumns: ["id"], DescriptionColumn: "description"),
                    new EntityMapping("apps", "Application", "displayName", AliasColumns: ["appId", "id"]),
                ],
                Relations:
                [
                    // Le responsable hiérarchique : c'est lui qui dit si un savoir a
                    // un suppléant, ou si une personne est seule sur sa branche.
                    new RelationMapping("users", "MANAGED_BY", "Person", "displayName", "Person", "manager.displayName"),
                    new RelationMapping("users", "PART_OF", "Person", "displayName", "BusinessUnit", "department"),
                    new RelationMapping("group-members", "PART_OF", "Person", "displayName", "Team", "parent.displayName"),
                    new RelationMapping("app-owners", "MANAGED_BY", "Application", "parent.displayName", "Person", "displayName"),
                ]));
    }

    /// <summary>
    /// Okta. Même apport qu'Entra pour les organisations qui ont choisi un autre
    /// fournisseur d'identité, avec en plus les AFFECTATIONS d'applications : qui
    /// a accès à quoi, donc qui reste seul à pouvoir agir sur un système.
    /// </summary>
    private static VendorRecipe Okta() => new(
        Id: "okta",
        Name: "Okta",
        Category: Identity,
        SummaryFr: "Utilisateurs avec leur poste, applications, et qui a accès à quoi.",
        SummaryEn: "Users with job titles, applications, and who has access to what.",
        BringsFr: "Personnes, applications, accès",
        BringsEn: "People, applications, access",
        DocUrl: "https://developer.okta.com/docs/api/openapi/okta-management/management/tag/User/",
        Internal: false,
        Auth: new VendorAuth(VendorAuthKind.Headers,
            Headers: new Dictionary<string, string> { ["Authorization"] = "SSWS {apiToken}" }),
        Fields:
        [
            new VendorField("orgUrl", "URL de l'organisation", "Org URL", Placeholder: "https://exemple.okta.com"),
            new VendorField("apiToken", "Jeton d'API", "API token", Secret: true,
                HelpFr: "Jeton en lecture seule (rôle Read-only administrator).",
                HelpEn: "Read-only token (Read-only administrator role)."),
        ],
        Datasets:
        [
            new VendorDataset("users", "{orgUrl}/api/v1/users?limit={pageSize}",
                Page: PageMode.LinkHeaderCursor, PageSize: 200,
                Derive: new Dictionary<string, string>
                {
                    ["displayName"] = "concat:profile.firstName|profile.lastName",
                }),
            new VendorDataset("apps", "{orgUrl}/api/v1/apps?limit={pageSize}",
                Page: PageMode.LinkHeaderCursor, PageSize: 200),
            new VendorDataset("app-users", "{orgUrl}/api/v1/apps/{parent}/users?limit=200",
                ParentDataset: "apps", ParentKey: "id", ParentColumns: ["label"], MaxParents: 200,
                Derive: new Dictionary<string, string>
                {
                    ["person"] = "coalesce:profile.email|credentials.userName|profile.login",
                }),
        ],
        Profile: new MappingProfile("Okta (API)",
            Entities:
            [
                new EntityMapping("users", "Person", "displayName",
                    AliasColumns: ["profile.email", "profile.login", "id"], DescriptionColumn: "profile.title"),
                new EntityMapping("users", "BusinessUnit", "profile.department"),
                new EntityMapping("apps", "Application", "label", AliasColumns: ["id"]),
            ],
            Relations:
            [
                new RelationMapping("users", "PART_OF", "Person", "displayName", "BusinessUnit", "profile.department"),
                new RelationMapping("users", "MANAGED_BY", "Person", "displayName", "Person", "profile.manager"),
                // L'accès est résolu par courriel, qui figure dans les alias de la
                // personne : l'affectation d'application ne nomme pas la personne
                // comme l'annuaire le fait.
                new RelationMapping("app-users", "HAS_ACCESS_TO", "Person", "person", "Application", "parent.label"),
            ]));

    /// <summary>
    /// Google Workspace. Le troisième annuaire, indispensable aux organisations
    /// qui ne sont ni Microsoft ni Okta, et qui sont nombreuses en PME.
    /// </summary>
    private static VendorRecipe GoogleWorkspace()
    {
        const string directory = "https://admin.googleapis.com/admin/directory/v1";
        return new VendorRecipe(
            Id: "google-workspace",
            Name: "Google Workspace",
            Category: Identity,
            SummaryFr: "Utilisateurs avec leur intitulé de poste et leur service, groupes et appartenances.",
            SummaryEn: "Users with job title and department, groups and memberships.",
            BringsFr: "Personnes avec leur poste, groupes",
            BringsEn: "People with job titles, groups",
            DocUrl: "https://developers.google.com/admin-sdk/directory/reference/rest/v1/users/list",
            Internal: false,
            Auth: new VendorAuth(VendorAuthKind.GoogleServiceAccount,
                TokenUrl: "https://oauth2.googleapis.com/token",
                Scope: "https://www.googleapis.com/auth/admin.directory.user.readonly "
                     + "https://www.googleapis.com/auth/admin.directory.group.readonly "
                     + "https://www.googleapis.com/auth/admin.directory.group.member.readonly"),
            Fields:
            [
                new VendorField("serviceAccountEmail", "Courriel du compte de service", "Service account email",
                    Placeholder: "lenexux@projet.iam.gserviceaccount.com"),
                new VendorField("privateKey", "Clé privée du compte de service", "Service account private key", Secret: true,
                    HelpFr: "Champ private_key du fichier JSON, en-têtes BEGIN/END comprises.",
                    HelpEn: "The private_key field from the JSON file, including BEGIN/END headers."),
                new VendorField("adminEmail", "Administrateur délégué", "Delegated administrator",
                    HelpFr: "L'annuaire est lu au nom de cet administrateur (délégation à l'échelle du domaine).",
                    HelpEn: "The directory is read on behalf of this administrator (domain-wide delegation)."),
            ],
            Datasets:
            [
                new VendorDataset("users",
                    $"{directory}/users?customer=my_customer&projection=full&maxResults={{pageSize}}",
                    RecordsPath: "users", Page: PageMode.NextKey, NextPath: "nextPageToken",
                    PageParam: "pageToken", PageSize: 200),
                // Le poste vit dans un tableau d'organisations : il faut l'éclater
                // pour l'atteindre, et c'est lui qui rend la dépendance humaine lisible.
                new VendorDataset("user-jobs",
                    $"{directory}/users?customer=my_customer&projection=full&maxResults={{pageSize}}",
                    RecordsPath: "users", Page: PageMode.NextKey, NextPath: "nextPageToken",
                    PageParam: "pageToken", PageSize: 200, ExplodePath: "organizations"),
                new VendorDataset("groups",
                    $"{directory}/groups?customer=my_customer&maxResults={{pageSize}}",
                    RecordsPath: "groups", Page: PageMode.NextKey, NextPath: "nextPageToken",
                    PageParam: "pageToken", PageSize: 200),
                new VendorDataset("group-members",
                    $"{directory}/groups/{{parent}}/members?maxResults=200",
                    RecordsPath: "members", ParentDataset: "groups", ParentKey: "id",
                    ParentColumns: ["name"], MaxParents: 200),
            ],
            Profile: new MappingProfile("Google Workspace (API)",
                Entities:
                [
                    // D'abord la personne AVEC son poste : le premier mapping qui la
                    // crée fixe sa description, les suivants ne font que la retrouver.
                    new EntityMapping("user-jobs", "Person", "name.fullName",
                        AliasColumns: ["primaryEmail", "id"], DescriptionColumn: "item.title"),
                    new EntityMapping("users", "Person", "name.fullName", AliasColumns: ["primaryEmail", "id"]),
                    new EntityMapping("user-jobs", "BusinessUnit", "item.department"),
                    new EntityMapping("groups", "Team", "name", AliasColumns: ["email", "id"]),
                ],
                Relations:
                [
                    new RelationMapping("user-jobs", "PART_OF", "Person", "name.fullName", "BusinessUnit", "item.department"),
                    new RelationMapping("group-members", "PART_OF", "Person", "email", "Team", "parent.name"),
                ]));
    }

    // ──────────────────────────── Nuages ────────────────────────────

    /// <summary>
    /// Azure Resource Graph. Une seule requête rend l'inventaire complet d'un
    /// abonnement, avec le groupe de ressources et la région, donc la
    /// concentration géographique.
    /// </summary>
    private static VendorRecipe Azure() => new(
        Id: "azure",
        Name: "Microsoft Azure",
        Category: Cloud,
        SummaryFr: "Ressources d'un abonnement, leur groupe, leur région, et leur dépendance au nuage.",
        SummaryEn: "Resources in a subscription, their group, region, and dependence on the cloud.",
        BringsFr: "Ressources, régions, concentration",
        BringsEn: "Resources, regions, concentration",
        DocUrl: "https://learn.microsoft.com/azure/governance/resource-graph/overview",
        Internal: false,
        Auth: new VendorAuth(VendorAuthKind.OAuth2ClientCredentials,
            TokenUrl: "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token",
            Scope: "https://management.azure.com/.default"),
        Fields:
        [
            new VendorField("tenantId", "Identifiant du locataire", "Directory (tenant) ID"),
            new VendorField("clientId", "Identifiant de l'application", "Application (client) ID"),
            new VendorField("clientSecret", "Secret de l'application", "Client secret", Secret: true,
                HelpFr: "Rôle Lecteur sur l'abonnement, rien de plus.", HelpEn: "Reader role on the subscription, nothing more."),
            new VendorField("subscriptionId", "Identifiant de l'abonnement", "Subscription ID"),
        ],
        Datasets:
        [
            new VendorDataset("resources",
                "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01",
                RecordsPath: "data", Method: "POST",
                Body: """
                {"subscriptions":["{subscriptionId}"],"query":"resources | project id, name, type, location, resourceGroup | order by name asc | limit 1000"}
                """,
                MaxPages: 1,
                Derive: new Dictionary<string, string> { ["cloud"] = "const:Microsoft Azure" }),
        ],
        Profile: new MappingProfile("Microsoft Azure (API)",
            Entities:
            [
                new EntityMapping("resources", "CloudResource", "name", AliasColumns: ["id"], DescriptionColumn: "type"),
                new EntityMapping("resources", "Infrastructure", "resourceGroup"),
                new EntityMapping("resources", "Location", "location"),
                new EntityMapping("resources", "Supplier", "cloud"),
            ],
            Relations:
            [
                new RelationMapping("resources", "PART_OF", "CloudResource", "name", "Infrastructure", "resourceGroup"),
                new RelationMapping("resources", "LOCATED_IN", "CloudResource", "name", "Location", "location"),
                // La dépendance que personne ne déclare et que tout le monde a.
                new RelationMapping("resources", "SUPPLIED_BY", "CloudResource", "name", "Supplier", "cloud"),
            ]));

    /// <summary>
    /// AWS, par l'API d'étiquetage : le seul inventaire transversal qui couvre
    /// tous les services d'une région en un appel. L'ARN porte le service et la
    /// région, que des colonnes dérivées extraient.
    /// </summary>
    private static VendorRecipe Aws() => new(
        Id: "aws",
        Name: "Amazon Web Services",
        Category: Cloud,
        SummaryFr: "Ressources d'une région, leur service et leur dépendance au nuage.",
        SummaryEn: "Resources in a region, their service and their dependence on the cloud.",
        BringsFr: "Ressources, services, concentration",
        BringsEn: "Resources, services, concentration",
        DocUrl: "https://docs.aws.amazon.com/resourcegroupstagging/latest/APIReference/API_GetResources.html",
        Internal: false,
        Auth: new VendorAuth(VendorAuthKind.AwsSigV4, AwsService: "tagging", AwsRegion: "{region}"),
        Fields:
        [
            new VendorField("accessKeyId", "Identifiant de clé d'accès", "Access key ID"),
            new VendorField("secretAccessKey", "Clé d'accès secrète", "Secret access key", Secret: true,
                HelpFr: "Politique en lecture seule : tag:GetResources suffit.",
                HelpEn: "Read-only policy: tag:GetResources is enough."),
            new VendorField("region", "Région", "Region", Placeholder: "ca-central-1"),
        ],
        Datasets:
        [
            new VendorDataset("resources", "https://tagging.{region}.amazonaws.com/",
                RecordsPath: "ResourceTagMappingList", Method: "POST",
                Body: """{"ResourcesPerPage":{pageSize},"PaginationToken":"{pageToken}"}""",
                Page: PageMode.BodyToken, NextPath: "PaginationToken", PageSize: 100,
                Headers: new Dictionary<string, string>
                {
                    ["X-Amz-Target"] = "ResourceGroupsTaggingAPI_20170126.GetResources",
                    ["Content-Type"] = "application/x-amz-json-1.1",
                },
                Derive: new Dictionary<string, string>
                {
                    ["name"] = "arn.name:ResourceARN",
                    ["service"] = "arn.service:ResourceARN",
                    ["region"] = "arn.region:ResourceARN",
                    ["cloud"] = "const:Amazon Web Services",
                }),
        ],
        Profile: new MappingProfile("Amazon Web Services (API)",
            Entities:
            [
                new EntityMapping("resources", "CloudResource", "name",
                    AliasColumns: ["ResourceARN"], DescriptionColumn: "service"),
                new EntityMapping("resources", "Location", "region"),
                new EntityMapping("resources", "Supplier", "cloud"),
            ],
            Relations:
            [
                new RelationMapping("resources", "LOCATED_IN", "CloudResource", "name", "Location", "region"),
                new RelationMapping("resources", "SUPPLIED_BY", "CloudResource", "name", "Supplier", "cloud"),
            ]));

    // ───────────────────── Référentiel de configuration ─────────────────────

    /// <summary>
    /// ServiceNow. La CMDB est le référentiel le plus répandu en grande
    /// entreprise, et sa table de relations contient des dépendances DÉCLARÉES,
    /// que rien d'autre ne fournit.
    /// </summary>
    private static VendorRecipe ServiceNow() => new(
        Id: "servicenow",
        Name: "ServiceNow CMDB",
        Category: Cmdb,
        SummaryFr: "Éléments de configuration, leurs dépendances déclarées et leurs responsables.",
        SummaryEn: "Configuration items, their declared dependencies and their owners.",
        BringsFr: "Actifs, dépendances, responsables",
        BringsEn: "Assets, dependencies, owners",
        DocUrl: "https://developer.servicenow.com/dev.do#!/reference/api/latest/rest/c_TableAPI",
        Internal: false,
        Auth: new VendorAuth(VendorAuthKind.Basic,
            UserTemplate: "{username}", PasswordTemplate: "{password}"),
        Fields:
        [
            new VendorField("instance", "Instance", "Instance", Placeholder: "monentreprise",
                HelpFr: "Le sous-domaine seul, sans .service-now.com.", HelpEn: "The subdomain only, without .service-now.com."),
            new VendorField("username", "Compte de lecture", "Read-only account"),
            new VendorField("password", "Mot de passe", "Password", Secret: true,
                HelpFr: "Un compte avec le rôle itil en lecture, ou snc_read_only.",
                HelpEn: "An account with read-only itil, or snc_read_only."),
        ],
        Datasets:
        [
            // Les valeurs d'affichage sont demandées explicitement : sans elles, une
            // relation ne renvoie que des sys_id, et la carte devient illisible.
            new VendorDataset("cis",
                "https://{instance}.service-now.com/api/now/table/cmdb_ci"
                + "?sysparm_limit={pageSize}&sysparm_display_value=true&sysparm_exclude_reference_link=true"
                + "&sysparm_fields=sys_id,name,sys_class_name,short_description,assigned_to",
                RecordsPath: "result", Page: PageMode.OffsetLimit, PageParam: "sysparm_offset", PageSize: 200),
            new VendorDataset("relations",
                "https://{instance}.service-now.com/api/now/table/cmdb_rel_ci"
                + "?sysparm_limit={pageSize}&sysparm_display_value=true&sysparm_exclude_reference_link=true"
                + "&sysparm_fields=parent,child,type",
                RecordsPath: "result", Page: PageMode.OffsetLimit, PageParam: "sysparm_offset", PageSize: 200),
        ],
        Profile: new MappingProfile("ServiceNow CMDB (API)",
            Entities:
            [
                new EntityMapping("cis", "Asset", "name",
                    AliasColumns: ["sys_id"], DescriptionColumn: "short_description",
                    EntityTypeColumn: "sys_class_name"),
                new EntityMapping("cis", "Person", "assigned_to"),
            ],
            Relations:
            [
                // Convention ServiceNow : dans cmdb_rel_ci, le parent dépend de l'enfant.
                new RelationMapping("relations", "DEPENDS_ON", "Asset", "parent", "Asset", "child"),
                new RelationMapping("cis", "MANAGED_BY", "Asset", "name", "Person", "assigned_to"),
            ]));

    /// <summary>
    /// Freshservice. Le référentiel des organisations de taille moyenne, avec la
    /// même idée qu'une CMDB mais sans le prix ni le projet d'intégration.
    /// </summary>
    private static VendorRecipe Freshservice() => new(
        Id: "freshservice",
        Name: "Freshservice",
        Category: Cmdb,
        SummaryFr: "Actifs et relations entre actifs, lus dans la CMDB.",
        SummaryEn: "Assets and asset relationships, read from the CMDB.",
        BringsFr: "Actifs, relations",
        BringsEn: "Assets, relationships",
        DocUrl: "https://api.freshservice.com/#assets",
        Internal: false,
        Auth: new VendorAuth(VendorAuthKind.Basic,
            UserTemplate: "{apiKey}", PasswordTemplate: "X"),
        Fields:
        [
            new VendorField("domain", "Domaine", "Domain", Placeholder: "monentreprise",
                HelpFr: "Le sous-domaine seul, sans .freshservice.com.", HelpEn: "The subdomain only, without .freshservice.com."),
            new VendorField("apiKey", "Clé d'API", "API key", Secret: true,
                HelpFr: "Profil de l'agent, section Votre clé d'API.", HelpEn: "Agent profile, Your API key section."),
        ],
        Datasets:
        [
            new VendorDataset("assets",
                "https://{domain}.freshservice.com/api/v2/assets?per_page={pageSize}",
                RecordsPath: "assets", Page: PageMode.PageNumber, PageParam: "page", PageSize: 100),
            new VendorDataset("relationships",
                "https://{domain}.freshservice.com/api/v2/relationships?per_page={pageSize}",
                RecordsPath: "relationships", Page: PageMode.PageNumber, PageParam: "page", PageSize: 100),
        ],
        Profile: new MappingProfile("Freshservice (API)",
            Entities:
            [
                new EntityMapping("assets", "Asset", "name",
                    AliasColumns: ["display_id", "id"], DescriptionColumn: "description"),
            ],
            Relations:
            [
                // Les extrémités arrivent en identifiants : elles se résolvent par les
                // alias de l'actif, portés par le mapping ci-dessus.
                new RelationMapping("relationships", "DEPENDS_ON", "Asset", "primary_id", "Asset", "secondary_id"),
            ]));

    // ───────────────────── Topologie observée ─────────────────────

    /// <summary>
    /// Datadog. Sa carte de services est construite à partir des appels RÉELS
    /// observés en production : c'est la source la plus honnête sur ce qui
    /// dépend de quoi, puisqu'elle ne repose sur aucune déclaration.
    /// </summary>
    private static VendorRecipe Datadog() => new(
        Id: "datadog",
        Name: "Datadog",
        Category: Observability,
        SummaryFr: "Services et appels réellement observés entre eux.",
        SummaryEn: "Services and the calls actually observed between them.",
        BringsFr: "Services, dépendances observées",
        BringsEn: "Services, observed dependencies",
        DocUrl: "https://docs.datadoghq.com/api/latest/service-dependencies/",
        Internal: false,
        Auth: new VendorAuth(VendorAuthKind.Headers,
            Headers: new Dictionary<string, string>
            {
                ["DD-API-KEY"] = "{apiKey}",
                ["DD-APPLICATION-KEY"] = "{appKey}",
            }),
        Fields:
        [
            new VendorField("site", "Site", "Site", Placeholder: "datadoghq.com",
                HelpFr: "datadoghq.com, datadoghq.eu, ou le site de votre organisation.",
                HelpEn: "datadoghq.com, datadoghq.eu, or your organization's site."),
            new VendorField("apiKey", "Clé d'API", "API key", Secret: true),
            new VendorField("appKey", "Clé d'application", "Application key", Secret: true,
                HelpFr: "Portée apm_service_catalog_read suffisante.", HelpEn: "Scope apm_service_catalog_read is enough."),
        ],
        Datasets:
        [
            // La réponse est un OBJET dont chaque propriété est un service : sa clé
            // devient le nom, et le tableau d'appels donne les dépendances.
            new VendorDataset("services", "https://api.{site}/api/v1/service_dependencies",
                Shape: RecordShape.ObjectMap),
            new VendorDataset("service-calls", "https://api.{site}/api/v1/service_dependencies",
                Shape: RecordShape.ObjectMap, ExplodePath: "calls"),
        ],
        Profile: new MappingProfile("Datadog (API)",
            Entities: [new EntityMapping("services", "Service", "key")],
            Relations:
            [
                new RelationMapping("service-calls", "DEPENDS_ON", "Service", "key", "Service", "item"),
            ]));

    /// <summary>
    /// Dynatrace. Smartscape découvre la topologie sans configuration ; les
    /// relations sortantes d'un service donnent les dépendances runtime.
    /// </summary>
    private static VendorRecipe Dynatrace() => new(
        Id: "dynatrace",
        Name: "Dynatrace",
        Category: Observability,
        SummaryFr: "Services et hôtes découverts automatiquement, et les appels entre services.",
        SummaryEn: "Auto-discovered services and hosts, and the calls between services.",
        BringsFr: "Services, hôtes, dépendances observées",
        BringsEn: "Services, hosts, observed dependencies",
        DocUrl: "https://docs.dynatrace.com/docs/dynatrace-api/environment-api/entity-v2",
        Internal: false,
        Auth: new VendorAuth(VendorAuthKind.Headers,
            Headers: new Dictionary<string, string> { ["Authorization"] = "Api-Token {apiToken}" }),
        Fields:
        [
            new VendorField("baseUrl", "URL de l'environnement", "Environment URL",
                Placeholder: "https://abc12345.live.dynatrace.com"),
            new VendorField("apiToken", "Jeton d'API", "API token", Secret: true,
                HelpFr: "Portée entities.read seule.", HelpEn: "Scope entities.read only."),
        ],
        Datasets:
        [
            new VendorDataset("services",
                "{baseUrl}/api/v2/entities?entitySelector=type%28%22SERVICE%22%29&pageSize={pageSize}",
                RecordsPath: "entities", PageSize: 500, MaxPages: 1),
            new VendorDataset("hosts",
                "{baseUrl}/api/v2/entities?entitySelector=type%28%22HOST%22%29&pageSize={pageSize}",
                RecordsPath: "entities", PageSize: 500, MaxPages: 1),
            // Les relations sont imbriquées dans chaque entité : il faut les éclater.
            new VendorDataset("service-calls",
                "{baseUrl}/api/v2/entities?entitySelector=type%28%22SERVICE%22%29&fields=%2BfromRelationships&pageSize={pageSize}",
                RecordsPath: "entities", PageSize: 500, MaxPages: 1,
                ExplodePath: "fromRelationships.calls"),
        ],
        Profile: new MappingProfile("Dynatrace (API)",
            Entities:
            [
                new EntityMapping("services", "Service", "displayName", AliasColumns: ["entityId"]),
                new EntityMapping("hosts", "Server", "displayName", AliasColumns: ["entityId"]),
            ],
            Relations:
            [
                // La cible est un identifiant d'entité, résolu par l'alias du service.
                new RelationMapping("service-calls", "DEPENDS_ON", "Service", "displayName", "Service", "item.id"),
            ]));

    // ───────────────────── Plateforme interne ─────────────────────

    /// <summary>
    /// Kubernetes. Source INTERNE : le serveur d'API n'est pas exposé sur
    /// Internet, la lecture passe donc obligatoirement par la sonde Collector
    /// installée dans le réseau du client.
    /// </summary>
    private static VendorRecipe Kubernetes() => new(
        Id: "kubernetes",
        Name: "Kubernetes",
        Category: Platform,
        SummaryFr: "Espaces de noms, déploiements et services du cluster.",
        SummaryEn: "Cluster namespaces, deployments and services.",
        BringsFr: "Charges, services, espaces de noms",
        BringsEn: "Workloads, services, namespaces",
        DocUrl: "https://kubernetes.io/docs/reference/kubernetes-api/",
        Internal: true,
        Auth: new VendorAuth(VendorAuthKind.Headers,
            Headers: new Dictionary<string, string> { ["Authorization"] = "Bearer {token}" }),
        Fields:
        [
            new VendorField("apiServer", "Serveur d'API", "API server", Placeholder: "https://10.0.0.10:6443"),
            new VendorField("token", "Jeton du compte de service", "Service account token", Secret: true,
                HelpFr: "Un compte de service avec le ClusterRole view.",
                HelpEn: "A service account bound to the view ClusterRole."),
        ],
        Datasets:
        [
            new VendorDataset("namespaces", "{apiServer}/api/v1/namespaces?limit={pageSize}",
                RecordsPath: "items", PageSize: 200, MaxPages: 1),
            new VendorDataset("deployments", "{apiServer}/apis/apps/v1/deployments?limit={pageSize}",
                RecordsPath: "items", PageSize: 500, MaxPages: 1),
            new VendorDataset("services", "{apiServer}/api/v1/services?limit={pageSize}",
                RecordsPath: "items", PageSize: 500, MaxPages: 1),
        ],
        Profile: new MappingProfile("Kubernetes (API)",
            Entities:
            [
                new EntityMapping("namespaces", "Infrastructure", "metadata.name"),
                new EntityMapping("deployments", "Service", "metadata.name", AliasColumns: ["metadata.uid"]),
                new EntityMapping("services", "Service", "metadata.name", AliasColumns: ["metadata.uid"]),
            ],
            Relations:
            [
                new RelationMapping("deployments", "PART_OF", "Service", "metadata.name", "Infrastructure", "metadata.namespace"),
                new RelationMapping("services", "PART_OF", "Service", "metadata.name", "Infrastructure", "metadata.namespace"),
            ]));
}
