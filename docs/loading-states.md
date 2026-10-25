# Loading states

`src/presentation/components/loading-state.ts` provides the shared loading UI. Include
`loading-state.css` in the component's shadow root. The editor and design library already do this.

For an action or a refresh, keep the existing component mounted:

```ts
const loading = createLoadingState(component);
loading.start();
try {
  await refresh();
} finally {
  loading.stop();
}
```

The light moves across the entire surface; starting twice is safe, and stopping restores the previous
`aria-busy` value. Disable the affected controls while an action is pending, leave cancellation available,
and use a nearby status region for a clear label such as “Opening design…”. Register `loading.stop`
with the owning lifetime. Do not use this on an image or canvas directly: wrap it in a sized surface.

For the first fetch, use `createLoadingPlaceholder(document, label, layout)`. Layouts are `design-list`,
`cards`, `canvas`, and `lines`. Replace the placeholder with content, a confirmed empty result, or an
actionable error. Keep old content during refreshes. Use `bindLoadingImage(image, surface)` for images
whose dimensions are reserved in CSS; it stops the shimmer on load or failure.

Call `await paintLoading(component)` before expensive synchronous work so the pending UI gets painted.
Check whether the view has closed after yielding. Do not add artificial delays or invented percentages.
Reduced motion uses static placeholders, and forced colors preserve their shapes.

Run `npm run check:loading` with Vite running on port 5177. Override `LOADING_TEST_URL` if needed.
The browser check holds requests open to cover the initial fetch, retained refresh, stable image space,
duplicate clicks, failure, retry, empty results, cancellation, reduced motion, and phone/desktop widths.
It also checks the credit balance, retained pack cards, checkout errors, email and code verification,
and the payment confirmation surface using held, mocked requests.
