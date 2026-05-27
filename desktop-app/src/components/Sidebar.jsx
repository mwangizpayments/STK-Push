import { useEffect, useState } from 'react';
import { Building2, Clock3, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RecentTransactions } from '@/components/RecentTransactions';

export function Sidebar({
  activeView,
  isAdmin,
  onLogout,
  onViewChange,
  profile,
  transactions
}) {
  const [version, setVersion] = useState('0.1.0');

  useEffect(() => {
    window.mpesaDesktop?.appVersion?.().then(setVersion).catch(() => {});
  }, []);

  return (
    <aside className="flex h-screen w-80 shrink-0 flex-col border-r bg-white">
      <div className="border-b px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">Mwangiz STK</p>
            <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Badge variant={isAdmin ? 'default' : 'secondary'}>{profile?.role || 'cashier'}</Badge>
          {profile?.branch_id ? <Badge variant="outline">Branch {profile.branch_id}</Badge> : null}
        </div>
      </div>

      <nav className="space-y-2 px-3 py-4">
        {isAdmin ? (
          <Button
            className="w-full justify-start"
            variant={activeView === 'admin' ? 'secondary' : 'ghost'}
            onClick={() => onViewChange('admin')}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Admin
          </Button>
        ) : (
          <Button
            className="w-full justify-start"
            variant={activeView === 'cashier' ? 'secondary' : 'ghost'}
            onClick={() => onViewChange('cashier')}
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Cashier
          </Button>
        )}
      </nav>

      <section className="min-h-0 flex-1 overflow-y-auto border-t px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Recent transactions</h2>
        </div>
        <RecentTransactions transactions={transactions} />
      </section>

      <div className="border-t px-5 py-4">
        <div className="mb-3 text-xs text-muted-foreground">Version {version}</div>
        <Button className="w-full justify-start" variant="outline" onClick={onLogout}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
