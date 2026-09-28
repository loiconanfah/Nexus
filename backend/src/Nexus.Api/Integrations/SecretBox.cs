using System.Security.Cryptography;
using System.Text;

namespace Nexus.Api.Integrations;

/// <summary>
/// Chiffrement des accès aux systèmes des clients.
///
/// Un connecteur qui se rafraîchit tout seul doit CONSERVER un secret : c'est la
/// contrepartie inévitable d'une carte vivante. Ces secrets ouvrent l'annuaire ou
/// la CMDB d'une entreprise, ils ne peuvent donc pas dormir en clair dans une
/// base, même sur une base privée.
///
/// La clé vient de l'environnement de l'opérateur et n'est jamais dans le dépôt.
/// Sans elle, l'enregistrement est REFUSÉ plutôt que dégradé en clair : un défaut
/// de configuration ne doit pas se transformer silencieusement en fuite.
/// </summary>
public sealed class SecretBox
{
    public const string EnvironmentVariable = "NEXUS_SECRET_KEY";
    private const string Prefix = "v1:";

    private readonly byte[]? _key;

    public SecretBox(string? key = null)
    {
        var material = key ?? Environment.GetEnvironmentVariable(EnvironmentVariable);
        // Une phrase quelconque est dérivée en clé de 256 bits : l'opérateur n'a
        // pas à produire lui-même une clé de la bonne longueur.
        if (!string.IsNullOrWhiteSpace(material) && material.Trim().Length >= 16)
            _key = SHA256.HashData(Encoding.UTF8.GetBytes(material.Trim()));
    }

    /// <summary>Faux si l'opérateur n'a pas fourni de clé : rien ne doit alors être conservé.</summary>
    public bool IsConfigured => _key is not null;

    public string Protect(string plaintext)
    {
        if (_key is null) throw new InvalidOperationException("Aucune clé de chiffrement configurée.");

        var nonce = RandomNumberGenerator.GetBytes(AesGcm.NonceByteSizes.MaxSize);
        var cipher = new byte[Encoding.UTF8.GetByteCount(plaintext)];
        var tag = new byte[AesGcm.TagByteSizes.MaxSize];

        using var aes = new AesGcm(_key, tag.Length);
        aes.Encrypt(nonce, Encoding.UTF8.GetBytes(plaintext), cipher, tag);

        return Prefix + Convert.ToBase64String([.. nonce, .. tag, .. cipher]);
    }

    /// <summary>
    /// Déchiffre, ou renvoie null. Un secret illisible (clé changée, donnée
    /// abîmée) ne doit pas faire tomber l'écran : le connecteur se signale comme
    /// à reconfigurer.
    /// </summary>
    public string? Unprotect(string? payload)
    {
        if (_key is null || string.IsNullOrWhiteSpace(payload) || !payload.StartsWith(Prefix, StringComparison.Ordinal))
            return null;

        try
        {
            var blob = Convert.FromBase64String(payload[Prefix.Length..]);
            var nonceSize = AesGcm.NonceByteSizes.MaxSize;
            var tagSize = AesGcm.TagByteSizes.MaxSize;
            if (blob.Length <= nonceSize + tagSize) return null;

            var nonce = blob.AsSpan(0, nonceSize);
            var tag = blob.AsSpan(nonceSize, tagSize);
            var cipher = blob.AsSpan(nonceSize + tagSize);
            var plain = new byte[cipher.Length];

            using var aes = new AesGcm(_key, tagSize);
            aes.Decrypt(nonce, cipher, tag, plain);
            return Encoding.UTF8.GetString(plain);
        }
        catch (Exception ex) when (ex is FormatException or CryptographicException or ArgumentException)
        {
            return null;
        }
    }
}
