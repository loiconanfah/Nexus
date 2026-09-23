using Nexus.Graph;
using Nexus.Ingestion.Documents;

namespace Nexus.Tests.Ingestion;

/// <summary>
/// Lecture des tableaux d'un document d'entreprise réel. Ces cas viennent d'un
/// référentiel de microfinance où TOUTES les lignes portent un identifiant et où
/// la colonne du nom s'appelle Agence, Composant, Actif ou Fournisseur, jamais
/// « Nom ». Avant ces règles, l'écran affichait « AG-DLA-02 » comme actif, les
/// suppléances humaines ne sortaient pas, et les liens tombaient tous en
/// « RELATED_TO ».
/// </summary>
public class DocumentTableReadingTests
{
    private static ChunkExtraction Read(params string[] lines) => DocumentTables.Read(string.Join("\n", lines));

    [Fact]
    public void Le_nom_est_lu_quel_que_soit_l_intitule_de_sa_colonne()
    {
        var facts = Read(
            "[Tableau 1 : Reseau d agences]",
            "ID : AG-DLA-02 ; Agence : Agence Akwa ; Ville : Douala ; Effectif : 14 ; Criticite : Elevee",
            "[Tableau 9 : Applications et donnees]",
            "ID : APP-CORE-01 ; Composant : Core banking FiadBank ; Criticite : Critique ; Proprietaire : UNI-IT",
            "[Tableau 11 : Fournisseurs et actifs externes]",
            "ID : FRN-TEL-01 ; Fournisseur fictif : Mboa Telecom Test ; Prestation : Fibre MPLS ; SLA : 99,5 pour cent");

        Assert.Equal(["Agence Akwa", "Core banking FiadBank", "Mboa Telecom Test"], facts.Entities.Select(e => e.Name));
        Assert.Equal(["Location", "Application", "Supplier"], facts.Entities.Select(e => e.Type));
        Assert.Equal(90, facts.Entities[1].Criticality);
    }

    [Fact]
    public void L_identifiant_devient_un_alias_jamais_un_nom()
    {
        var facts = Read("ID : AG-DLA-02 ; Agence : Agence Akwa ; Ville : Douala");
        var e = Assert.Single(facts.Entities);
        Assert.Equal("Agence Akwa", e.Name);
        Assert.Contains("AG-DLA-02", e.Aliases);
    }

    [Fact]
    public void Une_propriete_ne_devient_jamais_le_nom()
    {
        // « Critique » est un niveau, pas un actif.
        var facts = Read("ID : DB-CORE-01 ; Criticite : Critique ; Composant : Base transactions clients");
        var e = Assert.Single(facts.Entities);
        Assert.Equal("Base transactions clients", e.Name);
    }

    [Fact]
    public void La_ligne_porte_sa_description_pour_rester_comprehensible()
    {
        var facts = Read("ID : APP-KYC-01 ; Composant : KYC et filtrage LBC FT ; Criticite : Critique ; RTO RPO : 4 h et 1 h");
        var e = Assert.Single(facts.Entities);
        Assert.Contains("Criticite : Critique", e.Description);
        Assert.Contains("4 h et 1 h", e.Description);
    }

    [Fact]
    public void La_suppleance_et_le_rattachement_donnent_les_dependances_humaines()
    {
        var facts = Read(
            "[Tableau 8 : Personnel fictif et suppleance]",
            "ID : PER-006 ; Nom fictif : Samuel Etoa ; Poste : Responsable informatique ; Unite : UNI-IT ; Suppleant : PER-007");

        var e = Assert.Single(facts.Entities);
        Assert.Equal("Samuel Etoa", e.Name);
        Assert.Equal("Person", e.Type);
        Assert.Contains(facts.Relations, r => r.Source == "Samuel Etoa" && r.RelationType == "BACKED_UP_BY" && r.Target == "PER-007");
        Assert.Contains(facts.Relations, r => r.Source == "Samuel Etoa" && r.RelationType == "PART_OF" && r.Target == "UNI-IT");
    }

    [Fact]
    public void Une_colonne_qui_cite_un_identifiant_donne_un_lien()
    {
        var facts = Read(
            "[Tableau 9 : Applications et donnees]",
            "ID : APP-HR-01 ; Composant : Personnel et paie ; Proprietaire : UNI-RH",
            "[Tableau 10 : Infrastructure critique]",
            "ID : NET-MPLS-01 ; Actif : Reseau inter agences ; Dependances : FRN-TEL-01, routeurs, 4G");

        Assert.Contains(facts.Relations, r => r.Source == "Personnel et paie" && r.RelationType == "OWNED_BY" && r.Target == "UNI-RH");
        Assert.Contains(facts.Relations, r => r.Source == "Reseau inter agences" && r.RelationType == "DEPENDS_ON" && r.Target == "FRN-TEL-01");
        // « routeurs » et « 4G » ne sont pas des identifiants : aucun lien inventé.
        Assert.Equal(2, facts.Relations.Count);
    }

    [Theory]
    [InlineData("depend_on", "AG-DLA-02", "NET-MPLS-01", "DEPENDS_ON", "AG-DLA-02", "NET-MPLS-01")]
    [InlineData("located_at", "APP-CORE-01", "DC-DLA-01", "LOCATED_IN", "APP-CORE-01", "DC-DLA-01")]
    [InlineData("owned_by", "APP-KYC-01", "UNI-RIS", "OWNED_BY", "APP-KYC-01", "UNI-RIS")]
    [InlineData("uses", "PROD-CR-01", "PRC-CRE-01", "USES", "PROD-CR-01", "PRC-CRE-01")]
    [InlineData("mitigates", "CTRL-MFA-01", "RSK-004", "PROTECTS", "CTRL-MFA-01", "RSK-004")]
    // Les deux inverses : c'est le site principal qui est secouru, et le service
    // qui est fourni par le prestataire.
    [InlineData("backup_for", "DR-YDE-01", "DC-DLA-01", "BACKED_UP_BY", "DC-DLA-01", "DR-YDE-01")]
    [InlineData("supplies", "FRN-SMS-01", "SRV-007", "SUPPLIED_BY", "SRV-007", "FRN-SMS-01")]
    public void Le_verbe_de_la_table_de_relations_est_respecte(string verb, string src, string tgt, string type, string from, string to)
    {
        var facts = Read($"Source : {src} ; Relation : {verb} ; Cible : {tgt} ; Criticite : Critique");
        var r = Assert.Single(facts.Relations);
        Assert.Equal(type, r.RelationType);
        Assert.Equal(from, r.Source);
        Assert.Equal(to, r.Target);
    }

    [Fact]
    public void Un_tableau_de_scenarios_ne_rebaptise_pas_les_elements()
    {
        // La ligne PARLE de APP-CORE-01, elle ne le définit pas : sans cette
        // règle, l'application prenait le nom du scénario.
        var facts = Read(
            "[Tableau 15 : Scenarios d impact]",
            "Element : APP-CORE-01 ; Scenario : Indisponibilite totale ; Effet attendu : Caisse arretee");
        Assert.Empty(facts.Entities);
    }

    [Fact]
    public void Un_risque_est_lu_comme_risque_et_comme_element_rattachable()
    {
        var facts = Read(
            "[Tableau 12 : Risques controles et plans]",
            "Risque : RSK-001 Panne CORE ; Impact : Caisse, credit, mobile arretes ; Plan : PRA-001 RTO 2 h");

        var risk = Assert.Single(facts.Risks);
        Assert.Equal("Panne CORE", risk.Title);
        // Aucun niveau n'est declare dans ce tableau : ni minimise, ni gonfle.
        Assert.Equal("medium", risk.Severity);
        var e = Assert.Single(facts.Entities);
        Assert.Equal("Risk", e.Type);
        Assert.Contains("RSK-001", e.Aliases);
        // Le plan protège le risque, pas l'inverse.
        Assert.Contains(facts.Relations, r => r.Source == "PRA-001" && r.RelationType == "PROTECTS" && r.Target == "Panne CORE");
    }

    [Fact]
    public void Apres_consolidation_aucun_actif_ne_porte_un_identifiant_pour_nom()
    {
        var facts = Read(
            "[Tableau 9 : Applications et donnees]",
            "ID : APP-CORE-01 ; Composant : Core banking FiadBank ; Criticite : Critique",
            "ID : DB-CORE-01 ; Composant : Base transactions clients ; Criticite : Critique",
            "[Tableau 14 : Relations a charger dans Lenexux]",
            "Source : APP-CORE-01 ; Relation : depend_on ; Cible : DB-CORE-01 ; Criticite : Critique");

        var result = DocumentAnalyzer.Consolidate([facts], [], [], "fr", 1);

        Assert.Equal(2, result.Entities.Count);
        Assert.All(result.Entities, e => Assert.DoesNotContain("APP-CORE-01", e.Name));
        Assert.All(result.Entities, e => Assert.DoesNotContain("DB-CORE-01", e.Name));
        var link = Assert.Single(result.Relations);
        Assert.Equal("Core banking FiadBank", link.Source);
        Assert.Equal("Base transactions clients", link.Target);
        Assert.Equal("DEPENDS_ON", link.RelationType);
    }

    [Fact]
    public void Un_lien_vers_un_identifiant_que_rien_ne_definit_est_ecarte()
    {
        var facts = Read(
            "ID : APP-CORE-01 ; Composant : Core banking FiadBank",
            "Source : APP-CORE-01 ; Relation : depend_on ; Cible : XYZ-999");

        var result = DocumentAnalyzer.Consolidate([facts], [], [], "fr", 1);
        Assert.Empty(result.Relations);
        Assert.Single(result.Entities);
    }

    [Fact]
    public void Une_section_faite_de_lignes_lues_exactement_n_appelle_pas_le_modele()
    {
        var text = string.Join("\n",
            "[Tableau 1 : Reseau d agences]",
            "ID : AG-DLA-01 ; Agence : Siege et agence Bonanjo ; Ville : Douala",
            "ID : AG-DLA-02 ; Agence : Agence Akwa ; Ville : Douala",
            "ID : AG-YDE-01 ; Agence : Agence Yaounde Centre ; Ville : Yaounde");

        Assert.True(DocumentTables.IsMostlyStructured(text, DocumentTables.Read(text)));
    }

    /// <summary>Un tableau anglais, pour vérifier que rien ne dépend du français.</summary>
    [Fact]
    public void Un_tableau_anglais_est_lu_de_la_meme_facon()
    {
        var facts = Read(
            "[Tableau 3 : Suppliers]",
            "ID : VND-014 ; Supplier : Northwind Hosting ; Criticality : High ; Owner : UNIT-IT");

        var e = Assert.Single(facts.Entities);
        Assert.Equal("Northwind Hosting", e.Name);
        Assert.Equal("Supplier", e.Type);
        Assert.Equal(75, e.Criticality);
        Assert.Contains(facts.Relations, r => r.RelationType == "OWNED_BY" && r.Target == "UNIT-IT");
    }
}
