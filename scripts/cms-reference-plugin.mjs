import { resolve, dirname } from 'node:path';
import { CMS_RESOURCES, resourceSourcePath } from '../shared/cmsResources.mjs';
import { readdir, readFile } from 'node:fs/promises';

export function cmsReferencePlugin(root) {
  const sources = new Map(CMS_RESOURCES.filter(resource => resource.preload).map(resource => [resolve(root, resourceSourcePath(resource)), resource.key]));
  const prefix = '\0cms-reference:';
  return {
    name: 'cms-reference-readers', enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || source.includes('?') || !source.startsWith('.')) return;
      const file = resolve(dirname(importer), source);
      if (sources.has(file)) return prefix + sources.get(file);
      if (/\/data\/(canonical|generated)\/.*\.json$/.test(file)) throw new Error(`Unregistered CMS business resource: ${file}`);
    },
    load(id) {
      if (!id.startsWith(prefix)) return;
      return `import { readCmsResource } from ${JSON.stringify(resolve(root, 'src/data/cmsReferences.ts'))}; export default readCmsResource(${JSON.stringify(id.slice(prefix.length))});`;
    },
    async generateBundle() {
      // CMS geometry is not also shipped as a stale public-file copy.
      for (const file of await readdir(resolve(root, 'public/brand'), { withFileTypes: true })) {
        if (file.isFile()) this.emitFile({ type: 'asset', fileName: `brand/${file.name}`, source: await readFile(resolve(root, 'public/brand', file.name)) });
      }
      this.emitFile({ type: 'asset', fileName: 'reference-backend.json', source: '{"backend":"cms","fallback":false}' });
    },
  };
}
