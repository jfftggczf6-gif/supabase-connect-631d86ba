// Garde-fou de rendu.
//
// Motif — signalé le 14/09 par un candidat ghanéen : « le formulaire se bloque
// ou devient vide ». Une page blanche, sans message.
//
// C'est le comportement par défaut de React : si un composant lève pendant le
// rendu, l'arbre entier est démonté. Sans garde-fou, l'utilisateur voit du
// blanc, ne sait pas s'il doit attendre, recharger ou renoncer — et l'incident
// ne laisse aucune trace exploitable. Aucun ErrorBoundary n'existait dans
// l'application, à aucun niveau.
//
// Ce composant ne corrige aucun bug. Il change ce qui arrive AU LECTEUR quand
// un bug survient : un message, la raison, et surtout la consigne qui compte —
// ses réponses sont conservées.
//
// Il journalise aussi l'erreur avec sa pile de composants, ce qui est la seule
// chose qui permettra de trouver la cause la prochaine fois.

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Message rassurant propre au contexte (ex. « vos réponses sont conservées »). */
  reassurance?: string;
}

interface State {
  erreur: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { erreur: null };

  static getDerivedStateFromError(erreur: Error): State {
    return { erreur };
  }

  componentDidCatch(erreur: Error, info: ErrorInfo): void {
    // La pile de COMPOSANTS, pas seulement la pile JavaScript : c'est elle qui
    // dit où, dans l'arbre, le rendu a cédé.
    console.error('[ErrorBoundary]', erreur, info.componentStack);
  }

  render(): ReactNode {
    const { erreur } = this.state;
    if (!erreur) return this.props.children;

    const enAnglais = (document.documentElement.lang || '').startsWith('en');

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full rounded-lg border border-destructive/30 bg-card p-6 text-center">
          <h1 className="text-lg font-semibold mb-2">
            {enAnglais ? 'Something went wrong on this page' : 'Cette page a rencontré un problème'}
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            {this.props.reassurance ??
              (enAnglais
                ? 'Reloading the page usually fixes it.'
                : 'Recharger la page suffit généralement à le résoudre.')}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {enAnglais ? 'Reload the page' : 'Recharger la page'}
          </button>
          {/* Le détail technique est replié : inutile au candidat, indispensable
              à qui reçoit la capture d'écran. */}
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              {enAnglais ? 'Technical details' : 'Détail technique'}
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-[11px]">
              {erreur.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
