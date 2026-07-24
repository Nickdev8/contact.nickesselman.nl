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
          appearance?: "always" | "execute" | "interaction-only";
          action?: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: (errorCode: string) => boolean | void;
        }
      ) => string;
      remove?: (widgetId: string) => void;
      reset?: (widgetId: string) => void;
    };
  }
}

export {};
