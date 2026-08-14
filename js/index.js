// Particules animées pour la page d'accueil
document.addEventListener('DOMContentLoaded', function() {
    // Vérifier la connexion au serveur
    fetch('http://localhost:3000/api/users')
        .then(res => res.json())
        .then(data => {
            console.log('✅ Connecté au serveur Valeo');
        })
        .catch(() => {
            console.log('ℹ️ Serveur non démarré. Utilisez: cd server && npm install && npm start');
        });
});

