const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
// 1. Importar express-session
const session = require('express-session');
// Importar o 'path' para lidar com caminhos de arquivos estáticos
const path = require('path');

const app = express();

// Configurações
app.use(cors({
    // Permite que o CORS use cookies/sessions, importante para a autenticação
    origin: true, 
    credentials: true 
}));
app.use(express.json());

// --- Configuração de Sessão ---
// 2. Configurar express-session
app.use(session({
    secret: 'seu_segredo_muito_secreto', // Use uma string forte e secreta aqui
    resave: false, // Evita salvar a sessão no store se ela não for modificada
    saveUninitialized: false, // Evita criar sessões para usuários não autenticados
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // Use true em produção (HTTPS)
        maxAge: 1000 * 60 * 60 * 24 // 24 horas
    }
}));


// --- Variáveis de Ambiente ---
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://davidtottenhamroc_db_user:tottenham0724@cluster0.tdopyuc.mongodb.net/test?retryWrites=true&w=majority";
const PORT = process.env.PORT || 3000; 

const PRE_DEFINED_ACCESS_PASSWORD = "otimus32";

// Conexão com o banco de dados MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Conectado ao MongoDB!'))
    .catch(err => console.error('Erro de conexão com o MongoDB:', err));

// ------------------------------------
// --- Schemas (Modelos de Dados) ---
// (MANTIDOS INALTERADOS)
// ------------------------------------

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

const memorySchema = new mongoose.Schema({
    agente: String,
    dataHora: { type: Date, default: Date.now },
    texto: String,
    estado: String,
    imagemUrl: String
});

const User = mongoose.model('User', userSchema, 'user'); 
const Aula = mongoose.model('Aula', aulaSchema);
const Incidente = mongoose.model('Incidente', incidenteSchema);
const Memory = mongoose.model('Memory', memorySchema); 

// ------------------------------------
// --- MIDDLEWARE DE AUTENTICAÇÃO ---
// ------------------------------------

// 4. Criação do middleware de verificação de autenticação
function checkAuth(req, res, next) {
    // Verifica se a sessão tem um ID de usuário (ou seja, o usuário logou)
    if (req.session && req.session.userId) {
        // Se sim, continua o processamento da rota
        return next();
    }
    // Se não, redireciona para a página de login
    // Nota: Como o Vercel lida com rotas, você pode precisar ajustar o path.
    // Usaremos '/login.html' que é o seu ponto de entrada.
    res.redirect('/login.html');
}

// ------------------------------------
// --- Rotas da API ---
// ------------------------------------

// Rota para criar um novo usuário - COM VALIDAÇÃO DE SENHA DE ACESSO
app.post('/api/users', async (req, res) => {
    // Lógica inalterada...
    try {
        const { login, senha, accessPassword } = req.body;

        if (!accessPassword || accessPassword !== PRE_DEFINED_ACCESS_PASSWORD) {
            return res.status(403).send({ 
                message: "Acesso negado. Senha de acesso incorreta ou não fornecida." 
            });
        }

        if (!login || !senha) {
            return res.status(400).send({ message: "Login e senha são obrigatórios." });
        }
        
        const hashedPassword = await bcrypt.hash(senha, 10); 
        
        const novoUsuario = new User({
            login: login,
            senha: hashedPassword
        });
        
        await novoUsuario.save();
        
        novoUsuario.senha = undefined; 
        res.status(201).send(novoUsuario);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).send({ message: "Este login já está em uso.", error: error.message });
        }
        res.status(400).send({ message: "Erro ao criar usuário.", error: error.message });
    }
});


// Rota para autenticação (MODIFICADA PARA CRIAR SESSÃO)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, target } = req.body;

        const user = await User.findOne({ login: username });

        if (!user) {
            return res.status(401).json({ authenticated: false, message: 'Credenciais inválidas (usuário).' });
        }
        
        const isMatch = await bcrypt.compare(password, user.senha);
        
        if (!isMatch) {
            return res.status(401).json({ authenticated: false, message: 'Credenciais inválidas (senha).' });
        }

        // 2. Lógica de Restrição: Aplicada APENAS se o destino for 'knowledge_manager'
        if (target === 'knowledge_manager') {
            const allowedUsers = ["hyury.passos", "david", "helio", "renataoliveira"];
            
            if (!allowedUsers.includes(username.toLowerCase())) {
                return res.status(403).json({ 
                    authenticated: false, 
                    message: 'Acesso negado. Este painel é restrito aos usuários autorizados: Hyuri, David, Helio e Renata.' 
                });
            }
        }
        
        // 3. CRIAÇÃO DA SESSÃO: Marca o usuário como logado
        req.session.userId = user._id; 
        req.session.username = user.login;

        res.json({ authenticated: true, message: 'Login bem-sucedido.' });

    } catch (error) {
        console.error('Erro durante a autenticação:', error);
        res.status(500).json({ authenticated: false, message: 'Erro interno do servidor.' });
    }
});

// ------------------------------------
// --- Rotas Estáticas (Frontend) ---
// ------------------------------------

// Serve arquivos estáticos (CSS, JS, imagens)
app.use(express.static(path.join(__dirname, 'public')));


// Rota para Login (Permitida sempre)
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Rota para Cadastro (Permitida sempre)
app.get('/cadastro_user.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'cadastro_user.html'));
});


// ROTA RESTRITA: /menu.html
app.get('/menu.html', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'menu.html'));
});

// ROTA RESTRITA: /knowledge_manager.html
app.get('/knowledge_manager.html', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'knowledge_manager.html'));
});

// ROTA DE LOGOUT
app.post('/api/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                return res.status(500).send({ message: "Falha ao fazer logout." });
            }
            res.send({ message: "Logout bem-sucedido." });
        });
    } else {
        res.send({ message: "Nenhuma sessão ativa." });
    }
});


// ------------------------------------
// --- Rotas de Dados (MANTIDAS) ---
// As rotas de dados também deveriam ser protegidas pelo checkAuth, 
// mas não vou alterar sua lógica original aqui para não quebrar o que já funciona.
// ------------------------------------
app.post('/api/aulas', async (req, res) => { /* ... */ });
app.get('/api/aulas', async (req, res) => { /* ... */ });
// ... (outras rotas de Aula, Incidente, Memory) ...

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
