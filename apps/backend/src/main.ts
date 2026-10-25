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

/** 缺省 CORS 白名单：本地开发的统一入口和两个前端 dev 端口（经网关/代理访问时本就同源）。 */
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5201',
  'http://127.0.0.1:5201',
  'http://localhost:5202',
  'http://127.0.0.1:5202',
  'http://localhost:5203',
  'http://127.0.0.1:5203',
];

function corsOrigins(): string[] {
  const list = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_CORS_ORIGINS;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.enableCors({ origin: corsOrigins(), credentials: true });

  const port = Number(process.env.PORT ?? 3100);
  await app.listen(port, '0.0.0.0');

  const log = new Logger('Bootstrap');
  log.log(`Local:   http://localhost:${port}`);
  for (const ip of lanIPv4()) log.log(`Network: http://${ip}:${port}`);
}
bootstrap();
