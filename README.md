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

The source is self-contained. It is independent of the private game prototype and contains no game data, progression, economy, or settlement code. Only a few teaser references are public: Athens, cycles, self-amendment, and a Tezos sigil in the arena. The symbol is sourced from the header mark on https://tezos.com/.

## Interaction and accessibility

- “Watch the signal” expands the scene; Escape or “Back to the surface” exits.
- Sound is off until explicitly enabled. All sounds are synthesized in the browser.
- The pause control stops the presentation clock. System reduced-motion preferences start the scene paused.
- The scene and audio suspend when the page is hidden.
- If WebGL is unavailable, the page retains its illustrated backdrop, title, and coming-soon message.
- Fonts are served locally; their SIL Open Font Licenses are in `public/fonts/`.

## Custom domain

The production domain is `https://forkwar.games/`. GitHub Pages is configured with the apex domain and HTTPS enforcement is enabled. The `www.forkwar.games` alias redirects to the apex once DNS and its certificate propagate.

`public/CNAME` is included in the deployment artifact, and `index.html` uses the custom domain for canonical and social URLs. With Actions deployments, the repository's Pages custom-domain setting is authoritative.

Migadu hosts DNS; GoDaddy remains the registrar. Web records:

| Type | Name | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | primate411.github.io |

Preserve unrelated mail and verification records. The GitHub project URL redirects to the custom domain after the Pages domain setting is applied.
