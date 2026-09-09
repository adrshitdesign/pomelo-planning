/* eslint-disable no-console */
import { PrismaClient, Priority, EventType } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  DEFAULT_ROLES,
  PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  PermissionKey,
} from '../src/rbac/permissions';

const prisma = new PrismaClient();

const DEFAULT_STATUSES = [
  { key: 'todo', name: 'À faire', color: '#94a3b8', position: 0, isDefault: true, isFinal: false },
  { key: 'planned', name: 'Planifié', color: '#38bdf8', position: 1, isDefault: false, isFinal: false },
  { key: 'in_progress', name: 'En cours', color: '#14b8a6', position: 2, isDefault: false, isFinal: false },
  { key: 'blocked', name: 'En attente', color: '#f59e0b', position: 3, isDefault: false, isFinal: false },
  { key: 'done', name: 'Terminé', color: '#22c55e', position: 4, isDefault: false, isFinal: true },
  { key: 'cancelled', name: 'Annulé', color: '#ef4444', position: 5, isDefault: false, isFinal: true },
];

const TEAMS = [
  { name: 'Direction', color: '#6366f1' },
  { name: 'Production', color: '#14b8a6' },
  { name: 'Design', color: '#f97362' },
  { name: 'Développement', color: '#38bdf8' },
  { name: 'Commercial', color: '#f59e0b' },
];

/** Décale une date sur le lundi de la semaine courante, à l'heure voulue. */
function thisWeek(dayOffset: number, hour: number, minute = 0): Date {
  const now = new Date();
  const monday = new Date(now);
  const weekday = (now.getDay() + 6) % 7; // lundi = 0
  monday.setDate(now.getDate() - weekday);
  monday.setHours(hour, minute, 0, 0);
  monday.setDate(monday.getDate() + dayOffset);
  return monday;
}

async function main() {
  console.log('→ Permissions');
  for (const [key, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
    await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
  }

  console.log('→ Rôles');
  for (const role of DEFAULT_ROLES) {
    const created = await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description, isSystem: true },
      create: { key: role.key, name: role.name, description: role.description, isSystem: true },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: created.id } });
    const permissions = await prisma.permission.findMany({
      where: { key: { in: role.permissions as unknown as PermissionKey[] } },
    });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: created.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  console.log('→ Statuts');
  for (const status of DEFAULT_STATUSES) {
    await prisma.status.upsert({
      where: { key: status.key },
      update: status,
      create: status,
    });
  }

  console.log('→ Équipes');
  for (const team of TEAMS) {
    await prisma.team.upsert({
      where: { name: team.name },
      update: { color: team.color },
      create: team,
    });
  }

  const roles = await prisma.role.findMany();
  const roleId = (key: string) => roles.find((r) => r.key === key)!.id;
  const teams = await prisma.team.findMany();
  const teamId = (name: string) => teams.find((t) => t.name === name)!.id;

  console.log('→ Utilisateurs');
  const demoUsers = [
    { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@exemple.fr', name: 'Admin', role: 'admin', team: 'Direction' },
    { email: 'claire.dubois@exemple.fr', name: 'Claire Dubois', role: 'editor', team: 'Design' },
    { email: 'yanis.mercier@exemple.fr', name: 'Yanis Mercier', role: 'editor', team: 'Développement' },
    { email: 'sofia.laurent@exemple.fr', name: 'Sofia Laurent', role: 'editor', team: 'Production' },
    { email: 'tom.bernard@exemple.fr', name: 'Tom Bernard', role: 'reader', team: 'Commercial' },
  ];

  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const users: { id: string; email: string; name: string }[] = [];
  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { email: u.email, name: u.name, passwordHash },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleId(u.role) } },
      update: {},
      create: { userId: user.id, roleId: roleId(u.role) },
    });
    await prisma.teamMembership.upsert({
      where: { userId_teamId: { userId: user.id, teamId: teamId(u.team) } },
      update: {},
      create: { userId: user.id, teamId: teamId(u.team) },
    });
    users.push(user);
  }

  console.log('→ Clients & objets');
  const clientsData = [
    { name: 'Maison Verdier', color: '#f97362', objects: ['Refonte site vitrine', 'Catalogue 2026'] },
    { name: 'Groupe Solene', color: '#38bdf8', objects: ['Identité visuelle', 'Rapport annuel'] },
    { name: 'Atelier Kairos', color: '#22c55e', objects: ['Packaging gamme bio'] },
  ];

  const projectObjects: { id: string; name: string }[] = [];
  for (const c of clientsData) {
    const client = await prisma.client.upsert({
      where: { name: c.name },
      update: { color: c.color },
      create: { name: c.name, color: c.color },
    });
    for (const objectName of c.objects) {
      const po = await prisma.projectObject.upsert({
        where: { clientId_name: { clientId: client.id, name: objectName } },
        update: {},
        create: { clientId: client.id, name: objectName },
      });
      projectObjects.push(po);
    }
  }

  const statuses = await prisma.status.findMany();
  const statusId = (key: string) => statuses.find((s) => s.key === key)!.id;

  const existingTickets = await prisma.ticket.count();
  if (existingTickets === 0) {
    console.log('→ Tickets de démonstration');
    const demoTickets = [
      { title: 'Maquettes page d’accueil', status: 'in_progress', priority: Priority.HIGH, team: 'Design', day: 0, hour: 9, hours: 3, assignee: 1 },
      { title: 'Intégration header + nav', status: 'planned', priority: Priority.MEDIUM, team: 'Développement', day: 0, hour: 14, hours: 2, assignee: 2 },
      { title: 'Chemin de fer catalogue', status: 'todo', priority: Priority.MEDIUM, team: 'Production', day: 1, hour: 10, hours: 4, assignee: 3 },
      { title: 'Déclinaison charte — logo', status: 'in_progress', priority: Priority.URGENT, team: 'Design', day: 2, hour: 9, hours: 5, assignee: 1 },
      { title: 'API tickets — endpoints CRUD', status: 'planned', priority: Priority.HIGH, team: 'Développement', day: 2, hour: 14, hours: 3, assignee: 2 },
      { title: 'Relecture rapport annuel', status: 'blocked', priority: Priority.LOW, team: 'Production', day: 3, hour: 11, hours: 2, assignee: 3 },
      { title: 'Chiffrage packaging bio', status: 'todo', priority: Priority.MEDIUM, team: 'Commercial', day: 4, hour: 9, hours: 2, assignee: 4 },
    ];

    for (const [i, t] of demoTickets.entries()) {
      const startAt = thisWeek(t.day, t.hour);
      const endAt = new Date(startAt.getTime() + t.hours * 3600_000);
      await prisma.ticket.create({
        data: {
          title: t.title,
          description: 'Ticket de démonstration généré par le seed.',
          statusId: statusId(t.status),
          priority: t.priority,
          startAt,
          endAt,
          estimatedMinutes: t.hours * 60,
          creatorId: users[0].id,
          teamId: teamId(t.team),
          projectObjectId: projectObjects[i % projectObjects.length].id,
          assignees: {
            create: [{ userId: users[t.assignee].id, startAt, endAt }],
          },
        },
      });
    }

    console.log('→ Événements de démonstration');
    const demoEvents = [
      { title: 'Point hebdo équipe', type: EventType.MEETING, day: 0, hour: 8, hours: 1, team: 'Direction' },
      { title: 'Congé — Sofia', type: EventType.LEAVE, day: 3, hour: 9, hours: 8, team: 'Production' },
      { title: 'Formation Figma', type: EventType.TRAINING, day: 4, hour: 14, hours: 3, team: 'Design' },
    ];
    for (const e of demoEvents) {
      const startAt = thisWeek(e.day, e.hour);
      await prisma.event.create({
        data: {
          title: e.title,
          type: e.type,
          startAt,
          endAt: new Date(startAt.getTime() + e.hours * 3600_000),
          creatorId: users[0].id,
          teamId: teamId(e.team),
          participants: { create: [{ userId: users[0].id, isOwner: true }] },
        },
      });
    }
  }

  console.log(`\n✅ Seed terminé.`);
  console.log(`   Connexion : ${demoUsers[0].email} / ${password}`);
  console.log(`   Permissions : ${Object.keys(PERMISSIONS).length} clés, ${DEFAULT_ROLES.length} rôles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
