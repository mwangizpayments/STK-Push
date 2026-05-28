import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminDashboard } from '@/components/AdminDashboard';
import { CashierDashboard } from '@/components/CashierDashboard';
import { CashierModeModal } from '@/components/CashierModeModal';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { LoginScreen } from '@/components/LoginScreen';
import { OfflineBadge } from '@/components/OfflineBadge';
import { PendingStateIndicator } from '@/components/PendingStateIndicator';
import { Button } from '@/components/ui/button';
import { API_BASE_URL, normalizeUuid } from '@/config/app';
import { appName } from '@/config/branding';
import {
  CASHIER_MODES,
  hasStoredCashierMode,
  loadCashierMode,
  saveCashierMode
} from '@/config/cashierMode';
import { api } from '@/lib/apiClient';
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient';

const activeTransactionStatuses = ['created', 'pending', 'pending_pin', 'processing'];
const PUBLIC_BOOT_STATUS = 'Starting app...';
const PUBLIC_READY_STATUS = 'App ready.';

export default function App() {
  const [isBooting, setIsBooting] = useState(true);
  const [bootStatus, setBootStatus] = useState(PUBLIC_BOOT_STATUS);
  const [bootError, setBootError] = useState('');
  const [cashierMode, setCashierMode] = useState(CASHIER_MODES.SIMPLE);
  const [showCashierModeModal, setShowCashierModeModal] = useState(false);
  const [isOffline, setIsOffline] = useState(() => !window.navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [updateState, setUpdateState] = useState({ status: 'idle' });

  const profileRef = useRef(null);
  const promptCashierModeOnNextSessionRef = useRef(false);
  const isAdmin = profile?.role === 'admin';

  const setStartupMessage = useCallback((message) => {
    setBootStatus(message);
    window.mpesaDesktop?.setBootStatus?.(message).catch(() => {});
  }, []);

  const notifyBootReady = useCallback((status = 'Terminal ready.') => {
    window.mpesaDesktop?.bootReady?.({ status });
  }, []);

  const hydrateProfile = useCallback(async (activeSession) => {
    if (!activeSession?.user) {
      profileRef.current = null;
      setProfile(null);
      return null;
    }

    const user = activeSession.user;
    let profileData = null;

    if (supabase) {
      try {
        const { data, error } = await withTimeout(
          supabase.from('users').select('role, branch_id').eq('id', user.id).maybeSingle(),
          7000,
          'Profile lookup timed out'
        );

        if (error) {
          console.warn(`Profile lookup failed: ${error.message}`);
        }

        profileData = data;
      } catch (error) {
        console.warn(`Profile lookup failed: ${error.message}`);
      }
    }

    const currentProfile = profileRef.current;
    const sameUser = currentProfile?.id === user.id;
    const metadataRole = user.app_metadata?.role || user.user_metadata?.role || '';
    const role = profileData?.role || metadataRole || (sameUser ? currentProfile.role : 'cashier');
    const branchId = normalizeUuid(
      profileData?.branch_id || user.user_metadata?.branch_id || (sameUser ? currentProfile.branch_id : '')
    );
    const nextProfile = {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || currentProfile?.full_name || '',
      role,
      branch_id: branchId
    };

    profileRef.current = nextProfile;
    setProfile(nextProfile);
    return nextProfile;
  }, []);

  const applyCashierModeForProfile = useCallback((nextProfile, { forcePrompt = false } = {}) => {
    if (nextProfile?.role !== 'cashier') {
      setShowCashierModeModal(false);
      return;
    }

    const storedMode = loadCashierMode(nextProfile.id);
    const mode = storedMode || CASHIER_MODES.SIMPLE;
    setCashierMode(mode);
    setShowCashierModeModal(forcePrompt || !hasStoredCashierMode(nextProfile.id));
  }, []);

  const runStartupChecks = useCallback(
    async ({ activeProfile, activeSession } = {}) => {
      const showDetailedStatus = Boolean(activeSession && activeProfile);

      if (showDetailedStatus) {
        setStartupMessage('Connecting services...');
      }

      const backendOnline = await checkBackendConnectivity();
      setIsOffline(!backendOnline);

      if (!activeSession || !activeProfile) {
        return;
      }

      if (activeProfile.role === 'cashier') {
        if (showDetailedStatus) {
          setStartupMessage('Loading cashier dashboard...');
        }

        cacheBranchConfig(activeProfile);

        if (showDetailedStatus) {
          setStartupMessage('Syncing pending transactions...');
        }

        try {
          const params = { limit: 100 };
          if (activeProfile.branch_id) {
            params.branch_id = activeProfile.branch_id;
          }

          const { data } = await api.get('/api/transactions', { params });
          const nextTransactions = data.transactions || [];
          setTransactions(nextTransactions);
          setPendingSyncCount(countPendingTransactions(nextTransactions));
        } catch (error) {
          console.warn(`Pending transaction check failed: ${error.message}`);
          setIsOffline(true);
        }
      }
    },
    [setStartupMessage]
  );

  const refreshTransactions = useCallback(async () => {
    if (!session || !profile) {
      return;
    }

    const params = { limit: 100 };
    if (profile.role !== 'admin' && profile.branch_id) {
      params.branch_id = profile.branch_id;
    }

    const { data } = await api.get('/api/transactions', { params });
    const nextTransactions = data.transactions || [];
    setTransactions(nextTransactions);
    setPendingSyncCount(countPendingTransactions(nextTransactions));
  }, [profile, session]);

  const handleSessionReady = useCallback(
    async (nextSession) => {
      promptCashierModeOnNextSessionRef.current = true;
      setSession(nextSession);
      setBootError('');
      const nextProfile = await hydrateProfile(nextSession);
      applyCashierModeForProfile(nextProfile, { forcePrompt: true });
      promptCashierModeOnNextSessionRef.current = false;
      await runStartupChecks({ activeProfile: nextProfile, activeSession: nextSession });
    },
    [applyCashierModeForProfile, hydrateProfile, runStartupChecks]
  );

  useEffect(() => {
    document.title = appName;
  }, []);

  useEffect(() => {
    let cleanupUpdateListener = () => {};

    window.mpesaDesktop?.getUpdateState?.().then(setUpdateState).catch(() => {});
    cleanupUpdateListener = window.mpesaDesktop?.onUpdateState?.(setUpdateState) || cleanupUpdateListener;

    return () => cleanupUpdateListener();
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      runStartupChecks().finally(() => {
        notifyBootReady(PUBLIC_READY_STATUS);
      });
      setIsBooting(false);
      return undefined;
    }

    let isMounted = true;
    let restoredSession = null;

    setStartupMessage('Loading assets...');
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!isMounted) {
          return;
        }

        restoredSession = data.session;
        setSession(restoredSession);

        if (restoredSession) {
          setStartupMessage('Restoring session...');
        }

        const nextProfile = await hydrateProfile(restoredSession);
        applyCashierModeForProfile(nextProfile);
        await runStartupChecks({ activeProfile: nextProfile, activeSession: restoredSession });
      })
      .catch((error) => {
        console.warn(`Session restore failed: ${error.message}`);
        setBootError('Could not restore the saved session. Sign in again.');
        setSession(null);
        profileRef.current = null;
        setProfile(null);
      })
      .finally(() => {
        if (isMounted) {
          notifyBootReady(restoredSession ? 'Terminal ready.' : PUBLIC_READY_STATUS);
          setIsBooting(false);
        }
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      setSession(nextSession);
      setBootError('');
      const nextProfile = await hydrateProfile(nextSession);
      applyCashierModeForProfile(nextProfile, {
        forcePrompt: event === 'SIGNED_IN' || promptCashierModeOnNextSessionRef.current
      });
      promptCashierModeOnNextSessionRef.current = false;
      if (!nextSession) {
        setTransactions([]);
        setPendingSyncCount(0);
        setShowCashierModeModal(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [applyCashierModeForProfile, hydrateProfile, notifyBootReady, runStartupChecks, setStartupMessage]);

  useEffect(() => {
    if (!session || !profile) {
      return undefined;
    }

    if (profile.role === 'admin') {
      return undefined;
    }

    refreshTransactions().catch(() => {});
    const interval = window.setInterval(() => {
      refreshTransactions().catch(() => {});
    }, 4000);

    return () => window.clearInterval(interval);
  }, [profile, refreshTransactions, session]);

  useEffect(() => {
    let isMounted = true;

    async function updateConnectivity() {
      if (!window.navigator.onLine) {
        if (isMounted) {
          setIsOffline(true);
        }
        return;
      }

      const backendOnline = await checkBackendConnectivity();
      if (isMounted) {
        setIsOffline(!backendOnline);
      }
    }

    window.addEventListener('online', updateConnectivity);
    window.addEventListener('offline', updateConnectivity);
    const interval = window.setInterval(updateConnectivity, 30000);

    return () => {
      isMounted = false;
      window.removeEventListener('online', updateConnectivity);
      window.removeEventListener('offline', updateConnectivity);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    window.mpesaDesktop?.configureTerminal?.({
      cashierMode,
      role: profile?.role || ''
    }).catch(() => {});
  }, [cashierMode, profile?.role]);

  const handleCashierModeChange = useCallback(
    (nextMode) => {
      const savedMode = saveCashierMode(profile?.id, nextMode);
      setCashierMode(savedMode);
      setShowCashierModeModal(false);
      window.mpesaDesktop?.configureTerminal?.({
        cashierMode: savedMode,
        role: profile?.role || ''
      }).catch(() => {});
    },
    [profile?.id, profile?.role]
  );

  async function handleLogout() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    profileRef.current = null;
    setProfile(null);
    setTransactions([]);
    setPendingSyncCount(0);
    setShowCashierModeModal(false);
  }

  if (isBooting) {
    return (
      <>
        <LoadingOverlay message={bootStatus} />
        <UpdateToast updateState={updateState} />
      </>
    );
  }

  if (!session) {
    return (
      <>
        <OfflineBadge isOffline={isOffline} />
        <LoginScreen onSession={handleSessionReady} bootError={bootError} />
        <UpdateToast updateState={updateState} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <OfflineBadge isOffline={isOffline} />
      <PendingStateIndicator count={pendingSyncCount} />
      {isAdmin ? (
        <AdminDashboard onLogout={handleLogout} profile={profile} />
      ) : (
        <CashierDashboard
          cashierMode={cashierMode}
          onCashierModeChange={handleCashierModeChange}
          onRefreshTransactions={refreshTransactions}
          onLogout={handleLogout}
          profile={profile}
          transactions={transactions}
        />
      )}
      {!isAdmin && showCashierModeModal ? (
        <CashierModeModal currentMode={cashierMode} onSelect={handleCashierModeChange} />
      ) : null}
      <UpdateToast updateState={updateState} />
    </div>
  );
}

function UpdateToast({ updateState }) {
  if (updateState?.status !== 'downloaded') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-[90] w-[min(calc(100vw-2rem),360px)] rounded-lg border bg-card p-4 text-card-foreground shadow-xl">
      <p className="text-sm font-semibold">Update available - restart to install</p>
      {updateState.updateVersion ? (
        <p className="mt-1 text-xs text-muted-foreground">Version {updateState.updateVersion} has been downloaded.</p>
      ) : null}
      <Button
        className="mt-3 h-9"
        type="button"
        onClick={() => window.mpesaDesktop?.restartAndInstallUpdate?.().catch(() => {})}
      >
        Restart & Update
      </Button>
    </div>
  );
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}

async function checkBackendConnectivity() {
  if (!window.navigator.onLine) {
    return false;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      cache: 'no-store',
      signal: controller.signal
    });
    return response.ok;
  } catch (_error) {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

function cacheBranchConfig(profile) {
  if (!profile?.id || !profile.branch_id) {
    return;
  }

  try {
    localStorage.setItem(
      `mpesa:branch-cache:${profile.id}`,
      JSON.stringify({
        branch_id: profile.branch_id,
        cached_at: new Date().toISOString()
      })
    );
  } catch (_error) {
    // Startup should continue even if local storage is not writable.
  }
}

function countPendingTransactions(items = []) {
  return items.filter((item) => activeTransactionStatuses.includes(item.status)).length;
}
