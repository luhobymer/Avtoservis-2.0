export default {
  scheduled(event, env, ctx) {
    const url = `${String(env.API_BASE_URL || '').replace(/\/$/, '')}/api/reminders/run-check`;
    const req = fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': String(env.SERVER_API_KEY || ''),
      },
    });
    ctx.waitUntil(req);
  },
};
