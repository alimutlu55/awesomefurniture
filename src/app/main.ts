import { designLink } from './design-link';

(window as unknown as { __furniShareLink?: typeof designLink }).__furniShareLink = designLink;

import '../presentation/marketing/marketing';
