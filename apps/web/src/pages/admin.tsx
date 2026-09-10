import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Briefcase, ChevronDown, ChevronRight, Eye, EyeOff, Plus, ShieldCheck, Trash2, Users2, Tag, Tags } from 'lucide-react';
import {
  archiveLabel,
  archiveProjectObject,
  archiveStatus,
  archiveUser,
  createLabel,
  deleteUser,
  createProjectObject,
  createStatus,
  restoreUser,
  updateLabel,
  updateProjectObject,
  updateRolePermissions,
  updateStatus,
  updateUser,
} from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/slide-over';
import { Avatar, Card, Spinner } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import {
  useArchivedUsers,
  useClients,
  useLabels,
  usePermissions,
  useProjectObjects,
  useRoles,
  useStatuses,
  useTeams,
  useUsers,
} from '@/hooks/queries';
import { useAuth } from '@/store/auth';
import { P } from '@/lib/permissions';
import { cn } from '@/lib/utils';

type Tab = 'users' | 'roles' | 'statuses' | 'objects' | 'labels';

export function AdminPage() {
  const { can } = useAuth();
  // Un éditeur n'a accès qu'aux réglages de production (missions, étiquettes).
  const isAdmin = can(P.USER_MANAGE) || can(P.ROLE_MANAGE);
  const [tab, setTab] = useState<Tab>(isAdmin ? 'users' : 'objects');

  const tabs = [
    ...(isAdmin
      ? ([
          ['users', 'Utilisateurs', Users2],
          ['roles', 'Rôles & permissions', ShieldCheck],
          ['statuses', 'Statuts', Tags],
        ] as const)
      : []),
    ...(can(P.PROJECT_OBJECT_MANAGE) ? ([['objects', 'Types de mission', Briefcase]] as const) : []),
    ...(can(P.LABEL_MANAGE) ? ([['labels', 'Étiquettes', Tag]] as const) : []),
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-border bg-surface px-4">
        {tabs.map(([key, label, Icon]) => (
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
        {tab === 'objects' && <ObjectsTab />}
        {tab === 'labels' && <LabelsTab />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function UsersTab() {
  const { user: currentUser } = useAuth();
  const users = useUsers();
  const roles = useRoles();
  const teams = useTeams();
  const qc = useQueryClient();
  const toast = useToast();
  const [showHidden, setShowHidden] = useState(false);
  const [confirmHide, setConfirmHide] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const archived = useArchivedUsers(showHidden);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['users'] });
  };

  const update = async (id: string, payload: Parameters<typeof updateUser>[1]) => {
    try {
      await updateUser(id, payload);
      void refresh();
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Échec', { tone: 'error' });
    }
  };

  const hide = async (id: string) => {
    try {
      await archiveUser(id);
      void refresh();
      toast.push('Compte masqué', { tone: 'success' });
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Échec', { tone: 'error' });
    }
  };

  const restore = async (id: string) => {
    try {
      await restoreUser(id);
      void refresh();
      toast.push('Compte réaffiché', { tone: 'success' });
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Échec', { tone: 'error' });
    }
  };

  const remove = async (id: string) => {
    setDeleting(true);
    try {
      await deleteUser(id);
      void refresh();
      toast.push('Compte supprimé', { tone: 'success' });
      setConfirmDelete(null);
    } catch (error) {
      toast.push(error instanceof Error ? error.message : 'Échec', { tone: 'error' });
    } finally {
      setDeleting(false);
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
        <p className="mt-1 text-xs text-muted-foreground">
          <strong>Actif</strong> met un compte en pause (il reste dans la liste).{' '}
          <strong>Masquer</strong> le retire de la liste et lui coupe tout accès — réversible.
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
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(users.data ?? []).map((user) => (
              <tr key={user.id} className="border-t border-border bg-surface">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={user.name} url={user.avatarUrl} size={22} />
                    <Input
                      className="h-8 w-44"
                      defaultValue={user.name}
                      aria-label={`Nom de ${user.name}`}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value && value !== user.name) void update(user.id, { name: value });
                      }}
                    />
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
                <td className="px-3 py-2 text-right">
                  {/* On ne peut agir ni se masquer ni se supprimer soi-même. */}
                  {user.id !== currentUser?.id && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmHide({ id: user.id, name: user.name })}
                      >
                        <EyeOff className="h-3.5 w-3.5" /> Masquer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete({ id: user.id, name: user.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Supprimer
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Comptes masqués */}
      <div className="mt-4">
        <button
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setShowHidden((v) => !v)}
        >
          {showHidden ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Comptes masqués
        </button>
        {showHidden && (
          <div className="mt-2 space-y-1.5">
            {archived.isLoading && <Spinner />}
            {(archived.data ?? []).map((user) => (
              <Card key={user.id} className="flex items-center gap-3 py-2">
                <Avatar name={user.name} url={user.avatarUrl} size={22} />
                <span className="text-sm">{user.name}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => void restore(user.id)}
                >
                  <Eye className="h-3.5 w-3.5" /> Réafficher
                </Button>
              </Card>
            ))}
            {!archived.isLoading && (archived.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">Aucun compte masqué.</p>
            )}
          </div>
        )}
      </div>

      {confirmHide && (
        <Modal open onOpenChange={(o) => !o && setConfirmHide(null)} title="Masquer ce compte ?">
          <p className="text-sm">
            <strong>{confirmHide.name}</strong> disparaîtra de la liste et n'aura plus aucun accès à
            l'application. Son historique (tickets créés, temps saisis) est conservé.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Réversible à tout moment depuis « Comptes masqués ».
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmHide(null)}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={() => {
                void hide(confirmHide.id);
                setConfirmHide(null);
              }}
            >
              Masquer
            </Button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          open
          onOpenChange={(o) => !o && !deleting && setConfirmDelete(null)}
          title="Supprimer définitivement ?"
        >
          <p className="text-sm">
            Le compte de <strong>{confirmDelete.name}</strong> et son accès seront{' '}
            <strong>effacés pour de bon</strong>. Cette action est irréversible.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Les tickets qu'il a créés sont conservés (auteur « — »). Pour un départ temporaire,
            préférez « Masquer », qui est réversible.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={deleting}
              onClick={() => setConfirmDelete(null)}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => void remove(confirmDelete.id)}
            >
              {deleting ? 'Suppression…' : 'Supprimer définitivement'}
            </Button>
          </div>
        </Modal>
      )}
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

// ---------------------------------------------------------------------------

/**
 * Types de mission (calage, montage, contrôle des livrables…).
 * Sans client, un type est proposé pour tous ; avec un client, il lui est
 * réservé.
 */
function ObjectsTab() {
  const objects = useProjectObjects();
  const clients = useClients();
  const qc = useQueryClient();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#1D4E89');
  const [clientId, setClientId] = useState('');

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['project-objects'] });
    void qc.invalidateQueries({ queryKey: ['clients'] });
  };

  const fail = (error: unknown) =>
    toast.push(error instanceof Error ? error.message : 'Échec', { tone: 'error' });

  if (objects.isLoading) return <Spinner />;

  const rows = objects.data ?? [];
  const common = rows.filter((o) => !o.clientId);
  const specific = rows.filter((o) => o.clientId);

  const line = (object: (typeof rows)[number]) => (
    <Card key={object.id} className="flex items-center gap-3 py-2">
      <input
        type="color"
        value={object.color}
        onChange={async (e) => {
          try {
            await updateProjectObject(object.id, { color: e.target.value });
            refresh();
          } catch (error) {
            fail(error);
          }
        }}
        className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent"
        aria-label={`Couleur de ${object.name}`}
      />
      <Input
        className="h-8 w-64"
        defaultValue={object.name}
        onBlur={async (e) => {
          if (e.target.value === object.name || !e.target.value.trim()) return;
          try {
            await updateProjectObject(object.id, { name: e.target.value.trim() });
            refresh();
          } catch (error) {
            fail(error);
          }
        }}
      />
      <span className="text-[11px] text-muted-foreground">
        {object.client?.name ? `réservé à ${object.client.name}` : 'tous les clients'}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto"
        onClick={async () => {
          try {
            await archiveProjectObject(object.id);
            refresh();
          } catch (error) {
            fail(error);
          }
        }}
      >
        Archiver
      </Button>
    </Card>
  );

  return (
    <>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-sm font-semibold">Types de mission</h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nouveau type
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Ce sont les natures de travail proposées sur un ticket : calage, montage, contrôle des
        livrables… Un type sans client est proposé pour tous les clients.
      </p>

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Communs à tous les clients
      </h2>
      <div className="space-y-1.5">
        {common.map(line)}
        {common.length === 0 && (
          <p className="text-xs text-muted-foreground">Aucun type commun pour l'instant.</p>
        )}
      </div>

      {specific.length > 0 && (
        <>
          <h2 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Réservés à un client
          </h2>
          <div className="space-y-1.5">{specific.map(line)}</div>
        </>
      )}

      {creating && (
        <Modal open onOpenChange={(o) => !o && setCreating(false)} title="Nouveau type de mission">
          <div className="space-y-3">
            <div>
              <Label htmlFor="object-name">Nom</Label>
              <Input
                id="object-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Contrôle des livrables"
              />
            </div>
            <div>
              <Label htmlFor="object-client">Client</Label>
              <Select
                id="object-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Tous les clients</option>
                {(clients.data ?? []).map((client) => (
                  <option key={client.id} value={client.id}>
                    Réservé à {client.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="object-color">Couleur</Label>
              <Input
                id="object-color"
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
              disabled={!name.trim()}
              onClick={async () => {
                try {
                  await createProjectObject({
                    name: name.trim(),
                    color,
                    clientId: clientId || null,
                  });
                  setName('');
                  setClientId('');
                  setCreating(false);
                  refresh();
                } catch (error) {
                  fail(error);
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

// ---------------------------------------------------------------------------

/** Étiquettes colorées : une couleur + un sens, posées sur les tickets. */
function LabelsTab() {
  const labels = useLabels();
  const qc = useQueryClient();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#F2603C');
  const [description, setDescription] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['labels'] });
  const fail = (error: unknown) =>
    toast.push(error instanceof Error ? error.message : 'Échec', { tone: 'error' });

  if (labels.isLoading) return <Spinner />;

  return (
    <>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-sm font-semibold">Étiquettes</h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nouvelle étiquette
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Une étiquette, c'est une couleur qui veut dire quelque chose. On la pose sur un ticket, elle
        se voit dans le planning et sert de filtre.
      </p>

      <div className="space-y-1.5">
        {(labels.data ?? []).map((label) => (
          <Card key={label.id} className="flex items-center gap-3 py-2">
            <input
              type="color"
              value={label.color}
              onChange={async (e) => {
                try {
                  await updateLabel(label.id, { color: e.target.value });
                  void refresh();
                } catch (error) {
                  fail(error);
                }
              }}
              className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent"
              aria-label={`Couleur de ${label.name}`}
            />
            <Input
              className="h-8 w-48"
              defaultValue={label.name}
              onBlur={async (e) => {
                if (e.target.value === label.name || !e.target.value.trim()) return;
                try {
                  await updateLabel(label.id, { name: e.target.value.trim() });
                  void refresh();
                } catch (error) {
                  fail(error);
                }
              }}
            />
            <Input
              className="h-8 flex-1"
              defaultValue={label.description ?? ''}
              placeholder="À quoi elle sert"
              onBlur={async (e) => {
                if (e.target.value === (label.description ?? '')) return;
                try {
                  await updateLabel(label.id, { description: e.target.value });
                  void refresh();
                } catch (error) {
                  fail(error);
                }
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await archiveLabel(label.id);
                  void refresh();
                } catch (error) {
                  fail(error);
                }
              }}
            >
              Archiver
            </Button>
          </Card>
        ))}
        {(labels.data ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">Aucune étiquette pour l'instant.</p>
        )}
      </div>

      {creating && (
        <Modal open onOpenChange={(o) => !o && setCreating(false)} title="Nouvelle étiquette">
          <div className="space-y-3">
            <div>
              <Label htmlFor="label-name">Nom</Label>
              <Input
                id="label-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Urgent client"
              />
            </div>
            <div>
              <Label htmlFor="label-desc">À quoi elle sert</Label>
              <Input
                id="label-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
            <div>
              <Label htmlFor="label-color">Couleur</Label>
              <Input
                id="label-color"
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
              disabled={!name.trim()}
              onClick={async () => {
                try {
                  await createLabel({
                    name: name.trim(),
                    color,
                    description: description || undefined,
                  });
                  setName('');
                  setDescription('');
                  setCreating(false);
                  void refresh();
                } catch (error) {
                  fail(error);
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
