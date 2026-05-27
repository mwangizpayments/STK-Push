import { WifiOff } from 'lucide-react';

export function OfflineBadge({ isOffline }) {
  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-[60] flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      <WifiOff className="h-3.5 w-3.5" />
      Offline
    </div>
  );
}
