import { useState } from 'react';
import { CalendarRange, Layers, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

const HIGHLIGHTS = [
  { icon: CalendarRange, text: 'Le planning de toute l’équipe sur un seul écran' },
  { icon: Layers, text: 'Tickets et événements rattachés à chaque client' },
  { icon: ShieldCheck, text: 'Droits d’accès réglés au détail près' },
];

export function LoginPage() {
  const { login, signUp, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        const result = await signUp(email, password, name);
        if (result === 'confirm-email') {
          setNotice(
            'Compte créé. Un email de confirmation vient de vous être envoyé : cliquez le lien qu’il contient, puis revenez vous connecter.',
          );
          setMode('login');
        }
      }
    } catch {
      /* message affiché via le store */
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Colonne de marque — masquée sur petit écran. */}
      <aside className="hidden w-[46%] max-w-xl flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-accent text-sm font-bold text-accent-foreground">
            PP
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Pomelo-Paradigm</p>
            <p className="text-[11px] text-sidebar-muted">Planning &amp; tickets</p>
          </div>
        </div>

        <div>
          <h2 className="max-w-sm text-[26px] font-semibold leading-snug tracking-tight text-white">
            Toute la production, planifiée au même endroit.
          </h2>
          <ul className="mt-8 space-y-3.5">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-sidebar-muted">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-sidebar-muted">
          Accès réservé aux collaborateurs Pomelo-Paradigm.
        </p>
      </aside>

      {/* Colonne formulaire */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded bg-accent text-sm font-bold text-accent-foreground">
              PP
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Pomelo-Paradigm</p>
              <p className="text-[11px] text-muted-foreground">Planning &amp; tickets</p>
            </div>
          </div>

          <div className="mb-6 flex overflow-hidden rounded-md border border-border text-xs">
            {(
              [
                ['login', 'Se connecter'],
                ['signup', 'Créer un compte'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`flex-1 px-3 py-2 transition-colors ${
                  mode === key
                    ? 'bg-primary font-medium text-primary-foreground'
                    : 'text-muted-foreground hover:bg-surface-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <h1 className="text-xl font-semibold tracking-tight">
            {mode === 'login' ? 'Connexion' : 'Créer un compte'}
          </h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            {mode === 'login'
              ? 'Renseignez vos identifiants pour accéder au planning.'
              : 'Un administrateur vous attribuera ensuite vos droits.'}
          </p>

          <div className="space-y-4">
            {mode === 'signup' && (
              <div>
                <Label htmlFor="name">Nom et prénom</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  placeholder="Claire Dubois"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="prenom.nom@pomelo-paradigm.fr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'signup' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === 'signup' && (
                <p className="mt-1 text-[11px] text-muted-foreground">8 caractères minimum.</p>
              )}
            </div>
          </div>

          {notice && (
            <p className="mt-4 rounded-md border border-primary/25 bg-primary-soft px-3 py-2 text-xs text-primary">
              {notice}
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="mt-6 w-full" disabled={pending}>
            {pending
              ? 'Un instant…'
              : mode === 'login'
                ? 'Se connecter'
                : 'Créer mon compte'}
          </Button>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            {mode === 'login'
              ? 'Mot de passe oublié ? Contactez un administrateur.'
              : 'Le premier compte créé devient automatiquement administrateur.'}
          </p>
        </form>
      </div>
    </div>
  );
}
