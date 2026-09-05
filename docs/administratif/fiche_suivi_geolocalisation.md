# FICHE DE SUIVI : TRAITEMENT DE GÉOLOCALISATION SUR SITE WEB

> **Note** : la géolocalisation utilisateur est une fonctionnalité **prévue** mais **non encore implémentée** dans le code à la date de rédaction — aucun appel à l'API `navigator.geolocation` du navigateur n'existe aujourd'hui, et le schéma de données ne comporte aucun champ latitude/longitude. Cette fiche décrit le traitement tel qu'il est prévu, pour cadrer son implémentation future.

## 1. Informations Générales
* **Nom du traitement :** Géolocalisation des utilisateurs de Ticket Tout
* **Date de création :** 03/09/2026
* **Dernière mise à jour :** 03/09/2026
* **Responsable du traitement :** Entreprise de services (en charge du développement et de l'exploitation de Ticket Tout)
* **Délégué à la Protection des Données (DPO) :** Florine Pontaillac

## 2. Finalités & Justification du Traitement
* **Objectif principal :** Permettre au salarié de trouver le partenaire référencé par le Ministère le plus proche de chez lui (page `/partners`)
* **Objectifs secondaires :** La fonctionnalité est limitée à la recherche du partenaire le plus proche
* **Base légale retenue :** Consentement de l'utilisateur (Pop-up/Bandeau), cohérent avec le caractère optionnel.

## 3. Nature & Origine des Données Collectées
* **Type de données recueillies :** Coordonnées GPS précises (Latitude/Longitude), obtenues via l'API du navigateur, à la demande explicite de l'utilisateur à chaque utilisation de la fonctionnalité.
* **Précision de la localisation :** À l'adresse près (précision nécessaire pour identifier le partenaire le plus proche)
* **Méthode de collecte :** API Geolocation du navigateur (HTML5)
* **Fréquence du suivi :** Continu, mais uniquement pendant la session de navigation et le temps de calcul de distance. La coordonnée n'est pas stockée en base de données et est effacée à la fermeture du navigateur.

## 4. Destinataires & Transfert des Données
* **Services internes ayant accès aux données :** Équipe technique (développeurs) uniquement
* **Sous-traitants / Prestataires tiers :** OpenStreetMap (fourniture des tuiles cartographiques affichées via la librairie Leaflet, sans clé API). Le calcul du partenaire le plus proche est prévu côté client : la coordonnée précise de l'utilisateur n'est donc pas destinée à transiter vers OpenStreetMap ni vers un serveur applicatif.
* **Hébergement des données :** La donnée n'est pas stockée en base de données, elle est uniquement utilisée côté client pour le calcul de distance et effacée à la fermeture du navigateur. Aucune donnée de géolocalisation n'est donc hébergée sur les serveurs de l'entreprise.

## 5. Durée de Conservation & Sécurité
* **Durée de conservation en base de données :** Donnée éphémère — non stockée en base de données. Le schéma applicatif ne comporte aucun champ de géolocalisation ; la coordonnée n'est utilisée que côté client, le temps du calcul de distance, puis effacée à la fermeture de la session/du navigateur.
* **Anonymisation :** Non applicable (donnée non conservée en base)
* **Mesures de sécurité techniques :** Chiffrement HTTPS/TLS obligatoire pour toute communication (cohérent avec les mesures déjà en place pour le reste du service), aucune transmission de la coordonnée précise à un serveur tiers ou applicatif

## 6. Droits des Utilisateurs
* **Méthode d'information :** Mention dans la Politique de Confidentialité + texte d'information affiché lors de la demande d'autorisation de géolocalisation par le navigateur
* **Modalités de retrait du consentement :** L'utilisateur peut refuser ou révoquer à tout moment l'autorisation de géolocalisation via les paramètres de son navigateur ; le service reste utilisable sans cette fonctionnalité (recherche manuelle du partenaire par ville/région)
