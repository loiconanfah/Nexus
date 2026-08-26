namespace Nexus.Core.Results;

/// <summary>
/// Résultat d'une opération : succès, ou échec porteur d'une <see cref="Error"/>.
/// Rend les chemins d'échec explicites (pas d'exception pour le flux métier normal).
/// </summary>
public class Result
{
    protected Result(bool isSuccess, Error error)
    {
        // Invariant : un succès n'a pas d'erreur, un échec en a une.
        if (isSuccess && error != Error.None)
        {
            throw new InvalidOperationException("Un résultat de succès ne peut pas porter d'erreur.");
        }

        if (!isSuccess && error == Error.None)
        {
            throw new InvalidOperationException("Un résultat d'échec doit porter une erreur.");
        }

        IsSuccess = isSuccess;
        Error = error;
    }

    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;
    public Error Error { get; }

    public static Result Success() => new(true, Error.None);
    public static Result Failure(Error error) => new(false, error);

    public static Result<T> Success<T>(T value) => Result<T>.FromValue(value);
    public static Result<T> Failure<T>(Error error) => Result<T>.FromError(error);
}

/// <summary>Résultat porteur d'une valeur en cas de succès.</summary>
public sealed class Result<T> : Result
{
    private readonly T? _value;

    private Result(T? value, bool isSuccess, Error error) : base(isSuccess, error)
        => _value = value;

    /// <summary>Valeur du succès. Accès en échec = erreur de programmation.</summary>
    public T Value => IsSuccess
        ? _value!
        : throw new InvalidOperationException("Impossible d'accéder à la valeur d'un résultat en échec.");

    internal static Result<T> FromValue(T value) => new(value, true, Error.None);
    internal static Result<T> FromError(Error error) => new(default, false, error);

    /// <summary>Conversion implicite d'une valeur en résultat de succès.</summary>
    public static implicit operator Result<T>(T value) => FromValue(value);

    /// <summary>Conversion implicite d'une erreur en résultat d'échec.</summary>
    public static implicit operator Result<T>(Error error) => FromError(error);
}
