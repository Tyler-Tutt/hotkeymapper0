# Hotkey Mapper

A small, dependency-free web app for testing which physical keys correspond to which actions in a given application (e.g. hotkeys for a video game), and taking notes on them.

Plain HTML/CSS/JavaScript. No build step: open `index.html` in a browser.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `styles.css` | Styling |
| `app.js` | State, rendering, key capture, storage |

## Current features

- **Custom button grid** – set rows (1–12) and columns (1–16). Each cell shows its bound key and action.
- **Bind a key** – select a cell, click "Press a key…", then press a physical key. `Esc` cancels. Bindings use the key's physical position (`event.code`), so they are keyboard-layout independent.
- **Quick edit mode** – a toggle that makes clicking a cell immediately listen for a key to bind. With it off, cell clicks behave normally (select only).
- **Key chords** – hold modifiers (Ctrl/Alt/Shift/Meta) and press a key while binding to bind a chord like `Ctrl+Shift+X`. Pressing and releasing a modifier on its own binds that modifier by itself.
- **Press to highlight** – pressing a bound key or chord flashes its cell. The last key/chord pressed is shown in the side panel.
- **Action and notes** – each cell has an action name and free-text notes.
- **Profiles** – one per game/app; create, rename, delete, switch.
- **Persistence** – autosaved to browser `localStorage` (key `hotkeymapper.v1`).
- **Export / Import** – the active profile as a `.hotkeys.json` file; import adds it as a new profile.

## Behavior notes

- Typing in the Action/Notes fields is never captured as a key binding or highlight.
- A key can currently be bound to more than one cell (no conflict detection yet).
- Chords match exactly: a cell bound to `Ctrl+X` does not fire on `Ctrl+Shift+X` or plain `X`.
- Some browser/OS shortcuts (e.g. `Ctrl+W`, `Alt+Tab`, the Windows key) can't be captured by a web page.

## Data model

```
state    = { activeProfile: id, profiles: { [id]: Profile } }
Profile  = { name, rows, cols, buttons: { [cellIndex]: { code, mods, action, notes } } }
```

`mods` is an ordered subset of `["Ctrl", "Alt", "Shift", "Meta"]` (absent/empty for a plain key; older saved data without it still works).

## Ideas / roadmap

- Duplicate-binding warnings
- Drag to rearrange cells; merged/wide cells
- Per-profile background image (e.g. a game's action bar screenshot)

## Maintaining this file

Update the **Current features**, **Behavior notes** and **Data model** sections whenever functionality changes, and move finished items off the "Ideas / roadmap" section into the "Completed" section

## Completed

- Key chords (e.g. Ctrl+Shift+X)
