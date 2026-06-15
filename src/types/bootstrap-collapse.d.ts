declare module 'bootstrap/js/dist/collapse' {
  export default class Collapse {
    constructor(element: HTMLElement, config?: unknown);
    toggle(): void;
    show(): void;
    hide(): void;
    dispose(): void;

    static getInstance(element: HTMLElement): Collapse | null;
    static getOrCreateInstance(
      element: HTMLElement,
      config?: unknown,
    ): Collapse;
  }
}
