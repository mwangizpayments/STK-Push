import { LayoutDashboard, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CASHIER_MODES } from '@/config/cashierMode';

export function CashierModeModal({ currentMode, onSelect }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <section className="w-full max-w-lg rounded-xl border bg-card p-5 text-card-foreground shadow-2xl">
        <div className="mb-4">
          <p className="text-sm font-medium text-muted-foreground">Select Cashier Mode</p>
          <h2 className="mt-1 text-xl font-semibold tracking-normal">Choose terminal layout</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ModeButton
            active={currentMode === CASHIER_MODES.SIMPLE}
            icon={Zap}
            label="Simple Mode"
            sublabel="Fast Checkout"
            onClick={() => onSelect(CASHIER_MODES.SIMPLE)}
          />
          <ModeButton
            active={currentMode === CASHIER_MODES.FULL}
            icon={LayoutDashboard}
            label="Full Mode"
            sublabel="Complete Terminal"
            onClick={() => onSelect(CASHIER_MODES.FULL)}
          />
        </div>
      </section>
    </div>
  );
}

function ModeButton({ active, icon: Icon, label, onClick, sublabel }) {
  return (
    <button
      className={`rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? 'border-primary bg-primary/10 shadow-sm'
          : 'bg-background hover:border-primary/50 hover:bg-secondary/60'
      }`}
      type="button"
      onClick={onClick}
    >
      <span
        className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${
          active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="block text-base font-semibold">{label}</span>
      <span className="mt-1 block text-sm text-muted-foreground">{sublabel}</span>
    </button>
  );
}
