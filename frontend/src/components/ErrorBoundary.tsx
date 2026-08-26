import { Component, type ReactNode } from 'react'

interface State {
  hasError: boolean
  message?: string
}

/**
 * Barrière d'erreur : évite l'écran blanc si un composant échoue au rendu.
 * Affiche un message propre et un bouton de rechargement.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="text-lg font-semibold" style={{ color: 'var(--color-text-strong)' }}>
          Une erreur inattendue s'est produite
        </div>
        <div className="max-w-md text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {this.state.message}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg px-3.5 py-2 text-sm font-medium"
          style={{ background: 'var(--color-brand)', color: '#fff' }}
        >
          Recharger
        </button>
      </div>
    )
  }
}
