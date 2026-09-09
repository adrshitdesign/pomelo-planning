import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Archive, Copy, Send } from 'lucide-react';
import { SlideOver } from '@/components/ui/slide-over';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Avatar, Badge, Spinner } from '@/components/ui/misc';
import { PRIORITY_LABELS, formatDuration } from '@/lib/utils';
import { useAudit, useTicket, useTicketMutations } from '@/hooks/queries';
import { useAuth } from '@/store/auth';
import { P } from '@/lib/permissions';
import type { Client, ProjectObject, Status, Team, User } from '@/lib/types';

const toLocalInput = (iso: string | null) =>
  iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '';

export function TicketSlideOver({
  ticketId,
  statuses,
  users,
  teams,
  clients,
  projectObjects,
  onClose,
}: {
  ticketId: string | null;
  statuses: Status[];
  users: User[];
  teams: Team[];
  clients: Client[];
  projectObjects: ProjectObject[];
  onClose: () => void;
}) {
  const { can, user } = useAuth();
  const { data: ticket, isLoading } = useTicket(ticketId);
  const mutations = useTicketMutations();
  const [tab, setTab] = useState<'detail' | 'comments' | 'history'>('detail');
  const [comment, setComment] = useState('');
  const audit = useAudit({ entityType: 'TICKET', entityId: ticketId ?? undefined, take: 30 });

  const canEdit = can(P.TICKET_UPDATE);

  // Quand un client est choisi, la liste des objets se restreint aux siens.
  const objectChoices = ticket?.clientId
    ? projectObjects.filter((o) => o.clientId === ticket.clientId)
    : projectObjects;

  useEffect(() => setTab('detail'), [ticketId]);

  const patch = (payload: Record<string, unknown>) => {
    if (!ticket) return;
    mutations.update.mutate({ id: ticket.id, ...payload });
  };

  return (
    <SlideOver
      open={Boolean(ticketId)}
      onOpenChange={(open) => !open && onClose()}
      title={ticket ? `#${ticket.reference} · ${ticket.title}` : 'Ticket'}
      subtitle={
        ticket?.client
          ? [ticket.client.name, ticket.projectObject?.name].filter(Boolean).join(' · ')
          : 'Sans client rattaché'
      }
      actions={
        ticket && canEdit ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              title="Dupliquer"
              onClick={() => mutations.duplicate.mutate({ id: ticket.id })}
            >
              <Copy className="h-4 w-4" />
            </Button>
            {can(P.TICKET_ARCHIVE) && (
              <Button
                variant="ghost"
                size="icon"
                title="Archiver"
                onClick={() => {
                  mutations.archive.mutate(ticket.id);
                  onClose();
                }}
              >
                <Archive className="h-4 w-4" />
              </Button>
            )}
          </>
        ) : null
      }
    >
      {isLoading || !ticket ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mb-4 flex gap-1 border-b border-border">
            {(
              [
                ['detail', 'Détail'],
                ['comments', `Commentaires (${ticket.comments?.length ?? 0})`],
                ['history', 'Historique'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-3 py-1.5 text-xs ${
                  tab === key
                    ? 'border-primary font-medium text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'detail' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="ticket-title">Titre</Label>
                <Input
                  id="ticket-title"
                  defaultValue={ticket.title}
                  disabled={!canEdit}
                  onBlur={(e) => e.target.value !== ticket.title && patch({ title: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="ticket-description">Description</Label>
                <Textarea
                  id="ticket-description"
                  defaultValue={ticket.description ?? ''}
                  disabled={!canEdit}
                  onBlur={(e) =>
                    e.target.value !== (ticket.description ?? '') &&
                    patch({ description: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ticket-status">Statut</Label>
                  <Select
                    id="ticket-status"
                    value={ticket.statusId}
                    disabled={!canEdit}
                    onChange={(e) => patch({ statusId: e.target.value })}
                  >
                    {statuses.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ticket-priority">Priorité</Label>
                  <Select
                    id="ticket-priority"
                    value={ticket.priority}
                    disabled={!canEdit}
                    onChange={(e) => patch({ priority: e.target.value })}
                  >
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ticket-start">Début</Label>
                  <Input
                    id="ticket-start"
                    type="datetime-local"
                    defaultValue={toLocalInput(ticket.startAt)}
                    disabled={!canEdit}
                    onBlur={(e) =>
                      e.target.value && patch({ startAt: new Date(e.target.value).toISOString() })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="ticket-end">Fin</Label>
                  <Input
                    id="ticket-end"
                    type="datetime-local"
                    defaultValue={toLocalInput(ticket.endAt)}
                    disabled={!canEdit}
                    onBlur={(e) =>
                      e.target.value && patch({ endAt: new Date(e.target.value).toISOString() })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ticket-estimated">Durée estimée (min)</Label>
                  <Input
                    id="ticket-estimated"
                    type="number"
                    min={0}
                    step={15}
                    defaultValue={ticket.estimatedMinutes ?? ''}
                    disabled={!canEdit}
                    onBlur={(e) => patch({ estimatedMinutes: Number(e.target.value) || undefined })}
                  />
                </div>
                <div>
                  <Label htmlFor="ticket-actual">Durée réelle (min)</Label>
                  <Input
                    id="ticket-actual"
                    type="number"
                    min={0}
                    step={15}
                    defaultValue={ticket.actualMinutes ?? ''}
                    disabled={!canEdit}
                    onBlur={(e) => patch({ actualMinutes: Number(e.target.value) || undefined })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ticket-team">Équipe</Label>
                  <Select
                    id="ticket-team"
                    value={ticket.teamId ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => patch({ teamId: e.target.value || undefined })}
                  >
                    <option value="">—</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ticket-client">Client</Label>
                  <Select
                    id="ticket-client"
                    value={ticket.clientId ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const clientId = e.target.value;
                      // Un objet déjà choisi qui appartient à un autre client
                      // n'a plus de sens : on le détache.
                      const current = projectObjects.find((o) => o.id === ticket.projectObjectId);
                      const keepObject = Boolean(current) && current!.clientId === clientId;
                      patch({
                        clientId: clientId || '',
                        projectObjectId: keepObject ? undefined : '',
                      });
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
                <Label htmlFor="ticket-object">
                  Objet <span className="font-normal text-muted-foreground">(facultatif)</span>
                </Label>
                <Select
                  id="ticket-object"
                  value={ticket.projectObjectId ?? ''}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const objectId = e.target.value;
                    const object = projectObjects.find((o) => o.id === objectId);
                    patch({
                      projectObjectId: objectId || '',
                      // L'objet porte son client : on le recopie sur le ticket.
                      ...(object ? { clientId: object.clientId } : {}),
                    });
                  }}
                >
                  <option value="">—</option>
                  {objectChoices.map((object) => (
                    <option key={object.id} value={object.id}>
                      {!ticket.clientId && object.client?.name ? `${object.client.name} · ` : ''}
                      {object.name}
                    </option>
                  ))}
                </Select>
                {ticket.clientId && objectChoices.length === 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Aucun objet pour ce client. On peut en créer depuis l'écran Clients.
                  </p>
                )}
              </div>

              <div>
                <Label>Assignés</Label>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {ticket.assignees.length === 0 && (
                    <span className="text-xs text-muted-foreground">Personne pour l'instant</span>
                  )}
                  {ticket.assignees.map((assignee) => (
                    <span
                      key={assignee.id}
                      className="flex items-center gap-1.5 rounded-full bg-surface-muted py-0.5 pl-0.5 pr-2 text-xs"
                    >
                      <Avatar name={assignee.user.name} url={assignee.user.avatarUrl} size={18} />
                      {assignee.user.name}
                      {canEdit && can(P.TICKET_ASSIGN) && (
                        <button
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Retirer ${assignee.user.name}`}
                          onClick={() =>
                            patch({
                              assignees: ticket.assignees
                                .filter((a) => a.userId !== assignee.userId)
                                .map((a) => ({ userId: a.userId })),
                            })
                          }
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {canEdit && can(P.TICKET_ASSIGN) && (
                  <Select
                    value=""
                    aria-label="Ajouter un assigné"
                    onChange={(e) =>
                      e.target.value &&
                      patch({
                        assignees: [
                          ...ticket.assignees.map((a) => ({ userId: a.userId })),
                          { userId: e.target.value },
                        ],
                      })
                    }
                  >
                    <option value="">Ajouter une personne…</option>
                    {users
                      .filter((u) => !ticket.assignees.some((a) => a.userId === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </Select>
                )}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
                <Badge color={ticket.status.color}>{ticket.status.name}</Badge>
                <span>Créé par {ticket.creator.name}</span>
                <span>Estimé : {formatDuration(ticket.estimatedMinutes)}</span>
                <span>Réel : {formatDuration(ticket.actualMinutes)}</span>
              </div>
            </div>
          )}

          {tab === 'comments' && (
            <div className="space-y-3">
              {(ticket.comments ?? []).map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar name={c.author.name} url={c.author.avatarUrl} size={24} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs">
                      <span className="font-medium">{c.author.name}</span>{' '}
                      <span className="text-muted-foreground">
                        {format(new Date(c.createdAt), 'd MMM HH:mm', { locale: fr })}
                      </span>
                    </p>
                    <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                  </div>
                </div>
              ))}
              {(ticket.comments ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun commentaire.</p>
              )}

              {can(P.COMMENT_CREATE) && (
                <div className="flex gap-2 border-t border-border pt-3">
                  <Avatar name={user?.name ?? '?'} url={user?.avatarUrl} size={24} />
                  <div className="flex-1">
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Écrire un commentaire…"
                      className="min-h-[60px]"
                    />
                    <Button
                      size="sm"
                      className="mt-2"
                      disabled={!comment.trim() || mutations.comment.isPending}
                      onClick={() => {
                        mutations.comment.mutate(
                          { ticketId: ticket.id, body: comment.trim() },
                          { onSuccess: () => setComment('') },
                        );
                      }}
                    >
                      <Send className="h-3.5 w-3.5" /> Envoyer
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-2">
              {audit.isLoading && <Spinner />}
              {audit.data?.items.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p>
                      <span className="font-medium">{entry.actor?.name ?? 'Système'}</span> —{' '}
                      {entry.action}
                    </p>
                    <p className="text-muted-foreground">
                      {format(new Date(entry.createdAt), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>
              ))}
              {audit.data?.items.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun événement enregistré (permission audit:view requise).
                </p>
              )}
            </div>
          )}
        </>
      )}
    </SlideOver>
  );
}
