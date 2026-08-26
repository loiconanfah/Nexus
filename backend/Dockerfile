# NEXUS API — build multi-stage (.NET 10). Contexte de build : racine du dépôt.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# NuGet.config local (contourne le packageSourceMapping machine) + sources.
COPY NuGet.config ./
COPY backend/ ./backend/

WORKDIR /src/backend
RUN dotnet restore Nexus.sln
RUN dotnet publish src/Nexus.Api/Nexus.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV DOTNET_gcServer=1
ENTRYPOINT ["dotnet", "Nexus.Api.dll"]
