const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'gestion.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Table des utilisateurs
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('gerant', 'admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table des entités
  db.run(`
    CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table des transactions
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      amount DECIMAL(10,2) NOT NULL,
      description TEXT,
      date DATETIME NOT NULL,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(entity_id) REFERENCES entities(id)
    )
  `);

  // Table des logs
  db.run(`
    CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      ip TEXT,
      success INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

const initDefaultData = async () => {
  db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
    if (err) {
      console.error('Erreur:', err);
      return;
    }
    
    if (row.count === 0) {
      const hashedPasswordGerant = await bcrypt.hash('gerant123', 10);
      const hashedPasswordAdmin = await bcrypt.hash('admin123', 10);
      
      db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", 
        ['gerant', hashedPasswordGerant, 'gerant']);
      db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", 
        ['admin', hashedPasswordAdmin, 'admin']);
      
      console.log('✅ Utilisateurs créés: gerant/gerant123 et admin/admin123');
    }
  });

  db.get("SELECT COUNT(*) as count FROM entities", (err, row) => {
    if (err) {
      console.error('Erreur:', err);
      return;
    }
    
    if (row.count === 0) {
      const entities = [
        { name: 'Groupe Électrogène', icon: '🔌' },
        { name: 'Bureautique', icon: '🖥️' },
        { name: 'Boutique', icon: '🛍️' },
        { name: 'Ferme', icon: '🌾' },
        { name: 'Cabine', icon: '📞' },
        { name: 'Atelier', icon: '🔧' }
      ];
      
      entities.forEach(entity => {
        db.run("INSERT INTO entities (name, icon) VALUES (?, ?)", 
          [entity.name, entity.icon]);
      });
      
      console.log('✅ 6 entités créées');
    }
  });
};

initDefaultData();
module.exports = db;