import './src/config/env.js';
import './src/db/oracleClient.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './src/routes/auth.js';
import superadminRoutes from './src/routes/superadmin.js';
import rankingVendedoresRoutes from './src/routes/rankingVendedores.js';
import vendedorRoutes from './src/routes/vendedor.js';
import alertasRankingRoutes from './src/routes/alertasRanking.js';
import areaAtaqueRoutes from './src/routes/areaAtaque.js';
import investigarClienteRoutes from './src/routes/investigarCliente.js';
import radarVendasRoutes from './src/routes/radarVendas.js';
import usuariosRoutes from './src/routes/usuarios.js';
import assistenteVendasRoutes from './src/routes/assistenteVendas.js';
import ativacaoClientesRoutes from './src/routes/ativacaoClientes.js';
import feedRoutes from './src/routes/feed.js';
import desafiosRoutes from './src/routes/desafios.js';
import objetivoVendedorRoutes from './src/routes/objetivoVendedor.js';
import perfilVendedorRoutes from './src/routes/perfilVendedor.js';
import industriaRoutes from './src/routes/industria.js';
import whatsappAdminRoutes from './src/routes/whatsappAdmin.js';
import feedbackRoutes from './src/routes/feedback.js';
import gerenteSistemasRoutes from './src/routes/gerenteSistemas.js';
import vendedorKanbanRoutes from './src/routes/vendedorKanban.js';
import lojaAcessoRoutes from './src/routes/lojaAcesso.js';



import organizacoesRoutes from './src/routes/organizacoes.js';
import { ensureCentralSchema } from './src/db/mysql-tenants.js';
import { describeMysqlTarget, formatDbError } from './src/db/mysql.js';


const app = express();

const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '8mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API funcionando' });
});

app.use('/api', authRoutes);
app.use('/api', superadminRoutes);
app.use('/api', rankingVendedoresRoutes);
app.use('/api', vendedorRoutes);
app.use('/api', alertasRankingRoutes);
app.use('/api', areaAtaqueRoutes);
app.use('/api', investigarClienteRoutes);
app.use('/api', radarVendasRoutes);
app.use('/api', usuariosRoutes);
app.use('/api', assistenteVendasRoutes);
app.use('/api', ativacaoClientesRoutes);
app.use('/api', feedRoutes);
app.use('/api', desafiosRoutes);
app.use('/api', objetivoVendedorRoutes);
app.use('/api', perfilVendedorRoutes);
app.use('/api', industriaRoutes);
app.use('/api', whatsappAdminRoutes);
app.use('/api', feedbackRoutes);
app.use('/api', gerenteSistemasRoutes);
app.use('/api', organizacoesRoutes);
app.use('/api', vendedorKanbanRoutes);
app.use('/api', lojaAcessoRoutes);

const PORT = Number(process.env.PORT || 3001);

ensureCentralSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API rodando em http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(
      `Falha ao inicializar schema central MySQL (${describeMysqlTarget({ admin: true })}):`,
      formatDbError(err)
    );
    // Inicia mesmo assim para nao derrubar Oracle se MySQL estiver fora
    app.listen(PORT, () => {
      console.log(`API rodando em http://localhost:${PORT} (sem MySQL central)`);
    });
  });