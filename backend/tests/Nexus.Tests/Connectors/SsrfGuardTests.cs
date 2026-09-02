using System.Net;
using Nexus.Connectors.Rest;

namespace Nexus.Tests.Connectors;

public class SsrfGuardTests
{
    [Theory]
    [InlineData("127.0.0.1")]      // loopback
    [InlineData("10.0.0.5")]        // privé RFC1918
    [InlineData("172.16.4.9")]      // privé RFC1918
    [InlineData("172.31.255.1")]    // privé RFC1918 (borne)
    [InlineData("192.168.1.10")]    // privé RFC1918
    [InlineData("169.254.169.254")] // métadonnées cloud
    [InlineData("100.64.0.1")]      // CGNAT
    [InlineData("0.0.0.0")]         // any
    [InlineData("::1")]             // loopback IPv6
    [InlineData("fc00::1")]         // ULA IPv6
    [InlineData("fe80::1")]         // lien-local IPv6
    public void Blocks_internal_and_private_addresses(string ip)
        => Assert.True(SsrfGuard.IsBlocked(IPAddress.Parse(ip)));

    [Theory]
    [InlineData("8.8.8.8")]         // public
    [InlineData("1.1.1.1")]         // public
    [InlineData("172.15.0.1")]      // hors 172.16/12
    [InlineData("172.32.0.1")]      // hors 172.16/12
    [InlineData("2606:4700:4700::1111")] // public IPv6
    public void Allows_public_addresses(string ip)
        => Assert.False(SsrfGuard.IsBlocked(IPAddress.Parse(ip)));

    [Theory]
    [InlineData("ftp://example.com/data")]
    [InlineData("file:///etc/passwd")]
    [InlineData("http://localhost/api")]
    [InlineData("http://127.0.0.1:8080")]
    [InlineData("http://169.254.169.254/latest/meta-data/")]
    public async Task ValidateAsync_rejects_forbidden_targets(string url)
        => await Assert.ThrowsAsync<SsrfBlockedException>(() => SsrfGuard.ValidateAsync(url, CancellationToken.None));
}
