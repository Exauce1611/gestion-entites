const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const db = require('./database');
const { authenticateToken, isAdmin, login } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// ============ ROUTES ============

app.post('/api/login', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  req.body.ip = ip;
  login(req, res);
});

app.get('/api/entities', authenticateToken, (req, res) => {
  db.all("SELECT * FROM entities ORDER BY id", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/stats/global', authenticateToken, (req, res) => {
  db.all(`
    SELECT 
      e.id, e.name, e.icon,
      COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense
    FROM entities e
    LEFT JOIN transactions t ON e.id = t.entity_id
    GROUP BY e.id
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const stats = rows.map(row => ({
      ...row,
      balance: row.total_income - row.total_expense
    }));
    res.json(stats);
  });
});

app.get('/api/transactions/recent/global', authenticateToken, (req, res) => {
  db.all(`
    SELECT t.*, e.name as entity_name, e.icon as entity_icon
    FROM transactions t
    JOIN entities e ON t.entity_id = e.id
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT 20
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/transactions/:entityId', authenticateToken, (req, res) => {
  db.all(`
    SELECT * FROM transactions 
    WHERE entity_id = ? 
    ORDER BY date DESC, created_at DESC 
    LIMIT 100
  `, [req.params.entityId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/transactions', authenticateToken, (req, res) => {
  const { entity_id, type, amount, description, date } = req.body;
  
  if (!entity_id || !type || !amount || !date) {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }
  
  db.run(`
    INSERT INTO transactions (entity_id, type, amount, description, date, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [entity_id, type, amount, description || '', date, req.user.username], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: 'Transaction ajoutée' });
  });
});

app.delete('/api/transactions/:id', authenticateToken, isAdmin, (req, res) => {
  db.run("DELETE FROM transactions WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Transaction supprimée' });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 SERVEUR DÉMARRÉ !`);
  console.log(`📱 Accédez à l'application: http://localhost:${PORT}`);
  console.log(`\n📝 IDENTIFIANTS DE CONNEXION:`);
  console.log(`   👤 Gérant: gerant / gerant123`);
  console.log(`   👤 Admin: admin / admin123`);
  console.log(`\n💡 Pour arrêter: Ctrl+C\n`);
});