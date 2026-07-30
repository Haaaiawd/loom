# Meme Dispatch

`meme-dispatch` is a zero-runtime-dependency Node 18+ CLI for desktop agents that need to send a reaction image without placing the image itself in model context. It stores and ranks only tiny records: ID, name, HTTPS image URL, dimensions and optional local tags.

```bash
npm test
node bin/meme-dispatch.js refresh
node bin/meme-dispatch.js "celebrate the launch"
node bin/meme-dispatch.js "that was unexpected" --emotion surprise
node bin/meme-dispatch.js preview "celebrate launch"
```

The normal command writes exactly one line to stdout, for example `![Meme: Leonardo Dicaprio Cheers](https://i.imgflip.com/39t1o.jpg)`. A ChatGPT/Codex desktop client can render that remote image natively; the CLI never downloads image bytes or emits base64.

## Source and rights boundary

Refresh reads the public [Imgflip get_memes API](https://api.imgflip.com/get_memes), then retains compact metadata in `data/memes.json`. A small local fallback remains usable offline. Meme images are hosted by Imgflip and may embody third-party works or user content. This tool does not copy, host, license, or grant rights to those images. Use is subject to the host's terms and the context in which you share it.

The default index accepts only HTTPS images from `i.imgflip.com`; it deliberately does not search the open web or accept arbitrary image URLs. Ranking is deterministic lexical matching, not a cultural-suitability guarantee.
