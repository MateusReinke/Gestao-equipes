import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import morgan from 'morgan';
import { router } from './routes';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});
