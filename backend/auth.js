const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret_temp';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Session expirée' });
    }
    req.user = user;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  next();
};

const login = (req, res) => {
  const { username, password, ip } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }

  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    if (!user) {
      db.run("INSERT INTO login_logs (username, ip, success) VALUES (?, ?, ?)", 
        [username, ip, 0]);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      db.run("INSERT INTO login_logs (username, ip, success) VALUES (?, ?, ?)", 
        [username, ip, 0]);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    db.run("INSERT INTO login_logs (username, ip, success) VALUES (?, ?, ?)", 
      [username, ip, 1]);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: { username: user.username, role: user.role }
    });
  });
};

module.exports = { authenticateToken, isAdmin, login };