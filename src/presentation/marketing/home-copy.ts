import en from './home-locales/en.json';
import de from './home-locales/de.json';
import fr from './home-locales/fr.json';
import es from './home-locales/es.json';
import pl from './home-locales/pl.json';
import pt from './home-locales/pt.json';
import tr from './home-locales/tr.json';

export type HomeCopy = typeof en;
const copies: Record<string, HomeCopy> = { en, de, fr, es, pl, pt, tr };
export const homeCopy = (lang: string): HomeCopy => copies[lang] ?? en;
