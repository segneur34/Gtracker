import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CONTEXT_MARK, setLanguage } from '../core/i18n';
import { parseRich, tRich, tnRich } from './tRich';

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

describe('tnRich : phrase à balises accordée au nombre', () => {
  const un = '<b>{n}</b> manœuvre sur <i>{nom}</i>';
  const plusieurs = '<b>{n}</b> manœuvres sur <i>{nom}</i>';
  const dico = {
    [un]: '<b>{n}</b> maneuver on <i>{nom}</i>',
    [plusieurs]: '<b>{n}</b> maneuvers on <i>{nom}</i>',
  };

  it('français : pluriel si n > 1, DOM égal à tRich de la phrase choisie', () => {
    expect(html(tnRich(1, un, plusieurs, { nom: 'Lac' }))).toBe(html(tRich(un, { n: 1, nom: 'Lac' })));
    expect(html(tnRich(3, un, plusieurs, { nom: 'Lac' }))).toBe(html(tRich(plusieurs, { n: 3, nom: 'Lac' })));
    expect(html(tnRich(0, un, plusieurs, { nom: 'Lac' }))).toBe('<b>0</b> manœuvre sur <i>Lac</i>');
    expect(html(tnRich(3, un, plusieurs, { nom: 'Lac' }))).toBe('<b>3</b> manœuvres sur <i>Lac</i>');
  });

  it('français : le cinquième argument impose la règle du site d’appel', () => {
    expect(html(tnRich(1, un, plusieurs, { nom: 'Lac' }, {}, true))).toBe('<b>1</b> manœuvres sur <i>Lac</i>');
    expect(html(tnRich(5, un, plusieurs, { nom: 'Lac' }, {}, false))).toBe('<b>5</b> manœuvre sur <i>Lac</i>');
  });

  it('anglais et espagnol : pluriel si n !== 1, le cinquième argument est ignoré', () => {
    setLanguage('en', dico);
    expect(html(tnRich(0, un, plusieurs, { nom: 'Lac' }))).toBe('<b>0</b> maneuvers on <i>Lac</i>');
    expect(html(tnRich(1, un, plusieurs, { nom: 'Lac' }, {}, true))).toBe('<b>1</b> maneuver on <i>Lac</i>');
    expect(html(tnRich(2, un, plusieurs, { nom: 'Lac' }, {}, false))).toBe('<b>2</b> maneuvers on <i>Lac</i>');
    setLanguage('es', { [un]: '<b>{n}</b> maniobra en <i>{nom}</i>', [plusieurs]: '<b>{n}</b> maniobras en <i>{nom}</i>' });
    expect(html(tnRich(1, un, plusieurs, { nom: 'Lac' }))).toBe('<b>1</b> maniobra en <i>Lac</i>');
    expect(html(tnRich(0, un, plusieurs, { nom: 'Lac' }))).toBe('<b>0</b> maniobras en <i>Lac</i>');
  });

  it('{n} peut être donné déjà formaté, balises du site d’appel et contexte conservés', () => {
    expect(html(tnRich(1500, 'un <lien>vol</lien>', '{n} <lien>vols</lien>', { n: '1 500' }, { lien: (c) => <a href="#v">{c}</a> }))).toBe('1 500 <a href="#v">vols</a>');
    setLanguage('en', { [`un <b>vol</b>${CONTEXT_MARK}foil`]: 'a <b>flight</b>' });
    expect(html(tnRich(1, 'un <b>vol</b>', '{n} <b>vols</b>', { ctx: 'foil' }))).toBe('a <b>flight</b>');
  });
});
