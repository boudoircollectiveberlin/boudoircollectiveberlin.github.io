export function readMetadata(source) {
  const match = /const meta = (\{[\s\S]*?\n\});/.exec(source);
  if (!match) throw new Error('Seitenmetadaten nicht gefunden.');
  const meta = JSON.parse(match[1]);
  const decode = value => value.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  return { title: decode(meta.head.find(line => line.startsWith('<title>'))?.slice(7,-8) || ''), description: decode(/content="([^"]*)"/.exec(meta.head.find(line => line.startsWith('<meta name="description"')) || '')?.[1] || '') };
}

export function replaceMetadata(source, values) {
  if (!values || ['title','description'].some(key => typeof values[key] !== 'string' || values[key].length > 2000 || /[\u0000-\u001f]/.test(values[key])) || !values.title.trim()) throw new Error('Ungültige Metadaten.');
  readMetadata(source);
  const match = /const meta = (\{[\s\S]*?\n\});/.exec(source);
  const meta = JSON.parse(match[1]);
  const escape = value => value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  meta.head = meta.head.filter(line => !line.startsWith('<title>') && !line.startsWith('<meta name="description"'));
  meta.head.unshift(`<title>${escape(values.title)}</title>`, `<meta name="description" content="${escape(values.description)}">`);
  const json = JSON.stringify(meta,null,2).replace(/</g,'\\u003c').replace(/>/g,'\\u003e');
  return source.slice(0,match.index) + `const meta = ${json};` + source.slice(match.index+match[0].length);
}
