import { describe, it, expect } from 'vitest';
import { checkRelanceLinks, RECOVERY_URL_PLACEHOLDER as PH } from './relance-link-guard';

// HTML relance conforme : href du bouton = placeholder, + lien de secours en
// texte visible = placeholder (2× HTML). Texte = 1× placeholder.
const htmlOK = `<div><a href="${PH}" style="...">Compléter mon dossier</a>
  <p>Si le bouton ne marche pas, copiez ce lien :<br>${PH}</p></div>`;
const textOK = `Complétez votre dossier ici : ${PH}`;

describe('checkRelanceLinks — garde anti-fuite (allowlist)', () => {
  it('accepte un e-mail relance conforme (2× HTML, 1× texte, seul href = placeholder)', () => {
    expect(checkRelanceLinks({ html: htmlOK, text: textOK })).toEqual({ ok: true });
  });

  // Cas 1 : placeholder absent
  it('refuse : placeholder absent', () => {
    const html = `<div><a href="https://esono.tech/x">Compléter</a></div>`;
    expect(checkRelanceLinks({ html, text: 'rien' }).ok).toBe(false);
  });

  // Cas 2 : placeholder présent ET un lien en dur en plus
  it('refuse : placeholder présent + href en dur en plus', () => {
    const html = `${htmlOK}<a href="https://evil.example/candidature/recovery/STOLEN">clic</a>`;
    const r = checkRelanceLinks({ html, text: textOK });
    expect(r.ok).toBe(false);
  });

  it('refuse : href encodé en entités HTML (≠ placeholder)', () => {
    const html = `<div><a href="https:&#x2f;&#x2f;evil&#x2f;candidature&#x2f;recovery&#x2f;x">Compléter</a>
      <p>secours :<br>${PH}</p></div>`;
    // 1 seul placeholder (le href du bouton est un lien en dur encodé) → refus
    expect(checkRelanceLinks({ html, text: textOK }).ok).toBe(false);
  });

  it('refuse : chemin de récupération en dur dans le texte visible', () => {
    const html = `${htmlOK}<p>ou https://esono.tech/candidature/recovery/HARD</p>`;
    // le placeholder reste 2×, aucun href fautif, mais ceinture #3 attrape le chemin
    expect(checkRelanceLinks({ html, text: textOK }).ok).toBe(false);
  });

  // Cas 3 : deux placeholders là où un seul est attendu (version texte)
  it('refuse : deux placeholders dans le texte au lieu d\'un', () => {
    expect(checkRelanceLinks({ html: htmlOK, text: `${PH} et encore ${PH}` }).ok).toBe(false);
  });

  it('refuse : trois placeholders dans le HTML au lieu de deux', () => {
    expect(checkRelanceLinks({ html: `${htmlOK}<p>${PH}</p>`, text: textOK }).ok).toBe(false);
  });
});
