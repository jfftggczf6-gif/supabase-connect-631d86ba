import { describe, it, expect } from 'vitest';
import { fileFieldLabels, receivedDocLabels, missingDocLabels } from './candidature-missing-docs';

const formFields = [
  { type: 'text', label: 'Nom' },
  { type: 'file', label: 'Bilan comptable' },
  { type: 'file', label: 'RIB' },
  { type: 'file', label: '   ' }, // vide → ignoré
];

describe('candidature-missing-docs', () => {
  it('extrait les libellés des champs fichier du formulaire', () => {
    expect(fileFieldLabels(formFields)).toEqual(['Bilan comptable', 'RIB']);
  });

  it('libellés reçus = documents avec un fichier', () => {
    const docs = [
      { field_label: 'Bilan comptable', storage_path: 'candidature-documents/x' },
      { field_label: 'Sans fichier' }, // pas de fichier → ignoré
    ];
    expect([...receivedDocLabels(docs)]).toEqual(['Bilan comptable']);
  });

  it('pièces manquantes = champs fichier non reçus', () => {
    const docs = [{ field_label: 'Bilan comptable', file_name: 'b.pdf' }];
    expect(missingDocLabels(formFields, docs)).toEqual(['RIB']);
  });

  it('toutes reçues → aucune manquante', () => {
    const docs = [
      { field_label: 'Bilan comptable', file_name: 'b.pdf' },
      { field_label: 'RIB', file_name: 'r.pdf' },
    ];
    expect(missingDocLabels(formFields, docs)).toEqual([]);
  });

  it('aucun champ fichier → aucune manquante', () => {
    expect(missingDocLabels([{ type: 'text', label: 'x' }], [])).toEqual([]);
  });

  it('robuste aux entrées non-tableau', () => {
    expect(missingDocLabels(null, undefined)).toEqual([]);
  });
});
