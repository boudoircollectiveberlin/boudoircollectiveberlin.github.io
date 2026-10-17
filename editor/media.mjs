import path from 'node:path';
import { realpath, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

export async function prepareMedia(root, source) {
  if (typeof source !== 'string' || !/^assets\/.+\.(jpe?g|png|webp|avif)$/i.test(source))
    throw new Error('Bitte ein Rasterbild aus der Mediathek wählen.');
  const directory = await realpath(path.join(root, 'assets'));
  const file = await realpath(path.resolve(root, source));
  if (!file.startsWith(directory + path.sep)) throw new Error('Ungültiger Bildpfad.');
  const output = path.join(directory, 'editor-webp');
  await mkdir(output, { recursive: true });
  if (await realpath(output) !== output) throw new Error('Verknüpfter Ausgabeordner ist nicht erlaubt.');
  const buffer = await sharp(file, { limitInputPixels: 80000000 }).rotate().resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const name = createHash('sha256').update(buffer).digest('hex').slice(0,24) + '.webp';
  // Exclusive creation keeps existing assets and original sources intact.
  const { writeFile } = await import('node:fs/promises');
  try { await writeFile(path.join(output,name),buffer,{flag:'wx'}); }
  catch(error) { if(error.code !== 'EEXIST') throw error; }
  await mkdir(path.join(root,'public/assets/editor-webp'),{recursive:true});
  await copyFile(path.join(output,name),path.join(root,'public/assets/editor-webp',name));
  return { src: 'assets/editor-webp/' + name };
}
