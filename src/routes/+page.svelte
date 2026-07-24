<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { goto } from "$app/navigation";
  import { enhance } from "$app/forms";
  import { page } from "$app/stores";
  import {
    buildPresetMessage,
    formatBytes,
    IMAGE_LIMITS,
    normalizeSource
  } from "$lib/contactContext";

  type FormResult = {
    success?: boolean;
    message?: string;
    error?: string;
  };

  export let data: { turnstileSiteKey: string };
  export let form: FormResult | null | undefined;

  let clientResult: FormResult | null = null;
  let formResult: FormResult = {};
  let isSubmitting = false;

  let name = "";
  let email = "";
  let message = "";
  let contactMethod = "";
  let contactDetail = "";
  let imageFiles: FileList | null = null;
  let selectedImages: File[] = [];
  let totalImageBytes = 0;
  let source: string | null = null;
  let presetMessage = "";
  let fileInputVersion = 0;
  let turnstileContainer: HTMLDivElement | null = null;
  let turnstileWidgetId: string | undefined;
  let turnstileVerified = false;
  let turnstileHasError = false;
  let turnstileRenderTimer: number | undefined;
  let turnstileResetTimer: number | undefined;
  let componentMounted = false;

  const attachmentAccept = IMAGE_LIMITS.acceptedTypes.join(",");
  const turnstileSiteKey = data.turnstileSiteKey;

  $: formResult = clientResult ?? form ?? {};
  $: source = normalizeSource($page.url.searchParams.get("from"));
  $: presetMessage = buildPresetMessage($page.url.searchParams);
  $: selectedImages = imageFiles ? Array.from(imageFiles) : [];
  $: totalImageBytes = selectedImages.reduce((sum, file) => sum + file.size, 0);
  $: if (presetMessage) {
    message = presetMessage;
  }

  const removeTurnstile = () => {
    if (turnstileRenderTimer) {
      window.clearTimeout(turnstileRenderTimer);
      turnstileRenderTimer = undefined;
    }

    if (turnstileResetTimer) {
      window.clearTimeout(turnstileResetTimer);
      turnstileResetTimer = undefined;
    }

    if (turnstileWidgetId && window.turnstile?.remove) {
      window.turnstile.remove(turnstileWidgetId);
    }

    turnstileWidgetId = undefined;
    turnstileVerified = false;
    turnstileHasError = false;
  };

  const renderTurnstile = () => {
    if (!componentMounted || !turnstileSiteKey || !turnstileContainer || turnstileWidgetId) {
      return;
    }

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
      return;
    }

    turnstileWidgetId = undefined;
    renderTurnstile();
  };

  const resetFormView = async () => {
    clientResult = null;
    name = "";
    email = "";
    message = presetMessage;
    contactMethod = "";
    contactDetail = "";
    imageFiles = null;
    fileInputVersion += 1;
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
                ? "The upload was larger than the server accepted. Try fewer or smaller images."
                : result.error?.message || "Failed to send message. Please try again."
          };
          await tick();
          resetTurnstile();
          return;
        }

        if (result.type === "success" || result.type === "failure") {
          const nextResult = result.data as FormResult;

          if (nextResult.success) {
            removeTurnstile();
          }

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
  <title>Contact Nick Esselman</title>
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
    <a class="wordmark" href="/" aria-label="Nick Esselman contact">Nick Esselman</a>
    <a class="header-email" href="mailto:info@nickesselman.nl">info@nickesselman.nl</a>
  </header>

  <main class="page">
    <aside class="intro">
      <h1>Get in touch.</h1>
      <p>
        Questions, project ideas, bug reports—send whatever you have in mind.
      </p>
      <p class="direct-contact">
        Prefer email?<br />
        <a href="mailto:info@nickesselman.nl">info@nickesselman.nl</a>
      </p>

      {#if source}
        <p class="source-note" aria-live="polite">Referred from {source}</p>
      {/if}
    </aside>

    <section class="form-section" aria-labelledby="form-title">
      {#if formResult.success}
        <div class="success">
          <h2 id="form-title">Message sent.</h2>
          <p>{formResult.message ?? "Your message was sent successfully."}</p>
        </div>

        <div class="actions">
          <button type="button" class="button" on:click={resetFormView}>Send another</button>
          <a class="button-secondary" href="mailto:info@nickesselman.nl">Use email instead</a>
        </div>
      {:else}
        <div class="form-header">
          <h2 id="form-title">Send a message</h2>
          <p class="form-copy">
            I’ll reply using the contact method you choose.
          </p>
        </div>

        {#if formResult.error}
          <div class="status" role="alert">
            <h3>Message not sent</h3>
            <p>{formResult.error}</p>
          </div>
        {/if}

        <form
          method="POST"
          enctype="multipart/form-data"
          use:enhance={handleEnhance}
          aria-busy={isSubmitting}
        >
          <div class="grid grid-two first-row">
            <div class="field">
              <label for="name">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                bind:value={name}
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
                placeholder="What do you need?"
                required
              ></textarea>
            </div>

            <div class="field upload-section">
              <div class="upload-heading">
                <label for={"images-" + fileInputVersion}>Images</label>
                <span>Optional</span>
              </div>
              <div class="upload-stack">
                {#key fileInputVersion}
                  <div class="upload-control">
                    <input
                      id={"images-" + fileInputVersion}
                      class="file-input"
                      name="images"
                      type="file"
                      accept={attachmentAccept}
                      multiple
                      bind:files={imageFiles}
                    />
                    <label class="upload-surface" for={"images-" + fileInputVersion}>
                      <span class="upload-title">Choose files</span>
                      <span class="upload-copy">
                        Up to {IMAGE_LIMITS.maxFiles} images · {formatBytes(IMAGE_LIMITS.maxBytesPerFile)}
                        each · {formatBytes(IMAGE_LIMITS.maxBytesTotal)} total
                      </span>
                    </label>
                  </div>
                {/key}

                {#if selectedImages.length}
                  <div class="file-list" aria-live="polite">
                    {#each selectedImages as file}
                      <div class="file-row">
                        <span>{file.name}</span>
                        <strong>{formatBytes(file.size)}</strong>
                      </div>
                    {/each}
                    <p class="subtle">Total: {formatBytes(totalImageBytes)}.</p>
                  </div>
                {/if}
              </div>
            </div>

            {#if turnstileSiteKey}
              <div class="turnstile-section">
                <span class="turnstile-label">Security check</span>
                <div class="turnstile-widget" bind:this={turnstileContainer}></div>
                {#if !turnstileVerified}
                  <p class="turnstile-status" aria-live="polite">
                    {turnstileHasError ? "Security check is retrying…" : "Complete the check to send your message."}
                  </p>
                {/if}
              </div>
            {/if}
          </div>

          <input type="hidden" name="source" value={source ?? ""} />
          <input
            class="honeypot"
            type="text"
            name="subject"
            tabindex="-1"
            autocomplete="off"
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
    <span>{new Date().getFullYear()}</span>
  </footer>
</div>
