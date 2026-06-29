import { describe, it, expect } from 'vitest';
import { mergeDocuments, FREE_DOC_LABEL, type CandidatureDoc } from './merge-documents';

const doc = (field_label: string, storage_path: string, file_name = `${field_label}.pdf`): CandidatureDoc => ({
  field_label, file_name, file_size: 1000, storage_path,
});

describe('mergeDocuments', () => {
  it('ne supprime JAMAIS les documents existants quand rien n\'est renvoyé (point 1)', () => {
    const existing = [doc('Bilan', 'candidature-documents/c/1_bilan.pdf')];
    expect(mergeDocuments(existing, [])).toEqual(existing);
  });

  it('ajoute un nouveau document sans toucher aux autres', () => {
    const existing = [doc('Bilan', 'candidature-documents/c/1_bilan.pdf')];
    const incoming = [doc('Plan', 'candidature-documents/c/2_plan.pdf')];
    const out = mergeDocuments(existing, incoming);
    expect(out.map(d => d.field_label).sort()).toEqual(['Bilan', 'Plan']);
  });

  it('remplace le document d\'un même slot (re-upload d\'une pièce demandée)', () => {
    const existing = [doc('Bilan', 'candidature-documents/c/1_old.pdf', 'old.pdf')];
    const incoming = [doc('Bilan', 'candidature-documents/c/2_new.pdf', 'new.pdf')];
    const out = mergeDocuments(existing, incoming);
    expect(out).toHaveLength(1);
    expect(out[0].file_name).toBe('new.pdf');
    expect(out[0].storage_path).toContain('2_new.pdf');
  });

  it('cumule les documents libres (ne remplace pas entre eux)', () => {
    const existing = [doc(FREE_DOC_LABEL, 'candidature-documents/c/1_a.pdf', 'a.pdf')];
    const incoming = [
      doc(FREE_DOC_LABEL, 'candidature-documents/c/2_b.pdf', 'b.pdf'),
      doc(FREE_DOC_LABEL, 'candidature-documents/c/3_c.pdf', 'c.pdf'),
    ];
    const out = mergeDocuments(existing, incoming);
    expect(out).toHaveLength(3);
  });

  it('dédoublonne par storage_path identique', () => {
    const existing = [doc('Bilan', 'candidature-documents/c/1_bilan.pdf')];
    const incoming = [doc('Bilan', 'candidature-documents/c/1_bilan.pdf')];
    expect(mergeDocuments(existing, incoming)).toHaveLength(1);
  });
});
