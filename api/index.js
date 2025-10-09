const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Configurações
// Permite requisições de origens diferentes (CORS)
app.use(cors()); 
app.use(express.json());

// --- Variáveis de Ambiente ---
// A string de conexão do seu Atlas que deve estar configurada na Vercel
const MONGODB_URI = process.env.MONGODB_URI; 
const PORT = process.env.PORT || 3000; 

// Conexão com o banco de dados MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Conectado ao MongoDB!'))
    .catch(err => console.error('Erro de conexão com o MongoDB:', err));

// ------------------------------------
// --- Schemas (Modelos de Dados) ---
// ------------------------------------

// SCHEMA PARA USUÁRIO (LOGIN E SENHA)
const userSchema = new mongoose.Schema({
    login: { type: String, required: true, unique: true }, // Nome de usuário/Login
    senha: { type: String, required: true } // Senha (no mundo real, deve ser hasheada com bcrypt)
});

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

// SCHEMA PARA MEMÓRIA DO CHATBOT - AGORA COM CAMPO PARA IMAGEM
const memorySchema = new mongoose.Schema({
    agente: String,
    dataHora: { type: Date, default: Date.now },
    texto: String, // Usado para armazenar o conteúdo (conteudo) e título
    estado: String, // Usado para o filtro do estado
    imagemUrl: String // NOVIDADE: Campo para a URL da imagem
});

// ------------------------------------
// --- Modelos Mongoose ---
// ------------------------------------
// NOME DA COLLECTION FORÇADO PARA 'user' (terceiro argumento)
const User = mongoose.model('User', userSchema, 'user'); 
const Aula = mongoose.model('Aula', aulaSchema);
const Incidente = mongoose.model('Incidente', incidenteSchema);
const Memory = mongoose.model('Memory', memorySchema); 

// ------------------------------------
// --- Rotas da API ---
// ------------------------------------

// Rota para criar um novo usuário (Para fins de teste e inserção inicial de dados)
app.post('/api/user', async (req, res) => {
    try {
        // ATENÇÃO: Em produção, o campo 'senha' deve ser hasheado com bcrypt antes de salvar
        const novoUsuario = new User(req.body);
        await novoUsuario.save();
        // Remove a senha do objeto de resposta por segurança
        novoUsuario.senha = undefined;
        res.status(201).send(novoUsuario);
    } catch (error) {
        res.status(400).send({ message: "Erro ao criar usuário.", error: error.message });
    }
});


// Rota para autenticação - AGORA CONSULTA O BANCO DE DADOS
app.post('/api/user', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Procura no banco de dados por um usuário na coleção 'user'
        const user = await User.findOne({
            login: login,
            // ATENÇÃO: Para produção, a senha aqui deve ser comparada com a versão hasheada
            senha: senha 
        });

        if (user) {
            // Usuário encontrado: Autenticação bem-sucedida
            res.json({ authenticated: true, message: 'Login bem-sucedido.' });
        } else {
            // Usuário não encontrado ou senha incorreta
            res.status(401).json({ authenticated: false, message: 'Credenciais inválidas.' });
        }
    } catch (error) {
        console.error('Erro durante a autenticação:', error);
        res.status(500).json({ authenticated: false, message: 'Erro interno do servidor.' });
    }
});

// --- Rotas de Aulas ---

app.post('/api/aulas', async (req, res) => {
    try {
        const novaAula = new Aula(req.body);
        await novaAula.save();
        res.status(201).send(novaAula);
    } catch (error) {
        res.status(400).send(error);
    }
});

app.get('/api/aulas', async (req, res) => {
    try {
        const aulas = await Aula.find({});
        res.send(aulas);
    } catch (error) {
        res.status(500).send(error);
    }
});

// --- Rotas de Incidentes ---

app.post('/api/incidentes', async (req, res) => {
    try {
        const novoIncidente = new Incidente(req.body);
        await novoIncidente.save();
        res.status(201).send(novoIncidente);
    } catch (error) {
        res.status(400).send(error);
    }
});

app.get('/api/incidentes', async (req, res) => {
    try {
        const incidentes = await Incidente.find({});
        res.send(incidentes);
    } catch (error) {
        res.status(500).send(error);
    }
});

app.delete('/api/incidentes/:id', async (req, res) => {
    try {
        const incidente = await Incidente.findByIdAndDelete(req.params.id);
        if (!incidente) return res.status(404).send('Incidente não encontrado');
        res.send(incidente);
    } catch (error) {
        res.status(500).send(error);
    }
});

// --- ROTAS PARA MEMÓRIA DO CHATBOT (MongoDB) ---

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

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
