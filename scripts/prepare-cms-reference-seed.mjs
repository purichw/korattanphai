import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CMS_RESOURCES, resourceSourcePath } from '../shared/cmsResources.mjs';

const titles = {
  admin_hierarchy: 'ทะเบียนจังหวัด อำเภอ และตำบล',
  'forecast-archive-summary': 'สรุปชุดพยากรณ์ที่เผยแพร่',
  'nakhon-ratchasima-subdistricts': 'ขอบเขตตำบลนครราชสีมา', 'nakhon-ratchasima-boundary': 'ขอบเขตจังหวัดนครราชสีมา',
  'thailand-adm1': 'ขอบเขตจังหวัดสำหรับแผนที่บริบท',
};
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
export async function prepareReferenceSeed(root = process.cwd()) {
  const resources = [];
  for (const resource of CMS_RESOURCES) {
    const path = resourceSourcePath(resource);
    const bytes = await readFile(resolve(root, path));
    const payload = JSON.parse(bytes.toString('utf8'));
    const hash = createHash('sha256').update(bytes).digest('hex');
    const title = titles[resource.key.split('/').pop()] ?? resource.key.split('/').pop().replaceAll('_', ' ');
    resources.push({ ...resource, path, title, payload, hash, bytes: bytes.length });
  }
  const sql = ['-- PREPARED ONLY: explicit production approval required.', 'begin;'];
  for (const resource of resources) {
    sql.push(`do $seed$ begin
      if exists(select 1 from public.ktp_cms_resources where resource_key=${literal(resource.key)} and original_sha256 is distinct from ${literal(resource.hash)}) then
        raise exception 'Reference already exists with a different revision: %', ${literal(resource.key)};
      end if;
      insert into public.ktp_cms_resources(resource_key,title,resource_group,payload,original_sha256,state,published_at,reason)
      select ${literal(resource.key)},${literal(resource.title)},${literal(resource.group)},${literal(JSON.stringify(resource.payload))}::jsonb,${literal(resource.hash)},'published',clock_timestamp(),'Approved initial migration; original file retained'
      where not exists(select 1 from public.ktp_cms_resources where resource_key=${literal(resource.key)});
    end $seed$;`);
  }
  sql.push('commit;');
  return { resources, sql: sql.join('\n') };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length > 2) throw new Error('No execution or destination arguments accepted. This command only prepares local files.');
  const prepared = await prepareReferenceSeed();
  const output = resolve('artifacts/admin-cms-20260927/migration');
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'reference-seed.sql'), prepared.sql);
  await writeFile(resolve(output, 'reference-inventory.json'), JSON.stringify({ productionApplied: false,
    resources: prepared.resources.map(({ payload: _payload, ...item }) => item) }, null, 2));
  console.log(JSON.stringify({ prepared: prepared.resources.length, output, productionApplied: false }));
}
