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
          clientResult = {
            error:
              result.status === 413
                ? "The upload was larger than the server accepted. Try fewer or smaller images."
                : "Failed to send message. Please try again."
          };
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
        <div class="eyebrow">Contact</div>
        <div class="hero-grid">
          <div class="hero-copy">
            <h1>Send a message.</h1>
            <p>
              Use this form for project questions, bug reports, or general contact.
            </p>
          </div>

          <div class="hero-side">
            <div class="stat-card">
              <span class="stat-label">Reply</span>
              <strong class="stat-value">WhatsApp or email</strong>
            </div>
            <div class="stat-card">
              <span class="stat-label">Attachments</span>
              <strong class="stat-value">Up to {IMAGE_LIMITS.maxFiles} images</strong>
            </div>
            <div class="stat-card">
              <span class="stat-label">Direct email</span>
              <strong class="stat-value">info@nickesselman.nl</strong>
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
              <div class="section-kicker">Form</div>
              <h2 class="form-heading">Contact form</h2>
            </div>
            <p class="form-copy">
              Images are sent as email attachments.
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
                      <span class="upload-title">Select images</span>
                      <span class="upload-copy">
                        {IMAGE_LIMITS.maxFiles} files max. {formatBytes(IMAGE_LIMITS.maxBytesPerFile)}
                        each. {formatBytes(IMAGE_LIMITS.maxBytesTotal)} total.
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
                      Total: {formatBytes(totalImageBytes)}.
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
              <span class="subtle">Replies usually use the method you choose.</span>
            </div>
          </form>
        {/if}
      </div>

      <div class="side-stack">
        <aside class="side-card side-card--accent">
          <div class="kicker">Images</div>
          <h3>Image attachments</h3>
          <p>Attach screenshots or photos directly to the message.</p>
          <ul class="info-list">
            <li>{IMAGE_LIMITS.maxFiles} files max</li>
            <li>{formatBytes(IMAGE_LIMITS.maxBytesPerFile)} per file</li>
            <li>{formatBytes(IMAGE_LIMITS.maxBytesTotal)} total</li>
          </ul>
        </aside>

        <aside class="side-card">
          <div class="kicker">Email</div>
          <h3>Direct contact</h3>
          <p>
            Send directly to
            <a href="mailto:info@nickesselman.nl">info@nickesselman.nl</a>.
          </p>
        </aside>
      </div>
    </section>
  </div>
</div>
