using System.Security.Cryptography;
using System.Text;

namespace Nexus.Core;

/// <summary>
/// Génère un GUID déterministe et stable à partir de composants textuels.
/// Utilisé pour donner une identité reproductible aux relations importées
/// (mêmes source/cible/type ⇒ même id ⇒ pas de doublon au ré-import).
/// Non cryptographique : sert uniquement d'identifiant.
/// </summary>
public static class DeterministicGuid
{
    public static Guid From(params string[] parts)
    {
        var joined = string.Join('|', parts);
        var hash = MD5.HashData(Encoding.UTF8.GetBytes(joined));
        return new Guid(hash);
    }
}
