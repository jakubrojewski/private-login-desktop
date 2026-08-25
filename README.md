# Private Login Desktop

Minimal mobile controls layered on the pinned `jlesage/firefox` image for a private, temporary browser desktop.

- No credentials or persistent browser profile are included.
- Clipboard transfer is for non-secret plain text only; enter passwords and OTPs with the keyboard.
- The image does not provide access control. Publish the web port only on loopback and expose it through an authenticated private network such as Tailscale.
- Deploy by immutable GHCR digest, not by tag.

## Check

```sh
node tests/mobile-panel.test.mjs
```
