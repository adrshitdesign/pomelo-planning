import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    helmet({
      // Le frontend servi par la même app charge ses propres scripts/styles.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());
  app.setGlobalPrefix('api');

  // L'adresse publique fournie par l'hébergeur est toujours autorisée.
  const origins = [
    ...(process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
    ...(process.env.RENDER_EXTERNAL_URL ? [process.env.RENDER_EXTERNAL_URL] : []),
  ].filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  // Validation systématique côté serveur (brief section 11).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Pomelo-Paradigm — Planning API')
      .setDescription('Planning, tickets, événements, RBAC')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  // En production, la même application sert aussi le frontend compilé :
  // une seule adresse, donc pas de problème de cookies ni de CORS.
  const webDist = process.env.WEB_DIST ?? join(__dirname, '..', '..', 'web', 'dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
      res.sendFile(join(webDist, 'index.html'));
    });
    Logger.log(`Frontend servi depuis ${webDist}`, 'Bootstrap');
  }

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API prête sur le port ${port}`, 'Bootstrap');
}

void bootstrap();
