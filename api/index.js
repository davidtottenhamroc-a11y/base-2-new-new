const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;

// Variável para rastrear o estado da conexão
let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb;
    }

    try {
        const db = await mongoose.connect(MONGODB_URI);
        cachedDb = db;
        return db;
    } catch (error) {
        console.error('Erro ao conectar ao banco de dados:', error);
        throw error;
    }
}

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
        'Wesley': '1234',
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
        await connectToDatabase();
        const novaAula = new Aula(req.body);
        await novaAula.save();
        res.status(201).send(novaAula);
    } catch (error) {
        res.status(400).send(error.message || 'Erro desconhecido ao salvar os dados.');
    }
});

// Rota para buscar todos os registros de aulas
app.get('/api/aulas', async (req, res) => {
    try {
        await connectToDatabase();
        const aulas = await Aula.find({});
        res.send(aulas);
    } catch (error) {
        res.status(500).send(error.message || 'Erro desconhecido ao buscar os dados.');
    }
});

// Rota para salvar um incidente
app.post('/api/incidentes', async (req, res) => {
    try {
        await connectToDatabase();
        const novoIncidente = new Incidente(req.body);
        await novoIncidente.save();
        res.status(201).send(novoIncidente);
    } catch (error) {
        res.status(400).send(error.message || 'Erro desconhecido ao salvar o incidente.');
    }
});

// Rota para buscar todos os incidentes
app.get('/api/incidentes', async (req, res) => {
    try {
        await connectToDatabase();
        const incidentes = await Incidente.find({});
        res.send(incidentes);
    } catch (error) {
        res.status(500).send(error.message || 'Erro desconhecido ao buscar os incidentes.');
    }
});

// Rota para deletar um incidente
app.delete('/api/incidentes/:id', async (req, res) => {
    try {
        await connectToDatabase();
        const incidente = await Incidente.findByIdAndDelete(req.params.id);
        if (!incidente) return res.status(404).send('Incidente não encontrado');
        res.send(incidente);
    } catch (error) {
        res.status(500).send(error.message || 'Erro desconhecido ao deletar o incidente.');
    }
});

module.exports = app;
