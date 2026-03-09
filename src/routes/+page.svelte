<script lang="ts">
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

  const attachmentAccept = IMAGE_LIMITS.acceptedTypes.join(",");

  $: formResult = clientResult ?? form ?? {};
  $: source = normalizeSource($page.url.searchParams.get("from"));
  $: presetMessage = buildPresetMessage($page.url.searchParams);
  $: selectedImages = imageFiles ? Array.from(imageFiles) : [];
  $: totalImageBytes = selectedImages.reduce((sum, file) => sum + file.size, 0);
  $: if (presetMessage) {
    message = presetMessage;
  }

  const resetFormView = () => {
    clientResult = null;
    name = "";
    email = "";
    message = presetMessage;
    contactMethod = "";
    contactDetail = "";
    imageFiles = null;
    fileInputVersion += 1;
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
          clientResult = { error: "Failed to send message. Please try again." };
          return;
        }

        if (result.type === "success" || result.type === "failure") {
          clientResult = result.data as FormResult;
        }
      } finally {
        isSubmitting = false;
      }
    };
  };
</script>

<svelte:head>
  <title>Contact Nick Esselman</title>
</svelte:head>

<div class="shell">
  <div class="liquid-field" aria-hidden="true">
    <span class="liquid liquid-one"></span>
    <span class="liquid liquid-two"></span>
    <span class="liquid liquid-three"></span>
  </div>

  <div class="page">
    <section class="hero">
      <div class="hero-card">
        <div class="eyebrow">Red channel open</div>
        <div class="hero-grid">
          <div class="hero-copy">
            <h1>Drop the idea, bug, or screenshot.</h1>
            <p>
              This contact page now feels more like a dark intake desk than a landing page. Send a
              rough thought, a clean pitch, or a broken-state screenshot.
            </p>
          </div>

          <div class="hero-side">
            <div class="stat-card">
              <span class="stat-label">Best for</span>
              <strong class="stat-value">bugs, builds, visuals</strong>
            </div>
            <div class="stat-card">
              <span class="stat-label">Image flow</span>
              <strong class="stat-value">emailed as attachments</strong>
            </div>
            <div class="stat-card">
              <span class="stat-label">Fastest reply</span>
              <strong class="stat-value">WhatsApp or email</strong>
            </div>
          </div>
        </div>

        {#if source}
          <div class="source-banner" aria-live="polite">
            <span class="source-label">Via</span>
            <span class="source-value">{source}</span>
          </div>
        {/if}
      </div>
    </section>

    <section class="layout">
      <div class="form-card">
        {#if formResult.success}
          <div class="success">
            <h2>Message sent</h2>
            <p>{formResult.message ?? "Your message was sent successfully."}</p>
          </div>

          <div class="actions">
            <button type="button" class="button" on:click={resetFormView}>Send another</button>
            <a class="button-secondary" href="mailto:info@nickesselman.nl">Use plain email</a>
          </div>
        {:else}
          <div class="form-header">
            <div>
              <div class="section-kicker">Message intake</div>
              <h2 class="form-heading">Contact form</h2>
            </div>
            <p class="form-copy">
              Add enough context to act on. Images you upload here are sent as email attachments,
              not public links.
            </p>
          </div>

          {#if formResult.error}
            <div class="status" role="alert">
              <h2>Something blocked the send</h2>
              <p>{formResult.error}</p>
            </div>
          {/if}

          <form
            method="POST"
            enctype="multipart/form-data"
            use:enhance={handleEnhance}
            aria-busy={isSubmitting}
          >
            <div class="grid grid-two">
              <div class="field">
                <label for="name">Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  bind:value={name}
                  placeholder="Nick"
                  required
                />
              </div>

              <div class="field">
                <label for="contactMethod">How should I reply?</label>
                <select id="contactMethod" name="contactMethod" bind:value={contactMethod} required>
                  <option value="" disabled>Select one</option>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="instagram">Instagram</option>
                  <option value="phone">Phone call</option>
                  <option value="none">Do not reply</option>
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
                  placeholder="Tell me what is broken, what to build, or what the attached image shows."
                  required
                ></textarea>
              </div>

              <div class="field">
                <label for={"images-" + fileInputVersion}>Add images</label>
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
                      <span class="upload-title">Choose screenshots, sketches, or photos</span>
                      <span class="upload-copy">
                        Up to {IMAGE_LIMITS.maxFiles} images. {formatBytes(IMAGE_LIMITS.maxBytesPerFile)}
                        each, {formatBytes(IMAGE_LIMITS.maxBytesTotal)} total.
                      </span>
                    </label>
                  </div>
                {/key}

                {#if selectedImages.length}
                  <div class="file-list" aria-live="polite">
                    {#each selectedImages as file}
                      <div class="file-pill">
                        <span>{file.name}</span>
                        <strong>{formatBytes(file.size)}</strong>
                      </div>
                    {/each}
                    <p class="subtle">
                      Current total: {formatBytes(totalImageBytes)}. If you need more, drop a cloud
                      link in the message.
                    </p>
                  </div>
                {/if}
              </div>
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
              <button class="button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send message"}
              </button>
              <span class="subtle">Replies usually come back through the method you pick.</span>
            </div>
          </form>
        {/if}
      </div>

      <div class="side-stack">
        <aside class="side-card side-card--accent">
          <div class="kicker">Add images</div>
          <h3>Attach the useful bits</h3>
          <p>
            Upload screenshots, mockups, sketches, or error captures right in the form. They get
            attached to the email so the context lands with the message.
          </p>
          <ul class="info-list">
            <li>Up to {IMAGE_LIMITS.maxFiles} images per message</li>
            <li>{formatBytes(IMAGE_LIMITS.maxBytesPerFile)} max per image</li>
            <li>{formatBytes(IMAGE_LIMITS.maxBytesTotal)} total attachment budget</li>
          </ul>
        </aside>

        <aside class="side-card">
          <div class="kicker">Fallback</div>
          <h3>Plain email still works</h3>
          <p>
            If the form is not the right fit, send it directly to
            <a href="mailto:info@nickesselman.nl">info@nickesselman.nl</a>.
          </p>
        </aside>
      </div>
    </section>
  </div>
</div>
