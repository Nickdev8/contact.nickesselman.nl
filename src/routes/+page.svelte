<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { goto } from "$app/navigation";
  import { enhance } from "$app/forms";
  import { page } from "$app/stores";
  import {
    buildPresetMessage,
    FIELD_LIMITS,
    normalizeSource,
    sourceLabel
  } from "$lib/contactContext";

  type FormResult = {
    success?: boolean;
    message?: string;
    error?: string;
  };

  export let data: { turnstileSiteKey: string; cspNonce: string };
  export let form: FormResult | null | undefined;

  const title = "Contact Nick Esselman | Projects, Questions & Support";
  const description =
    "Contact Nick Esselman about a website project, technical question, or bug report. Choose how you want a reply or email Nick directly.";
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ContactPage",
        "@id": "https://contact.nickesselman.nl/#contact-page",
        url: "https://contact.nickesselman.nl/",
        name: title,
        description,
        inLanguage: "en",
        mainEntity: { "@id": "https://nickesselman.nl/#person" },
        isPartOf: { "@id": "https://contact.nickesselman.nl/#website" }
      },
      {
        "@type": "Person",
        "@id": "https://nickesselman.nl/#person",
        name: "Nick Esselman",
        url: "https://nickesselman.nl/",
        sameAs: [
          "https://github.com/nickdev8/",
          "https://www.linkedin.com/in/nick-esselman/",
          "https://www.instagram.com/nick.esselman/"
        ]
      },
      {
        "@type": "WebSite",
        "@id": "https://contact.nickesselman.nl/#website",
        url: "https://contact.nickesselman.nl/",
        name: "Contact Nick Esselman",
        alternateName: "contact.nickesselman.nl",
        publisher: { "@id": "https://nickesselman.nl/#person" }
      }
    ]
  }).replace(/</g, "\\u003c");

  let clientResult: FormResult | null = null;
  let formResult: FormResult = {};
  let isSubmitting = false;
  let name = "";
  let email = "";
  let message = "";
  let contactMethod = "";
  let contactDetail = "";
  let source: "portfolio" | "blog" | null = null;
  let presetMessage = "";
  let turnstileContainer: HTMLDivElement | null = null;
  let turnstileWidgetId: string | undefined;
  let turnstileVerified = false;
  let turnstileHasError = false;
  let turnstileRenderTimer: number | undefined;
  let turnstileResetTimer: number | undefined;
  let componentMounted = false;
  $: isDutch = $page.url.pathname === "/nl" || $page.url.pathname.startsWith("/nl/");
  $: englishPath = isDutch ? $page.url.pathname.replace(/^\/nl(?=\/|$)/, "") || "/" : $page.url.pathname;
  $: dutchPath = isDutch ? $page.url.pathname : `/nl${$page.url.pathname === "/" ? "/" : $page.url.pathname}`;
  $: canonicalPath = isDutch ? "https://contact.nickesselman.nl/nl/" : "https://contact.nickesselman.nl/";

  const turnstileSiteKey = data.turnstileSiteKey;

  $: formResult = clientResult ?? form ?? {};
  $: source = normalizeSource($page.url.searchParams.get("from"));
  $: presetMessage = buildPresetMessage($page.url.searchParams);
  $: if (presetMessage) message = presetMessage;

  const removeTurnstile = () => {
    if (turnstileRenderTimer) window.clearTimeout(turnstileRenderTimer);
    if (turnstileResetTimer) window.clearTimeout(turnstileResetTimer);
    turnstileRenderTimer = undefined;
    turnstileResetTimer = undefined;

    if (turnstileWidgetId && window.turnstile?.remove) {
      window.turnstile.remove(turnstileWidgetId);
    }

    turnstileWidgetId = undefined;
    turnstileVerified = false;
    turnstileHasError = false;
  };

  const renderTurnstile = () => {
    if (!componentMounted || !turnstileSiteKey || !turnstileContainer || turnstileWidgetId) return;

    const turnstile = window.turnstile;
    if (!turnstile?.render) {
      turnstileRenderTimer = window.setTimeout(renderTurnstile, 120);
      return;
    }

    turnstileWidgetId = turnstile.render(turnstileContainer, {
      sitekey: turnstileSiteKey,
      theme: "light",
      size: "flexible",
      appearance: "always",
      action: "contact",
      callback: () => {
        turnstileVerified = true;
        turnstileHasError = false;
      },
      "expired-callback": () => {
        turnstileVerified = false;
        turnstileResetTimer = window.setTimeout(resetTurnstile, 0);
      },
      "error-callback": () => {
        turnstileVerified = false;
        turnstileHasError = true;
        turnstileResetTimer = window.setTimeout(resetTurnstile, 1200);
        return true;
      }
    });
  };

  const resetTurnstile = () => {
    turnstileVerified = false;
    turnstileHasError = false;

    if (turnstileWidgetId && window.turnstile?.reset) {
      window.turnstile.reset(turnstileWidgetId);
    } else {
      turnstileWidgetId = undefined;
      renderTurnstile();
    }
  };

  const resetFormView = async () => {
    clientResult = null;
    name = "";
    email = "";
    message = presetMessage;
    contactMethod = "";
    contactDetail = "";
    await tick();
    renderTurnstile();
  };

  const handleEnhance: SubmitFunction = () => {
    isSubmitting = true;

    return async ({ result }) => {
      try {
        if (result.type === "redirect") {
          await goto(result.location);
          return;
        }

        if (result.type === "error") {
          clientResult = {
            error:
              result.status === 413
                ? "The message was larger than the server accepts."
                : result.error?.message || "Failed to send message. Please try again."
          };
          await tick();
          resetTurnstile();
          return;
        }

        if (result.type === "success" || result.type === "failure") {
          const nextResult = result.data as FormResult;
          if (nextResult.success) removeTurnstile();
          clientResult = nextResult;

          if (!nextResult.success) {
            await tick();
            resetTurnstile();
          }
        }
      } finally {
        isSubmitting = false;
      }
    };
  };

  onMount(() => {
    if (!turnstileSiteKey) return;
    componentMounted = true;
    renderTurnstile();

    return () => {
      removeTurnstile();
      componentMounted = false;
    };
  });
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large" />
  <link rel="canonical" href={canonicalPath} />
  <link rel="alternate" hreflang="en" href="https://contact.nickesselman.nl/" />
  <link rel="alternate" hreflang="nl" href="https://contact.nickesselman.nl/nl/" />
  <link rel="alternate" hreflang="x-default" href="https://contact.nickesselman.nl/" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/favicon-96.png" type="image/png" sizes="96x96" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
  <meta property="og:site_name" content="Contact Nick Esselman" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://contact.nickesselman.nl/" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  {@html `<script nonce="${data.cspNonce}" type="application/ld+json">${structuredData}</script>`}
  {#if turnstileSiteKey}
    <script
      src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      async
      defer
    ></script>
  {/if}
</svelte:head>

<div class="site">
  <header class="site-header">
    <a class="wordmark" href="https://nickesselman.nl/">Nick Esselman</a>
    <div class="header-actions">
      <a class="header-email" href="mailto:info@nickesselman.nl">info@nickesselman.nl</a>
      <nav class="language-switch" aria-label="Language">
        <a href={englishPath} lang="en" hreflang="en" class:active={!isDutch}>EN</a>
        <span aria-hidden="true">/</span>
        <a href={dutchPath} lang="nl" hreflang="nl" class:active={isDutch}>NL</a>
      </nav>
    </div>
  </header>

  <main class="page">
    <aside class="intro">
      <h1>{isDutch ? "Neem contact op." : "Get in touch."}</h1>
      <p class="identity">
        {isDutch ? "Officiële contactpagina van" : "Official contact page for"}
        <a href="https://nickesselman.nl/">Nick Esselman</a>, a Netherlands-based full-stack
        developer and maker.
      </p>
      <p class="direct-contact">
        {isDutch ? "Liever e-mail?" : "Prefer email?"}<br />
        <a href="mailto:info@nickesselman.nl">info@nickesselman.nl</a>
      </p>
      {#if source}
        <p class="source-note" aria-live="polite" data-nosnippet>Referred from {sourceLabel(source)}</p>
      {/if}
    </aside>

    <section class="form-section" aria-labelledby="form-title" data-nosnippet>
      {#if formResult.success}
        <div class="success" role="status">
          <h2 id="form-title">Message sent.</h2>
          <p>{formResult.message ?? "Your message was sent successfully."}</p>
        </div>
        <div class="actions">
          <button type="button" class="button" on:click={resetFormView}>Send another</button>
          <a class="button-secondary" href="mailto:info@nickesselman.nl">Use email instead</a>
        </div>
      {:else}
        <div class="form-header">
          <h2 id="form-title">{isDutch ? "Stuur een bericht" : "Send a message"}</h2>
        </div>

        {#if formResult.error}
          <div class="status" role="alert">
            <h3>Message not sent</h3>
            <p>{formResult.error}</p>
          </div>
        {/if}

        <form method="POST" use:enhance={handleEnhance} aria-busy={isSubmitting}>
          <div class="grid grid-two first-row">
            <div class="field">
              <label for="name">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                bind:value={name}
                maxlength={FIELD_LIMITS.name}
                autocomplete="name"
                placeholder="Your name"
                required
              />
            </div>

            <div class="field">
              <label for="contactMethod">Reply by</label>
              <select id="contactMethod" name="contactMethod" bind:value={contactMethod} required>
                <option value="" disabled>Select one</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="instagram">Instagram</option>
                <option value="phone">Phone call</option>
                <option value="none">No reply needed</option>
              </select>
            </div>
          </div>

          <div class="grid">
            {#if contactMethod === "email"}
              <div class="field">
                <label for="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  bind:value={email}
                  maxlength={FIELD_LIMITS.email}
                  autocomplete="email"
                  required
                />
              </div>
            {:else if contactMethod === "sms" || contactMethod === "whatsapp" || contactMethod === "phone"}
              <div class="field">
                <label for="contactDetail">
                  {contactMethod === "phone" ? "Phone number" : contactMethod === "sms" ? "SMS number" : "WhatsApp number"}
                </label>
                <input
                  id="contactDetail"
                  name="contactDetail"
                  type="tel"
                  bind:value={contactDetail}
                  maxlength={FIELD_LIMITS.contactDetail}
                  autocomplete="tel"
                  inputmode="tel"
                  placeholder="+31 6 12 34 56 78"
                  required
                />
              </div>
            {:else if contactMethod === "instagram"}
              <div class="field">
                <label for="contactDetail">Instagram handle</label>
                <input
                  id="contactDetail"
                  name="contactDetail"
                  type="text"
                  bind:value={contactDetail}
                  maxlength={FIELD_LIMITS.instagram + 1}
                  autocomplete="off"
                  pattern={"@?[A-Za-z0-9._]{1,30}"}
                  placeholder="@username"
                  required
                />
              </div>
            {/if}

            <div class="field">
              <label for="message">Message</label>
              <textarea
                id="message"
                name="message"
                bind:value={message}
                maxlength={FIELD_LIMITS.message}
                placeholder="What do you need?"
                required
              ></textarea>
            </div>

            {#if turnstileSiteKey}
              <div class="turnstile-section">
                <span class="turnstile-label">Security check</span>
                <div class="turnstile-widget" bind:this={turnstileContainer}></div>
                {#if !turnstileVerified}
                  <p class="turnstile-status" aria-live="polite">
                    {turnstileHasError ? "Security check is retrying." : "Complete the check to send."}
                    <a href="mailto:info@nickesselman.nl">Use email instead.</a>
                  </p>
                {/if}
              </div>
            {/if}
          </div>

          <p class="privacy-note">
            Used only to answer your message. Don’t send passwords, API keys, identity documents,
            or other secrets.
          </p>
          <input type="hidden" name="source" value={source ?? ""} />
          <input
            class="honeypot"
            type="text"
            name="subject"
            tabindex="-1"
            autocomplete="off"
            aria-hidden="true"
          />

          <div class="actions">
            <button
              class="button"
              type="submit"
              disabled={isSubmitting || (Boolean(turnstileSiteKey) && !turnstileVerified)}
            >
              {isSubmitting ? "Sending…" : "Send message"}
            </button>
          </div>
        </form>
      {/if}
    </section>
  </main>

  <footer>
    <span>Nick Esselman</span>
    <nav aria-label="Related sites">
      <a href="https://nickesselman.nl/">Portfolio</a>
      <a href="https://blog.nickesselman.nl/">Nick Esselman’s Blog</a>
      <span>{new Date().getFullYear()}</span>
    </nav>
  </footer>
</div>
