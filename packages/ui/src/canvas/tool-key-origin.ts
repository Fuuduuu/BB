export function isToolKeyOrigin(origin: EventTarget | null, hudSelector: string): boolean {
  if (typeof document === 'undefined') return false;
  return (
    origin === document.body ||
    (origin instanceof SVGSVGElement && origin.querySelector('[data-scene]') !== null) ||
    (origin instanceof Element && origin.closest(hudSelector) !== null)
  );
}
