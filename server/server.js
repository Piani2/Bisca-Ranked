const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient('mongodb://localhost:27017');
let db;

async function conectar() {
  await client.connect();
  db = client.db('meu_banco');
  console.log('✅ Conectado ao MongoDB');
}
conectar();

// ── ROTAS ──────────────────────────────────────────

// Listar todos
app.get('/itens', async (req, res) => {
  const itens = await db.collection('itens').find().toArray();
  res.json(itens);
});

// Buscar por ID
app.get('/itens/:id', async (req, res) => {
  const item = await db.collection('itens').findOne({ _id: new ObjectId(req.params.id) });
  res.json(item);
});

// Criar
app.post('/itens', async (req, res) => {
  const resultado = await db.collection('itens').insertOne(req.body);
  res.json(resultado);
});

// Atualizar
app.put('/itens/:id', async (req, res) => {
  const resultado = await db.collection('itens').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: req.body }
  );
  res.json(resultado);
});

// Deletar
app.delete('/itens/:id', async (req, res) => {
  const resultado = await db.collection('itens').deleteOne({ _id: new ObjectId(req.params.id) });
  res.json(resultado);
});

// ───────────────────────────────────────────────────

app.listen(3000, () => console.log('🚀 Servidor rodando em http://localhost:3000'));