import { english, type MarketingCopy } from './copy';

const german: MarketingCopy = {
  lang: 'de', name: 'Deutsch', title: 'FurniDraw — Möbel online planen: Schränke & Küchen',
  description: 'Planen Sie Einbauschränke und Küchenschränke in 3D. Entdecken Sie Materialien, KI-Visualisierungen und bemaßte technische Zeichnungen mit FurniDraw.',
  nav: ["So funktioniert es","Planungsdetails","Planungswissen"], start: 'Studio öffnen', eyebrow: "MÖBEL ONLINE IN 3D PLANEN",
  headline: ["Möbel in 3D planen.","Mit präzisen Maßen."],
  intro: "Planen Sie Einbauschränke und Küchenschränke in 3D. Legen Sie Maße fest, konfigurieren Sie den Stauraum und prüfen Sie technische Zeichnungen.",
  explore: "Planer ausprobieren", note: 'Direkt im Browser. Zum Start ist kein Konto nötig.',
  study: "INTERAKTIVE ENTWURFSVORSCHAU", views: ['Material', 'Zeichnung'], shapes: ['Schrank', 'Nische', 'Unter der Treppe'], width: 'Breite',
  finishes: ['Eiche natur', 'Räuchereiche', 'Kreideweiß'], finish: 'Materialstudie', dimensionCta: 'Mit diesen Maßen beginnen',
  illustration: 'Eine interaktive Illustration. Die Maße werden ins Studio übernommen; Innenaufteilung und Oberflächen wählen Sie dort.',
  statement: ["Ein Planungsablauf.","Vom Entwurf zur Zeichnung."],
  statementBody: "Erfassen Sie den verfügbaren Raum, konfigurieren Sie die Möbel und prüfen Sie Maße und Materialangaben.",
  steps: [
    [
      "Den Raum modellieren.",
      "Legen Sie Raum- und Schrankmaße fest. Passen Sie Einbauschränke an Nischen, Dachschrägen und Treppen an."
    ],
    [
      "Materialien festlegen.",
      "Prüfen Sie Korpus- und Frontoberflächen in 3D. Eine optionale KI-Visualisierung zeigt den Entwurf in einem eingerichteten Raum."
    ],
    [
      "Zeichnungen prüfen.",
      "Erstellen Sie bemaßte Ansichten und Teilelisten. Besprechen Sie Ausstattung und Fertigungsdetails mit Ihrer Tischlerei."
    ]
  ],
  detail: ["MÖBELSPEZIFIKATION","Außen gestalten.","Innen konfigurieren."],
  imageAlt: 'Einbauschrank aus warmer Eiche mit offenen Regalen, Kleiderstangen und Schubladen in einem sonnigen Raum',
  imageCaption: 'Eine Wohninspiration. KI-Bilder dienen der Veranschaulichung; technische Zeichnungen beschreiben Ihren Entwurf.',
  materials: "Konfigurieren Sie Regale, Kleiderstangen, Schubladen und Türen. Vergleichen Sie Materialien und prüfen Sie die Anordnung von Schränken und Küchenmodulen im Raum.",
  resourceTitle: "Praktische Anleitungen zur Möbelplanung.", resourceIntro: "Hinweise zu Einbauschränken, Küchenmodulen, Aufmaß und technischen Zeichnungen. Die vollständigen Anleitungen sind auf Englisch.",
  resourceLink: 'Anleitung lesen', questions: "Produktinformationen.",
  faqs: [
    ['Was kann ich mit FurniDraw planen?', "Einbauschränke, geformten Stauraum und modulare Küchenschränke. Das Studio bietet Räume, Materialien, Innenausstattung "
      + "und technische Zeichnungen. Die automatischen Beispiele erstellen Kleiderschränke."],
    ['Brauche ich ein Konto oder eine Installation?', 'Sie können in einem modernen Browser ohne Konto und ohne Installation beginnen. Lokale Entwürfe bleiben im Browser; Konto- und Cloudfunktionen finden Sie im Studio.'],
    ['Kann ich FurniDraw kostenlos ausprobieren?', "Sie können ohne Credits mit der Planung beginnen. KI-Bilder und technische Zeichnungen nutzen das Creditsystem "
      + "im Studio. Dort finden Sie die aktuellen Freikontingente und Preise."],
    ['Kann ich die Möbel nach den Zeichnungen bauen?', "Besprechen Sie die bemaßten Zeichnungen mit Ihrer Tischlerei. Prüfen Sie Raummaße, Materialien, Freiräume und Beschläge "
      + "vor der Fertigung. Zuschnittlisten zeigen Fertigmaße; Bohrpläne sind nicht enthalten."],
    ['Kann ich FurniDraw in meinem Land nutzen?', "FurniDraw funktioniert im Browser. Die Einführung gibt es in mehreren Sprachen. Diese Vorschau bietet Zentimeter und "
      + "Zoll; das Studio bietet sieben Sprachen sowie Zentimeter, Millimeter und Zoll."],
  ],
  closing: ["Planen Sie Ihr nächstes Projekt.","Bestimmen Sie die Details in 3D."], language: 'Sprache',
  editorLanguage: 'Studio in 7 Sprachen · flexible Einheiten', skip: 'Zum Inhalt springen', units: 'Einheiten',
};

const french: MarketingCopy = {
  lang: 'fr', name: 'Français', title: 'FurniDraw — Concevez vos meubles et placards en ligne',
  description: 'Concevez des placards sur mesure et des meubles de cuisine en 3D. Explorez les matières, les visualisations IA et les plans cotés avec FurniDraw.',
  nav: ["Fonctionnement","Détails de conception","Guides pratiques"], start: 'Ouvrir le studio', eyebrow: "CONCEPTION DE MEUBLES EN LIGNE EN 3D",
  headline: ["Concevez vos meubles en 3D.","Avec des plans précis."],
  intro: "Concevez des placards sur mesure et des meubles de cuisine en 3D. Définissez les dimensions, organisez le rangement et consultez les plans cotés.",
  explore: "Explorer le concepteur", note: 'Dans votre navigateur. Aucun compte requis pour commencer.',
  study: "APERÇU INTERACTIF DU PROJET", views: ['Matière', 'Dessin'], shapes: ['Placard', 'Alcôve', 'Sous l’escalier'], width: 'Largeur',
  finishes: ['Chêne naturel', 'Chêne fumé', 'Blanc craie'], finish: 'Étude de matière', dimensionCta: 'Commencer avec ces dimensions',
  illustration: 'Une illustration interactive. Vos dimensions passent dans le studio ; choisissez ensuite les aménagements et les finitions.',
  statement: ["Un processus de conception.","Du modèle aux plans."],
  statementBody: "Modélisez l’espace disponible, configurez les meubles et vérifiez les dimensions et les spécifications des matériaux.",
  steps: [
    [
      "Modéliser l’espace.",
      "Définissez les dimensions de la pièce et du meuble. Adaptez les placards aux niches, aux plafonds inclinés et aux escaliers."
    ],
    [
      "Choisir les matériaux.",
      "Examinez les finitions du caisson et des façades en 3D. Une visualisation IA facultative présente le projet dans un intérieur aménagé."
    ],
    [
      "Vérifier les plans.",
      "Créez des vues cotées et des listes de pièces. Examinez les aménagements et les détails de fabrication avec votre artisan."
    ]
  ],
  detail: ["SPÉCIFICATIONS DU MEUBLE","Concevoir l’extérieur.","Configurer l’intérieur."],
  imageAlt: 'Placard en chêne avec étagères ouvertes, penderies et tiroirs dans une pièce ensoleillée',
  imageCaption: 'Une inspiration d’intérieur. Les images IA illustrent une ambiance ; les plans techniques décrivent votre projet.',
  materials: "Configurez les étagères, tringles, tiroirs et portes. Comparez les matériaux et vérifiez l’implantation des placards et meubles de cuisine dans la pièce.",
  resourceTitle: "Guides pratiques de conception de meubles.", resourceIntro: "Conseils sur les placards sur mesure, les meubles de cuisine, les mesures et les plans techniques. Les guides complets sont en anglais.",
  resourceLink: 'Lire le guide', questions: "Informations sur le produit.",
  faqs: [
    ['Que puis-je concevoir avec FurniDraw ?', "Des placards sur mesure, des rangements de forme adaptée et des meubles de cuisine modulaires. Le studio comprend "
      + "pièces, matières, aménagements et plans techniques. Les exemples automatiques créent des placards."],
    ['Faut-il un compte ou une installation ?', "Commencez dans un navigateur moderne sans compte ni installation. Les brouillons sont conservés dans votre navigateur ; "
      + "les fonctions de compte et de sauvegarde en ligne sont dans le studio."],
    ['Puis-je essayer gratuitement ?', 'Vous pouvez commencer à concevoir sans acheter de crédits. Les images IA et les plans utilisent le système de crédits du studio. Consultez-y les tarifs et les utilisations offertes.'],
    ['Les plans permettent-ils de fabriquer le meuble ?', "Étudiez les plans cotés avec votre artisan. Vérifiez mesures, matériaux, dégagements et quincaillerie avant fabrication. "
      + "Les listes de débit indiquent les dimensions finies ; les plans de perçage ne sont pas inclus."],
    ['Puis-je utiliser FurniDraw dans mon pays ?', "FurniDraw fonctionne dans votre navigateur. Cette présentation existe en plusieurs langues. L’aperçu propose centimètres "
      + "et pouces ; le studio propose sept langues et des mesures en centimètres, millimètres ou pouces."],
  ],
  closing: ["Planifiez votre prochain projet.","Définissez les détails en 3D."], language: 'Langue',
  editorLanguage: 'Studio en 7 langues · unités au choix', skip: 'Aller au contenu', units: 'Unités',
};

const spanish: MarketingCopy = {
  lang: 'es', name: 'Español', title: 'FurniDraw — Diseña muebles y armarios online en 3D',
  description: 'Diseña armarios a medida y muebles de cocina en 3D. Explora materiales, visualizaciones con IA y planos acotados con FurniDraw.',
  nav: ["Cómo funciona","Detalles de diseño","Guías prácticas"], start: 'Abrir el estudio', eyebrow: "DISEÑO DE MUEBLES ONLINE EN 3D",
  headline: ["Diseña muebles en 3D.","Con planos precisos."],
  intro: "Diseña armarios a medida y muebles de cocina en 3D. Define las medidas, configura el almacenamiento y revisa los planos acotados.",
  explore: "Explorar el diseñador", note: 'En tu navegador. Sin cuenta para empezar.',
  study: "VISTA PREVIA INTERACTIVA", views: ['Material', 'Plano'], shapes: ['Armario', 'Hueco', 'Bajo la escalera'], width: 'Ancho',
  finishes: ['Roble natural', 'Roble ahumado', 'Blanco tiza'], finish: 'Estudio de materiales', dimensionCta: 'Empezar con estas medidas',
  illustration: 'Una ilustración interactiva. Las medidas pasan al estudio; allí eliges los interiores y los acabados.',
  statement: ["Un proceso de diseño.","Del modelo a los planos."],
  statementBody: "Modela el espacio disponible, configura los muebles y revisa las dimensiones y las especificaciones de los materiales.",
  steps: [
    [
      "Modela el espacio.",
      "Define las medidas de la habitación y del armario. Adapta el diseño a huecos, techos inclinados y escaleras."
    ],
    [
      "Especifica los materiales.",
      "Revisa los acabados del cuerpo y los frentes en 3D. Una visualización con IA opcional muestra el diseño en un interior terminado."
    ],
    [
      "Revisa los planos.",
      "Genera vistas acotadas y listas de piezas. Revisa los interiores y los detalles de fabricación con tu carpintero."
    ]
  ],
  detail: ["ESPECIFICACIONES DEL MUEBLE","Diseña el exterior.","Configura el interior."],
  imageAlt: 'Armario de roble cálido con estantes abiertos, barras y cajones en una habitación luminosa',
  imageCaption: 'Un estudio de inspiración. Las imágenes con IA son ilustrativas; los planos técnicos describen tu diseño.',
  materials: "Configura estantes, barras, cajones y puertas. Compara materiales y revisa la distribución de armarios y muebles de cocina en la habitación.",
  resourceTitle: "Guías prácticas de diseño de muebles.", resourceIntro: "Consejos sobre armarios a medida, muebles de cocina, mediciones y planos técnicos. Las guías completas están en inglés.",
  resourceLink: 'Leer la guía', questions: "Información del producto.",
  faqs: [
    ['¿Qué puedo diseñar con FurniDraw?', "Armarios a medida, almacenamiento con formas adaptadas y muebles de cocina modulares. El estudio incluye habitaciones, "
      + "materiales, interiores y planos técnicos. Los ejemplos automáticos crean armarios."],
    ['¿Necesito una cuenta o instalar algo?', 'Puedes empezar en un navegador moderno sin cuenta ni instalación. Los borradores se guardan en tu navegador; las funciones de cuenta y nube están en el estudio.'],
    ['¿Puedo probar FurniDraw gratis?', 'Puedes empezar a diseñar sin comprar créditos. Las imágenes con IA y los planos usan el sistema de créditos del estudio. Consulta allí los precios y los usos gratuitos actuales.'],
    ['¿Puedo fabricar los muebles con los planos?', "Revisa los planos acotados con un carpintero. Confirma medidas, materiales, holguras y herrajes antes de fabricar. Las "
      + "listas de corte muestran medidas finales; no incluyen planos de taladrado."],
    ['¿Puedo usar FurniDraw en mi país?', "FurniDraw funciona en el navegador. Esta presentación está en varios idiomas. La vista previa ofrece "
      + "centímetros y pulgadas; el estudio ofrece siete idiomas y medidas en centímetros, milímetros o pulgadas."],
  ],
  closing: ["Planifica tu próximo proyecto.","Define los detalles en 3D."], language: 'Idioma',
  editorLanguage: 'Estudio en 7 idiomas · unidades flexibles', skip: 'Ir al contenido', units: 'Unidades',
};

const polish: MarketingCopy = {
  lang: 'pl', name: 'Polski', title: 'FurniDraw — Projektowanie mebli i szaf online w 3D',
  description: 'Projektuj szafy na wymiar i szafki kuchenne w 3D. Odkrywaj materiały, wizualizacje AI i zwymiarowane rysunki techniczne z FurniDraw.',
  nav: ["Jak to działa","Szczegóły projektu","Poradniki"], start: 'Otwórz studio', eyebrow: "PROJEKTOWANIE MEBLI ONLINE W 3D",
  headline: ["Projektowanie mebli w 3D.","Precyzyjne rysunki."],
  intro: "Projektuj szafy na wymiar i szafki kuchenne w 3D. Określ wymiary, skonfiguruj wyposażenie i sprawdź rysunki techniczne.",
  explore: "Wypróbuj projektowanie", note: 'W przeglądarce. Na początek nie potrzebujesz konta.',
  study: "INTERAKTYWNY PODGLĄD PROJEKTU", views: ['Materiał', 'Rysunek'], shapes: ['Szafa', 'Wnęka', 'Pod schodami'], width: 'Szerokość',
  finishes: ['Dąb naturalny', 'Dąb wędzony', 'Kredowa biel'], finish: 'Studium materiału', dimensionCta: 'Zacznij od tych wymiarów',
  illustration: 'Interaktywna ilustracja. Wymiary przeniosą się do studia; tam dobierzesz wyposażenie i wykończenia.',
  statement: ["Jeden proces projektowy.","Od modelu do rysunków."],
  statementBody: "Odwzoruj dostępną przestrzeń, skonfiguruj meble i sprawdź wymiary oraz specyfikację materiałów.",
  steps: [
    [
      "Odwzoruj przestrzeń.",
      "Określ wymiary pomieszczenia i szafy. Dopasuj zabudowę do wnęk, skosów i przestrzeni pod schodami."
    ],
    [
      "Określ materiały.",
      "Sprawdź wykończenia korpusu i frontów w 3D. Opcjonalna wizualizacja AI przedstawia projekt w gotowym wnętrzu."
    ],
    [
      "Sprawdź rysunki.",
      "Wygeneruj zwymiarowane widoki i listy elementów. Omów wyposażenie i szczegóły wykonania ze stolarzem."
    ]
  ],
  detail: ["SPECYFIKACJA MEBLI","Zaprojektuj bryłę.","Skonfiguruj wnętrze."],
  imageAlt: 'Szafa z ciepłego dębu z otwartymi półkami, drążkami i szufladami w słonecznym wnętrzu',
  imageCaption: 'Inspiracja wnętrzarska. Obrazy AI mają charakter poglądowy; rysunki techniczne opisują Twój projekt.',
  materials: "Skonfiguruj półki, drążki, szuflady i drzwi. Porównaj materiały i sprawdź rozmieszczenie szaf oraz szafek kuchennych w pomieszczeniu.",
  resourceTitle: "Praktyczne poradniki projektowania mebli.", resourceIntro: "Wskazówki dotyczące szaf na wymiar, szafek kuchennych, pomiarów i rysunków technicznych. Pełne poradniki są po angielsku.",
  resourceLink: 'Przeczytaj poradnik', questions: "Informacje o produkcie.",
  faqs: [
    ['Co mogę zaprojektować w FurniDraw?', "Szafy na wymiar, zabudowy o niestandardowym kształcie i modułowe szafki kuchenne. Studio zawiera pomieszczenia, "
      + "materiały, wyposażenie i rysunki techniczne. Automatyczne przykłady tworzą szafy."],
    ['Czy potrzebuję konta lub instalacji?', 'Możesz zacząć w nowoczesnej przeglądarce bez konta i instalowania programu. Szkice pozostają w przeglądarce; funkcje konta i chmury znajdziesz w studiu.'],
    ['Czy mogę wypróbować FurniDraw bezpłatnie?', 'Możesz zacząć projektować bez kupowania kredytów. Obrazy AI i rysunki korzystają z systemu kredytów w studiu. Tam sprawdzisz aktualne ceny i bezpłatne użycia.'],
    ['Czy mogę wykonać mebel na podstawie rysunków?', 'Omów zwymiarowane rysunki ze stolarzem. Przed wykonaniem sprawdź pomiary, materiały, luzy i okucia. Listy cięcia podają wymiary gotowe; nie zawierają planów wierceń.'],
    ['Czy mogę korzystać z FurniDraw w moim kraju?', 'FurniDraw działa w przeglądarce. Wprowadzenie jest dostępne w kilku językach. Podgląd obsługuje centymetry i cale; pełne studio używa obecnie języka angielskiego i centymetrów.'],
  ],
  closing: ["Zaplanuj kolejny projekt.","Określ szczegóły w 3D."], language: 'Język',
  editorLanguage: 'Studio w 7 językach · wybór jednostek', skip: 'Przejdź do treści', units: 'Jednostki',
};

const portuguese: MarketingCopy = {
  lang: 'pt', name: 'Português', title: 'FurniDraw — Projete móveis e armários online em 3D',
  description: 'Crie armários sob medida e móveis de cozinha em 3D. Explore materiais, visualizações com IA e desenhos técnicos cotados com FurniDraw.',
  nav: ["Como funciona","Detalhes do projeto","Guias práticos"], start: 'Abrir o estúdio', eyebrow: "PROJETO DE MÓVEIS ONLINE EM 3D",
  headline: ["Projete móveis em 3D.","Com desenhos precisos."],
  intro: "Projete armários sob medida e móveis de cozinha em 3D. Defina as medidas, configure o armazenamento e revise os desenhos técnicos.",
  explore: "Explorar o projetista", note: 'No navegador. Sem conta para começar.',
  study: "PRÉVIA INTERATIVA DO PROJETO", views: ['Material', 'Desenho'], shapes: ['Armário', 'Nicho', 'Sob a escada'], width: 'Largura',
  finishes: ['Carvalho natural', 'Carvalho fumado', 'Branco giz'], finish: 'Estudo de materiais', dimensionCta: 'Começar com estas medidas',
  illustration: 'Uma ilustração interativa. As medidas passam para o estúdio; lá você escolhe os interiores e acabamentos.',
  statement: ["Um processo de projeto.","Do modelo aos desenhos."],
  statementBody: "Modele o espaço disponível, configure os móveis e confira as dimensões e as especificações dos materiais.",
  steps: [
    [
      "Modele o espaço.",
      "Defina as dimensões do ambiente e do armário. Adapte o projeto a nichos, tetos inclinados e escadas."
    ],
    [
      "Especifique os materiais.",
      "Confira os acabamentos da estrutura e das frentes em 3D. Uma visualização com IA opcional mostra o projeto em um interior pronto."
    ],
    [
      "Revise os desenhos.",
      "Gere vistas cotadas e listas de peças. Revise os interiores e os detalhes de fabricação com seu marceneiro."
    ]
  ],
  detail: ["ESPECIFICAÇÕES DO MÓVEL","Projete o exterior.","Configure o interior."],
  imageAlt: 'Armário de carvalho com prateleiras abertas, cabideiros e gavetas em um ambiente ensolarado',
  imageCaption: 'Um estudo de inspiração. Imagens com IA são ilustrativas; desenhos técnicos descrevem seu projeto.',
  materials: "Configure prateleiras, cabideiros, gavetas e portas. Compare materiais e confira a disposição dos armários e móveis de cozinha no ambiente.",
  resourceTitle: "Guias práticos de projeto de móveis.", resourceIntro: "Orientações sobre armários sob medida, móveis de cozinha, medidas e desenhos técnicos. Os guias completos estão em inglês.",
  resourceLink: 'Ler o guia', questions: "Informações do produto.",
  faqs: [
    ['O que posso projetar com FurniDraw?', "Armários sob medida, armazenamento com formas adaptadas e móveis de cozinha modulares. O estúdio inclui ambientes, "
      + "materiais, interiores e desenhos técnicos. Os exemplos automáticos criam armários."],
    ['Preciso de conta ou instalação?', 'Você pode começar em um navegador moderno sem conta nem instalação. Os rascunhos ficam no navegador; os recursos de conta e nuvem estão no estúdio.'],
    ['Posso experimentar gratuitamente?', "Você pode começar a projetar sem comprar créditos. Imagens com IA e desenhos usam o sistema de créditos do estúdio. "
      + "Consulte os preços e os usos gratuitos atuais antes de usar um recurso pago."],
    ['Posso fabricar os móveis com os desenhos?', "Revise os desenhos cotados com um marceneiro. Confirme medidas, materiais, folgas e ferragens antes de fabricar. As "
      + "listas de corte indicam medidas finais; não incluem planos de furação."],
    ['Posso usar FurniDraw no meu país?', "FurniDraw funciona no navegador. Esta apresentação está disponível em vários idiomas. A prévia oferece "
      + "centímetros e polegadas; o estúdio oferece sete idiomas e medidas em centímetros, milímetros ou polegadas."],
  ],
  closing: ["Planeje seu próximo projeto.","Defina os detalhes em 3D."], language: 'Idioma',
  editorLanguage: 'Estúdio em 7 idiomas · unidades flexíveis', skip: 'Ir para o conteúdo', units: 'Unidades',
};

const turkish: MarketingCopy = {
  lang: 'tr', name: 'Türkçe', title: 'FurniDraw — Online 3D Mobilya ve Gardırop Tasarımı',
  description: 'Özel ölçü gardıropları ve mutfak dolaplarını 3D tasarlayın. FurniDraw ile malzemeleri, yapay zekâ görsellerini ve ölçülü teknik çizimleri keşfedin.',
  nav: ["Nasıl çalışır","Tasarım detayları","Planlama rehberleri"], start: 'Stüdyoyu aç', eyebrow: "ONLINE 3D MOBİLYA TASARIMI",
  headline: ["3D mobilya tasarımı.","Hassas ölçülü planlar."],
  intro: "Özel ölçü gardıropları ve mutfak dolaplarını 3D tasarlayın. Ölçüleri belirleyin, iç düzeni yapılandırın ve teknik çizimleri inceleyin.",
  explore: "Tasarım aracını inceleyin", note: 'Tarayıcınızda tasarlayın. Başlamak için hesap gerekmez.',
  study: "ETKİLEŞİMLİ TASARIM ÖNİZLEMESİ", views: ['Malzeme', 'Çizim'], shapes: ['Gardırop', 'Niş', 'Merdiven altı'], width: 'Genişlik',
  finishes: ['Doğal meşe', 'Füme meşe', 'Tebeşir beyazı'], finish: 'Malzeme çalışması', dimensionCta: 'Bu ölçülerle başlayın',
  illustration: 'Etkileşimli bir görsel çalışma. Ölçüleriniz stüdyoya aktarılır; iç düzeni ve yüzeyleri orada seçersiniz.',
  statement: ["Tek bir tasarım süreci.","Modelden teknik çizime."],
  statementBody: "Kullanılabilir alanı modelleyin, mobilyayı yapılandırın ve ölçülerle malzeme özelliklerini inceleyin.",
  steps: [
    [
      "Alanı modelleyin.",
      "Oda ve dolap ölçülerini belirleyin. Gardıropları nişlere, eğimli tavanlara ve merdiven altına uyarlayın."
    ],
    [
      "Malzemeleri belirleyin.",
      "Gövde ve kapak yüzeylerini 3D inceleyin. İsteğe bağlı yapay zekâ görselleştirmesi tasarımı tamamlanmış bir iç mekânda gösterir."
    ],
    [
      "Çizimleri inceleyin.",
      "Ölçülü görünüşler ve parça listeleri oluşturun. İç donanımları ve üretim detaylarını marangozunuzla değerlendirin."
    ]
  ],
  detail: ["MOBİLYA ÖZELLİKLERİ","Dış görünümü tasarlayın.","İç düzeni yapılandırın."],
  imageAlt: 'Güneşli bir odada açık rafları, askılıkları ve çekmeceleri bulunan sıcak meşe gardırop',
  imageCaption: 'Bir iç mekân ilham çalışması. Yapay zekâ görselleri temsilidir; teknik çizimler tasarımınızı anlatır.',
  materials: "Rafları, askıları, çekmeceleri ve kapakları yapılandırın. Malzemeleri karşılaştırın ve gardıroplarla mutfak dolaplarının odaya yerleşimini inceleyin.",
  resourceTitle: "Pratik mobilya planlama rehberleri.", resourceIntro: "Özel ölçü gardıroplar, mutfak dolapları, ölçüler ve teknik çizimler hakkında rehberler. Ayrıntılı rehberler İngilizcedir.",
  resourceLink: 'Rehberi okuyun', questions: "Ürün bilgileri.",
  faqs: [
    ['FurniDraw ile neler tasarlayabilirim?', "Özel ölçü gardıroplar, farklı biçimlerde depolama alanları ve modüler mutfak dolapları. Stüdyoda odalar, malzemeler, iç "
      + "donanımlar ve teknik çizimler bulunur. Otomatik örnekler gardırop oluşturur."],
    ['Hesap veya kurulum gerekli mi?', 'Modern bir tarayıcıda hesap açmadan ve program kurmadan başlayabilirsiniz. Taslaklar tarayıcınızda saklanır; hesap ve bulut özellikleri stüdyodadır.'],
    ['FurniDraw ücretsiz denenebilir mi?', "Kredi satın almadan tasarlamaya başlayabilirsiniz. Yapay zekâ görselleri ve teknik çizimler stüdyodaki kredi sistemini "
      + "kullanır. Güncel fiyatları ve ücretsiz kullanımları orada kontrol edin."],
    ['Çizimlerle mobilya üretebilir miyim?', "Ölçülü çizimleri marangozunuzla inceleyin. Üretimden önce yerinde ölçüleri, malzemeleri, boşlukları ve donanımları "
      + "doğrulayın. Kesim listeleri bitmiş ölçüleri verir; delik planları dahil değildir."],
    ['FurniDraw ülkemde kullanılabilir mi?', 'FurniDraw tarayıcıda çalışır. Bu tanıtım birkaç dilde sunulur. Önizlemede santimetre veya inç seçebilirsiniz; stüdyo yedi dil ile santimetre, milimetre ve inç ölçülerini destekler.'],
  ],
  closing: ["Yeni projenizi planlayın.","Detayları 3D belirleyin."], language: 'Dil',
  editorLanguage: '7 dilde stüdyo · esnek birimler', skip: 'İçeriğe geç', units: 'Birimler',
};

export const languages: readonly MarketingCopy[] = [english, german, french, spanish, polish, portuguese, turkish];
export const homePath = (lang: string) => lang === 'en' ? '/' : `/${lang}/`;
