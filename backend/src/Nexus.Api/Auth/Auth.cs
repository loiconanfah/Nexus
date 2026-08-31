using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Nexus.Api.Auth;

/// <summary>
/// Configuration d'authentification (article 41 : durcissement). Les secrets
/// proviennent de l'environnement ; des valeurs de dev existent uniquement pour
/// la démo locale et déclenchent un avertissement au démarrage.
/// </summary>
public sealed class AuthConfig
{
    public const string SectionName = "Nexus:Auth";

    public string JwtKey { get; set; } = "";
    public string Issuer { get; set; } = "nexus";
    public string Audience { get; set; } = "nexus";
    public int ExpiryHours { get; set; } = 8;

    /// <summary>Autorise le tenant par en-tête (DÉMO/DEV uniquement). Défaut : false (sécurisé).</summary>
    public bool AllowHeaderTenant { get; set; }

    /// <summary>Autorise l'inscription libre (chaque compte = nouvel espace de travail). Défaut : true.</summary>
    public bool AllowSelfRegistration { get; set; } = true;

    // Utilisateur de démo amorcé au démarrage (bornes par env en production).
    public string AdminEmail { get; set; } = "admin@cgi.demo";
    public string AdminPassword { get; set; } = "";
    public string AdminTenantId { get; set; } = "c6100000-cf1c-4000-8000-000000000001";
}

/// <summary>Utilisateur (magasin en mémoire pour la démo ; à remplacer par un IdP/DB).</summary>
public sealed record NexusUser(string Email, string PasswordHash, Guid TenantId, string Role);

/// <summary>Hachage de mot de passe PBKDF2-SHA256 (jamais de clair stocké).</summary>
public static class PasswordHasher
{
    private const int Iterations = 100_000;

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, 32);
        return $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string stored)
    {
        var parts = stored.Split('.');
        if (parts.Length != 2) return false;
        try
        {
            var salt = Convert.FromBase64String(parts[0]);
            var expected = Convert.FromBase64String(parts[1]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, 32);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException) { return false; }
    }
}

/// <summary>Émission de jetons JWT signés (HMAC-SHA256).</summary>
public sealed class TokenService(IOptions<AuthConfig> options)
{
    public (string Token, DateTimeOffset ExpiresAt) Issue(NexusUser user)
    {
        var cfg = options.Value;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(cfg.JwtKey));
        var expires = DateTime.UtcNow.AddHours(cfg.ExpiryHours);
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = cfg.Issuer,
            Audience = cfg.Audience,
            Expires = expires,
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
            Claims = new Dictionary<string, object>
            {
                ["sub"] = user.Email,
                ["email"] = user.Email,
                ["tenant"] = user.TenantId.ToString(),
                ["role"] = user.Role,
            },
        };
        return (new JsonWebTokenHandler().CreateToken(descriptor), expires);
    }
}
