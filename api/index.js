const express = require('express');

const mongoose = require('mongoose');

const cors = require('cors');



const app = express();



app.use(cors());

app.use(express.json());



const MONGODB_URI = process.env.MONGODB_URI;



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



app.post('/api/aulas', async (req, res) => {

    try {

        await connectToDatabase();

        const novaAula = new Aula(req.body);

        await novaAula.save();

        res.status(201).send(novaAula);

    } catch (error) {

        // Envia o erro do Mongoose para o frontend

        res.status(400).send(`Erro de validação: ${error.message}` || 'Erro desconhecido ao salvar os dados.');

    }

});



app.get('/api/aulas', async (req, res) => {

    try {

        await connectToDatabase();

        const aulas = await Aula.find({});

        res.send(aulas);

    } catch (error) {

        res.status(500).send(`Erro de conexão com o banco: ${error.message}` || 'Erro desconhecido ao buscar os dados.');

    }

});



app.post('/api/incidentes', async (req, res) => {

    try {

        await connectToDatabase();

        const novoIncidente = new Incidente(req.body);

        await novoIncidente.save();

        res.status(201).send(novoIncidente);

    } catch (error) {

        res.status(400).send(`Erro de validação: ${error.message}` || 'Erro desconhecido ao salvar o incidente.');

    }

});



app.get('/api/incidentes', async (req, res) => {

    try {

        await connectToDatabase();

        const incidentes = await Incidente.find({});

        res.send(incidentes);

    } catch (error) {

        res.status(500).send(`Erro de conexão com o banco: ${error.message}` || 'Erro desconhecido ao buscar os incidentes.');

    }

});



app.delete('/api/incidentes/:id', async (req, res) => {

    try {

        await connectToDatabase();

        const incidente = await Incidente.findByIdAndDelete(req.params.id);

        if (!incidente) return res.status(404).send('Incidente não encontrado');

        res.send(incidente);

    } catch (error) {

        res.status(500).send(`Erro de conexão com o banco: ${error.message}` || 'Erro desconhecido ao deletar o incidente.');

    }

});



module.exports = app;
