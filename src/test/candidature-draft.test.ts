// Le brouillon du formulaire public.
//
// Ces tests existent parce qu'un candidat ghanéen a renoncé deux fois : le
// formulaire se vidait, et un rechargement lui reprenait tout. La cause du
// blocage n'est pas reproduite ; la perte, elle, était certaine.

import { describe, it, expect, beforeEach } from 'vitest';
import { enregistrer, lire, effacer, estVide, PEREMPTION_JOURS } from '@/lib/candidature-draft';

const SLUG = 'boost-camp-programme-ghana-2026-mqkma6qc';

const SAISIE = {
  companyName: 'MSME-2K Farms',
  contactName: 'A. Mensah',
  contactEmail: '2kfarmsghana@example.com',
  contactPhone: '+233 20 000 0000',
  formData: { 'Country': 'Ghana', 'What is the location of your project?': 'Accra' },
  displayLang: 'en' as string | null,
};

beforeEach(() => localStorage.clear());

describe('aller-retour', () => {
  it('ce qui est saisi est relu à l\'identique', () => {
    expect(enregistrer(SLUG, SAISIE)).toBe(true);
    const b = lire(SLUG);
    expect(b?.companyName).toBe('MSME-2K Farms');
    expect(b?.formData['Country']).toBe('Ghana');
    expect(b?.displayLang).toBe('en');
  });

  it('le brouillon est cloisonné par formulaire', () => {
    enregistrer(SLUG, SAISIE);
    expect(lire('un-autre-formulaire')).toBeNull();
  });

  it('la soumission réussie efface le brouillon', () => {
    enregistrer(SLUG, SAISIE);
    effacer(SLUG);
    expect(lire(SLUG)).toBeNull();
  });
});

describe('ce qu\'on n\'enregistre pas', () => {
  it('un formulaire vide ne crée pas de brouillon', () => {
    const vide = { companyName: '', contactName: '', contactEmail: '', contactPhone: '',
                   formData: {}, displayLang: null };
    expect(estVide(vide)).toBe(true);
    expect(enregistrer(SLUG, vide)).toBe(false);
    expect(lire(SLUG)).toBeNull();
  });

  it('des espaces seuls ne comptent pas comme une saisie', () => {
    expect(estVide({ companyName: '   ', contactName: '', contactEmail: '', contactPhone: '',
                     formData: { q: '  ' }, displayLang: null })).toBe(true);
  });

  it('une seule réponse suffit à déclencher la sauvegarde', () => {
    expect(estVide({ companyName: '', contactName: '', contactEmail: '', contactPhone: '',
                     formData: { q: 'Ghana' }, displayLang: null })).toBe(false);
  });

  it('un tableau de cases cochées vide ne compte pas, rempli oui', () => {
    const base = { companyName: '', contactName: '', contactEmail: '', contactPhone: '', displayLang: null };
    expect(estVide({ ...base, formData: { q: [] } })).toBe(true);
    expect(estVide({ ...base, formData: { q: ['a'] } })).toBe(false);
  });
});

describe('péremption', () => {
  it('un brouillon récent est relu', () => {
    enregistrer(SLUG, SAISIE);
    const dans29Jours = new Date(Date.now() + 29 * 24 * 3600 * 1000);
    expect(lire(SLUG, dans29Jours)).not.toBeNull();
  });

  it('au-delà de la péremption il est ignoré ET effacé', () => {
    enregistrer(SLUG, SAISIE);
    const apres = new Date(Date.now() + (PEREMPTION_JOURS + 1) * 24 * 3600 * 1000);
    expect(lire(SLUG, apres)).toBeNull();
    // Effacé, pas seulement ignoré : sinon il resterait indéfiniment dans le
    // navigateur du candidat.
    expect(localStorage.getItem(`esono_candidature_draft_${SLUG}`)).toBeNull();
  });
});

describe('robustesse — la saisie ne doit jamais casser à cause du brouillon', () => {
  it('un brouillon corrompu est écarté et nettoyé', () => {
    localStorage.setItem(`esono_candidature_draft_${SLUG}`, '{ceci n\'est pas du JSON');
    expect(lire(SLUG)).toBeNull();
    expect(localStorage.getItem(`esono_candidature_draft_${SLUG}`)).toBeNull();
  });

  it('un brouillon sans horodatage est ignoré', () => {
    localStorage.setItem(`esono_candidature_draft_${SLUG}`, JSON.stringify({ companyName: 'X' }));
    expect(lire(SLUG)).toBeNull();
  });

  it('un stockage indisponible ne lève pas', () => {
    // Navigation privée, quota plein, stockage désactivé : le candidat perdrait
    // bien plus que son brouillon si l'exception remontait jusqu'au rendu.
    const vrai = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(() => enregistrer(SLUG, SAISIE)).not.toThrow();
    expect(enregistrer(SLUG, SAISIE)).toBe(false);
    Storage.prototype.setItem = vrai;
  });

  it('une lecture qui lève ne casse pas non plus', () => {
    const vrai = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('SecurityError'); };
    expect(() => lire(SLUG)).not.toThrow();
    expect(lire(SLUG)).toBeNull();
    Storage.prototype.getItem = vrai;
  });
});
