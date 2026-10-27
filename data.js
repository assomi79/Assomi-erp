/* Référentiel Rayon > Famille > Sous-famille + Taxes + données démo */
const TAX_CODES = {
  A:{code:"A", nom:"TVA Taux Normal", taux:18, exemples:"Sodas, alcools, cosmétiques, biscuits, ménagers, conserves importées"},
  B:{code:"B", nom:"TVA Taux Réduit", taux:9, exemples:"Laitiers industriels, huiles de table raffinées, petfood"},
  E:{code:"E", nom:"Exonéré / Hors Taxe", taux:0, exemples:"Viandes/poissons frais, pain, riz local, fruits & légumes locaux"},
};
const REFERENTIEL = [
 {code:"01", nom:"Produits Frais & Boucherie", icone:"🥩", familles:[
  {code:"01", nom:"Boucherie / Volaille", sous:["Viande bovine","Porc","Volaille (Poulet, Dinde)","Viande hachée","Gibier & Agneau"]},
  {code:"02", nom:"Charcuterie / Traiteur", sous:["Jambons (Cuit/Sec)","Saucissons","Pâtés & Terrines","Plats cuisinés frais","Salades traiteur"]},
  {code:"03", nom:"Poissonnerie", sous:["Poissons entiers","Filets & Pavés","Coquillages & Crustacés","Poissons fumés (Saumon)"]},
  {code:"04", nom:"Fruits & Légumes", sous:["Fruits de saison","Légumes frais","Agrumes","Herbes aromatiques","Fruits secs"]},
  {code:"05", nom:"Crémerie & Produits Laitiers", sous:["Lait (UHT/Frais)","Beurre & Margarine","Crèmes fraîches","Yaourts & Desserts lactés","Fromages (Coupe/Libre-service)","Œufs"]},
 ]},
 {code:"02", nom:"Épicerie Salée", icone:"🥫", familles:[
  {code:"01", nom:"Féculents & Conserves", sous:["Pâtes","Riz","Purées & Graines","Conserves de légumes","Conserves de poisson (Thon, Sardines)"]},
  {code:"02", nom:"Assaisonnements & Sauces", sous:["Huiles & Vinaigres","Sel & Poivre","Épices","Moutardes & Mayonnaises","Sauces tomate / pasta"]},
  {code:"03", nom:"Apéritifs & Snacks", sous:["Chips & Tuiles","Biscuits salés","Cacahuètes & Noix de cajou"]},
 ]},
 {code:"03", nom:"Épicerie Sucrée", icone:"🍫", familles:[
  {code:"01", nom:"Petit-Déjeuner", sous:["Café (Grain, Moulu, Capsules)","Thé & Infusions","Céréales","Confitures","Miels","Pâtes à tartiner"]},
  {code:"02", nom:"Biscuits & Gâteaux", sous:["Biscuits secs","Moelleux & Cakes","Goûters pour enfants"]},
  {code:"03", nom:"Confiserie & Chocolat", sous:["Tablettes de chocolat","Bonbons","Chewing-gums"]},
 ]},
 {code:"04", nom:"Boissons / Liquides", icone:"🥤", familles:[
  {code:"01", nom:"Eaux & Jus de fruits", sous:["Eaux plates","Eaux gazeuses","Jus de fruits 100%","Nectars & Sirops"]},
  {code:"02", nom:"Softs & Sodas", sous:["Sodas (Cola, Orange)","Boissons énergisantes","Thés glacés"]},
  {code:"03", nom:"Alcools & Caves", sous:["Bières (Blondes, Brunes, Artisanales)","Vins rouges/blancs/rosés","Spiritueux & Whiskies","Champagnes"]},
 ]},
 {code:"05", nom:"Surgelés", icone:"❄️", familles:[
  {code:"01", nom:"Salé Surgelé", sous:["Frites & Potatoes","Pizzas & Tartes","Viandes & Poissons surgelés","Légumes bruts surgelés"]},
  {code:"02", nom:"Sucré Surgelé", sous:["Glaces en bac","Cônes & Bâtonnets","Glaçons & Glace pilée"]},
 ]},
 {code:"06", nom:"DPH — Droguerie, Parfumerie, Hygiène", icone:"🧼", familles:[
  {code:"01", nom:"Hygiène & Beauté", sous:["Shampoing & Après-shampoing","Gels douche & Savons","Déodorants","Dentifrices & Brosses à dents","Rasage"]},
  {code:"02", nom:"Soin du corps & Cosmétique", sous:["Crèmes hydratantes","Maquillage","Protections hygiéniques féminines"]},
  {code:"03", nom:"Entretien de la maison (Droguerie)", sous:["Lessives (Liquide/Poudre)","Adoucissants","Produits vaisselle (Main/Machine)","Nettoyants sols & vitres","Essuie-tout & Sacs poubelle"]},
 ]},
 {code:"07", nom:"Univers Bébé", icone:"👶", familles:[
  {code:"01", nom:"Alimentation Bébé", sous:["Laits premier/deuxième âge","Petits pots (Salés/Sucrés)","Biscuits bébé"]},
  {code:"02", nom:"Soin & Change", sous:["Couches","Lingettes","Gel lavant bébé"]},
 ]},
 {code:"08", nom:"Non-Alimentaire (Bazar & Textile)", icone:"🏠", familles:[
  {code:"01", nom:"Maison & Cuisine", sous:["Vaisselle jetable","Ustensiles de cuisine","Rangement","Ampoules & Piles"]},
  {code:"02", nom:"Papeterie & Fournitures", sous:["Cahiers & Bloc-notes","Stylos & Crayons","Enveloppes"]},
  {code:"03", nom:"Animaux", sous:["Croquettes chiens/chats","Pâtées","Litières"]},
 ]},
];

const DEMO_PRODUITS = [];
const _DEMO_PRODUITS_ORIG = [
 {sku:"0104010001", ean:"6180104010011", nom:"Bananes Douces (kg)", rayon:"01", famille:"04", sous:"Fruits de saison", achat:450, vente:750, tva:0, code_tva:"E", stock:120, stockReserve:80, stockRayon:40, seuil:20, unite:"kg", dlc:"+6j", fournisseur:"Coopérative Fruits CI"},
 {sku:"0105010002", ean:"6180105010028", nom:"Lait UHT Demi-écrémé 1L", rayon:"01", famille:"05", sous:"Lait (UHT/Frais)", achat:600, vente:850, tva:9, code_tva:"B", stock:300, stockReserve:200, stockRayon:100, seuil:60, unite:"pcs", dlc:"+90j", fournisseur:"SOTRA Lait"},
 {sku:"0101010003", ean:"6180101010034", nom:"Poulet Fermier Entier (kg)", rayon:"01", famille:"01", sous:"Volaille (Poulet, Dinde)", achat:2200, vente:2900, tva:0, code_tva:"E", stock:45, stockReserve:25, stockRayon:20, seuil:15, unite:"kg", dlc:"+3j", fournisseur:"Ferme Avicole Anyama"},
 {sku:"0201010004", ean:"6180201010041", nom:"Spaghetti 500g Premium", rayon:"02", famille:"01", sous:"Pâtes", achat:350, vente:550, tva:18, code_tva:"A", stock:500, stockReserve:350, stockRayon:150, seuil:100, unite:"pcs", dlc:"+400j", fournisseur:"Import Pasta SARL"},
 {sku:"0201020005", ean:"6180201020057", nom:"Huile de Table Raffinée 1,5L", rayon:"02", famille:"02", sous:"Huiles & Vinaigres", achat:1300, vente:1750, tva:9, code_tva:"B", stock:8, stockReserve:5, stockRayon:3, seuil:30, unite:"pcs", dlc:"+200j", fournisseur:"Huilerie du Sud"},
 {sku:"0301010006", ean:"6180301010063", nom:"Café Moulu Arabica 250g", rayon:"03", famille:"01", sous:"Café (Grain, Moulu, Capsules)", achat:1800, vente:2500, tva:18, code_tva:"A", stock:140, stockReserve:90, stockRayon:50, seuil:40, unite:"pcs", dlc:"+300j", fournisseur:"Café Mont Nimba"},
 {sku:"0303020007", ean:"6180303020079", nom:"Tablette Chocolat Noir 100g", rayon:"03", famille:"03", sous:"Tablettes de chocolat", achat:700, vente:1100, tva:18, code_tva:"A", stock:260, stockReserve:180, stockRayon:80, seuil:50, unite:"pcs", dlc:"+250j", fournisseur:"Choco Ivoire"},
 {sku:"0402010008", ean:"6180402010085", nom:"Soda Cola 1,5L", rayon:"04", famille:"02", sous:"Sodas (Cola, Orange)", achat:650, vente:1000, tva:18, code_tva:"A", stock:400, stockReserve:280, stockRayon:120, seuil:80, unite:"pcs", dlc:"+180j", fournisseur:"Brasserie SOLIBRA"},
 {sku:"0401010009", ean:"6180401010091", nom:"Jus de Fruit de Côte d'Ivoire 1L", rayon:"04", famille:"01", sous:"Jus de fruits 100%", achat:900, vente:1500, tva:18, code_tva:"A", stock:600, stockReserve:420, stockRayon:180, seuil:120, unite:"pcs", dlc:"+365j", fournisseur:"Eau Céleste"},
 {sku:"0201010013", ean:"6180201010133", nom:"Riz local 5kg", rayon:"02", famille:"01", sous:"Riz", achat:3200, vente:4500, tva:0, code_tva:"E", stock:220, stockReserve:150, stockRayon:70, seuil:50, unite:"pcs", dlc:"+365j", fournisseur:"Coopérative Fruits CI"},
 {sku:"0501010010", ean:"6180501010107", nom:"Frites Surgelées 1kg", rayon:"05", famille:"01", sous:"Frites & Potatoes", achat:1200, vente:1800, tva:18, code_tva:"A", stock:90, stockReserve:60, stockRayon:30, seuil:30, unite:"pcs", dlc:"+300j", fournisseur:"Froid Import"},
 {sku:"0603010011", ean:"6180603010113", nom:"Lessive Poudre 1kg", rayon:"06", famille:"03", sous:"Lessives (Liquide/Poudre)", achat:1400, vente:2000, tva:18, code_tva:"A", stock:200, stockReserve:140, stockRayon:60, seuil:40, unite:"pcs", dlc:"—", fournisseur:"Detergent Plus"},
 {sku:"0702010012", ean:"6180702010129", nom:"Couches Bébé T4 (paquet 30)", rayon:"07", famille:"02", sous:"Couches", achat:2800, vente:3900, tva:18, code_tva:"A", stock:110, stockReserve:70, stockRayon:40, seuil:25, unite:"pcs", dlc:"—", fournisseur:"BabyCare Distrib"},
];

const DEMO_FOURNISSEURS = [];
const _DEMO_FOURNISSEURS_ORIG = [
 {id:"F001", nom:"Coopérative Fruits CI", contact:"Koffi Mensah", tel:"+225 07 09 12 34 56", email:"fruits@coop.ci", delai:"24h", franco:"50 000 F", paiement:"À réception"},
 {id:"F002", nom:"Brasserie SOLIBRA", contact:"Service Pro", tel:"+225 27 21 00 00 00", email:"pro@solibra.ci", delai:"48h", franco:"200 000 F", paiement:"30 jours"},
 {id:"F003", nom:"Choco Ivoire", contact:"Awa Diallo", tel:"+225 05 66 78 90 12", email:"awa@chocoivoire.ci", delai:"72h", franco:"100 000 F", paiement:"15 jours"},
 {id:"F004", nom:"Detergent Plus", contact:"Yao Kouassi", tel:"+225 07 47 11 22 33", email:"contact@detergentplus.ci", delai:"48h", franco:"150 000 F", paiement:"30 jours"},
 {id:"F005", nom:"SOTRA Lait", contact:" bureaux", tel:"+225 27 20 00 00 00", email:"contact@sotralait.ci", delai:"24h", franco:"80 000 F", paiement:"15 jours"},
 {id:"F006", nom:"Huilerie du Sud", contact:"K. Yao", tel:"+225 05 00 00 00 00", email:"c@huilerie.ci", delai:"48h", franco:"100 000 F", paiement:"30 jours"},
];

const DEMO_EMPLOYES = [
 {id:"E006", nom:"Gérant Magasin", poste:"Gérant", role:"Gérant", code:"9999", rayon:"Direction", salaire:0, statut:"Actif"},
 {id:"E007", nom:"Administrateur Système", poste:"Administrateur", role:"Admin", code:"7777", rayon:"Direction", salaire:0, statut:"Actif"},
];
