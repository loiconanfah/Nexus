using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Nexus.Api.Auth;

/// <summary>
/// Configuration d'envoi de courriels (SMTP). Tous les fournisseurs courants
/// l'acceptent : Microsoft 365, Google Workspace, Zoho, Resend, Brevo, Postmark.
/// Les secrets viennent de l'environnement (NEXUS_SMTP_*), jamais de Git.
/// </summary>
public sealed class EmailConfig
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public string User { get; set; } = "";
    public string Password { get; set; } = "";
    /// <summary>Expéditeur affiché, par exemple « Lenexux &lt;no-reply@lenexux.com&gt; ».</summary>
    public string From { get; set; } = "Lenexux <no-reply@lenexux.com>";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Host) && !string.IsNullOrWhiteSpace(From);
}

public sealed record EmailMessage(string To, string Subject, string Html, string Text);

public interface IEmailSender
{
    /// <summary>Vrai si un envoi réel est possible (sinon les messages sont seulement journalisés).</summary>
    bool CanDeliver { get; }
    Task SendAsync(EmailMessage message, CancellationToken ct);
}

/// <summary>Envoi réel par SMTP (STARTTLS sur 587, TLS implicite sur 465).</summary>
public sealed class SmtpEmailSender(EmailConfig cfg, ILogger<SmtpEmailSender> log) : IEmailSender
{
    public bool CanDeliver => true;

    public async Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        var mime = new MimeMessage();
        mime.From.Add(MailboxAddress.Parse(cfg.From));
        mime.To.Add(MailboxAddress.Parse(message.To));
        mime.Subject = message.Subject;
        mime.Body = new BodyBuilder { HtmlBody = message.Html, TextBody = message.Text }.ToMessageBody();

        using var client = new SmtpClient();
        var security = cfg.Port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;
        await client.ConnectAsync(cfg.Host, cfg.Port, security, ct);
        if (!string.IsNullOrWhiteSpace(cfg.User)) await client.AuthenticateAsync(cfg.User, cfg.Password, ct);
        await client.SendAsync(mime, ct);
        await client.DisconnectAsync(true, ct);
        log.LogInformation("Courriel « {Subject} » envoyé", message.Subject);
    }
}

/// <summary>
/// Poste de développement sans SMTP : le message est écrit dans le journal, ce
/// qui permet de lire le code de vérification en local. Jamais utilisé pour
/// ouvrir les inscriptions en production (voir AuthController.Config).
/// </summary>
public sealed class LogEmailSender(ILogger<LogEmailSender> log) : IEmailSender
{
    public bool CanDeliver => false;

    public Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        log.LogWarning("SMTP non configuré, courriel non envoyé. Destinataire {To}, objet « {Subject} »\n{Text}",
            message.To, message.Subject, message.Text);
        return Task.CompletedTask;
    }
}
