import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtAccessPayload } from '../common/types';

export type RealtimeEvent =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.moved'
  | 'ticket.archived'
  | 'event.created'
  | 'event.updated'
  | 'event.archived'
  | 'comment.created'
  | 'notification.created';

/**
 * Sync temps réel du planning + notifications.
 * Le client se connecte avec son access token : `io(url, { auth: { token } })`.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: [
      ...(process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
      ...(process.env.RENDER_EXTERNAL_URL ? [process.env.RENDER_EXTERNAL_URL] : []),
    ],
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) return client.disconnect(true);

    try {
      const payload = await this.jwt.verifyAsync<JwtAccessPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        return client.disconnect(true);
      }

      client.data.userId = payload.sub;
      // Salon personnel (notifications) + salon global (planning partagé).
      await client.join(`user:${payload.sub}`);
      await client.join('workspace');
      this.logger.debug(`Socket connecté : ${payload.email}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket déconnecté : ${client.data?.userId ?? 'inconnu'}`);
  }

  /** Diffuse à tout l'espace de travail (planning partagé). */
  broadcast(event: RealtimeEvent, payload: unknown) {
    this.server?.to('workspace').emit(event, payload);
  }

  /** Envoie à un utilisateur précis (notifications). */
  emitToUser(userId: string, event: RealtimeEvent, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
