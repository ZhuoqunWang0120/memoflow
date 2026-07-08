# MemoFlow iOS PWA Install Notes

## Run Locally

Default local run:

```bash
npm run dev
```

The app serves from:

```text
http://127.0.0.1:3000
```

## Access From An iPhone On The Same Network

By default, MemoFlow binds to `127.0.0.1`, which works only on the same
machine.

For iPhone testing over Wi-Fi or mobile hotspot, run the LAN bind command:

```bash
npm run dev:lan
```

Find your Mac's current LAN IP:

```bash
ipconfig getifaddr en0
```

If `en0` is not the active interface, check available addresses with:

```bash
ifconfig | rg "inet "
```

Then open this exact URL on the phone:

```text
http://<your-mac-lan-ip>:3000
```

Notes:

- Your iPhone and Mac must be on the same Wi-Fi network or connected through
  the same mobile-hotspot network.
- Your Mac firewall and local network must allow the connection.
- If the page does not load, confirm you started MemoFlow with `npm run dev:lan`
  and that the IP address still matches your active network.
- On a same-network HTTP URL, the app should still be reachable and addable to the iPhone home screen.
- Service worker registration is limited to secure contexts such as `localhost` or HTTPS, so conservative offline asset caching may not activate from a plain LAN HTTP URL on iPhone.

## Add To Home Screen On iPhone

1. Open MemoFlow in Safari on the iPhone.
2. Use the Share button.
3. Choose `Add to Home Screen`.
4. Confirm the app name and add it.
5. Launch it from the home screen.

Expected installable metadata:

- app name: `MemoFlow Local`
- short label: `MemoFlow`
- icon: MemoFlow note-style placeholder icon
- display mode: standalone

## Verify Persistence

MemoFlow persistence should remain unchanged by this PWA task.

Manual verification:

1. Save a dump from `/` or `/capture`.
2. Add a memory entry.
3. Reload the app.
4. Confirm the saved dump still appears in Pending Review.
5. Confirm the memory entry still appears in Memory.
6. If launched from the home screen, repeat the same check there.

Persistence expectations:

- existing file-backed storage behavior is unchanged
- no backend was added
- no storage schema or migration was introduced
