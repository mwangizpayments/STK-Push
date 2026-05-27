export const TRANSACTION_STATES = {
  CREATED: 'created',
  PENDING_PIN: 'pending_pin',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled'
};

export const ACTIVE_TRANSACTION_STATES = [
  TRANSACTION_STATES.CREATED,
  TRANSACTION_STATES.PENDING_PIN,
  TRANSACTION_STATES.PROCESSING
];

export const FINAL_TRANSACTION_STATES = [
  TRANSACTION_STATES.SUCCESS,
  TRANSACTION_STATES.FAILED,
  TRANSACTION_STATES.TIMEOUT,
  TRANSACTION_STATES.CANCELLED
];

export const CALLBACK_MUTABLE_STATES = [
  ...ACTIVE_TRANSACTION_STATES,
  TRANSACTION_STATES.TIMEOUT
];

export function isFinalTransactionState(status) {
  return FINAL_TRANSACTION_STATES.includes(status);
}

export function mapDarajaResult({ resultCode }) {
  const code = Number(resultCode);

  if (code === 0) {
    return {
      failureReason: null,
      status: TRANSACTION_STATES.SUCCESS
    };
  }

  const mapped = {
    1: {
      failureReason: 'The customer has insufficient M-Pesa balance.',
      status: TRANSACTION_STATES.FAILED
    },
    17: {
      failureReason: 'M-Pesa could not complete the request. Please retry.',
      status: TRANSACTION_STATES.FAILED
    },
    26: {
      failureReason: 'M-Pesa is busy. Please retry in a moment.',
      status: TRANSACTION_STATES.FAILED
    },
    1032: {
      failureReason: 'The customer cancelled the payment.',
      status: TRANSACTION_STATES.CANCELLED
    },
    1037: {
      failureReason: 'The customer did not respond in time.',
      status: TRANSACTION_STATES.TIMEOUT
    }
  };

  return (
    mapped[code] || {
      failureReason: 'Payment could not be completed. Please retry.',
      status: TRANSACTION_STATES.FAILED
    }
  );
}
