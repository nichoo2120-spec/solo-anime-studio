# Solo Anime Studio v0.5.199

Projects now open in separate document tabs above the canvas controls. The × closes only that tab; Ctrl+W and File → Close Project do the same. Closing the last project returns to Project Home. The + creates another project, the folder button opens a saved project, and editable backup import accepts multiple files.

Each tab retains its drawings, active layer, undo/redo history and canvas view. Opening an already-open scene selects its existing tab. Save As opens an independent copy. Unsaved tabs offer Save, Don’t Save and Cancel; failed saves keep the project open. Closing Studio checks every open tab, and its Save choice saves inactive unsaved tabs too. Open tabs are protected from project-library deletion until closed.

Only one drawing engine is active; inactive tabs retain immutable document/history references rather than additional running canvases. Tab state is kept for the current Studio session. Saved project files and rendering formats are unchanged.

Validation: typecheck; document-history unit tests; browser checks for multiple backup imports, independent drawings/layers/undo/redo/zoom, active and inactive closes, Cancel/Don’t Save/Save, simulated storage failure, final-tab Home, saved reopen, and window-close Save across tabs. Project-tab checks also run in the Windows release workflow alongside the existing drawing and Mix regressions.
