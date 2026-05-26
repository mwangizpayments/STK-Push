import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminDashboard } from '@/components/AdminDashboard';
import { CashierDashboard } from '@/components/CashierDashboard';
import { LoginScreen } from '@/components/LoginScreen';
import { Sidebar } from '@/components/Sidebar';
import { api } from '@/lib/apiClient';
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient';

export default function App() {
  const [activeView, setActiveView] = useState('cashier');
  const [isBooting, setIsBooting] = useState(true);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [transactions, setTransactions] = useState([]);

  const isAdmin = profile?.role === 'admin';

  const hydrateProfile = useCallback(async (activeSession) => {
    if (!activeSession?.user) {
      setProfile(null);
      return;
    }

    const user = activeSession.user;
    let profileData = null;

    if (supabase) {
      const { data } = await supabase
        .from('users')
        .select('role, branch_id')
        .eq('id', user.id)
        .maybeSingle();
      profileData = data;
    }

    setProfile({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || '',
      role: profileData?.role || user.app_metadata?.role || user.user_metadata?.role || 'cashier',
      branch_id: profileData?.branch_id || user.user_metadata?.branch_id || ''
    });
  }, []);

  const refreshTransactions = useCallback(async () => {
    if (!session || !profile) {
      return;
    }

    const params = {};
    if (profile.role !== 'admin' && profile.branch_id) {
      params.branch_id = profile.branch_id;
    }

    const { data } = await api.get('/api/transactions', { params });
    setTransactions(data.transactions || []);
  }, [profile, session]);

  const handleSessionReady = useCallback(
    async (nextSession) => {
      setSession(nextSession);
      await hydrateProfile(nextSession);
    },
    [hydrateProfile]
  );

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setIsBooting(false);
      return undefined;
    }

    let isMounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      await hydrateProfile(data.session);
      setIsBooting(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      await hydrateProfile(nextSession);
      if (!nextSession) {
        setTransactions([]);
        setActiveView('cashier');
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [hydrateProfile]);

  useEffect(() => {
    if (!session || !profile) {
      return undefined;
    }

    refreshTransactions().catch(() => {});
    const interval = window.setInterval(() => {
      refreshTransactions().catch(() => {});
    }, 4000);

    return () => window.clearInterval(interval);
  }, [profile, refreshTransactions, session]);

  const visibleTransactions = useMemo(() => transactions.slice(0, 10), [transactions]);

  async function handleLogout() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setProfile(null);
    setTransactions([]);
  }

  if (isBooting) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm">
          Loading session...
        </div>
      </main>
    );
  }

  if (!session) {
    return <LoginScreen onSession={handleSessionReady} />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        activeView={activeView}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        onViewChange={setActiveView}
        profile={profile}
        transactions={visibleTransactions}
      />

      {activeView === 'admin' && isAdmin ? (
        <AdminDashboard />
      ) : (
        <CashierDashboard
          onRefreshTransactions={refreshTransactions}
          profile={profile}
          transactions={transactions}
        />
      )}
    </div>
  );
}
