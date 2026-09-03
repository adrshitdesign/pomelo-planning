import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck, Users2, Tags } from 'lucide-react';
import { archiveStatus, createStatus, updateRolePermissions, updateStatus, updateUser } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/slide-over';
import { Avatar, Card, Spinner } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { usePermissions, useRoles, useStatuses, useTeams, useUsers } from '@/hooks/queries';
import { cn } from '@/lib/utils';

type Tab = 'users' | 'roles' | 'statuses';

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('users');

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-border bg-surface px-4">
        {(
          [
            ['users', 'Utilisateurs', Users2],
            ['roles', 'Rôles & permissions', ShieldCheck],
            ['statuses', 'Statuts', Tags],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs',
              tab === key
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'users' && <UsersTab />}
        {tab === 'roles' && <RolesTab />}
        {tab === 'statuses' && <StatusesTab />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function UsersTab() {
  const users = useUsers();
  const roles = useRoles();
  const teams = useTeams();
  const qc = useQueryClient();
  const toast = useToast();

  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });

  const update = async (id: string, payload: Parameters<typeof updateUser>[1]) => {
    try {
      await updateUser(id, payload);
      void refresh();
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Échec', { tone: 'error' });
    }
  };

  if (users.isLoading) return <Spinner />;

  return (
    <>
      <div className="mb-3">
        <h1 className="text-sm font-semibold">Utilisateurs</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Les comptes se créent depuis l'écran de connexion, onglet « Créer un compte ».
          Attribuez ensuite un rôle ici : sans rôle, une personne ne voit rien.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Nom</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Rôle</th>
              <th className="px-3 py-2 font-medium">Équipes</th>
              <th className="px-3 py-2 font-medium">Actif</th>
            </tr>
          </thead>
          <tbody>
            {(users.data ?? []).map((user) => (
              <tr key={user.id} className="border-t border-border bg-surface">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={user.name} url={user.avatarUrl} size={22} />
                    {user.name}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{user.email}</td>
                <td className="px-3 py-2">
                  <Select
                    className="h-8 w-40"
                    value={user.roles[0]?.id ?? ''}
                    onChange={(e) => void update(user.id, { roleIds: [e.target.value] })}
                  >
                    <option value="">Aucun</option>
                    {(roles.data ?? []).map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Select
                    className="h-8 w-40"
                    value={user.teams[0]?.id ?? ''}
                    onChange={(e) =>
                      void update(user.id, { teamIds: e.target.value ? [e.target.value] : [] })
                    }
                  >
                    <option value="">Aucune</option>
                    {(teams.data ?? []).map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={user.isActive}
                    onChange={(e) => void update(user.id, { isActive: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </>
  );
}

// ---------------------------------------------------------------------------

function RolesTab() {
  const roles = useRoles();
  const permissions = usePermissions();
  const qc = useQueryClient();
  const toast = useToast();
  const [selectedId, setSelected] = useState<string | null>(null);

  const selected = roles.data?.find((r) => r.id === selectedId) ?? roles.data?.[0];

  const toggle = async (permissionKey: string) => {
    if (!selected) return;
    const next = selected.permissions.includes(permissionKey)
      ? selected.permissions.filter((p) => p !== permissionKey)
      : [...selected.permissions, permissionKey];
    try {
      await updateRolePermissions(selected.id, next);
      void qc.invalidateQueries({ queryKey: ['roles'] });
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Échec', { tone: 'error' });
    }
  };

  if (roles.isLoading) return <Spinner />;

  // Regroupement par préfixe de clé (ticket:, planning:, …).
  const groups = (permissions.data ?? []).reduce<Record<string, typeof permissions.data>>(
    (acc, permission) => {
      const prefix = permission.key.split(':')[0];
      acc[prefix] = [...(acc[prefix] ?? []), permission];
      return acc;
    },
    {},
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <Card className="p-0">
        <h2 className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rôles
        </h2>
        {(roles.data ?? []).map((role) => (
          <button
            key={role.id}
            onClick={() => setSelected(role.id)}
            className={cn(
              'w-full px-3 py-2 text-left hover:bg-surface-muted',
              selected?.id === role.id && 'bg-primary-soft text-primary',
            )}
          >
            <p className="text-sm font-medium">{role.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {role.permissions.length} permissions · {role.userCount} utilisateur(s)
            </p>
          </button>
        ))}
      </Card>

      <Card>
        {!selected ? (
          <p className="text-xs text-muted-foreground">Sélectionnez un rôle.</p>
        ) : (
          <>
            <div className="mb-3">
              <h2 className="text-sm font-semibold">{selected.name}</h2>
              <p className="text-xs text-muted-foreground">{selected.description}</p>
            </div>
            <div className="space-y-4">
              {Object.entries(groups).map(([prefix, list]) => (
                <div key={prefix}>
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {prefix}
                  </h3>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {(list ?? []).map((permission) => (
                      <label
                        key={permission.id}
                        className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-surface-muted"
                      >
                        <input
                          type="checkbox"
                          checked={selected.permissions.includes(permission.key)}
                          onChange={() => void toggle(permission.key)}
                        />
                        <span>{permission.description}</span>
                        <code className="ml-auto text-[10px] text-muted-foreground">
                          {permission.key}
                        </code>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatusesTab() {
  const statuses = useStatuses();
  const qc = useQueryClient();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#38bdf8');

  const refresh = () => qc.invalidateQueries({ queryKey: ['statuses'] });

  if (statuses.isLoading) return <Spinner />;

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold">Statuts personnalisables</h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nouveau statut
        </Button>
      </div>

      <div className="space-y-1.5">
        {(statuses.data ?? []).map((status) => (
          <Card key={status.id} className="flex items-center gap-3 py-2">
            <input
              type="color"
              value={status.color}
              onChange={async (e) => {
                await updateStatus(status.id, { color: e.target.value });
                void refresh();
              }}
              className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent"
              aria-label={`Couleur de ${status.name}`}
            />
            <Input
              className="h-8 w-56"
              defaultValue={status.name}
              onBlur={async (e) => {
                if (e.target.value === status.name) return;
                await updateStatus(status.id, { name: e.target.value });
                void refresh();
              }}
            />
            <code className="text-[11px] text-muted-foreground">{status.key}</code>
            <label className="ml-auto flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={status.isDefault}
                onChange={async () => {
                  await updateStatus(status.id, { isDefault: true });
                  void refresh();
                }}
              />
              Par défaut
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={status.isFinal}
                onChange={async (e) => {
                  await updateStatus(status.id, { isFinal: e.target.checked });
                  void refresh();
                }}
              />
              Statut final
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await archiveStatus(status.id);
                  void refresh();
                } catch (error) {
                  toast.push(error instanceof Error ? error.message : 'Échec', { tone: 'error' });
                }
              }}
            >
              Archiver
            </Button>
          </Card>
        ))}
      </div>

      {creating && (
        <Modal open onOpenChange={(o) => !o && setCreating(false)} title="Nouveau statut">
          <div className="space-y-3">
            <div>
              <Label htmlFor="status-key">Clé technique</Label>
              <Input
                id="status-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="en_relecture"
              />
            </div>
            <div>
              <Label htmlFor="status-name">Libellé</Label>
              <Input id="status-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="status-color">Couleur</Label>
              <Input
                id="status-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={!key || !name}
              onClick={async () => {
                try {
                  await createStatus({
                    key,
                    name,
                    color,
                    position: (statuses.data?.length ?? 0) + 1,
                  });
                  setKey('');
                  setName('');
                  setCreating(false);
                  void refresh();
                } catch (error) {
                  toast.push(error instanceof Error ? error.message : 'Échec', { tone: 'error' });
                }
              }}
            >
              Créer
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
