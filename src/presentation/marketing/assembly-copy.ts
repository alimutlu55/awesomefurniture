/** The assembly controls belong to the public site, including its translated entry pages. */
export interface AssemblyCopy {
  title: string; subtitle: string; slider: string; stages: readonly [string, string, string];
  play: string; pause: string; rotate: string; reset: string; live: string; loading: string; unavailable: string;
}
const en: AssemblyCopy = {
  title: 'A few pieces. Endless possibility.', subtitle: 'Bring your idea together, one panel at a time.',
  slider: 'Furniture assembly', stages: ['The pieces', 'Coming together', 'Made to fit'],
  play: 'Watch it come together', pause: 'Pause assembly', rotate: 'Drag to explore', reset: 'Reset view',
  live: 'LIVE 3D', loading: 'Preparing your material study…',
  unavailable: 'Explore this design in the studio. Live 3D is unavailable in this browser.',
};
const copy: Record<string, AssemblyCopy> = {
  en,
  de: { title: 'Einzelne Teile. Unendliche Möglichkeiten.', subtitle: 'Ihre Idee entsteht, Platte für Platte.',
    slider: 'Möbelmontage', stages: ['Die Teile', 'Im Aufbau', 'Passt genau'], play: 'Aufbau ansehen', pause: 'Aufbau pausieren',
    rotate: 'Ziehen zum Erkunden', reset: 'Ansicht zurücksetzen', live: 'LIVE 3D', loading: 'Materialstudie wird vorbereitet…',
    unavailable: 'Entdecken Sie den Entwurf im Studio. Live-3D ist in diesem Browser nicht verfügbar.' },
  fr: { title: 'Quelques pièces. Des possibilités infinies.', subtitle: 'Votre idée prend forme, panneau après panneau.',
    slider: 'Assemblage du meuble', stages: ['Les pièces', 'En assemblage', 'Sur mesure'], play: 'Voir l’assemblage', pause: 'Mettre en pause',
    rotate: 'Glissez pour explorer', reset: 'Réinitialiser la vue', live: '3D EN DIRECT', loading: 'Préparation des matériaux…',
    unavailable: 'Découvrez ce modèle dans le studio. La 3D est indisponible dans ce navigateur.' },
  es: { title: 'Pocas piezas. Infinitas posibilidades.', subtitle: 'Tu idea toma forma, panel a panel.',
    slider: 'Montaje del mueble', stages: ['Las piezas', 'Tomando forma', 'A tu medida'], play: 'Ver el montaje', pause: 'Pausar montaje',
    rotate: 'Arrastra para explorar', reset: 'Restablecer vista', live: '3D EN VIVO', loading: 'Preparando los materiales…',
    unavailable: 'Explora este diseño en el estudio. El 3D no está disponible en este navegador.' },
  pl: { title: 'Kilka elementów. Nieskończone możliwości.', subtitle: 'Twój pomysł nabiera kształtu, płyta po płycie.',
    slider: 'Montaż mebla', stages: ['Elementy', 'Powstaje mebel', 'Na wymiar'], play: 'Zobacz montaż', pause: 'Wstrzymaj montaż',
    rotate: 'Przeciągnij, aby obrócić', reset: 'Przywróć widok', live: '3D NA ŻYWO', loading: 'Przygotowywanie materiałów…',
    unavailable: 'Odkryj ten projekt w studiu. Widok 3D jest niedostępny w tej przeglądarce.' },
  pt: { title: 'Poucas peças. Infinitas possibilidades.', subtitle: 'Sua ideia ganha forma, painel por painel.',
    slider: 'Montagem do móvel', stages: ['As peças', 'Ganhando forma', 'Sob medida'], play: 'Ver a montagem', pause: 'Pausar montagem',
    rotate: 'Arraste para explorar', reset: 'Redefinir vista', live: '3D AO VIVO', loading: 'Preparando os materiais…',
    unavailable: 'Explore este projeto no estúdio. O 3D não está disponível neste navegador.' },
  tr: { title: 'Birkaç parça. Sonsuz olasılık.', subtitle: 'Fikriniz her panelle biraz daha şekillensin.',
    slider: 'Mobilya montajı', stages: ['Parçalar', 'Bir araya geliyor', 'Tam size göre'], play: 'Birleşmesini izleyin', pause: 'Montajı duraklat',
    rotate: 'Keşfetmek için sürükleyin', reset: 'Görünümü sıfırla', live: 'CANLI 3D', loading: 'Malzemeler hazırlanıyor…',
    unavailable: 'Bu tasarımı stüdyoda keşfedin. Bu tarayıcıda canlı 3D kullanılamıyor.' },
};
export const assemblyCopy = (lang: string): AssemblyCopy => copy[lang] ?? en;
