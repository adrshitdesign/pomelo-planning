import { useState } from 'react';
import { Building2, ChevronRight, Plus } from 'lucide-react';
import { createClient, createProjectObject } from '@/lib/data';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Modal } from '@/components/ui/slide-over';
import { Card, EmptyState, Spinner } from '@/components/ui/misc';
import { TicketSlideOver } from '@/features/tickets/ticket-slide-over';
import {
  useClients,
  useProjectObjects,
  useStatuses,
  useTeams,
  useTickets,
  useUsers,
} from '@/hooks/queries';
import { useAuth } from '@/store/auth';
import { P } from '@/lib/permissions';
import { cn } from '@/lib/utils';

export function ClientsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const clients = useClients();
  const statuses = useStatuses();
  const users = useUsers();
  const teams = useTeams();
  const projectObjects = useProjectObjects();

  const [selectedClientId, setSelectedClient] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObject] = useState<string | null>(null);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [newClient, setNewClient] = useState(false);
  const [newObject, setNewObject] = useState(false);

  const selectedClient = clients.data?.find((c) => c.id === selectedClientId) ?? clients.data?.[0];
  const objects = selectedClient?.projectObjects ?? [];
  const linkedTickets = useTickets({
    clientId: selectedClient?.id,
    projectObjectId: selectedObjectId ?? undefined,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['clients'] });
    void qc.invalidateQueries({ queryKey: ['project-objects'] });
  };

  return (
    <div className="flex h-full">
      {/* Colonne 1 : clients */}
      <div className="w-64 shrink-0 overflow-y-auto border-r border-border bg-surface">
        <div className="flex items-center justify-between px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Clients
          </h2>
          {can(P.CLIENT_MANAGE) && (
            <Button variant="ghost" size="icon" onClick={() => setNewClient(true)} title="Ajouter">
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        {clients.isLoading && <Spinner className="mx-3" />}
        {(clients.data ?? []).map((client) => (
          <button
            key={client.id}
            onClick={() => {
              setSelectedClient(client.id);
              setSelectedObject(null);
            }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted',
              selectedClient?.id === client.id && 'bg-primary-soft font-medium text-primary',
            )}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: client.color }} />
            <span className="truncate">{client.name}</span>
            <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Colonne 2 : objets */}
      <div className="w-72 shrink-0 overflow-y-auto border-r border-border bg-surface">
        <div className="flex items-center justify-between px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Objets
          </h2>
          {can(P.PROJECT_OBJECT_MANAGE) && selectedClient && (
            <Button variant="ghost" size="icon" onClick={() => setNewObject(true)} title="Ajouter">
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        {objects.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">Aucun objet pour ce client.</p>
        )}
        {objects.map((object) => (
          <button
            key={object.id}
            onClick={() => setSelectedObject(selectedObjectId === object.id ? null : object.id)}
            className={cn(
              'w-full px-3 py-2 text-left hover:bg-surface-muted',
              selectedObjectId === object.id && 'bg-primary-soft',
            )}
          >
            <p className="text-sm">{object.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {object._count?.tickets ?? 0} ticket(s) · {object._count?.events ?? 0} événement(s)
            </p>
          </button>
        ))}
      </div>

      {/* Colonne 3 : tickets liés */}
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {!selectedClient ? (
          <EmptyState title="Sélectionnez un client" />
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h1 className="text-base font-semibold">{selectedClient.name}</h1>
              {selectedObjectId && (
                <span className="text-sm text-muted-foreground">
                  · {objects.find((o) => o.id === selectedObjectId)?.name}
                </span>
              )}
            </div>

            {selectedClient.contactName && (
              <Card className="mb-4 text-xs">
                <p>
                  <span className="text-muted-foreground">Contact :</span>{' '}
                  {selectedClient.contactName}
                </p>
                {selectedClient.email && (
                  <p>
                    <span className="text-muted-foreground">Email :</span> {selectedClient.email}
                  </p>
                )}
                {selectedClient.phone && (
                  <p>
                    <span className="text-muted-foreground">Téléphone :</span> {selectedClient.phone}
                  </p>
                )}
              </Card>
            )}

            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tickets liés
            </h2>
            <div className="space-y-1.5">
              {(linkedTickets.data?.items ?? []).map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setOpenTicketId(ticket.id)}
                  className="planning-item planning-item--ticket w-full p-2 text-left hover:bg-surface-muted"
                  style={{ ['--item-color' as string]: ticket.status.color }}
                >
                  <p className="text-sm">{ticket.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {ticket.status.name}
                    {ticket.projectObject ? ` · ${ticket.projectObject.name}` : ''}
                  </p>
                </button>
              ))}
              {(linkedTickets.data?.items.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground">Aucun ticket lié.</p>
              )}
            </div>
          </>
        )}
      </div>

      <CreateClientModal
        open={newClient}
        onClose={() => setNewClient(false)}
        onCreated={refresh}
      />
      <CreateObjectModal
        open={newObject}
        clientId={selectedClient?.id}
        onClose={() => setNewObject(false)}
        onCreated={refresh}
      />

      <TicketSlideOver
        ticketId={openTicketId}
        statuses={statuses.data ?? []}
        users={users.data ?? []}
        teams={teams.data ?? []}
        clients={clients.data ?? []}
        projectObjects={projectObjects.data ?? []}
        onClose={() => setOpenTicketId(null)}
      />
    </div>
  );
}

function CreateClientModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [contactName, setContact] = useState('');
  const [email, setEmail] = useState('');

  if (!open) return null;
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Nouveau client">
      <div className="space-y-3">
        <div>
          <Label htmlFor="client-name">Nom</Label>
          <Input id="client-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="client-contact">Contact</Label>
          <Input
            id="client-contact"
            value={contactName}
            onChange={(e) => setContact(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="client-email">Email</Label>
          <Input
            id="client-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Annuler
        </Button>
        <Button
          size="sm"
          disabled={!name.trim()}
          onClick={async () => {
            await createClient({
              name: name.trim(),
              contactName: contactName || undefined,
              email: email || undefined,
            });
            onCreated();
            onClose();
          }}
        >
          Créer
        </Button>
      </div>
    </Modal>
  );
}

function CreateObjectModal({
  open,
  clientId,
  onClose,
  onCreated,
}: {
  open: boolean;
  clientId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [reference, setReference] = useState('');

  if (!open || !clientId) return null;
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Nouvel objet">
      <div className="space-y-3">
        <div>
          <Label htmlFor="object-name">Nom</Label>
          <Input id="object-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="object-ref">Référence</Label>
          <Input
            id="object-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Optionnel"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Annuler
        </Button>
        <Button
          size="sm"
          disabled={!name.trim()}
          onClick={async () => {
            await createProjectObject({
              clientId,
              name: name.trim(),
              reference: reference || undefined,
            });
            onCreated();
            onClose();
          }}
        >
          Créer
        </Button>
      </div>
    </Modal>
  );
}
