using Nexus.Ingestion.Documents;

namespace Nexus.Tests.Ingestion;

/// <summary>
/// Ce que l'on envoie au modèle pour relier les éléments d'une section : SEULEMENT
/// ceux dont cette section parle. Décrire à chaque section les centaines
/// d'éléments du reste du document coûtait des jetons sans rien apporter, un lien
/// devant de toute façon s'appuyer sur l'extrait.
///
/// Ce filtre décide donc de ce que le modèle peut relier : trop strict, il fait
/// perdre des dépendances ; trop large, il ramène le gaspillage. D'où ces cas.
/// </summary>
public class DocumentMentionTests
{
    private static bool Cite(string text, string name) => DocumentAnalyzer.MentionedIn(DocumentAnalyzer.Fold(text), name);

    [Fact]
    public void Nom_exact_reconnu_malgre_casse_et_accents()
    {
        Assert.True(Cite("Le SYSTÈME CENTRAL est hors service.", "Système central"));
        Assert.True(Cite("Panne du systeme central hier soir.", "Système central"));
    }

    [Fact]
    public void Forme_courte_reconnue()
    {
        // La prose dit « Core Banking », le tableau nomme « Core Banking System ».
        Assert.True(Cite("Le Core Banking dépend du serveur central.", "Core Banking System"));
    }

    [Fact]
    public void Element_absent_non_retenu()
    {
        Assert.False(Cite("Le Core Banking dépend du serveur central.", "Agence de Bafoussam"));
        Assert.False(Cite("Le Core Banking dépend du serveur central.", "MTN Cameroun"));
    }

    [Fact]
    public void Un_seul_mot_commun_ne_suffit_pas()
    {
        // « Agence de Douala » ne doit pas se reconnaître dans une phrase qui ne
        // parle que de l'agence de Yaoundé.
        Assert.False(Cite("L'agence de Yaounde ouvre a 8h.", "Agence de Bafoussam"));
    }

    [Fact]
    public void Alias_suffit_a_retenir_un_element()
    {
        var entities = new List<NamedEntity>
        {
            new("Core Banking System", "Application", ["APP-001"]),
            new("Groupe electrogene", "Device", ["GEN-002"]),
        };
        // La ligne ne cite que l'identifiant : l'élément doit tout de même être fourni.
        var present = DocumentAnalyzer.Mentioned("La ligne APP-001 tombe si le courant saute.", entities);
        Assert.Single(present);
        Assert.Equal("Core Banking System", present[0].Name);
    }

    [Fact]
    public void Les_elements_etrangers_a_la_section_sont_ecartes()
    {
        var entities = new List<NamedEntity>
        {
            new("Core Banking System", "Application", []),
            new("Serveur central", "Server", []),
            new("Agence de Bafoussam", "Location", []),
            new("MTN Cameroun", "Supplier", []),
        };
        var present = DocumentAnalyzer.Mentioned("Le Core Banking System tourne sur le serveur central.", entities);
        Assert.Equal(2, present.Count);
    }
}
