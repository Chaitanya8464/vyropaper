# AnimatedTopDock integration design

## Goal

Integrate the exact ThreeUI `AnimatedTopDock` Sable source into Paperwork's
existing header. Keep the Paperwork brand and theme/editor controls; move no
existing destinations out of the footer, which already links to Tools, How it
works, Privacy, and Terms.

## Approved behavior and presentation

- Mount the component in the center slot of `SiteHeader`.
- Use the specified `sable` variant and exact configured values:
  `proximity={122}`, `spring={0.19}`, `damping={0.70}`,
  `widthGrowth={17}`, `heightGrowth={16}`, and `drop={3.5}`.
- Preserve the source-authored Sable dock labels and interactions. Its buttons
  select/highlight a dock item; they are not Paperwork tool links.
- Keep Paperwork's existing footer links and header brand/theme/editor controls.
- Keep the registered component, controller, shaders, and shared stylesheet
  byte-for-byte. Limit project-specific CSS to the dock's header slot sizing and
  placement.

## Source and dependencies

The complete registered bundle was retrieved from
<https://threeui.com/source-code/animated-top-dock.json>. Its five source files
match the requested revision by SHA-256:

| File | SHA-256 |
| --- | --- |
| `AnimatedTopDock.tsx` | `50ddbba7ebc81565f42bd14dda34efb45e7b18c1aa47e97f196256ffedb4478f` |
| `topDockController.ts` | `506ab23d4d42cf1b5bc89131e7714586ee107381bb18d9b0302766e9a1dee2bd` |
| `retroPixelField.ts` | `54f0469be51dfce2da7ce37c952d42c583cc7996794bf96d1ea0b2bb35d94115` |
| `glassParticleField.ts` | `bc9f07ae6da33b28f82303ea937095806f8e3a2ab08bd1301ae8457aaf0c3464` |
| `threeui.css` | `efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf` |

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
- Add only necessary header-slot sizing/placement rules to
  `src/styles/global.css`.
- Add the `three128` alias dependency to `package.json` and its lockfile.

## Verification

- Verify all five source-file checksums and the font byte count/checksum.
- Run the production build.
- In a browser, verify the header at desktop and mobile widths, pointer
  proximity/spring response, keyboard focus/interaction, no horizontal
  overflow, and no console or asset-loading errors.
