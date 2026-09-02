import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { UsersModule } from './users/users.module';
import { TeamsModule } from './teams/teams.module';
import { ClientsModule } from './clients/clients.module';
import { StatusesModule } from './statuses/statuses.module';
import { TicketsModule } from './tickets/tickets.module';
import { EventsModule } from './events/events.module';
import { PlanningModule } from './planning/planning.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BootstrapModule } from './bootstrap/bootstrap.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

@Module({
  imports: [
    // Les secrets viennent uniquement de l'environnement (brief section 11).
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    AuditModule,
    RealtimeModule,
    AuthModule,
    RbacModule,
    UsersModule,
    TeamsModule,
    ClientsModule,
    StatusesModule,
    TicketsModule,
    EventsModule,
    PlanningModule,
    NotificationsModule,
    BootstrapModule,
  ],
  providers: [
    // Authentification obligatoire par défaut, sauf routes @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Puis contrôle des permissions déclarées par chaque route.
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
