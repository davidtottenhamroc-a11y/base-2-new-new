const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const app = express();
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});
// Configurações
app.use(cors()); 
app.use(express.json());

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
// NOVO SCHEMA PARA CADASTRO DE DOCUMENTAÇÃO
const documentacaoSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    estado: { type: String, required: true },
    tipoConteudo: { type: String, enum: ['TEXTO', 'PDF', 'HTML'], required: true }, // TEXTO, PDF, HTML
    texto: { type: String }, // Conteúdo de texto OU metadados do arquivo
    nomeArquivo: { type: String }, // Nome original do arquivo (se for upload)
    mimeType: { type: String }, // Tipo MIME do arquivo (se for upload)
    agente: { type: String },
    dataCadastro: { type: Date, default: Date.now }
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
// ----------------------------------------------------
// --- ROTAS PARA DOCUMENTAÇÃO (documentacao) ---
// ----------------------------------------------------

// POST: Cadastro de Novo Documento (usa 'upload.single('file')' para lidar com uploads)
app.post('/api/documentacao', upload.single('file'), async (req, res) => {
    try {
        const { titulo, estado, tipoConteudo, texto, agente } = req.body;

        if (!titulo || !estado || !tipoConteudo) {
            return res.status(400).send({ message: "Título, Estado e Tipo de Conteúdo são obrigatórios." });
        }

        let dataToSave = {
            titulo,
            estado,
            tipoConteudo,
            agente: agente || 'Sistema Web (Cadastro)'
        };

        if (tipoConteudo === 'TEXTO') {
            dataToSave.texto = texto;
        } else if (tipoConteudo === 'PDF' || tipoConteudo === 'HTML') {
            if (!req.file) {
                return res.status(400).send({ message: "Arquivo obrigatório para o tipo de conteúdo selecionado." });
            }

            // Salva apenas metadados do arquivo
            dataToSave.nomeArquivo = req.file.originalname;
            dataToSave.mimeType = req.file.mimetype;
            dataToSave.texto = `Arquivo: ${req.file.originalname}. Metadados salvos.`;
        }

        const novoDocumento = new Documentacao(dataToSave);
        await novoDocumento.save();

        res.status(201).send({ message: "Documento salvo com sucesso.", _id: novoDocumento._id, ...novoDocumento.toObject() });

    } catch (error) {
        console.error('Erro ao salvar documento:', error);
        res.status(400).send({ message: "Erro ao salvar documento.", error: error.message });
    }
});

// GET: Buscar Todos os Documentos
app.get('/api/documentacao', async (req, res) => {
    try {
        const documentos = await Documentacao.find({}).sort({ dataCadastro: -1 });
        res.send(documentos);
    } catch (error) {
        console.error('Erro ao buscar documentos:', error);
        res.status(500).send({ message: "Erro ao buscar documentos.", error: error.message });
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

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;





