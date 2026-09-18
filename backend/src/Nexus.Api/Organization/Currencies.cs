namespace Nexus.Api.Organization;

/// <summary>Une devise proposée à l'assistant de démarrage.</summary>
public sealed record CurrencyInfo(string Code, string Name, string Symbol, int Decimals);

/// <summary>
/// Devises prises en charge. La liste est volontairement courte : celles des
/// marchés visés et des premiers pilotes, plutôt que les 180 codes ISO.
/// Le franc CFA n'a pas de subdivision en usage : il s'affiche sans décimales.
/// </summary>
public static class Currencies
{
    public const string Default = "CAD";

    public static readonly IReadOnlyList<CurrencyInfo> All =
    [
        new("CAD", "Dollar canadien", "$", 2),
        new("USD", "Dollar américain", "$ US", 2),
        new("EUR", "Euro", "€", 2),
        new("XAF", "Franc CFA (CEMAC)", "FCFA", 0),
        new("XOF", "Franc CFA (UEMOA)", "FCFA", 0),
        new("MAD", "Dirham marocain", "MAD", 2),
        new("CHF", "Franc suisse", "CHF", 2),
        new("GBP", "Livre sterling", "£", 2),
    ];

    public static bool IsSupported(string? code)
        => code is not null && All.Any(c => c.Code == code.Trim().ToUpperInvariant());

    /// <summary>Devise usuelle d'un pays (code ISO 3166 alpha-2), pour préremplir l'assistant.</summary>
    public static string ForCountry(string? country) => (country ?? "").Trim().ToUpperInvariant() switch
    {
        "CA" => "CAD",
        "US" => "USD",
        "FR" or "BE" or "LU" or "DE" or "ES" or "IT" or "PT" or "NL" or "IE" => "EUR",
        "CM" or "GA" or "CG" or "TD" or "CF" or "GQ" => "XAF",
        "SN" or "CI" or "BJ" or "BF" or "ML" or "NE" or "TG" or "GW" => "XOF",
        "MA" => "MAD",
        "CH" => "CHF",
        "GB" => "GBP",
        _ => Default,
    };
}
