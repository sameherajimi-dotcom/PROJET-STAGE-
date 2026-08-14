const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'valeo.db');

let db = null;
let SQL = null;

async function getDatabase() {
    if (db) return db;

    SQL = await initSqlJs();

    // Load existing database file or create new one
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    db.run('PRAGMA journal_mode = WAL');
    initTables();
    // Seed default admin if not exists
    seedDefaultAdmin();
    return db;
}

function initTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT,
            role TEXT DEFAULT 'Technicien',
            login_code TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            password_plain TEXT,
            is_admin INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Add password_plain column if missing (for existing databases)
    try {
        db.run(`ALTER TABLE users ADD COLUMN password_plain TEXT`);
    } catch (e) {
        // Column already exists, ignore
    }

    // Create index
    try {
        db.run('CREATE INDEX IF NOT EXISTS idx_users_login_code ON users(login_code)');
    } catch (e) {
        // Index might already exist
    }

    saveDatabase();
}

function seedDefaultAdmin() {
    const existing = findUserByLoginCode('ADMIN-001');
    if (!existing) {
        const hash = bcrypt.hashSync('admin123', 10);
        db.run(`
            INSERT INTO users (first_name, last_name, email, role, login_code, password_hash, password_plain, is_admin)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, ['Admin', 'Valeo', 'admin@valeo.com', 'Ingénieur', 'ADMIN-001', hash, 'admin123', 1]);
        saveDatabase();
        console.log('  👑 Compte admin créé: ADMIN-001 / admin123');
    }
}

function generateLoginCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'VAL-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Check uniqueness
    const existing = db.exec(`SELECT id FROM users WHERE login_code = ?`, [code]);
    if (existing.length > 0 && existing[0].values.length > 0) {
        return generateLoginCode(); // Retry if exists
    }
    return code;
}

function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

// --- User operations ---

function createUser(firstName, lastName, email, role, password) {
    const loginCode = generateLoginCode();
    const passwordHash = bcrypt.hashSync(password, 10);

    db.run(`
        INSERT INTO users (first_name, last_name, email, role, login_code, password_hash, password_plain)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [firstName, lastName, email, role, loginCode, passwordHash, password]);

    saveDatabase();

    const result = db.exec("SELECT last_insert_rowid() as id");
    return { userId: result[0]?.values[0][0], loginCode };
}

function findUserByLoginCode(loginCode) {
    const result = db.exec(`
        SELECT * FROM users WHERE login_code = ?
    `, [loginCode]);

    if (result.length === 0 || result[0].values.length === 0) {
        return undefined;
    }

    const row = result[0].values[0];
    const columns = result[0].columns;

    const user = {};
    columns.forEach((col, index) => {
        user[col] = row[index];
    });

    return user;
}

function validatePassword(plainPassword, hash) {
    return bcrypt.compareSync(plainPassword, hash);
}

function getAllUsers() {
    const result = db.exec(`
        SELECT id, first_name, last_name, email, role, login_code, password_plain, is_admin, created_at
        FROM users
        ORDER BY created_at DESC
    `);

    if (result.length === 0) return [];

    const rows = result[0].values;
    const columns = result[0].columns;

    return rows.map(row => {
        const user = {};
        columns.forEach((col, index) => {
            user[col] = row[index];
        });
        return user;
    });
}

function deleteUser(userId) {
    db.run(`DELETE FROM users WHERE id = ? AND is_admin = 0`, [userId]);
    saveDatabase();
}

function updateUserRole(userId, newRole) {
    db.run(`UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newRole, userId]);
    saveDatabase();
    syncExcel();
}

function findUserById(userId) {
    const result = db.exec(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (result.length === 0 || result[0].values.length === 0) {
        return undefined;
    }
    const row = result[0].values[0];
    const columns = result[0].columns;
    const user = {};
    columns.forEach((col, index) => {
        user[col] = row[index];
    });
    return user;
}

function updateUserProfile(userId, firstName, lastName, email, role) {
    db.run(`
        UPDATE users 
        SET first_name = ?, last_name = ?, email = ?, role = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `, [firstName, lastName, email, role, userId]);
    saveDatabase();
    syncExcel();
}

// ─── EXCEL SYNC ───
const EXCEL_PATH = path.join(__dirname, 'comptes_valeo.xlsx');

function syncExcel() {
    const now = new Date().toLocaleString('fr-FR');

    // Read all users from database, sorted by ID descending (newest first)
    let allRows = [];
    try {
        const result = db.exec(`
            SELECT id, first_name, last_name, email, role, login_code, password_plain, created_at
            FROM users
            ORDER BY id DESC
        `);
        if (result.length > 0 && result[0].values.length > 0) {
            allRows = result[0].values;
        }
    } catch (e) {
        console.error('Erreur lecture DB pour Excel:', e.message);
    }

    // Build sorted data array: [ID, Prénom, Nom, Email, Rôle, Code, Mot de passe, Date]
    const rows = [['ID', 'Prénom', 'Nom', 'Email', 'Rôle', 'Code', 'Mot de passe', 'Date de création']];

    for (const r of allRows) {
        const [id, fn, ln, em, rl, lc, pwd, created] = r;
        const dateStr = created ? new Date(created).toLocaleString('fr-FR') : now;
        rows.push([id, fn, ln, em || '', rl, lc, pwd || '***', dateStr]);
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Comptes');

    const colWidths = [
        { wch: 8 },  // ID
        { wch: 15 }, // Prénom
        { wch: 15 }, // Nom
        { wch: 30 }, // Email
        { wch: 15 }, // Rôle
        { wch: 15 }, // Code
        { wch: 30 }, // Mot de passe
        { wch: 22 }  // Date
    ];
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, EXCEL_PATH);
    console.log(`  ✅ Fichier Excel mis à jour: ${EXCEL_PATH} (${rows.length - 1} comptes, trié par ID décroissant)`);
}

// Alias for backwards compatibility
function appendToExcel(firstName, lastName, email, role, loginCode, password, userId) {
    syncExcel();
}

function updateUserPassword(userId, newPasswordHash) {
    db.run(`
        UPDATE users 
        SET password_hash = ?, password_plain = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `, [newPasswordHash, '***', userId]);
    saveDatabase();
    syncExcel();
}

module.exports = {
    getDatabase,
    createUser,
    findUserByLoginCode,
    validatePassword,
    getAllUsers,
    deleteUser,
    updateUserRole,
    findUserById,
    updateUserProfile,
    updateUserPassword,
    appendToExcel,
    syncExcel
};
