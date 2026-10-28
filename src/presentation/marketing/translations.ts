import { english, type MarketingCopy } from './copy';

const german: MarketingCopy = {
  lang: 'de', name: 'Deutsch', title: 'FurniDraw — Möbel online planen: Schränke & Küchen',
  description: 'Planen Sie Einbauschränke und Küchenschränke in 3D. Entdecken Sie Materialien, KI-Visualisierungen und bemaßte technische Zeichnungen mit FurniDraw.',
  nav: ['Das Erlebnis', 'Die Details', 'Planungswissen'], start: 'Studio öffnen', eyebrow: 'MÖBELPLANUNG MIT GEFÜHL.',
  headline: ['Eine Idee. Passt genau.', 'Von Ihnen gestaltet.'],
  intro: 'Die schwierige Ecke. Der Raum in Ihrer Vorstellung. Machen Sie daraus Möbel, die dazugehören. Bis ins letzte Detail.',
  explore: 'Selbst gestalten', note: 'Direkt im Browser. Zum Start ist kein Konto nötig.',
  study: 'DER PLANUNGSRAUM / STUDIE 001', views: ['Material', 'Zeichnung'], shapes: ['Schrank', 'Nische', 'Unter der Treppe'], width: 'Breite',
  finishes: ['Eiche natur', 'Räuchereiche', 'Kreideweiß'], finish: 'Materialstudie', dimensionCta: 'Mit diesen Maßen beginnen',
  illustration: 'Eine interaktive Illustration. Die Maße werden ins Studio übernommen; Innenaufteilung und Oberflächen wählen Sie dort.',
  statement: ['Gute Möbel beginnen', 'mit einem guten Gedanken.'],
  statementBody: 'Ein Platz für Ihre Dinge. Eine Form, die zum Raum passt. Und ein verständlicher Plan für die Menschen, die Ihre Möbel bauen.',
  steps: [
    ['Die passende Form.', 'Beginnen Sie mit Ihrem Raum. Planen Sie einen Einbauschrank für eine Nische, eine Dachschräge oder unter einer Treppe.'],
    ['Das richtige Gefühl.', 'Entdecken Sie Materialien in 3D. Mit einem KI-Bild können Sie sich Ihren Entwurf später in einem fertigen Raum vorstellen.'],
    ['Ein konkreter Plan.', 'Entwickeln Sie aus Ihrer Idee bemaßte Zeichnungen, Ansichten, Teile- und Beschlaglisten für das Gespräch mit Ihrer Tischlerei.'],
  ],
  detail: ['RAUM FÜR DETAILS', 'Außen schön.', 'Innen durchdacht.'],
  imageAlt: 'Einbauschrank aus warmer Eiche mit offenen Regalen, Kleiderstangen und Schubladen in einem sonnigen Raum',
  imageCaption: 'Eine Wohninspiration. KI-Bilder dienen der Veranschaulichung; technische Zeichnungen beschreiben Ihren Entwurf.',
  materials: 'Beginnen Sie mit Ihrem Alltag. Verfeinern Sie Regale, Stangen, Schubladen und Türen. Planen Sie Schränke und Küchenmodule in Ihrem eigenen Tempo.',
  resourceTitle: 'Ein wenig Wissen. Ein besserer Anfang.', resourceIntro: 'Praktische Hinweise zu Einbaumöbeln, Stauraum und technischen Zeichnungen. Die ausführlichen Anleitungen sind auf Englisch.',
  resourceLink: 'Anleitung lesen', questions: 'Bevor Sie beginnen.',
  faqs: [
    ['Was kann ich mit FurniDraw planen?', "Einbauschränke, geformten Stauraum und modulare Küchenschränke. Das Studio bietet Räume, Materialien, Innenausstattung "
      + "und technische Zeichnungen. Die automatischen Beispiele erstellen Kleiderschränke."],
    ['Brauche ich ein Konto oder eine Installation?', 'Sie können in einem modernen Browser ohne Konto und ohne Installation beginnen. Lokale Entwürfe bleiben im Browser; Konto- und Cloudfunktionen finden Sie im Studio.'],
    ['Kann ich FurniDraw kostenlos ausprobieren?', 'Sie können ohne Credits mit der Planung beginnen. KI-Bilder und technische Zeichnungen nutzen das Creditsystem im Studio. Dort finden Sie die aktuellen Freikontingente und Preise.'],
    ['Kann ich die Möbel nach den Zeichnungen bauen?', "Besprechen Sie die bemaßten Zeichnungen mit Ihrer Tischlerei. Prüfen Sie Raummaße, Materialien, Freiräume und Beschläge "
      + "vor der Fertigung. Zuschnittlisten zeigen Fertigmaße; Bohrpläne sind nicht enthalten."],
    ['Kann ich FurniDraw in meinem Land nutzen?', "FurniDraw funktioniert im Browser. Die Einführung gibt es in mehreren Sprachen. Diese Vorschau bietet Zentimeter und "
      + "Zoll; das vollständige Studio verwendet derzeit Englisch und Zentimeter."],
  ],
  closing: ['Ihr Raum. Ihre Ideen.', 'Geben wir ihnen einen Platz.'], language: 'Sprache',
  editorLanguage: 'Studio auf Englisch · Maße in cm', skip: 'Zum Inhalt springen', units: 'Einheiten',
};

const french: MarketingCopy = {
  lang: 'fr', name: 'Français', title: 'FurniDraw — Concevez vos meubles et placards en ligne',
  description: 'Concevez des placards sur mesure et des meubles de cuisine en 3D. Explorez les matières, les visualisations IA et les plans cotés avec FurniDraw.',
  nav: ['L’expérience', 'Les détails', 'Carnet de conception'], start: 'Ouvrir le studio', eyebrow: 'LE MEUBLE, PENSÉ AVEC SOIN.',
  headline: ['Une idée. La juste place.', 'Votre création.'],
  intro: 'Ce recoin difficile. Cette pièce que vous imaginez. Faites-en un meuble qui trouve naturellement sa place, jusque dans les moindres détails.',
  explore: 'À vous de créer', note: 'Dans votre navigateur. Aucun compte requis pour commencer.',
  study: 'L’ATELIER / ÉTUDE 001', views: ['Matière', 'Dessin'], shapes: ['Placard', 'Alcôve', 'Sous l’escalier'], width: 'Largeur',
  finishes: ['Chêne naturel', 'Chêne fumé', 'Blanc craie'], finish: 'Étude de matière', dimensionCta: 'Commencer avec ces dimensions',
  illustration: 'Une illustration interactive. Vos dimensions passent dans le studio ; choisissez ensuite les aménagements et les finitions.',
  statement: ['Un beau meuble commence', 'par une intention.'],
  statementBody: 'Une place pour vos affaires. Une forme qui épouse votre pièce. Et un plan clair pour la personne qui le fabriquera.',
  steps: [
    ['Trouver la juste forme.', 'Partez de votre pièce. Dessinez un placard pour une niche, un plafond incliné ou l’espace sous votre escalier.'],
    ['Ressentir la matière.', 'Explorez les matières en 3D. Créez ensuite une image IA pour imaginer votre projet dans une pièce aménagée.'],
    ['Donner corps à l’idée.', 'Obtenez des plans cotés, des élévations et des listes de pièces et de quincaillerie pour échanger avec votre artisan.'],
  ],
  detail: ['LA PLACE DU DÉTAIL', 'Beau à l’extérieur.', 'Réfléchi à l’intérieur.'],
  imageAlt: 'Placard en chêne avec étagères ouvertes, penderies et tiroirs dans une pièce ensoleillée',
  imageCaption: 'Une inspiration d’intérieur. Les images IA illustrent une ambiance ; les plans techniques décrivent votre projet.',
  materials: 'Commencez par votre quotidien. Ajustez les étagères, tringles, tiroirs et portes. Concevez un placard ou un meuble de cuisine à votre rythme.',
  resourceTitle: 'Un peu de savoir-faire. Un meilleur départ.', resourceIntro: 'Des conseils pratiques sur les meubles sur mesure, le rangement et les plans. Les guides détaillés sont en anglais.',
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
      + "et pouces ; le studio complet utilise actuellement l’anglais et les centimètres."],
  ],
  closing: ['Votre espace. Vos idées.', 'Faisons-leur une place.'], language: 'Langue',
  editorLanguage: 'Studio en anglais · dimensions en cm', skip: 'Aller au contenu', units: 'Unités',
};

const spanish: MarketingCopy = {
  lang: 'es', name: 'Español', title: 'FurniDraw — Diseña muebles y armarios online en 3D',
  description: 'Diseña armarios a medida y muebles de cocina en 3D. Explora materiales, visualizaciones con IA y planos acotados con FurniDraw.',
  nav: ['La experiencia', 'Los detalles', 'Cuaderno de diseño'], start: 'Abrir el estudio', eyebrow: 'MUEBLES DISEÑADOS CON CUIDADO.',
  headline: ['Una idea. El encaje perfecto.', 'Algo hecho por ti.'],
  intro: 'Ese rincón difícil. Esa habitación que imaginas. Conviértelos en muebles que encuentran su lugar, hasta el último detalle.',
  explore: 'Hazlo tuyo', note: 'En tu navegador. Sin cuenta para empezar.',
  study: 'EL ESTUDIO / PROYECTO 001', views: ['Material', 'Plano'], shapes: ['Armario', 'Hueco', 'Bajo la escalera'], width: 'Ancho',
  finishes: ['Roble natural', 'Roble ahumado', 'Blanco tiza'], finish: 'Estudio de materiales', dimensionCta: 'Empezar con estas medidas',
  illustration: 'Una ilustración interactiva. Las medidas pasan al estudio; allí eliges los interiores y los acabados.',
  statement: ['Un buen mueble empieza', 'con una buena idea.'],
  statementBody: 'Un lugar para tus cosas. Una forma que se adapta a tu espacio. Y un plan claro para quien lo fabricará.',
  steps: [
    ['Encuentra el encaje.', 'Empieza por tu habitación. Diseña un armario para un hueco, un techo inclinado o el espacio bajo la escalera.'],
    ['Siente el material.', 'Explora materiales en 3D. Después crea una imagen con IA para imaginar tu diseño en una habitación terminada.'],
    ['Hazlo tangible.', 'Convierte la idea en planos acotados, alzados y listas de piezas y herrajes para hablar con tu carpintero.'],
  ],
  detail: ['ESPACIO PARA LOS DETALLES', 'Bello por fuera.', 'Bien pensado por dentro.'],
  imageAlt: 'Armario de roble cálido con estantes abiertos, barras y cajones en una habitación luminosa',
  imageCaption: 'Un estudio de inspiración. Las imágenes con IA son ilustrativas; los planos técnicos describen tu diseño.',
  materials: 'Empieza por tu forma de vivir. Ajusta estantes, barras, cajones y puertas. Diseña armarios y muebles de cocina a tu ritmo.',
  resourceTitle: 'Un poco de conocimiento. Un mejor comienzo.', resourceIntro: 'Consejos sobre muebles a medida, almacenamiento y planos. Las guías completas están en inglés.',
  resourceLink: 'Leer la guía', questions: 'Antes de empezar.',
  faqs: [
    ['¿Qué puedo diseñar con FurniDraw?', "Armarios a medida, almacenamiento con formas adaptadas y muebles de cocina modulares. El estudio incluye habitaciones, "
      + "materiales, interiores y planos técnicos. Los ejemplos automáticos crean armarios."],
    ['¿Necesito una cuenta o instalar algo?', 'Puedes empezar en un navegador moderno sin cuenta ni instalación. Los borradores se guardan en tu navegador; las funciones de cuenta y nube están en el estudio.'],
    ['¿Puedo probar FurniDraw gratis?', 'Puedes empezar a diseñar sin comprar créditos. Las imágenes con IA y los planos usan el sistema de créditos del estudio. Consulta allí los precios y los usos gratuitos actuales.'],
    ['¿Puedo fabricar los muebles con los planos?', "Revisa los planos acotados con un carpintero. Confirma medidas, materiales, holguras y herrajes antes de fabricar. Las "
      + "listas de corte muestran medidas finales; no incluyen planos de taladrado."],
    ['¿Puedo usar FurniDraw en mi país?', 'FurniDraw funciona en el navegador. Esta presentación está en varios idiomas. La vista previa ofrece centímetros y pulgadas; el estudio completo utiliza actualmente inglés y centímetros.'],
  ],
  closing: ['Tu espacio. Tus ideas.', 'Hagámosles sitio.'], language: 'Idioma',
  editorLanguage: 'Estudio en inglés · medidas en cm', skip: 'Ir al contenido', units: 'Unidades',
};

const polish: MarketingCopy = {
  lang: 'pl', name: 'Polski', title: 'FurniDraw — Projektowanie mebli i szaf online w 3D',
  description: 'Projektuj szafy na wymiar i szafki kuchenne w 3D. Odkrywaj materiały, wizualizacje AI i zwymiarowane rysunki techniczne z FurniDraw.',
  nav: ['Jak to działa', 'Detale', 'Poradnik'], start: 'Otwórz studio', eyebrow: 'MEBLE PRZEMYŚLANE OD POCZĄTKU.',
  headline: ['Pomysł. Idealne dopasowanie.', 'Coś Twojego.'],
  intro: 'Ten trudny narożnik. Pokój, który sobie wyobrażasz. Zamień je w meble, które pasują do Twojego życia. Do ostatniego milimetra.',
  explore: 'Zaprojektuj po swojemu', note: 'W przeglądarce. Na początek nie potrzebujesz konta.',
  study: 'PRZYMIERZALNIA / STUDIUM 001', views: ['Materiał', 'Rysunek'], shapes: ['Szafa', 'Wnęka', 'Pod schodami'], width: 'Szerokość',
  finishes: ['Dąb naturalny', 'Dąb wędzony', 'Kredowa biel'], finish: 'Studium materiału', dimensionCta: 'Zacznij od tych wymiarów',
  illustration: 'Interaktywna ilustracja. Wymiary przeniosą się do studia; tam dobierzesz wyposażenie i wykończenia.',
  statement: ['Dobre meble zaczynają się', 'od odrobiny namysłu.'],
  statementBody: 'Miejsce na Twoje rzeczy. Kształt dopasowany do pokoju. I czytelny plan dla osoby, która wykona mebel.',
  steps: [
    ['Znajdź dopasowanie.', 'Zacznij od pomieszczenia. Zaprojektuj szafę do wnęki, pod skosem lub pod schodami.'],
    ['Poczuj materiał.', 'Odkrywaj materiały w 3D. Następnie stwórz obraz AI, aby wyobrazić sobie projekt w gotowym wnętrzu.'],
    ['Nadaj pomysłowi formę.', 'Przejdź do rysunków z wymiarami, widoków oraz list elementów i okuć, które ułatwią rozmowę ze stolarzem.'],
  ],
  detail: ['MIEJSCE NA DETALE', 'Piękne z zewnątrz.', 'Przemyślane od środka.'],
  imageAlt: 'Szafa z ciepłego dębu z otwartymi półkami, drążkami i szufladami w słonecznym wnętrzu',
  imageCaption: 'Inspiracja wnętrzarska. Obrazy AI mają charakter poglądowy; rysunki techniczne opisują Twój projekt.',
  materials: 'Zacznij od codzienności. Dopracuj półki, drążki, szuflady i drzwi. Projektuj szafy i szafki kuchenne we własnym tempie.',
  resourceTitle: 'Trochę wiedzy. Lepszy początek.', resourceIntro: 'Praktyczne wskazówki o meblach na wymiar, przechowywaniu i rysunkach. Pełne poradniki są w języku angielskim.',
  resourceLink: 'Przeczytaj poradnik', questions: 'Zanim zaczniesz.',
  faqs: [
    ['Co mogę zaprojektować w FurniDraw?', "Szafy na wymiar, zabudowy o niestandardowym kształcie i modułowe szafki kuchenne. Studio zawiera pomieszczenia, "
      + "materiały, wyposażenie i rysunki techniczne. Automatyczne przykłady tworzą szafy."],
    ['Czy potrzebuję konta lub instalacji?', 'Możesz zacząć w nowoczesnej przeglądarce bez konta i instalowania programu. Szkice pozostają w przeglądarce; funkcje konta i chmury znajdziesz w studiu.'],
    ['Czy mogę wypróbować FurniDraw bezpłatnie?', 'Możesz zacząć projektować bez kupowania kredytów. Obrazy AI i rysunki korzystają z systemu kredytów w studiu. Tam sprawdzisz aktualne ceny i bezpłatne użycia.'],
    ['Czy mogę wykonać mebel na podstawie rysunków?', 'Omów zwymiarowane rysunki ze stolarzem. Przed wykonaniem sprawdź pomiary, materiały, luzy i okucia. Listy cięcia podają wymiary gotowe; nie zawierają planów wierceń.'],
    ['Czy mogę korzystać z FurniDraw w moim kraju?', 'FurniDraw działa w przeglądarce. Wprowadzenie jest dostępne w kilku językach. Podgląd obsługuje centymetry i cale; pełne studio używa obecnie języka angielskiego i centymetrów.'],
  ],
  closing: ['Twoja przestrzeń. Twoje pomysły.', 'Zróbmy dla nich miejsce.'], language: 'Język',
  editorLanguage: 'Studio po angielsku · wymiary w cm', skip: 'Przejdź do treści', units: 'Jednostki',
};

const portuguese: MarketingCopy = {
  lang: 'pt', name: 'Português', title: 'FurniDraw — Projete móveis e armários online em 3D',
  description: 'Crie armários sob medida e móveis de cozinha em 3D. Explore materiais, visualizações com IA e desenhos técnicos cotados com FurniDraw.',
  nav: ['A experiência', 'Os detalhes', 'Caderno de projeto'], start: 'Abrir o estúdio', eyebrow: 'MÓVEIS PENSADOS COM CUIDADO.',
  headline: ['Uma ideia. O encaixe ideal.', 'Algo criado por você.'],
  intro: 'Aquele canto difícil. O ambiente que você imagina. Transforme tudo em móveis que encontram seu lugar, até o último detalhe.',
  explore: 'Crie do seu jeito', note: 'No navegador. Sem conta para começar.',
  study: 'O ESTÚDIO / ESTUDO 001', views: ['Material', 'Desenho'], shapes: ['Armário', 'Nicho', 'Sob a escada'], width: 'Largura',
  finishes: ['Carvalho natural', 'Carvalho fumado', 'Branco giz'], finish: 'Estudo de materiais', dimensionCta: 'Começar com estas medidas',
  illustration: 'Uma ilustração interativa. As medidas passam para o estúdio; lá você escolhe os interiores e acabamentos.',
  statement: ['Um bom móvel começa', 'com uma boa ideia.'],
  statementBody: 'Um lugar para suas coisas. Uma forma que acompanha o ambiente. E um plano claro para quem vai fabricar.',
  steps: [
    ['Encontre o encaixe.', 'Comece pelo ambiente. Projete um armário para um nicho, um teto inclinado ou o espaço sob a escada.'],
    ['Sinta o material.', 'Explore materiais em 3D. Depois crie uma imagem com IA para imaginar o projeto em um ambiente pronto.'],
    ['Torne a ideia concreta.', 'Obtenha desenhos cotados, elevações e listas de peças e ferragens para conversar com seu marceneiro.'],
  ],
  detail: ['ESPAÇO PARA OS DETALHES', 'Bonito por fora.', 'Bem pensado por dentro.'],
  imageAlt: 'Armário de carvalho com prateleiras abertas, cabideiros e gavetas em um ambiente ensolarado',
  imageCaption: 'Um estudo de inspiração. Imagens com IA são ilustrativas; desenhos técnicos descrevem seu projeto.',
  materials: 'Comece pelo seu dia a dia. Ajuste prateleiras, cabideiros, gavetas e portas. Projete armários e móveis de cozinha no seu ritmo.',
  resourceTitle: 'Um pouco de conhecimento. Um começo melhor.', resourceIntro: 'Notas práticas sobre móveis sob medida, organização e desenhos. Os guias completos estão em inglês.',
  resourceLink: 'Ler o guia', questions: 'Antes de começar.',
  faqs: [
    ['O que posso projetar com FurniDraw?', "Armários sob medida, armazenamento com formas adaptadas e móveis de cozinha modulares. O estúdio inclui ambientes, "
      + "materiais, interiores e desenhos técnicos. Os exemplos automáticos criam armários."],
    ['Preciso de conta ou instalação?', 'Você pode começar em um navegador moderno sem conta nem instalação. Os rascunhos ficam no navegador; os recursos de conta e nuvem estão no estúdio.'],
    ['Posso experimentar gratuitamente?', "Você pode começar a projetar sem comprar créditos. Imagens com IA e desenhos usam o sistema de créditos do estúdio. "
      + "Consulte os preços e os usos gratuitos atuais antes de usar um recurso pago."],
    ['Posso fabricar os móveis com os desenhos?', "Revise os desenhos cotados com um marceneiro. Confirme medidas, materiais, folgas e ferragens antes de fabricar. As "
      + "listas de corte indicam medidas finais; não incluem planos de furação."],
    ['Posso usar FurniDraw no meu país?', 'FurniDraw funciona no navegador. Esta apresentação está disponível em vários idiomas. A prévia oferece centímetros e polegadas; o estúdio completo usa atualmente inglês e centímetros.'],
  ],
  closing: ['Seu espaço. Suas ideias.', 'Vamos abrir espaço para elas.'], language: 'Idioma',
  editorLanguage: 'Estúdio em inglês · medidas em cm', skip: 'Ir para o conteúdo', units: 'Unidades',
};

const turkish: MarketingCopy = {
  lang: 'tr', name: 'Türkçe', title: 'FurniDraw — Online 3D Mobilya ve Gardırop Tasarımı',
  description: 'Özel ölçü gardıropları ve mutfak dolaplarını 3D tasarlayın. FurniDraw ile malzemeleri, yapay zekâ görsellerini ve ölçülü teknik çizimleri keşfedin.',
  nav: ['Deneyim', 'Detaylar', 'Tasarım notları'], start: 'Stüdyoyu aç', eyebrow: 'ÖZENLE DÜŞÜNÜLMÜŞ MOBİLYALAR.',
  headline: ['Bir fikir. Kusursuz uyum.', 'Sizin tasarımınız.'],
  intro: 'O zor köşe. Hayalinizdeki oda. Onları, son milimetresine kadar hayatınıza uyan mobilyalara dönüştürün.',
  explore: 'Kendinize göre tasarlayın', note: 'Tarayıcınızda tasarlayın. Başlamak için hesap gerekmez.',
  study: 'TASARIM ODASI / ÇALIŞMA 001', views: ['Malzeme', 'Çizim'], shapes: ['Gardırop', 'Niş', 'Merdiven altı'], width: 'Genişlik',
  finishes: ['Doğal meşe', 'Füme meşe', 'Tebeşir beyazı'], finish: 'Malzeme çalışması', dimensionCta: 'Bu ölçülerle başlayın',
  illustration: 'Etkileşimli bir görsel çalışma. Ölçüleriniz stüdyoya aktarılır; iç düzeni ve yüzeyleri orada seçersiniz.',
  statement: ['İyi mobilyalar', 'biraz düşünceyle başlar.'],
  statementBody: 'Eşyalarınıza bir yer. Odanıza uyan bir biçim. Ve mobilyayı üretecek kişi için açık bir plan.',
  steps: [
    ['Doğru biçimi bulun.', 'Odanızdan başlayın. Bir nişe, eğimli tavana veya merdiven altına uygun gardırop tasarlayın.'],
    ['Malzemeyi hissedin.', 'Malzemeleri 3D keşfedin. Ardından tasarımınızı tamamlanmış bir odada hayal etmek için yapay zekâ görseli oluşturun.'],
    ['Fikri somutlaştırın.', 'Ölçülü çizimler, görünüşler, parça ve donanım listeleriyle marangozunuzla konuşmaya hazırlanın.'],
  ],
  detail: ['DETAYLARA YER AÇIN', 'Dışı güzel.', 'İçi düşünülmüş.'],
  imageAlt: 'Güneşli bir odada açık rafları, askılıkları ve çekmeceleri bulunan sıcak meşe gardırop',
  imageCaption: 'Bir iç mekân ilham çalışması. Yapay zekâ görselleri temsilidir; teknik çizimler tasarımınızı anlatır.',
  materials: 'Günlük yaşamınızdan başlayın. Rafları, askıları, çekmeceleri ve kapakları düzenleyin. Gardırop ve mutfak dolaplarını kendi hızınızda tasarlayın.',
  resourceTitle: 'Biraz bilgi. Daha iyi bir başlangıç.', resourceIntro: 'Özel ölçü mobilya, depolama ve çizimler hakkında pratik notlar. Ayrıntılı rehberler İngilizcedir.',
  resourceLink: 'Rehberi okuyun', questions: 'Başlamadan önce.',
  faqs: [
    ['FurniDraw ile neler tasarlayabilirim?', "Özel ölçü gardıroplar, farklı biçimlerde depolama alanları ve modüler mutfak dolapları. Stüdyoda odalar, malzemeler, iç "
      + "donanımlar ve teknik çizimler bulunur. Otomatik örnekler gardırop oluşturur."],
    ['Hesap veya kurulum gerekli mi?', 'Modern bir tarayıcıda hesap açmadan ve program kurmadan başlayabilirsiniz. Taslaklar tarayıcınızda saklanır; hesap ve bulut özellikleri stüdyodadır.'],
    ['FurniDraw ücretsiz denenebilir mi?', "Kredi satın almadan tasarlamaya başlayabilirsiniz. Yapay zekâ görselleri ve teknik çizimler stüdyodaki kredi sistemini "
      + "kullanır. Güncel fiyatları ve ücretsiz kullanımları orada kontrol edin."],
    ['Çizimlerle mobilya üretebilir miyim?', "Ölçülü çizimleri marangozunuzla inceleyin. Üretimden önce yerinde ölçüleri, malzemeleri, boşlukları ve donanımları "
      + "doğrulayın. Kesim listeleri bitmiş ölçüleri verir; delik planları dahil değildir."],
    ['FurniDraw ülkemde kullanılabilir mi?', 'FurniDraw tarayıcıda çalışır. Bu tanıtım birkaç dilde sunulur. Önizlemede santimetre veya inç seçebilirsiniz; tam stüdyo şu anda İngilizce ve santimetre kullanır.'],
  ],
  closing: ['Sizin alanınız. Sizin fikirleriniz.', 'Onlara yer açalım.'], language: 'Dil',
  editorLanguage: 'Stüdyo İngilizce · ölçüler cm', skip: 'İçeriğe geç', units: 'Birimler',
};

export const languages: readonly MarketingCopy[] = [english, german, french, spanish, polish, portuguese, turkish];
export const homePath = (lang: string) => lang === 'en' ? '/' : `/${lang}/`;
