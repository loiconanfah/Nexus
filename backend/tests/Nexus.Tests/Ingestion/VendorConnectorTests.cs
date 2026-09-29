using System.Net;
using System.Text;
using Nexus.Connectors;
using Nexus.Ingestion.Normalization;
using Nexus.Ingestion.Vendors;

namespace Nexus.Tests.Ingestion;

/// <summary>
/// Les connecteurs d'éditeurs, éprouvés sur des réponses ENREGISTRÉES.
///
/// Aucun compte chez l'éditeur n'est nécessaire, et c'est précisément l'intérêt :
/// ce qui casse dans un connecteur n'est presque jamais le réseau, c'est la
/// lecture de la réponse (un champ imbriqué, une propriété dont le nom contient
/// un point, un tableau de relations, une page suivante). Ces formes sont ici
/// figées, si bien qu'une régression se voit sans rien brancher.
/// </summary>
public class VendorConnectorTests
{
    // ── Faux éditeur ──

    private sealed class FakeApi : HttpMessageHandler
    {
        private readonly List<(string Match, Queue<(string Json, string? Link, HttpStatusCode Status)> Pages)> _routes = [];
        public List<string> Requested { get; } = [];
        public List<string> Bodies { get; } = [];

        public FakeApi Add(string match, string json, string? link = null, HttpStatusCode status = HttpStatusCode.OK)
        {
            var route = _routes.FirstOrDefault(r => r.Match == match);
            if (route.Pages is null)
            {
                route = (match, new Queue<(string, string?, HttpStatusCode)>());
                _routes.Add(route);
            }
            route.Pages.Enqueue((json, link, status));
            return this;
        }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var url = request.RequestUri!.ToString();
            Requested.Add(url);
            if (request.Content is not null) Bodies.Add(await request.Content.ReadAsStringAsync(ct));

            foreach (var (match, pages) in _routes)
            {
                if (!url.Contains(match, StringComparison.OrdinalIgnoreCase) || pages.Count == 0) continue;
                var (json, link, status) = pages.Dequeue();
                var response = new HttpResponseMessage(status)
                {
                    Content = new StringContent(json, Encoding.UTF8, "application/json"),
                };
                if (link is not null) response.Headers.TryAddWithoutValidation("Link", link);
                return response;
            }
            return new HttpResponseMessage(HttpStatusCode.NotFound)
            {
                Content = new StringContent("""{"error":"no fake route"}""", Encoding.UTF8, "application/json"),
            };
        }
    }

    private static VendorApiConnector Connect(string recipeId, FakeApi api, Dictionary<string, string> settings)
        => new(new HttpClient(api), VendorCatalog.Find(recipeId)!, settings, allowInternalTargets: true);

    private static async Task<List<RawRecord>> ReadAsync(VendorApiConnector connector, string dataset)
    {
        var records = new List<RawRecord>();
        await foreach (var record in connector.ExtractAsync(dataset)) records.Add(record);
        return records;
    }

    private const string MicrosoftToken = """{"access_token":"jeton-de-test","expires_in":3600}""";

    private static Dictionary<string, string> EntraSettings() => new()
    {
        ["tenantId"] = "11111111-1111-1111-1111-111111111111",
        ["clientId"] = "22222222-2222-2222-2222-222222222222",
        ["clientSecret"] = "secret-de-test",
    };

    // ── Microsoft Entra ID ──

    [Fact]
    public async Task Entra_reads_people_with_their_job_title_and_manager()
    {
        var api = new FakeApi()
            .Add("oauth2/v2.0/token", MicrosoftToken)
            .Add("/users", """
            {"value":[
              {"id":"u1","displayName":"Marie Diallo","jobTitle":"Responsable paiements","department":"Opérations",
               "mail":"marie@exemple.com","userPrincipalName":"marie@exemple.com",
               "manager":{"id":"u2","displayName":"Paul Kamga"}},
              {"id":"u2","displayName":"Paul Kamga","jobTitle":"Directeur des opérations","department":"Opérations",
               "mail":"paul@exemple.com","userPrincipalName":"paul@exemple.com"}
            ]}
            """);

        var connector = Connect("entra", api, EntraSettings());
        var records = await ReadAsync(connector, "users");

        Assert.Equal(2, records.Count);
        Assert.Equal("Marie Diallo", records[0].Get("displayName"));
        Assert.Equal("Responsable paiements", records[0].Get("jobTitle"));
        // Le responsable est imbriqué : sans aplatissement, la dépendance
        // hiérarchique serait perdue.
        Assert.Equal("Paul Kamga", records[0].Get("manager.displayName"));
        Assert.Null(records[1].Get("manager.displayName"));
    }

    [Fact]
    public async Task Entra_person_carries_her_job_title_as_description()
    {
        var api = new FakeApi()
            .Add("oauth2/v2.0/token", MicrosoftToken)
            .Add("/users", """
            {"value":[{"id":"u1","displayName":"Marie Diallo","jobTitle":"Responsable paiements",
                       "department":"Opérations","userPrincipalName":"marie@exemple.com"}]}
            """);

        var recipe = VendorCatalog.Find("entra")!;
        var records = await ReadAsync(Connect("entra", api, EntraSettings()), "users");
        var mapping = recipe.Profile.Entities.First(e => e.Dataset == "users" && e.EntityType == "Person");

        var candidate = new NormalizationEngine().NormalizeEntity(records[0], mapping);

        Assert.True(candidate.IsSuccess);
        Assert.Equal("Marie Diallo", candidate.Value.Name);
        // C'est cette description que la dépendance humaine lit pour trouver le poste.
        Assert.Equal("Responsable paiements", candidate.Value.Description);
        Assert.Contains("marie@exemple.com", candidate.Value.Aliases);
    }

    [Fact]
    public async Task Entra_follows_the_next_page_even_when_the_property_name_contains_a_dot()
    {
        var api = new FakeApi()
            .Add("oauth2/v2.0/token", MicrosoftToken)
            .Add("/users", """
            {"value":[{"id":"u1","displayName":"Marie Diallo"}],
             "@odata.nextLink":"https://graph.microsoft.com/v1.0/users?$skiptoken=page2"}
            """)
            .Add("skiptoken=page2", """{"value":[{"id":"u2","displayName":"Paul Kamga"}]}""");

        var records = await ReadAsync(Connect("entra", api, EntraSettings()), "users");

        Assert.Equal(2, records.Count);
        Assert.Contains("skiptoken=page2", api.Requested[^1]);
    }

    [Fact]
    public async Task Entra_group_members_keep_the_name_of_their_group()
    {
        var api = new FakeApi()
            .Add("oauth2/v2.0/token", MicrosoftToken)
            .Add("/groups?", """{"value":[{"id":"g1","displayName":"Équipe paiements","description":"Exploitation"}]}""")
            .Add("/groups/g1/members", """{"value":[{"id":"u1","displayName":"Marie Diallo","jobTitle":"Responsable paiements"}]}""");

        var records = await ReadAsync(Connect("entra", api, EntraSettings()), "group-members");

        Assert.Single(records);
        Assert.Equal("Marie Diallo", records[0].Get("displayName"));
        // Sans la colonne du parent, l'appartenance n'aurait pas de cible.
        Assert.Equal("Équipe paiements", records[0].Get("parent.displayName"));
    }

    [Fact]
    public async Task A_refused_dataset_is_reported_and_does_not_lose_the_others()
    {
        var api = new FakeApi()
            .Add("oauth2/v2.0/token", MicrosoftToken)
            .Add("/users", """{"value":[{"id":"u1","displayName":"Marie Diallo"}]}""")
            .Add("/groups?", """{"error":{"message":"Insufficient privileges"}}""", status: HttpStatusCode.Forbidden);

        var connector = Connect("entra", api, EntraSettings());
        var users = await ReadAsync(connector, "users");
        var groups = await ReadAsync(connector, "groups");

        Assert.Single(users);
        Assert.Empty(groups);
        Assert.Single(connector.Warnings);
        Assert.Contains("permission", connector.Warnings[0], StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task A_dataset_is_requested_once_even_when_several_mappings_read_it()
    {
        var api = new FakeApi()
            .Add("oauth2/v2.0/token", MicrosoftToken)
            .Add("/users", """{"value":[{"id":"u1","displayName":"Marie Diallo","department":"Opérations"}]}""");

        var connector = Connect("entra", api, EntraSettings());
        await ReadAsync(connector, "users");
        await ReadAsync(connector, "users");

        // Une seule lecture réelle : le pipeline parcourt le même jeu de données
        // une fois par mapping, et l'éditeur limiterait le débit.
        Assert.Equal(1, api.Requested.Count(u => u.Contains("/users")));
    }

    // ── Datadog ──

    [Fact]
    public async Task Datadog_reads_services_from_an_object_and_their_observed_calls()
    {
        const string dependencies = """
        {"paiement":{"calls":["core-banking","notification"]},
         "core-banking":{"calls":["oracle-db"]}}
        """;
        var api = new FakeApi()
            .Add("service_dependencies", dependencies)
            .Add("service_dependencies", dependencies);
        var settings = new Dictionary<string, string>
        {
            ["site"] = "datadoghq.com", ["apiKey"] = "k", ["appKey"] = "a",
        };

        var connector = Connect("datadog", api, settings);
        var services = await ReadAsync(connector, "services");
        var calls = await ReadAsync(connector, "service-calls");

        // La réponse est un objet, pas un tableau : chaque clé est un service.
        Assert.Equal(2, services.Count);
        Assert.Equal("paiement", services[0].Get("key"));

        Assert.Equal(3, calls.Count);
        Assert.Equal("paiement", calls[0].Get("key"));
        Assert.Equal("core-banking", calls[0].Get("item"));
        Assert.Equal("oracle-db", calls[2].Get("item"));
    }

    [Fact]
    public async Task Datadog_calls_become_dependencies_between_services()
    {
        var api = new FakeApi().Add("service_dependencies", """{"paiement":{"calls":["core-banking"]}}""");
        var settings = new Dictionary<string, string> { ["site"] = "datadoghq.com", ["apiKey"] = "k", ["appKey"] = "a" };
        var recipe = VendorCatalog.Find("datadog")!;

        var calls = await ReadAsync(Connect("datadog", api, settings), "service-calls");
        var mapping = recipe.Profile.Relations.First(r => r.Dataset == "service-calls");
        var relation = new NormalizationEngine().NormalizeRelation(calls[0], mapping);

        Assert.True(relation.IsSuccess);
        Assert.Equal("paiement", relation.Value.SourceName);
        Assert.Equal("core-banking", relation.Value.TargetName);
        Assert.Equal("DEPENDS_ON", relation.Value.Type.Name);
    }

    // ── Dynatrace ──

    [Fact]
    public async Task Dynatrace_explodes_nested_relationships_into_one_row_each()
    {
        var api = new FakeApi().Add("fromRelationships", """
        {"entities":[
          {"entityId":"SERVICE-1","displayName":"Paiement",
           "fromRelationships":{"calls":[{"id":"SERVICE-2","type":"SERVICE"},{"id":"SERVICE-3","type":"SERVICE"}]}}
        ]}
        """);
        var settings = new Dictionary<string, string>
        {
            ["baseUrl"] = "https://abc12345.live.dynatrace.com", ["apiToken"] = "t",
        };

        var records = await ReadAsync(Connect("dynatrace", api, settings), "service-calls");

        Assert.Equal(2, records.Count);
        Assert.Equal("Paiement", records[0].Get("displayName"));
        Assert.Equal("SERVICE-2", records[0].Get("item.id"));
        Assert.Equal("SERVICE-3", records[1].Get("item.id"));
        // Les deux lignes doivent porter des clés de source distinctes, sinon le
        // lineage ne saurait pas de quelle relation il parle.
        Assert.NotEqual(records[0].SourceKey, records[1].SourceKey);
    }

    // ── Okta ──

    [Fact]
    public async Task Okta_builds_a_full_name_and_follows_the_link_header_cursor()
    {
        var api = new FakeApi()
            .Add("/api/v1/users", """
            [{"id":"o1","profile":{"firstName":"Marie","lastName":"Diallo","email":"marie@exemple.com",
              "title":"Responsable paiements","department":"Opérations"}}]
            """, link: "<https://exemple.okta.com/api/v1/users?after=curseur2>; rel=\"next\"")
            .Add("after=curseur2", "[]");

        var settings = new Dictionary<string, string>
        {
            ["orgUrl"] = "https://exemple.okta.com", ["apiToken"] = "t",
        };
        var records = await ReadAsync(Connect("okta", api, settings), "users");

        Assert.Single(records);
        // Okta livre le nom en deux colonnes : la carte a besoin d'un seul nom.
        Assert.Equal("Marie Diallo", records[0].Get("displayName"));
        Assert.Equal("Responsable paiements", records[0].Get("profile.title"));
        Assert.Contains(api.Requested, u => u.Contains("after=curseur2"));
    }

    [Fact]
    public async Task Okta_application_access_names_the_person_by_an_address_the_directory_also_knows()
    {
        var api = new FakeApi()
            .Add("/api/v1/apps", """[{"id":"a1","label":"Core Banking","status":"ACTIVE"}]""")
            .Add("/apps/a1/users", """[{"id":"o1","credentials":{"userName":"marie@exemple.com"}}]""");

        var settings = new Dictionary<string, string> { ["orgUrl"] = "https://exemple.okta.com", ["apiToken"] = "t" };
        var records = await ReadAsync(Connect("okta", api, settings), "app-users");

        Assert.Single(records);
        Assert.Equal("marie@exemple.com", records[0].Get("person"));
        Assert.Equal("Core Banking", records[0].Get("parent.label"));
    }

    // ── Google Workspace ──

    [Fact]
    public void Google_page_token_is_appended_to_the_original_url()
    {
        var dataset = VendorCatalog.Find("google-workspace")!.Datasets.First(d => d.Name == "users");

        // Le paramètre customer=my_customer doit survivre à la pagination, sans
        // quoi la deuxième page ne renvoie rien.
        Assert.Equal(PageMode.NextKey, dataset.Page);
        Assert.Equal("pageToken", dataset.PageParam);
        Assert.Contains("customer=my_customer", dataset.UrlTemplate);
    }

    // ── AWS ──

    [Fact]
    public void An_arn_yields_the_service_the_region_and_the_name()
    {
        const string arn = "arn:aws:rds:ca-central-1:123456789012:db:paiements-prod";
        string? Column(string _) => arn;

        Assert.Equal("rds", VendorJson.Derive("arn.service:ResourceARN", Column));
        Assert.Equal("ca-central-1", VendorJson.Derive("arn.region:ResourceARN", Column));
        Assert.Equal("123456789012", VendorJson.Derive("arn.account:ResourceARN", Column));
        Assert.Equal("paiements-prod", VendorJson.Derive("arn.name:ResourceARN", Column));
    }

    [Fact]
    public async Task Aws_resources_are_named_and_attached_to_their_cloud()
    {
        var api = new FakeApi().Add("tagging", """
        {"ResourceTagMappingList":[
          {"ResourceARN":"arn:aws:rds:ca-central-1:123456789012:db:paiements-prod","Tags":[]}
        ],"PaginationToken":""}
        """);
        var settings = new Dictionary<string, string>
        {
            ["accessKeyId"] = "AKIAEXEMPLE", ["secretAccessKey"] = "secret", ["region"] = "ca-central-1",
        };

        var records = await ReadAsync(Connect("aws", api, settings), "resources");

        Assert.Single(records);
        Assert.Equal("paiements-prod", records[0].Get("name"));
        Assert.Equal("rds", records[0].Get("service"));
        Assert.Equal("ca-central-1", records[0].Get("region"));
        // La dépendance que personne ne déclare : tout pend au même fournisseur.
        Assert.Equal("Amazon Web Services", records[0].Get("cloud"));
    }

    [Fact]
    public async Task Aws_requests_are_signed()
    {
        var api = new FakeApi().Add("tagging", """{"ResourceTagMappingList":[],"PaginationToken":""}""");
        var settings = new Dictionary<string, string>
        {
            ["accessKeyId"] = "AKIAEXEMPLE", ["secretAccessKey"] = "secret", ["region"] = "ca-central-1",
        };

        var connector = Connect("aws", api, settings);
        var validation = await connector.ValidateConnectionAsync();

        Assert.True(validation.IsSuccess);
    }

    // ── ServiceNow ──

    [Fact]
    public async Task Servicenow_stops_paging_when_a_page_is_not_full()
    {
        var page = new StringBuilder("""{"result":[""");
        for (var i = 0; i < 200; i++)
            page.Append(i == 0 ? "" : ",").Append($"{{\"sys_id\":\"s{i}\",\"name\":\"CI {i}\"}}");
        page.Append("]}");

        var api = new FakeApi()
            .Add("cmdb_ci?", page.ToString())
            .Add("cmdb_ci?", """{"result":[{"sys_id":"s200","name":"CI 200"}]}""");

        var settings = new Dictionary<string, string>
        {
            ["instance"] = "exemple", ["username"] = "lecteur", ["password"] = "motdepasse",
        };
        var records = await ReadAsync(Connect("servicenow", api, settings), "cis");

        Assert.Equal(201, records.Count);
        Assert.Contains(api.Requested, u => u.Contains("sysparm_offset=200"));
        // La page incomplète termine la lecture : pas de troisième appel.
        Assert.Equal(2, api.Requested.Count(u => u.Contains("cmdb_ci")));
    }

    [Fact]
    public async Task Servicenow_relations_use_display_names_so_the_map_is_readable()
    {
        var api = new FakeApi()
            .Add("cmdb_rel_ci", """
            {"result":[{"parent":"Core Banking","child":"Oracle DB","type":"Depends on::Used by"}]}
            """);
        var settings = new Dictionary<string, string>
        {
            ["instance"] = "exemple", ["username"] = "lecteur", ["password"] = "motdepasse",
        };
        var recipe = VendorCatalog.Find("servicenow")!;

        var records = await ReadAsync(Connect("servicenow", api, settings), "relations");
        var mapping = recipe.Profile.Relations.First(r => r.Dataset == "relations");
        var relation = new NormalizationEngine().NormalizeRelation(records[0], mapping);

        Assert.True(relation.IsSuccess);
        Assert.Equal("Core Banking", relation.Value.SourceName);
        Assert.Equal("Oracle DB", relation.Value.TargetName);
    }

    // ── Kubernetes ──

    [Fact]
    public async Task Kubernetes_reads_deployments_and_their_namespace()
    {
        var api = new FakeApi().Add("apps/v1/deployments", """
        {"items":[{"metadata":{"name":"paiement-api","namespace":"prod","uid":"k1"},"spec":{"replicas":3}}]}
        """);
        var settings = new Dictionary<string, string>
        {
            ["apiServer"] = "https://10.0.0.10:6443", ["token"] = "jeton",
        };

        var records = await ReadAsync(Connect("kubernetes", api, settings), "deployments");

        Assert.Single(records);
        Assert.Equal("paiement-api", records[0].Get("metadata.name"));
        Assert.Equal("prod", records[0].Get("metadata.namespace"));
    }

    // ── Backstage, GitHub, GitLab, Atlassian, Google Cloud ──

    [Fact]
    public async Task Backstage_reads_the_dependencies_teams_declare_themselves()
    {
        const string catalog = """
        [{"metadata":{"name":"paiement-api","uid":"u1","description":"API de paiement"},
          "spec":{"owner":"group:default/equipe-paiements","dependsOn":["resource:default/oracle-db","component:default/notification"]}}]
        """;
        var api = new FakeApi().Add("/api/catalog/entities", catalog).Add("/api/catalog/entities", catalog);
        var settings = new Dictionary<string, string>
        {
            ["baseUrl"] = "https://backstage.exemple.com", ["token"] = "t",
        };

        var connector = Connect("backstage", api, settings);
        var components = await ReadAsync(connector, "components");
        var deps = await ReadAsync(connector, "component-deps");

        Assert.Single(components);
        Assert.Equal("paiement-api", components[0].Get("metadata.name"));
        Assert.Equal("group:default/equipe-paiements", components[0].Get("spec.owner"));

        // La référence porte son genre et son espace de noms : seul le nom compte
        // pour retrouver le composant déjà présent dans la carte.
        Assert.Equal(2, deps.Count);
        Assert.Equal("oracle-db", deps[0].Get("target"));
        Assert.Equal("notification", deps[1].Get("target"));
    }

    [Fact]
    public async Task Github_repositories_are_attached_to_the_team_that_owns_them()
    {
        var api = new FakeApi()
            .Add("/orgs/acme/teams?", """[{"id":1,"name":"Équipe paiements","slug":"paiements"}]""")
            .Add("/teams/paiements/repos", """[{"id":9,"name":"paiement-api","full_name":"acme/paiement-api","description":"API"}]""");

        var settings = new Dictionary<string, string> { ["org"] = "acme", ["token"] = "t" };
        var records = await ReadAsync(Connect("github", api, settings), "team-repos");

        Assert.Single(records);
        Assert.Equal("paiement-api", records[0].Get("name"));
        Assert.Equal("Équipe paiements", records[0].Get("parent.name"));
    }

    [Fact]
    public async Task Gitlab_projects_carry_their_group_without_a_second_call()
    {
        var api = new FakeApi().Add("/api/v4/groups/42/projects", """
        [{"id":7,"name":"paiement-api","path_with_namespace":"acme/paiement-api",
          "description":"API","namespace":{"id":42,"name":"Acme Paiements"}}]
        """);
        var settings = new Dictionary<string, string>
        {
            ["host"] = "https://gitlab.com", ["groupId"] = "42", ["token"] = "t",
        };

        var records = await ReadAsync(Connect("gitlab", api, settings), "projects");

        Assert.Single(records);
        Assert.Equal("Acme Paiements", records[0].Get("namespace.name"));
        Assert.Single(api.Requested);
    }

    [Fact]
    public async Task Atlassian_follows_a_relative_next_link()
    {
        var api = new FakeApi()
            .Add("/wiki/api/v2/pages?limit", """
            {"results":[{"id":"p1","title":"Procédure de bascule"}],
             "_links":{"next":"/wiki/api/v2/pages?limit=100&cursor=suite"}}
            """)
            .Add("cursor=suite", """{"results":[{"id":"p2","title":"Plan de reprise"}]}""");

        var settings = new Dictionary<string, string>
        {
            ["site"] = "acme", ["email"] = "lecteur@acme.com", ["apiToken"] = "t",
        };
        var records = await ReadAsync(Connect("atlassian", api, settings), "pages");

        Assert.Equal(2, records.Count);
        // Le lien relatif doit être recollé à l'hôte, sinon la deuxième page échoue.
        Assert.StartsWith("https://acme.atlassian.net/wiki/", api.Requested[^1]);
    }

    [Fact]
    public async Task Google_cloud_names_a_resource_even_without_a_display_name()
    {
        var api = new FakeApi()
            .Add("oauth2.googleapis.com/token", """{"access_token":"t","expires_in":3600}""")
            .Add("searchAllResources", """
            {"results":[
              {"name":"//compute.googleapis.com/projects/p/zones/z/instances/vm-paiement",
               "assetType":"compute.googleapis.com/Instance","location":"northamerica-northeast1"}
            ]}
            """);

        var settings = new Dictionary<string, string>
        {
            ["projectId"] = "p",
            ["serviceAccountEmail"] = "lenexux@p.iam.gserviceaccount.com",
            ["privateKey"] = TestKey(),
        };
        var records = await ReadAsync(Connect("gcp", api, settings), "resources");

        Assert.Single(records);
        // displayName absent : le nom complet fait foi, et son dernier segment
        // sert d'alias lisible.
        Assert.Equal("//compute.googleapis.com/projects/p/zones/z/instances/vm-paiement", records[0].Get("resourceName"));
        Assert.Equal("vm-paiement", records[0].Get("shortName"));
        Assert.Equal("Google Cloud", records[0].Get("cloud"));
    }

    /// <summary>Une clé RSA jetable : le JWT doit être signé pour que l'appel parte.</summary>
    private static string TestKey()
    {
        using var rsa = System.Security.Cryptography.RSA.Create(2048);
        return rsa.ExportPkcs8PrivateKeyPem();
    }

    // ── Refus explicites ──

    [Fact]
    public async Task Missing_settings_are_named_before_any_call()
    {
        var api = new FakeApi();
        var connector = Connect("entra", api, new Dictionary<string, string> { ["tenantId"] = "11111111" });

        var validation = await connector.ValidateConnectionAsync();

        Assert.True(validation.IsFailure);
        Assert.Contains("clientSecret", validation.Error.Message);
        Assert.Empty(api.Requested);
    }

    [Fact]
    public async Task An_expired_credential_is_explained_rather_than_shown_as_a_code()
    {
        var api = new FakeApi()
            .Add("oauth2/v2.0/token", MicrosoftToken)
            .Add("/users", """{"error":{"code":"InvalidAuthenticationToken"}}""", status: HttpStatusCode.Unauthorized);

        var validation = await Connect("entra", api, EntraSettings()).ValidateConnectionAsync();

        Assert.True(validation.IsFailure);
        Assert.Contains("identifiants", validation.Error.Message, StringComparison.OrdinalIgnoreCase);
    }
}
