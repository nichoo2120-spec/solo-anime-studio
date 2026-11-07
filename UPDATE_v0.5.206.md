# Solo Anime Studio 0.5.206

Fixes the confusing thick/thin editor entry in Brush Settings → Advanced. The heading previously displayed instructions without a clickable action. A working Edit thick/thin points button now closes Brush Settings, switches to Stroke Select, and automatically opens the editor after selecting one supported Ink stroke. The editor waits until the pen/mouse selection gesture is released. Escape or Cancel width selection cancels the handoff.

This is a navigation fix for the existing selected-stroke editor, not an additional brush feature. Direct access from the selection inspector is retained.

Validation starts from the Advanced button, clicks actual visible ink, verifies that the editor waits for pointer-up, then adds/drags/applies points, cancels/reopens, and checks Escape cancellation. Existing editor and full desktop checks remain enabled.
