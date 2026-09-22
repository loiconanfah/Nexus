"""
Test d'isolation entre deux espaces de travail (comptes A et B).

Crée deux comptes, remplit A (import, action, clé IA propre, jalon), puis
vérifie que B ne peut ni voir, ni lire par identifiant, ni modifier quoi que
ce soit de A, et que A reste intact.

Utilisation (API locale lancée, inscription ouverte) :
    python scripts/verifier-isolation.py [http://localhost:5199/api/v1]
Ne jamais lancer contre la production : il crée des comptes de test.
"""
import json, sys, time, urllib.request, urllib.error, uuid

API = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5199/api/v1'
results = []

def call(method, path, token=None, body=None, raw=None, ctype=None):
    data = None
    headers = {}
    if token: headers['Authorization'] = f'Bearer {token}'
    if body is not None:
        data = json.dumps(body).encode(); headers['Content-Type'] = 'application/json'
    if raw is not None:
        data = raw; headers['Content-Type'] = ctype
    req = urllib.request.Request(API + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try: return e.code, json.loads(txt)
        except Exception: return e.code, txt

def check(label, ok, detail=''):
    results.append((ok, label, detail))
    print(('OK   ' if ok else 'ÉCHEC') + '  ' + label + (f'  ({detail})' if detail else ''))

def register(tag, org, country):
    email = f'{tag}.{int(time.time()*1000)}@exemple-test.com'
    s, d = call('POST', '/auth/register', body={
        'email': email, 'password': 'Solide-2026x', 'confirmPassword': 'Solide-2026x',
        'firstName': tag, 'lastName': 'Test', 'organization': org, 'sector': 'banking',
        'country': country, 'sizeBand': '50-199', 'acceptTerms': True})
    assert s == 200, (s, d)
    return email, d['token'], d['tenantId']

def multipart(fields, filename, content):
    b = uuid.uuid4().hex
    parts = []
    for k, v in fields.items():
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n')
    parts.append(f'--{b}\r\nContent-Disposition: form-data; name="File"; filename="{filename}"\r\nContent-Type: text/csv\r\n\r\n{content}\r\n--{b}--\r\n')
    return ''.join(parts).encode(), f'multipart/form-data; boundary={b}'

emailA, A, tA = register('alpha', 'Banque Alpha', 'CM')
emailB, B, tB = register('beta', 'Clinique Beta', 'CA')
check('Deux espaces distincts', tA != tB, f'A={tA[:8]} B={tB[:8]}')

# ---------- A importe des données ----------
csv = 'nom,type,depend_de\nERP Alpha,Application,Base Alpha\nBase Alpha,Database,\nPaie Alpha,Application,ERP Alpha\n'
profile = {'SourceSystem': 'test-isolation',
           'Entities': [{'Dataset': 'systemes', 'EntityType': 'Application', 'NameColumn': 'nom', 'EntityTypeColumn': 'type'}],
           'Relations': [{'Dataset': 'systemes', 'RelationType': 'DEPENDS_ON', 'SourceEntityType': 'Application', 'SourceNameColumn': 'nom',
                          'TargetEntityType': 'Database', 'TargetNameColumn': 'depend_de'}]}
raw, ct = multipart({'Profile': json.dumps(profile), 'Delimiter': ',', 'HasHeader': 'true'}, 'systemes.csv', csv)
s, d = call('POST', '/imports/csv', A, raw=raw, ctype=ct)
check('A importe un fichier', s == 200, f'HTTP {s} {str(d)[:120]}')

s, entsA = call('GET', '/entities', A)
namesA = sorted(e.get('name') for e in (entsA if isinstance(entsA, list) else entsA.get('items', [])))
check('A voit ses entités', len(namesA) >= 3, ', '.join(namesA))
idA = next(e['id'] for e in (entsA if isinstance(entsA, list) else entsA['items']) if e['name'] == 'ERP Alpha')

# A crée une action et règle ses préférences
s, act = call('POST', '/actions', A, body={'title': 'Action secrète Alpha', 'priority': 'High', 'kind': 'mitigation'})
check('A crée une action', s in (200, 201), f'HTTP {s}')
s, _ = call('PUT', '/ai/config', A, body={'provider': 'openai', 'apiKey': 'CLE-PROPRE-ALPHA', 'model': 'gpt-test'})
check('A enregistre sa propre clé IA', s == 200, f'HTTP {s}')
call('POST', '/onboarding/milestones/simulation', A)

# ---------- Ce que B voit ----------
s, entsB = call('GET', '/entities', B)
listB = entsB if isinstance(entsB, list) else entsB.get('items', [])
check('B ne voit aucune entité de A', not any('Alpha' in (e.get('name') or '') for e in listB), f'{len(listB)} entité(s) chez B')

s, g = call('GET', '/graph', B)
gtxt = json.dumps(g)
check('Graphe de B sans données de A', 'Alpha' not in gtxt, f'HTTP {s}')

s, d = call('GET', f'/entities/{idA}', B)
check('B ne peut pas lire une entité de A par son identifiant', s == 404, f'HTTP {s}')
s, d = call('GET', f'/entities/{idA}/dependencies', B)
check('B ne peut pas lire les dépendances de A', s in (404,) or (s == 200 and 'Alpha' not in json.dumps(d)), f'HTTP {s}')
s, d = call('DELETE', f'/entities/{idA}', B)
check('B ne peut pas supprimer une entité de A', s == 404, f'HTTP {s}')
s, d = call('PATCH', f'/entities/{idA}/cost', B, body={'costPerHour': 1})
check('B ne peut pas modifier le coût d’une entité de A', s == 404, f'HTTP {s}')
s, d = call('POST', f'/entities/{idA}/decommission', B)
check('B ne peut pas archiver une entité de A', s == 404, f'HTTP {s}')

s, acts = call('GET', '/actions', B)
check('B ne voit pas les actions de A', 'secrète Alpha' not in json.dumps(acts), f'HTTP {s}')
s, d = call('PATCH', f"/actions/{act['id']}/status", B, body={'status': 'Done'})
check('B ne peut pas modifier une action de A', s == 404, f'HTTP {s}')

s, org = call('GET', '/organization', B)
check('Profil d’organisation de B = le sien', org['profile']['name'] == 'Clinique Beta' and org['profile']['currency'] == 'CAD',
      f"{org['profile']['name']} / {org['profile']['currency']}")
s, orgA = call('GET', '/organization', A)
check('Profil de A intact', orgA['profile']['name'] == 'Banque Alpha' and orgA['profile']['currency'] == 'XAF',
      f"{orgA['profile']['name']} / {orgA['profile']['currency']}")

s, aiB = call('GET', '/ai/config', B)
check('B garde la clé partagée, pas celle de A', aiB['source'] == 'shared' and aiB['provider'] == 'gemini', f"{aiB['provider']} / {aiB['source']}")
s, aiA = call('GET', '/ai/config', A)
check('A utilise sa propre clé', aiA['source'] == 'own' and aiA['provider'] == 'openai', f"{aiA['provider']} / {aiA['source']}")

s, usersB = call('GET', '/users', B)
check('B ne voit que ses propres membres', emailA not in json.dumps(usersB) and emailB in json.dumps(usersB), f'HTTP {s}')
s, d = call('PATCH', f'/users/{emailA}/role', B, body={'role': 'member'})
check('B ne peut pas changer le rôle de A', s in (403, 404), f'HTTP {s}')
s, d = call('DELETE', f'/users/{emailA}', B)
check('B ne peut pas supprimer le compte de A', s in (403, 404), f'HTTP {s}')

s, progB = call('GET', '/onboarding/progress', B)
sim = next((x for x in progB.get('steps', []) if x.get('key') == 'simulation'), {})
check('Progression de B indépendante de A', not sim.get('done', False), f"simulation chez B : {sim.get('done')}")
s, notesB = call('GET', '/onboarding/notifications', B)
check('Notifications de B sans éléments de A', 'Alpha' not in json.dumps(notesB), f'HTTP {s}')

s, ov = call('GET', '/overview', B)
check('Vue d’ensemble de B sans données de A', 'Alpha' not in json.dumps(ov), f'HTTP {s}')

# Jeton de B, en-tête de tenant forgé vers A : doit être ignoré
req = urllib.request.Request(API + '/entities', headers={'Authorization': f'Bearer {B}', 'X-Tenant-Id': tA})
with urllib.request.urlopen(req) as r:
    forged = json.loads(r.read().decode())
lf = forged if isinstance(forged, list) else forged.get('items', [])
check('En-tête X-Tenant-Id forgé vers A ignoré', not any('Alpha' in (e.get('name') or '') for e in lf), f'{len(lf)} entité(s)')

# A voit toujours tout, rien n'a été altéré par B
s, entsA2 = call('GET', '/entities', A)
la2 = entsA2 if isinstance(entsA2, list) else entsA2.get('items', [])
erp = next((e for e in la2 if e['name'] == 'ERP Alpha'), None)
check('Données de A intactes après les tentatives de B', len(la2) == len(namesA) + 1 and erp is not None, f'{len(la2)} entité(s) : 3 systèmes + son action')

print()
print(f"{sum(1 for r in results if r[0])}/{len(results)} contrôles réussis")
sys.exit(0 if all(r[0] for r in results) else 1)
