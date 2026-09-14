import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Démonte le DOM rendu après chaque test (sinon les éléments RTL s'accumulent entre tests).
afterEach(() => cleanup());

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null as ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// localStorage en mémoire.
//
// L'environnement jsdom de cette configuration expose bien `localStorage`, mais
// sans ses méthodes : `typeof localStorage.setItem` vaut `undefined`. Tout test
// qui touche au stockage échoue alors sur « is not a function », ce qui ressemble
// à un bug du code testé alors que c'est l'environnement qui manque.
//
// On installe donc une implémentation minimale mais CONFORME : elle stringifie
// les clés et valeurs comme le vrai Storage, et expose `clear`, `key` et
// `length`. Les tests qui simulent une panne (quota plein, navigation privée)
// remplacent ponctuellement `Storage.prototype.setItem` — d'où le passage par un
// prototype réel plutôt qu'un objet littéral.
class StorageMemoire implements Storage {
  private donnees = new Map<string, string>();
  get length(): number { return this.donnees.size; }
  clear(): void { this.donnees.clear(); }
  getItem(cle: string): string | null { return this.donnees.get(String(cle)) ?? null; }
  key(i: number): string | null { return [...this.donnees.keys()][i] ?? null; }
  removeItem(cle: string): void { this.donnees.delete(String(cle)); }
  setItem(cle: string, valeur: string): void { this.donnees.set(String(cle), String(valeur)); }
}

for (const nom of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(window, nom, {
    configurable: true,
    writable: true,
    value: new StorageMemoire(),
  });
}
// Les tests de panne substituent Storage.prototype.setItem : sans ce lien, la
// substitution ne toucherait pas notre implémentation.
Object.defineProperty(globalThis, 'Storage', {
  configurable: true, writable: true, value: StorageMemoire,
});
