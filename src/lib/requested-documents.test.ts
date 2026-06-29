import { describe, it, expect } from 'vitest';
import { buildRequestedDocuments } from './requested-documents';

describe('buildRequestedDocuments', () => {
  it('liste les documents du formulaire avec leur statut fourni/manquant', () => {
    const out = buildRequestedDocuments({
      formFileLabels: ['Bilan', 'Plan de financement'],
      customLabels: [],
      existingDocs: [{ field_label: 'Bilan', file_name: 'bilan2024.pdf', file_size: 1, storage_path: 'p' }],
    });
    expect(out).toEqual([
      { label: 'Bilan', source: 'form', provided: true, fileName: 'bilan2024.pdf' },
      { label: 'Plan de financement', source: 'form', provided: false, fileName: null },
    ]);
  });

  it('ajoute les demandes sur-mesure après celles du formulaire', () => {
    const out = buildRequestedDocuments({
      formFileLabels: ['Bilan'],
      customLabels: ['RIB', 'Attestation fiscale'],
      existingDocs: [],
    });
    expect(out.map(d => [d.label, d.source])).toEqual([
      ['Bilan', 'form'],
      ['RIB', 'custom'],
      ['Attestation fiscale', 'custom'],
    ]);
  });

  it('ne duplique pas une demande sur-mesure déjà présente dans le formulaire', () => {
    const out = buildRequestedDocuments({
      formFileLabels: ['Bilan'],
      customLabels: ['Bilan'],
      existingDocs: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('form');
  });

  it('ignore les libellés vides ou en double', () => {
    const out = buildRequestedDocuments({
      formFileLabels: ['Bilan', '  ', 'Bilan'],
      customLabels: ['', 'RIB'],
      existingDocs: [],
    });
    expect(out.map(d => d.label)).toEqual(['Bilan', 'RIB']);
  });

  it('renvoie une liste vide quand rien n\'est demandé (fallback drag&drop)', () => {
    expect(buildRequestedDocuments({ formFileLabels: [], customLabels: [], existingDocs: [] })).toEqual([]);
  });
});
