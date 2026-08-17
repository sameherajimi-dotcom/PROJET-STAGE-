# TODO - Ajout icône compte, dropdown et page settings

## Étapes

- [x] 1. Compréhension du projet et planification
- [x] 2. server/database.js - Ajouter findUserById(), updateUserProfile(), syncExcel()
- [x] 3. server/server.js - Ajouter routes GET /api/users/:id et PUT /api/users/profile
- [x] 4. js/api.js - Ajouter apiGetUser(), apiUpdateUserProfile()
- [x] 5. Créer settings.html - Page de paramètres
- [x] 6. dashboard.html - Ajouter icône compte avec dropdown
- [x] 7. historique.html - Ajouter icône compte avec dropdown
- [x] 8. live.html - Ajouter icône compte avec dropdown
- [x] 9. admin.html - Ajouter icône compte avec dropdown
- [x] 10. Tester le tout

## Bugs corrigés

### Référence à `userEmail` non déclarée
- **Problème**: La variable `userEmail` était utilisée dans `document.getElementById('dropdownEmail').textContent = userEmail || '—';` sans être déclarée dans plusieurs pages.
- **Pages touchées**: dashboard.html, historique.html, live.html, admin.html, settings.html
- **Correctif**: Ajout de `const userEmail = sessionStorage.getItem('valeo_userEmail') || '';` dans chaque page avant son utilisation.
- **Statut**: ✅ Résolu

