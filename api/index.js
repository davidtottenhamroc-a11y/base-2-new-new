const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // NOVO: Importa a biblioteca JWT

const app = express();

// Configurações
app.use(cors()); 
app.use(express.json());

// --- Variáveis de Ambiente e Constantes ---
// **IMPORTANTE:** Mantenha a string de conexão real como Variável de Ambiente no Vercel.
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://davidtottenhamroc_db_user:tottenham0724@cluster0.tdopyuc.mongodb.net/test?retryWrites=true&w=majority";
const PORT = process.env.PORT || 3000; 

// Chave Secreta para gerar e verificar o JWT. **MUDAR EM PRODUÇÃO!**
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_muito_forte_aqui_12345'; 

// Senha pré-definida para cadastro (você pode mudar isso se quiser)
const PRE_DEFINED_ACCESS_PASSWORD = "otimus32";

// Conexão com o banco de dados MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Conectado ao MongoDB!'))
    .catch(err => console.error('Erro de conexão com o MongoDB:', err));

// ------------------------------------
// --- Schemas (Modelos de Dados) ---
// ------------------------------------

// SCHEMA PARA USUÁRIO (LOGIN E SENHA)
const userSchema = new mongoose.Schema({
    login: { type: String, required: true, unique: true },
    senha: { type: String, required: true }
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

// SCHEMA PARA MEMÓRIA DO CHATBOT
const memorySchema = new mongoose.Schema({
    agente: String,
    dataHora: { type: Date, default: Date.now },
    texto: String,
    estado: String,
    imagemUrl: String
});

// ------------------------------------
// --- Modelos Mongoose ---
// ------------------------------------
// O Mongoose cria a collection 'user' (terceiro parâmetro) automaticamente se ela não existir
const User = mongoose.model('User', userSchema, 'user'); 
const Aula = mongoose.model('Aula', aulaSchema);
const Incidente = mongoose.model('Incidente', incidenteSchema);
const Memory = mongoose.model('Memory', memorySchema); 

// ------------------------------------
// --- Middleware de Autenticação JWT ---
// ------------------------------------

/**
 * Middleware para verificar a validade do Token JWT
 * e garantir que o usuário está logado.
 */
const verifyToken = (req, res, next) => {
    // 1. Tenta obter o token do cabeçalho de Autorização (Bearer Token)
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Acesso negado. Token de autenticação ausente ou mal formatado.' });
    }

    // 2. Extrai o token após 'Bearer '
    const token = authHeader.split(' ')[1];

    try {
        // 3. Verifica o token usando a chave secreta
        const decoded = jwt.verify(token, JWT_SECRET);
        // Anexa as informações do usuário decodificado à requisição
        req.user = decoded;
        next(); // Continua para a próxima função (o handler da rota)
    } catch (error) {
        // 4. Se a verificação falhar (token expirado ou inválido)
        return res.status(401).json({ message: 'Acesso negado. Token inválido ou expirado. Faça login novamente.' });
    }
};

// ------------------------------------
// --- Rotas da API ---
// ------------------------------------

// Rota para criar um novo usuário - COM VALIDAÇÃO DE SENHA DE ACESSO
app.post('/api/users', async (req, res) => {
    try {
        const { login, senha, accessPassword } = req.body;

        // Verifica se a senha de acesso foi fornecida e está correta
        if (!accessPassword || accessPassword !== PRE_DEFINED_ACCESS_PASSWORD) {
            return res.status(403).send({ 
                message: "Acesso negado. Senha de acesso incorreta ou não fornecida." 
            });
        }

        if (!login || !senha) {
            return res.status(400).send({ message: "Login e senha são obrigatórios." });
        }
        
        // Cria o hash da senha
        const hashedPassword = await bcrypt.hash(senha, 10); 
        
        const novoUsuario = new User({
            login: login,
            senha: hashedPassword
        });
        
        // Ao chamar .save(), o Mongoose criará a collection 'user' se ela não existir.
        await novoUsuario.save();
        
        // Remove a senha/hash do objeto de resposta por segurança
        novoUsuario.senha = undefined; 
        res.status(201).send(novoUsuario);
    } catch (error) {
        // Tratamento de erro de login duplicado (código 11000)
        if (error.code === 11000) {
            return res.status(409).send({ message: "Este login já está em uso.", error: error.message });
        }
        res.status(400).send({ message: "Erro ao criar usuário.", error: error.message });
    }
});

// Rota para autenticação (MODIFICADA COM RESTRIÇÃO E GERAÇÃO DE TOKEN)
app.post('/api/login', async (req, res) => {
    try {
        // Recebe username, password E o novo campo 'target' do frontend
        const { username, password, target } = req.body;

        const user = await User.findOne({ login: username });

        if (!user) {
            return res.status(401).json({ authenticated: false, message: 'Credenciais inválidas.' });
        }
        
        // 1. Verifica a senha no banco de dados
        const isMatch = await bcrypt.compare(password, user.senha);
        
        if (!isMatch) {
            return res.status(401).json({ authenticated: false, message: 'Credenciais inválidas.' });
        }

        // 2. Lógica de Restrição Específica: Aplicada APENAS se o destino for 'knowledge_manager'
        if (target === 'knowledge_manager') {
            const allowedUsers = ["hyuri.passos", "david", "helio", "renataoliveira"];
            
            // Verifica se o usuário autenticado está na lista restrita (case-insensitive)
            if (!allowedUsers.includes(username.toLowerCase())) {
                // Se o usuário autenticado NÃO estiver na lista, nega o acesso
                return res.status(403).json({ 
                    authenticated: false, 
                    message: 'Acesso negado. Este painel é restrito aos usuários autorizados: Hyuri, David, Helio e Renata.' 
                });
            }
        }

        // 3. Geração do Token JWT (VÁLIDO PARA AMBOS OS TIPOS DE LOGIN)
        const token = jwt.sign(
            { id: user._id, login: user.login }, // Payload: informações do usuário
            JWT_SECRET,                          // Chave secreta
            { expiresIn: '1h' }                  // Token expira em 1 hora
        );
        
        // Se a senha e as restrições estiverem ok, retorna o token.
        res.json({ authenticated: true, message: 'Login bem-sucedido.', token: token });

    } catch (error) {
        console.error('Erro durante a autenticação:', error);
        res.status(500).json({ authenticated: false, message: 'Erro interno do servidor.' });
    }
});

// --- Rotas de Aulas (AGORA PROTEGIDAS) ---
app.post('/api/aulas', verifyToken, async (req, res) => {
    try {
        const novaAula = new Aula(req.body);
        await novaAula.save();
        res.status(201).send(novaAula);
    } catch (error) {
        res.status(400).send(error);
    }
});

app.get('/api/aulas', verifyToken, async (req, res) => {
    try {
        const aulas = await Aula.find({});
        res.send(aulas);
    } catch (error) {
        res.status(500).send(error);
    }
});

// --- Rotas de Incidentes (AGORA PROTEGIDAS) ---
app.post('/api/incidentes', verifyToken, async (req, res) => {
    try {
        const novoIncidente = new Incidente(req.body);
        await novoIncidente.save();
        res.status(201).send(novoIncidente);
    } catch (error) {
        res.status(400).send(error);
    }
});

app.get('/api/incidentes', verifyToken, async (req, res) => {
    try {
        const incidentes = await Incidente.find({});
        res.send(incidentes);
    } catch (error) {
        res.status(500).send(error);
    }
});

app.delete('/api/incidentes/:id', verifyToken, async (req, res) => {
    try {
        const incidente = await Incidente.findByIdAndDelete(req.params.id);
        if (!incidente) return res.status(404).send('Incidente não encontrado');
        res.send(incidente);
    } catch (error) {
        res.status(500).send(error);
    }
});

// --- ROTAS PARA MEMÓRIA DO CHATBOT (AGORA PROTEGIDAS) ---
app.post('/api/memories', verifyToken, async (req, res) => {
    try {
        const novaMemoria = new Memory(req.body);
        await novaMemoria.save();
        res.status(201).send(novaMemoria);
    } catch (error) {
        res.status(400).send(error);
    }
});

app.get('/api/memories', verifyToken, async (req, res) => {
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
