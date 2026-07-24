import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ out: 'build' }),
    csp: {
      mode: 'nonce',
      directives: {
        'default-src': ['self'],
        'base-uri': ['none'],
        'connect-src': ['self', 'https://challenges.cloudflare.com'],
        'font-src': ['self'],
        'form-action': ['self'],
        'frame-ancestors': ['none'],
        'frame-src': ['https://challenges.cloudflare.com'],
        'img-src': ['self', 'data:'],
        'object-src': ['none'],
        'script-src': ['self', 'https://challenges.cloudflare.com'],
        'style-src': ['self']
      }
    }
  }
};

export default config;
