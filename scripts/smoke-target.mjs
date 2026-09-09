export function validateSmokeTarget(value, allowedPreviewOrigins = '') {
  const base = new URL(value);
  const local = ['localhost', '127.0.0.1'].includes(base.hostname);
  const previews = allowedPreviewOrigins.split(',').map(item => item.trim()).filter(Boolean);
  for (const origin of previews) {
    const candidate = new URL(origin);
    if (candidate.origin !== origin || candidate.protocol !== 'https:' || !candidate.hostname.endsWith('.vercel.app') || candidate.port || candidate.username || candidate.password) throw new Error('Invalid explicit preview origin');
  }
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/' || !(local && ['http:', 'https:'].includes(base.protocol) || base.origin === 'https://korattanphai.vercel.app' || previews.includes(base.origin))) throw new Error('Smoke requires the exact production origin, localhost, or an explicitly verified preview origin');
  return base;
}
