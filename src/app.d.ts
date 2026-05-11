declare global {
  namespace App {}

  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
          action?: string;
        }
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

export {};
