<script lang="ts">
  import { page } from "$app/stores";
</script>

<svelte:head>
  <title>Page not found | Nick Esselman</title>
  <meta name="robots" content="noindex,noarchive" />
</svelte:head>

<main class="error-page">
  <p class="error-code">{$page.status}</p>
  <h1>{$page.status === 404 ? "Page not found." : "Something went wrong."}</h1>
  <p>
    {$page.status === 404
      ? "The page you requested does not exist."
      : "The page could not be loaded right now."}
  </p>
  <a class="button" href="/">Return to contact</a>
</main>
