# Guide d'exploitation - BSL La Puissance Zénith

## 1. Structure du projet

| Dossier ou fichier | Rôle |
|---|---|
| `index.html`, `catalogue.html`, `produit.html`, `apropos.html`, `contact.html`, `localisation.html`, `faq.html`, `profil.html`, `reinitialiser.html` | Pages publiques et espace membre |
| `admin.html`, `admin-*.html` | Espace d'administration (employés et admin) |
| `js/config.js` | Adresse et clé publique de Supabase |
| `js/layout.js` | En-tête, menu, pied de page, inscription et connexion (toutes les pages) |
| `js/admin.js` | Cadre commun de l'administration |
| `css/` | Styles (`style.css` = thème clair et sombre) |
| `icons/`, `manifest.webmanifest`, `sw.js`, `offline.html` | Application installable |
| `supabase/*.sql` | Historique de la base de données (déjà exécuté, à garder en archive) |

Ordre des scripts SQL exécutés : `schema.sql`, `sample.sql` (démonstration), `step5.sql`, `step6.sql`, `step7.sql`, `step9.sql`, `step10.sql`.

## 2. Mettre à jour le site

1. Sur GitHub, ouvrez le fichier, appuyez sur le crayon, modifiez, puis **Commit changes**.
2. Attendez 1 à 2 minutes. Si l'ancienne version s'affiche, fermez complètement le navigateur puis rouvrez.
3. Après un gros changement de code, ouvrez `sw.js` et changez `bsl-v1` en `bsl-v2` (puis `v3`...) : cela force les téléphones à repartir sur la dernière version.

## 3. Tâches courantes (sans toucher au code)

- Ajouter, modifier ou masquer un produit : Administration > Produits.
- Mettre en promotion : Administration > Promotions.
- Nommer un employé : Administration > Membres (menu à droite du nom).
- Changer téléphones, horaires, logos, réseaux : Administration > Paramètres.
- Modifier les annonces de l'accueil et la FAQ : Administration > Annonces et FAQ.

## 4. E-mails du site (mot de passe oublié)

Le service d'envoi gratuit intégré à Supabase n'écrit en pratique qu'à votre propre équipe. Pour que vos clients reçoivent les e-mails :

1. Créez un compte gratuit sur **Brevo** et validez votre adresse d'expéditeur.
2. Dans Brevo, ouvrez la page **SMTP et API** et créez une **clé SMTP**.
3. Dans Supabase : **Authentication > Emails > SMTP Settings**, activez « Custom SMTP » et renseignez : serveur `smtp-relay.brevo.com`, port `587`, identifiant et mot de passe (clé SMTP) donnés par Brevo, adresse et nom d'expéditeur (par exemple « BSL La Puissance Zénith »). Vérifiez ces valeurs dans votre compte Brevo.
4. Dans **Authentication > URL Configuration**, ajoutez l'adresse de votre site dans **Site URL** et `https://VOTRE-ADRESSE/**` dans **Redirect URLs**.
5. Dans **Authentication > Emails > Templates > Reset Password**, vous pouvez coller ce texte en français.

Objet : `Réinitialisation de votre mot de passe - BSL Zénith`

```html
<h2>Réinitialisation du mot de passe</h2>
<p>Bonjour,</p>
<p>Vous avez demandé à choisir un nouveau mot de passe pour votre compte BSL La Puissance Zénith.</p>
<p><a href="{{ .ConfirmationURL }}">Choisir un nouveau mot de passe</a></p>
<p>Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.</p>
```

## 5. Sauvegardes et continuité

- **Projet en pause** : sur l'offre gratuite, Supabase met un projet en pause après environ une semaine sans aucune activité. Les visites du site comptent comme activité. Si le site affiche des erreurs après une longue absence, ouvrez Supabase et cliquez sur « Restore ».
- **Export hebdomadaire** : dans Supabase > Table Editor, ouvrez les tables `products`, `categories`, `profiles`, `messages`, appuyez sur les trois points puis « Export to CSV ». Gardez les fichiers sur Google Drive.
- **Photos** : les images des produits sont dans Supabase > Storage > `products`. Elles ne sont pas incluses dans les exports CSV : gardez aussi les photos originales sur votre téléphone.
- **Code** : GitHub conserve l'historique de chaque modification. Vous pouvez revenir en arrière depuis l'onglet « Commits ».

## 6. Règles de sécurité

- Ne publiez jamais la clé `secret` ou `service_role` de Supabase (seule la clé `publishable` est dans `js/config.js`).
- Donnez le rôle **Admin** à une seule personne de confiance ; les autres employés restent **Employé**.
- Utilisez un mot de passe long et unique pour le compte admin, ainsi que pour GitHub et Supabase, et activez la double authentification sur GitHub et Supabase.
- Retirez les droits d'un employé qui quitte la boutique : Administration > Membres > rôle « Membre ».
