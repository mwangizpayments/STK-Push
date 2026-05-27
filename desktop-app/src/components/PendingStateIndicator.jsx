import { CloudCog } from 'lucide-react';

export function PendingStateIndicator({ count = 0 }) {
  if (!count) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-[60] flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
      <CloudCog className="h-3.5 w-3.5" />
      {count} pending sync
    </div>
  );
}
