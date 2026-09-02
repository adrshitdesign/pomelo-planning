import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { DEFAULT_ROLES, PERMISSION_DESCRIPTIONS } from '../rbac/permissions';

const DEFAULT_STATUSES = [
  { key: 'todo', name: 'À faire', color: '#94a3b8', position: 0, isDefault: true, isFinal: false },
  { key: 'planned', name: 'Planifié', color: '#38bdf8', position: 1, isDefault: false, isFinal: false },
  { key: 'in_progress', name: 'En cours', color: '#14b8a6', position: 2, isDefault: false, isFinal: false },
  { key: 'blocked', name: 'En attente', color: '#f59e0b', position: 3, isDefault: false, isFinal: false },
  { key: 'done', name: 'Terminé', color: '#22c55e', position: 4, isDefault: false, isFinal: true },
  { key: 'cancelled', name: 'Annulé', color: '#ef4444', position: 5, isDefault: false, isFinal: true },
];

const DEFAULT_TEAMS = [
  { name: 'Direction', color: '#6366f1' },
  { name: 'Production', color: '#14b8a6' },
  { name: 'Design', color: '#f97362' },
  { name: 'Développement', color: '#38bdf8' },
  { name: 'Commercial', color: '#f59e0b' },
];

/**
 * Initialisation au démarrage : permissions, rôles, statuts et équipes de base,
 * plus un compte administrateur si la base ne contient encore aucun utilisateur.
 * Idempotent — s'exécute sans risque à chaque redémarrage.
 * Désactivable avec AUTO_BOOTSTRAP=false.
 */
@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger('Bootstrap');

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.AUTO_BOOTSTRAP === 'false') return;

    try {
      await this.syncPermissions();
      await this.syncRoles();
      await this.syncStatuses();
      await this.syncTeams();
      await this.ensureAdmin();
    } catch (error) {
      // Une base non encore migrée ne doit pas empêcher l'API de démarrer.
      this.logger.warn(`Initialisation ignorée : ${String(error)}`);
    }
  }

  private async syncPermissions() {
    for (const [key, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
      await this.prisma.permission.upsert({
        where: { key },
        update: { description },
        create: { key, description },
      });
    }
  }

  private async syncRoles() {
    for (const role of DEFAULT_ROLES) {
      const existing = await this.prisma.role.findUnique({ where: { key: role.key } });
      const record =
        existing ??
        (await this.prisma.role.create({
          data: {
            key: role.key,
            name: role.name,
            description: role.description,
            isSystem: true,
          },
        }));

      // Les permissions d'un rôle système ne sont posées qu'à la création :
      // un ajustement fait depuis l'écran Administration n'est jamais écrasé.
      if (existing) continue;

      const permissions = await this.prisma.permission.findMany({
        where: { key: { in: [...role.permissions] } },
      });
      await this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: record.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }

  private async syncStatuses() {
    if ((await this.prisma.status.count()) > 0) return;
    await this.prisma.status.createMany({ data: DEFAULT_STATUSES, skipDuplicates: true });
  }

  private async syncTeams() {
    if ((await this.prisma.team.count()) > 0) return;
    await this.prisma.team.createMany({ data: DEFAULT_TEAMS, skipDuplicates: true });
  }

  private async ensureAdmin() {
    if ((await this.prisma.user.count()) > 0) return;

    const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@pomelo-paradigm.fr').toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(9).toString('base64url');
    const adminRole = await this.prisma.role.findUnique({ where: { key: 'admin' } });

    const user = await this.prisma.user.create({
      data: {
        email,
        name: 'Administrateur',
        passwordHash: await AuthService.hashPassword(password),
        roles: adminRole ? { create: [{ roleId: adminRole.id }] } : undefined,
      },
    });

    this.logger.log('─────────────────────────────────────────────');
    this.logger.log(`Compte administrateur créé : ${user.email}`);
    if (!process.env.SEED_ADMIN_PASSWORD) {
      this.logger.log(`Mot de passe généré : ${password}`);
      this.logger.log('À noter maintenant : il ne sera plus affiché.');
    }
    this.logger.log('─────────────────────────────────────────────');
  }
}
