// Standalone worker process — runs BullMQ scan workers
import 'dotenv/config';
import { startScanWorker } from './queue/scanQueue.js';
import { startMonitoringScheduler } from './scheduler.js';
import { initDB } from './models/db.js';

await initDB();
const scanWorker = startScanWorker();
const monitoringWorker = await startMonitoringScheduler();
console.log('Worker process started');

async function shutdown(signal) {
  console.log(`${signal} received, shutting down workers gracefully...`);
  await scanWorker.close();
  await monitoringWorker.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
