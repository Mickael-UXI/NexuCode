import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './lib/env.js';
import { chatRouter } from './routes/chat.js';
import { searchRouter } from './routes/search.js';
import { browseRouter } from './routes/browse.js';
import { githubRouter } from './routes/github.js';
import { zipRouter } from './routes/zip.js';
import { stripeRouter } from './routes/stripe.js';
import { adminRouter } from './routes/admin.js';
import { sandboxRouter } from './routes/sandbox.js';
import { memoryRouter } from './routes/memory.js';
import { filesRouter } from './routes/files.js';

const app = express();

app.use(cors({ origin: env.APP_BASE_URL, credentials: true }));
app.use(cookieParser());

// O webhook do Stripe precisa do corpo cru, então é registrado ANTES do express.json().
app.use('/api', stripeRouter);

// Limite generoso: o /files/extract recebe arquivos (incluindo .zip de projetos inteiros)
// como base64 no corpo JSON, que infla o tamanho em ~33% sobre o arquivo original — 15mb
// truncava zips de projetos reais silenciosamente (erro genérico do body-parser antes
// mesmo de chegar na rota). 50mb cobre um .zip de dezenas de arquivos de texto com folga.
app.use(express.json({ limit: '50mb' }));

app.use('/api', chatRouter);
app.use('/api', searchRouter);
app.use('/api', browseRouter);
app.use('/api', githubRouter);
app.use('/api', zipRouter);
app.use('/api', adminRouter);
app.use('/api', sandboxRouter);
app.use('/api', memoryRouter);
app.use('/api', filesRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(env.PORT, () => {
  console.log(`Nexus API rodando em http://localhost:${env.PORT}`);
});
