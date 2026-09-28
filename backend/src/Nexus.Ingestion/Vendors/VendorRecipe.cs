using Nexus.Ingestion.Mapping;

namespace Nexus.Ingestion.Vendors;

/// <summary>
/// Comment s'authentifier auprès d'un éditeur. Le type dicte ce que le client
/// doit saisir, et donc ce que l'écran lui demande.
/// </summary>
public enum VendorAuthKind
{
    /// <summary>En-têtes statiques, dont les valeurs viennent des réglages (Datadog, Dynatrace, Okta).</summary>
    Headers,
    /// <summary>Authentification HTTP Basic (ServiceNow, Freshservice).</summary>
    Basic,
    /// <summary>OAuth2 client_credentials : jeton d'application, sans utilisateur (Microsoft).</summary>
    OAuth2ClientCredentials,
    /// <summary>Compte de service Google : JWT signé RS256, échangé contre un jeton.</summary>
    GoogleServiceAccount,
    /// <summary>Signature AWS SigV4 de chaque requête.</summary>
    AwsSigV4,
}

/// <summary>Un réglage que le client doit fournir. Les secrets ne repartent jamais vers le navigateur.</summary>
public sealed record VendorField(
    string Key,
    string LabelFr,
    string LabelEn,
    bool Secret = false,
    string? HelpFr = null,
    string? HelpEn = null,
    string? Placeholder = null,
    bool Required = true);

/// <summary>Paramètres d'authentification, résolus à partir des réglages du client.</summary>
public sealed record VendorAuth(
    VendorAuthKind Kind,
    /// <summary>Gabarits d'en-têtes : nom vers valeur, la valeur pouvant contenir des {reglage}.</summary>
    IReadOnlyDictionary<string, string>? Headers = null,
    /// <summary>OAuth2 : URL du jeton et portée demandée (gabarits autorisés).</summary>
    string? TokenUrl = null,
    string? Scope = null,
    /// <summary>Basic : gabarits d'identifiant et de mot de passe.</summary>
    string? UserTemplate = null,
    string? PasswordTemplate = null,
    /// <summary>AWS : nom du service signé et gabarit de région.</summary>
    string? AwsService = null,
    string? AwsRegion = null);

/// <summary>Forme du JSON renvoyé par un point d'accès.</summary>
public enum RecordShape
{
    /// <summary>Un tableau d'objets (cas courant).</summary>
    Array,
    /// <summary>Un objet dont chaque propriété est un enregistrement : la clé devient la colonne « key ».</summary>
    ObjectMap,
}

/// <summary>Comment tourner les pages d'un point d'accès.</summary>
public enum PageMode
{
    None,
    /// <summary>Lien absolu vers la page suivante, dans le corps (Microsoft Graph, Google, Dynatrace).</summary>
    NextLink,
    /// <summary>Décalage et limite en paramètres d'URL (ServiceNow).</summary>
    OffsetLimit,
    /// <summary>Numéro de page en paramètre d'URL (Freshservice).</summary>
    PageNumber,
    /// <summary>Curseur dans l'en-tête Link (Okta).</summary>
    LinkHeaderCursor,
    /// <summary>Jeton renvoyé dans le corps, à replacer en paramètre d'URL (Google).</summary>
    NextKey,
    /// <summary>Jeton renvoyé dans le corps, à replacer dans le corps suivant (AWS).</summary>
    BodyToken,
}

/// <summary>
/// Un jeu de données d'un éditeur : un point d'accès, sa forme, sa pagination.
///
/// Trois primitives suffisent à exprimer les API réelles sans écrire un
/// connecteur par produit :
/// <list type="bullet">
/// <item>« enfant » (<see cref="ParentDataset"/>) : une requête par enregistrement
/// du parent, l'identifiant du parent étant injecté dans l'URL. C'est ainsi que se
/// lisent les membres d'un groupe ou les affectations d'une application.</item>
/// <item>« éclatement » (<see cref="ExplodePath"/>) : un tableau imbriqué produit
/// une ligne par élément, les colonnes du porteur étant conservées. C'est ainsi
/// que se lisent les relations que Dynatrace et Datadog imbriquent.</item>
/// <item>« dérivation » (<see cref="Derive"/>) : une colonne calculée par un
/// extracteur nommé, pour lire un ARN ou un identifiant de ressource Azure.</item>
/// </list>
/// </summary>
public sealed record VendorDataset(
    string Name,
    string UrlTemplate,
    string? RecordsPath = null,
    RecordShape Shape = RecordShape.Array,
    string Method = "GET",
    /// <summary>Corps JSON gabarité, pour les points d'accès en POST (Azure Resource Graph, AWS).</summary>
    string? Body = null,
    PageMode Page = PageMode.None,
    /// <summary>Chemin pointé du lien ou du jeton de page suivante dans le corps.</summary>
    string? NextPath = null,
    /// <summary>Nom du paramètre de pagination (décalage ou numéro de page) propre à l'éditeur.</summary>
    string? PageParam = null,
    /// <summary>En-têtes propres au point d'accès (type de contenu, cible AWS).</summary>
    IReadOnlyDictionary<string, string>? Headers = null,
    int PageSize = 200,
    /// <summary>Nombre maximal de pages, garde-fou contre un inventaire sans fin.</summary>
    int MaxPages = 25,
    /// <summary>Jeu de données parent : une requête par enregistrement parent.</summary>
    string? ParentDataset = null,
    /// <summary>Colonne du parent injectée dans l'URL à la place de {parent}.</summary>
    string? ParentKey = null,
    /// <summary>Colonnes du parent recopiées dans l'enfant, préfixées « parent. ».</summary>
    IReadOnlyList<string>? ParentColumns = null,
    /// <summary>Nombre maximal d'appels enfants, garde-fou contre un N+1 non borné.</summary>
    int MaxParents = 400,
    /// <summary>Tableau imbriqué à éclater : une ligne par élément, colonnes préfixées « item. ».</summary>
    string? ExplodePath = null,
    /// <summary>Colonnes calculées : nom vers « extracteur:colonneSource ».</summary>
    IReadOnlyDictionary<string, string>? Derive = null);

/// <summary>
/// Un connecteur d'éditeur : ce qu'il faut pour s'y brancher, ce qu'il faut lire,
/// et ce que cela devient dans l'ontologie.
///
/// Tout est déclaratif, donc un connecteur se relit, se teste et se corrige sans
/// toucher au moteur. <see cref="Internal"/> distingue les sources joignables
/// depuis le cloud de celles qui ne vivent qu'à l'intérieur du réseau du client et
/// passent obligatoirement par la sonde Collector.
/// </summary>
public sealed record VendorRecipe(
    string Id,
    string Name,
    string Category,
    string SummaryFr,
    string SummaryEn,
    string BringsFr,
    string BringsEn,
    string DocUrl,
    bool Internal,
    VendorAuth Auth,
    IReadOnlyList<VendorField> Fields,
    IReadOnlyList<VendorDataset> Datasets,
    MappingProfile Profile);
