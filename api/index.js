const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Configurações
app.use(cors());
app.use(express.json());

// String de Conexão do MongoDB
// IMPORTANTE: A Vercel lerá esta variável de ambiente que você configurou.
const MONGODB_URI = process.env.MONGODB_URI; 

// Conexão com o banco de dados MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Conectado ao MongoDB!'))
    .catch(err => console.error('Erro de conexão com o MongoDB:', err));

// --- Schemas (Modelos de Dados) ---
const aulaSchema = new mongoose.Schema({
    agente: String,
    estado: String,
    tipoRegistro: String,
    data: String,
    total: Number,
    execucao: Number,
    naoEnviadas: Number,
    recusadas: Number,
    processamento: Number,
    status: String,
    observacao: String
});

const incidenteSchema = new mongoose.Schema({
    agente: String,
    estado: String,
    data: String,
    observacao: String
});

const Aula = mongoose.model('Aula', aulaSchema);
const Incidente = mongoose.model('Incidente', incidenteSchema);

// --- Rotas da API ---

// Rota para autenticação
app.post('/api/login', (req, res) => {
    const users = {
        'Wesley': 'wqtm1234',
        'David': '456'
    };
    const { username, password } = req.body;
    if (users[username] && users[username] === password) {
        res.json({ authenticated: true });
    } else {
        res.status(401).json({ authenticated: false, message: 'Invalid credentials' });
    }
});

// Rota para salvar um registro de aula
app.post('/api/aulas', async (req, res) => {
    try {
        const novaAula = new Aula(req.body);
        await novaAula.save();
        res.status(201).send(novaAula);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Rota para buscar todos os registros de aulas
app.get('/api/aulas', async (req, res) => {
    try {
        const aulas = await Aula.find({});
        res.send(aulas);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Rota para salvar um incidente
app.post('/api/incidentes', async (req, res) => {
    try {
        const novoIncidente = new Incidente(req.body);
        await novoIncidente.save();
        res.status(201).send(novoIncidente);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Rota para buscar todos os incidentes
app.get('/api/incidentes', async (req, res) => {
    try {
        const incidentes = await Incidente.find({});
        res.send(incidentes);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Rota para deletar um incidente
app.delete('/api/incidentes/:id', async (req, res) => {
    try {
        const incidente = await Incidente.findByIdAndDelete(req.params.id);
        if (!incidente) return res.status(404).send('Incidente não encontrado');
        res.send(incidente);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = app;




