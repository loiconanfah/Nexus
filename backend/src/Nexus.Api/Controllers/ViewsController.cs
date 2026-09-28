using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Nexus.Api.Tenancy;
using Nexus.Api.Views;

namespace Nexus.Api.Controllers;

/// <summary>
/// Vues enregistrées : tableaux de risques et graphes personnalisés.
///
/// Une vue ne contient que des CRITÈRES, jamais un résultat : elle reste donc
/// juste quand le graphe change, et deux personnes qui l'ouvrent voient la même
/// chose au même moment. Elle appartient à l'espace de travail et non à son
/// auteur, parce qu'un tableau utile doit servir aux collègues.
/// </summary>
[Route("api/v1/views")]
public sealed class ViewsController(
    ITenantProvider tenantProvider,
    SavedViewStore store) : NexusController(tenantProvider)
{
    private static readonly string[] Kinds = ["risk", "graph"];
    private const int MaxNameLength = 80;
    private const int MaxConfigLength = 8_000;

    public sealed record SaveViewRequest(string? Kind, string? Name, JsonElement? Config);

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? kind, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        var k = kind is not null && Kinds.Contains(kind) ? kind : null;
        var views = await store.ListAsync(tenant, k, ct);
        return Ok(views.Select(Shape));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SaveViewRequest? req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!Validate(req, out var kind, out var name, out var config, out var problem)) return BadRequest(problem);

        // Un plafond, pour qu'une liste de vues reste lisible et qu'un script
        // maladroit ne remplisse pas la table.
        if (await store.CountAsync(tenant, ct) >= SavedViewStore.MaxPerTenant)
            return BadRequest(new { error = "too_many_views", max = SavedViewStore.MaxPerTenant });

        var created = await store.CreateAsync(tenant, kind!, name!, config!, ct);
        return Ok(Shape(created));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] SaveViewRequest? req, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        if (!Validate(req, out _, out var name, out var config, out var problem)) return BadRequest(problem);

        var updated = await store.UpdateAsync(tenant, id, name!, config!, ct);
        return updated is null ? NotFound(new { error = "view_not_found" }) : Ok(Shape(updated));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        if (!TryGetTenant(out var tenant, out var error)) return error;
        return await store.DeleteAsync(tenant, id, ct) ? NoContent() : NotFound(new { error = "view_not_found" });
    }

    /// <summary>
    /// Le nom et les critères, contrôlés. Le contenu des critères appartient à
    /// l'écran qui les interprète ; l'API n'en vérifie que la taille et le fait
    /// que ce soit un objet, pour ne pas devoir changer ici chaque fois qu'un
    /// filtre s'ajoute là-bas.
    /// </summary>
    private static bool Validate(SaveViewRequest? req, out string? kind, out string? name, out string? config, out object? problem)
    {
        kind = null; name = null; config = null; problem = null;

        if (req is null) { problem = new { error = "body_required" }; return false; }

        kind = req.Kind?.Trim();
        if (kind is null || !Kinds.Contains(kind)) { problem = new { error = "unknown_kind", expected = Kinds }; return false; }

        name = req.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length > MaxNameLength) { problem = new { error = "name_invalid", max = MaxNameLength }; return false; }

        if (req.Config is not { ValueKind: JsonValueKind.Object } c) { problem = new { error = "config_invalid" }; return false; }
        config = c.GetRawText();
        if (config.Length > MaxConfigLength) { problem = new { error = "config_too_large", max = MaxConfigLength }; return false; }

        return true;
    }

    private static object Shape(SavedView v) => new
    {
        v.Id,
        v.Kind,
        v.Name,
        v.UpdatedAt,
        // Les critères repartent en OBJET, pas en chaîne : l'écran ne doit pas
        // avoir à les désérialiser lui-même.
        config = JsonDocument.Parse(v.Config).RootElement,
    };
}
