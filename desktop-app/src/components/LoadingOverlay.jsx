import { Loader2 } from 'lucide-react';
import { appName, logoPath } from '@/config/branding';

export function LoadingOverlay({ message = 'Loading session...' }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border bg-card px-6 py-7 text-center shadow-xl shadow-black/5">
        <img alt="" className="h-14 max-w-56 object-contain" src={logoPath} />
        <div>
          <h1 className="text-lg font-semibold tracking-normal">{appName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </section>
    </main>
  );
}
