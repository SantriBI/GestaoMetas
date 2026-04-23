import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import rankingVendedoresRoutes from './src/routes/rankingVendedores.js';
import authRoutes from './src/routes/auth.js';
import vendedorRoutes from './src/routes/vendedor.js'
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



dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use('/api', rankingVendedoresRoutes);
app.use('/api', authRoutes);
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


// ============================
// Rota de teste
// ============================
app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', message: 'API funcionando 🚀' });
});


// ============================
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`🚀 API rodando em http://localhost:${PORT}`);
});
