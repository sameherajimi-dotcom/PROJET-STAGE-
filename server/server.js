const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs/promises');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { getDatabase, createUser, findUserByLoginCode, validatePassword, getAllUsers, deleteUser, updateUserRole, findUserById, updateUserProfile, updateUserPassword, appendToExcel } = require('./database');

const execFileAsync = promisify(execFile);
const pythonCommand = process.env.VALEO_PYTHON ||
    (process.platform === 'win32' ? 'python' : 'python3');

const app = express();
const PORT = 3000;
const capturesDirectory = path.join(__dirname, 'captures');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Servir les fichiers statiques (pages HTML, JS, CSS)
app.use(express.static(path.join(__dirname, '..')));

// ===== API ROUTES =====

// POST /api/detect - Inférence Roboflow, la clé API reste exclusivement côté serveur.
app.post('/api/detect', async (req, res) => {
    const image = req.body?.image;
    if (!image || typeof image !== 'string') {
        return res.status(400).json({ success: false, message: 'Image manquante.' });
    }
    // Le navigateur envoie une image JPEG encodée en base64 depuis la caméra.
    const base64 = image.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
    let imagePath;
    try {
        const imageBuffer = Buffer.from(base64, 'base64');
        if (!imageBuffer.length || imageBuffer.length > 8 * 1024 * 1024) {
            return res.status(400).json({ success: false, message: 'Image invalide ou trop volumineuse.' });
        }

        // Keep every camera capture so it can be reviewed after the detection.
        // The directory is created automatically on the first detection.
        await fs.mkdir(capturesDirectory, { recursive: true });
        const captureName = `capture-${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        imagePath = path.join(capturesDirectory, captureName);
        await fs.writeFile(imagePath, imageBuffer, { mode: 0o600 });

        if (!process.env.VALEO_ROBOFLOW_API_KEY) {
            return res.status(503).json({
                success: false,
                message: 'Clé Roboflow absente. La capture a bien été sauvegardée, mais son analyse ne peut pas démarrer.'
            });
        }

        const scriptPath = path.join(__dirname, 'inference.py');
        const { stdout } = await execFileAsync(pythonCommand, [scriptPath, imagePath], {
            timeout: 30000,
            maxBuffer: 2 * 1024 * 1024,
            env: process.env
        });
        const inference = JSON.parse(stdout);
        res.json({ success: true, capture: captureName, ...inference });
    } catch (error) {
        console.error('Roboflow inference error:', error.message);
        res.status(502).json({ success: false, message: 'L\'analyse IA a échoué. Vérifiez la connexion et la configuration Roboflow.' });
    }
});

// POST /api/signup - Créer un compte
app.post('/api/signup', (req, res) => {
    try {
        const { firstName, lastName, email, role, password } = req.body;

        // Validation
        if (!firstName || !lastName || !email || !role || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tous les champs sont requis.' 
            });
        }

        // Validate email format
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Format d\'email invalide.'
            });
        }

        const validRoles = ['Ingénieur', 'Technicien', 'Ouvrier'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Rôle invalide. Choisissez Ingénieur, Technicien ou Ouvrier.' 
            });
        }

        if (password.length < 8) {
            return res.status(400).json({ 
                success: false, 
                message: 'Le mot de passe doit contenir au moins 8 caractères.' 
            });
        }

        // Créer l'utilisateur
        const { userId, loginCode } = createUser(firstName, lastName, email, role, password);

        // Ajouter au fichier Excel
        try {
            appendToExcel(firstName, lastName, email, role, loginCode, password, userId);
        } catch (excelErr) {
            console.error('Erreur écriture Excel:', excelErr.message);
        }

        res.status(201).json({
            success: true,
            message: 'Compte créé avec succès.',
            loginCode: loginCode,
            userId: userId
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur. Veuillez réessayer.' 
        });
    }
});

// POST /api/login - Connexion par code + mot de passe
app.post('/api/login', (req, res) => {
    try {
        const { loginCode, password } = req.body;

        if (!loginCode || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Code et mot de passe requis.' 
            });
        }

        // Trouver l'utilisateur par code
        const user = findUserByLoginCode(loginCode.toUpperCase());
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Code ou mot de passe incorrect.' 
            });
        }

        // Vérifier le mot de passe
        if (!validatePassword(password, user.password_hash)) {
            return res.status(401).json({ 
                success: false, 
                message: 'Code ou mot de passe incorrect.' 
            });
        }

        res.json({
            success: true,
            message: 'Connexion réussie.',
            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email || '',
                role: user.role,
                loginCode: user.login_code,
                isAdmin: user.is_admin === 1
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur. Veuillez réessayer.' 
        });
    }
});

// GET /api/users - Lister tous les utilisateurs (admin)
app.get('/api/users', (req, res) => {
    try {
        const users = getAllUsers();
        res.json({ success: true, users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur serveur.' 
        });
    }
});

// DELETE /api/users/:id - Supprimer un utilisateur
app.delete('/api/users/:id', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ success: false, message: 'ID invalide.' });
        }
        deleteUser(userId);
        res.json({ success: true, message: 'Utilisateur supprimé.' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// PUT /api/users/:id/role - Modifier le rôle
app.put('/api/users/:id/role', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { role } = req.body;
        const validRoles = ['Ingénieur', 'Technicien', 'Ouvrier'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, message: 'Rôle invalide.' });
        }
        updateUserRole(userId, role);
        res.json({ success: true, message: 'Rôle mis à jour.' });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// GET /api/users/:id - Récupérer un utilisateur par ID
app.get('/api/users/:id', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ success: false, message: 'ID invalide.' });
        }
        const user = findUserById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }
        res.json({
            success: true,
            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                role: user.role,
                loginCode: user.login_code,
                isAdmin: user.is_admin === 1
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// PUT /api/users/change-password - Changer le mot de passe
app.put('/api/users/change-password', (req, res) => {
    try {
        const { userId, currentPassword, newPassword } = req.body;

        if (!userId || !currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Tous les champs sont requis.' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
        }

        const user = findUserById(parseInt(userId));
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }

        if (!validatePassword(currentPassword, user.password_hash)) {
            return res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect.' });
        }

        const bcrypt = require('bcryptjs');
        const newHash = bcrypt.hashSync(newPassword, 10);
        updateUserPassword(parseInt(userId), newHash);

        res.json({ success: true, message: 'Mot de passe modifié avec succès.' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// PUT /api/users/profile - Mettre à jour le profil utilisateur
app.put('/api/users/profile', (req, res) => {
    try {
        const { id, firstName, lastName, email, role } = req.body;

        if (!id || !firstName || !lastName || !email || !role) {
            return res.status(400).json({ success: false, message: 'Tous les champs sont requis.' });
        }

        const validRoles = ['Ingénieur', 'Technicien', 'Ouvrier'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, message: 'Rôle invalide.' });
        }

        // Validate email format
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            return res.status(400).json({ success: false, message: 'Format d\'email invalide.' });
        }

        updateUserProfile(id, firstName, lastName, email, role);

        res.json({
            success: true,
            message: 'Profil mis à jour avec succès.'
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// Route par défaut - afficher la page de connexion.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'login.html'));
});

// Démarrage du serveur
async function startServer() {
    try {
        await getDatabase();
        console.log('  ✅ Base de données initialisée');
    } catch (err) {
        console.error('  ❌ Erreur base de données:', err.message);
    }

    app.listen(PORT, () => {
        console.log(`\n======================================`);
        console.log(`  🏢 Serveur Valeo démarré !`);
        console.log(`  📍 http://localhost:${PORT}`);
        console.log(`  Direct dashboard access enabled`);
        console.log(`======================================\n`);
    });
}

startServer();
