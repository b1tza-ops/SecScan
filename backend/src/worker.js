// Standalone worker process — runs BullMQ scan workers
import 'dotenv/config';
import { startScanWorker } from './queue/scanQueue.js';
import { initDB } from './models/db.js';

await initDB();
startScanWorker();
console.log('Worker process started');
