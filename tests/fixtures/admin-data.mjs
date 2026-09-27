// Isolated browser-test database. Never import from application/server runtime.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createCmsHandler } from '../../server/admin-data/handler.mjs';
import { authTestUser } from './supabase.mjs';
import { prepareCmsForecastSchema, seedCmsForecast } from './cms-forecast.mjs';
import { prepareReferenceSeed } from '../../scripts/prepare-cms-reference-seed.mjs';

export async function cmsTestDatabase(context, { forecasts = false, references = false } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${authTestUser.id}');`);
  if (forecasts) await prepareCmsForecastSchema(db);
  else await db.exec(`create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  for (const file of ['20260909010000_model_input_batches.sql', '20260927010000_cms_data_drafts.sql']) {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  if (forecasts) {
    await db.exec(await readFile(new URL('../../supabase/migrations/20260927020000_cms_forecast_review.sql', import.meta.url), 'utf8'));
    await seedCmsForecast(db);
  }
  await db.exec(await readFile(new URL('../../supabase/migrations/20260927030000_cms_reference_resources.sql', import.meta.url), 'utf8'));
  if (references) await db.exec((await prepareReferenceSeed()).sql);
  if (references) await context.route('https://ktp-auth-test.supabase.co/rest/v1/rpc/ktp_cms_reference_*', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    const result = await db.transaction(async tx => {
      await tx.exec(`set local role authenticated;select set_config('request.jwt.claim.sub','${authTestUser.id}',true)`);
      if (name === 'ktp_cms_reference_catalog') return (await tx.query('select public.ktp_cms_reference_catalog() result')).rows[0].result;
      if (name === 'ktp_cms_reference_read') return (await tx.query('select public.ktp_cms_reference_read($1) result', [route.request().postDataJSON().p_id])).rows[0].result;
      if (name === 'ktp_cms_reference_bundle') return (await tx.query('select public.ktp_cms_reference_bundle($1::uuid[]) result', [route.request().postDataJSON().p_ids])).rows[0].result;
      throw new Error('Unexpected CMS RPC');
    });
    await route.fulfill({ json: result });
  });
  await db.exec('set role service_role');
  const operation = async (actor, operation, args) => {
    try {
      if (!forecasts && operation === 'forecast:catalog') return { revision: null, periods: [] };
      const forecast = operation.startsWith('forecast:');
      const resource = operation.startsWith('resource:');
      return (await db.query(`select public.${resource ? 'ktp_cms_resource_operation' : forecast ? 'ktp_cms_forecast' : 'ktp_cms_operation'}($1::uuid,$2::text,$3::jsonb) result`,
        [actor, resource ? operation.slice(9) : forecast ? operation.slice('forecast:'.length) : operation, JSON.stringify(args)])).rows[0].result;
    } catch (error) {
      if (error.code === '40001') { error.status = 409; error.code = 'revision_conflict'; }
      throw error;
    }
  };
  const server = createServer(createCmsHandler({
    authenticate: async token => token.endsWith('.test-signature') ? authTestUser.id : null, operation,
  }));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  await context.route('**/api/admin-data**', async route => {
    const request = route.request(); const original = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(original.hostname)) throw new Error('CMS test must stay local');
    const response = await fetch(`http://127.0.0.1:${server.address().port}${original.pathname}${original.search}`, {
      method: request.method(), headers: { authorization: request.headers().authorization ?? '', 'content-type': 'application/json' },
      ...(request.postData() ? { body: request.postData() } : {}),
    });
    await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
  });
  return {
    db, operation: (action, args) => operation(authTestUser.id, action, args),
    async close() {
      try { await context.unroute('**/api/admin-data**'); if (references) await context.unroute('https://ktp-auth-test.supabase.co/rest/v1/rpc/ktp_cms_reference_*'); }
      finally { server.close(); await once(server, 'close'); await db.close(); }
    },
  };
}
