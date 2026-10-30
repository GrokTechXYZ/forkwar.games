# Fork War · teaser

A single, static coming-soon page. Original real-time 3D teaser, local fonts, cinematic view, optional synthesized sound, and reduced-motion support. No game rules, accounts, backend, telemetry, wallet integration, or signup collection.

## Develop

Requires Node.js 22.13 or newer.

```sh
npm ci
npm run dev
```

## Publish

```sh
npm run build
```

Push to `main` to build and deploy `dist/` through GitHub Actions. Repository **Settings → Pages → Source** must be **GitHub Actions**. Asset paths are relative, so the same build works under the project URL or a custom domain.

The source is self-contained. It is independent of the private game prototype and contains no game data, progression, economy, lore, or settlement code.

## Interaction and accessibility

- “Watch the signal” expands the scene; Escape or “Back to the surface” exits.
- Sound is off until explicitly enabled. All sounds are synthesized in the browser.
- The pause control stops the presentation clock. System reduced-motion preferences start the scene paused.
- The scene and audio suspend when the page is hidden.
- If WebGL is unavailable, the page retains its illustrated backdrop, title, and coming-soon message.
- Fonts are served locally; their SIL Open Font Licenses are in `public/fonts/`.

## Custom domain

After the DNS is ready, set `forkwar.games` as the GitHub Pages custom domain, then enable HTTPS. Replace parked apex A records with GitHub's four addresses:

```text
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

Set `www` as a CNAME to `primate411.github.io`. Preserve unrelated mail and verification records. Update canonical and social-image URLs in `index.html` after the domain is connected.
