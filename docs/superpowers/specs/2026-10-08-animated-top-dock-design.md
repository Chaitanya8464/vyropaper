# AnimatedTopDock integration design

## Goal

Integrate the ThreeUI `AnimatedTopDock` Sable design into Paperwork's existing
header as its complete primary navigation. Keep the Paperwork brand at the
upper left, and put Home, Tools, How it works, Privacy, Terms, the theme
toggle, and Edit PDF in the dock.

## Approved behavior and presentation

- Mount the dock in the center of `SiteHeader` without separate header actions.
- Use the specified `sable` variant and exact configured values:
  `proximity={122}`, `spring={0.19}`, `damping={0.70}`,
  `widthGrowth={17}`, `heightGrowth={16}`, and `drop={3.5}`.
- Use real links for destinations and a button for the light/dark toggle; mark
  the current route and theme state accessibly.
- Retain the Sable spring animation and styling, adapting the component to
  accept Paperwork's menu items rather than keeping its demo labels.
- Restyle the existing upper-left Paperwork wordmark; keep the footer links.
- Keep the registered controller, shaders, shared stylesheet, and font
  byte-for-byte. Project-specific CSS may size/place the dock and adapt its
  menu layout for mobile.

## Source and dependencies

The complete registered bundle was retrieved from
<https://threeui.com/source-code/animated-top-dock.json>. Its five source files
initially matched the requested revision by SHA-256:

| File | SHA-256 |
| --- | --- |
| `AnimatedTopDock.tsx` | `50ddbba7ebc81565f42bd14dda34efb45e7b18c1aa47e97f196256ffedb4478f` |
| `topDockController.ts` | `506ab23d4d42cf1b5bc89131e7714586ee107381bb18d9b0302766e9a1dee2bd` |
| `retroPixelField.ts` | `54f0469be51dfce2da7ce37c952d42c583cc7996794bf96d1ea0b2bb35d94115` |
| `glassParticleField.ts` | `bc9f07ae6da33b28f82303ea937095806f8e3a2ab08bd1301ae8457aaf0c3464` |
| `threeui.css` | `efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf` |

The Paperwork integration adapts `AnimatedTopDock.tsx` to accept accessible
links and action items. Its Sable menu is now configured by `SiteHeader`; the
other registered source files remain byte-for-byte unchanged.

The published `@designcodeio/threeui` package is MIT-licensed; preserve its
license notice with the vendored source. The source imports the `three128`
alias, corresponding to Three.js r128, so add that alias as a direct runtime
dependency. Import the registered stylesheet from the app entry point.

The required font asset must be copied byte-for-byte and verified as 15,176
bytes with SHA-256
`4f4dc27f4a770c0d02fde800daa836c8adc0d1e423b28da74baaf0d1cc3ab96c`. If the
exact bytes cannot be retrieved, stop without substituting another font or
altering the source stylesheet.

## Files expected to change

- Add the five registered source files beneath `src/shaders/`.
- Add `src/shaders/fonts/fragment-mono.woff2` and the MIT license notice.
- Import `src/shaders/threeui.css` from `src/main.jsx`.
- Integrate the component in `src/components/layout/SiteHeader.jsx`.
- Adapt `src/shaders/animated-top-dock/AnimatedTopDock.tsx` for custom menu
  items and navigation.
- Add the header/menu presentation rules to `src/styles/global.css`.
- Add the `three128` alias dependency to `package.json` and its lockfile.

## Verification

- Verify the unchanged registered source checksums and the font
  byte count/checksum.
- Run the production build.
- In a browser, verify the header at desktop and mobile widths, pointer
  proximity/spring response, all menu destinations and theme action, keyboard
  focus/interaction, no header overlap, and no console or asset-loading errors.
