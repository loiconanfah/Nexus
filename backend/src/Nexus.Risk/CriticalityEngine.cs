namespace Nexus.Risk;

/// <summary>
/// Criticality Engine (articles 14-15). La criticité effective d'une entité est
/// le maximum entre la criticité DÉCLARÉE (importée / définie par l'organisation)
/// et une criticité STRUCTURELLE dérivée du nombre d'entités qui en dépendent.
/// Ainsi un actif « secondaire » mais dont dépendent beaucoup de systèmes voit sa
/// criticité remonter automatiquement (article 1 : criticité disproportionnée).
/// </summary>
public sealed class CriticalityEngine(int perDependentWeight = 12)
{
    /// <summary>
    /// Criticité effective 0-100.
    /// </summary>
    /// <param name="declaredCriticality">Criticité déclarée de l'entité (0-100).</param>
    /// <param name="dependentCount">Nombre de dépendants (directs ou blast radius selon l'appelant).</param>
    public int Effective(int declaredCriticality, int dependentCount)
    {
        var declared = Math.Clamp(declaredCriticality, 0, 100);
        var structural = Math.Clamp(dependentCount * perDependentWeight, 0, 100);
        return Math.Max(declared, structural);
    }
}
