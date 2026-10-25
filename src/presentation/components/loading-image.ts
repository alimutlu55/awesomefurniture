import { createLoadingState } from './loading-state';

/** Reserve image space in CSS and keep its surface shimmering until the image can be displayed. */
export function bindLoadingImage(image: HTMLImageElement, surface: HTMLElement) {
  const loading = createLoadingState(surface);
  const finish = () => {
    image.hidden = !image.naturalWidth;
    loading.stop();
    image.removeEventListener('load', finish); image.removeEventListener('error', finish);
  };
  if (image.complete && image.currentSrc) finish();
  else {
    loading.start();
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
  }
  return finish;
}
