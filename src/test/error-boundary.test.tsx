// Le garde-fou de rendu, et sa contre-épreuve.
//
// Un candidat ghanéen a décrit « le formulaire devient vide ». C'est le
// comportement par défaut de React : une exception pendant le rendu démonte
// l'arbre entier et laisse une page blanche. Aucun ErrorBoundary n'existait.
//
// Le premier test vérifie le cas NORMAL — sans lui, un garde-fou cassé qui
// afficherait l'erreur en permanence passerait inaperçu.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function Explose(): JSX.Element {
  throw new Error('rendu impossible');
}

let erreursConsole: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  // React journalise l'erreur qu'il rattrape ; on ne veut pas polluer la sortie
  // des tests, mais on vérifie plus bas qu'elle EST bien journalisée.
  erreursConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => erreursConsole.mockRestore());

describe('rendu normal', () => {
  it('laisse passer ses enfants quand rien ne lève', () => {
    render(<ErrorBoundary><p>formulaire</p></ErrorBoundary>);
    expect(screen.getByText('formulaire')).toBeInTheDocument();
  });
});

describe('rendu en échec', () => {
  it('affiche un message au lieu d\'une page blanche', () => {
    render(<ErrorBoundary><Explose /></ErrorBoundary>);
    expect(screen.getByText(/rencontré un problème|went wrong/i)).toBeInTheDocument();
  });

  it('propose de recharger', () => {
    render(<ErrorBoundary><Explose /></ErrorBoundary>);
    expect(screen.getByRole('button', { name: /recharger|reload/i })).toBeInTheDocument();
  });

  it('porte le message rassurant du contexte quand il est fourni', () => {
    // C'est le point qui compte pour un candidat : savoir qu'il n'a rien perdu.
    render(
      <ErrorBoundary reassurance="Vos réponses sont enregistrées sur cet appareil.">
        <Explose />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Vos réponses sont enregistrées/)).toBeInTheDocument();
  });

  it('journalise l\'erreur — sans trace, on ne trouvera jamais la cause', () => {
    render(<ErrorBoundary><Explose /></ErrorBoundary>);
    const appels = erreursConsole.mock.calls.map((c) => String(c[0]));
    expect(appels.some((a) => a.includes('[ErrorBoundary]'))).toBe(true);
  });

  it('expose le détail technique, replié', () => {
    render(<ErrorBoundary><Explose /></ErrorBoundary>);
    expect(screen.getByText('rendu impossible')).toBeInTheDocument();
    expect(screen.getByText(/Détail technique|Technical details/i)).toBeInTheDocument();
  });
});
