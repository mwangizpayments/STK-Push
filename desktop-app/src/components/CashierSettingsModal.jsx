import { LayoutDashboard, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CASHIER_MODES } from '@/config/cashierMode';

export function CashierSettingsModal({ cashierMode, onClose, onModeChange }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-xl border bg-card p-5 text-card-foreground shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Settings</p>
            <h2 className="mt-1 text-xl font-semibold tracking-normal">Cashier Mode</h2>
          </div>
          <Button aria-label="Close settings" size="icon" variant="outline" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-2">
          <SettingModeButton
            active={cashierMode === CASHIER_MODES.SIMPLE}
            icon={Zap}
            label="Simple Mode"
            sublabel="Fast Checkout"
            onClick={() => onModeChange(CASHIER_MODES.SIMPLE)}
          />
          <SettingModeButton
            active={cashierMode === CASHIER_MODES.FULL}
            icon={LayoutDashboard}
            label="Full Mode"
            sublabel="Complete Terminal"
            onClick={() => onModeChange(CASHIER_MODES.FULL)}
          />
        </div>
      </section>
    </div>
  );
}

function SettingModeButton({ active, icon: Icon, label, onClick, sublabel }) {
  return (
    <button
      className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? 'border-primary bg-primary/10' : 'bg-background hover:bg-secondary/60'
      }`}
      type="button"
      onClick={onClick}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
          active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{sublabel}</span>
      </span>
      {active ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
    </button>
  );
}
