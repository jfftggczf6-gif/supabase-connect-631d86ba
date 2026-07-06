import { describe, it, expect } from 'vitest';
import { buildCompletionEmail, completionEmailDefaults } from './completion-email';

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

  // ── Liste des documents demandés (bug corrigé) ───────────────────────────
  describe('liste des documents demandés', () => {
    it('rend la liste des docs dans html ET text quand elle est fournie', () => {
      const { html, text } = buildCompletionEmail({
        ...base,
        requestedDocs: ['Bilan comptable', 'RIB', 'Statuts de la société'],
      });
      for (const doc of ['Bilan comptable', 'RIB', 'Statuts de la société']) {
        expect(html).toContain(doc);
        expect(text).toContain(doc);
      }
      // rendu en liste HTML
      expect(html).toContain('<ul');
      expect(html).toContain('<li>Bilan comptable</li>');
    });

    it('n\'affiche aucune section docs quand la liste est absente ou vide', () => {
      const absent = buildCompletionEmail(base);
      expect(absent.html).not.toContain('Documents à fournir');
      const empty = buildCompletionEmail({ ...base, requestedDocs: [] });
      expect(empty.html).not.toContain('Documents à fournir');
    });

    it('échappe chaque document (surface d\'injection via le libellé libre)', () => {
      const { html, text } = buildCompletionEmail({
        ...base,
        requestedDocs: ['<script>alert(1)</script>'],
      });
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;');
      expect(text).toContain('&lt;script&gt;');
    });
  });

  // ── Champs éditables ─────────────────────────────────────────────────────
  describe('champs éditables (subject / intro / personalNote / closing)', () => {
    it('rend les 4 champs personnalisés dans html ET text', () => {
      const { subject, html, text } = buildCompletionEmail({
        ...base,
        fields: {
          subject: 'Objet personnalisé Agri',
          intro: 'Message d\'intro sur mesure.',
          personalNote: 'Suite à notre échange de mardi.',
          closing: 'Cordialement, Fatou',
        },
      });
      expect(subject).toBe('Objet personnalisé Agri');
      expect(html).toContain('Message d\'intro sur mesure.');
      expect(html).toContain('Suite à notre échange de mardi.');
      expect(html).toContain('Cordialement, Fatou');
      expect(text).toContain('Message d\'intro sur mesure.');
      expect(text).toContain('Suite à notre échange de mardi.');
      expect(text).toContain('Cordialement, Fatou');
    });

    it('omet le mot personnel quand il est absent ou vide', () => {
      const absent = buildCompletionEmail(base);
      expect(absent.html).not.toContain('border-left:3px solid #7c3aed');
      const empty = buildCompletionEmail({ ...base, fields: { personalNote: '   ' } });
      expect(empty.html).not.toContain('border-left:3px solid #7c3aed');
    });

    it('fallback : chaque champ optionnel absent → valeur par défaut du gabarit', () => {
      const { subject, html, text } = buildCompletionEmail({ ...base, fields: {} });
      const defaults = completionEmailDefaults(base);
      expect(subject).toBe(defaults.subject);
      expect(html).toContain(defaults.intro);
      expect(text).toContain(defaults.intro);
      expect(html).toContain('— L\'équipe ESONO');
    });

    it('fallback : champ vidé (chaîne blanche) → valeur par défaut', () => {
      const { subject, html } = buildCompletionEmail({
        ...base,
        fields: { subject: '   ', intro: '', closing: '  ' },
      });
      const defaults = completionEmailDefaults(base);
      expect(subject).toBe(defaults.subject);
      expect(html).toContain(defaults.intro);
      expect(html).toContain('— L\'équipe ESONO');
    });

    // Critère 9 : injection dans CHAQUE champ éditable du corps → échappé, jamais actif.
    it('échappe une injection <script> / <b> dans intro, personalNote et closing (html ET text)', () => {
      const payloadScript = '<script>alert(1)</script>';
      const payloadBold = '<b>gras</b>';
      for (const field of ['intro', 'personalNote', 'closing'] as const) {
        const { html, text } = buildCompletionEmail({
          ...base,
          fields: { [field]: `${payloadScript}${payloadBold}` },
        });
        // aucune balise active ne doit ressortir
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<b>gras</b>');
        expect(text).not.toContain('<script>');
        expect(text).not.toContain('<b>gras</b>');
        // la version échappée est présente
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('&lt;b&gt;gras&lt;/b&gt;');
        expect(text).toContain('&lt;script&gt;');
      }
    });
  });

  // ── Non-régression ───────────────────────────────────────────────────────
  it('non-régression : un envoi sans modif reproduit le message historique + la liste des docs', () => {
    const { subject, html } = buildCompletionEmail({
      ...base,
      requestedDocs: ['Bilan comptable', 'RIB'],
    });
    // ton historique conservé
    expect(subject).toBe('Complétez votre candidature — Programme Agri 2026');
    expect(html).toContain('est incomplet : certaines pièces justificatives n\'ont pas été reçues.');
    expect(html).toContain('Compléter mon dossier');
    expect(html).toContain('— L\'équipe ESONO');
    // + le correctif : la liste des docs est désormais présente
    expect(html).toContain('Documents à fournir');
    expect(html).toContain('Bilan comptable');
  });
});

describe('completionEmailDefaults', () => {
  it('inclut le programme dans le sujet et l\'intro quand fourni', () => {
    const d = completionEmailDefaults({ companyName: 'Ma Boîte', programmeName: 'Agri 2026' });
    expect(d.subject).toBe('Complétez votre candidature — Agri 2026');
    expect(d.intro).toContain('Ma Boîte');
    expect(d.intro).toContain('Agri 2026');
    expect(d.closing).toBe('— L\'équipe ESONO');
  });

  it('variante sans programme + entreprise inconnue', () => {
    const d = completionEmailDefaults({ companyName: null, programmeName: null });
    expect(d.subject).toBe('Complétez votre candidature');
    expect(d.intro).toContain('votre entreprise');
    expect(d.intro).not.toContain('dans le cadre du programme');
  });
});
