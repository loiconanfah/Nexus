using Nexus.AI;

namespace Nexus.Tests.AI;

/// <summary>
/// La chaîne de modèles envoyée à OpenRouter. C'est elle qui assure la
/// continuité quand un modèle est en panne ou saturé : le choix de
/// l'utilisateur d'abord, des replis derrière, sans doublon et sans excès.
/// </summary>
public class OpenRouterChainTests
{
    [Fact]
    public void Le_choix_de_l_utilisateur_passe_en_premier()
    {
        var chain = OpenRouterChatCompletion.Chain("mistralai/mistral-large");
        Assert.Equal("mistralai/mistral-large", chain[0]);
        Assert.True(chain.Count > 1, "un seul modèle ne permet aucun repli");
    }

    [Fact]
    public void Plusieurs_modeles_separes_par_des_virgules_gardent_leur_ordre()
    {
        var chain = OpenRouterChatCompletion.Chain(" a/premier , b/second ");
        Assert.Equal("a/premier", chain[0]);
        Assert.Equal("b/second", chain[1]);
    }

    [Fact]
    public void Un_repli_deja_choisi_n_est_pas_repete()
    {
        var chain = OpenRouterChatCompletion.Chain(OpenRouterChatCompletion.Fallbacks[1]);
        Assert.Equal(chain.Count, chain.Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.Equal(OpenRouterChatCompletion.Fallbacks[1], chain[0]);
    }

    [Fact]
    public void La_chaine_reste_courte()
    {
        // Une panne générale ferait sinon payer autant d'essais qu'il y a de modèles.
        var chain = OpenRouterChatCompletion.Chain("a/un, b/deux, c/trois, d/quatre, e/cinq, f/six");
        Assert.True(chain.Count <= 6);
        Assert.Equal(4, OpenRouterChatCompletion.Chain("a/un").Count);
    }

    [Fact]
    public void Sans_choix_la_chaine_par_defaut_s_applique()
    {
        Assert.Equal(OpenRouterChatCompletion.Fallbacks, OpenRouterChatCompletion.Chain(null));
        Assert.Equal(OpenRouterChatCompletion.Fallbacks, OpenRouterChatCompletion.Chain("  "));
    }
}
