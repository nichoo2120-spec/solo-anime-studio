# v0.5.181 Windows desktop update

Improves heavy drawing-frame switching by retaining recent rendered cels and reusing unchanged artwork after importing editable backups. Recent onion skin and flipbook previews stay available across switches. Large flipbook previews render when requested.

This release keeps the published Mix renderer and saved-stroke format. The first visit to a complex cel still has to render its artwork. The separate offline Solid and Soft Paint worker changes are outside this update.
