import { useEffect, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { appName, iconPath } from '@/config/branding';
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient';

const LAST_EMAIL_KEY = 'mpesa:last-email';

export function LoginScreen({ bootError = '', onSession }) {
  const [email, setEmail] = useState(() => localStorage.getItem(LAST_EMAIL_KEY) || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (email.trim()) {
      localStorage.setItem(LAST_EMAIL_KEY, email.trim());
    }
  }, [email]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!hasSupabaseConfig) {
      setError('Supabase frontend environment variables are missing.');
      return;
    }

    setIsSubmitting(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    setIsSubmitting(false);

    if (signInError) {
      setError('Sign in failed. Check your email and password, then try again.');
      return;
    }

    onSession(data.session);
  }

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(135deg,hsl(var(--background)),hsl(var(--secondary)/0.48))] p-6 text-foreground">
      <section className="w-full max-w-[420px] rounded-lg border bg-card/95 p-7 shadow-xl shadow-black/5 backdrop-blur transition-all duration-200">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-primary text-primary-foreground shadow-sm">
            <img alt="" className="h-full w-full object-cover" src={iconPath} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-normal">{appName}</h1>
            <p className="text-sm text-muted-foreground">Secure cashier and admin access</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 pr-10"
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {bootError ? (
            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {bootError}
            </div>
          ) : null}

          {error ? (
            <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {!hasSupabaseConfig ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              Configure <span className="font-mono">VITE_SUPABASE_URL</span> and{' '}
              <span className="font-mono">VITE_SUPABASE_ANON_KEY</span>.
            </div>
          ) : null}

          <Button className="h-11 w-full transition-transform active:scale-[0.99]" type="submit" disabled={isSubmitting || !hasSupabaseConfig}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </section>
    </main>
  );
}
