import { env } from '../config/env.js';
import { listReprocessableCallbackEvents } from './callbackEventRepository.js';
import { processCallbackEvent } from './callbackProcessor.js';
import { markTimedOutTransactions } from './transactionRepository.js';

let reconciliationTimer = null;
let reconciliationRunning = false;

export function startReconciliationWorker() {
  if (!env.reconciliation.enabled || reconciliationTimer) {
    return null;
  }

  reconciliationTimer = setInterval(() => {
    runReconciliationPass().catch((error) => {
      console.error(`Reconciliation pass failed: ${error.message}`);
    });
  }, env.reconciliation.intervalMs);

  reconciliationTimer.unref?.();

  runReconciliationPass().catch((error) => {
    console.error(`Initial reconciliation pass failed: ${error.message}`);
  });

  return reconciliationTimer;
}

export async function stopReconciliationWorker() {
  if (reconciliationTimer) {
    clearInterval(reconciliationTimer);
    reconciliationTimer = null;
  }
}

export async function runReconciliationPass() {
  if (reconciliationRunning) {
    return {
      callback_events_processed: 0,
      skipped: true
    };
  }

  reconciliationRunning = true;

  try {
    await markTimedOutTransactions();

    const events = await listReprocessableCallbackEvents({
      limit: env.reconciliation.callbackBatchSize,
      maxAttempts: env.reconciliation.callbackMaxAttempts
    });

    let processed = 0;

    for (const event of events) {
      await processCallbackEvent(event);
      processed += 1;
    }

    return {
      callback_events_processed: processed,
      skipped: false
    };
  } finally {
    reconciliationRunning = false;
  }
}

