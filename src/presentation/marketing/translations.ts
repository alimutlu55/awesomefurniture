import { english, type MarketingCopy } from './copy';

const german: MarketingCopy = {
  lang: 'de', name: 'Deutsch', title: 'FurniDraw — Möbel online planen: Schränke & Küchen',
  description: "Gestalten. Konstruieren. Bauen. Planen Sie Raum und Möbel in einem 3D-Studio und erstellen Sie bemaßte Zeichnungen und Teilelisten mit FurniDraw.",
  nav: ['Das Erlebnis', 'Die Details', 'Planungswissen'], start: 'Studio öffnen', eyebrow: "IHRE MÖBEL. VON DER IDEE BIS ZUM BAU.",
  headline: ["Gestalten.", "Konstruieren.", "Bauen."],
  intro: "Sehen Sie, was in Ihren Raum passt, arbeiten Sie die Konstruktion aus und erstellen Sie klare Pläne für den Bau. Alles in einem 3D-Studio.",
  explore: 'Selbst gestalten', note: 'Direkt im Browser. Zum Start ist kein Konto nötig.',
  study: 'DER PLANUNGSRAUM / STUDIE 001', views: ['Material', 'Zeichnung'], shapes: ['Schrank', 'Nische', 'Unter der Treppe'], width: 'Breite',
  finishes: ['Eiche natur', 'Räuchereiche', 'Kreideweiß'], finish: 'Materialstudie', dimensionCta: 'Mit diesen Maßen beginnen',
  illustration: 'Eine interaktive Illustration. Die Maße werden ins Studio übernommen; Innenaufteilung und Oberflächen wählen Sie dort.',
  statement: ["Ein Studio.", "Von der ersten Idee bis zum Bau."],
  statementBody: "Planen Sie Raum, Möbel und Konstruktionsdetails in einem Projekt. Entdecken Sie Möglichkeiten, klären Sie technische Fragen und nehmen Sie klare Unterlagen mit in die Werkstatt.",
  steps: [
    [
      "Gestalten.",
      "Planen Sie Raum und Möbel gemeinsam in 3D. Probieren Sie Aufteilungen und Oberflächen aus und stellen Sie sich den fertigen Raum mit einem KI-Bild vor."
    ],
    [
      "Konstruieren.",
      "Verfeinern Sie Maße, Materialien und Beschläge. Arbeiten Sie die Konstruktion aus und prüfen Sie, wie die Teile zusammenpassen, bevor etwas zugeschnitten wird."
    ],
    [
      "Bauen.",
      "Erstellen Sie bemaßte Zeichnungen, Zuschnitt- und Beschlaglisten. Bauen Sie selbst oder geben Sie Ihrer Tischlerei einen klaren Plan."
    ],
  ],
  detail: ["DETAILS FÜR DIE UMSETZUNG", "Für Ihren Raum gestaltet.", "Für den Bau durchdacht."],
  imageAlt: 'Einbauschrank aus warmer Eiche mit offenen Regalen, Kleiderstangen und Schubladen in einem sonnigen Raum',
  imageCaption: 'Eine Wohninspiration. KI-Bilder dienen der Veranschaulichung; technische Zeichnungen beschreiben Ihren Entwurf.',
  materials: "Gestalten Sie Stauraum für Ihren Alltag, mit Böden, Kleiderstangen, Schubladen und Türen. Verfeinern Sie danach Maße, Plattenmaterialien und Beschläge im selben 3D-Studio.",
  resourceTitle: "Ein klarer Plan. Ein besseres Ergebnis.", resourceIntro: "Praktische Hinweise zur Raumplanung, zu Einbaumöbeln und zu den Zeichnungen und Teilen für den Bau. Die ausführlichen Anleitungen sind auf Englisch.",
  resourceLink: 'Anleitung lesen', questions: 'Bevor Sie beginnen.',
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
  closing: ["Gestalten. Konstruieren.", "Bauen."], language: 'Sprache',
  editorLanguage: 'Studio in 7 Sprachen · flexible Einheiten', skip: 'Zum Inhalt springen', units: 'Einheiten',
};

const french: MarketingCopy = {
  lang: 'fr', name: 'Français', title: 'FurniDraw — Concevez vos meubles et placards en ligne',
  description: "Imaginez. Concevez. Fabriquez. Planifiez votre pièce et vos meubles dans un studio 3D, puis créez des plans cotés et des listes de pièces avec FurniDraw.",
  nav: ['L’expérience', 'Les détails', 'Carnet de conception'], start: 'Ouvrir le studio', eyebrow: "VOS MEUBLES. DE L’IDÉE À LA FABRICATION.",
  headline: ["Imaginez.", "Concevez.", "Fabriquez."],
  intro: "Voyez ce qui convient à votre espace, précisez l’assemblage et créez des plans clairs pour la fabrication. Tout cela dans un seul studio 3D.",
  explore: 'À vous de créer', note: 'Dans votre navigateur. Aucun compte requis pour commencer.',
  study: 'L’ATELIER / ÉTUDE 001', views: ['Matière', 'Dessin'], shapes: ['Placard', 'Alcôve', 'Sous l’escalier'], width: 'Largeur',
  finishes: ['Chêne naturel', 'Chêne fumé', 'Blanc craie'], finish: 'Étude de matière', dimensionCta: 'Commencer avec ces dimensions',
  illustration: 'Une illustration interactive. Vos dimensions passent dans le studio ; choisissez ensuite les aménagements et les finitions.',
  statement: ["Un seul studio.", "De la première idée à la fabrication."],
  statementBody: "Réunissez la pièce, les meubles et les détails de construction dans un même projet. Explorez le design, précisez les choix techniques et préparez des documents clairs pour l’atelier.",
  steps: [
    [
      "Imaginez.",
      "Dessinez votre pièce et vos meubles en 3D. Explorez les agencements et les finitions, puis créez une image IA pour imaginer votre projet dans une pièce aménagée."
    ],
    [
      "Concevez.",
      "Précisez les dimensions, les matériaux et la quincaillerie. Examinez la construction et la façon dont les pièces s’assemblent avant la découpe."
    ],
    [
      "Fabriquez.",
      "Créez des plans cotés et des listes de découpe et de quincaillerie. Fabriquez vous-même ou confiez un plan clair à votre artisan."
    ],
  ],
  detail: ["LES DÉTAILS QUI FONT LA DIFFÉRENCE", "Pensé pour votre espace.", "Conçu pour la fabrication."],
  imageAlt: 'Placard en chêne avec étagères ouvertes, penderies et tiroirs dans une pièce ensoleillée',
  imageCaption: 'Une inspiration d’intérieur. Les images IA illustrent une ambiance ; les plans techniques décrivent votre projet.',
  materials: "Adaptez le rangement à vos besoins : étagères, penderies, tiroirs et portes. Affinez ensuite les dimensions, les panneaux et la quincaillerie dans le même studio 3D.",
  resourceTitle: "Un plan plus clair. Une fabrication mieux préparée.", resourceIntro: "Des conseils pour concevoir votre pièce, vos meubles sur mesure et les plans utiles à leur fabrication. Les guides détaillés sont en anglais.",
  resourceLink: 'Lire le guide', questions: 'Avant de commencer.',
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
  closing: ["Imaginez. Concevez.", "Fabriquez."], language: 'Langue',
  editorLanguage: 'Studio en 7 langues · unités au choix', skip: 'Aller au contenu', units: 'Unités',
};

const spanish: MarketingCopy = {
  lang: 'es', name: 'Español', title: 'FurniDraw — Diseña muebles y armarios online en 3D',
  description: "Diseña. Detalla. Construye. Planifica tu habitación y tus muebles en un estudio 3D y crea planos acotados y listas de piezas con FurniDraw.",
  nav: ['La experiencia', 'Los detalles', 'Cuaderno de diseño'], start: 'Abrir el estudio', eyebrow: "TUS MUEBLES. DE LA IDEA A LA CONSTRUCCIÓN.",
  headline: ["Diseña.", "Detalla.", "Construye."],
  intro: "Descubre qué encaja en tu espacio, define cómo se ensambla y crea planos claros para construirlo. Todo en un estudio 3D.",
  explore: 'Hazlo tuyo', note: 'En tu navegador. Sin cuenta para empezar.',
  study: 'EL ESTUDIO / PROYECTO 001', views: ['Material', 'Plano'], shapes: ['Armario', 'Hueco', 'Bajo la escalera'], width: 'Ancho',
  finishes: ['Roble natural', 'Roble ahumado', 'Blanco tiza'], finish: 'Estudio de materiales', dimensionCta: 'Empezar con estas medidas',
  illustration: 'Una ilustración interactiva. Las medidas pasan al estudio; allí eliges los interiores y los acabados.',
  statement: ["Un solo estudio.", "De la primera idea a la construcción."],
  statementBody: "Reúne la habitación, los muebles y los detalles de construcción en un proyecto. Explora el diseño, resuelve las decisiones técnicas y lleva información clara al taller.",
  steps: [
    [
      "Diseña.",
      "Planifica tu habitación y tus muebles en 3D. Prueba distribuciones y acabados, y usa una imagen con IA para imaginar tu diseño en una habitación terminada."
    ],
    [
      "Detalla.",
      "Ajusta las medidas, los materiales y los herrajes. Revisa la construcción y cómo encajan las piezas antes de cortar."
    ],
    [
      "Construye.",
      "Crea planos acotados y listas de corte y herrajes. Fabrica tus muebles o entrega a tu carpintero un plan claro."
    ],
  ],
  detail: ["LOS DETALLES QUE LO HACEN FUNCIONAR", "Diseñado para tu espacio.", "Preparado para construir."],
  imageAlt: 'Armario de roble cálido con estantes abiertos, barras y cajones en una habitación luminosa',
  imageCaption: 'Un estudio de inspiración. Las imágenes con IA son ilustrativas; los planos técnicos describen tu diseño.',
  materials: "Adapta el almacenamiento a tus necesidades con estantes, barras, cajones y puertas. Después ajusta las medidas, los tableros y los herrajes en el mismo estudio 3D.",
  resourceTitle: "Un plan más claro. Una mejor construcción.", resourceIntro: "Guías prácticas para planificar tu habitación, diseñar muebles a medida y entender los planos y las piezas. Las guías completas están en inglés.",
  resourceLink: 'Leer la guía', questions: 'Antes de empezar.',
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
  closing: ["Diseña. Detalla.", "Construye."], language: 'Idioma',
  editorLanguage: 'Estudio en 7 idiomas · unidades flexibles', skip: 'Ir al contenido', units: 'Unidades',
};

const polish: MarketingCopy = {
  lang: 'pl', name: 'Polski', title: 'FurniDraw — Projektowanie mebli i szaf online w 3D',
  description: "Zaprojektuj. Dopracuj. Zbuduj. Zaplanuj pokój i meble w jednym studiu 3D, a potem przygotuj zwymiarowane rysunki i listy części z FurniDraw.",
  nav: ['Jak to działa', 'Detale', 'Poradnik'], start: 'Otwórz studio', eyebrow: "TWOJE MEBLE. OD POMYSŁU DO WYKONANIA.",
  headline: ["Zaprojektuj.", "Dopracuj.", "Zbuduj."],
  intro: "Zobacz, co pasuje do Twojej przestrzeni, dopracuj konstrukcję i przygotuj czytelne plany do wykonania mebli. Wszystko w jednym studiu 3D.",
  explore: 'Zaprojektuj po swojemu', note: 'W przeglądarce. Na początek nie potrzebujesz konta.',
  study: 'PRZYMIERZALNIA / STUDIUM 001', views: ['Materiał', 'Rysunek'], shapes: ['Szafa', 'Wnęka', 'Pod schodami'], width: 'Szerokość',
  finishes: ['Dąb naturalny', 'Dąb wędzony', 'Kredowa biel'], finish: 'Studium materiału', dimensionCta: 'Zacznij od tych wymiarów',
  illustration: 'Interaktywna ilustracja. Wymiary przeniosą się do studia; tam dobierzesz wyposażenie i wykończenia.',
  statement: ["Jedno studio.", "Od pierwszego pomysłu do wykonania."],
  statementBody: "Planuj pomieszczenie, meble i szczegóły konstrukcji w jednym projekcie. Wypróbuj pomysły, dopracuj rozwiązania techniczne i przygotuj czytelne informacje do pracy w warsztacie.",
  steps: [
    [
      "Zaprojektuj.",
      "Zaplanuj pokój i meble w 3D. Wypróbuj układy i wykończenia, a potem stwórz obraz AI, aby zobaczyć swój pomysł w urządzonym wnętrzu."
    ],
    [
      "Dopracuj.",
      "Dopasuj wymiary, materiały i okucia. Sprawdź konstrukcję i sposób połączenia elementów, zanim zaczniesz je przycinać."
    ],
    [
      "Zbuduj.",
      "Przygotuj zwymiarowane rysunki, listy cięcia i zestawienia okuć. Wykonaj meble samodzielnie albo przekaż stolarzowi czytelny plan."
    ],
  ],
  detail: ["SZCZEGÓŁY, KTÓRE MAJĄ ZNACZENIE", "Zaprojektowane do Twojej przestrzeni.", "Dopracowane do wykonania."],
  imageAlt: 'Szafa z ciepłego dębu z otwartymi półkami, drążkami i szufladami w słonecznym wnętrzu',
  imageCaption: 'Inspiracja wnętrzarska. Obrazy AI mają charakter poglądowy; rysunki techniczne opisują Twój projekt.',
  materials: "Dopasuj przechowywanie do swoich potrzeb: półki, drążki, szuflady i drzwi. Następnie dopracuj wymiary, materiały płyt i okucia w tym samym studiu 3D.",
  resourceTitle: "Czytelniejszy plan. Lepsze wykonanie.", resourceIntro: "Praktyczne poradniki o planowaniu pomieszczeń, meblach na wymiar oraz rysunkach i częściach potrzebnych do wykonania. Pełne poradniki są po angielsku.",
  resourceLink: 'Przeczytaj poradnik', questions: 'Zanim zaczniesz.',
  faqs: [
    ['Co mogę zaprojektować w FurniDraw?', "Szafy na wymiar, zabudowy o niestandardowym kształcie i modułowe szafki kuchenne. Studio zawiera pomieszczenia, "
      + "materiały, wyposażenie i rysunki techniczne. Automatyczne przykłady tworzą szafy."],
    ['Czy potrzebuję konta lub instalacji?', 'Możesz zacząć w nowoczesnej przeglądarce bez konta i instalowania programu. Szkice pozostają w przeglądarce; funkcje konta i chmury znajdziesz w studiu.'],
    ['Czy mogę wypróbować FurniDraw bezpłatnie?', 'Możesz zacząć projektować bez kupowania kredytów. Obrazy AI i rysunki korzystają z systemu kredytów w studiu. Tam sprawdzisz aktualne ceny i bezpłatne użycia.'],
    ['Czy mogę wykonać mebel na podstawie rysunków?', 'Omów zwymiarowane rysunki ze stolarzem. Przed wykonaniem sprawdź pomiary, materiały, luzy i okucia. Listy cięcia podają wymiary gotowe; nie zawierają planów wierceń.'],
    ['Czy mogę korzystać z FurniDraw w moim kraju?', 'FurniDraw działa w przeglądarce. Wprowadzenie jest dostępne w kilku językach. Podgląd obsługuje centymetry i cale; pełne studio używa obecnie języka angielskiego i centymetrów.'],
  ],
  closing: ["Zaprojektuj. Dopracuj.", "Zbuduj."], language: 'Język',
  editorLanguage: 'Studio w 7 językach · wybór jednostek', skip: 'Przejdź do treści', units: 'Jednostki',
};

const portuguese: MarketingCopy = {
  lang: 'pt', name: 'Português', title: 'FurniDraw — Projete móveis e armários online em 3D',
  description: "Projete. Detalhe. Construa. Planeje o ambiente e os móveis em um estúdio 3D e crie desenhos cotados e listas de peças com FurniDraw.",
  nav: ['A experiência', 'Os detalhes', 'Caderno de projeto'], start: 'Abrir o estúdio', eyebrow: "SEUS MÓVEIS. DA IDEIA À CONSTRUÇÃO.",
  headline: ["Projete.", "Detalhe.", "Construa."],
  intro: "Veja o que cabe no seu espaço, defina como as peças se encaixam e crie planos claros para construir. Tudo em um estúdio 3D.",
  explore: 'Crie do seu jeito', note: 'No navegador. Sem conta para começar.',
  study: 'O ESTÚDIO / ESTUDO 001', views: ['Material', 'Desenho'], shapes: ['Armário', 'Nicho', 'Sob a escada'], width: 'Largura',
  finishes: ['Carvalho natural', 'Carvalho fumado', 'Branco giz'], finish: 'Estudo de materiais', dimensionCta: 'Começar com estas medidas',
  illustration: 'Uma ilustração interativa. As medidas passam para o estúdio; lá você escolhe os interiores e acabamentos.',
  statement: ["Um só estúdio.", "Da primeira ideia à construção."],
  statementBody: "Reúna o ambiente, os móveis e os detalhes de construção em um projeto. Explore o design, resolva as decisões técnicas e leve informações claras para a oficina.",
  steps: [
    [
      "Projete.",
      "Planeje o ambiente e os móveis em 3D. Experimente layouts e acabamentos e use uma imagem de IA para imaginar seu projeto em um ambiente pronto."
    ],
    [
      "Detalhe.",
      "Ajuste as medidas, os materiais e as ferragens. Revise a construção e o encaixe das peças antes de cortar."
    ],
    [
      "Construa.",
      "Crie desenhos cotados e listas de corte e ferragens. Faça os móveis você mesmo ou entregue um plano claro ao seu marceneiro."
    ],
  ],
  detail: ["OS DETALHES QUE FAZEM FUNCIONAR", "Projetado para seu espaço.", "Preparado para construir."],
  imageAlt: 'Armário de carvalho com prateleiras abertas, cabideiros e gavetas em um ambiente ensolarado',
  imageCaption: 'Um estudo de inspiração. Imagens com IA são ilustrativas; desenhos técnicos descrevem seu projeto.',
  materials: "Adapte o armazenamento à sua rotina com prateleiras, cabideiros, gavetas e portas. Depois ajuste as medidas, os painéis e as ferragens no mesmo estúdio 3D.",
  resourceTitle: "Um plano mais claro. Uma construção melhor.", resourceIntro: "Guias práticos para planejar o ambiente, projetar móveis sob medida e entender os desenhos e as peças da construção. Os guias completos estão em inglês.",
  resourceLink: 'Ler o guia', questions: 'Antes de começar.',
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
  closing: ["Projete. Detalhe.", "Construa."], language: 'Idioma',
  editorLanguage: 'Estúdio em 7 idiomas · unidades flexíveis', skip: 'Ir para o conteúdo', units: 'Unidades',
};

const turkish: MarketingCopy = {
  lang: 'tr', name: 'Türkçe', title: 'FurniDraw — Online 3D Mobilya ve Gardırop Tasarımı',
  description: "Tasarla. Detaylandır. Üret. Odanızı ve mobilyalarınızı tek bir 3D stüdyoda planlayın, ardından FurniDraw ile ölçülü çizimler ve parça listeleri oluşturun.",
  nav: ['Deneyim', 'Detaylar', 'Tasarım notları'], start: 'Stüdyoyu aç', eyebrow: "MOBİLYANIZ. FİKİRDEN ÜRETİME.",
  headline: ["Tasarla.", "Detaylandır.", "Üret."],
  intro: "Alanınıza neyin uyduğunu görün, parçaların nasıl birleşeceğini planlayın ve üretim için net planlar hazırlayın. Hepsi tek bir 3D stüdyoda.",
  explore: 'Kendinize göre tasarlayın', note: 'Tarayıcınızda tasarlayın. Başlamak için hesap gerekmez.',
  study: 'TASARIM ODASI / ÇALIŞMA 001', views: ['Malzeme', 'Çizim'], shapes: ['Gardırop', 'Niş', 'Merdiven altı'], width: 'Genişlik',
  finishes: ['Doğal meşe', 'Füme meşe', 'Tebeşir beyazı'], finish: 'Malzeme çalışması', dimensionCta: 'Bu ölçülerle başlayın',
  illustration: 'Etkileşimli bir görsel çalışma. Ölçüleriniz stüdyoya aktarılır; iç düzeni ve yüzeyleri orada seçersiniz.',
  statement: ["Tek stüdyo.", "İlk fikirden üretime kadar."],
  statementBody: "Odanızı, mobilyalarınızı ve üretim detaylarını tek projede ele alın. Tasarımı keşfedin, teknik kararları netleştirin ve atölyeye anlaşılır bilgiler götürün.",
  steps: [
    [
      "Tasarla.",
      "Odanızı ve mobilyalarınızı 3D olarak planlayın. Yerleşimleri ve yüzeyleri deneyin, ardından bir yapay zekâ görseliyle tasarımınızı bitmiş bir odada hayal edin."
    ],
    [
      "Detaylandır.",
      "Ölçüleri, malzemeleri ve donanımları netleştirin. Kesime başlamadan önce yapıyı ve parçaların nasıl birleştiğini gözden geçirin."
    ],
    [
      "Üret.",
      "Ölçülü çizimler, kesim listeleri ve donanım listeleri oluşturun. Kendiniz üretin veya mobilya ustanıza net bir plan verin."
    ],
  ],
  detail: ["İŞİ TAMAMLAYAN DETAYLAR", "Alanınız için tasarlandı.", "Üretim için detaylandırıldı."],
  imageAlt: 'Güneşli bir odada açık rafları, askılıkları ve çekmeceleri bulunan sıcak meşe gardırop',
  imageCaption: 'Bir iç mekân ilham çalışması. Yapay zekâ görselleri temsilidir; teknik çizimler tasarımınızı anlatır.',
  materials: "Raflar, askılıklar, çekmeceler ve kapaklarla depolamayı ihtiyaçlarınıza uyarlayın. Ardından aynı 3D stüdyoda ölçüleri, panel malzemelerini ve donanımları netleştirin.",
  resourceTitle: "Daha net bir plan. Daha iyi bir üretim.", resourceIntro: "Oda planlama, özel ölçü mobilya tasarımı ve üretim için gerekli çizimler ve parçalar hakkında pratik rehberler. Ayrıntılı rehberler İngilizcedir.",
  resourceLink: 'Rehberi okuyun', questions: 'Başlamadan önce.',
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
  closing: ["Tasarla. Detaylandır.", "Üret."], language: 'Dil',
  editorLanguage: '7 dilde stüdyo · esnek birimler', skip: 'İçeriğe geç', units: 'Birimler',
};

export const languages: readonly MarketingCopy[] = [english, german, french, spanish, polish, portuguese, turkish];
export const homePath = (lang: string) => lang === 'en' ? '/' : `/${lang}/`;
