# StreamVault Frontend

Static frontend for StreamVault - deploys to Netlify.

## Configuration

Edit `js/player.js` and update these URLs:

```javascript
const CONFIG = {
    PRIMARY_BACKEND: 'https://your-cloudflare-tunnel-url.trycloudflare.com',
    FALLBACK_BACKEND: 'https://your-render-app.onrender.com',
};
```

## Deploy to Netlify

1. Push this folder to GitHub
2. Connect to Netlify
3. Deploy!

Or drag & drop this folder to [netlify.com/drop](https://app.netlify.com/drop)
