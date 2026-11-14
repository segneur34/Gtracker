import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CONTEXT_MARK, setLanguage } from '../core/i18n';
import { parseRich, tRich } from './tRich';

afterEach(() => setLanguage('fr'));

/** Rendu en texte, sans les marques que le rendu serveur glisse entre deux textes voisins (le DOM affiché est le même). */
const html = (node: ReactNode): string => renderToStaticMarkup(<>{node}</>).replace(/<!-- -->/g, '');

describe('parseRich : découpage d’une phrase à balises', () => {
  it('texte, balises imbriquées, auto-fermante', () => {
    expect(parseRich('Texte avec <b>{x}</b> dedans')).toEqual(['Texte avec ', { tag: 'b', children: ['{x}'], selfClosing: false }, ' dedans']);
    expect(parseRich('<b>gras <em>et penché</em></b><br/>fin')).toEqual([
      { tag: 'b', children: ['gras ', { tag: 'em', children: ['et penché'], selfClosing: false }], selfClosing: false },
      { tag: 'br', children: [], selfClosing: true },
      'fin',
    ]);
  });

  it('un « < » qui n’ouvre pas de balise, une fermante orpheline, une ouvrante jamais fermée restent du texte', () => {
    expect(parseRich('vent < 5 nœuds')).toEqual(['vent < 5 nœuds']);
    expect(parseRich('a </b> c')).toEqual(['a </b> c']);
    expect(parseRich('a <b>c <em>d</em>')).toEqual(['a <b>c ', { tag: 'em', children: ['d'], selfClosing: false }]);
  });
});

describe('tRich : même DOM que le JSX remplacé', () => {
  it('balises connues et variables', () => {
    const x = 3;
    expect(html(tRich('Texte avec <b>{x}</b> dedans', { x }))).toBe(html(<>Texte avec <b>{x}</b> dedans</>));
    expect(html(tRich('<strong>Vent</strong> lu à la <em>bissectrice</em>.<br/>Suite'))).toBe(
      html(<><strong>Vent</strong> lu à la <em>bissectrice</em>.<br />Suite</>)
    );
  });

  it('balise donnée par le site d’appel, élément en variable', () => {
    const tags = { lien: (children: ReactNode) => <a href="#aide" className="lien">{children}</a> };
    expect(html(tRich('Voir <lien>l’aide de <b>{page}</b></lien>.', { page: 'Réglages' }, tags))).toBe(
      html(<>Voir <a href="#aide" className="lien">l’aide de <b>Réglages</b></a>.</>)
    );
    expect(html(tRich('Appuyez sur {icone} pour noter', { icone: <svg width="4" /> }))).toBe(html(<>Appuyez sur <svg width="4" /> pour noter</>));
  });

  it('variable absente et balise inconnue : laissées sans casser la phrase', () => {
    expect(html(tRich('a {absent} <inconnue>b</inconnue>'))).toBe('a {absent} b');
  });

  it('traduit la phrase entière, contexte compris', () => {
    setLanguage('en', { 'Texte avec <b>{x}</b> dedans': 'Text with <b>{x}</b> inside', [`<em>vol</em>${CONTEXT_MARK}foil`]: '<em>flight</em>' });
    expect(html(tRich('Texte avec <b>{x}</b> dedans', { x: '1.5' }))).toBe('Text with <b>1.5</b> inside');
    expect(html(tRich('<em>vol</em>', { ctx: 'foil' }))).toBe('<em>flight</em>');
  });
});
