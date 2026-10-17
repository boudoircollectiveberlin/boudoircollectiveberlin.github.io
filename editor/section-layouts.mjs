const eyebrow = text => ({ tag: 'p', className: 'eyebrow', resource: 'eyebrow', text });
const heading = (level, resource, text) => ({ tag: `h${level}`, resource, text });
const paragraph = (resource, text) => ({ tag: 'p', resource, text });
const field = (tag, resource, text) => ({ tag, resource, text });
const card = index => ({
  tag: 'article',
  className: 'bcb-layout-grid__card',
  children: [
    heading(3, `card${index}Title`, `Kachel ${index}`),
    paragraph(`card${index}Copy`, 'Kurze Beschreibung'),
  ],
});

export const sectionLayouts = Object.freeze([
  {
    id: 'editorial-section',
    label: 'Inhaltsabschnitt · zweispaltig',
    root: {
      tag: 'section',
      className: 'section-band bcb-layout bcb-layout--editorial',
      layout: 'editorial-section',
      children: [
        {
          tag: 'div',
          className: 'section__heading',
          children: [
            eyebrow('Neuer Abschnitt'),
            heading(2, 'heading', 'Neue Überschrift'),
            paragraph('copy', 'Kurzer einleitender Text'),
          ],
        },
        {
          tag: 'div',
          className: 'section__heading',
          children: [
            heading(3, 'detailHeading', 'Weiterführende Überschrift'),
            paragraph('detailCopy', 'Ergänzender Abschnittstext'),
          ],
        },
      ],
    },
  },
  {
    id: 'feature-grid',
    label: 'Inhaltsabschnitt · drei Kacheln',
    root: {
      tag: 'section',
      className: 'section bcb-layout bcb-layout--grid',
      layout: 'feature-grid',
      children: [
        {
          tag: 'div',
          className: 'section__heading',
          children: [
            eyebrow('Neuer Abschnitt'),
            heading(2, 'heading', 'Neue Überschrift'),
            paragraph('copy', 'Kurzer einleitender Text'),
          ],
        },
        {
          tag: 'div',
          className: 'bcb-layout-grid__items',
          children: [card(1), card(2), card(3)],
        },
      ],
    },
  },
  {
    id: 'statement-section',
    label: 'Inhaltsabschnitt · Statement',
    root: {
      tag: 'section',
      className: 'section-band bcb-layout bcb-layout--statement',
      layout: 'statement-section',
      children: [
        {
          tag: 'div',
          className: 'section__heading',
          children: [
            eyebrow('Neuer Abschnitt'),
            heading(2, 'heading', 'Neue Überschrift'),
          ],
        },
        {
          tag: 'div',
          className: 'cta-panel',
          children: [field('p', 'copy', 'Ein prägnanter Gedanke')],
        },
      ],
    },
  },
]);

const allowedTags = new Set(['section', 'div', 'article', 'p', 'h2', 'h3']);
const resourcePattern = /^[a-z][A-Za-z0-9]*$/;

export function validateSectionLayouts(layouts = sectionLayouts) {
  if (!Array.isArray(layouts) || !layouts.length) throw new Error('Mindestens ein Abschnittslayout ist erforderlich.');
  const ids = new Set();
  for (const layout of layouts) {
    if (!layout || !/^[a-z][a-z0-9-]*$/.test(layout.id) || ids.has(layout.id) ||
      typeof layout.label !== 'string' || !layout.label.trim()) throw new Error('Ungültige oder doppelte Abschnittsdefinition.');
    ids.add(layout.id);
    const resources = new Set();
    function visit(node, root = false) {
      if (!node || !allowedTags.has(node.tag) ||
        (node.className !== undefined && (typeof node.className !== 'string' || !node.className.trim())) ||
        (root && (node.tag !== 'section' || node.layout !== layout.id || !node.className?.trim())) ||
        (!root && node.layout !== undefined)) throw new Error(`Ungültiger Abschnittsaufbau: ${layout.id}`);
      if (node.resource !== undefined) {
        if (!resourcePattern.test(node.resource) || resources.has(node.resource) ||
          typeof node.text !== 'string' || !node.text.trim()) throw new Error(`Ungültiges Textfeld in ${layout.id}.`);
        resources.add(node.resource);
      } else if (node.text !== undefined) throw new Error(`Nicht gebundenes Textfeld in ${layout.id}.`);
      if (node.children !== undefined && (!Array.isArray(node.children) || !node.children.length))
        throw new Error(`Leerer Teilaufbau in ${layout.id}.`);
      for (const child of node.children || []) visit(child);
    }
    visit(layout.root, true);
    if (!resources.has('heading')) throw new Error(`Abschnitt ${layout.id} benötigt eine Überschrift.`);
  }
  return true;
}

export function validateSectionLayoutMarkers(html) {
  const layouts = new Set(sectionLayouts.map(layout => layout.id));
  const tags = /<([a-z][a-z0-9-]*)\b[^>]*>/gi;
  let match;
  while ((match = tags.exec(html))) {
    const marker = /\bdata-bcb-layout\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(match[0]);
    if (!marker) continue;
    const layout = marker[1] ?? marker[2] ?? marker[3];
    const component = /\bdata-bcb-component\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(match[0]);
    const componentId = component?.[1] ?? component?.[2] ?? component?.[3];
    if (match[1].toLowerCase() !== 'section' || !layouts.has(layout) || componentId !== layout)
      throw new Error('Unbekanntes oder ungültiges BCB-Abschnittslayout.');
  }
  return html;
}

validateSectionLayouts();
