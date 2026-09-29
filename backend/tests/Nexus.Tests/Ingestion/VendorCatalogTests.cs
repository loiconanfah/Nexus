using System.Text.RegularExpressions;
using Nexus.Domain.Ontology;
using Nexus.Ingestion.Normalization;
using Nexus.Ingestion.Vendors;

namespace Nexus.Tests.Ingestion;

/// <summary>
/// Cohérence du catalogue de connecteurs.
///
/// Une recette est une déclaration : le compilateur ne dit rien si un mapping
/// pointe un jeu de données qui n'existe pas, si une URL réclame un réglage que
/// l'écran ne demande jamais, ou si un type sort de l'ontologie. Ces erreurs ne se
/// verraient qu'en production, chez un client, une fois ses identifiants saisis.
/// </summary>
public class VendorCatalogTests
{
    /// <summary>Les réglages fournis par le moteur, jamais saisis par le client.</summary>
    private static readonly string[] EnginePlaceholders = ["pageSize", "pageToken", "parent"];

    private static readonly string[] KnownExtractors =
        ["const", "concat", "coalesce", "arn.service", "arn.region", "arn.account", "arn.name",
         "azure.sub", "azure.rg", "path.last"];

    [Fact]
    public void Fifteen_connectors_are_published_with_distinct_identifiers()
    {
        Assert.Equal(15, VendorCatalog.All.Count);
        Assert.Equal(VendorCatalog.All.Count, VendorCatalog.All.Select(r => r.Id).Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.All(VendorCatalog.All, r => Assert.False(string.IsNullOrWhiteSpace(r.Name)));
        Assert.All(VendorCatalog.All, r => Assert.StartsWith("https://", r.DocUrl));
    }

    [Fact]
    public void Every_mapping_points_to_a_dataset_that_exists()
    {
        foreach (var recipe in VendorCatalog.All)
        {
            var datasets = recipe.Datasets.Select(d => d.Name).ToHashSet(StringComparer.Ordinal);
            foreach (var entity in recipe.Profile.Entities)
                Assert.True(datasets.Contains(entity.Dataset), $"{recipe.Id}: entité sur « {entity.Dataset} », inconnu.");
            foreach (var relation in recipe.Profile.Relations)
                Assert.True(datasets.Contains(relation.Dataset), $"{recipe.Id}: relation sur « {relation.Dataset} », inconnu.");
        }
    }

    [Fact]
    public void Every_child_dataset_names_an_existing_parent_and_the_key_it_uses()
    {
        foreach (var recipe in VendorCatalog.All)
        {
            var datasets = recipe.Datasets.ToDictionary(d => d.Name, StringComparer.Ordinal);
            foreach (var dataset in recipe.Datasets.Where(d => d.ParentDataset is not null))
            {
                Assert.True(datasets.ContainsKey(dataset.ParentDataset!),
                    $"{recipe.Id}/{dataset.Name}: parent « {dataset.ParentDataset} » inconnu.");
                Assert.False(string.IsNullOrWhiteSpace(dataset.ParentKey),
                    $"{recipe.Id}/{dataset.Name}: aucune colonne du parent à injecter.");
                Assert.Contains("{parent}", dataset.UrlTemplate);
                // Un parent qui serait lui-même un enfant ferait un N+1 au carré.
                Assert.Null(datasets[dataset.ParentDataset!].ParentDataset);
            }
        }
    }

    [Fact]
    public void Every_placeholder_is_a_setting_the_screen_actually_asks_for()
    {
        foreach (var recipe in VendorCatalog.All)
        {
            var declared = recipe.Fields.Select(f => f.Key).Concat(EnginePlaceholders).ToHashSet(StringComparer.Ordinal);
            var templates = recipe.Datasets.SelectMany(d => new[] { d.UrlTemplate, d.Body })
                .Concat(recipe.Datasets.SelectMany(d => (d.Headers ?? new Dictionary<string, string>()).Values))
                .Concat((recipe.Auth.Headers ?? new Dictionary<string, string>()).Values)
                .Concat([recipe.Auth.TokenUrl, recipe.Auth.Scope, recipe.Auth.UserTemplate,
                         recipe.Auth.PasswordTemplate, recipe.Auth.AwsRegion])
                .Where(t => !string.IsNullOrEmpty(t));

            foreach (var template in templates)
                foreach (var match in Regex.Matches(template!, @"\{([A-Za-z][A-Za-z0-9_]*)\}").Cast<Match>())
                    Assert.True(declared.Contains(match.Groups[1].Value),
                        $"{recipe.Id}: le gabarit réclame « {match.Groups[1].Value} », que rien ne fournit.");
        }
    }

    [Fact]
    public void Google_and_aws_ask_for_the_settings_their_signature_needs()
    {
        // Ces deux authentifications lisent des réglages par leur nom, hors gabarit :
        // une faute de frappe ne se verrait donc pas dans les URL.
        var google = VendorCatalog.Find("google-workspace")!.Fields.Select(f => f.Key).ToList();
        Assert.Contains("serviceAccountEmail", google);
        Assert.Contains("privateKey", google);
        Assert.Contains("adminEmail", google);

        var aws = VendorCatalog.Find("aws")!.Fields.Select(f => f.Key).ToList();
        Assert.Contains("accessKeyId", aws);
        Assert.Contains("secretAccessKey", aws);
    }

    [Fact]
    public void Oauth_connectors_ask_for_a_client_and_a_secret_under_the_expected_names()
    {
        foreach (var recipe in VendorCatalog.All.Where(r => r.Auth.Kind == VendorAuthKind.OAuth2ClientCredentials))
        {
            var fields = recipe.Fields.Select(f => f.Key).ToList();
            Assert.Contains("clientId", fields);
            Assert.Contains("clientSecret", fields);
            Assert.False(string.IsNullOrWhiteSpace(recipe.Auth.TokenUrl));
            Assert.False(string.IsNullOrWhiteSpace(recipe.Auth.Scope));
        }
    }

    [Fact]
    public void Every_type_stays_inside_the_ontology()
    {
        foreach (var recipe in VendorCatalog.All)
        {
            foreach (var entity in recipe.Profile.Entities)
                Assert.Equal(entity.EntityType, OntologyResolver.ResolveEntityType(entity.EntityType).Name);

            foreach (var relation in recipe.Profile.Relations)
            {
                Assert.Equal(relation.RelationType, OntologyResolver.ResolveRelationType(relation.RelationType).Name);
                Assert.Equal(relation.SourceEntityType, OntologyResolver.ResolveEntityType(relation.SourceEntityType).Name);
                Assert.Equal(relation.TargetEntityType, OntologyResolver.ResolveEntityType(relation.TargetEntityType).Name);
            }
        }
    }

    [Fact]
    public void Every_derived_column_uses_a_known_extractor()
    {
        foreach (var recipe in VendorCatalog.All)
            foreach (var dataset in recipe.Datasets)
                foreach (var (name, expression) in dataset.Derive ?? new Dictionary<string, string>())
                {
                    var extractor = expression.Split(':', 2)[0];
                    Assert.Contains(extractor, KnownExtractors);
                    Assert.False(string.IsNullOrWhiteSpace(name));
                }
    }

    [Fact]
    public void Secrets_are_declared_as_secrets()
    {
        // Un champ marqué secret ne redescend jamais vers le navigateur : si un
        // mot de passe n'est pas marqué, il finirait affiché dans un formulaire.
        var suspicious = new[] { "secret", "password", "token", "key" };
        foreach (var recipe in VendorCatalog.All)
            foreach (var field in recipe.Fields)
            {
                var looksSecret = suspicious.Any(s => field.Key.Contains(s, StringComparison.OrdinalIgnoreCase));
                // « accessKeyId » et « clientId » sont des identifiants publics.
                var isIdentifier = field.Key.EndsWith("Id", StringComparison.Ordinal);
                if (looksSecret && !isIdentifier)
                    Assert.True(field.Secret, $"{recipe.Id}/{field.Key} devrait être marqué secret.");
            }
    }

    [Fact]
    public void Only_the_internal_platform_requires_the_probe()
    {
        var internals = VendorCatalog.All.Where(r => r.Internal).Select(r => r.Id).ToList();
        Assert.Equal(["kubernetes"], internals);
    }

    [Fact]
    public void Every_connector_brings_entities_and_all_but_the_directories_bring_relations()
    {
        foreach (var recipe in VendorCatalog.All)
        {
            Assert.NotEmpty(recipe.Profile.Entities);
            Assert.NotEmpty(recipe.Profile.Relations);
            // Une source live doit être estampillée comme telle, sinon sa preuve
            // vaudrait celle d'un fichier déclaratif périmé.
            Assert.Contains("API", recipe.Profile.SourceSystem);
        }
    }
}
