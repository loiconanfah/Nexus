using Nexus.Ingestion.Mapping;

namespace Nexus.Ingestion.Vendors;

/// <summary>
/// Les sources du monde de la LIVRAISON : nuage Google, outils de projet et de
/// savoir, dépôts de code, catalogue de services.
///
/// Ces cinq recettes répondent à une demande précise d'architecte d'entreprise.
/// Elles restent fidèles à la thèse du produit : on ne cherche pas à devenir un
/// référentiel d'architecture, on LIT celui du client pour y ajouter ce qu'il ne
/// sait pas faire, la propagation, le coût et les personnes.
/// </summary>
public static class VendorCatalogDelivery
{
    public const string Delivery = "delivery";

    public static IReadOnlyList<VendorRecipe> All { get; } =
        [GoogleCloud(), Atlassian(), GitHub(), GitLab(), Backstage()];

    /// <summary>
    /// Google Cloud, par l'inventaire des actifs. Complète Azure et AWS : la
    /// concentration sur un nuage ne se voit que si les trois sont dans la même
    /// carte.
    /// </summary>
    private static VendorRecipe GoogleCloud() => new(
        Id: "gcp",
        Name: "Google Cloud",
        Category: VendorCatalog.Cloud,
        SummaryFr: "Ressources d'un projet, leur type, leur région, et leur dépendance au nuage.",
        SummaryEn: "Resources in a project, their type, region, and dependence on the cloud.",
        BringsFr: "Ressources, régions, concentration",
        BringsEn: "Resources, regions, concentration",
        DocUrl: "https://cloud.google.com/asset-inventory/docs/reference/rest/v1/TopLevel/searchAllResources",
        Internal: false,
        // Le compte de service agit pour lui-même : aucune délégation, donc pas
        // d'administrateur à emprunter, contrairement à Workspace.
        Auth: new VendorAuth(VendorAuthKind.GoogleServiceAccount,
            TokenUrl: "https://oauth2.googleapis.com/token",
            Scope: "https://www.googleapis.com/auth/cloud-platform.read-only"),
        Fields:
        [
            new VendorField("projectId", "Identifiant du projet", "Project ID", Placeholder: "mon-projet-prod"),
            new VendorField("serviceAccountEmail", "Courriel du compte de service", "Service account email"),
            new VendorField("privateKey", "Clé privée du compte de service", "Service account private key", Secret: true,
                HelpFr: "Rôle Lecteur d'inventaire des ressources cloud (roles/cloudasset.viewer) sur le projet.",
                HelpEn: "Cloud Asset Viewer role (roles/cloudasset.viewer) on the project."),
        ],
        Datasets:
        [
            new VendorDataset("resources",
                "https://cloudasset.googleapis.com/v1/projects/{projectId}:searchAllResources?pageSize={pageSize}",
                RecordsPath: "results", Page: PageMode.NextKey, NextPath: "nextPageToken",
                PageParam: "pageToken", PageSize: 200,
                Derive: new Dictionary<string, string>
                {
                    // displayName manque sur certains types : le nom complet finit
                    // par l'identifiant de la ressource, qui fait alors l'affaire.
                    ["resourceName"] = "coalesce:displayName|name",
                    ["shortName"] = "path.last:name",
                    ["cloud"] = "const:Google Cloud",
                }),
        ],
        Profile: new MappingProfile("Google Cloud (API)",
            Entities:
            [
                new EntityMapping("resources", "CloudResource", "resourceName",
                    AliasColumns: ["name", "shortName"], DescriptionColumn: "assetType"),
                new EntityMapping("resources", "Location", "location"),
                new EntityMapping("resources", "Supplier", "cloud"),
            ],
            Relations:
            [
                new RelationMapping("resources", "LOCATED_IN", "CloudResource", "resourceName", "Location", "location"),
                new RelationMapping("resources", "SUPPLIED_BY", "CloudResource", "resourceName", "Supplier", "cloud"),
            ]));

    /// <summary>
    /// Jira et Confluence. Un projet Jira nomme son responsable, et une page
    /// Confluence est la procédure dont l'absence transforme une panne en
    /// improvisation. Deux produits, un seul hôte et une seule authentification.
    /// </summary>
    private static VendorRecipe Atlassian() => new(
        Id: "atlassian",
        Name: "Jira et Confluence",
        Category: Delivery,
        SummaryFr: "Projets Jira avec leur responsable, et pages Confluence comme procédures documentées.",
        SummaryEn: "Jira projects with their lead, and Confluence pages as documented procedures.",
        BringsFr: "Équipes, responsables, procédures",
        BringsEn: "Teams, owners, procedures",
        DocUrl: "https://developer.atlassian.com/cloud/jira/platform/rest/v3/",
        Internal: false,
        Auth: new VendorAuth(VendorAuthKind.Basic,
            UserTemplate: "{email}", PasswordTemplate: "{apiToken}"),
        Fields:
        [
            new VendorField("site", "Site Atlassian", "Atlassian site", Placeholder: "monentreprise",
                HelpFr: "Le sous-domaine seul, sans .atlassian.net.", HelpEn: "The subdomain only, without .atlassian.net."),
            new VendorField("email", "Courriel du compte", "Account email"),
            new VendorField("apiToken", "Jeton d'API", "API token", Secret: true,
                HelpFr: "Créé depuis id.atlassian.com, pour un compte en lecture.",
                HelpEn: "Created at id.atlassian.com, for a read-only account."),
        ],
        Datasets:
        [
            new VendorDataset("projects",
                "https://{site}.atlassian.net/rest/api/3/project/search?maxResults={pageSize}&expand=lead",
                RecordsPath: "values", Page: PageMode.NextLink, NextPath: "nextPage", PageSize: 50, MaxPages: 10),
            new VendorDataset("pages",
                "https://{site}.atlassian.net/wiki/api/v2/pages?limit={pageSize}",
                RecordsPath: "results", Page: PageMode.NextLink, NextPath: "_links.next", PageSize: 100, MaxPages: 5),
        ],
        Profile: new MappingProfile("Atlassian (API)",
            Entities:
            [
                new EntityMapping("projects", "Team", "name", AliasColumns: ["key", "id"]),
                new EntityMapping("projects", "Person", "lead.displayName"),
                new EntityMapping("pages", "Document", "title", AliasColumns: ["id"]),
            ],
            Relations:
            [
                new RelationMapping("projects", "MANAGED_BY", "Team", "name", "Person", "lead.displayName"),
            ]));

    /// <summary>
    /// GitHub. Un dépôt est un composant vivant, et l'équipe qui le possède dit
    /// qui saura le remettre en marche un dimanche soir.
    ///
    /// Les comptes individuels ne sont volontairement PAS importés : un identifiant
    /// GitHub ne correspond à aucune personne de l'annuaire, et en créer une
    /// doublerait chaque collaborateur dans la carte.
    /// </summary>
    private static VendorRecipe GitHub() => new(
        Id: "github",
        Name: "GitHub",
        Category: Delivery,
        SummaryFr: "Dépôts d'une organisation et l'équipe qui en est propriétaire.",
        SummaryEn: "An organization's repositories and the team that owns them.",
        BringsFr: "Composants, équipes propriétaires",
        BringsEn: "Components, owning teams",
        DocUrl: "https://docs.github.com/rest/repos/repos",
        Internal: false,
        Auth: new VendorAuth(VendorAuthKind.Headers,
            Headers: new Dictionary<string, string>
            {
                ["Authorization"] = "Bearer {token}",
                ["X-GitHub-Api-Version"] = "2022-11-28",
            }),
        Fields:
        [
            new VendorField("org", "Organisation", "Organization", Placeholder: "mon-organisation"),
            new VendorField("token", "Jeton d'accès", "Access token", Secret: true,
                HelpFr: "Jeton à portée fine, en lecture seule sur les dépôts et les équipes.",
                HelpEn: "Fine-grained token, read-only on repositories and teams."),
        ],
        Datasets:
        [
            new VendorDataset("repos", "https://api.github.com/orgs/{org}/repos?per_page={pageSize}",
                Page: PageMode.LinkHeaderCursor, PageSize: 100, MaxPages: 10),
            new VendorDataset("teams", "https://api.github.com/orgs/{org}/teams?per_page={pageSize}",
                Page: PageMode.LinkHeaderCursor, PageSize: 100, MaxPages: 5),
            new VendorDataset("team-repos", "https://api.github.com/orgs/{org}/teams/{parent}/repos?per_page=100",
                ParentDataset: "teams", ParentKey: "slug", ParentColumns: ["name"], MaxParents: 100),
        ],
        Profile: new MappingProfile("GitHub (API)",
            Entities:
            [
                new EntityMapping("repos", "Service", "name",
                    AliasColumns: ["full_name", "id"], DescriptionColumn: "description"),
                new EntityMapping("teams", "Team", "name", AliasColumns: ["slug", "id"]),
            ],
            Relations:
            [
                new RelationMapping("team-repos", "OWNED_BY", "Service", "name", "Team", "parent.name"),
            ]));

    /// <summary>
    /// GitLab. Même apport que GitHub pour les organisations qui l'ont choisi,
    /// avec le groupe directement porté par le projet, donc sans second appel.
    /// </summary>
    private static VendorRecipe GitLab() => new(
        Id: "gitlab",
        Name: "GitLab",
        Category: Delivery,
        SummaryFr: "Projets d'un groupe et sous-groupes, y compris imbriqués.",
        SummaryEn: "A group's projects and subgroups, including nested ones.",
        BringsFr: "Composants, groupes",
        BringsEn: "Components, groups",
        DocUrl: "https://docs.gitlab.com/ee/api/groups.html#list-a-groups-projects",
        Internal: false,
        Auth: new VendorAuth(VendorAuthKind.Headers,
            Headers: new Dictionary<string, string> { ["PRIVATE-TOKEN"] = "{token}" }),
        Fields:
        [
            new VendorField("host", "Hôte", "Host", Placeholder: "https://gitlab.com",
                HelpFr: "L'URL de votre instance, gitlab.com ou la vôtre.", HelpEn: "Your instance URL, gitlab.com or your own."),
            new VendorField("groupId", "Identifiant du groupe", "Group ID", Placeholder: "1234567"),
            new VendorField("token", "Jeton d'accès", "Access token", Secret: true,
                HelpFr: "Portée read_api suffisante.", HelpEn: "Scope read_api is enough."),
        ],
        Datasets:
        [
            new VendorDataset("projects",
                "{host}/api/v4/groups/{groupId}/projects?include_subgroups=true&per_page={pageSize}",
                Page: PageMode.LinkHeaderCursor, PageSize: 100, MaxPages: 10),
        ],
        Profile: new MappingProfile("GitLab (API)",
            Entities:
            [
                new EntityMapping("projects", "Service", "name",
                    AliasColumns: ["path_with_namespace", "id"], DescriptionColumn: "description"),
                new EntityMapping("projects", "Team", "namespace.name"),
            ],
            Relations:
            [
                new RelationMapping("projects", "PART_OF", "Service", "name", "Team", "namespace.name"),
            ]));

    /// <summary>
    /// Backstage. Le catalogue de services est la seule source où les équipes
    /// DÉCLARENT elles-mêmes de quoi leur composant dépend. C'est la réponse
    /// sérieuse à la demande d'un « catalogue d'API » : un fichier OpenAPI décrit
    /// une interface, il ne dit rien des dépendances.
    /// </summary>
    private static VendorRecipe Backstage() => new(
        Id: "backstage",
        Name: "Backstage",
        Category: Delivery,
        SummaryFr: "Composants du catalogue, leur propriétaire et les dépendances déclarées par les équipes.",
        SummaryEn: "Catalog components, their owner and the dependencies teams declare themselves.",
        BringsFr: "Composants, propriétaires, dépendances",
        BringsEn: "Components, owners, dependencies",
        DocUrl: "https://backstage.io/docs/features/software-catalog/software-catalog-api",
        Internal: false,
        Auth: new VendorAuth(VendorAuthKind.Headers,
            Headers: new Dictionary<string, string> { ["Authorization"] = "Bearer {token}" }),
        Fields:
        [
            new VendorField("baseUrl", "URL de Backstage", "Backstage URL", Placeholder: "https://backstage.monentreprise.com"),
            new VendorField("token", "Jeton d'API", "API token", Secret: true,
                HelpFr: "Jeton en lecture sur le catalogue.", HelpEn: "Read-only token on the catalog."),
        ],
        Datasets:
        [
            new VendorDataset("components",
                "{baseUrl}/api/catalog/entities?filter=kind=component&limit={pageSize}",
                Page: PageMode.OffsetLimit, PageParam: "offset", PageSize: 200, MaxPages: 10),
            // Les dépendances déclarées sont un tableau de références : une ligne
            // par référence, puis on ne garde que le nom.
            new VendorDataset("component-deps",
                "{baseUrl}/api/catalog/entities?filter=kind=component&limit={pageSize}",
                Page: PageMode.OffsetLimit, PageParam: "offset", PageSize: 200, MaxPages: 10,
                ExplodePath: "spec.dependsOn",
                Derive: new Dictionary<string, string> { ["target"] = "path.last:item" }),
        ],
        Profile: new MappingProfile("Backstage (API)",
            Entities:
            [
                new EntityMapping("components", "Service", "metadata.name",
                    AliasColumns: ["metadata.uid"], DescriptionColumn: "metadata.description"),
                new EntityMapping("components", "Team", "spec.owner"),
            ],
            Relations:
            [
                new RelationMapping("components", "OWNED_BY", "Service", "metadata.name", "Team", "spec.owner"),
                new RelationMapping("component-deps", "DEPENDS_ON", "Service", "metadata.name", "Service", "target"),
            ]));
}
