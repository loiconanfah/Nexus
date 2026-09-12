# ── Lenexux Collector ───────────────────────────────────────────────────────
# Sonde à déployer DANS le réseau du client. Aucun port exposé : elle sort
# uniquement en HTTPS vers Lenexux Cloud pour réclamer ses tâches.
#
#   docker build -f backend/src/Nexus.Collector/Dockerfile -t lenexux-collector backend
#   docker run -d --name lenexux-collector --restart unless-stopped \
#     -e LENEXUX_CLOUD_URL=https://lenexux.com \
#     -e LENEXUX_COLLECTOR_KEY=lxc_xxxxxxxx \
#     lenexux-collector
# ────────────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish src/Nexus.Collector/Nexus.Collector.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/runtime:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .

# Utilisateur non privilégié : la sonde n'a besoin d'aucun droit particulier.
USER $APP_UID

ENV LENEXUX_CLOUD_URL=https://lenexux.com \
    LENEXUX_POLL_SECONDS=15

ENTRYPOINT ["./lenexux-collector"]
