#!/usr/bin/env python3
"""
Verifie un connecteur d'editeur AVANT de le brancher dans Lenexux.

Pourquoi ce script existe : quand un branchement echoue, trois causes se
confondent (identifiants faux, permission manquante, ou forme de reponse
differente de celle attendue). Ce script les separe. Il interroge exactement le
meme point d'acces que la recette, puis compare les colonnes REELLEMENT
renvoyees a celles dont le mapping a besoin.

Il n'ecrit rien, nulle part : ni dans le graphe, ni chez l'editeur, ni sur disque.
Les identifiants sont lus dans l'environnement et ne sont jamais affiches.

Usage :
    python scripts/verifier-connecteurs.py servicenow
    python scripts/verifier-connecteurs.py            # liste les connecteurs

Chaque connecteur indique lui-meme les variables d'environnement qu'il attend.
"""

import base64
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request

TIMEOUT = 30

# Les couleurs aident a lire un resultat de 40 lignes ; desactivees hors terminal.
OK = "\033[32m" if sys.stdout.isatty() else ""
KO = "\033[31m" if sys.stdout.isatty() else ""
DIM = "\033[90m" if sys.stdout.isatty() else ""
END = "\033[0m" if sys.stdout.isatty() else ""


def env(name, required=True):
    value = os.environ.get(name, "").strip()
    if required and not value:
        raise SystemExit(f"{KO}Variable d'environnement manquante : {name}{END}")
    return value


def fetch(url, headers=None, method="GET", body=None, insecure=False):
    """Un appel HTTP, avec le corps d'erreur conserve : c'est lui qui explique un refus."""
    request = urllib.request.Request(url, method=method, data=body)
    request.add_header("Accept", "application/json")
    for name, value in (headers or {}).items():
        request.add_header(name, value)

    context = ssl._create_unverified_context() if insecure else None
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT, context=context) as response:
            return response.status, json.loads(response.read().decode("utf-8")), dict(response.headers)
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:400]
        return error.code, detail, dict(error.headers)
    except Exception as error:  # reseau, DNS, TLS
        return 0, str(error), {}


def dotted(value, path):
    """Descend un chemin pointe, en essayant d'abord le nom litteral (cas @odata.nextLink)."""
    if not path:
        return value
    if isinstance(value, dict) and path in value:
        return value[path]
    for segment in path.split("."):
        if not isinstance(value, dict) or segment not in value:
            return None
        value = value[segment]
    return value


def flatten(obj, prefix="", depth=0, into=None):
    """Meme aplatissement que le moteur : c'est ce que le mapping verra."""
    into = {} if into is None else into
    if not isinstance(obj, dict):
        return into
    for key, value in obj.items():
        name = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict) and depth < 3:
            flatten(value, name, depth + 1, into)
        elif isinstance(value, list):
            scalars = [str(x) for x in value if isinstance(x, (str, int, float))]
            if scalars:
                into[name] = ";".join(scalars)
            elif value and isinstance(value[0], dict):
                into[name] = f"<{len(value)} objets a eclater>"
        else:
            into[name] = value
    return into


def report(label, url, status, payload, records_path, needed, shape="array"):
    """Le verdict : la source repond-elle, et dit-elle ce que le mapping attend ?"""
    print(f"\n{DIM}{label}{END}\n  {DIM}{url[:120]}{END}")

    if status == 0:
        print(f"  {KO}injoignable{END} : {payload}")
        return False
    if status == 401:
        print(f"  {KO}401{END} identifiants refuses. La cle ou le mot de passe n'est pas le bon.")
        return False
    if status == 403:
        print(f"  {KO}403{END} identifiants acceptes mais lecture refusee : il manque une PERMISSION au compte.")
        print(f"  {DIM}{str(payload)[:220]}{END}")
        return False
    if status == 404:
        print(f"  {KO}404{END} point d'acces inconnu : verifiez l'URL de votre instance.")
        return False
    if status >= 400:
        print(f"  {KO}{status}{END} {str(payload)[:220]}")
        return False

    container = dotted(payload, records_path) if records_path else payload
    if container is None:
        print(f"  {KO}forme inattendue{END} : « {records_path} » absent de la reponse.")
        print(f"  {DIM}cles racine : {list(payload)[:12]}{END}")
        return False

    if shape == "objectmap":
        if not isinstance(container, dict):
            print(f"  {KO}forme inattendue{END} : un objet etait attendu, recu {type(container).__name__}.")
            return False
        keys = list(container)
        print(f"  {OK}200{END} {len(keys)} entrees. Exemples : {', '.join(keys[:5])}")
        first = container[keys[0]] if keys else {}
        columns = flatten(first)
    else:
        if not isinstance(container, list):
            print(f"  {KO}forme inattendue{END} : un tableau etait attendu, recu {type(container).__name__}.")
            return False
        print(f"  {OK}200{END} {len(container)} enregistrements sur la premiere page.")
        if not container:
            print(f"  {KO}vide{END} : rien a cartographier. Creez au moins un element dans l'outil source.")
            return False
        columns = flatten(container[0])

    missing = [c for c in needed if c not in columns]
    present = [c for c in needed if c in columns]
    print(f"  colonnes attendues presentes : {OK if not missing else ''}{len(present)}/{len(needed)}{END}"
          f" ({', '.join(present) if present else 'aucune'})")
    if missing:
        print(f"  {KO}manquantes{END} : {', '.join(missing)}")
        print(f"  {DIM}colonnes reellement lues : {', '.join(sorted(columns)[:25])}{END}")
        return False
    return True


# ── Jetons ──

def microsoft_token(scope):
    tenant = env("ENTRA_TENANT_ID")
    data = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": env("ENTRA_CLIENT_ID"),
        "client_secret": env("ENTRA_CLIENT_SECRET"),
        "scope": scope,
    }).encode()
    status, payload, _ = fetch(
        f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        {"Content-Type": "application/x-www-form-urlencoded"}, "POST", data)
    if status != 200:
        raise SystemExit(f"{KO}Jeton refuse ({status}){END} : {str(payload)[:300]}")
    return payload["access_token"]


# ── Connecteurs ──

def check_entra():
    """ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET"""
    token = microsoft_token("https://graph.microsoft.com/.default")
    head = {"Authorization": f"Bearer {token}"}
    good = True

    url = ("https://graph.microsoft.com/v1.0/users?$top=10"
           "&$select=id,displayName,jobTitle,department,mail,userPrincipalName"
           "&$expand=manager($select=id,displayName)")
    status, payload, _ = fetch(url, head)
    good &= report("Entra ID / utilisateurs", url, status, payload, "value",
                   ["displayName", "jobTitle", "department", "userPrincipalName"])
    if status == 200 and isinstance(payload, dict):
        withmanager = sum(1 for u in payload.get("value", []) if u.get("manager"))
        print(f"  {DIM}responsables renseignes : {withmanager} sur {len(payload.get('value', []))}"
              f" (sans eux, pas de chaine hierarchique){END}")

    url = "https://graph.microsoft.com/v1.0/groups?$top=10&$select=id,displayName,description"
    status, payload, _ = fetch(url, head)
    good &= report("Entra ID / groupes", url, status, payload, "value", ["id", "displayName"])

    url = "https://graph.microsoft.com/v1.0/servicePrincipals?$top=10&$select=id,appId,displayName"
    status, payload, _ = fetch(url, head)
    good &= report("Entra ID / applications", url, status, payload, "value", ["id", "appId", "displayName"])
    return good


def check_azure():
    """ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID"""
    token = microsoft_token("https://management.azure.com/.default")
    url = "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01"
    body = json.dumps({
        "subscriptions": [env("AZURE_SUBSCRIPTION_ID")],
        "query": "resources | project id, name, type, location, resourceGroup | order by name asc | limit 10",
    }).encode()
    status, payload, _ = fetch(url, {"Authorization": f"Bearer {token}",
                                     "Content-Type": "application/json"}, "POST", body)
    return report("Azure / ressources", url, status, payload, "data",
                  ["id", "name", "type", "location", "resourceGroup"])


def check_servicenow():
    """SNOW_INSTANCE, SNOW_USER, SNOW_PASSWORD"""
    instance = env("SNOW_INSTANCE")
    pair = f"{env('SNOW_USER')}:{env('SNOW_PASSWORD')}"
    head = {"Authorization": "Basic " + base64.b64encode(pair.encode()).decode()}
    base = f"https://{instance}.service-now.com/api/now/table"
    good = True

    url = (f"{base}/cmdb_ci?sysparm_limit=10&sysparm_display_value=true"
           "&sysparm_exclude_reference_link=true"
           "&sysparm_fields=sys_id,name,sys_class_name,short_description,assigned_to")
    status, payload, _ = fetch(url, head)
    good &= report("ServiceNow / elements de configuration", url, status, payload, "result",
                   ["sys_id", "name", "sys_class_name"])

    url = (f"{base}/cmdb_rel_ci?sysparm_limit=10&sysparm_display_value=true"
           "&sysparm_exclude_reference_link=true&sysparm_fields=parent,child,type")
    status, payload, _ = fetch(url, head)
    good &= report("ServiceNow / relations", url, status, payload, "result", ["parent", "child"])
    if status == 200 and isinstance(payload, dict) and payload.get("result"):
        sample = payload["result"][0]
        print(f"  {DIM}exemple : « {sample.get('parent')} » -> « {sample.get('child')} »"
              f" (type : {sample.get('type')}){END}")
        print(f"  {DIM}la recette lit ceci comme : le PARENT depend de l'ENFANT. A confirmer sur cet exemple.{END}")
    return good


def check_freshservice():
    """FRESH_DOMAIN, FRESH_API_KEY"""
    domain = env("FRESH_DOMAIN")
    head = {"Authorization": "Basic " + base64.b64encode(f"{env('FRESH_API_KEY')}:X".encode()).decode()}
    good = True

    url = f"https://{domain}.freshservice.com/api/v2/assets?per_page=10"
    status, payload, _ = fetch(url, head)
    good &= report("Freshservice / actifs", url, status, payload, "assets", ["name", "display_id"])

    # Point d'acces le plus incertain de tout le catalogue : a confirmer en premier.
    url = f"https://{domain}.freshservice.com/api/v2/relationships?per_page=10"
    status, payload, _ = fetch(url, head)
    good &= report("Freshservice / relations", url, status, payload, "relationships",
                   ["primary_id", "secondary_id"])
    return good


def check_datadog():
    """DD_SITE (ex. datadoghq.com), DD_API_KEY, DD_APP_KEY"""
    site = env("DD_SITE")
    head = {"DD-API-KEY": env("DD_API_KEY"), "DD-APPLICATION-KEY": env("DD_APP_KEY")}
    url = f"https://api.{site}/api/v1/service_dependencies"
    status, payload, _ = fetch(url, head)
    ok = report("Datadog / dependances de services", url, status, payload, None, ["calls"], shape="objectmap")
    if status == 200 and isinstance(payload, dict) and not payload:
        print(f"  {KO}aucune dependance{END} : l'APM n'a rien observe. Il faut une application instrumentee.")
        return False
    return ok


def check_dynatrace():
    """DT_BASE_URL (ex. https://abc12345.live.dynatrace.com), DT_API_TOKEN"""
    base = env("DT_BASE_URL").rstrip("/")
    head = {"Authorization": f"Api-Token {env('DT_API_TOKEN')}"}
    good = True

    url = f"{base}/api/v2/entities?entitySelector=type%28%22SERVICE%22%29&pageSize=10"
    status, payload, _ = fetch(url, head)
    good &= report("Dynatrace / services", url, status, payload, "entities", ["entityId", "displayName"])

    url = (f"{base}/api/v2/entities?entitySelector=type%28%22SERVICE%22%29"
           "&fields=%2BfromRelationships&pageSize=10")
    status, payload, _ = fetch(url, head)
    good &= report("Dynatrace / appels entre services", url, status, payload, "entities",
                   ["entityId", "fromRelationships.calls"])
    return good


def check_okta():
    """OKTA_ORG_URL (ex. https://exemple.okta.com), OKTA_API_TOKEN"""
    base = env("OKTA_ORG_URL").rstrip("/")
    head = {"Authorization": f"SSWS {env('OKTA_API_TOKEN')}"}
    good = True

    url = f"{base}/api/v1/users?limit=10"
    status, payload, _ = fetch(url, head)
    good &= report("Okta / utilisateurs", url, status, payload, None,
                   ["profile.firstName", "profile.lastName", "profile.email"])

    url = f"{base}/api/v1/apps?limit=10"
    status, payload, headers = fetch(url, head)
    good &= report("Okta / applications", url, status, payload, None, ["id", "label"])
    if status == 200 and "Link" in headers:
        print(f"  {DIM}pagination par en-tete Link presente : la recette la suit.{END}")
    return good


def check_kubernetes():
    """K8S_API_SERVER (ex. https://127.0.0.1:6443), K8S_TOKEN, K8S_INSECURE=1 pour ignorer le certificat"""
    base = env("K8S_API_SERVER").rstrip("/")
    head = {"Authorization": f"Bearer {env('K8S_TOKEN')}"}
    insecure = os.environ.get("K8S_INSECURE") == "1"
    if insecure:
        print(f"{DIM}Certificat non verifie (test local uniquement).{END}")
    good = True

    for label, path, needed in [
        ("espaces de noms", "/api/v1/namespaces?limit=10", ["metadata.name"]),
        ("deploiements", "/apis/apps/v1/deployments?limit=10", ["metadata.name", "metadata.namespace"]),
        ("services", "/api/v1/services?limit=10", ["metadata.name", "metadata.namespace"]),
    ]:
        url = base + path
        status, payload, _ = fetch(url, head, insecure=insecure)
        good &= report(f"Kubernetes / {label}", url, status, payload, "items", needed)
    return good


def check_aws():
    """Non couvert ici : la signature AWS est le code a eprouver, pas ce script."""
    print(f"\n{DIM}Amazon Web Services{END}")
    print("  Ce script ne signe pas les requetes AWS, et le faire ici ne prouverait rien :")
    print("  c'est la signature du SERVEUR Lenexux qu'il faut eprouver.")
    print("  1. Verifiez d'abord vos droits :  aws resourcegroupstaggingapi get-resources --region <region>")
    print("  2. Puis, dans l'ecran Connecteurs, « Essayer l'acces » : c'est ce geste qui teste la signature.")
    print(f"  {DIM}Rappel : GetResources ne renvoie que des ressources ETIQUETEES. Posez une etiquette{END}")
    print(f"  {DIM}sur au moins une ressource, sinon la reponse sera vide sans etre en erreur.{END}")
    return True


def check_google():
    """Non couvert ici : le JWT signe demande une bibliotheque externe."""
    print(f"\n{DIM}Google Workspace{END}")
    print("  Ce script n'implemente pas la signature RS256 du compte de service.")
    print("  Verifiez la delegation a l'echelle du domaine, puis utilisez « Essayer l'acces » dans l'ecran.")
    print(f"  {DIM}Piege le plus frequent : les portees admin.directory.*.readonly doivent etre autorisees{END}")
    print(f"  {DIM}dans la console d'administration Google, pour l'ID client du compte de service.{END}")
    return True


CHECKS = {
    "entra": check_entra,
    "azure": check_azure,
    "servicenow": check_servicenow,
    "freshservice": check_freshservice,
    "datadog": check_datadog,
    "dynatrace": check_dynatrace,
    "okta": check_okta,
    "kubernetes": check_kubernetes,
    "aws": check_aws,
    "google": check_google,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in CHECKS:
        print(__doc__)
        print("Connecteurs :\n")
        for name, function in CHECKS.items():
            print(f"  {name.ljust(14)} {DIM}{(function.__doc__ or '').strip()}{END}")
        print(f"\n{DIM}Exemple :  SNOW_INSTANCE=dev12345 SNOW_USER=admin SNOW_PASSWORD=... \\{END}")
        print(f"{DIM}           python scripts/verifier-connecteurs.py servicenow{END}")
        return 2

    name = sys.argv[1]
    print(f"Verification de « {name} ». Aucune ecriture, ni dans Lenexux ni chez l'editeur.")
    good = CHECKS[name]()
    print(f"\n{OK if good else KO}{'Pret a brancher.' if good else 'A corriger avant de brancher.'}{END}")
    return 0 if good else 1


if __name__ == "__main__":
    sys.exit(main())
