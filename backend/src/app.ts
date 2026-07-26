import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { router } from './routes';
import { env } from './config/env';
import { apiRateLimit } from './middleware/rateLimit';

export const app = express();

/**
 * Atrás do proxy do Coolify/nginx, sem isto `req.ip` seria sempre o IP do
 * proxy — o rate limit viraria global e a auditoria registraria o endereço
 * errado. `1` = confia em um único salto, que é o desenho do deploy.
 */
app.set('trust proxy', 1);

// A API não serve HTML; do helmet interessam aqui as políticas de transporte
// e as que evitam vazamento de metadados.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
  })
);

/**
 * O navegador nunca fala com esta API direto: o frontend usa Server Components
 * e um proxy em `/api/*`, ambos server-side. Por isso o padrão é não liberar
 * origem nenhuma. `CORS_ORIGINS` existe para quem precisar expor a API a um
 * cliente externo — uma lista separada por vírgula.
 */
app.use(
  cors({
    origin: env.corsOrigins.length > 0 ? env.corsOrigins : false,
    credentials: env.corsOrigins.length > 0,
  })
);

// Um layout de dashboard é o maior corpo que a API recebe e fica bem abaixo
// disto; o limite corta corpo absurdo antes de qualquer parsing.
app.use(express.json({ limit: '256kb' }));
app.use(morgan('dev'));
app.use(apiRateLimit);
app.use(router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});
