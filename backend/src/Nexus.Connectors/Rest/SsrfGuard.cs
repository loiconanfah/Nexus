using System.Net;
using System.Net.Sockets;

namespace Nexus.Connectors.Rest;

/// <summary>Levée quand une cible REST pointe vers une adresse interdite (SSRF).</summary>
public sealed class SsrfBlockedException(string message) : Exception(message);

/// <summary>
/// Garde anti-SSRF pour le connecteur REST : résout l'hôte et REFUSE toute
/// adresse loopback, privée (RFC1918), lien-local (dont 169.254.169.254 =
/// métadonnées cloud), ULA IPv6, CGNAT, etc. Un tenant ne doit jamais pouvoir
/// faire sonder le réseau interne via une URL de connecteur.
/// Note : validation DNS en amont ; le risque résiduel de DNS-rebinding est
/// limité par la désactivation des redirections (voir le handler configuré).
/// </summary>
public static class SsrfGuard
{
    public static async Task ValidateAsync(string url, CancellationToken ct)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            throw new SsrfBlockedException("URL invalide : http(s) requis.");

        var host = uri.DnsSafeHost;
        if (string.IsNullOrWhiteSpace(host) || host.Equals("localhost", StringComparison.OrdinalIgnoreCase))
            throw new SsrfBlockedException("Hôte interdit.");

        IPAddress[] addresses;
        if (IPAddress.TryParse(host, out var literal))
            addresses = [literal];
        else
        {
            try { addresses = await Dns.GetHostAddressesAsync(host, ct); }
            catch (SocketException) { throw new SsrfBlockedException($"Hôte introuvable : {host}"); }
        }

        if (addresses.Length == 0) throw new SsrfBlockedException($"Hôte introuvable : {host}");
        foreach (var ip in addresses)
            if (IsBlocked(ip))
                throw new SsrfBlockedException($"Cible interdite (adresse interne/privée) : {ip}");
    }

    public static bool IsBlocked(IPAddress ip)
    {
        if (IPAddress.IsLoopback(ip)) return true;

        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
        var b = ip.GetAddressBytes();

        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            if (b[0] == 0) return true;                                   // 0.0.0.0/8
            if (b[0] == 10) return true;                                  // 10/8 privé
            if (b[0] == 127) return true;                                 // loopback
            if (b[0] == 169 && b[1] == 254) return true;                  // 169.254/16 lien-local + métadonnées cloud
            if (b[0] == 172 && b[1] >= 16 && b[1] <= 31) return true;     // 172.16/12 privé
            if (b[0] == 192 && b[1] == 168) return true;                  // 192.168/16 privé
            if (b[0] == 100 && b[1] >= 64 && b[1] <= 127) return true;    // 100.64/10 CGNAT
            if (b[0] >= 224) return true;                                 // multicast / réservé
            return false;
        }

        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6Multicast) return true;
            if (IPAddress.IPv6Any.Equals(ip)) return true;
            if ((b[0] & 0xfe) == 0xfc) return true;                       // ULA fc00::/7
            return false;
        }

        return true; // famille inconnue → refus par défaut
    }
}
