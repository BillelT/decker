import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './env.js';
import { authRouter } from './routes/auth.js';
import { assetsRouter } from './routes/assets.js';
import { exportRouter } from './routes/export.js';

const app = express();

app.use(
  cors({
    origin: env.allowedOrigins.length > 0 ? env.allowedOrigins : false,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use(authRouter);
app.use(assetsRouter);
app.use(exportRouter);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`figma-to-slides backend listening on :${env.port}`);
});
