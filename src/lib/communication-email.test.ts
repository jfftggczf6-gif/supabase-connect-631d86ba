import { describe, it, expect } from 'vitest';
import { buildCommunicationEmail } from './communication-email';

describe('buildCommunicationEmail (brief 1)', () => {
  const base = {
    subject: 'Visite de terrain',
    body: 'Bonjour,\n\nUne visite est prévue le 3 septembre.\n\nÀ bientôt.',
    closing: 'Nathalie',
  };

  it('critère 2 : ni bouton, ni URL de récupération, ni phrase de dépôt, ni intro d\'incomplétude', () => {
    const { html } = buildCommunicationEmail(base);
    expect(html).not.toContain('Compléter mon dossier');
    expect(html).not.toContain('/candidature/recovery/');
    expect(html).not.toContain('déposer les documents');
    expect(html).not.toContain('incomplet');
    expect(html.toLowerCase()).not.toContain('<a ');
  });

  it('critère 3 : rien n\'est injecté entre le corps saisi et la clôture', () => {
    const { html } = buildCommunicationEmail(base);
    // le corps est suivi directement de la clôture, sans texte de gabarit entre les deux
    const bodyEnd = html.indexOf('À bientôt.');
    const closingStart = html.indexOf('Nathalie');
    expect(bodyEnd).toBeGreaterThan(-1);
    expect(closingStart).toBeGreaterThan(bodyEnd);
    // pas de salutation nominative injectée, pas de titre
    expect(html).not.toContain('<h2>');
  });

  it('préserve les paragraphes et lignes vides du corps', () => {
    const { html } = buildCommunicationEmail(base);
    expect(html).toContain('Bonjour,<br>');
    expect(html).toMatch(/Bonjour,<br>\s*<br>\s*Une visite/);
  });

  it('neutralise un préfixe « Objet : » dans l\'objet', () => {
    expect(buildCommunicationEmail({ ...base, subject: 'Objet : Visite' }).subject).toBe('Visite');
  });

  it('échappe le HTML du corps (anti-injection)', () => {
    const { html } = buildCommunicationEmail({ ...base, body: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('critère 8 : rend le logo d\'en-tête de l\'org quand fourni, rien sinon', () => {
    const avec = buildCommunicationEmail({ ...base, logoUrl: 'https://ex.co/logo.png' });
    expect(avec.html).toContain('<img src="https://ex.co/logo.png"');
    const sans = buildCommunicationEmail(base);
    expect(sans.html).not.toContain('<img');
  });

  it('corps vide autorisé mais sans contenu parasite', () => {
    const { html, text } = buildCommunicationEmail({ subject: 'x', body: '', closing: '' });
    expect(html).toContain('<div');
    expect(text).toBe('');
  });
});
