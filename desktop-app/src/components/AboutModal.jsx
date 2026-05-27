import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appName, logoPath } from '@/config/branding';

export function AboutModal({ onClose }) {
  const [version, setVersion] = useState('1.0.0');

  useEffect(() => {
    window.mpesaDesktop?.appVersion?.().then(setVersion).catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <section className="w-full max-w-sm rounded-xl border bg-card p-5 text-card-foreground shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <img alt="" className="mb-4 h-12 w-auto object-contain" src={logoPath} />
            <p className="truncate text-sm text-muted-foreground">About</p>
            <h2 className="mt-1 text-xl font-semibold tracking-normal">{appName}</h2>
          </div>
          <Button aria-label="Close about" size="icon" variant="outline" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="rounded-lg border bg-background px-3 py-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Version</p>
          <p className="mt-1 font-mono text-sm">{version}</p>
        </div>
      </section>
    </div>
  );
}
