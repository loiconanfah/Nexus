using Nexus.Domain.Ontology;

namespace Nexus.Tests.Domain;

public class OntologyTests
{
    [Theory]
    [InlineData("Server")]
    [InlineData("server")]        // insensible à la casse
    [InlineData("APPLICATION")]
    public void EntityType_FromName_resolves_known_types(string name)
    {
        var result = EntityType.FromName(name);
        Assert.True(result.IsSuccess);
    }

    [Fact]
    public void EntityType_FromName_rejects_unknown_type()
    {
        var result = EntityType.FromName("Wormhole");
        Assert.True(result.IsFailure);
        Assert.Equal("ontology.entity_type.unknown", result.Error.Code);
    }

    [Fact]
    public void EntityType_flags_technical_types_as_assets()
    {
        Assert.True(EntityType.Server.IsAsset);
        Assert.True(EntityType.Database.IsAsset);
        Assert.False(EntityType.Person.IsAsset);
    }

    [Fact]
    public void RelationType_DependsOn_is_the_dependency_pivot()
    {
        Assert.True(RelationType.DependsOn.IsDependencyRelation);
        Assert.True(RelationType.DependsOn.Propagates);
    }

    [Fact]
    public void RelationType_Knows_models_human_dependency()
    {
        // KNOWS alimente le Human Dependency Engine (article 28).
        Assert.True(RelationType.Knows.IsDependencyRelation);
    }

    [Fact]
    public void RelationType_FromName_rejects_unknown_type()
    {
        var result = RelationType.FromName("TELEPORTS_TO");
        Assert.True(result.IsFailure);
    }

    [Fact]
    public void Registries_are_populated()
    {
        Assert.NotEmpty(EntityType.All);
        Assert.NotEmpty(RelationType.All);
    }
}
