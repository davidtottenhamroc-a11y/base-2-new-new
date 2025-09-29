const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Configurações
app.use(cors());
app.use(express.json());

// --- Variáveis de Ambiente ---
const MONGODB_URI = process.env.MONGODB_URI; 
const PORT = process.env.PORT || 3000; // Define a porta

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

// SCHEMA PARA MEMÓRIA DO CHATBOT
const memorySchema = new mongoose.Schema({
    agente: String,
    dataHora: { type: Date, default: Date.now },
    texto: String
});

const Aula = mongoose.model('Aula', aulaSchema);
const Incidente = mongoose.model('Incidente', incidenteSchema);
const Memory = mongoose.model('Memory', memorySchema); // NOVO MODEL

// --- Rotas da API ---

// Rota para autenticação (Corrigida para usar /api/login)
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

// --- NOVAS ROTAS PARA MEMÓRIA DO CHATBOT ---

app.post('/api/memories', async (req, res) => {
    try {
        const novaMemoria = new Memory(req.body);
        await novaMemoria.save();
        res.status(201).send(novaMemoria);
    } catch (error) {
        res.status(400).send(error);
    }
});

app.get('/api/memories', async (req, res) => {
    try {
        const memories = await Memory.find({}).sort({ dataHora: -1 });
        res.send(memories);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Adiciona uma rota base para testar
app.get('/', (req, res) => {
    res.send('API VSoft N2 está rodando!');
});

// Inicia o servidor, essencial para o funcionamento
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
