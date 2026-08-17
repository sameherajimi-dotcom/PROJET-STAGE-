const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const XLSX = require('xlsx');
const { execFile } = require('child_process');
const { promisify } = require('util');

const {
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
    appendToExcel
} = require('./database');

const execFileAsync = promisify(execFile);

const pythonCommand =
    process.env.VALEO_PYTHON ||
    (process.platform === 'win32' ? 'python' : 'python3');

const app = express();
const PORT = 3000;

const capturesDirectory = path.join(__dirname, 'captures');
const HISTORY_FILE = path.join(__dirname, 'history.json');

process.env.VALEO_ROBOFLOW_API_KEY =
    process.env.VALEO_ROBOFLOW_API_KEY || 'dQudu2taTYXhZN8DmqZo';

process.env.VALEO_ROBOFLOW_SECOND_API_KEY =
    process.env.VALEO_ROBOFLOW_SECOND_API_KEY || 'KeCJQZgmePtugUhbMNTC';

const BASE_DATA_PATH =
    process.env.VALEO_BASE_DATA_PATH ||
    path.join(
        process.env.USERPROFILE || '',
        'Downloads',
        'BASE DONNEES (1).xlsx'
    );

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..')));

function normalizeHeader(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeNumeric(value) {
    if (value === null || value === undefined || value === '') {
        return 0;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    const cleaned = String(value)
        .replace(/[^0-9.,-]/g, '')
        .replace(',', '.');

    const parsed = Number(cleaned);

    return Number.isFinite(parsed) ? parsed : 0;
}

function readBaseDonneesFromExcel(filePath) {
    if (!filePath || !fsSync.existsSync(filePath)) {
        return [];
    }

    const workbook = XLSX.readFile(filePath);

    const sheetName =
        workbook.SheetNames.find(name => /table/i.test(name));

    const targetSheet =
        workbook.Sheets['Table'] ||
        (sheetName ? workbook.Sheets[sheetName] : null);

    if (!targetSheet) {
        return [];
    }

    const rowsArray = XLSX.utils.sheet_to_json(
        targetSheet,
        {
            header: 1,
            defval: '',
            raw: false
        }
    );

    if (!rowsArray || rowsArray.length < 3) {
        return [];
    }

    const rows = [];
    const seen = new Set();

    rowsArray.slice(2).forEach(row => {
        if (!Array.isArray(row)) {
            return;
        }

        const family = String(row[1] || '').trim();
        const product = String(row[2] || '').trim();

        const totalValue =
            row[5] ?? row[4] ?? row[6] ?? 0;

        const quantite = normalizeNumeric(totalValue);
        const jigsTotales = normalizeNumeric(row[4] || 0);

        if (!product && !family) {
            return;
        }

        if (!(quantite > 0)) {
            return;
        }

        const aliases = new Set();

        if (product) {
            aliases.add(product);
        }

        if (family && product) {
            aliases.add(`${family} ${product}`);
            aliases.add(`${family}_${product}`);
        }

        if (family && !product) {
            aliases.add(family);
        }

        aliases.forEach(alias => {
            const cleanAlias = String(alias).trim();

            if (!cleanAlias) {
                return;
            }

            const key = `Table|${cleanAlias}`;

            if (seen.has(key)) {
                return;
            }

            seen.add(key);

            const numericQuantity = Number(quantite) || 0;

            rows.push({
                id: `EXCEL-${rows.length + 1}`,
                date: new Date().toLocaleDateString('fr-FR'),
                heure: new Date().toLocaleTimeString('fr-FR'),
                produit: cleanAlias,
                quantite: numericQuantity,
                quantite_totale: numericQuantity,
                jigs_totales: Number(jigsTotales) || 0,
                taux: `${Math.min(100, Math.max(0, numericQuantity))}%`,
                jigs: normalizeNumeric(row[3] || 0),
                kits: normalizeNumeric(row[4] || 0),
                consommation: normalizeNumeric(row[6] || 0),
                sheet: 'Table'
            });
        });
    });

    return rows;
}

async function readHistoryFile() {
    try {
        const raw = await fs.readFile(HISTORY_FILE, 'utf8');
        const parsed = JSON.parse(raw);

        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }

        console.error(
            'Erreur lecture historique:',
            error.message
        );

        return [];
    }
}

async function writeHistoryFile(history) {
    await fs.writeFile(
        HISTORY_FILE,
        JSON.stringify(history, null, 2),
        'utf8'
    );
}

function findProductReference(product) {
    const target = String(product || '')
        .trim()
        .toLowerCase();

    if (!target) {
        return null;
    }

    try {
        const rows =
            readBaseDonneesFromExcel(BASE_DATA_PATH);

        return (
            rows.find(row =>
                String(row.produit || '')
                    .trim()
                    .toLowerCase() === target
            ) ||
            rows.find(row => {
                const current =
                    String(row.produit || '')
                        .trim()
                        .toLowerCase();

                return (
                    current.includes(target) ||
                    target.includes(current)
                );
            }) ||
            null
        );
    } catch (error) {
        console.error(
            'Erreur recherche référence produit:',
            error.message
        );

        return null;
    }
}

async function saveDetectionEvents(counts) {
    if (!counts || typeof counts !== 'object') {
        return [];
    }

    const validProducts = Object.entries(counts)
        .map(([product, quantity]) => ({
            product: String(product || '').trim(),
            quantity: normalizeNumeric(quantity)
        }))
        .filter(item =>
            item.product &&
            item.quantity > 0
        );

    if (!validProducts.length) {
        return [];
    }

    const history = await readHistoryFile();
    const saved = [];
    const now = new Date();

    for (const item of validProducts) {
        const reference =
            findProductReference(item.product) || {};

        const jigsTotal =
            Number(
                reference.jigs_totales ||
                reference.jigs ||
                0
            ) || 0;

        const family =
            reference.famille || '—';

        const previousTotal = history
            .filter(record =>
                String(record.produit || '')
                    .trim()
                    .toLowerCase() ===
                item.product.toLowerCase()
            )
            .reduce(
                (sum, record) =>
                    sum +
                    normalizeNumeric(record.quantite),
                0
            );

        const totalLoading =
            previousTotal + item.quantity;

        const rendement =
            jigsTotal > 0
                ? Math.min(
                    100,
                    Math.round(
                        (item.quantity / jigsTotal) * 100
                    )
                )
                : 0;

        const record = {
            id:
                `VAL-${now.getTime()}-${Math.random()
                    .toString(36)
                    .slice(2, 8)
                    .toUpperCase()}`,

            date:
                now.toLocaleDateString('fr-FR'),

            heure:
                now.toLocaleTimeString('fr-FR'),

            timestamp:
                now.toISOString(),

            produit:
                item.product,

            famille:
                family,

            quantite:
                item.quantity,

            quantite_totale:
                totalLoading,

            chargement_total:
                totalLoading,

            jigs_totales:
                jigsTotal,

            rendement:
                rendement,

            taux:
                `${rendement}%`
        };

        history.unshift(record);
        saved.push(record);
    }

    await writeHistoryFile(
        history.slice(0, 10000)
    );

    return saved;
}

app.get('/api/history', async (req, res) => {
    try {
        const history =
            await readHistoryFile();

        res.json({
            success: true,
            history
        });
    } catch (error) {
        console.error(
            'Erreur API historique:',
            error.message
        );

        res.status(500).json({
            success: false,
            message:
                'Impossible de charger l\'historique.',
            history: []
        });
    }
});

app.get('/api/base-donnees', (req, res) => {
    try {
        const rows =
            readBaseDonneesFromExcel(
                BASE_DATA_PATH
            );

        res.json({
            success: true,
            source: BASE_DATA_PATH,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error(
            'Erreur lecture Excel serveur:',
            error.message
        );

        res.status(500).json({
            success: false,
            message:
                'Impossible de lire la base Excel côté serveur.',
            data: []
        });
    }
});

app.get('/api/detect-test', (req, res) => {
    try {
        const rows =
            readBaseDonneesFromExcel(
                BASE_DATA_PATH
            );

        const testProduct =
            rows.length > 0
                ? rows[0].produit
                : 'PRODUIT_TEST';

        res.json({
            success: true,
            capture: 'test-capture.jpg',

            detections: [
                {
                    product: testProduct,
                    confidence: 0.95,
                    x: 100,
                    y: 100,
                    width: 200,
                    height: 200,
                    model: 'primary'
                }
            ],

            counts: {
                [testProduct]: 3
            },

            jig_detections: [],
            jig_count: 0,
            jig_counts: {},
            test: true
        });
    } catch (error) {
        console.error(
            'Test detection error:',
            error.message
        );

        res.json({
            success: true,
            capture: 'test-capture.jpg',

            detections: [
                {
                    product: 'PRODUIT_TEST',
                    confidence: 0.95,
                    x: 100,
                    y: 100,
                    width: 200,
                    height: 200,
                    model: 'primary'
                }
            ],

            counts: {
                PRODUIT_TEST: 3
            },

            jig_detections: [],
            jig_count: 0,
            jig_counts: {},
            test: true
        });
    }
});

app.post('/api/detect', async (req, res) => {
    const image = req.body?.image;

    if (!image || typeof image !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'Image manquante.'
        });
    }

    const base64 = image.replace(
        /^data:image\/[a-zA-Z+]+;base64,/,
        ''
    );

    let imagePath;

    try {
        const imageBuffer =
            Buffer.from(base64, 'base64');

        if (
            !imageBuffer.length ||
            imageBuffer.length > 8 * 1024 * 1024
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Image invalide ou trop volumineuse.'
            });
        }

        await fs.mkdir(
            capturesDirectory,
            { recursive: true }
        );

        const captureName =
            `capture-${new Date()
                .toISOString()
                .replace(/[:.]/g, '-')}-${Math.random()
                .toString(36)
                .slice(2, 8)}.jpg`;

        imagePath =
            path.join(
                capturesDirectory,
                captureName
            );

        await fs.writeFile(
            imagePath,
            imageBuffer,
            { mode: 0o600 }
        );

        if (!process.env.VALEO_ROBOFLOW_API_KEY) {
            return res.status(503).json({
                success: false,
                message:
                    'Clé Roboflow absente. La capture a bien été sauvegardée, mais son analyse ne peut pas démarrer.'
            });
        }

        const scriptPath =
            path.join(
                __dirname,
                'inference.py'
            );

        try {
            const { stdout } =
                await execFileAsync(
                    pythonCommand,
                    [
                        scriptPath,
                        imagePath
                    ],
                    {
                        timeout: 10000,
                        maxBuffer:
                            2 * 1024 * 1024,
                        env:
                            process.env
                    }
                );

            const inference =
                JSON.parse(stdout);

            const savedHistory =
                await saveDetectionEvents(
                    inference.counts
                );

            res.json({
                success: true,
                capture: captureName,
                ...inference,
                historySaved:
                    savedHistory.length > 0,
                historyRecords:
                    savedHistory
            });
        } catch (inferenceError) {
            console.warn(
                'Inference timeout or error:',
                inferenceError.message
            );

            res.json({
                success: true,
                capture: captureName,
                detections: [],
                counts: {},
                jig_detections: [],
                jig_count: 0,
                jig_counts: {},
                timeout: true
            });
        }
    } catch (error) {
        console.error(
            'Roboflow inference error:',
            error.message
        );

        res.json({
            success: true,
            capture: 'unknown',
            detections: [],
            counts: {},
            jig_detections: [],
            jig_count: 0,
            jig_counts: {}
        });
    }
});

app.post('/api/signup', (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            role,
            password
        } = req.body;

        if (
            !firstName ||
            !lastName ||
            !email ||
            !role ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Tous les champs sont requis.'
            });
        }

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            return res.status(400).json({
                success: false,
                message:
                    'Format d\'email invalide.'
            });
        }

        const validRoles = [
            'Ingénieur',
            'Technicien',
            'Ouvrier'
        ];

        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message:
                    'Rôle invalide. Choisissez Ingénieur, Technicien ou Ouvrier.'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message:
                    'Le mot de passe doit contenir au moins 8 caractères.'
            });
        }

        const {
            userId,
            loginCode
        } = createUser(
            firstName,
            lastName,
            email,
            role,
            password
        );

        try {
            appendToExcel(
                firstName,
                lastName,
                email,
                role,
                loginCode,
                password,
                userId
            );
        } catch (excelErr) {
            console.error(
                'Erreur écriture Excel:',
                excelErr.message
            );
        }

        res.status(201).json({
            success: true,
            message:
                'Compte créé avec succès.',
            loginCode,
            userId
        });
    } catch (error) {
        console.error(
            'Signup error:',
            error
        );

        res.status(500).json({
            success: false,
            message:
                'Erreur serveur. Veuillez réessayer.'
        });
    }
});

app.post('/api/login', (req, res) => {
    try {
        const {
            loginCode,
            password
        } = req.body;

        if (!loginCode || !password) {
            return res.status(400).json({
                success: false,
                message:
                    'Code et mot de passe requis.'
            });
        }

        const user =
            findUserByLoginCode(
                loginCode.toUpperCase()
            );

        if (!user) {
            return res.status(401).json({
                success: false,
                message:
                    'Code ou mot de passe incorrect.'
            });
        }

        if (
            !validatePassword(
                password,
                user.password_hash
            )
        ) {
            return res.status(401).json({
                success: false,
                message:
                    'Code ou mot de passe incorrect.'
            });
        }

        res.json({
            success: true,
            message:
                'Connexion réussie.',
            user: {
                id: user.id,
                firstName:
                    user.first_name,
                lastName:
                    user.last_name,
                email:
                    user.email || '',
                role:
                    user.role,
                loginCode:
                    user.login_code,
                isAdmin:
                    user.is_admin === 1
            }
        });
    } catch (error) {
        console.error(
            'Login error:',
            error
        );

        res.status(500).json({
            success: false,
            message:
                'Erreur serveur. Veuillez réessayer.'
        });
    }
});

app.get('/api/users', (req, res) => {
    try {
        const users =
            getAllUsers();

        res.json({
            success: true,
            users
        });
    } catch (error) {
        console.error(
            'Get users error:',
            error
        );

        res.status(500).json({
            success: false,
            message:
                'Erreur serveur.'
        });
    }
});

app.delete('/api/users/:id', (req, res) => {
    try {
        const userId =
            parseInt(
                req.params.id,
                10
            );

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message:
                    'ID invalide.'
            });
        }

        deleteUser(userId);

        res.json({
            success: true,
            message:
                'Utilisateur supprimé.'
        });
    } catch (error) {
        console.error(
            'Delete user error:',
            error
        );

        res.status(500).json({
            success: false,
            message:
                'Erreur serveur.'
        });
    }
});

app.put('/api/users/:id/role', (req, res) => {
    try {
        const userId =
            parseInt(
                req.params.id,
                10
            );

        const { role } = req.body;

        const validRoles = [
            'Ingénieur',
            'Technicien',
            'Ouvrier'
        ];

        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message:
                    'Rôle invalide.'
            });
        }

        updateUserRole(
            userId,
            role
        );

        res.json({
            success: true,
            message:
                'Rôle mis à jour.'
        });
    } catch (error) {
        console.error(
            'Update role error:',
            error
        );

        res.status(500).json({
            success: false,
            message:
                'Erreur serveur.'
        });
    }
});

app.get('/api/users/:id', (req, res) => {
    try {
        const userId =
            parseInt(
                req.params.id,
                10
            );

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message:
                    'ID invalide.'
            });
        }

        const user =
            findUserById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message:
                    'Utilisateur introuvable.'
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                firstName:
                    user.first_name,
                lastName:
                    user.last_name,
                email:
                    user.email,
                role:
                    user.role,
                loginCode:
                    user.login_code,
                isAdmin:
                    user.is_admin === 1
            }
        });
    } catch (error) {
        console.error(
            'Get user error:',
            error
        );

        res.status(500).json({
            success: false,
            message:
                'Erreur serveur.'
        });
    }
});

app.put('/api/users/change-password', (req, res) => {
    try {
        const {
            userId,
            currentPassword,
            newPassword
        } = req.body;

        if (
            !userId ||
            !currentPassword ||
            !newPassword
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Tous les champs sont requis.'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message:
                    'Le nouveau mot de passe doit contenir au moins 8 caractères.'
            });
        }

        const user =
            findUserById(
                parseInt(userId, 10)
            );

        if (!user) {
            return res.status(404).json({
                success: false,
                message:
                    'Utilisateur introuvable.'
            });
        }

        if (
            !validatePassword(
                currentPassword,
                user.password_hash
            )
        ) {
            return res.status(401).json({
                success: false,
                message:
                    'Mot de passe actuel incorrect.'
            });
        }

        const bcrypt =
            require('bcryptjs');

        const newHash =
            bcrypt.hashSync(
                newPassword,
                10
            );

        updateUserPassword(
            parseInt(userId, 10),
            newHash
        );

        res.json({
            success: true,
            message:
                'Mot de passe modifié avec succès.'
        });
    } catch (error) {
        console.error(
            'Change password error:',
            error
        );

        res.status(500).json({
            success: false,
            message:
                'Erreur serveur.'
        });
    }
});

app.put('/api/users/profile', (req, res) => {
    try {
        const {
            id,
            firstName,
            lastName,
            email,
            role
        } = req.body;

        if (
            !id ||
            !firstName ||
            !lastName ||
            !email ||
            !role
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Tous les champs sont requis.'
            });
        }

        const validRoles = [
            'Ingénieur',
            'Technicien',
            'Ouvrier'
        ];

        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message:
                    'Rôle invalide.'
            });
        }

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            return res.status(400).json({
                success: false,
                message:
                    'Format d\'email invalide.'
            });
        }

        updateUserProfile(
            id,
            firstName,
            lastName,
            email,
            role
        );

        res.json({
            success: true,
            message:
                'Profil mis à jour avec succès.'
        });
    } catch (error) {
        console.error(
            'Update profile error:',
            error
        );

        res.status(500).json({
            success: false,
            message:
                'Erreur serveur.'
        });
    }
});

app.get('*', (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            '..',
            'login.html'
        )
    );
});

async function startServer() {
    try {
        await getDatabase();

        console.log(
            'Base de données initialisée'
        );
    } catch (error) {
        console.error(
            'Erreur base de données:',
            error.message
        );
    }

    app.listen(
        PORT,
        () => {
            console.log(
                `Serveur Valeo démarré sur http://localhost:${PORT}`
            );
        }
    );
}

startServer();