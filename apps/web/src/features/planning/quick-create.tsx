import { useState } from 'react';
import { addMinutes, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Modal } from '@/components/ui/slide-over';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import type { Client, ProjectObject, Status, Team, User } from '@/lib/types';

export interface QuickCreateContext {
  date: Date;
  resourceId?: string;
}

/**
 * Mini-formulaire de création rapide (clic sur une case vide, section 8).
 * « Détail complet » crée la tâche puis ouvre le panneau latéral.
 */
export function QuickCreateModal({
  context,
  statuses,
  users,
  teams,
  clients,
  projectObjects,
  onClose,
  onSubmit,
}: {
  context: QuickCreateContext | null;
  statuses: Status[];
  users: User[];
  teams: Team[];
  clients: Client[];
  projectObjects: ProjectObject[];
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>, openDetail: boolean) => Promise<void> | void;
}) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'ticket' | 'event'>('ticket');
  const [durationMinutes, setDuration] = useState(60);
  const [assigneeId, setAssignee] = useState('');
  const [teamId, setTeam] = useState('');
  const [clientId, setClient] = useState('');
  const [projectObjectId, setProjectObject] = useState('');
  const [statusId, setStatus] = useState('');
  const [pending, setPending] = useState(false);

  // La liste des objets suit le client choisi.
  const objectChoices = clientId
    ? projectObjects.filter((o) => !o.clientId || o.clientId === clientId)
    : projectObjects;

  if (!context) return null;

  const startAt = context.date;
  const endAt = addMinutes(startAt, durationMinutes);

  const reset = () => {
    setTitle('');
    setDuration(60);
    setAssignee('');
    setTeam('');
    setClient('');
    setProjectObject('');
    setStatus('');
    setKind('ticket');
  };

  const submit = async (openDetail: boolean) => {
    if (!title.trim()) return;
    setPending(true);
    try {
      const payload =
        kind === 'ticket'
          ? {
              __kind: 'ticket',
              title: title.trim(),
              startAt: startAt.toISOString(),
              endAt: endAt.toISOString(),
              estimatedMinutes: durationMinutes,
              statusId: statusId || undefined,
              teamId: teamId || undefined,
              clientId: clientId || undefined,
              projectObjectId: projectObjectId || undefined,
              assignees: (assigneeId || context.resourceId)
                ? [
                    {
                      userId: assigneeId || context.resourceId,
                      startAt: startAt.toISOString(),
                      endAt: endAt.toISOString(),
                    },
                  ]
                : undefined,
            }
          : {
              __kind: 'event',
              title: title.trim(),
              startAt: startAt.toISOString(),
              endAt: endAt.toISOString(),
              teamId: teamId || undefined,
              clientId: clientId || undefined,
              projectObjectId: projectObjectId || undefined,
              participantIds: assigneeId || context.resourceId
                ? [assigneeId || context.resourceId]
                : undefined,
            };
      await onSubmit(payload, openDetail);
      reset();
      onClose();
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title="Création rapide">
      <p className="mb-3 text-xs text-muted-foreground">
        {format(startAt, "EEEE d MMMM 'à' HH:mm", { locale: fr })} → {format(endAt, 'HH:mm')}
      </p>

      <div className="space-y-3">
        <div className="flex overflow-hidden rounded-md border border-border text-xs">
          {(['ticket', 'event'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setKind(value)}
              className={`flex-1 px-3 py-1.5 ${
                kind === value ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-muted'
              }`}
            >
              {value === 'ticket' ? 'Ticket' : 'Événement'}
            </button>
          ))}
        </div>

        <div>
          <Label htmlFor="quick-title">Titre</Label>
          <Input
            id="quick-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit(false)}
            placeholder={kind === 'ticket' ? 'Ex. Maquettes page d’accueil' : 'Ex. Point hebdo'}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="quick-duration">Durée</Label>
            <Select
              id="quick-duration"
              value={durationMinutes}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {[30, 60, 90, 120, 180, 240, 480].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="quick-assignee">
              {kind === 'ticket' ? 'Assigné à' : 'Participant'}
            </Label>
            <Select
              id="quick-assignee"
              value={assigneeId || context.resourceId || ''}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">—</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="quick-team">Équipe</Label>
            <Select id="quick-team" value={teamId} onChange={(e) => setTeam(e.target.value)}>
              <option value="">—</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="quick-client">Client</Label>
            <Select
              id="quick-client"
              value={clientId}
              onChange={(e) => {
                setClient(e.target.value);
                // Un objet d'un autre client n'a plus lieu d'être.
                const current = projectObjects.find((o) => o.id === projectObjectId);
                if (current?.clientId && current.clientId !== e.target.value) setProjectObject('');
              }}
            >
              <option value="">—</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="quick-object">
            Type de mission{' '}
            <span className="font-normal text-muted-foreground">(facultatif)</span>
          </Label>
          <Select
            id="quick-object"
            value={projectObjectId}
            onChange={(e) => {
              setProjectObject(e.target.value);
              const object = projectObjects.find((o) => o.id === e.target.value);
              if (object?.clientId) setClient(object.clientId);
            }}
          >
            <option value="">—</option>
            {objectChoices.map((object) => (
              <option key={object.id} value={object.id}>
                {!clientId && object.client?.name ? `${object.client.name} · ` : ''}
                {object.name}
              </option>
            ))}
          </Select>
        </div>

        {kind === 'ticket' && (
          <div>
            <Label htmlFor="quick-status">Statut</Label>
            <Select id="quick-status" value={statusId} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Statut par défaut</option>
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Annuler
        </Button>
        {kind === 'ticket' && (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => void submit(true)}>
            Détail complet…
          </Button>
        )}
        <Button size="sm" disabled={pending || !title.trim()} onClick={() => void submit(false)}>
          Créer
        </Button>
      </div>
    </Modal>
  );
}
