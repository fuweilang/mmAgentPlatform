import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { networkInterfaces } from 'os';
import { AppModule } from './app.module';

function lanIPv4(): string[] {
  const ips: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) ips.push(a.address);
    }
  }
  return ips;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.enableCors({ origin: true, credentials: true });

  const port = Number(process.env.PORT ?? 3100);
  await app.listen(port, '0.0.0.0');

  const log = new Logger('Bootstrap');
  log.log(`Local:   http://localhost:${port}`);
  for (const ip of lanIPv4()) log.log(`Network: http://${ip}:${port}`);
}
bootstrap();
