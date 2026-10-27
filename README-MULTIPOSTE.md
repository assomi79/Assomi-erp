# ASSOMi — ERP supermarché simple (Côte d'Ivoire • FCFA)

## Démarrer
Sur le PC principal (même WiFi que caisses, tablettes, smartphones, PDA) :

```bash
cd erp-supermarche
node server.js 8000
```

Puis sur chaque appareil : `http://IP-DU-PC:8000` (ex. `http://192.168.1.20:8000`).
Sans serveur : double-clic sur `index.html` (mode local 1 poste + sync Admin).

## Codes démo
| Agent | Code | Rôle |
|---|---|---|
| Administrateur Système | **7777** | Admin (corbeille + tout) |
| Gérant Magasin | **9999** | Gérant (promos, suppressions ticket) |
| Grace (Comptable) | 4001 | Comptable |
| Jean-Baptiste (Chef rayon) | 2001 | Chef de rayon |
| Aminata / Fatou (Caisses) | 1001 / 1002 | Vendeur |

## Règles clés
- **Rôle = postes occupés** : Caissière/Vendeuse/Hôtesse → Vendeur • Chef de rayon/Magasinier → Chef de rayon • Comptable → Comptable • Gérant → Gérant • Administrateur → Admin. Un agent peut cumuler plusieurs postes (multi-tâches).
- **Rôles & droits par poste** : réglés dans **Paramétrage**. La pointeuse manuelle RH a été supprimée : chaque agent badge avec le bouton **⏱ en haut**.
- **Réception unique** dans Stocks → Réception : on choisit un **BC validé** et on saisit les quantités réellement livrées. Si le BL correspond au BC, la réception peut être validée normalement. En cas d'écart, il est possible soit de déclarer un **litige** (aucune entrée en stock), soit de valider les quantités réellement reçues avec un **motif obligatoire**. Le BC conserve les quantités commandées et l'écart est historisé avec l'agent.
- Une réception validée crée un seul **BL** et une facture calculée sur les quantités/prix réellement reçus, ajoute le stock en **Réserve** et marque le BC **Réceptionné**. Une double réception du même BC est bloquée.
- **Litige** : dans Achats, les quantités et prix peuvent être corrigés; la résolution enregistre alors les mouvements de stock, le BL, la facture et le motif avant de clôturer le BC. Les BL en Réserve/Consolidé sont verrouillés contre une demande de suppression.
- **Achats** : bouton **Valider** uniquement (le BC validé attend la réception dans Stocks).
- **Lots multi-DLC / multi-fournisseurs** : chaque réception crée 1 lot par article avec lot + DLC + prix fournisseur + fournisseur. Un article peut donc avoir 2-3 DLC et 2-3 prix en même temps. Voir `Stocks → Fiches → 📦 Lots` + `Export lots`. Transferts et ventes sortent le lot le plus proche d'abord (FEFO). Marge et valeur stock calculées au prix réel du lot.
- **Réception multi-articles** : chaque ligne du BL a son champ Lot + DLC. Saisissez la vraie DLC de chaque article.
- **Promo DLC** : aucune promo automatique. Alerte par lot à 20 j (paliers J-20/J-10/J-5/J-1) ; **seul le gérant** marque la quantité au prix choisi. La vente FEFO bloque toute DLC dépassée.
- **Prix variables** : à la réception, au BC ou via 💲 article — ancien/nouveau prix historisés (date, agent, motif).
- **Démarque DLC par lot** : le gérant marque une quantité d'un lot précis au prix choisi (J-20/J-10/J-5/J-1). Stock inchangé au marquage, bouton DLC distinct en caisse, vente plafonnée au solde, DLC dépassée bloquée. Annulation gérant + retour ticket possibles.
- **Régime fiscal par boutique (Admin)** : MICRO / RME / RSI / RNI + NCC, RCCM, TSE, CGA, pied ticket. MICRO/RME sans collecte = ticket simple sans TVA. RSI/RNI = TVA A 18% / B 9% / E 0% + Facture PRO. Pas d'envoi DGI : à activer avec endpoints + clés du client le jour de l'achat.
- **Suppression ticket** : gérant uniquement. **Corbeille** : Admin 7777 uniquement.
- **FNE DGI** : module dédié (NCC, régime SII, TVA A/B/E, FCFA XOF).
- **Scan smartphone** : bouton 📷 en caisse (caméra) + scanner USB + saisie manuelle.

## Version vierge pour prospects (ne pas livrer db.json)
- Livrez uniquement le ZIP `-CODE` : app.js, server.js, data.js, index.html, styles.css, README.
- Ne livrez jamais `db.json` du magasin. La boutique crée sa base au premier lancement.
- À l'installation : Admin → Régime fiscal → choisir MICRO/RME/RSI/RNI, NCC, RCCM, pied ticket. Tester 1 réception multi-lots + 1 vente + 1 ticket MICRO et RSI.

## Sauvegarde
- Serveur : `db.json` (copie chaque soir) + boutons **Export JSON** / **Backups serveur** dans Paramétrage. Le fichier `db.json` de cette livraison contient vos données fournies : sauvegardez-le avant toute mise à jour et ne le remplacez pas par un fichier de démonstration.
- Local : Export/Import JSON.
