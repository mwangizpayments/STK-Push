import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appName, logoPath } from '@/config/branding';

export function AboutModal({ onClose, updateState }) {
  const [version, setVersion] = useState('1.0.0');
  const updateReady = updateState?.status === 'downloaded';

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

        {updateReady ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            <p className="text-sm font-semibold">Update available</p>
            {updateState.updateVersion ? (
              <p className="mt-1 text-xs">Version {updateState.updateVersion} is ready to install.</p>
            ) : null}
            <Button
              className="mt-3 h-9 bg-emerald-600 text-white hover:bg-emerald-700"
              type="button"
              onClick={() => window.mpesaDesktop?.restartAndInstallUpdate?.().catch(() => {})}
            >
              <Download className="h-4 w-4" />
              Update now
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
