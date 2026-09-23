using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Impact;
using Nexus.Api.Organization;
using Nexus.Api.Tenancy;
using Nexus.Graph;
using Nexus.Risk;

namespace Nexus.Api.Controllers;

/// <summary>
/// Profil de l'organisation et assistant de démarrage.
///
/// Un espace nouvellement créé passe par l'assistant avant d'arriver sur
/// l'Accueil : sans nom, devise ni chiffres de référence, la plateforme ne peut
/// ni afficher les montants correctement, ni chiffrer une interruption à
/// l'échelle de l'organisation.
/// </summary>
[Route("api/v1/organization")]
public sealed class OrganizationController(
    ITenantProvider tenantProvider,
    OrganizationStore organization,
    ImpactConfigStore impactConfig,
    IGraphRepository graph) : NexusController(tenantProvider)
{
    private static readonly string[] Sectors =
    [
        "microfinance", "banking", "insurance", "telecom", "health", "public", "energy",
        "manufacturing", "logistics", "retail", "it-services", "education", "other",
    ];

    private static readonly string[] SizeBands = ["1-49", "50-199", "200-999", "1000-1999", "2000+"];
    private static readonly string[] OperatingModes = ["business", "24x7"];

    public sealed record SaveRequest(
        string Name, string Sector, string Country, string Currency, string SizeBand,
        double AnnualRevenue, int Headcount, string OperatingMode,
        int OpenDaysPerWeek = 0, int OpenHoursPerDay = 0, bool Recalibrate = false);

    /// <summary>Logo de l'organisation, en data URL (image encodée). Null retire le logo.</summary>
    public sealed record LogoRequest(string? DataUrl);

    private const int MaxLogoChars = 400_000;   // ≈ 300 Ko d'image encodée

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;

        var profile = await organization.GetAsync(tenant, ct);

        // Un espace ANTÉRIEUR à l'assistant (données présentes, aucun profil) n'y est
        // pas renvoyé de force : il le retrouvera dans la barre de progression. Seuls
        // les espaces neufs, ou dont l'assistant a été commencé, doivent le terminer.
        var requires = profile is null
            ? (await graph.GetEntitiesAsync(tenant, ct: ct)).Count == 0
            : !profile.Completed;

        return Ok(new
        {
            profile,
            requiresOnboarding = requires && IsAdmin,
            waitingForAdmin = requires && !IsAdmin,
            canEdit = IsAdmin,
            currency = profile?.Currency ?? Currencies.Default,
            currencies = Currencies.All,
            sectors = Sectors,
            sizeBands = SizeBands,
            calibration = profile is { AnnualRevenue: > 0 }
                ? Preview(profile.AnnualRevenue, profile.OperatingMode, profile.OpenDaysPerWeek, profile.OpenHoursPerDay)
                : null,
            logo = await organization.GetLogoAsync(tenant, ct),
        });
    }

    /// <summary>Aperçu de l'étalonnage, pour que l'assistant montre ce que les chiffres saisis impliquent.</summary>
    [HttpGet("calibration")]
    public IActionResult Calibration([FromQuery] double revenue, [FromQuery] string? mode,
        [FromQuery] int? days = null, [FromQuery] int? hours = null)
    {
        if (!TryGetTenant(out _, out var error)) return error;
        return revenue > 0 ? Ok(Preview(revenue, mode, days, hours)) : BadRequest(new { error = "revenue_required" });
    }

    private static object Preview(double revenue, string? mode, int? days = null, int? hours = null)
    {
        var t = ImpactCalibration.FromRevenue(revenue, mode, days, hours);
        return new
        {
            hourlyRevenue = Math.Round(ImpactCalibration.HourlyRevenue(revenue, mode, days, hours)),
            operatingHours = ImpactCalibration.OperatingHoursPerYear(mode, days, hours),
            costVeryHigh = t.CostVeryHigh,
            costModerate = t.CostModerate,
            costMinimal = t.CostMinimal,
        };
    }

    [HttpPut]
    public async Task<IActionResult> Save([FromBody] SaveRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;

        var problem = Validate(req);
        if (problem is not null) return BadRequest(new { error = problem });

        var existing = await organization.GetAsync(tenant, ct);
        var profile = new OrganizationProfile(
            req.Name.Trim(), req.Sector, req.Country.Trim().ToUpperInvariant(),
            req.Currency.Trim().ToUpperInvariant(), req.SizeBand, req.AnnualRevenue, req.Headcount,
            req.OperatingMode, req.OpenDaysPerWeek, req.OpenHoursPerDay, existing?.CompletedAt, DateTime.UtcNow);
        await organization.SaveAsync(tenant, profile, ct);

        // Étalonnage du coût d'interruption. Il ne remplace JAMAIS des réglages que
        // l'administrateur a ajustés à la main, sauf demande explicite.
        var custom = await impactConfig.GetAsync(tenant, ct);
        var calibrated = false;
        if (custom is null || req.Recalibrate)
        {
            await impactConfig.SaveAsync(tenant,
                ImpactCalibration.FromRevenue(req.AnnualRevenue, req.OperatingMode, req.OpenDaysPerWeek, req.OpenHoursPerDay), ct);
            calibrated = true;
        }

        return Ok(new { profile = await organization.GetAsync(tenant, ct), calibrated });
    }

    /// <summary>
    /// Logo de l'organisation, affiché à côté du nom de Lenexux. Stocké en data URL
    /// dans l'espace de travail : aucune image n'est servie depuis un autre domaine,
    /// et le format est vérifié (image matricielle seulement, pas de SVG qui pourrait
    /// embarquer du script).
    /// </summary>
    [HttpPut("logo")]
    public async Task<IActionResult> SetLogo([FromBody] LogoRequest req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;

        var url = req?.DataUrl?.Trim();
        if (string.IsNullOrEmpty(url))
        {
            await organization.SetLogoAsync(tenant, null, ct);
            return Ok(new { logo = (string?)null });
        }
        if (url.Length > MaxLogoChars) return BadRequest(new { error = "logo_too_large" });
        var ok = url.StartsWith("data:image/png;base64,", StringComparison.OrdinalIgnoreCase)
              || url.StartsWith("data:image/jpeg;base64,", StringComparison.OrdinalIgnoreCase)
              || url.StartsWith("data:image/webp;base64,", StringComparison.OrdinalIgnoreCase);
        if (!ok) return BadRequest(new { error = "logo_format_invalid" });
        var payload = url[(url.IndexOf(',') + 1)..];
        if (payload.Length == 0 || !IsBase64(payload)) return BadRequest(new { error = "logo_format_invalid" });

        await organization.SetLogoAsync(tenant, url, ct);
        return Ok(new { logo = url });
    }

    private static bool IsBase64(string s)
    {
        Span<byte> buffer = new byte[s.Length];
        return Convert.TryFromBase64String(s, buffer, out var written) && written > 0;
    }

    /// <summary>Termine l'assistant : l'utilisateur accède à la plateforme.</summary>
    [HttpPost("complete")]
    public async Task<IActionResult> Complete(CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!RequireAdmin(out var forbidden)) return forbidden;

        var profile = await organization.GetAsync(tenant, ct);
        if (profile is null) return BadRequest(new { error = "profile_required" });

        await organization.MarkCompletedAsync(tenant, ct);
        return Ok(new { completed = true });
    }

    private static string? Validate(SaveRequest? r)
    {
        if (r is null) return "body_required";
        if (string.IsNullOrWhiteSpace(r.Name) || r.Name.Trim().Length is < 2 or > 120) return "name_invalid";
        if (!Sectors.Contains(r.Sector)) return "sector_invalid";
        if (string.IsNullOrWhiteSpace(r.Country) || r.Country.Trim().Length != 2) return "country_invalid";
        if (!Currencies.IsSupported(r.Currency)) return "currency_invalid";
        if (!SizeBands.Contains(r.SizeBand)) return "size_invalid";
        if (!OperatingModes.Contains(r.OperatingMode)) return "operating_mode_invalid";
        // Horaires d'ouverture : exigés hors fonctionnement continu, où ils n'ont pas de sens.
        if (r.OperatingMode != "24x7" && (r.OpenDaysPerWeek is < 1 or > 7 || r.OpenHoursPerDay is < 1 or > 24)) return "opening_hours_invalid";
        if (r.AnnualRevenue <= 0 || double.IsNaN(r.AnnualRevenue) || r.AnnualRevenue > 1e15) return "revenue_invalid";
        if (r.Headcount is <= 0 or > 5_000_000) return "headcount_invalid";
        return null;
    }
}
