using System.Data;
using System.Data.Common;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Nexus.Infrastructure.Persistence;

namespace Nexus.Api.Auth;

public enum VerifyOutcome { Verified, Invalid, Expired, TooManyAttempts, NoPendingCode }

/// <summary>
/// Vérification de l'adresse courriel par code à six chiffres.
///
/// Le code n'est jamais stocké en clair : seule son empreinte HMAC (clé du
/// serveur) est conservée. Il expire après 15 minutes, tolère 5 essais, et un
/// nouvel envoi n'est possible qu'après une minute. Un code plutôt qu'un lien :
/// il fonctionne même si le courriel est lu sur un autre appareil.
/// </summary>
public sealed class EmailVerificationService(
    NexusDbContext db,
    IEmailSender mail,
    IOptions<AuthConfig> auth,
    IHostEnvironment env,
    ILogger<EmailVerificationService> log)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);
    public const int MaxAttempts = 5;

    /// <summary>Un envoi est-il possible ? En production, uniquement avec un vrai SMTP.</summary>
    public bool CanSend => mail.CanDeliver || !env.IsProduction();

    private async Task<DbConnection> OpenAsync(CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != ConnectionState.Open) await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS email_verifications (
                email text PRIMARY KEY,
                code_hash text NOT NULL,
                expires_at timestamptz NOT NULL,
                attempts int NOT NULL DEFAULT 0,
                last_sent_at timestamptz NOT NULL DEFAULT now());
            """;
        await cmd.ExecuteNonQueryAsync(ct);
        return conn;
    }

    private static void P(DbCommand c, string name, object? value)
    {
        var p = c.CreateParameter();
        p.ParameterName = name;
        p.Value = value ?? DBNull.Value;
        c.Parameters.Add(p);
    }

    private string Hash(string email, string code)
    {
        using var h = new HMACSHA256(Encoding.UTF8.GetBytes(auth.Value.JwtKey));
        return Convert.ToBase64String(h.ComputeHash(Encoding.UTF8.GetBytes($"{email.Trim().ToLowerInvariant()}:{code}")));
    }

    /// <summary>Secondes à attendre avant un nouvel envoi (0 si possible tout de suite).</summary>
    public async Task<int> CooldownAsync(string email, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT last_sent_at FROM email_verifications WHERE email = lower(@e);";
        P(cmd, "@e", email.Trim());
        if (await cmd.ExecuteScalarAsync(ct) is not DateTime last) return 0;
        var left = ResendCooldown - (DateTime.UtcNow - DateTime.SpecifyKind(last, DateTimeKind.Utc));
        return left > TimeSpan.Zero ? (int)Math.Ceiling(left.TotalSeconds) : 0;
    }

    /// <summary>Crée un nouveau code, remplace le précédent, et l'envoie.</summary>
    public async Task SendCodeAsync(string email, string firstName, string lang, CancellationToken ct)
    {
        if (!CanSend)
        {
            log.LogError("Vérification impossible : aucun SMTP configuré en production (NEXUS_SMTP_HOST).");
            return;
        }
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var conn = await OpenAsync(ct);
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = """
                INSERT INTO email_verifications (email, code_hash, expires_at, attempts, last_sent_at)
                VALUES (lower(@e), @h, @x, 0, now())
                ON CONFLICT (email) DO UPDATE SET
                    code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
                    attempts = 0, last_sent_at = now();
                """;
            P(cmd, "@e", email.Trim()); P(cmd, "@h", Hash(email, code)); P(cmd, "@x", DateTime.UtcNow.Add(Lifetime));
            await cmd.ExecuteNonQueryAsync(ct);
        }
        await mail.SendAsync(Compose(email.Trim(), firstName, code, lang), ct);
    }

    public async Task<VerifyOutcome> VerifyAsync(string email, string code, CancellationToken ct)
    {
        var conn = await OpenAsync(ct);
        string hash; DateTime expires; int attempts;
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = "SELECT code_hash, expires_at, attempts FROM email_verifications WHERE email = lower(@e);";
            P(cmd, "@e", email.Trim());
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return VerifyOutcome.NoPendingCode;
            hash = r.GetString(0); expires = DateTime.SpecifyKind(r.GetDateTime(1), DateTimeKind.Utc); attempts = r.GetInt32(2);
        }
        if (attempts >= MaxAttempts) return VerifyOutcome.TooManyAttempts;
        if (DateTime.UtcNow > expires) return VerifyOutcome.Expired;

        var given = new string((code ?? "").Where(char.IsDigit).ToArray());
        var ok = given.Length == 6 && CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(Hash(email, given)), Encoding.UTF8.GetBytes(hash));

        await using var upd = conn.CreateCommand();
        upd.CommandText = ok
            ? "DELETE FROM email_verifications WHERE email = lower(@e);"
            : "UPDATE email_verifications SET attempts = attempts + 1 WHERE email = lower(@e);";
        P(upd, "@e", email.Trim());
        await upd.ExecuteNonQueryAsync(ct);
        if (ok) return VerifyOutcome.Verified;
        return attempts + 1 >= MaxAttempts ? VerifyOutcome.TooManyAttempts : VerifyOutcome.Invalid;
    }

    private static EmailMessage Compose(string to, string firstName, string code, string lang)
    {
        var en = lang == "en";
        var name = WebUtility.HtmlEncode(firstName?.Trim() ?? "");
        var hello = en ? (name.Length > 0 ? $"Hello {name}," : "Hello,") : (name.Length > 0 ? $"Bonjour {name}," : "Bonjour,");
        var subject = en ? $"{code} is your Lenexux verification code" : $"{code} est votre code de vérification Lenexux";
        var intro = en
            ? "Enter this code to confirm your email address and open your workspace."
            : "Saisissez ce code pour confirmer votre adresse et ouvrir votre espace de travail.";
        var validity = en ? "The code is valid for 15 minutes." : "Le code est valable 15 minutes.";
        var ignore = en
            ? "If you did not create a Lenexux account, you can ignore this message: no account will be activated."
            : "Si vous n'avez pas créé de compte Lenexux, ignorez ce message : aucun compte ne sera activé.";
        var spaced = $"{code[..3]} {code[3..]}";

        var html = $"""
            <!doctype html>
            <html lang="{(en ? "en" : "fr")}"><body style="margin:0;background:#f4f6f8;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f1417">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px">
                <tr><td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #dde3e8;border-radius:12px">
                    <tr><td style="padding:28px 32px 8px;font-size:20px;font-weight:700;letter-spacing:-.02em">Lenexux</td></tr>
                    <tr><td style="padding:8px 32px 0;font-size:15px;line-height:1.6">
                      <p style="margin:0 0 12px">{hello}</p>
                      <p style="margin:0 0 20px">{intro}</p>
                    </td></tr>
                    <tr><td align="center" style="padding:0 32px">
                      <div style="font-family:Consolas,Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:.18em;background:#eef6f8;border:1px solid #cfe6eb;border-radius:10px;padding:16px 0;color:#0b6f82">{spaced}</div>
                    </td></tr>
                    <tr><td style="padding:20px 32px 28px;font-size:13px;line-height:1.6;color:#56636b">
                      <p style="margin:0 0 8px">{validity}</p>
                      <p style="margin:0">{ignore}</p>
                    </td></tr>
                  </table>
                  <p style="font-size:12px;color:#8a969d;margin:16px 0 0">SplitsPay Inc. · lenexux.com</p>
                </td></tr>
              </table>
            </body></html>
            """;
        var text = $"{hello}\n\n{intro}\n\n    {spaced}\n\n{validity}\n{ignore}\n\nLenexux · lenexux.com";
        return new EmailMessage(to, subject, html, text);
    }
}
