import { checkOperationalHealth } from '../server/operations/monitor.mjs';

try {
  const report = await checkOperationalHealth({
    url: process.env.OPERATIONAL_MONITOR_URL ?? 'https://korattanphai.vercel.app',
    healthToken: process.env.OPERATIONAL_HEALTH_TOKEN,
    readiness: process.env.OPERATIONAL_CHECK_READINESS === 'true',
  });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'passed' ? 0 : 1;
} catch {
  console.error(JSON.stringify({ status: 'failed', code: 'monitor_configuration_invalid' }));
  process.exitCode = 1;
}
