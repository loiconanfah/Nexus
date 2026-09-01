namespace Nexus.AI;

// Config IA persistee, par tenant. Implementee dans la couche API (Postgres).
public sealed record AiStored(string Provider, string? ApiKey, string? Endpoint, string Model);

/// <summary>Persistance par tenant de la configuration IA.</summary>
public interface IAiConfigStore
{
    AiStored? Load(Guid tenant);
    void Save(Guid tenant, AiStored config);
    void Delete(Guid tenant);
}

/// <summary>Tenant de la requete courante (resolu depuis le jeton).</summary>
public interface ICurrentTenant
{
    Guid? TenantId { get; }
}
