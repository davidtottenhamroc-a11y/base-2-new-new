const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');

// NOVO: Importações necessárias para upload de arquivos
const multer = require('multer');
const path = require('path');

const app = express();

// Configurações
app.use(cors()); 
app.use(express.json());


// =================================================================
// CONFIGURAÇÃO DO MULTER (Para gerenciar uploads de PDF/HTML)
// =================================================================

// Define onde os arquivos serão salvos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // O Multer criará a pasta 'uploads' se ela não existir
        cb(null, 'uploads/') 
    },
    filename: function (req, file, cb) {
        // Define um nome de arquivo único
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtra para aceitar apenas PDF e HTML
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'text/html') {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 1024 * 1024 * 10 } // Limite de 10MB
});


// --- Variáveis de Ambiente ---
// **IMPORTANTE:** Mantenha a string de conexão real como Variável de Ambiente no Vercel.
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://davidtottenhamroc_db_user:tottenham0724@cluster0.tdopyuc.mongodb.net/test?retryWrites=true&w=majority";
const PORT = process.env.PORT || 3000; 

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


// NOVO SCHEMA: ITENS DE CONHECIMENTO (para arquivos e textos)
const knowledgeItemSchema = new mongoose.Schema({
    titulo: { type: String, required: true, trim: true }, 
    estado: { type: String, required: true, enum: [
        "RN", "SE", "MS", "DF", "PE", "PB", "BA", "MG", "GO", "MA", "AL",
        "EXAME CE", "EXAME MA", "EXAME PB", "EXAME PE", "EXAME DF"
    ]}, 
    tipoConteudo: { type: String, required: true, enum: ['TEXTO', 'PDF', 'HTML'] }, 
    agente: { type: String, default: 'Sistema Web (Cadastro)' },
    dataHora: { type: Date, default: Date.now },
    texto: String, 
    // Armazena o caminho local do arquivo no servidor
    filePath: String, 
    // Armazena o nome original do arquivo (para download)
    fileRef: String 
});


// ------------------------------------
// --- Modelos Mongoose ---
// ------------------------------------
// O Mongoose cria a collection 'user' (terceiro parâmetro) automaticamente se ela não existir
const User = mongoose.model('User', userSchema, 'user'); 
const Aula = mongoose.model('Aula', aulaSchema);
const Incidente = mongoose.model('Incidente', incidenteSchema);
const Memory = mongoose.model('Memory', memorySchema); 

// NOVO MODELO: ITENS DE CONHECIMENTO
const KnowledgeItem = mongoose.model('KnowledgeItem', knowledgeItemSchema, 'knowledge_items'); 


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

// Rota para autenticação (MODIFICADA COM RESTRIÇÃO)
app.post('/api/login', async (req, res) => {
    try {
        // Recebe username, password E o novo campo 'target' do frontend
        const { username, password, target } = req.body;

        const user = await User.findOne({ login: username });

        if (!user) {
            return res.status(401).json({ authenticated: false, message: 'Credenciais inválidas (usuário).' });
        }
        
        // 1. Verifica a senha no banco de dados
        const isMatch = await bcrypt.compare(password, user.senha);
        
        if (!isMatch) {
            return res.status(401).json({ authenticated: false, message: 'Credenciais inválidas (senha).' });
        }

        // 2. Lógica de Restrição: Aplicada APENAS se o destino for 'knowledge_manager'
        if (target === 'knowledge_manager') {
            const allowedUsers = ["hyury.passos", "david", "helio", "renataoliveira"];
            
            // Verifica se o usuário autenticado está na lista restrita (case-insensitive)
            if (!allowedUsers.includes(username.toLowerCase())) {
                // Se o usuário autenticado NÃO estiver na lista, nega o acesso
                return res.status(403).json({ 
                    authenticated: false, 
                    message: 'Acesso negado. Este painel é restrito aos usuários autorizados: Hyuri, David, Helio e Renata.' 
                });
            }
        }
        
        // Se a senha estiver correta E as restrições forem cumpridas (ou não houver restrição)
        res.json({ authenticated: true, message: 'Login bem-sucedido.' });

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

// --- ROTAS PARA MEMÓRIA DO CHATBOT ---
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


// =================================================================
// NOVAS ROTAS: ITENS DE CONHECIMENTO (CADASTRO, LISTA E DOWNLOAD)
// =================================================================

// Rota POST para Salvar/Upload de Novo Item
app.post('/api/knowledge_items', upload.single('file'), async (req, res) => {
    try {
        const itemData = {
            titulo: req.body.titulo,
            estado: req.body.estado,
            tipoConteudo: req.body.tipoConteudo,
            agente: req.body.agente,
        };
        
        if (req.body.tipoConteudo === 'TEXTO') {
            itemData.texto = req.body.texto;
        } else {
            // Lógica para ARQUIVO (PDF/HTML)
            if (!req.file) {
                return res.status(400).send({ message: "Erro: Arquivo não enviado ou formato não suportado." });
            }
            // O Multer salvou o arquivo e preencheu req.file
            itemData.filePath = req.file.path; 
            itemData.fileRef = req.file.originalname; 
            itemData.texto = `Arquivo ${req.file.originalname} salvo no servidor.`;
        }

        if (!itemData.estado || knowledgeItemSchema.path('estado').enumValues.indexOf(itemData.estado) === -1) {
             return res.status(400).send({ message: "Erro: O estado fornecido é inválido." });
        }

        const novoItem = new KnowledgeItem(itemData);
        await novoItem.save();
        
        res.status(201).send(novoItem);
    } catch (error) {
        console.error('Erro ao salvar item de conhecimento:', error);
        res.status(500).send({ 
            message: "Erro interno do servidor ao processar o upload.", 
            error: error.message 
        });
    }
});


// Rota GET para Listar todos os Itens
app.get('/api/knowledge_items', async (req, res) => {
    try {
        const items = await KnowledgeItem.find({}).sort({ dataHora: -1 });
        res.send(items);
    } catch (error) {
        res.status(500).send({ message: "Erro ao buscar itens de conhecimento.", error: error.message });
    }
});


// Rota GET para Download do Arquivo
app.get('/api/knowledge_items/download/:id', async (req, res) => {
    try {
        const itemId = req.params.id;
        const item = await KnowledgeItem.findById(itemId);

        if (!item || !item.filePath) {
            return res.status(404).send({ message: 'Arquivo não encontrado no banco de dados ou item sem caminho.' });
        }
        
        // res.download envia o arquivo para o cliente
        res.download(item.filePath, item.fileRef, (err) => {
            if (err) {
                console.error('Erro ao enviar o arquivo para download:', err);
                res.status(500).send({ 
                    message: "Erro ao baixar o arquivo. Arquivo pode ter sido removido do servidor.",
                    error: err.message
                });
            }
        });

    } catch (error) {
        console.error('Erro ao processar download:', error);
        res.status(500).send({ message: "Erro interno do servidor." });
    }
});


// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
