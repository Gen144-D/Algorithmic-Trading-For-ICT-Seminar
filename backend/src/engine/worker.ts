// Standalone trading-engine worker entrypoint.
// Run via `npm run engine` or as the `engine` service in docker-compose.
// Publishes engine events over the bus (Redis) for the API server to fan out.

import 'dotenv/config';
import { runForever } from '../modules/engine/runner';
import { createBus } from '../modules/bus';

(async () => {
  const bus = createBus();
  const interval = Number(process.env.ENGINE_INTERVAL_MS || 15000);
  await runForever(interval);
  process.on('SIGTERM', async () => {
    await bus.disconnect();
    process.exit(0);
  });
})();
