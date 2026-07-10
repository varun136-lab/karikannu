export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.karikannu.com') {
      url.hostname = 'karikannu.com';
      return Response.redirect(url.toString(), 301);
    }
    // No redirect needed -- serve the static site as normal.
    return env.ASSETS.fetch(request);
  },
};
