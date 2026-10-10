// Cloudflare Pages Functions - SSE keep-alive for /api/sync/events

export const onRequestGet = async () => {
  // In serverless edge environments like Cloudflare Pages, long-lived SSE connections
  // can be handled with a short keepalive stream or graceful response.
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial ping so client EventSource connects cleanly
  writer.write(encoder.encode('event: sync\ndata: {"type":"connected","timestamp":' + Date.now() + '}\n\n'));

  // Close gracefully after a short delay; EventSource will auto-reconnect or fall back to polling
  setTimeout(async () => {
    try {
      await writer.close();
    } catch {}
  }, 25000);

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
