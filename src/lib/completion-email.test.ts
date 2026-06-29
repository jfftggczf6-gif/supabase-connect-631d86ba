import { describe, it, expect } from 'vitest';
import { buildCompletionEmail } from './completion-email';

const base = {
  companyName: 'GIE Mame Malick Diange',
  contactName: 'Khady Diallo',
  programmeName: 'Programme Agri 2026',
  recoveryUrl: 'https://esono.tech/candidature/recovery/abc123',
  expiresAt: '2026-07-06T10:00:00.000Z',
};

describe('buildCompletionEmail', () => {
  it('met le nom du programme dans le sujet quand il existe', () => {
    const { subject } = buildCompletionEmail(base);
    expect(subject).toContain('Programme Agri 2026');
    expect(subject.toLowerCase()).toContain('complét');
  });

  it('sujet sans tiret bancal quand pas de programme', () => {
    const { subject } = buildCompletionEmail({ ...base, programmeName: null });
    expect(subject).toBe('Complétez votre candidature');
  });

  it('inclut le lien de récupération dans le html ET le texte', () => {
    const { html, text } = buildCompletionEmail(base);
    expect(html).toContain('https://esono.tech/candidature/recovery/abc123');
    expect(text).toContain('https://esono.tech/candidature/recovery/abc123');
  });

  it('salue le contact par son nom quand fourni', () => {
    const { html, text } = buildCompletionEmail(base);
    expect(html).toContain('Khady Diallo');
    expect(text).toContain('Khady Diallo');
  });

  it('salutation générique quand pas de nom de contact', () => {
    const { html } = buildCompletionEmail({ ...base, contactName: null });
    expect(html).toContain('Bonjour,');
    expect(html).not.toContain('Bonjour ,');
  });

  it('affiche une mention d\'expiration quand expiresAt est fourni', () => {
    const withExp = buildCompletionEmail(base);
    expect(withExp.html.toLowerCase()).toContain('expire');
    expect(withExp.html).toContain('2026'); // l'année de la date d'expiration
  });

  it('pas de mention d\'expiration quand expiresAt est absent', () => {
    const noExp = buildCompletionEmail({ ...base, expiresAt: null });
    expect(noExp.html.toLowerCase()).not.toContain('expire');
  });

  it('échappe le HTML dans les valeurs fournies par l\'utilisateur', () => {
    const { html } = buildCompletionEmail({ ...base, companyName: 'A & B <script>' });
    expect(html).toContain('A &amp; B &lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
