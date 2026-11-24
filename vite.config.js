import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: mode === 'public' ? [{
    name: 'public-apartment-viewer',
    transformIndexHtml(html) {
      return html
        .replace('Private project workspace', 'Design viewer')
        .replace('Renovation Control Tower</p>', 'Apartment model and design renders</p>')
        .replace('id="add-pin" class=', 'id="add-pin" hidden class=')
        .replace('chatgpt.site/" hidden>Open work register', 'chatgpt.site/">Open work register')
        .replace('id="totals" class=', 'id="totals" hidden class=')
        .replace('id="work-panel" class=', 'id="work-panel" hidden class=')
        .replace('WebGL is unavailable. You can place a pin at a room centre or edit the register below.', 'WebGL is unavailable. You can still browse all room renders.');
    },
  }] : [],
}));
