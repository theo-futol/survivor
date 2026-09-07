# CHANGEMENT CARTEPRO

## Fonctionnalité retirées

### Coup de coeur du ministre
- Enlever de la DB
- Page
- Route

### Découvert de 150e
- Route
- Que faire des employé(e)s en DB étant déjà en négatif dans le script de migration ?
> Laisser le découvert à 150e, mais ne pas autoriser de nouveaux encaissements si le solde est inférieur à -150e. Attendre les prochains abondements pour que le solde redevienne positif. En faisant cela, on ne perd pas les encaissements déjà effectués, mais on empêche de nouveaux encaissements tant que le solde est négatif et le gouvernement n'a pas à rembourser.

### Changement TicketTout -> CartePro
- Frontend
- Backend
- Brandbook (logo, affiche)

### Validation partenaire
- Mettre dans la seed les nouveaux partenaires fournis
- Les partenaires existants doivent être mis en état pas validé avec motif : "régularisation du 07/09" par le script de migration.
