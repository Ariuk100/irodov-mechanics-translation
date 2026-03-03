import { defineConfig } from 'vite'

export default defineConfig({
  base: '/books/',
  plugins: [
    {
      name: 'watch-json',
      handleHotUpdate({ file, server }) {
        if (file.endsWith('.json')) {
          server.ws.send({
            type: 'custom',
            event: 'json-update',
            data: { file }
          });
        }
      },
    }
  ]
})
