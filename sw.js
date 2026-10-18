// Service worker do protótipo: recebe o PDF enviado pelo menu "Compartilhar" do Android.
const CACHE = 'giracota-compartilhado-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname === '/receber') {
    event.respondWith((async () => {
      try {
        const form = await event.request.formData();
        const arquivo = form.get('pdf');
        if (arquivo && arquivo.size) {
          const cache = await caches.open(CACHE);
          await cache.put('/arquivo-compartilhado', new Response(arquivo, {
            headers: {
              'Content-Type': arquivo.type || 'application/pdf',
              'X-Nome': encodeURIComponent(arquivo.name || 'pedido.pdf')
            }
          }));
          return Response.redirect('/?compartilhado=1', 303);
        }
      } catch (err) {
        // cai para o redirecionamento de erro abaixo
      }
      return Response.redirect('/?compartilhado=erro', 303);
    })());
  }
  // Demais requisições seguem direto pela rede.
});
