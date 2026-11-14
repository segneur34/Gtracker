/**
 * Phrase traduite qui porte des balises : une seule clé entière, dont les balises deviennent des éléments.
 *
 *   tRich('Texte avec <b>{x}</b> dedans', { x: 3 })
 *   tRich('Voir <lien>la page</lien>', {}, { lien: (children) => <a href="…">{children}</a> })
 *   tRich('Appuyez sur {icone} pour noter', { icone: <NoteIcon /> })
 *
 * rend le même DOM que le JSX qu'il remplace (`<>Texte avec <b>{x}</b> dedans</>`). `<b>`, `<strong>`, `<em>`, `<i>`
 * et `<br/>` sont connus sans rien donner ; une autre balise passe par `tags`. Une variable vaut un texte, un nombre
 * ou un élément ; `ctx` choisit l'entrée du dictionnaire comme pour `t`. Un « < » qui n'ouvre pas une balise reste du texte.
 */
import { Fragment, createElement, type ReactNode } from 'react';
import { t } from '../core/i18n';

/** Rendu d'une balise : reçoit son contenu déjà rendu (`null` pour une balise auto-fermante, `<br/>`). */
export type RichTag = (children: ReactNode) => ReactNode;

/** Balises d'une phrase, par nom. */
export type RichTags = Readonly<Record<string, RichTag>>;

/** Variables d'une phrase riche : `{nom}` est remplacé par un texte, un nombre ou un élément ; `ctx` n'est jamais remplacé. */
export type RichVars = { readonly ctx?: string } & { readonly [name: string]: ReactNode };

/** Morceau d'une phrase découpée : du texte (variables comprises, pas encore remplacées) ou une balise et son contenu. */
export type RichPart = string | { readonly tag: string; readonly children: readonly RichPart[]; readonly selfClosing: boolean };

const plain =
  (name: string): RichTag =>
  (children) =>
    createElement(name, null, children);

const DEFAULT_TAGS: RichTags = { b: plain('b'), strong: plain('strong'), em: plain('em'), i: plain('i'), br: () => createElement('br') };

const TAG = /<(\/?)([a-zA-Z][\w-]*)\s*(\/?)>/g;

interface Open {
  tag: string;
  source: string;
  parts: RichPart[];
}

const pushText = (parts: RichPart[], text: string): void => {
  if (text === '') return;
  const last = parts[parts.length - 1];
  if (typeof last === 'string') parts[parts.length - 1] = last + text;
  else parts.push(text);
};

/**
 * Découpe une phrase en texte et balises, pur. Une balise fermante sans ouvrante, ou une ouvrante jamais fermée, reste
 * du texte, son contenu gardé à sa place.
 */
export const parseRich = (text: string): RichPart[] => {
  const root: Open = { tag: '', source: '', parts: [] };
  const stack: Open[] = [root];
  let from = 0;
  for (const m of text.matchAll(TAG)) {
    const top = stack[stack.length - 1];
    pushText(top.parts, text.slice(from, m.index));
    from = m.index + m[0].length;
    const [source, closing, tag, selfClosing] = m;
    if (closing === '' && selfClosing === '/') top.parts.push({ tag, children: [], selfClosing: true });
    else if (closing === '') stack.push({ tag, source, parts: [] });
    else if (stack.length > 1 && top.tag === tag) {
      stack.pop();
      stack[stack.length - 1].parts.push({ tag, children: top.parts, selfClosing: false });
    } else pushText(top.parts, source);
  }
  pushText(stack[stack.length - 1].parts, text.slice(from));
  // Ouvrantes jamais fermées : leur texte reprend sa place, suivi de leur contenu.
  while (stack.length > 1) {
    const open = stack.pop() as Open;
    const parent = stack[stack.length - 1].parts;
    pushText(parent, open.source);
    for (const part of open.parts) {
      if (typeof part === 'string') pushText(parent, part);
      else parent.push(part);
    }
  }
  return root.parts;
};

/** Remplace les `{nom}` d'un texte : les morceaux qui suivent, textes voisins réunis. */
const fillText = (text: string, vars: RichVars | undefined, out: ReactNode[]): void => {
  const pushString = (s: string) => {
    if (s === '') return;
    if (typeof out[out.length - 1] === 'string') out[out.length - 1] = (out[out.length - 1] as string) + s;
    else out.push(s);
  };
  let from = 0;
  for (const m of text.matchAll(/\{(\w+)\}/g)) {
    const value = m[1] === 'ctx' || vars === undefined ? undefined : vars[m[1]];
    if (value === undefined) continue;
    pushString(text.slice(from, m.index));
    from = m.index + m[0].length;
    if (typeof value === 'string' || typeof value === 'number') pushString(String(value));
    else out.push(value);
  }
  pushString(text.slice(from));
};

const renderParts = (parts: readonly RichPart[], vars: RichVars | undefined, tags: RichTags): ReactNode[] => {
  const out: ReactNode[] = [];
  for (const part of parts) {
    if (typeof part === 'string') {
      fillText(part, vars, out);
      continue;
    }
    const render = tags[part.tag] ?? DEFAULT_TAGS[part.tag];
    const inner = renderParts(part.children, vars, tags);
    const children = part.selfClosing ? null : inner.length === 1 ? inner[0] : createElement(Fragment, null, ...inner);
    // Balise inconnue : son contenu seul, plutôt qu'une phrase cassée.
    out.push(render ? render(children) : children);
  }
  return out;
};

/** Phrase traduite à balises, rendue en éléments (voir l'en-tête). La clé est toujours un littéral, comme pour `t`. */
export const tRich = (key: string, vars?: RichVars, tags: RichTags = {}): ReactNode => {
  const text = t(key, vars?.ctx === undefined ? undefined : { ctx: vars.ctx });
  return createElement(Fragment, null, ...renderParts(parseRich(text), vars, tags));
};
