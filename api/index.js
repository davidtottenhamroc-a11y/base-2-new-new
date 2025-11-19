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

// NOVO SCHEMA PARA CADASTRO DE DOCUMENTAÇÃO (COM ARMAZENAMENTO DE BUFFER E SUBPASTA)
const documentacaoSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    estado: { type: String, required: true },
    subpasta: { type: String, required: true }, // <-- CAMPO SUBPASTA AGORA FAZ PARTE DO SCHEMA
    tipoConteudo: { type: String, enum: ['TEXTO', 'PDF', 'HTML'], required: true }, 
    texto: { type: String }, // Conteúdo de texto OU metadados do arquivo
    nomeArquivo: { type: String }, // Nome original do arquivo (se for upload)
    mimeType: { type: String }, // Tipo MIME do arquivo (se for upload)
    
    // ARMAZENAMENTO DO ARQUIVO BINÁRIO (BUFFER)
    fileData: { type: Buffer, select: false }, // ARMAZENADO, MAS EXCLUÍDO POR PADRÃO NAS BUSCAS
    fileSize: { type: Number },   
    
    agente: { type: String },
    dataCadastro: { type: Date, default: Date.now }
});

// ------------------------------------
// --- Modelos Mongoose ---
// ------------------------------------
const User = mongoose.model('User', userSchema, 'user'); 
const Aula = mongoose.model('Aula', aulaSchema);
const Incidente = mongoose.model('Incidente', incidenteSchema);
const Memory = mongoose.model('Memory', memorySchema); 
const Documentacao = mongoose.model('Documentacao', documentacaoSchema, 'documentacao');

// ------------------------------------
// --- Rotas da API ---
// ------------------------------------

// Rota para criar um novo usuário - COM VALIDAÇÃO DE SENHA DE ACESSO
app.post('/api/users', async (req, res) => {
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

// Rota para autenticação (MODIFICADA COM RESTRIÇÃO)
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

        if (target === 'knowledge_manager') {
            const allowedUsers = ["hyury.passos", "david", "helio", "renataoliveira"];
            
            if (!allowedUsers.includes(username.toLowerCase())) {
                return res.status(403).json({ 
                    authenticated: false, 
                    message: 'Acesso negado. Este painel é restrito aos usuários autorizados: Hyuri, David, Helio e Renata.' 
                });
            }
        }
        
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

// POST: Cadastro de Novo Documento (Salvando o Buffer no Mongo)
app.post('/api/documentacao', upload.single('file'), async (req, res) => {
    try {
        const { titulo, estado, tipoConteudo, texto, agente, subpasta } = req.body;

        if (!titulo || !estado || !tipoConteudo || !subpasta) {
            return res.status(400).send({ message: "Título, Estado, Tipo de Conteúdo e Subpasta são obrigatórios." });
        }

        let dataToSave = {
            titulo,
            estado,
            tipoConteudo,
            agente: agente || 'Sistema Web (Cadastro)',
            subpasta, 
        };

        if (tipoConteudo === 'TEXTO') {
            
            if (!texto) {
                 return res.status(400).send({ message: "O conteúdo do texto é obrigatório." });
            }
            dataToSave.texto = texto;
            
            const textBuffer = Buffer.from(texto, 'utf8');
            
            dataToSave.fileData = textBuffer; 
            dataToSave.fileSize = textBuffer.length;
            
            const safeTitle = titulo.substring(0, 50).replace(/[^a-zA-Z0-9\s]/g, '_').trim();
            dataToSave.nomeArquivo = `${safeTitle || 'documento_texto'}.txt`; 
            dataToSave.mimeType = 'text/plain'; 

        } else if (tipoConteudo === 'PDF' || tipoConteudo === 'HTML') {
            
            if (!req.file) {
                return res.status(400).send({ message: "Arquivo obrigatório para o tipo de conteúdo selecionado." });
            }

            dataToSave.nomeArquivo = req.file.originalname;
            dataToSave.mimeType = req.file.mimetype;
            dataToSave.texto = `Arquivo: ${req.file.originalname}. Conteúdo binário armazenado no MongoDB.`;
            dataToSave.fileData = req.file.buffer; 
            dataToSave.fileSize = req.file.size;   
        }

        const novoDocumento = new Documentacao(dataToSave);
        await novoDocumento.save();

        novoDocumento.fileData = undefined; 

        res.status(201).send({ message: "Documento salvo com sucesso.", _id: novoDocumento._id, ...novoDocumento.toObject() });

    } catch (error) {
        console.error('Erro ao salvar documento:', error);
        if (error.code === 10334 || error.name === 'MongoError' && error.message.includes('Document size')) {
             return res.status(400).send({ message: "Erro: O arquivo é muito grande. O limite de documento do MongoDB é 16MB.", error: error.message });
        }
        res.status(400).send({ message: "Erro ao salvar documento.", error: error.message });
    }
});


// GET: Download do Arquivo Binário (Buffer) do MongoDB
app.get('/api/documentacao/download/:id', async (req, res) => {
    try {
        const docId = req.params.id;
        
        const documento = await Documentacao.findById(docId).select('+fileData'); 

        if (!documento) {
            return res.status(404).send({ message: "Documento não encontrado." });
        }
        
        if (!documento.fileData) { 
            return res.status(400).send({ message: "Este item não possui um arquivo binário anexado para download." });
        }

        res.setHeader('Content-disposition', `attachment; filename="${documento.nomeArquivo}"`);
        res.setHeader('Content-type', documento.mimeType);
        res.setHeader('Content-Length', documento.fileSize);
        
        res.send(documento.fileData);

    } catch (error) {
        console.error('Erro ao processar download:', error);
        res.status(500).send({ message: "Erro interno do servidor ao tentar o download.", error: error.message });
    }
});

// GET: Rota para buscar conteúdo para visualização no modal
app.get('/api/documentacao/content/:id', async (req, res) => {
    try {
        const docId = req.params.id;
        // Seleciona todos os metadados e o fileData
        const documento = await Documentacao.findById(docId).select('+fileData'); 

        if (!documento) {
            return res.status(404).send({ message: "Documento não encontrado." });
        }
        
        const responseData = {
            titulo: documento.titulo,
            tipoConteudo: documento.tipoConteudo,
            mimeType: documento.mimeType,
            
            // Prepara o conteúdo: Texto simples ou Buffer em Base64
            content: documento.tipoConteudo === 'TEXTO' 
                     ? documento.texto // Se for texto, envia a string
                     : (documento.fileData ? documento.fileData.toString('base64') : null), // Se for binário, envia em Base64
            
            nomeArquivo: documento.nomeArquivo,
            estado: documento.estado,
            subpasta: documento.subpasta // <-- SUBPASTA INCLUÍDA
        };

        res.send(responseData);
        
    } catch (error) {
        console.error('Erro ao buscar conteúdo para modal:', error);
        res.status(500).send({ message: "Erro interno do servidor ao buscar conteúdo.", error: error.message });
    }
});


// GET: Buscar Todos os Documentos (Excluindo o Buffer)
app.get('/api/documentacao', async (req, res) => {
    try {
        // Busca e exclui o Buffer. O campo 'subpasta' é retornado por padrão.
        const documentos = await Documentacao.find({}).select('-fileData').sort({ dataCadastro: -1 });
        res.send(documentos);
    } catch (error) {
        console.error('Erro ao buscar documentos:', error);
        res.status(500).send({ message: "Erro ao buscar documentos.", error: error.message });
    }
});


// --- Rotas de Aulas, Incidentes e Memories (sem alterações) ---
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
// --- FIM DAS ROTAS ---
// ----------------------------------------------------


// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
