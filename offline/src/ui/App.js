import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "../../jsx-runtime.js";
import { createPortal } from '../../react-dom.js';
import { MirrorControls } from './MirrorControls.js';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, Fragment } from '../../react.js';
import { Plus, ChevronDown, ChevronRight, Folder, Layers, Copy, Trash2, Eye, EyeOff, Lock, Unlock, ArrowUp, ArrowDown, Undo2, Redo2, Maximize, RotateCcw, Settings, Download, Check, Keyboard, X, PanelLeftClose, PanelRightClose, Film, Play, Pause, Square, SkipBack, SkipForward, ChevronsLeft, ChevronsRight, SlidersHorizontal, Palette, Image as ImageIcon, Save, FolderOpen, Clock, MousePointer2, Maximize2, Minimize2, PanelLeftOpen, PanelRightOpen, Link2, MapPinned, Target } from '../../lucide.js';
import { AutosaveWriter } from '../core/AutosaveWriter.js';
import { ViewPreferences, documentDirty } from '../core/viewPreferences.js';
import { CameraViewState } from '../core/CameraViewState.js';
import { DocumentStore } from '../core/history.js';
import { addDrawingFrame, duplicateDrawingFrame, deleteDrawingFrame, selectDrawingFrame, adjacentFrame, frameList, currentFrameIndex, MAX_DRAWING_FRAMES, frameHold, frameExposureStart, totalExposureFrames, currentExposureRange, setDrawingFrameHold, setDrawingFrameHoldById, holdFromDrag, MAX_FRAME_HOLD, hasIndependentLayers, isLayerHeld, layerKeyStart, layerKeyEnd, setLayerHoldEnd, insertLayerKey, enableIndependentLayers } from '../animation/timeline.js';
import { sanitizeOnionSettings } from '../animation/onionSkin.js';
import { PlaybackOverlay } from '../engine/PlaybackOverlay.js';
import { playbackFps, PLAYBACK_FPS_MIN, PLAYBACK_FPS_MAX } from '../animation/playback.js';
import { activeLayer, duplicateLayer, editLayer, newLayer, newProject, removeLayer, reorderLayer, uid, validateProject } from '../core/model.js';
import { downloadBlob, downloadProject, importProject, repository } from '../core/persistence.js';
import { StudioEngine } from '../engine/StudioEngine.js';
import { ReferenceStudio } from './ReferenceStudio.js';
import { PngExport } from './PngExport.js';
import { SequenceExport } from './SequenceExport.js';
import { XsheetView } from './XsheetView.js';
import { SubstitutionShelf } from './SubstitutionShelf.js';
import { ReuseShelf } from './ReuseShelf.js';
import { AudioTrack } from './AudioTrack.js';
import { MotionPlanningPanel } from './MotionPlanningPanel.js';
import { MultiCelTransformPanel } from './MultiCelTransformPanel.js';
import { BatchCanvasTransform } from './BatchCanvasTransform.js';
import { ProgressiveScaleCanvas } from './ProgressiveScaleCanvas.js';
import { FloatingTransformPanel } from './FloatingTransformPanel.js';
import { TransformOverlay } from '../tools/transform/TransformOverlay.js';
import { progressiveScaleFrameFactors } from '../animation/progressiveScale.js';
import { polyline } from '../engine/strokeSelection.js';
import { toScreen } from '../core/geometry.js';
import { batchTransformCels } from '../animation/batchTransform.js';
import { MotionArcOverlay } from './MotionArcOverlay.js';
import { pickItems } from './multiSelection.js';
import { selectable, boundsOf } from '../engine/strokeSelection.js';
import { setCurrentTimingNote, createMotionArc, removeMotionArc, removeMotionArcPoint, activeLayerArtworkCenter, pruneMotionPlanning, bindArcStrokes, bindArcLayerRange, unbindArcFrame, alignBoundDrawingsToArc, editMotionPath, setMotionPathMode, createQuickMotionPath, addMotionControlDot, moveMotionControlDot, removeMotionControlDot } from '../animation/motionPlanning.js';
import { importSceneAudio, secondsAtExposure, exposureAtSeconds } from '../animation/audio.js';
import { exposurePlan, positionAtExposure } from '../animation/playback.js';
import { linkCurrentCelToFrame, unlinkCurrentCel, saveDrawingCycleRange, insertDrawingCycle, deleteDrawingCycle, cycleItems, linkedCount } from '../animation/reuse.js';
import { saveSubstitution, applySubstitution, renameSubstitution, deleteSubstitution, substitutionItems } from '../animation/substitutions.js';
import { SceneCameraOverlay, SceneCameraPanel } from './SceneCameraPanel.js';
import { cameraAt, setCameraKey } from '../animation/sceneCamera.js';
import { renderSequenceZip, sequencePlan } from '../animation/sequenceExport.js';
import { sanitizeLightTablePins, toggleLightTablePin, MAX_LIGHT_TABLE_PINS } from '../animation/lightTable.js';
import { ColorStudio } from './ColorStudio.js';
import { FillInspector } from './FillInspector.js';
import { RadialToolbar } from './RadialToolbar.js';
import { ShortcutEditor } from './ShortcutEditor.js';
import { DrawingDiagnostics } from './DrawingDiagnostics.js';
import { normalizeVectorMode } from '../engine/vectorMode.js';
import { DrawingBugRecorderPanel, BugRecordingIndicator } from './DrawingBugRecorder.js';
import { buildInfo } from '../core/buildInfo.js';
import { replayTrace } from '../engine/diagnosticReplay.js';
import { BrushStudio } from './BrushStudio.js';
import { ExactRange } from './ExactRange.js';
import { VectorStudio } from './VectorStudio.js';
import { activePreset, activeInputPreset, brushSupportsMix, restoreBrushLibrary, updatePreset } from '../core/brushes.js';
import { vectorSvg } from '../engine/vector.js';
import { toolRegistry, allTools } from './icons.js';
import { StudioStrokeSelectIcon, StudioLassoIcon, StudioFreeformIcon, StudioMoveIcon, StudioScaleIcon, StudioRotateObjectIcon, StudioPerspectiveIcon } from './StudioToolIcons.js';
import { initialShortcuts, normalizeShortcuts, keyChord } from '../core/shortcuts.js';
import { quickAction, timelineDeleteKey, steppedBrushSize, quickShortcutGuide } from '../core/keyboardActions.js';
import { readPreference, writePreference } from './preferences.js';
function IconButton({ label, onClick, disabled = false, children, active }) { return _jsx("button", { className: 'icon-button ' + (active ? 'selected' : ''), title: label, "aria-label": label, "aria-pressed": active, disabled: disabled, onClick: onClick, children: children }); }
function Range({ label, onChange, ...rest }) { return _jsx(ExactRange, { name: label, set: onChange, ...rest }); }
function Section({ title, icon, children, open = true }) { return _jsxs("details", { className: "inspector-section", open: open, children: [_jsxs("summary", { children: [icon, _jsx("span", { children: title }), _jsx(ChevronDown, { size: 13 })] }), _jsx("div", { className: "section-content", children: children })] }); }
function CameraZoom({ camera, engine }) { const view = useSyncExternalStore(camera.subscribe, camera.getSnapshot); return _jsxs("select", { "aria-label": "Canvas zoom", value: String(Math.round(view.zoom * 100)), onChange: e => engine?.zoomTo(+e.target.value / 100), children: [![25, 50, 75, 100, 150, 200, 400, 800].includes(Math.round(view.zoom * 100)) && _jsxs("option", { value: Math.round(view.zoom * 100), children: [Math.round(view.zoom * 100), "%"] }), [25, 50, 75, 100, 150, 200, 400, 800].map(n => _jsxs("option", { value: n, children: [n, "%"] }, n))] }); }
function CameraAngle({ camera, engine }) { const view = useSyncExternalStore(camera.subscribe, camera.getSnapshot); return _jsxs("label", { className: "rotation-control", children: [_jsx("input", { "aria-label": "Canvas rotation", type: "number", min: "-180", max: "180", value: Math.round(view.rotation * 180 / Math.PI), onChange: e => engine?.rotate(Math.max(-180, Math.min(180, +e.target.value))) }), "\u00B0"] }); }
function CameraPercent({ camera }) { const view = useSyncExternalStore(camera.subscribe, camera.getSnapshot); return _jsxs(_Fragment, { children: [Math.round(view.zoom * 100), "%"] }); }
export function App() {
    const [views] = useState(() => new ViewPreferences());
    const [engineReady, setEngineReady] = useState(null);
    const [workspaceMode, setWorkspaceMode] = useState('DRAW');
    const [focusMode, setFocusMode] = useState(false);
    const [timelineView, setTimelineView] = useState(() => readPreference('timeline-view', 'timeline') === 'xsheet' ? 'xsheet' : 'timeline');
    const [xsheetSide, setXsheetSide] = useState(() => readPreference('xsheet-side', 'right') === 'left' ? 'left' : 'right');
    const [xsheetWidth, setXsheetWidth] = useState(() => Math.max(220, Math.min(490, readPreference('xsheet-width', 310))));
    const xsheetDock = useRef(null);
    const workbench = useRef(null);
    const [onionSettings, setOnionSettings] = useState(() => sanitizeOnionSettings(readPreference('onion-settings', null)));
    const [onionSettingsOpen, setOnionSettingsOpen] = useState(false);
    const [lightTableOpen, setLightTableOpen] = useState(false);
    const [lightTablePins, setLightTablePins] = useState([]);
    const [sequenceBusy, setSequenceBusy] = useState(false), [sequenceProgress, setSequenceProgress] = useState(null);
    const sequenceAbort = useRef(null);
    const [motionToolsOpen, setMotionToolsOpen] = useState(false), [motionArcEditing, setMotionArcEditing] = useState(false), [activeMotionArcId, setActiveMotionArcId] = useState('');
    const [addingMotionDot, setAddingMotionDot] = useState(false), [selectedMotionDotId, setSelectedMotionDotId] = useState('');
    const motionPointEditDelegate = useRef(() => { });
    const motionPointEditCallback = useRef((arcId, frameId, x, y) => motionPointEditDelegate.current(arcId, frameId, x, y));
    const motionDotAddDelegate = useRef(() => { });
    const motionDotMoveDelegate = useRef(() => { });
    const motionDotAddCallback = useRef((arcId, x, y) => motionDotAddDelegate.current(arcId, x, y));
    const motionDotMoveCallback = useRef((arcId, dotId, dx, dy, frameId) => motionDotMoveDelegate.current(arcId, dotId, dx, dy, frameId));
    const [showPathDuringPlayback, setShowPathDuringPlayback] = useState(() => readPreference('motion-path-playback-show', false) === true);
    const [editPathWhilePlaying, setEditPathWhilePlaying] = useState(() => readPreference('motion-path-live-edit', false) === true);
    const [selectedFrames, setSelectedFrames] = useState({ ids: [], anchor: null });
    const [batchCanvasMode, setBatchCanvasMode] = useState(null);
    const [selectedLayers, setSelectedLayers] = useState({ ids: [], anchor: null });
    const [audioTrackOpen, setAudioTrackOpen] = useState(true), [audioMuted, setAudioMuted] = useState(() => readPreference('audio-muted', false)), [audioBusy, setAudioBusy] = useState(false);
    const audioElement = useRef(null);
    // Stable callbacks stop the 512-bar audio waveform controls from re-rendering
    // on every pen commit. Delegates are refreshed each App render so actions
    // still read the newest project/selection when actually clicked.
    const audioActionDelegates = useRef({ toggle: () => { }, importClip: () => { }, remove: () => { }, mute: () => { }, seek: () => { } });
    const audioActionCallbacks = useRef({
        toggle: () => audioActionDelegates.current.toggle(),
        importClip: (file) => audioActionDelegates.current.importClip(file),
        remove: () => audioActionDelegates.current.remove(),
        mute: (value) => audioActionDelegates.current.mute(value),
        seek: (seconds) => audioActionDelegates.current.seek(seconds)
    });
    // Stable props let large drawing inspector and Tool Wheel skip unrelated
    // document commits. The delegates are refreshed before each render so button
    // actions always use the latest application state.
    const panelDelegates = useRef({ brushChange: () => { }, choose: () => { }, notice: () => { } });
    const stablePanelHandlers = useRef({
        brushChange: (next) => panelDelegates.current.brushChange(next),
        choose: (value) => panelDelegates.current.choose(value),
        notice: (value) => panelDelegates.current.notice(value)
    });
    const [flipPreview, setFlipPreview] = useState(null);
    const [holdPreview, setHoldPreview] = useState(null);
    const holdDrag = useRef(null);
    const suppressCelSelect = useRef(null);
    const [layerHoldPreview, setLayerHoldPreview] = useState(null);
    const layerHoldDrag = useRef(null);
    const suppressLayerClick = useRef(false);
    const [playbackUpdate, setPlaybackUpdate] = useState({ state: 'stopped', exposure: 1, celIndex: 0 });
    const [fps, setFps] = useState(() => playbackFps(readPreference('playback-fps', 24)));
    const [loop, setLoop] = useState(() => readPreference('playback-loop', true) !== false);
    const playback = useRef(null);
    const timelineTrack = useRef(null);
    const [autosaveWriter] = useState(() => new AutosaveWriter()), [store] = useState(() => new DocumentStore(newProject())), doc = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const noteFrameIds = useMemo(() => new Set(doc.motionPlanning?.notes.map(n => n.frameId) ?? []), [doc.motionPlanning?.notes]);
    const canvas = useRef(null), workspace = useRef(null), engine = useRef(null), fileInput = useRef(null);
    const [, setMirrorRevision] = useState(0);
    const [tool, setTool] = useState('brush'), [brushLibrary, publishBrushLibrary] = useState(() => restoreBrushLibrary(readPreference('brush-library', null))), [, setView] = useState({ x: 0, y: 0, zoom: 1, rotation: 0 });
    const [camera] = useState(() => new CameraViewState()), view = camera.getSnapshot(), cameraOverlayNeeded = useRef(false);
    const brush = activePreset(brushLibrary, tool === 'eraser').settings, drawingColor = activePreset(brushLibrary).settings.color;
    const toolIntent = useRef(tool), libraryIntent = useRef(brushLibrary);
    function syncInput(t, library) { const p = activeInputPreset(library, t === 'eraser'); engine.current?.setInput(t, p.settings, { id: p.id, name: p.name }); }
    const setBrushLibrary = (next) => { const value = typeof next === 'function' ? next(libraryIntent.current) : next; libraryIntent.current = value; syncInput(toolIntent.current, value); publishBrushLibrary(value); };
    const setBrush = (next) => setBrushLibrary(old => { const p = activePreset(old, toolIntent.current === 'eraser'); return updatePreset(old, p.id, { ...p.settings, ...next }); });
    const setDrawingColor = (color) => setBrushLibrary(old => { const p = activePreset(old); return updatePreset(old, p.id, { ...p.settings, color }); });
    const [vectorId, setVectorId] = useState(null), [smoothingActive, setSmoothingActive] = useState(false), [postAmount, setPostAmount] = useState(50);
    const [vectorDefaults, setVectorDefaults] = useState(() => { const fallback = { width: 5, opacity: 1, pressure: true, mode: 'freehand', smoothness: 65, stabilization: 12, minWidthPercent: 20, maxWidthPercent: 100, taperStart: 0, taperEnd: 0 }, saved = readPreference('vector-settings-solid-ink', fallback); const clamp = (v, d) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : d; return { ...fallback, ...saved, width: typeof saved.width === 'number' && Number.isFinite(saved.width) ? Math.max(.5, Math.min(150, saved.width)) : fallback.width, minWidthPercent: typeof saved.minWidthPercent === 'number' ? Math.max(1, Math.min(100, saved.minWidthPercent)) : fallback.minWidthPercent, maxWidthPercent: typeof saved.maxWidthPercent === 'number' ? Math.max(10, Math.min(200, saved.maxWidthPercent)) : fallback.maxWidthPercent, taperStart: typeof saved.taperStart === 'number' ? Math.max(0, Math.min(1, saved.taperStart)) : fallback.taperStart, taperEnd: typeof saved.taperEnd === 'number' ? Math.max(0, Math.min(1, saved.taperEnd)) : fallback.taperEnd, smoothness: clamp(saved.smoothness, fallback.smoothness), stabilization: clamp(saved.stabilization, fallback.stabilization), mode: normalizeVectorMode(saved.mode) }; });
    const transformHotkeyRef = useRef(null);
    const [advancedStrokeTransform, setAdvancedStrokeTransform] = useState(false);
    const [areaTransformMode, setAreaTransformMode] = useState('freeform');
    const [strokeCount, setStrokeCount] = useState(0), [strokeMode, setStrokeMode] = useState('select'), [freeformCornerMode, setFreeformCornerMode] = useState('scale'), [strokePickMode, setStrokePickMode] = useState('touch'), [strokeShape, setStrokeShape] = useState('lasso'), [strokeScope, setStrokeScope] = useState('current');
    const [hasSelection, setHasSelection] = useState(false), [busy, setBusy] = useState(false), [transform, setTransform] = useState({ dx: 0, dy: 0, scale: 1, angle: 0 });
    const [layout, setLayout] = useState(() => { const p = readPreference('layout', { left: 232, right: 280, bottom: 184, leftClosed: false, rightClosed: false, bottomClosed: false }); const migrated = readPreference('workspace-compact-initialized', false); return { ...p, left: Math.max(180, Math.min(300, Number(p.left) || 232)), right: Math.max(240, Math.min(340, Number(p.right) || 280)), bottom: migrated ? Math.max(110, Math.min(500, Number(p.bottom) || 184)) : 184 }; });
    const [shortcuts, setShortcuts] = useState(() => normalizeShortcuts(readPreference('shortcuts', initialShortcuts)));
    const [fillSettings, setFillSettings] = useState(() => { const s = readPreference('fill-settings', { reference: 'current', lineLayerId: '', gap: 0, expansion: 0 }); return { reference: ['current', 'visible', 'line'].includes(s.reference) ? s.reference : 'current', lineLayerId: typeof s.lineLayerId === 'string' ? s.lineLayerId : '', gap: Math.max(0, Math.min(10, s.gap || 0)), expansion: Math.max(0, Math.min(5, s.expansion || 0)) }; });
    const [fillQuestion, setFillQuestion] = useState(null);
    const [message, setMessage] = useState(''), [menu, setMenu] = useState(''), [modal, setModal] = useState(''), [name, setName] = useState(''), [resolution, setResolution] = useState('1920x1080');
    const [menuAnchor, setMenuAnchor] = useState({ left: 8, top: 40 });
    const menuButton = useRef(null), menuPopup = useRef(null);
    useEffect(() => { if (!menu)
        return; menuPopup.current?.querySelector('button:not(:disabled)')?.focus(); const close = () => setMenu(''); window.addEventListener('resize', close); return () => window.removeEventListener('resize', close); }, [menu]);
    const [records, setRecords] = useState([]), [snapshots, setSnapshots] = useState([]), [status, setStatus] = useState('New project'), [lastSaved, setLastSaved] = useState('');
    const [deleteSelection, setDeleteSelection] = useState([]), [deletingProjects, setDeletingProjects] = useState(false);
    const [linkTargetFrameId, setLinkTargetFrameId] = useState(''), [rightTab, setRightTab] = useState('inspector'), [renameId, setRenameId] = useState(''), [renameValue, setRenameValue] = useState('');
    const saved = useRef(doc), saveChain = useRef(Promise.resolve()), pendingSaves = useRef(0), mounted = useRef(true), initialCheck = useRef(false), operationLock = useRef(false);
    useEffect(() => () => autosaveWriter.dispose(), [autosaveWriter]);
    const autosaveRetry = useRef(null);
    useEffect(() => () => { if (autosaveRetry.current)
        clearTimeout(autosaveRetry.current); autosaveRetry.current = null; }, []);
    const notify = (text) => setMessage(text);
    const toggleMixMode = (explicit) => { if (operationLock.current || engine.current?.drawing)
        return; setBrushLibrary(old => { const preset = activePreset(old, false); if (!brushSupportsMix(preset)) {
        notify('Mix mode is only available for drawing brushes.');
        return old;
    } const mode = explicit ?? (old.mode === 'mix' ? 'paint' : 'mix'); return { ...old, mode }; }); };
    const chooseTool = (t) => { if (operationLock.current)
        return; if (t === 'transform') {
        setRightTab('inspector');
        setLayout(old => ({ ...old, rightClosed: false }));
    } setAdvancedStrokeTransform(false); setAddingMotionDot(false); toolIntent.current = t; syncInput(t, libraryIntent.current); setTool(t); if (t === 'stroke-select')
        engine.current?.setStrokeMode('select'); };
    useEffect(() => { mounted.current = true; const e = new StudioEngine(canvas.current, store, notify); engine.current = e; setEngineReady(e); syncInput(toolIntent.current, libraryIntent.current); e.confirmFill = message => new Promise(resolve => setFillQuestion({ message, resolve })); e.onMirrorChange = () => { writePreference('mirror-drawing', e.mirrorDrawing); setMirrorRevision(v => v + 1); }; const mirrorSaved = readPreference('mirror-drawing', null); if (mirrorSaved && typeof mirrorSaved === 'object') {
        if (['vertical', 'horizontal'].includes(mirrorSaved.axis))
            e.mirrorDrawing.axis = mirrorSaved.axis;
        for (const key of ['enabled', 'showLine', 'lockCenter'])
            if (typeof mirrorSaved[key] === 'boolean')
                e.mirrorDrawing[key] = mirrorSaved[key];
        if (Number.isFinite(mirrorSaved.pivot?.x) && Number.isFinite(mirrorSaved.pivot?.y))
            e.mirrorDrawing.pivot = { x: Math.max(0, Math.min(1, mirrorSaved.pivot.x)), y: Math.max(0, Math.min(1, mirrorSaved.pivot.y)) };
    } e.onLoad = p => { saved.current = p; }; e.restoreView = p => views.read(p); e.onView = v => { camera.publish(v); if (cameraOverlayNeeded.current)
        setView(v); playback.current?.setView(v); views.remember(store.getSnapshot(), v); }; e.onTransform = setTransform; e.onStrokeSelection = setStrokeCount; e.onStrokeMode = setStrokeMode; e.onColor = setDrawingColor; e.vectors.onSelect = setVectorId; e.smoothing.onChange = setSmoothingActive; e.onSelection = has => { setHasSelection(has); if (!has)
        setTransform({ dx: 0, dy: 0, scale: 1, angle: 0 }); }; e.onBusy = b => { operationLock.current = b; setBusy(b); }; e.fit(); const diagnostics = { recorder: { start: () => e.recorder.start(), pause: () => e.recorder.pause(), resume: () => e.recorder.resume(), stop: () => e.recorder.stop(), status: () => e.recorder.getSnapshot(), export: () => e.recorder.export() }, build: buildInfo, status: () => e.diagnosticSnapshot(), replay: replayTrace, performance: { start: () => e.performance.start(), stop: () => e.performance.stop(), export: () => e.performance.export() }, start: () => e.diagnostics.start(), stop: () => e.diagnostics.stop(), clear: () => e.diagnostics.clear(), export: () => e.diagnostics.export(), download: () => downloadBlob(new Blob([JSON.stringify(e.diagnostics.export(), null, 2)], { type: 'application/json' }), 'solo-stroke-traces.json') }; window.soloStrokeDiagnostics = diagnostics; return () => { mounted.current = false; e.dispose(); engine.current = null; delete window.soloStrokeDiagnostics; }; }, [store]);
    useEffect(() => { const flush = () => views.flush(); window.addEventListener('pagehide', flush); window.addEventListener('beforeunload', flush); return () => { flush(); window.removeEventListener('pagehide', flush); window.removeEventListener('beforeunload', flush); }; }, [views]);
    useEffect(() => { const outside = (event) => { const target = event.target; if (!target.closest?.('.studio,.main-menu-layer') || target.getAttribute('aria-label') === 'Drawing canvas')
        return; engine.current?.controlContact(event); engine.current?.recorder.event('studio-control-contact', { pointerId: event.pointerId, pointerType: event.pointerType, button: event.button, control: target.closest('button')?.getAttribute('aria-label') ?? target.getAttribute('aria-label') ?? target.tagName }); }; document.addEventListener('pointerdown', outside, true); return () => document.removeEventListener('pointerdown', outside, true); }, []);
    useEffect(() => { setFlipPreview(null); }, [doc.id, doc.animation?.activeFrameId]);
    useEffect(() => { setLightTablePins(sanitizeLightTablePins(store.getSnapshot(), readPreference('light-table:' + doc.id, []))); }, [doc.id, store]);
    // The active frame's stroke operations change on pen commits, but the list of
    // frame IDs does not. Only prune obsolete pins when the timeline itself changes.
    const lightTableFrameIds = doc.animation?.frames.map(frame => frame.id).join('|') ?? 'legacy-first-frame';
    const motionFrameIds = useMemo(() => frameList(doc).map(f => f.id), [lightTableFrameIds]);
    // v0.5.174 scene camera playhead: any exposure, including the middle of a hold.
    const cameraPlan = useMemo(() => sequencePlan(doc), [doc.animation]);
    const activeCameraFrameId = doc.animation?.activeFrameId ?? '';
    const [cameraExposureState, setCameraExposure] = useState(1);
    const cameraRange = cameraPlan.filter(i => i.frameId === activeCameraFrameId);
    const cameraExposure = !doc.animation ? 1 : cameraRange.some(i => i.number === cameraExposureState) ? cameraExposureState : (cameraRange[0]?.number ?? 1);
    const frameSelectionSet = useMemo(() => new Set(selectedFrames.ids.filter(id => motionFrameIds.includes(id))), [selectedFrames.ids, motionFrameIds]);
    const layerIdsKey = doc.layers.map(item => item.id).join('|');
    const layerIds = useMemo(() => layerIdsKey.split('|'), [layerIdsKey]);
    const layerSelectionSet = useMemo(() => new Set(selectedLayers.ids.filter(id => layerIds.includes(id))), [selectedLayers.ids, layerIds]);
    // Never inspect all drawing cels during normal pen work. Only calculate a
    // transform box after a multi-frame selection activates a canvas tool.
    const multiCelAvailable = workspaceMode === 'ANIMATE' && frameSelectionSet.size >= 2;
    const batchCanvasBounds = useMemo(() => {
        if (!batchCanvasMode || batchCanvasMode === 'depth' || !multiCelAvailable)
            return null;
        const frameIds = selectedFrames.ids.filter(id => motionFrameIds.includes(id));
        const chosenLayerIds = selectedLayers.ids.length ? selectedLayers.ids : [doc.activeLayerId];
        for (const frameId of [doc.animation?.activeFrameId, ...frameIds]) {
            const frame = doc.animation?.frames.find(f => f.id === frameId);
            if (!frame)
                continue;
            const ops = chosenLayerIds.flatMap(id => frame.drawings[id] ?? []);
            const extent = boundsOf(ops.filter(op => op.kind === 'stroke' || op.kind === 'vector'));
            if (extent)
                return { x: extent.x, y: extent.y, w: Math.max(extent.w, 2), h: Math.max(extent.h, 2) };
        }
        return null;
    }, [batchCanvasMode, multiCelAvailable, doc.animation, doc.activeLayerId, selectedFrames.ids, selectedLayers.ids, motionFrameIds]);
    // Only sample preview geometry while Depth Scale is OPEN. Never during normal pen work.
    const depthPreviewFrames = useMemo(() => {
        if (batchCanvasMode !== 'depth' || !multiCelAvailable || !doc.animation)
            return [];
        const selected = new Set(selectedFrames.ids), chosenLayers = selectedLayers.ids.length ? selectedLayers.ids : [doc.activeLayerId];
        const sampled = [];
        let previewOps = 0, previewPoints = 0;
        for (const [index, frame] of doc.animation.frames.entries()) {
            if (!selected.has(frame.id))
                continue;
            const ops = chosenLayers.flatMap(id => frame.drawings[id] ?? []).filter(op => op.kind === 'stroke' || op.kind === 'vector');
            const b = boundsOf(ops);
            if (!b)
                continue;
            const paths = [];
            for (const op of ops) {
                if (previewOps >= 420 || previewPoints >= 14000)
                    break;
                const points = polyline(op), step = Math.max(1, Math.ceil(points.length / 120));
                const sampledPoints = points.filter((_, i) => i % step === 0 || i === points.length - 1).map(p => toScreen(p, view));
                if (!sampledPoints.length)
                    continue;
                paths.push({ d: sampledPoints.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '), width: op.kind === 'stroke' ? op.size : op.width });
                previewOps++;
                previewPoints += sampledPoints.length;
            }
            sampled.push({ id: frame.id, order: index, number: index + 1, bounds: { x: b.x, y: b.y, w: Math.max(b.w, 2), h: Math.max(b.h, 2) }, paths });
        }
        return sampled;
    }, [batchCanvasMode, multiCelAvailable, doc.animation, doc.activeLayerId, selectedFrames.ids, selectedLayers.ids, view.x, view.y, view.zoom, view.rotation]);
    const playbackIsRunning = ['preparing', 'playing', 'buffering'].includes(playbackUpdate.state);
    const pathVisible = !playbackIsRunning || showPathDuringPlayback;
    const pathEditable = motionArcEditing && (!playbackIsRunning || editPathWhilePlaying);
    cameraOverlayNeeded.current = tool === 'transform' || tool === 'stroke-select' && advancedStrokeTransform || multiCelAvailable && !!batchCanvasMode || motionToolsOpen && rightTab === 'motion' && workspaceMode === 'ANIMATE' && pathVisible;
    function selectFrameWithModifier(id, shift = false, alt = false) { if (!shift && !alt)
        setBatchCanvasMode(null); setSelectedFrames(previous => pickItems(motionFrameIds, previous, id, shift, alt)); }
    function selectLayerWithModifier(id, shift = false, alt = false) { setSelectedLayers(previous => pickItems(layerIds, previous, id, shift, alt)); }
    useEffect(() => { writePreference('motion-path-playback-show', showPathDuringPlayback); }, [showPathDuringPlayback]);
    useEffect(() => { writePreference('motion-path-live-edit', editPathWhilePlaying); }, [editPathWhilePlaying]);
    useEffect(() => {
        setLightTablePins(previous => {
            const cleaned = sanitizeLightTablePins(store.getSnapshot(), previous);
            const unchanged = previous.length === cleaned.length && cleaned.every((pin, i) => pin.frameId === previous[i].frameId);
            return unchanged ? previous : cleaned;
        });
    }, [lightTableFrameIds, store]);
    useEffect(() => { const cleaned = sanitizeLightTablePins(doc, lightTablePins); engine.current?.onion.setPins(cleaned); writePreference('light-table:' + doc.id, cleaned); }, [doc.id, lightTablePins]);
    // Playback is a read-only overlay. Never change project frames to show previews.
    useEffect(() => {
        if (!workspace.current)
            return;
        const instance = new PlaybackOverlay(workspace.current, store.getSnapshot(), setPlaybackUpdate, notify);
        playback.current = instance;
        instance.setView(engine.current?.view ?? { x: 0, y: 0, zoom: 1, rotation: 0 });
        return () => { instance.dispose(); if (playback.current === instance)
            playback.current = null; };
    }, [store]);
    useEffect(() => { playback.current?.update(doc); }, [doc]);
    // Audio element is stable for the app lifetime. Swapping frames or drawing strokes
    // never decodes audio, recreates an element, or recalculates the waveform.
    useEffect(() => {
        const element = new Audio();
        element.preload = 'auto';
        audioElement.current = element;
        playback.current?.attachAudio(element);
        return () => { element.pause(); element.removeAttribute('src'); element.load(); playback.current?.attachAudio(null); if (audioElement.current === element)
            audioElement.current = null; };
    }, []);
    useEffect(() => { const element = audioElement.current; if (!element)
        return; element.pause(); if (doc.audio) {
        element.src = doc.audio.data;
        element.load();
    }
    else {
        element.removeAttribute('src');
        element.load();
    } }, [doc.audio?.data]);
    useEffect(() => { if (audioElement.current)
        audioElement.current.muted = audioMuted; writePreference('audio-muted', audioMuted); }, [audioMuted]);
    useEffect(() => { const media = audioElement.current; if (!media || !doc.audio || playback.current?.running)
        return; const sec = secondsAtExposure(currentExposureRange(doc).start, fps); if (Number.isFinite(sec))
        try {
            media.currentTime = Math.min(sec, doc.audio.duration);
        }
        catch { /* audio still loading */ } }, [doc.id, doc.animation?.activeFrameId, doc.audio?.data, fps]);
    useEffect(() => { writePreference('playback-fps', fps); writePreference('playback-loop', loop); playback.current?.configure(fps, loop); }, [fps, loop]);
    useEffect(() => { const visibility = () => { if (document.hidden)
        playback.current?.pause(); }; document.addEventListener('visibilitychange', visibility); return () => document.removeEventListener('visibilitychange', visibility); }, []);
    useEffect(() => { writePreference('layout', layout); writePreference('workspace-compact-initialized', true); }, [layout]);
    useEffect(() => { writePreference('timeline-view', timelineView); }, [timelineView]);
    useEffect(() => { writePreference('xsheet-side', xsheetSide); writePreference('xsheet-width', xsheetWidth); }, [xsheetSide, xsheetWidth]);
    useEffect(() => { writePreference('fill-settings', fillSettings); if (engine.current)
        engine.current.fillSettings = fillSettings; }, [fillSettings]);
    useEffect(() => { writePreference('shortcuts', shortcuts); }, [shortcuts]);
    useEffect(() => { writePreference('brush-library', brushLibrary); }, [brushLibrary]);
    useEffect(() => { writePreference('onion-settings', onionSettings); engine.current?.onion.setSettings(onionSettings); }, [onionSettings]);
    useEffect(() => { writePreference('vector-settings-solid-ink', vectorDefaults); if (engine.current)
        Object.assign(engine.current.vectors, vectorDefaults); }, [vectorDefaults]);
    useEffect(() => {
        if (!initialCheck.current) {
            initialCheck.current = true; // v0.5.176: open the last project directly; only read the full project list when it is missing.
            const lastId = readPreference('last-project', null);
            (lastId ? repository.get(lastId).catch(() => undefined) : Promise.resolve(undefined)).then(async (direct) => { const list = direct ? [direct] : await repository.list(); if (!direct)
                setRecords(list); if (!list.length)
                return; const record = list.find(r => r.id === lastId) ?? list[0], e = engine.current; if (e && store.revision === 0 && !e.drawing) {
                validateProject(record.project);
                if (await e.load(record.project, 0)) {
                    saved.current = record.project;
                    setStatus('Opened local project');
                    setLastSaved(record.savedAt);
                    writePreference('last-project', record.id);
                }
            } }).catch(e => notify('Saved work remains in local storage; could not automatically reopen it: ' + String(e)));
        }
    }, []);
    useEffect(() => { if (!message)
        return; const timer = setTimeout(() => setMessage(''), 7000); return () => clearTimeout(timer); }, [message]);
    async function save(kind = 'manual') {
        if (kind === 'autosave')
            await new Promise(resolve => { if ('requestIdleCallback' in window)
                window.requestIdleCallback(() => resolve(), { timeout: 1000 });
            else
                setTimeout(resolve, 16); });
        if (!mounted.current)
            return;
        if (operationLock.current || engine.current?.drawing || kind === 'autosave' && pendingSaves.current > 0) {
            if (kind === 'manual')
                notify('Finish the current canvas operation before saving.');
            else {
                if (autosaveRetry.current)
                    clearTimeout(autosaveRetry.current);
                autosaveRetry.current = setTimeout(() => { autosaveRetry.current = null; if (mounted.current && documentDirty(store.getSnapshot(), saved.current))
                    void save('autosave'); }, 1000);
            }
            return;
        }
        if (autosaveRetry.current) {
            clearTimeout(autosaveRetry.current);
            autosaveRetry.current = null;
        }
        const captured = store.getSnapshot();
        pendingSaves.current++;
        setStatus('Saving…');
        const task = saveChain.current.catch(() => { }).then(() => kind === 'autosave' ? autosaveWriter.save(captured) : repository.save(captured, kind));
        saveChain.current = task;
        try {
            const record = await task;
            if (store.getSnapshot().id === captured.id) {
                saved.current = captured;
                writePreference('last-project', captured.id);
                if (mounted.current) {
                    setLastSaved(record.savedAt);
                    setStatus(!documentDirty(store.getSnapshot(), captured) ? (kind === 'autosave' ? 'Autosaved locally' : 'Saved locally') : 'Unsaved changes');
                    if (kind === 'manual')
                        notify('Project saved on this device. Download a backup for safekeeping.');
                }
            }
        }
        catch (e) {
            if (mounted.current) {
                if (store.getSnapshot().id === captured.id)
                    setStatus('Save failed');
                notify('Save failed for “' + captured.name + '”. Previous successful saves remain intact. ' + String(e));
            }
        }
        finally {
            pendingSaves.current--;
        }
    }
    useEffect(() => { if (!documentDirty(doc, saved.current))
        return; const timer = setTimeout(() => { if (documentDirty(store.getSnapshot(), saved.current))
        void save('autosave'); }, 2500); return () => clearTimeout(timer); }, [doc]);
    useEffect(() => { const before = (e) => { if (documentDirty(store.getSnapshot(), saved.current) || engine.current?.drawing || pendingSaves.current || engine.current?.recorder.warnOnClose) {
        e.preventDefault();
        e.returnValue = '';
    } }; window.addEventListener('beforeunload', before); return () => window.removeEventListener('beforeunload', before); }, [store]);
    function discard() { return !engine.current?.drawing && !documentDirty(doc, saved.current) || window.confirm('There are unsaved changes or an active stroke. Continue and discard those changes?'); }
    async function openProject(p) { if (!discard())
        return; try {
        if (operationLock.current)
            return;
        validateProject(p);
        engine.current.cancelGesture();
        if (!await engine.current.load(p)) {
            notify('Project opening was canceled because the current document changed.');
            return;
        }
        saved.current = p;
        writePreference('last-project', p.id);
        if (modal === 'recover')
            writePreference('onboarding-dismissed', true);
        setLastSaved('');
        setStatus('Opened local project');
        setModal('');
    }
    catch (e) {
        notify('Could not open project: ' + String(e));
    } }
    function closeModal() { if (sequenceBusy) {
        sequenceAbort.current?.abort();
        return;
    } if (modal === 'recover')
        writePreference('onboarding-dismissed', true); setModal(''); }
    async function showOnboarding() { try {
        setDeleteSelection([]);
        setRecords(await repository.list());
        setModal('recover');
    }
    catch (e) {
        notify('Could not read saved projects: ' + String(e));
    } }
    async function listProjects() { try {
        setDeleteSelection([]);
        setRecords(await repository.list());
        setModal('open');
    }
    catch (e) {
        notify('Could not read projects: ' + String(e));
    } }
    async function showSnapshots() { try {
        setSnapshots(await repository.snapshots(doc.id));
        setModal('snapshots');
    }
    catch (e) {
        notify('Could not read snapshots: ' + String(e));
    } }
    function toggleProjectForDeletion(id, checked) {
        if (id === store.getSnapshot().id)
            return;
        setDeleteSelection(previous => checked ? [...new Set([...previous, id])] : previous.filter(item => item !== id));
    }
    async function deleteSelectedProjects() {
        if (deletingProjects || operationLock.current || engine.current?.drawing)
            return;
        const activeId = store.getSnapshot().id;
        const ids = deleteSelection.filter(id => id !== activeId && records.some(record => record.id === id));
        if (!ids.length) {
            notify('Select one or more inactive projects. Switch to another project to delete the one currently open.');
            return;
        }
        const labels = records.filter(record => ids.includes(record.id)).map(record => record.project.name);
        const preview = labels.slice(0, 5).join(', ') + (labels.length > 5 ? ` and ${labels.length - 5} more` : '');
        if (!window.confirm(`Permanently delete ${ids.length} local project${ids.length === 1 ? '' : 's'} and their recovery snapshots?\n\n${preview}\n\nThis cannot be undone. Download any backups you need first.`))
            return;
        setDeletingProjects(true);
        try {
            // Finish any already queued autosaves before deleting old records, so a stale write cannot restore them.
            await saveChain.current.catch(() => { });
            if (ids.includes(store.getSnapshot().id)) {
                notify('The current project cannot be deleted while it is open.');
                return;
            }
            const removed = await repository.deleteProjects(ids);
            if (ids.includes(readPreference('last-project', '')))
                writePreference('last-project', store.getSnapshot().id);
            for (const id of ids) {
                try {
                    localStorage.removeItem('solo:view:' + id);
                }
                catch { /* Optional view preference. */ }
            }
            setRecords(await repository.list());
            setDeleteSelection([]);
            notify(`Deleted ${removed} local project${removed === 1 ? '' : 's'} and their recovery snapshots.`);
        }
        catch (e) {
            notify('Could not delete projects. Existing saved work is protected: ' + String(e));
            try {
                setRecords(await repository.list());
            }
            catch { /* Keep current list. */ }
        }
        finally {
            setDeletingProjects(false);
        }
    }
    function startNew() { setName('Untitled scene'); setResolution('1920x1080'); setModal('new'); }
    async function submitProject() {
        if (!name.trim())
            return;
        if (modal === 'new') {
            if (!discard())
                return;
            const [w, h] = resolution.split('x').map(Number);
            const p = newProject(name.trim(), w, h);
            await openProjectWithoutConfirm(p);
        }
        else if (modal === 'saveas') {
            const p = { ...doc, id: uid(), name: name.trim(), createdAt: new Date().toISOString() };
            setLastSaved('');
            store.replace(p);
            setModal('');
            await save();
        }
        else if (modal === 'rename') {
            store.commit({ ...doc, name: name.trim() });
            setModal('');
        }
    }
    async function openProjectWithoutConfirm(p) { try {
        engine.current.cancelGesture();
        if (!await engine.current.load(p)) {
            notify('Project opening was canceled because the document changed.');
            return;
        }
        saved.current = p;
        setLastSaved('');
        setStatus('New project');
        setModal('');
    }
    catch (e) {
        notify(String(e));
    } }
    function commit(p) { if (operationLock.current)
        return; engine.current?.cancelGesture(); engine.current?.clearSelection(); store.commit(p); }
    function animationAction(action) {
        playback.current?.stop();
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish drawing before changing animation frames.');
            return;
        }
        const current = store.getSnapshot(), base = action === 'add' && !hasIndependentLayers(current) ? enableIndependentLayers(current) : current, next = action === 'add' ? addDrawingFrame(base) : action === 'duplicate' ? duplicateDrawingFrame(base) : deleteDrawingFrame(base);
        if (next === current) {
            notify(action === 'delete' ? 'At least one drawing frame is required.' : 'Maximum 240 drawing frames per scene.');
            return;
        }
        clearFlipPreview();
        engine.current?.cancelGesture();
        const committed = action === 'delete' ? pruneMotionPlanning(next) : next;
        store.commit(committed, action === 'add' ? 'Add drawing frame' : action === 'duplicate' ? 'Duplicate drawing frame' : 'Delete drawing frame');
        engine.current?.clearSelection();
        void engine.current?.renderer.prepare(committed).then(() => engine.current?.request()).catch(err => notify('Could not load frame artwork: ' + String(err)));
    }
    function changeHold(hold) {
        playback.current?.stop();
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish drawing before editing frame timing.');
            return;
        }
        const before = store.getSnapshot(), after = setDrawingFrameHold(before, hold);
        if (after === before)
            return;
        store.commit(after, 'Change frame hold');
    }
    /** A drag is only a local visual preview until pointer-up: one history entry, no pen rerender. */
    function changeHoldForCel(id, hold) {
        if (operationLock.current || engine.current?.drawing)
            return;
        const before = store.getSnapshot(), after = setDrawingFrameHoldById(before, id, hold);
        if (after === before)
            return;
        playback.current?.stop();
        store.commit(after, 'Resize frame exposure');
    }
    function cancelHoldDrag() {
        const drag = holdDrag.current;
        if (!drag)
            return;
        holdDrag.current = null;
        drag.el.style.cursor = 'pointer';
        if (drag.el.hasPointerCapture(drag.pointerId))
            drag.el.releasePointerCapture(drag.pointerId);
        setHoldPreview(null);
    }
    /** Click selects. Click-and-drag directly on a cel changes its exposure; no separate grip. */
    function beginHoldDrag(e, id, hold) {
        if (e.button !== 0 || e.shiftKey || e.altKey || operationLock.current || engine.current?.drawing || busy)
            return;
        cancelHoldDrag();
        suppressCelSelect.current = null;
        const el = e.currentTarget, rect = el.getBoundingClientRect();
        el.setPointerCapture(e.pointerId);
        holdDrag.current = { id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startHold: hold, nextHold: hold, edgeGrab: e.clientX >= rect.right - 12, dragging: false, el };
    }
    function moveHoldDrag(e) {
        const drag = holdDrag.current;
        if (!drag || drag.pointerId !== e.pointerId) {
            const rect = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.cursor = e.clientX >= rect.right - 12 ? 'ew-resize' : 'pointer';
            return;
        }
        const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
        if (!drag.dragging) {
            const threshold = drag.edgeGrab ? 3 : 7;
            if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.25)
                return;
            drag.dragging = true;
            playback.current?.stop();
            clearFlipPreview();
            e.currentTarget.style.cursor = 'ew-resize';
        }
        const next = holdFromDrag(drag.startHold, dx);
        if (next !== drag.nextHold) {
            drag.nextHold = next;
            setHoldPreview({ id: drag.id, hold: next });
        }
    }
    function finishHoldDrag(e, apply) {
        const drag = holdDrag.current;
        if (!drag || drag.pointerId !== e.pointerId)
            return;
        const { id, startHold, dragging } = drag;
        const final = apply && dragging ? holdFromDrag(startHold, e.clientX - drag.startX) : startHold;
        if (dragging)
            suppressCelSelect.current = id;
        cancelHoldDrag();
        if (apply && dragging && final !== startHold)
            changeHoldForCel(id, final);
    }
    function clickCel(e, id) {
        if (suppressCelSelect.current === id) {
            e.preventDefault();
            suppressCelSelect.current = null;
            return;
        }
        selectFrameWithModifier(id, e.shiftKey, e.altKey);
        goToDrawingFrame(id);
    }
    /** Layer exposure edits never touch the paint engine, but the active composed
     * frame may change. Refresh only after the one final Undo-able metadata change. */
    function commitLayerExposure(next, label) {
        if (operationLock.current || engine.current?.drawing || busy) {
            notify('Finish drawing before editing a layer hold.');
            return;
        }
        const before = store.getSnapshot();
        if (next === before)
            return;
        stopPlayback();
        clearFlipPreview();
        engine.current?.clearSelection();
        store.commit(next, label);
        void engine.current?.renderer.prepare(next).then(() => engine.current?.request()).catch(error => notify('Could not update layer preview: ' + String(error)));
    }
    function changeLayerHold(layerId, startId, endIndex) {
        commitLayerExposure(setLayerHoldEnd(store.getSnapshot(), layerId, startId, endIndex), 'Adjust ' + (store.getSnapshot().layers.find(l => l.id === layerId)?.name ?? 'layer') + ' exposure');
    }
    function newLayerKey(duplicate = true) {
        const p = store.getSnapshot(), frame = frameList(p)[currentFrameIndex(p)];
        if (!isLayerHeld(p, p.activeLayerId, frame.id)) {
            notify('This layer already has a key drawing at the current frame.');
            return;
        }
        commitLayerExposure(insertLayerKey(p, p.activeLayerId, frame.id, duplicate), duplicate ? 'Duplicate held cel as key' : 'Create blank layer key');
    }
    function stepLayer(delta) {
        const p = store.getSnapshot(), index = p.layers.findIndex(l => l.id === p.activeLayerId), next = p.layers[index + delta];
        if (next) {
            stopPlayback();
            engine.current?.clearSelection();
            store.select(next.id);
        }
    }
    function stepLayerHold(delta) {
        const p = store.getSnapshot(), i = currentFrameIndex(p), id = p.activeLayerId, frames = frameList(p);
        const start = layerKeyStart(p, id, i), end = layerKeyEnd(p, id, start);
        const target = Math.max(start, Math.min(frames.length - 1, end + delta));
        if (target !== end)
            changeLayerHold(id, frames[start].id, target);
    }
    function layerPointerDown(e, layerId, index) {
        if (e.button !== 0 || e.shiftKey || e.altKey || busy || operationLock.current || engine.current?.drawing)
            return;
        const p = store.getSnapshot(), frames = frameList(p);
        if (isLayerHeld(p, layerId, frames[index].id))
            return; // A held cel is selected or split, not resized.
        const el = e.currentTarget, row = el.parentElement;
        // Resolve hit positions ONCE, never run DOM layout reads on pen-move.
        let cursor = row.getBoundingClientRect().left + 8;
        const cellRightEdges = frames.map(frame => { cursor += 47 + 10 * (frameHold(frame) - 1); const right = cursor; cursor += 2; return right; });
        el.setPointerCapture(e.pointerId);
        const end = layerKeyEnd(p, layerId, index);
        layerHoldDrag.current = { layerId, pointerId: e.pointerId, startIndex: index, startX: e.clientX, startEnd: end, currentEnd: end, dragging: false, el, cellRightEdges };
        suppressLayerClick.current = false;
    }
    function layerPointerMove(e) {
        const drag = layerHoldDrag.current;
        if (!drag || drag.pointerId !== e.pointerId)
            return;
        const dx = e.clientX - drag.startX;
        if (!drag.dragging) {
            if (Math.abs(dx) < 7)
                return;
            drag.dragging = true;
            suppressLayerClick.current = true;
        }
        const targetIndex = drag.cellRightEdges.findIndex(right => e.clientX < right);
        let target = targetIndex < 0 ? drag.cellRightEdges.length - 1 : targetIndex;
        target = Math.max(drag.startIndex, Math.min(frameList(store.getSnapshot()).length - 1, target));
        // Pulling left from a previously extended key shortens it, too.
        if (dx < 0)
            target = Math.max(drag.startIndex, Math.min(drag.startEnd, target));
        if (drag.currentEnd !== target) {
            drag.currentEnd = target;
            setLayerHoldPreview({ layerId: drag.layerId, start: drag.startIndex, end: target });
        }
    }
    function finishLayerDrag(e, apply) {
        const drag = layerHoldDrag.current;
        if (!drag || drag.pointerId !== e.pointerId)
            return;
        layerHoldDrag.current = null;
        if (drag.el.hasPointerCapture(drag.pointerId))
            drag.el.releasePointerCapture(drag.pointerId);
        setLayerHoldPreview(null);
        if (apply && drag.dragging && drag.currentEnd !== drag.startEnd) {
            const frames = frameList(store.getSnapshot());
            changeLayerHold(drag.layerId, frames[drag.startIndex].id, drag.currentEnd);
        }
        // Prevent the synthetic click after a pen drag from changing the active frame.
        if (drag.dragging)
            window.setTimeout(() => { suppressLayerClick.current = false; }, 0);
    }
    function clickLayerFrame(e, layerId, frameId) {
        if (suppressLayerClick.current) {
            e.preventDefault();
            suppressLayerClick.current = false;
            return;
        }
        selectFrameWithModifier(frameId, e.shiftKey, e.altKey);
        selectLayerWithModifier(layerId, e.shiftKey, e.altKey);
        goToDrawingFrame(frameId);
        store.select(layerId);
    }
    function clearFlipPreview() { engine.current?.flipbook.preview(null); setFlipPreview(null); }
    function togglePlayback() {
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish drawing before animation playback.');
            return;
        }
        clearFlipPreview();
        if (playback.current?.running)
            playback.current.pause();
        else {
            // Unlock Chrome audio on the genuine Play click before asynchronous frame preparation.
            const media = audioElement.current;
            if (doc.audio && media) {
                void media.play().then(() => { if (playback.current?.snapshot.state === 'preparing')
                    media.pause(); }).catch(() => { });
            }
            void playback.current?.play();
        }
    }
    function stopPlayback() { playback.current?.stop(); }
    async function addSceneAudio(file) {
        if (audioBusy || operationLock.current || engine.current?.drawing)
            return notify('Finish the current drawing before importing audio.');
        setAudioBusy(true);
        try {
            const asset = await importSceneAudio(file);
            if (!mounted.current)
                return;
            const current = store.getSnapshot();
            if (current.id !== doc.id) {
                notify('Project changed during audio import. Import it again in the new project.');
                return;
            }
            stopPlayback();
            store.commit({ ...current, audio: asset }, 'Import scene audio');
            setAudioTrackOpen(true);
            setLayout(old => ({ ...old, bottom: Math.max(old.bottom, 240), bottomClosed: false }));
            notify(`Added ${asset.name} (${asset.duration.toFixed(1)}s) to this animation.`);
        }
        catch (error) {
            notify('Audio import failed: ' + String(error));
        }
        finally {
            if (mounted.current)
                setAudioBusy(false);
        }
    }
    function removeSceneAudio() { if (!store.getSnapshot().audio || !window.confirm('Remove audio from this scene? Undo can restore it.'))
        return; stopPlayback(); const current = store.getSnapshot(); store.commit({ ...current, audio: undefined }, 'Remove scene audio'); }
    function seekSceneAudio(seconds) {
        if (operationLock.current || engine.current?.drawing || playback.current?.running)
            return;
        stopPlayback();
        const current = store.getSnapshot(), position = positionAtExposure(exposurePlan(current), exposureAtSeconds(seconds, fps, totalExposureFrames(current)));
        const frame = frameList(current)[position.celIndex];
        if (frame)
            goToDrawingFrame(frame.id);
        // Frame holds are intentionally quantized to the current project FPS.
        const media = audioElement.current;
        if (media && Number.isFinite(media.duration))
            media.currentTime = Math.min(media.duration, secondsAtExposure(position.exposure, fps));
    }
    function toggleFlipPreview(direction) {
        stopPlayback();
        if (flipPreview === direction) {
            clearFlipPreview();
            return;
        }
        if (engine.current?.flipbook.preview(direction))
            setFlipPreview(direction);
    }
    // v0.5.174 scene camera helpers. Exposure number = 1-based, holds included.
    function commitCamera(next, label) { if (operationLock.current || engine.current?.drawing)
        return; store.commit(next, label); }
    function moveSceneCamera(x, y) { const p = store.getSnapshot(); if (!p.camera)
        return; const st = cameraAt(p.camera, cameraExposure, p.width, p.height), k = p.camera.keys.find(k => k.frame === cameraExposure); commitCamera({ ...p, camera: setCameraKey(p.camera, { frame: cameraExposure, ...st, x, y, ease: k?.ease ?? 'ease-in-out' }) }, 'Move camera'); }
    function goToCameraExposure(n) { const item = cameraPlan.find(i => i.number === n) ?? cameraPlan.at(-1); if (!item)
        return; setCameraExposure(item.number); if (doc.animation && item.frameId !== doc.animation.activeFrameId)
        goToDrawingFrame(item.frameId); }
    function goToDrawingFrame(id) {
        stopPlayback();
        if (operationLock.current || engine.current?.drawing)
            return;
        const next = selectDrawingFrame(store.getSnapshot(), id);
        if (next === store.getSnapshot())
            return;
        clearFlipPreview();
        engine.current?.cancelGesture();
        store.selectFrame(next);
        engine.current?.clearSelection();
        void engine.current?.renderer.prepare(next).then(() => engine.current?.request()).catch(err => notify('Could not load frame artwork: ' + String(err)));
    }
    function stepDrawingFrame(delta) { const next = adjacentFrame(store.getSnapshot(), delta); if (next !== store.getSnapshot() && next.animation)
        goToDrawingFrame(next.animation.activeFrameId); }
    function undo() { stopPlayback(); if (operationLock.current)
        return; engine.current?.historyNavigation('undo'); }
    function redo() { stopPlayback(); if (operationLock.current)
        return; engine.current?.historyNavigation('redo'); }
    async function editing(command) { const e = engine.current; if (!e || busy)
        return; if (e.drawing) {
        notify('Finish the current canvas operation first.');
        return;
    } if (['copy', 'cut', 'paste'].includes(command) && e.selection.length && (e.transform.dx || e.transform.dy || e.transform.angle || e.transform.scale !== 1 || (e.transform.scaleX ?? 1) !== 1 || (e.transform.scaleY ?? 1) !== 1)) {
        notify('Apply or cancel the transform preview before copying, cutting or pasting.');
        return;
    } if (e.strokeIds.length && ['copy', 'cut'].includes(command)) {
        e.strokeAction(command);
        return;
    } if (command === 'paste' && toolIntent.current === 'stroke-select') {
        e.strokeAction('paste');
        return;
    } if (command === 'merge' && frameList(store.getSnapshot()).length > 1) {
        notify('Merging across animation frames is not supported yet. Your artwork was not changed.');
        return;
    } if (command === 'all' && toolIntent.current === 'stroke-select') {
        e.selectAllStrokes();
    }
    else if (command === 'all') {
        e.editing.selectAll();
        chooseTool('transform');
    }
    else if (command === 'deselect')
        e.clearSelection();
    else if (command === 'cut' || command === 'copy')
        e.editing.copy(command === 'cut');
    else if (command === 'paste') {
        await e.editing.paste();
        if (e.selection.length)
            chooseTool('transform');
    }
    else if (command === 'merge')
        await e.editing.mergeDown();
    else
        e.editing.clear(); }
    function beginSaveAs() { setName(doc.name + ' copy'); setModal('saveas'); }
    function showExport() { if (!busy && !sequenceBusy)
        setModal('export'); }
    function toggleReferencePin() { const p = store.getSnapshot(), frame = frameList(p)[currentFrameIndex(p)], pins = sanitizeLightTablePins(p, lightTablePins); if (!pins.some(pin => pin.frameId === frame.id) && pins.length >= MAX_LIGHT_TABLE_PINS) {
        notify('The light table supports up to five pinned drawings.');
        return;
    } setLightTablePins(toggleLightTablePin(p, pins, frame.id)); }
    function toggleLightTablePanel() {
        setWorkspaceMode('ANIMATE');
        setFocusMode(false);
        setOnionSettingsOpen(false);
        setLayout(old => ({ ...old, bottomClosed: false }));
        setLightTableOpen(old => !old);
    }
    function resizeXsheetDock(e) {
        if (e.button !== 0 || !workbench.current || !xsheetDock.current)
            return;
        e.preventDefault();
        const target = e.currentTarget, startX = e.clientX, startWidth = xsheetWidth, pointerId = e.pointerId;
        const panel = xsheetDock.current;
        target.setPointerCapture(pointerId);
        let pending = startWidth;
        const move = (event) => {
            if (event.pointerId !== pointerId)
                return;
            const sign = xsheetSide === 'right' ? -1 : 1;
            pending = Math.max(220, Math.min(490, startWidth + sign * (event.clientX - startX)));
            panel.style.width = pending + 'px';
        };
        const end = (event) => {
            if (event.pointerId !== pointerId)
                return;
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', end);
            target.removeEventListener('pointercancel', end);
            if (target.hasPointerCapture(pointerId))
                target.releasePointerCapture(pointerId);
            panel.style.width = '';
            if (event.type === 'pointerup')
                setXsheetWidth(pending);
        };
        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', end);
        target.addEventListener('pointercancel', end);
    }
    function openSubstitutionShelf() {
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish drawing before opening the shelf.');
            return;
        }
        stopPlayback();
        setWorkspaceMode('ANIMATE');
        setFocusMode(false);
        setRightTab('substitutions');
        setLayout(old => ({ ...old, rightClosed: false }));
    }
    function captureSubstitution(name, category, selection) {
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish the current stroke before saving a substitution.');
            return false;
        }
        const p = store.getSnapshot();
        try {
            const ids = selection ? [...(engine.current?.strokeIds ?? [])] : undefined;
            if (selection && !ids?.length) {
                notify('First select the strokes with S, then save selection.');
                return false;
            }
            const next = saveSubstitution(p, name, category, ids);
            store.commit(next, 'Save drawing substitution');
            notify('“' + name.trim() + '” saved in this project shelf.');
            return true;
        }
        catch (error) {
            notify(String(error));
            return false;
        }
    }
    function insertSubstitution(id, mode) {
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish the current stroke before inserting a drawing.');
            return;
        }
        const p = store.getSnapshot(), target = activeLayer(p);
        if (linkedCount(p) > 1 && !window.confirm('This cel is LINKED. Inserting artwork will update every linked drawing. Continue?'))
            return;
        if (mode === 'replace' && target.operations.length && !window.confirm('Replace the ENTIRE current “' + target.name + '” layer drawing on this cel? You can Undo. Other layers will not change.'))
            return;
        try {
            const next = applySubstitution(p, id, mode);
            stopPlayback();
            engine.current?.cancelGesture();
            engine.current?.clearSelection();
            store.commit(next, 'Insert drawing substitution');
            notify('Drawing copied to “' + target.name + '” on the current frame. Undo with Ctrl+Z.');
        }
        catch (error) {
            notify(String(error));
        }
    }
    function changeSubstitutionName(id, name) { try {
        store.commit(renameSubstitution(store.getSnapshot(), id, name), 'Rename drawing substitution');
    }
    catch (error) {
        notify(String(error));
    } }
    function removeSubstitutionFromShelf(id) { store.commit(deleteSubstitution(store.getSnapshot(), id), 'Remove drawing substitution'); }
    function openReuseShelf() {
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish drawing before opening the cycle shelf.');
            return;
        }
        stopPlayback();
        setWorkspaceMode('ANIMATE');
        setFocusMode(false);
        setRightTab('reuse');
        setLayout(old => ({ ...old, rightClosed: false }));
    }
    function linkDrawingToFrame(frameId) {
        if (operationLock.current || engine.current?.drawing)
            return;
        const p = store.getSnapshot(), target = frameList(p).find(f => f.id === frameId), layer = activeLayer(p);
        if (!target)
            return;
        const art = target.drawings[layer.id] ?? [];
        if (art.length && !window.confirm('Replace the drawing on ' + layer.name + ' at the destination frame and LINK both drawings? Edits to either linked key will update the other. Undo is available.'))
            return;
        try {
            const next = linkCurrentCelToFrame(p, frameId);
            stopPlayback();
            engine.current?.clearSelection();
            store.commit(next, 'Link animation drawings');
            notify('Drawing linked. Editing either key now updates all linked copies.');
        }
        catch (error) {
            notify(String(error));
        }
    }
    function linkDrawingShortcut() {
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish the current stroke before linking drawings.');
            return;
        }
        const project = store.getSnapshot(), frames = frameList(project), current = frames[currentFrameIndex(project)]?.id;
        const destination = frames.some(frame => frame.id === linkTargetFrameId && frame.id !== current)
            ? linkTargetFrameId : frames.find(frame => frame.id !== current)?.id;
        if (!destination) {
            notify('Add another drawing frame before linking.');
            return;
        }
        linkDrawingToFrame(destination);
    }
    function unlinkDrawing() {
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish the current stroke before unlinking.');
            return;
        }
        const before = store.getSnapshot(), next = unlinkCurrentCel(before);
        if (next === before) {
            notify('This drawing is already independent.');
            return;
        }
        store.commit(next, 'Unlink animation drawing');
        notify('This drawing is now independent.');
    }
    function captureCycle(name, startIndex, endIndex) {
        if (operationLock.current || engine.current?.drawing)
            return false;
        try {
            store.commit(saveDrawingCycleRange(store.getSnapshot(), name, startIndex, endIndex), 'Save animation cycle');
            notify('Cycle “' + name.trim() + '” saved in this project.');
            return true;
        }
        catch (error) {
            notify(String(error));
            return false;
        }
    }
    function insertCycle(id, repeats) {
        if (operationLock.current || engine.current?.drawing)
            return;
        const p = store.getSnapshot(), item = cycleItems(p).find(i => i.id === id);
        if (!item)
            return;
        const range = frameList(p).slice(currentFrameIndex(p), currentFrameIndex(p) + item.frames.length * repeats);
        const hasArt = range.some(f => (f.drawings[p.activeLayerId] ?? []).length > 0);
        if (hasArt && !window.confirm('Replace the active layer drawings on ' + range.length + ' destination cels with the repeated cycle? Other layers will not change. Linked keys in the range will become independent. You can Undo.'))
            return;
        try {
            const next = insertDrawingCycle(p, id, repeats, hasArt);
            stopPlayback();
            engine.current?.cancelGesture();
            engine.current?.clearSelection();
            store.commit(next, 'Insert reusable animation cycle');
            void engine.current?.renderer.prepare(store.getSnapshot()).then(() => engine.current?.request()).catch(error => notify(String(error)));
            notify('Cycle inserted ' + repeats + '× with independent drawings.');
        }
        catch (error) {
            notify(String(error));
        }
    }
    function removeCycle(id) { store.commit(deleteDrawingCycle(store.getSnapshot(), id), 'Remove reusable cycle'); }
    function toggleXsheetView() {
        if (operationLock.current || engine.current?.drawing)
            return;
        stopPlayback();
        setWorkspaceMode('ANIMATE');
        setFocusMode(false);
        setTimelineView(old => old === 'timeline' ? 'xsheet' : 'timeline');
    }
    function selectXsheetCell(frameId, layerId, shift = false, alt = false) {
        if (operationLock.current || engine.current?.drawing)
            return;
        selectFrameWithModifier(frameId, shift, alt);
        if (layerId)
            selectLayerWithModifier(layerId, shift, alt);
        goToDrawingFrame(frameId);
        if (layerId)
            store.select(layerId);
    }
    function makeXsheetKey(frameId, layerId) {
        const p = store.getSnapshot();
        if (!isLayerHeld(p, layerId, frameId))
            return;
        commitLayerExposure(insertLayerKey(p, layerId, frameId, true), 'Create layer key from Xsheet');
    }
    function pinLightTableFromShortcut() {
        if (busy || engine.current?.drawing)
            return;
        stopPlayback();
        setWorkspaceMode('ANIMATE');
        setFocusMode(false);
        setOnionSettingsOpen(false);
        setLayout(old => ({ ...old, bottomClosed: false }));
        setLightTableOpen(true);
        toggleReferencePin();
    }
    function updateReferencePin(frameId, change) { const p = store.getSnapshot(); setLightTablePins(old => sanitizeLightTablePins(p, old.map(pin => pin.frameId === frameId ? { ...pin, ...change } : pin))); }
    async function exportSequence(settings) {
        if (sequenceBusy || busy || engine.current?.drawing)
            return;
        stopPlayback();
        clearFlipPreview();
        const controller = new AbortController();
        sequenceAbort.current = controller;
        setSequenceBusy(true);
        setSequenceProgress({ finished: 0, total: 0, phase: 'Preparing' });
        try {
            const snapshot = store.getSnapshot();
            const zip = await renderSequenceZip(snapshot, settings, setSequenceProgress, controller.signal);
            if (controller.signal.aborted)
                return;
            downloadBlob(zip, (snapshot.name.replace(/[\\/:*?"<>|]/g, '_') || 'animation') + '-png-sequence.zip');
            setModal('');
            notify('PNG animation sequence exported.');
        }
        catch (error) {
            if (!controller.signal.aborted)
                notify('Sequence export failed: ' + String(error));
        }
        finally {
            if (sequenceAbort.current === controller)
                sequenceAbort.current = null;
            setSequenceBusy(false);
            setSequenceProgress(null);
        }
    }
    async function exportPng(options = {}) { if (busy)
        return; try {
        engine.current.renderer.composite(doc, options).toBlob(blob => { if (blob) {
            downloadBlob(blob, doc.name + '.png');
            setModal('');
        }
        else
            notify('PNG export failed.'); });
    }
    catch (e) {
        notify('PNG export failed: ' + String(e));
    } }
    function resizePanel(e, side) {
        if (e.button !== 0 || focusMode || engine.current?.drawing)
            return;
        e.preventDefault();
        const el = e.currentTarget, bench = workbench.current;
        if (!bench)
            return;
        el.setPointerCapture(e.pointerId);
        const start = { x: e.clientX, y: e.clientY, ...layout };
        const pointerId = e.pointerId;
        let next = start[side], pending = start[side], raf = 0;
        const max = () => side === 'bottom' ? Math.max(110, Math.min(520, bench.clientHeight - 235)) : Math.max(side === 'left' ? 180 : 240, Math.min(side === 'left' ? 300 : 340, (bench.clientWidth - 340) / 2));
        const move = (event) => {
            if (event.pointerId !== pointerId)
                return;
            const raw = side === 'bottom' ? start.bottom + start.y - event.clientY : start[side] + (side === 'left' ? event.clientX - start.x : start.x - event.clientX);
            pending = Math.round(Math.max(side === 'bottom' ? 110 : side === 'left' ? 180 : 240, Math.min(max(), raw)));
            if (!raf)
                raf = requestAnimationFrame(() => { raf = 0; bench.style.setProperty(side === 'bottom' ? '--timeline-height' : side === 'left' ? '--left-width' : '--right-width', pending + 'px'); });
        };
        const end = (event) => {
            if (event.pointerId !== pointerId)
                return;
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerup', end);
            el.removeEventListener('pointercancel', end);
            if (raf)
                cancelAnimationFrame(raf);
            const apply = event.type === 'pointerup';
            next = apply ? pending : start[side];
            // Preserve the last CSS variable until React commits the single final layout update.
            bench.style.setProperty(side === 'bottom' ? '--timeline-height' : side === 'left' ? '--left-width' : '--right-width', next + 'px');
            if (el.hasPointerCapture(pointerId))
                el.releasePointerCapture(pointerId);
            if (apply && next !== start[side])
                setLayout(old => ({ ...old, [side]: next }));
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
    }
    useEffect(() => {
        const keydown = (e) => {
            if (transformHotkeyRef.current?.(e)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }
            if (e.key === 'Escape' && addingMotionDot) {
                e.preventDefault();
                setAddingMotionDot(false);
                return;
            }
            if (e.key === 'Escape' && batchCanvasMode) {
                e.preventDefault();
                setBatchCanvasMode(null);
                setSelectedFrames({ ids: [], anchor: null });
                return;
            }
            if (e.key === 'Escape' && holdDrag.current) {
                e.preventDefault();
                cancelHoldDrag();
                return;
            }
            if (e.key === 'Escape') {
                stopPlayback();
                clearFlipPreview();
                e.preventDefault();
                engine.current?.cancelGesture();
                engine.current?.clearSelection();
                setMenu('');
                setRenameId('');
                if (fillQuestion) {
                    fillQuestion.resolve(false);
                    setFillQuestion(null);
                }
                closeModal();
                return;
            }
            const target = e.target;
            // Permit explicit link/unlink hotkeys while the REUSE destination dropdown has
            // focus; keep every other input and select safe from global shortcuts.
            const reuseSelectHotkey = !!target.closest('.reuse-shelf select') &&
                (keyChord(e) === shortcuts.linkCel || keyChord(e) === shortcuts.unlinkCel);
            if (target.closest('textarea,select,[contenteditable=true],input:not([type=range]):not([type=color]):not([type=checkbox])') && !reuseSelectHotkey)
                return;
            if (!e.ctrlKey && !e.metaKey && !e.altKey && e.shiftKey && e.code === 'KeyW' && !modal) {
                e.preventDefault();
                if (!e.repeat)
                    window.dispatchEvent(new Event('solo:wheel-popout-toggle'));
                return;
            }
            if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.code === 'F9' && !modal) {
                e.preventDefault();
                if (!e.repeat) {
                    setFocusMode(v => !v);
                    setOnionSettingsOpen(false);
                }
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                setRightTab(old => old === 'diagnostics' ? 'inspector' : 'diagnostics');
                setLayout(old => ({ ...old, rightClosed: false }));
                return;
            }
            if (modal)
                return;
            const cmd = e.ctrlKey || e.metaKey;
            // Context-sensitive animator transform: W/S/R control the whole selected
            // frame range, without overriding S=Stroke Select / R=Rotate Canvas normally.
            if (!cmd && !e.altKey && !e.shiftKey && multiCelAvailable &&
                (e.code === 'KeyW' || e.code === 'KeyS' || e.code === 'KeyR' || e.code === 'KeyD')) {
                e.preventDefault();
                if (!e.repeat) {
                    stopPlayback();
                    setAddingMotionDot(false);
                    setBatchCanvasMode(e.code === 'KeyW' ? 'move' : e.code === 'KeyS' ? 'scale' : e.code === 'KeyD' ? 'depth' : 'rotate');
                }
                return;
            }
            if (cmd && !e.altKey && ['a', 'd', 'x', 'c', 'v'].includes(e.key.toLowerCase())) {
                e.preventDefault();
                void editing({ a: 'all', d: 'deselect', x: 'cut', c: 'copy', v: 'paste' }[e.key.toLowerCase()]);
                return;
            }
            if (cmd && !e.shiftKey && e.key.toLowerCase() === 'j' && engine.current?.strokeIds.length) {
                e.preventDefault();
                engine.current.strokeAction('duplicate');
                return;
            }
            if (cmd && e.key.toLowerCase() === 's') {
                e.preventDefault();
                void save();
                return;
            }
            if (cmd && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                e.shiftKey ? redo() : undo();
                return;
            }
            if (cmd && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
                return;
            }
            if (!cmd && !e.altKey && e.shiftKey && e.code === 'Space') {
                e.preventDefault();
                if (!e.repeat)
                    togglePlayback();
                return;
            }
            if (!cmd && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'o' && !target.closest('input,button')) {
                e.preventDefault();
                setOnionSettings(old => ({ ...old, enabled: !old.enabled }));
                return;
            }
            if (!cmd && !e.altKey && !e.shiftKey && !e.repeat && (e.key === ',' || e.key === '.') && !target.closest('input,textarea,select,[contenteditable=true]')) {
                const direction = e.key === ',' ? -1 : 1;
                stopPlayback();
                if (!busy && !engine.current?.drawing && engine.current?.flipbook.preview(direction)) {
                    e.preventDefault();
                    setFlipPreview(direction);
                }
                return;
            }
            if (!cmd && e.altKey && tool === 'stroke-select') {
                const mode = e.code === 'KeyP' ? (e.shiftKey ? 'perspective-move' : 'perspective') : !e.shiftKey ? { KeyS: 'select', KeyL: 'lasso', KeyV: 'move', KeyG: 'scale', KeyR: 'rotate', KeyT: 'freeform' }[e.code] : undefined;
                if (mode) {
                    e.preventDefault();
                    engine.current?.setStrokeMode(mode);
                    setStrokeMode(mode);
                    if (mode === 'lasso') {
                        engine.current?.setStrokeShape('lasso');
                        setStrokeShape('lasso');
                    }
                    return;
                }
            }
            if (!cmd && e.altKey && !e.repeat) {
                if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
                    e.preventDefault();
                    stepLayerHold(e.code === 'BracketRight' ? 1 : -1);
                    return;
                }
                if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
                    e.preventDefault();
                    stepLayer(e.code === 'ArrowUp' ? -1 : 1);
                    return;
                }
                if (e.key.toLowerCase() === 'k') {
                    e.preventDefault();
                    newLayerKey(!e.shiftKey);
                    return;
                }
            }
            // US keyboard sends '{' / '}' while Shift is pressed: use physical bracket keys.
            if (!cmd && !e.altKey && e.shiftKey && (e.code === 'BracketLeft' || e.code === 'BracketRight') && !e.repeat) {
                e.preventDefault();
                const active = frameList(store.getSnapshot())[currentFrameIndex(store.getSnapshot())];
                changeHold(frameHold(active) + (e.code === 'BracketRight' ? 1 : -1));
                return;
            }
            const quick = quickAction(e);
            if (quick) {
                e.preventDefault();
                if (quick === 'sizeDown' || quick === 'sizeUp') {
                    // Do not change tool presets or an in-progress stroke while the Wacom is down.
                    if (engine.current?.drawing || operationLock.current)
                        return;
                    const direction = quick === 'sizeUp' ? 1 : -1;
                    if (toolIntent.current === 'vector')
                        setVectorDefaults(old => ({ ...old, width: steppedBrushSize(old.width, direction, true) }));
                    else if (toolIntent.current === 'brush' || toolIntent.current === 'eraser')
                        setBrushLibrary(old => {
                            const preset = activePreset(old, toolIntent.current === 'eraser');
                            return updatePreset(old, preset.id, { ...preset.settings, size: steppedBrushSize(preset.settings.size, direction) });
                        });
                    return;
                }
                if (quick === 'previousFrame' || quick === 'nextFrame') {
                    if (!e.repeat)
                        stepDrawingFrame(quick === 'previousFrame' ? -1 : 1);
                    return;
                }
                if (quick === 'blankFrame' || quick === 'duplicateFrame' || quick === 'deleteFrame') {
                    if (!e.repeat)
                        animationAction(quick === 'blankFrame' ? 'add' : quick === 'duplicateFrame' ? 'duplicate' : 'delete');
                    return;
                }
                if (quick === 'zoomOut' || quick === 'zoomIn') {
                    if (engine.current && !engine.current.drawing && !operationLock.current)
                        engine.current.zoomTo(engine.current.view.zoom * (quick === 'zoomIn' ? 1.15 : 1 / 1.15));
                    return;
                }
            }
            if (e.code === 'Space') {
                e.preventDefault();
                if (engine.current)
                    engine.current.space = true;
                return;
            }
            if (e.key === 'Enter' && hasSelection) {
                e.preventDefault();
                engine.current?.applySelection();
                return;
            }
            if (strokeCount > 0 && !cmd && !e.altKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const n = e.shiftKey ? 10 : 1;
                engine.current?.strokeAction('nudge', e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0);
                return;
            }
            // Delete/Backspace after clicking an actual timeline/Xsheet frame removes THAT
            // selected drawing frame. On canvas, Delete still removes selected strokes.
            // Scope to frame-cell buttons only; controls and text inputs remain untouched.
            const frameFocused = !!target.closest('.cel-select,.layer-exposure-cell,.xsheet-exposure-number,.xsheet-layer-slot > button:not(.xsheet-split)');
            if (timelineDeleteKey(e, frameFocused)) {
                e.preventDefault();
                if (!e.repeat)
                    animationAction('delete');
                return;
            }
            // A focused layer row has priority over canvas strokes. One Delete = one history entry.
            if (!cmd && !e.altKey && (e.key === 'Delete' || e.key === 'Backspace') && !!target.closest('.layer-select,.layer-track-name') && !e.repeat) {
                e.preventDefault();
                if (doc.layers.length > 1)
                    commit(removeLayer(doc, doc.activeLayerId));
                else
                    notify('At least one layer must remain.');
                return;
            }
            if ((strokeCount > 0 || hasSelection) && (e.key === 'Delete' || e.key === 'Backspace') && !cmd && !e.altKey) {
                e.preventDefault();
                if (!e.repeat)
                    engine.current?.deleteSelectedArtwork();
                return;
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && tool === 'vector' && vectorId) {
                e.preventDefault();
                engine.current?.vectors.delete();
                return;
            }
            if (!cmd && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'b' && !target.closest('input,textarea,select,[contenteditable=true]')) {
                e.preventDefault();
                if (!e.repeat) {
                    if (toolIntent.current === 'brush')
                        toggleMixMode();
                    else
                        chooseTool('brush');
                }
                return;
            }
            if ((!cmd && !e.altKey) || (e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey)) {
                const entry = Object.entries(shortcuts).find(([, v]) => v === keyChord(e));
                if (entry) {
                    e.preventDefault();
                    const command = entry[0];
                    if (command === 'openProjects') {
                        if (!e.repeat)
                            void listProjects();
                    }
                    else if (command === 'linkCel') {
                        if (!e.repeat)
                            linkDrawingShortcut();
                    }
                    else if (command === 'unlinkCel') {
                        if (!e.repeat)
                            unlinkDrawing();
                    }
                    else if (command === 'substitutionShelf') {
                        if (!e.repeat)
                            openSubstitutionShelf();
                    }
                    else if (command === 'reuseShelf') {
                        if (!e.repeat)
                            openReuseShelf();
                    }
                    else if (command === 'xsheet') {
                        if (!e.repeat)
                            toggleXsheetView();
                    }
                    else if (command === 'motionPlanning') {
                        if (!e.repeat)
                            openMotionPlanning();
                    }
                    else if (command === 'batchTransform') {
                        if (!e.repeat)
                            openBatchTransform();
                    }
                    else if (command === 'audioTrack') {
                        if (!e.repeat) {
                            setAudioTrackOpen(o => !o);
                            setWorkspaceMode('ANIMATE');
                            setLayout(old => ({ ...old, bottomClosed: false }));
                        }
                    }
                    else if (command === 'lightTable') {
                        if (!e.repeat)
                            toggleLightTablePanel();
                    }
                    else if (command === 'pinLightTable') {
                        if (!e.repeat)
                            pinLightTableFromShortcut();
                    }
                    else if (command === 'fit')
                        engine.current?.fit();
                    else if (command === 'resetRotation')
                        engine.current?.rotate(0);
                    else if (command === 'pencil') {
                        chooseTool('brush');
                        setBrushLibrary(old => ({ ...old, brushId: 'hb' }));
                    }
                    else
                        chooseTool(command);
                }
            }
        };
        const keyup = (e) => {
            if ((e.key === ',' || e.key === '.') && flipPreview === (e.key === ',' ? -1 : 1)) {
                engine.current?.flipbook.preview(null);
                setFlipPreview(null);
            }
            if (e.code === 'Space' && engine.current)
                engine.current.space = false;
        };
        const blur = () => { cancelHoldDrag(); playback.current?.pause(); engine.current?.flipbook.preview(null); setFlipPreview(null); if (engine.current) {
            engine.current.space = false;
            engine.current.finishGesture();
        } };
        window.addEventListener('keydown', keydown);
        window.addEventListener('keyup', keyup);
        window.addEventListener('blur', blur);
        return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); };
    }, [doc, shortcuts, linkTargetFrameId, modal, hasSelection, tool, vectorId, fillQuestion, renameId, busy, flipPreview, strokeCount, multiCelAvailable, batchCanvasMode]);
    const layer = activeLayer(doc), activeTool = allTools.find(t => t.id === tool);
    const selectedVector = layer.operations.find(o => o.kind === 'vector' && o.id === vectorId);
    const displayStatus = documentDirty(doc, saved.current) && !['Saving…', 'Save failed'].includes(status) ? 'Unsaved changes' : status;
    audioActionDelegates.current = {
        toggle: () => setAudioTrackOpen(o => !o), importClip: file => { void addSceneAudio(file); },
        remove: removeSceneAudio, mute: setAudioMuted, seek: seekSceneAudio
    };
    panelDelegates.current = { brushChange: setBrushLibrary, choose: chooseTool, notice: notify };
    motionPointEditDelegate.current = (arcId, frameId, x, y) => updateMotionPoint(arcId, frameId, x, y, 'Drag motion point');
    motionDotAddDelegate.current = (arcId, x, y) => {
        const p = store.getSnapshot();
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish drawing before adding a path dot.');
            return;
        }
        const result = addMotionControlDot(p, arcId, x, y);
        if (result.project === p) {
            notify('Could not add a dot here. Tap between existing dots (maximum 16).');
            return;
        }
        store.commit(result.project, 'Add motion path dot');
        // Stay in Add Dot mode: one click enables placing many dots until Esc or mode toggle.
        setSelectedMotionDotId(result.dotId ?? '');
    };
    motionDotMoveDelegate.current = (arcId, dotId, dx, dy, frameId) => {
        const p = store.getSnapshot();
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish drawing before editing a path dot.');
            return;
        }
        const result = moveMotionControlDot(p, arcId, dotId, dx, dy, frameId);
        if (result.project === p) {
            notify('Path dot unchanged, or a bound frame is held, linked or locked.');
            return;
        }
        if (playback.current?.running && editPathWhilePlaying)
            playback.current.refreshMotionEdit(result.project);
        engine.current?.clearSelection();
        store.commit(result.project, 'Move motion path dot');
    };
    const setTransformValues = (patch) => { const next = { ...transform, ...patch }; setTransform(next); engine.current?.setTransform(next); };
    function openBatchTransform() { setAddingMotionDot(false); stopPlayback(); setWorkspaceMode('ANIMATE'); setRightTab('batch-transform'); setLayout(old => ({ ...old, rightClosed: false, bottomClosed: false })); }
    function applyBatchTransform(values) {
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish drawing before transforming cels.');
            return;
        }
        const previous = store.getSnapshot();
        const ids = selectedFrames.ids.filter(id => frameList(previous).some(f => f.id === id));
        const layers = selectedLayers.ids.length ? selectedLayers.ids : [previous.activeLayerId];
        const result = batchTransformCels(previous, ids, layers, values);
        if (result.project === previous) {
            notify(result.reason ?? 'Nothing changed.');
            return;
        }
        engine.current?.cancelGesture();
        engine.current?.clearSelection();
        store.commit(result.project, 'Multi-Cel Transform');
        notify(`Transformed ${result.changed} drawing cels. Control+Z restores them together.`);
    }
    function applyProgressiveScale(factors) {
        if (operationLock.current || engine.current?.drawing) {
            const reason = 'Finish drawing before applying Depth Scale.';
            notify(reason);
            return reason;
        }
        const previous = store.getSnapshot(), ids = selectedFrames.ids.filter(id => frameList(previous).some(f => f.id === id));
        const layers = selectedLayers.ids.length ? selectedLayers.ids : [previous.activeLayerId];
        const result = progressiveScaleFrameFactors(previous, ids, layers, factors);
        if (result.project === previous) {
            const reason = result.reason ?? 'Nothing changed.';
            notify(reason);
            return reason;
        }
        engine.current?.cancelGesture();
        engine.current?.clearSelection();
        store.commit(result.project, 'Progressive Depth Scale');
        setBatchCanvasMode(null);
        notify(`Resized ${result.changed} cels with uniform proportions. Control+Z restores them.`);
        return null;
    }
    function openMotionPlanning() { setMotionToolsOpen(true); setWorkspaceMode('ANIMATE'); setRightTab(old => old === 'motion' ? 'inspector' : 'motion'); setLayout(old => ({ ...old, rightClosed: false })); }
    function updateMotionData(next, label) {
        const before = store.getSnapshot();
        if (next === before)
            return;
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish drawing before editing motion guides.');
            return;
        }
        store.commit(next, label);
    }
    function quickCreateMotionPath(start, end) {
        const p = store.getSnapshot();
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish the stroke first.');
            return;
        }
        const selected = engine.current?.strokeIds ?? [];
        const result = createQuickMotionPath(p, start, end, selected);
        if (result.project === p) {
            notify(result.reason ?? 'Could not create the path. Select the ball with S on its drawing layer.');
            return;
        }
        engine.current?.clearSelection();
        store.commit(result.project, 'Create Motion Path');
        setActiveMotionArcId(result.project.motionPlanning.arcs.at(-1).id);
        setMotionArcEditing(true);
        setAddingMotionDot(false);
        setSelectedMotionDotId('');
        notify(result.skipped ? `Created a path for ${result.bound} frames. ${result.skipped} frame(s) were skipped to protect other artwork. See Advanced or put the moving part on its own layer.` : `Motion path ready for ${result.bound} frames! Drag its teal curve or point to adjust. Control+Z to undo.`);
    }
    function bindSelectedMotionStrokes(id) {
        const p = store.getSnapshot(), selected = engine.current?.strokeIds ?? [];
        if (!selected.length) {
            notify('Press S and select your ball strokes first.');
            return;
        }
        const frameId = frameList(p)[currentFrameIndex(p)].id, next = bindArcStrokes(p, id, frameId, selected);
        if (next === p) {
            notify('Could not bind: select strokes on the arc layer in an unlocked, independent drawing cel.');
            return;
        }
        updateMotionData(next, 'Bind selected strokes to arc');
        notify('Selected strokes bound to this motion arc for the current frame.');
    }
    function bindMotionLayerRange(id, start, end) {
        const p = store.getSnapshot(), next = bindArcLayerRange(p, id, start, end);
        if (next === p) {
            notify('No independent drawable cels found. Check the layer, hold/links, and frame range.');
            return;
        }
        updateMotionData(next, 'Bind layer cels to arc');
        notify('Drawing cels bound. Only the arc layer’s brush/vector strokes will move.');
    }
    function applyMotionArc(id) {
        const p = store.getSnapshot();
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish drawing before applying the arc.');
            return;
        }
        const result = alignBoundDrawingsToArc(p, id);
        if (!result.moved) {
            notify('No drawings moved. Check that two path points cover your bound, editable frames; held/linked cels are protected.');
            return;
        }
        engine.current?.clearSelection();
        store.commit(result.project, 'Move bound drawings onto motion arc');
        notify(`Moved drawings on ${result.moved} frames. Control+Z undoes the whole move.`);
    }
    function updateMotionPoint(id, frameId, x, y, label = 'Adjust motion path') {
        const p = store.getSnapshot();
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish drawing before editing the motion path.');
            return;
        }
        const result = editMotionPath(p, id, frameId, x, y);
        if (result.project === p) {
            notify('Motion point unchanged or a bound drawing is held/linked/locked.');
            return;
        }
        // Only an explicitly permitted motion edit can refresh playback in place.
        // No raster work is done for intermediate pen movements.
        if (playback.current?.running && editPathWhilePlaying)
            playback.current.refreshMotionEdit(result.project);
        engine.current?.clearSelection();
        store.commit(result.project, label);
    }
    function removeSelectedMotionDot(arcId, dotId) {
        const p = store.getSnapshot();
        if (operationLock.current || engine.current?.drawing) {
            notify('Finish drawing before removing a path dot.');
            return;
        }
        const result = removeMotionControlDot(p, arcId, dotId, frameList(p)[currentFrameIndex(p)].id);
        if (result.project === p) {
            notify('Could not remove the selected dot.');
            return;
        }
        if (playback.current?.running && editPathWhilePlaying)
            playback.current.refreshMotionEdit(result.project);
        engine.current?.clearSelection();
        store.commit(result.project, 'Remove motion path dot');
        setSelectedMotionDotId('');
    }
    function captureMotionPoint(id) {
        const current = store.getSnapshot(), arc = current.motionPlanning?.arcs.find(a => a.id === id);
        const layer = current.layers.find(l => l.id === arc?.layerId);
        const selectedIds = new Set(engine.current?.strokeIds ?? []);
        const selected = layer ? selectable(layer).filter(op => selectedIds.has(op.id)) : [];
        const frameId = frameList(current)[currentFrameIndex(current)].id;
        const boundIds = new Set(arc?.bindings?.find(b => b.frameId === frameId)?.operationIds ?? []);
        // When a hand is already bound, Capture must use only that hand—not the entire character.
        const bound = layer ? selectable(layer).filter(op => boundIds.has(op.id)) : [];
        // Once bound, prefer that hand's strokes, not another selected character.
        const chosen = bound.length ? (selected.some(op => boundIds.has(op.id)) ? selected.filter(op => boundIds.has(op.id)) : bound) : selected;
        const bounds = boundsOf(chosen);
        const position = bounds ? { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 } : arc?.layerId === current.activeLayerId ? activeLayerArtworkCenter(current) : null;
        if (!position) {
            notify('Select the ball with S on the arc layer or choose the arc’s layer and draw first.');
            return;
        }
        updateMotionPoint(id, frameId, position.x, position.y, 'Capture motion point');
    }
    const menus = {
        File: [{ label: 'New Project…', action: startNew }, { label: 'Open / Manage Projects · Ctrl+Alt+O', action: () => void listProjects() }, { label: 'Import backup…', action: () => fileInput.current?.click() }, { label: 'Save · Ctrl/⌘ S', action: () => void save() }, { label: 'Save As…', action: beginSaveAs }, { label: 'Download editable backup', action: () => downloadProject(doc) }, { label: 'Recover snapshot…', action: () => void showSnapshots() }, { label: 'Rename project…', action: () => { setName(doc.name); setModal('rename'); } }, { label: 'Export PNG', action: showExport }, { label: 'Export animation PNG sequence…', action: () => setModal('sequence') }],
        Select: [{ label: 'Stroke Select · S', action: () => chooseTool('stroke-select') }, { label: 'Lasso · L', action: () => chooseTool('lasso') }, { label: 'Rectangle · M', action: () => chooseTool('rectangle') }, { label: 'Select All · Ctrl/⌘ A', action: () => void editing('all') }, { label: 'Deselect · Ctrl/⌘ D', action: () => void editing('deselect') }],
        Tools: [{ label: 'Brush · B', action: () => chooseTool('brush') }, { label: 'Vector Pen · N', action: () => chooseTool('vector') }, { label: 'Eraser · E', action: () => chooseTool('eraser') }, { label: 'Fill · G', action: () => chooseTool('fill') }, { label: 'Eyedropper · I', action: () => chooseTool('eyedropper') }],
        Transform: [{ label: 'Free Transform · T', action: () => chooseTool('transform') }, { label: 'Move · V', action: () => chooseTool('transform') }, { label: 'Multi-Cel Transform · Shift+T', action: openBatchTransform }],
        Edit: [{ label: 'Undo · Ctrl/⌘ Z', action: undo, disabled: !store.canUndo }, { label: 'Redo · Ctrl/⌘ Shift Z / Y', action: redo, disabled: !store.canRedo }, ...[['Select All · Ctrl/⌘ A', 'all'], ['Deselect · Ctrl/⌘ D', 'deselect'], ['Cut · Ctrl/⌘ X', 'cut'], ['Copy · Ctrl/⌘ C', 'copy'], ['Paste · Ctrl/⌘ V', 'paste']].map(([label, command]) => ({ label, action: () => void editing(command) })), ...allTools.map(t => ({ label: t.name + ' · ' + shortcuts[t.id].toUpperCase(), action: () => chooseTool(t.id) })), { label: 'Keyboard shortcuts…', action: () => setModal('settings') }],
        View: [{ label: (focusMode ? 'Exit Canvas Focus Mode' : 'Canvas Focus Mode') + ' · F9', action: () => { setFocusMode(v => !v); setOnionSettingsOpen(false); } }, { label: 'Compact timeline', action: () => { setFocusMode(false); setLayout(old => ({ ...old, bottomClosed: false, bottom: 184 })); } }, { label: 'Fit canvas · F', action: () => engine.current?.fit() }, { label: 'Reset rotation · Shift+R', action: () => engine.current?.rotate(0) }, { label: 'Reset view · 100%', action: () => engine.current?.reset() }, { label: (doc.settings.guides ? 'Hide' : 'Show') + ' frame guides', action: () => commit({ ...doc, settings: { ...doc.settings, guides: !doc.settings.guides } }) }, { label: 'Toggle left panel', action: () => setLayout({ ...layout, leftClosed: !layout.leftClosed }) }, { label: 'Toggle inspector', action: () => setLayout({ ...layout, rightClosed: !layout.rightClosed }) }, { label: 'Toggle timeline region', action: () => setLayout({ ...layout, bottomClosed: !layout.bottomClosed }) }],
        Layer: [{ label: 'Add layer', action: () => { if (doc.layers.length >= 100) {
                    notify('Projects support up to 100 layers.');
                    return;
                } const l = newLayer('Layer ' + (doc.layers.length + 1)); commit({ ...doc, layers: [l, ...doc.layers], activeLayerId: l.id }); } }, { label: 'Rename layer', action: () => { setRenameId(layer.id); setRenameValue(layer.name); } }, { label: 'Duplicate layer', action: () => commit(duplicateLayer(doc, layer.id)) }, { label: 'Delete layer…', action: () => { if (window.confirm('Delete “' + layer.name + '”? You can undo this.'))
                    commit(removeLayer(doc, layer.id)); }, disabled: doc.layers.length === 1 }, { label: 'Merge Down', action: () => void editing('merge'), disabled: doc.layers.at(-1)?.id === layer.id || layer.locked || frameList(doc).length > 1 }, { label: 'Clear Layer', action: () => void editing('clear'), disabled: layer.locked }],
        Animation: [{ label: (timelineView === 'xsheet' ? 'Hide side Xsheet' : 'Show side Xsheet') + ' · ' + shortcuts.xsheet.toUpperCase(), action: toggleXsheetView }, { label: 'New blank frame · F6', action: () => animationAction('add') }, { label: 'Duplicate current frame · F7', action: () => animationAction('duplicate') }, { label: 'Delete selected frame · Delete/⌫ (when frame focused) or Shift+F7', action: () => animationAction('delete'), disabled: frameList(doc).length <= 1 }, { label: 'Previous frame · Page Up', action: () => stepDrawingFrame(-1) }, { label: 'Next frame · Page Down', action: () => stepDrawingFrame(1) }, { label: 'Flip previous · ,', action: () => toggleFlipPreview(-1) }, { label: 'Flip next · .', action: () => toggleFlipPreview(1) }, { label: 'Drawing Substitution Shelf · ' + shortcuts.substitutionShelf.toUpperCase(), action: openSubstitutionShelf }, { label: 'Linked Drawings & Cycles · ' + shortcuts.reuseShelf.toUpperCase(), action: openReuseShelf }, { label: 'Link current drawing · ' + shortcuts.linkCel.toUpperCase(), action: linkDrawingShortcut }, { label: 'Unlink current drawing · ' + shortcuts.unlinkCel.toUpperCase(), action: unlinkDrawing }, { label: 'Timing Notes & Motion Path Assist · ' + shortcuts.motionPlanning.toUpperCase(), action: openMotionPlanning }, { label: 'Multi-Cel Transform · ' + shortcuts.batchTransform.toUpperCase(), action: openBatchTransform }, { label: 'Toggle onion skin · O', action: () => { } }, { label: 'Audio waveform · ' + shortcuts.audioTrack.toUpperCase(), action: () => { setAudioTrackOpen(o => !o); setWorkspaceMode('ANIMATE'); setLayout(old => ({ ...old, bottomClosed: false })); } }, { label: 'Advanced Light Table · ' + shortcuts.lightTable.toUpperCase(), action: toggleLightTablePanel }, { label: 'Pin / unpin current drawing · ' + shortcuts.pinLightTable.toUpperCase(), action: pinLightTableFromShortcut },],
        Window: [{ label: 'Keyboard & workspace settings…', action: () => setModal('settings') }, { label: 'History panel', action: () => { setRightTab('history'); setLayout({ ...layout, rightClosed: false }); } }, { label: 'Pop out / return Tool Wheel · Shift+W', action: () => window.dispatchEvent(new Event('solo:wheel-popout-toggle')) }, { label: 'Reset panel layout', action: () => { setFocusMode(false); setLayout({ left: 232, right: 280, bottom: 184, leftClosed: false, rightClosed: false, bottomClosed: false }); } }],
        Help: [{ label: 'Drawing Bug Recorder', action: () => { setRightTab('recorder'); setLayout(old => ({ ...old, rightClosed: false })); } }, { label: 'Drawing Diagnostics (developer)…', action: () => { setRightTab('diagnostics'); setLayout(old => ({ ...old, rightClosed: false })); } }, { label: 'Drawing studio guide', action: () => setModal('help') }, { label: 'Welcome / recovery…', action: () => void showOnboarding() }, { label: 'Milestone roadmap', action: () => setModal('roadmap') }, { label: 'About Solo Anime Studio', action: () => setModal('about') }]
    };
    return _jsxs("div", { className: "studio", children: [_jsxs("header", { className: "app-header", children: [_jsxs("div", { className: "brand", children: [_jsxs("svg", { viewBox: "0 0 32 32", width: "30", height: "30", "aria-hidden": "true", children: [_jsx("path", { d: "M5 17 19 3M5 26 27 4M15 28 28 15", stroke: "currentColor", strokeWidth: "4", strokeLinecap: "round" }), _jsx("circle", { cx: "27", cy: "27", r: "2", fill: "currentColor" })] }), _jsx("strong", { children: "Solo Anime Studio" }), _jsxs("span", { className: "version-badge", title: "Solo Anime Studio " + buildInfo.version, children: ["v", buildInfo.version] })] }), _jsx("nav", { className: "main-menu", "aria-label": "Main menu", children: Object.keys(menus).map(m => _jsxs("div", { className: "menu-wrap", children: [_jsx("button", { className: menu === m ? 'menu-active' : '', "aria-expanded": menu === m, onClick: e => { const r = e.currentTarget.getBoundingClientRect(); menuButton.current = e.currentTarget; setMenuAnchor({ left: Math.max(8, Math.min(r.left, window.innerWidth - 288)), top: r.bottom + 6 }); setMenu(menu === m ? '' : m); }, children: m }), menu === m && createPortal(_jsxs("div", { className: "main-menu-layer", children: [_jsx("button", { className: "menu-dismiss", "aria-label": "Close menu", onClick: () => { setMenu(''); menuButton.current?.focus(); } }), _jsx("div", { ref: menuPopup, className: "dropdown main-menu-popup", "aria-label": m + ' menu', style: { left: menuAnchor.left, top: menuAnchor.top, maxHeight: 'calc(100dvh - ' + (menuAnchor.top + 8) + 'px)' }, onKeyDown: e => { const items = Array.from(e.currentTarget.querySelectorAll('button:not(:disabled)')); const i = items.indexOf(document.activeElement); if (e.key === 'Escape') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setMenu('');
                                                menuButton.current?.focus();
                                            }
                                            else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const index = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                                                items[index]?.focus();
                                            } }, children: menus[m].map(item => _jsx("button", { disabled: item.disabled || busy, onClick: () => { setMenu(''); item.action(); }, children: item.label }, item.label)) })] }), document.body)] }, m)) }), _jsxs("div", { className: "header-actions", children: [_jsxs("span", { className: 'save-status ' + (displayStatus === 'Save failed' ? 'error' : ''), children: [_jsx("i", {}), displayStatus] }), _jsx(IconButton, { label: "Settings and shortcuts", onClick: () => setModal('settings'), children: _jsx(Settings, { size: 17 }) }), _jsxs("button", { className: "export-button", onClick: showExport, disabled: busy, children: [_jsx(Download, { size: 15 }), "Export PNG"] })] })] }), _jsxs("div", { className: "workspace-bar", children: [_jsxs("div", { className: "workspace-tabs", children: [_jsxs("button", { className: workspaceMode === 'DRAW' ? 'active' : '', "aria-pressed": workspaceMode === 'DRAW', title: "Draw workspace: artwork tools and a larger canvas; your selected animation cel is not changed", onClick: () => { stopPlayback(); clearFlipPreview(); setOnionSettingsOpen(false); setFocusMode(false); setWorkspaceMode('DRAW'); }, children: ["DRAW", _jsx("span", {})] }), _jsxs("button", { className: workspaceMode === 'ANIMATE' ? 'active' : '', "aria-pressed": workspaceMode === 'ANIMATE', title: "Animate workspace: drawing tools plus layer cels, holds, onion skin, flipbook and playback", onClick: () => { setWorkspaceMode('ANIMATE'); setFocusMode(false); setLayout(old => ({ ...old, bottomClosed: false })); }, children: ["ANIMATE", _jsx("span", {})] }), _jsxs("button", { type: "button", className: 'workspace-focus-button' + (focusMode ? ' selected' : ''), title: focusMode ? 'Show Timeline and panels again · F9' : 'Hide Timeline and panels for more drawing space · F9', "aria-label": focusMode ? 'Exit Canvas Focus Mode (F9)' : 'Focus Canvas (F9)', "aria-pressed": focusMode, onClick: () => { setFocusMode(v => !v); setOnionSettingsOpen(false); }, children: [focusMode ? _jsx(Minimize2, { size: 14 }) : _jsx(Maximize2, { size: 14 }), _jsx("span", { children: focusMode ? 'EXIT FOCUS' : 'FOCUS CANVAS' }), _jsx("kbd", { children: "F9" })] }), ['CHARACTERS', 'CLEANUP', 'COMPOSE'].map(t => _jsxs("button", { disabled: true, title: "Planned in a later milestone", children: [t, _jsx("span", { className: "planned-dot" })] }, t))] }), _jsxs("div", { className: "scene-info", children: [_jsx(Folder, { size: 13 }), _jsx("span", { children: doc.name }), _jsx(ChevronDown, { size: 12 }), _jsx("span", { className: "vertical-divider" }), _jsxs("button", { title: "New project resolution", onClick: startNew, children: [doc.width, " \u00D7 ", doc.height, _jsx(ChevronDown, { size: 12 })] })] }), _jsxs("span", { className: "milestone-label", children: ["MILESTONE 02 ", _jsx("span", { children: "Layer Cels" })] })] }), _jsxs("div", { ref: workbench, className: 'workbench ' + (workspaceMode === 'DRAW' ? 'draw-workspace-mode ' : 'animate-workspace-mode ') + (focusMode ? 'canvas-focus-mode' : ''), style: { '--left-width': layout.leftClosed ? '42px' : layout.left + 'px', '--right-width': layout.rightClosed ? '42px' : layout.right + 'px', '--timeline-height': layout.bottomClosed ? '35px' : layout.bottom + 'px' }, children: [_jsx("aside", { className: 'left-panel ' + (layout.leftClosed ? 'panel-closed' : ''), children: layout.leftClosed ? _jsxs("div", { className: "collapsed-tool-rail", role: "toolbar", "aria-label": "Collapsed project and drawing tools", children: [_jsx(IconButton, { label: "Expand project and layers panel", onClick: () => setLayout(old => ({ ...old, leftClosed: false })), children: _jsx(PanelLeftOpen, { size: 17 }) }), _jsx("span", { className: "rail-divider" }), toolRegistry.filter(t => t.group === 'draw' || t.id === 'stroke-select').map(t => _jsx(IconButton, { label: t.name + ' (' + t.key + ')', active: tool === t.id, onClick: () => chooseTool(t.id), children: _jsx(t.icon, { size: 17 }) }, t.id)), _jsx("span", { className: "rail-divider" }), _jsx(IconButton, { label: "Open layers panel", onClick: () => setLayout(old => ({ ...old, leftClosed: false })), children: _jsx(Layers, { size: 17 }) })] }) : _jsxs(_Fragment, { children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { children: "PROJECT" }), _jsxs("div", { children: [_jsx(IconButton, { label: "New Project", onClick: startNew, children: _jsx(Plus, { size: 16 }) }), _jsx(IconButton, { label: "Collapse project panel", onClick: () => setLayout({ ...layout, leftClosed: true }), children: _jsx(PanelLeftClose, { size: 15 }) })] })] }), _jsxs("div", { className: "project-content", children: [_jsxs("div", { className: "project-title", children: [_jsx(Folder, { size: 15 }), _jsx("span", { children: doc.name })] }), _jsxs("button", { className: "scene-row", onClick: () => { setName(doc.name); setModal('rename'); }, children: [_jsx(ChevronRight, { size: 13 }), _jsx("span", { className: "scene-icon", children: _jsx(Film, { size: 15 }) }), _jsxs("span", { children: ["Scene 01 ", _jsx("small", { children: "Drawing scene" })] }), _jsx("span", { className: "scene-dot" })] }), _jsxs("button", { className: "subtle-button", onClick: () => void listProjects(), children: [_jsx(FolderOpen, { size: 13 }), "Open local project"] })] }), _jsx("div", { id: "tool-wheel-home", className: "tool-wheel-home" }), _jsxs("div", { className: "panel-heading layer-heading", children: [_jsxs("span", { children: ["LAYERS ", _jsx("small", { children: doc.layers.length })] }), _jsxs("div", { children: [_jsx(IconButton, { label: "Add layer", onClick: menus.Layer[0].action, disabled: busy, children: _jsx(Plus, { size: 17 }) }), _jsx(IconButton, { label: "Duplicate layer", onClick: () => commit(duplicateLayer(doc, layer.id)), disabled: busy, children: _jsx(Copy, { size: 14 }) }), _jsx(IconButton, { label: "Delete active layer", onClick: menus.Layer[3].action, disabled: doc.layers.length === 1 || busy, children: _jsx(Trash2, { size: 14 }) })] })] }), _jsxs("div", { className: "layer-options", children: [_jsx("select", { "aria-label": "Layer blend mode", value: layer.blend ?? 'normal', onChange: e => commit(editLayer(doc, layer.id, { blend: e.target.value })), children: ['normal', 'multiply', 'screen', 'overlay', 'add'].map(mode => _jsx("option", { value: mode, children: mode[0].toUpperCase() + mode.slice(1) }, mode)) }), _jsxs("label", { children: ["Opacity", _jsx("input", { "aria-label": "Layer opacity", type: "number", min: "0", max: "100", value: Math.round(layer.opacity * 100), onChange: e => { const n = Math.max(0, Math.min(100, +e.target.value)); commit(editLayer(doc, layer.id, { opacity: n / 100 })); } }), "%"] })] }), _jsx("div", { className: "layers-list", children: doc.layers.map(l => _jsxs("div", { className: 'layer-row ' + (doc.activeLayerId === l.id ? 'active' : '') + (layerSelectionSet.has(l.id) ? ' multi-selected' : '') + (!l.visible ? ' hidden-layer' : ''), children: [_jsx(IconButton, { label: (l.visible ? 'Hide ' : 'Show ') + l.name, onClick: () => commit(editLayer(doc, l.id, { visible: !l.visible })), children: l.visible ? _jsx(Eye, { size: 15 }) : _jsx(EyeOff, { size: 15 }) }), _jsxs("button", { className: "layer-select", "aria-label": 'Select ' + l.name, "aria-pressed": layerSelectionSet.has(l.id) || doc.activeLayerId === l.id, onClick: e => { if (busy)
                                                    return; selectLayerWithModifier(l.id, e.shiftKey, e.altKey); engine.current?.cancelGesture(); store.select(l.id); }, onDoubleClick: () => { setRenameId(l.id); setRenameValue(l.name); }, children: [_jsx("span", { className: 'layer-thumbnail ' + (l.operations.length ? 'has-art' : ''), children: _jsx(Layers, { size: 15 }) }), _jsxs("span", { children: [l.name, _jsx("small", { children: l.operations.length ? l.operations.length + ' operations' : 'Empty layer' })] })] }), _jsx(IconButton, { label: (l.locked ? 'Unlock ' : 'Lock ') + l.name, onClick: () => commit(editLayer(doc, l.id, { locked: !l.locked })), children: l.locked ? _jsx(Lock, { size: 13 }) : _jsx(Unlock, { size: 13 }) })] }, l.id)) }), _jsxs("div", { className: "layer-bottom", children: [_jsxs("div", { children: [_jsx(IconButton, { label: "Move layer up", onClick: () => commit(reorderLayer(doc, layer.id, -1)), disabled: doc.layers[0].id === layer.id, children: _jsx(ArrowUp, { size: 15 }) }), _jsx(IconButton, { label: "Move layer down", onClick: () => commit(reorderLayer(doc, layer.id, 1)), disabled: doc.layers.at(-1).id === layer.id, children: _jsx(ArrowDown, { size: 15 }) })] }), _jsx("button", { onClick: () => { setRenameId(layer.id); setRenameValue(layer.name); }, children: "Rename layer" })] }), _jsxs("div", { className: "local-notice", children: [_jsx("span", { className: "local-icon", children: _jsx(Save, { size: 15 }) }), _jsxs("div", { children: ["Made here. Saved here.", _jsx("small", { children: "Local autosave \u00B7 every 2.5 seconds after edits" })] })] })] }) }), _jsx("div", { className: "panel-resizer left-resizer", role: "separator", "aria-label": "Resize project panel", onPointerDown: e => resizePanel(e, 'left') }), _jsxs("main", { className: "center-panel", children: [_jsxs("div", { className: "canvas-tabbar", children: [_jsxs("div", { className: "document-tab", children: [_jsx("span", { className: "tab-dot" }), doc.name, _jsx("span", { className: "tab-label", children: workspaceMode === 'DRAW' ? 'ILLUSTRATION' : 'ANIMATION' })] }), _jsxs("div", { className: "canvas-controls", children: [_jsx(MirrorControls, { engine: engineReady }), _jsx(IconButton, { label: "Undo", onClick: undo, disabled: !store.canUndo || busy, children: _jsx(Undo2, { size: 15 }) }), _jsx(IconButton, { label: "Redo", onClick: redo, disabled: !store.canRedo || busy, children: _jsx(Redo2, { size: 15 }) }), _jsx("span", { className: "vertical-divider" }), _jsx(CameraZoom, { camera: camera, engine: engineReady }), _jsx("button", { title: "Reset rotation", "aria-label": "Reset rotation", onClick: () => engine.current?.rotate(0), children: "0\u00B0" }), _jsx(IconButton, { label: "Fit canvas", onClick: () => engine.current?.fit(), children: _jsx(Maximize, { size: 15 }) }), _jsx(IconButton, { label: "Reset view", onClick: () => engine.current?.reset(), children: _jsx(RotateCcw, { size: 15 }) }), _jsxs("button", { type: "button", className: "canvas-focus-tab-action " + (focusMode ? "selected" : ""), title: focusMode ? "Exit Canvas Focus Mode · F9" : "Focus Canvas · F9", "aria-label": focusMode ? "Exit Canvas Focus Mode (F9)" : "Focus Canvas (F9)", "aria-pressed": focusMode, onClick: () => { setFocusMode(v => !v); setOnionSettingsOpen(false); }, children: [focusMode ? _jsx(Minimize2, { size: 14 }) : _jsx(Maximize2, { size: 14 }), _jsx("span", { children: focusMode ? "Exit Focus" : "Focus" })] }), _jsx(CameraAngle, { camera: camera, engine: engineReady })] })] }), _jsxs("div", { className: 'canvas-xsheet-row' + (timelineView === 'xsheet' ? ' has-side-xsheet' : '') + (xsheetSide === 'left' ? ' xsheet-left' : ' xsheet-right'), children: [_jsxs("div", { className: "drawing-workspace", ref: workspace, onPointerDownCapture: e => { if (playback.current?.active && e.target === canvas.current) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            stopPlayback();
                                        } }, children: [_jsx("canvas", { ref: canvas, className: 'drawing-canvas tool-' + tool + (tool === 'stroke-select' ? ' stroke-mode-' + strokeMode : tool === 'transform' ? ' area-transform-mode-' + areaTransformMode : ''), "aria-label": "Drawing canvas", tabIndex: 0, onContextMenu: event => { /* Prevent Chrome Save image / Inspect / extension menus during Wacom drawing. */ event.preventDefault(); } }), (tool === 'transform' || tool === 'stroke-select' && advancedStrokeTransform) && engineReady && !busy && _jsx(TransformOverlay, { engine: engineReady, view: view, scope: { frameIds: multiCelAvailable ? selectedFrames.ids : [], layerIds: multiCelAvailable ? selectedLayers.ids : [] }, keyDelegate: transformHotkeyRef, onCancel: () => { if (tool === 'stroke-select') {
                                                    setAdvancedStrokeTransform(false);
                                                }
                                                else {
                                                    engine.current?.clearSelection();
                                                    chooseTool('brush');
                                                } }, onMessage: notify }), multiCelAvailable && batchCanvasMode && batchCanvasMode !== 'depth' && batchCanvasBounds && !busy && _jsx(BatchCanvasTransform, { view: view, bounds: batchCanvasBounds, mode: batchCanvasMode, onCommit: applyBatchTransform }, batchCanvasMode), multiCelAvailable && batchCanvasMode === 'depth' && depthPreviewFrames.length && !busy && _jsx(ProgressiveScaleCanvas, { view: view, frames: depthPreviewFrames, initialFocus: doc.animation?.activeFrameId ?? '', onFocusFrame: goToDrawingFrame, onApply: applyProgressiveScale, onCancel: () => setBatchCanvasMode(null) }, selectedFrames.ids.join('|') + '|' + selectedLayers.ids.join('|')), doc.camera?.enabled && _jsx(SceneCameraOverlay, { project: doc, frame: cameraExposure, view: camera, onMove: (x, y) => moveSceneCamera(x, y) }), motionToolsOpen && rightTab === 'motion' && workspaceMode === 'ANIMATE' && pathVisible && _jsx(MotionArcOverlay, { planning: doc.motionPlanning, view: view, activeFrameId: frameList(doc)[currentFrameIndex(doc)].id, frameIds: motionFrameIds, activeArcId: doc.motionPlanning?.arcs.some(a => a.id === activeMotionArcId) ? activeMotionArcId : doc.motionPlanning?.arcs.at(-1)?.id, editing: pathEditable, addingDot: addingMotionDot, selectedDotId: selectedMotionDotId, onMovePoint: motionPointEditCallback.current, onAddDot: motionDotAddCallback.current, onMoveDot: motionDotMoveCallback.current, onSelectDot: setSelectedMotionDotId }), multiCelAvailable && tool !== 'transform' && _jsxs(FloatingTransformPanel, { id: "multi", className: "batch-canvas-toolbar", label: "Multi-frame canvas transform", children: [_jsxs("strong", { children: [frameSelectionSet.size, " FRAMES"] }), _jsx("button", { type: "button", className: batchCanvasMode === 'move' ? 'active' : '', title: "W \u2014 drag selected drawings together", onClick: () => { stopPlayback(); setBatchCanvasMode('move'); }, children: "W Move" }), _jsx("button", { type: "button", className: batchCanvasMode === 'scale' ? 'active' : '', title: "S \u2014 drag selected drawing to scale", onClick: () => { stopPlayback(); setBatchCanvasMode('scale'); }, children: "S Scale" }), _jsx("button", { type: "button", className: batchCanvasMode === 'rotate' ? 'active' : '', title: "R \u2014 drag selected drawing to rotate", onClick: () => { stopPlayback(); setBatchCanvasMode('rotate'); }, children: "R Rotate" }), _jsx("button", { type: "button", className: batchCanvasMode === 'depth' ? 'active' : '', title: "D \u2014 progressively resize first-to-last drawings without flattening", onClick: () => { stopPlayback(); setBatchCanvasMode('depth'); }, children: "D Depth" }), _jsx("button", { type: "button", title: "Esc \u2014 finish batch transform", onClick: () => { setBatchCanvasMode(null); setSelectedFrames({ ids: [], anchor: null }); }, children: "\u2715" }), _jsx("small", { children: batchCanvasMode ? batchCanvasMode === 'move' ? 'Drag inside the teal box to move · Control+Z undoes' : batchCanvasMode === 'scale' ? 'Drag a teal corner to scale · Control+Z undoes' : batchCanvasMode === 'depth' ? 'Choose any selected frame, drag a corner · Auto or Independent · Apply' : 'Drag the round rotation handle · Control+Z undoes' : 'Choose W, S, R or D — no panel needed' })] }), _jsxs("div", { className: "canvas-corner-label", children: [_jsx("span", { className: "canvas-live-dot" }), doc.width, " \u00D7 ", doc.height, " ", _jsx("span", { children: "\u00B7" }), " ", layer.name] }), _jsx(BugRecordingIndicator, { engine: engineReady, open: () => { setRightTab('recorder'); setLayout(old => ({ ...old, rightClosed: false })); } }), false && tool === 'transform' && hasSelection && strokeCount === 0 && _jsxs(FloatingTransformPanel, { id: "area", className: "stroke-select-floating area-transform-floating", label: "Selection transform tools", children: [_jsx("span", { className: "stroke-select-title", children: "TRANSFORM" }), [
                                                        { id: 'freeform', label: 'Free Transform', icon: StudioFreeformIcon, hint: 'Combined Move, Scale and Rotate on this selected area' },
                                                        { id: 'move', label: 'Move', icon: StudioMoveIcon, hint: 'Only move the selected drawing' },
                                                        { id: 'scale', label: 'Scale', icon: StudioScaleIcon, hint: 'Only scale using the corner handles' },
                                                        { id: 'rotate', label: 'Rotate', icon: StudioRotateObjectIcon, hint: 'Only rotate using the circular handle' }
                                                    ].map(({ id, label, icon: Icon, hint }) => _jsxs("button", { type: "button", title: hint, "aria-label": label, "aria-pressed": areaTransformMode === id, className: 'stroke-mode-button ' + (areaTransformMode === id ? 'active' : ''), onClick: () => { setAreaTransformMode(id); engine.current?.setAreaTransformMode(id); }, children: [_jsx(Icon, { size: 21 }), _jsx("span", { children: label })] }, id)), _jsxs("button", { type: "button", title: "Perspective warp applies to editable individual strokes. Convert this selection to selected strokes when available.", "aria-label": "Perspective", className: "stroke-mode-button", onClick: () => { const e = engine.current; if (!e)
                                                            return; const ids = e.strokeIdsInArea(); if (!ids.length) {
                                                            notify('Perspective needs editable brush or vector strokes. Select them with Stroke Select (S).');
                                                            return;
                                                        } chooseTool('stroke-select'); e.selectStrokesForPerspective(ids); setStrokeMode('perspective'); }, children: [_jsx(StudioPerspectiveIcon, { size: 21 }), _jsx("span", { children: "Perspective" })] }), _jsxs("button", { className: "stroke-apply", title: "Apply transformation", onClick: () => engine.current?.applySelection(), children: [_jsx(Check, { size: 15 }), " Apply"] }), _jsx("button", { title: "Cancel selection", onClick: () => engine.current?.clearSelection(), children: _jsx(X, { size: 15 }) })] }), tool === 'stroke-select' && !advancedStrokeTransform && _jsxs(FloatingTransformPanel, { id: "stroke", className: "stroke-select-floating", label: "Stroke selection and transform tools", children: [_jsxs("span", { className: "stroke-select-title", title: "Selected strokes glow teal", children: [_jsx(StudioStrokeSelectIcon, { size: 13 }), " ", strokeCount ? `${strokeCount} STROKES` : 'STROKE TOOLS'] }), _jsx("div", { className: "stroke-select-divider" }), _jsxs("button", { type: "button", title: "Select strokes", className: "stroke-mode-button", onClick: () => { engine.current?.setStrokeMode('select'); setStrokeMode('select'); }, children: [_jsx(StudioStrokeSelectIcon, { size: 21 }), _jsx("span", { children: "Select" })] }), _jsxs("button", { type: "button", title: "Lasso select", className: "stroke-mode-button", onClick: () => { engine.current?.setStrokeMode('lasso'); setStrokeMode('lasso'); }, children: [_jsx(StudioLassoIcon, { size: 21 }), _jsx("span", { children: "Lasso" })] }), _jsxs("button", { type: "button", title: "Open Transform tool with selection", className: "stroke-mode-button", disabled: !strokeCount, onClick: () => { chooseTool('transform'); }, children: [_jsx(StudioMoveIcon, { size: 21 }), _jsx("span", { children: "Transform\u2026" })] }), _jsxs("button", { disabled: !strokeCount, className: "stroke-apply", title: "Delete selected", onClick: () => engine.current?.deleteSelectedArtwork(), children: [_jsx(Trash2, { size: 15 }), " Delete"] }), _jsx("button", { disabled: !strokeCount, title: "Cancel", onClick: () => { engine.current?.clearSelection(); setStrokeMode('select'); }, children: _jsx(X, { size: 15 }) })] }), busy && _jsxs("div", { className: "fill-progress", role: "status", children: [_jsx("span", { className: "spinner" }), "Filling region\u2026"] }), tool !== 'transform' && hasSelection && strokeCount === 0 && _jsxs("div", { className: "selection-actions", children: [_jsx("span", { children: "Selection ready" }), _jsx("button", { onClick: () => chooseTool('transform'), children: "Transform" }), _jsxs("button", { className: "accent-button", onClick: () => engine.current?.applySelection(), children: [_jsx(Check, { size: 14 }), "Apply"] }), _jsxs("button", { onClick: () => engine.current?.deleteSelectedArtwork(), title: "Clear inside the lasso / rectangle on the active raster layer (Delete / \u232B)", children: [_jsx(Trash2, { size: 13 }), " Delete Selected ", _jsx("kbd", { children: "\u232B" })] }), _jsx("button", { onClick: () => engine.current?.clearSelection(), children: "Cancel" })] })] }), timelineView === 'xsheet' && _jsxs("aside", { ref: xsheetDock, className: "xsheet-side-dock", style: { width: xsheetWidth }, "aria-label": 'Xsheet docked ' + xsheetSide, children: [_jsx("div", { className: "xsheet-dock-resizer", role: "separator", "aria-label": "Resize Xsheet side panel", title: "Drag to resize Xsheet", onPointerDown: resizeXsheetDock }), _jsxs("div", { className: "xsheet-dock-controls", children: [_jsx("strong", { children: "XSHEET" }), _jsxs("div", { children: [_jsxs("button", { title: "Dock Xsheet on the left", "aria-pressed": xsheetSide === 'left', className: xsheetSide === 'left' ? 'selected' : '', onClick: () => setXsheetSide('left'), children: [_jsx(PanelLeftOpen, { size: 14 }), " Left"] }), _jsxs("button", { title: "Dock Xsheet on the right", "aria-pressed": xsheetSide === 'right', className: xsheetSide === 'right' ? 'selected' : '', onClick: () => setXsheetSide('right'), children: [_jsx(PanelRightOpen, { size: 14 }), " Right"] }), _jsx("button", { title: "Close Xsheet (Shift+X)", "aria-label": "Close side Xsheet", onClick: toggleXsheetView, children: _jsx(X, { size: 14 }) })] })] }), _jsx(XsheetView, { project: doc, selectedFrameIds: selectedFrames.ids, selectedLayerIds: selectedLayers.ids, busy: busy, playbackExposure: playbackUpdate.state === 'stopped' ? null : playbackUpdate.exposure, onSelect: selectXsheetCell, onHoldChange: changeHoldForCel, onMakeKey: makeXsheetKey })] })] }), _jsxs("div", { className: "canvas-status", children: [_jsxs("span", { children: [_jsx(MousePointer2, { size: 12 }), workspaceMode === 'DRAW' ? 'DRAW' : 'ANIMATE', " \u00B7 ", activeTool.name, layer.locked ? ' · Layer locked' : ''] }), linkedCount(doc) > 1 && _jsxs("span", { title: "This artwork is shared with other linked cels. Shift+C to unlink.", children: [_jsx(Link2, { size: 12 }), " LINKED \u00D7", linkedCount(doc)] }), _jsxs("span", { children: ["Space + drag to pan ", _jsx("span", { className: "status-sep", children: "/" }), " Scroll to zoom"] }), _jsxs("button", { onClick: () => setModal('settings'), children: [_jsx(Keyboard, { size: 13 }), "Shortcuts"] })] })] }), _jsx("div", { className: "panel-resizer right-resizer", role: "separator", "aria-label": "Resize inspector", onPointerDown: e => resizePanel(e, 'right') }), _jsx("aside", { className: 'right-panel ' + (layout.rightClosed ? 'panel-closed' : ''), children: layout.rightClosed ? _jsxs("div", { className: "collapsed-tool-rail", role: "toolbar", "aria-label": "Collapsed inspector tools", children: [_jsx(IconButton, { label: "Expand inspector", onClick: () => setLayout(old => ({ ...old, rightClosed: false })), children: _jsx(PanelRightOpen, { size: 17 }) }), _jsx("span", { className: "rail-divider" }), [{ tab: 'inspector', label: 'Brush and tool settings', icon: SlidersHorizontal }, { tab: 'color', label: 'Color panel', icon: Palette }, { tab: 'reference', label: 'Reference images', icon: ImageIcon }, { tab: 'history', label: 'History', icon: Clock }, { tab: 'substitutions', label: 'Drawing substitutions', icon: Copy }, { tab: 'reuse', label: 'Linked drawings and cycles', icon: Film }, { tab: 'motion', label: 'Timing notes and motion arcs', icon: MapPinned }, { tab: 'camera', label: 'Scene camera', icon: Target }].map(item => _jsx(IconButton, { label: 'Open ' + item.label, active: rightTab === item.tab, onClick: () => { setRightTab(item.tab); setLayout(old => ({ ...old, rightClosed: false })); }, children: _jsx(item.icon, { size: 17 }) }, item.tab))] }) : _jsxs(_Fragment, { children: [_jsxs("div", { className: "inspector-tabs", children: [['inspector', 'color', 'reference', 'history', 'substitutions', 'reuse', ...(rightTab === 'motion' ? ['motion'] : []), 'camera'].map(t => _jsx("button", { "aria-label": t === 'camera' ? 'Open Scene camera' : undefined, className: rightTab === t ? 'active' : '', onClick: () => setRightTab(t), children: t.toUpperCase() }, t)), _jsx(IconButton, { label: "Collapse inspector", onClick: () => setLayout({ ...layout, rightClosed: true }), children: _jsx(PanelRightClose, { size: 13 }) })] }), _jsxs("div", { className: "inspector-scroll", children: [_jsx("div", { className: "navigation-tools", "aria-label": "Tools", children: ['draw', 'select', 'transform', 'view', 'color'].map(group => {
                                                const items = toolRegistry.filter(t => t.group === group);
                                                return _jsxs(Fragment, { children: [group !== 'draw' && _jsx("span", { className: "tool-group-divider" }), items.map(t => _jsx(IconButton, { label: t.name + ' (' + t.key + ')', active: tool === t.id, onClick: () => chooseTool(t.id), children: _jsx(t.icon, { size: 16 }) }, t.id))] }, group);
                                            }) }), (tool === 'transform' || advancedStrokeTransform) && rightTab === 'inspector' && _jsxs("section", { className: "transform-inspector-shell", "aria-label": "Transform tool settings", children: [_jsxs("div", { className: "transform-inspector-heading", children: [_jsx("span", { className: "transform-inspector-emblem", children: "\u25C7" }), _jsx("strong", { children: "TRANSFORM" }), _jsx("small", { children: "TOOL INSPECTOR" })] }), _jsx("div", { id: "transform-inspector-slot", className: "transform-inspector-slot" })] }), rightTab === 'recorder' && engineReady && _jsx(DrawingBugRecorderPanel, { engine: engineReady, notify: notify, close: () => setRightTab('inspector'), advanced: () => setRightTab('diagnostics') }), rightTab === 'diagnostics' && _jsx(DrawingDiagnostics, { engine: engine, notify: notify, close: () => setRightTab('inspector') }), rightTab === 'substitutions' && _jsx(SubstitutionShelf, { items: substitutionItems(doc), layerName: layer.name, selectedCount: strokeCount, disabled: busy, onSave: captureSubstitution, onApply: insertSubstitution, onRename: changeSubstitutionName, onDelete: removeSubstitutionFromShelf }), rightTab === 'reuse' && _jsx(ReuseShelf, { frames: frameList(doc).map((f, index) => ({ id: f.id, index })), currentId: frameList(doc)[currentFrameIndex(doc)].id, layerName: layer.name, linkCount: linkedCount(doc), cycles: cycleItems(doc), disabled: busy, linkTarget: linkTargetFrameId, onLinkTargetChange: setLinkTargetFrameId, linkShortcut: shortcuts.linkCel, unlinkShortcut: shortcuts.unlinkCel, onLink: linkDrawingToFrame, onUnlink: unlinkDrawing, onCapture: captureCycle, onInsert: insertCycle, onDelete: removeCycle }), rightTab === 'motion' && motionToolsOpen && _jsx(MotionPlanningPanel, { planning: doc.motionPlanning, frameId: frameList(doc)[currentFrameIndex(doc)].id, frameName: 'Frame ' + (currentFrameIndex(doc) + 1), layerName: layer.name, disabled: busy, selectedStrokeCount: strokeCount, frames: frameList(doc).map((f, index) => ({ id: f.id, index })), editingPoints: motionArcEditing, onEditingPoints: enabled => { setMotionArcEditing(enabled); if (!enabled)
                                                setAddingMotionDot(false); }, addingDot: addingMotionDot, onAddingDot: value => { setAddingMotionDot(value); if (value && playbackIsRunning) {
                                                setShowPathDuringPlayback(true);
                                                setEditPathWhilePlaying(true);
                                            } }, selectedDotId: selectedMotionDotId, onRemoveDot: removeSelectedMotionDot, showDuringPlayback: showPathDuringPlayback, onShowDuringPlayback: value => { setShowPathDuringPlayback(value); if (!value)
                                                setEditPathWhilePlaying(false); }, editWhilePlaying: editPathWhilePlaying, onEditWhilePlaying: value => { setEditPathWhilePlaying(value); if (value) {
                                                setShowPathDuringPlayback(true);
                                                setMotionArcEditing(true);
                                            } }, selectedFrameIndices: selectedFrames.ids.map(id => motionFrameIds.indexOf(id)).filter(n => n >= 0), activeArcId: activeMotionArcId, onArcSelected: id => { setActiveMotionArcId(id); setSelectedMotionDotId(''); setAddingMotionDot(false); }, onQuickCreate: quickCreateMotionPath, onModeChange: (id, mode) => updateMotionData(setMotionPathMode(store.getSnapshot(), id, mode), 'Motion path editing mode'), onBindSelection: bindSelectedMotionStrokes, onBindLayerRange: bindMotionLayerRange, onUnbind: id => { const p = store.getSnapshot(); updateMotionData(unbindArcFrame(p, id, frameList(p)[currentFrameIndex(p)].id), 'Unbind frame from arc'); }, onApplyArc: applyMotionArc, onSaveNote: text => updateMotionData(setCurrentTimingNote(store.getSnapshot(), text), 'Timing note'), onNewArc: name => { const before = store.getSnapshot(); const next = createMotionArc(before, name); if (next !== before) {
                                                updateMotionData(next, 'Create motion arc');
                                                setActiveMotionArcId(next.motionPlanning?.arcs.at(-1)?.id ?? '');
                                            } }, onDeleteArc: id => updateMotionData(removeMotionArc(store.getSnapshot(), id), 'Remove motion arc'), onCapturePoint: captureMotionPoint, onSetPoint: (id, x, y) => { const p = store.getSnapshot(); updateMotionPoint(id, frameList(p)[currentFrameIndex(p)].id, x, y, 'Set motion point'); }, onDeletePoint: id => { const p = store.getSnapshot(); updateMotionData(removeMotionArcPoint(p, id, frameList(p)[currentFrameIndex(p)].id), 'Remove motion point'); } }), rightTab === 'batch-transform' && _jsx(MultiCelTransformPanel, { frameCount: selectedFrames.ids.filter(id => motionFrameIds.includes(id)).length, layerCount: selectedLayers.ids.filter(id => layerIds.includes(id)).length, activeLayerName: layer.name, disabled: busy, onApply: applyBatchTransform }), rightTab === 'camera' && _jsx(SceneCameraPanel, { project: doc, frame: cameraExposure, frameCount: cameraPlan.length, renderer: engineReady?.renderer, activeLayerId: doc.activeLayerId, onCommit: commitCamera, onGoToFrame: goToCameraExposure }), rightTab === 'history' && _jsxs(Section, { title: "HISTORY", icon: _jsx(Clock, { size: 14 }), children: [_jsx("p", { className: "hint", children: "Click an action to restore that document state. New edits replace the redo branch." }), _jsx("div", { className: "history-list", children: store.getHistory().map(entry => _jsxs("button", { className: (entry.current ? 'active ' : '') + (entry.future ? 'future' : ''), "aria-current": entry.current ? 'step' : undefined, disabled: busy, onClick: () => { engine.current?.cancelGesture(); engine.current?.clearSelection(); store.goTo(entry.index); }, children: [_jsx("span", { children: entry.index.toString().padStart(2, '0') }), entry.label] }, entry.id)) })] }), rightTab === 'inspector' && _jsxs(_Fragment, { children: [(tool === 'brush' || tool === 'eraser') && !layer.reference && _jsx(BrushStudio, { library: brushLibrary, eraser: tool === 'eraser', onChange: stablePanelHandlers.current.brushChange, notify: stablePanelHandlers.current.notice, onToggleMode: toggleMixMode }), tool === 'vector' && _jsx(VectorStudio, { line: selectedVector, defaults: vectorDefaults, setDefaults: setVectorDefaults, style: p => engine.current?.vectors.style(p), transform: (x, y, scale, angle) => engine.current?.vectors.transform(x, y, scale, angle), smooth: amount => engine.current?.vectors.smooth(amount), remove: () => engine.current?.vectors.delete(), exportLine: () => { if (selectedVector)
                                                        downloadBlob(new Blob([vectorSvg(selectedVector, doc.width, doc.height)], { type: 'image/svg+xml' }), 'vector-line.svg'); } }), layer.kind !== 'vector' && !layer.reference && ['brush', 'eraser', 'lasso', 'rectangle'].includes(tool) && _jsxs(Section, { title: "POST-STROKE SMOOTHING", children: [_jsx(Range, { label: "Post smoothness", value: postAmount, onChange: setPostAmount }), _jsx("p", { className: "hint", children: "Refine whole strokes without changing their captured points. Preview, then apply as one undo step." }), _jsx("button", { className: "full-width", onClick: () => engine.current?.smoothing.preview(postAmount, 'last'), children: "Preview last stroke" }), _jsx("button", { className: "full-width", disabled: !hasSelection, onClick: () => engine.current?.smoothing.preview(postAmount, 'selection', engine.current.selection), children: "Preview selected strokes" }), smoothingActive && _jsxs("div", { className: "studio-preset-actions", children: [_jsx("button", { className: "accent-button", onClick: () => engine.current?.smoothing.apply(), children: "Apply smoothing" }), _jsx("button", { onClick: () => engine.current?.smoothing.cancel(), children: "Cancel smoothing" })] })] }), tool === 'stroke-select' && _jsxs(Section, { title: "STROKE SELECT \u00B7 S", children: [_jsx("p", { className: "hint", children: "Select: click the exact drawn stroke to highlight it, with no square. Shift-click more strokes. Lasso: loop around the character; each selected stroke glows individually." }), _jsxs("label", { className: "studio-select", children: ["Lasso behavior", _jsxs("select", { "aria-label": "Stroke lasso behavior", value: strokePickMode, onChange: e => { const v = e.target.value; setStrokePickMode(v); engine.current?.setPickMode(v); }, children: [_jsx("option", { value: "touch", children: "Touched or enclosed strokes" }), _jsx("option", { value: "enclose", children: "Fully enclosed strokes only" })] })] }), _jsxs("label", { className: "studio-select", children: ["Selection area", _jsxs("select", { "aria-label": "Stroke marquee shape", value: strokeShape, onChange: e => { const shape = e.target.value; setStrokeShape(shape); engine.current?.setStrokeShape(shape); if (shape === 'lasso') {
                                                                        engine.current?.setStrokeMode('lasso');
                                                                        setStrokeMode('lasso');
                                                                    }
                                                                    else {
                                                                        engine.current?.setStrokeMode('select');
                                                                        setStrokeMode('select');
                                                                    } }, children: [_jsx("option", { value: "lasso", children: "Freehand Lasso" }), _jsx("option", { value: "rectangle", children: "Rectangle marquee" })] })] }), _jsxs("p", { className: "hint", children: ["For a character drawn on several layers choose ", _jsx("b", { children: "All visible" }), " on the toolbar; hidden and locked layers are protected. Choose ", _jsx("b", { children: "Freeform" }), " for Move, Scale, Rotate and Perspective in one tool. Drag inside to move, corners or side handles to scale, circular arrow/ring to rotate; switch to Perspective corners (or Ctrl+drag a corner) to warp. The original separate tools remain available."] }), _jsx("p", { className: "hint", children: "Mac keyboard on Windows: Option = Alt. Option+S Select, +L Lasso, +T Freeform, +V Move, +G Scale, +R Rotate, +P Perspective Scale, Option+Shift+P Perspective Move. Enter applies \u00B7 Esc cancels." }), _jsx("p", { className: "hint", children: "Imported bitmap fills and erased marks are not independently selectable by stroke ID." })] }), tool === 'fill' && _jsx(FillInspector, { settings: fillSettings, onChange: setFillSettings, project: doc, tolerance: brush.tolerance, setTolerance: tolerance => setBrush({ tolerance }) }), (tool === 'lasso' || tool === 'rectangle') && _jsxs(Section, { title: "SELECTION OPTIONS", children: [_jsxs("label", { className: "studio-select", children: ["Shape", _jsxs("select", { "aria-label": "Selection shape", value: tool, onChange: e => chooseTool(e.target.value), children: [_jsx("option", { value: "lasso", children: "Freehand Lasso" }), _jsx("option", { value: "rectangle", children: "Rectangle" })] })] }), _jsx("p", { className: "hint", children: "Release to finish. Canceled input retains its captured boundary. Choose Transform to move, scale or rotate." })] }), layer.reference && _jsx("p", { className: "reference-hint", children: "This is a reference layer. Use the Reference tab to place it, or select an artwork layer to draw." }), (tool === 'hand' || tool === 'zoom' || tool === 'rotate') && _jsxs(Section, { title: "CANVAS NAVIGATION", children: [_jsx("p", { className: "hint", children: "Hand: drag to pan. Zoom: click or drag horizontally; Alt-click zooms out. Rotate: drag around the workspace center; hold Shift for 15\u00B0 steps." }), _jsx("button", { className: "full-width", onClick: () => engine.current?.fit(), children: "Fit rotated canvas" }), _jsx("button", { className: "full-width", onClick: () => engine.current?.rotate(0), children: "Reset canvas rotation" })] }), tool === 'eyedropper' && _jsx(Section, { title: "EYEDROPPER", children: _jsx("p", { className: "hint", children: "Click to sample visible artwork in project coordinates, including layer opacity and blending. Reference images are excluded." }) })] }), rightTab === 'color' && _jsx(ColorStudio, { color: drawingColor, onChange: setDrawingColor }), rightTab === 'reference' && _jsx(ReferenceStudio, { project: doc, importImage: file => void engine.current?.references.import(file), update: (id, p) => engine.current?.references.update(id, p), edit: (id, p) => commit(editLayer(doc, id, p)), select: id => { if (!busy) {
                                                engine.current?.cancelGesture();
                                                store.select(id);
                                            } } }), rightTab === 'inspector' && _jsxs(_Fragment, { children: [_jsxs(Section, { title: "DISPLAY", icon: _jsx(Maximize, { size: 14 }), children: [_jsxs("label", { className: "check-row", children: [_jsx("span", { children: "Frame guides" }), _jsx("input", { "aria-label": "Frame guides", type: "checkbox", checked: doc.settings.guides, onChange: e => commit({ ...doc, settings: { ...doc.settings, guides: e.target.checked } }) })] }), _jsxs("button", { className: "full-width", onClick: () => engine.current?.fit(), children: [_jsx(Maximize, { size: 13 }), "Fit canvas to workspace"] })] }), _jsxs("div", { className: "future-section", children: [_jsxs("div", { children: [_jsx("span", { className: "future-star", children: "\u2727" }), _jsx("strong", { children: "SMART IN-BETWEEN" }), _jsx("span", { className: "planned-badge", children: "PLANNED" })] }), _jsxs("p", { children: ["Great motion starts with a great drawing.", _jsx("br", {}), "Let\u2019s build the foundation first."] }), _jsxs("button", { onClick: () => setModal('roadmap'), children: ["Explore the roadmap ", _jsx(ChevronRight, { size: 12 })] })] })] })] })] }) }), _jsxs("section", { className: "timeline", "aria-label": "Animation timeline", children: [_jsx("div", { className: "timeline-resizer", role: "separator", "aria-label": "Resize timeline: drag to make more or less drawing space", title: "Drag to resize timeline \u00B7 double-click to compact", onDoubleClick: () => setLayout(old => ({ ...old, bottom: 184, bottomClosed: false })), onPointerDown: e => resizePanel(e, 'bottom') }), _jsxs("div", { className: "timeline-header", children: [_jsxs("div", { children: [_jsx(Film, { size: 14 }), _jsx("strong", { children: "TIMELINE" }), _jsx("span", { className: "planned-badge", children: "HOLD DRAG" })] }), _jsxs("button", { className: "xsheet-switch", "aria-pressed": timelineView === 'xsheet', title: 'Show / hide side Xsheet (' + shortcuts.xsheet.toUpperCase() + ')', onClick: toggleXsheetView, children: [timelineView === 'xsheet' ? 'HIDE XSHEET' : 'SHOW XSHEET', " ", _jsx("kbd", { children: shortcuts.xsheet.toUpperCase() })] }), _jsxs("span", { className: "timeline-note", title: "Select a frame cell then press Delete / \u232B to delete it (or Shift+F7)", children: ["Cel ", currentFrameIndex(doc) + 1, "/", frameList(doc).length, " \u00B7 F", currentExposureRange(doc).start, currentExposureRange(doc).hold > 1 ? '–' + currentExposureRange(doc).end : '', "/", totalExposureFrames(doc)] }), _jsx("span", { className: "timeline-multiselect-help", title: "Shift-click: select a range. Option-click: select non-adjacent frames or layers.", children: frameSelectionSet.size > 1 || layerSelectionSet.size > 1 ? `${frameSelectionSet.size} frames · ${layerSelectionSet.size} layers selected` : 'Shift = range · Option = separate' }), _jsxs("div", { className: "timeline-actions", "aria-label": "Drawing frame actions", children: [_jsx(IconButton, { label: "Previous drawing frame (Page Up)", disabled: busy || currentFrameIndex(doc) === 0, onClick: () => stepDrawingFrame(-1), children: _jsx(SkipBack, { size: 15 }) }), _jsx(IconButton, { label: "Next drawing frame (Page Down)", disabled: busy || currentFrameIndex(doc) === frameList(doc).length - 1, onClick: () => stepDrawingFrame(1), children: _jsx(SkipForward, { size: 15 }) }), _jsx(IconButton, { label: "Add blank drawing frame (F6)", disabled: busy || frameList(doc).length >= MAX_DRAWING_FRAMES, onClick: () => animationAction('add'), children: _jsx(Plus, { size: 15 }) }), _jsx(IconButton, { label: "Duplicate current drawing frame (F7)", disabled: busy || frameList(doc).length >= MAX_DRAWING_FRAMES, onClick: () => animationAction('duplicate'), children: _jsx(Copy, { size: 14 }) }), _jsx(IconButton, { label: "Delete current drawing frame (Delete/\u232B after clicking the frame, or Shift+F7)", disabled: busy || frameList(doc).length <= 1, onClick: () => animationAction('delete'), children: _jsx(Trash2, { size: 14 }) })] }), _jsxs("div", { className: "exposure-controls", "aria-label": "Frame hold duration controls", children: [_jsx("span", { className: "exposure-label", children: "HOLD" }), _jsx(IconButton, { label: "Reduce hold by one frame (Shift+[)", disabled: busy || frameHold(frameList(doc)[currentFrameIndex(doc)]) <= 1, onClick: () => changeHold(frameHold(frameList(doc)[currentFrameIndex(doc)]) - 1), children: "\u2212" }), _jsx("input", { type: "number", min: "1", max: MAX_FRAME_HOLD, step: "1", "aria-label": "Hold current drawing for N frames", title: "How many frames to show this drawing (1\u201324)", defaultValue: frameHold(frameList(doc)[currentFrameIndex(doc)]), disabled: busy, onKeyDown: e => { if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    e.currentTarget.blur();
                                                }
                                                else if (e.key === 'Escape') {
                                                    e.stopPropagation();
                                                    e.currentTarget.value = String(frameHold(frameList(doc)[currentFrameIndex(doc)]));
                                                    e.currentTarget.blur();
                                                } }, onBlur: e => { const value = Number(e.currentTarget.value); if (Number.isInteger(value) && value >= 1 && value <= MAX_FRAME_HOLD)
                                                    changeHold(value);
                                                else
                                                    e.currentTarget.value = String(frameHold(frameList(doc)[currentFrameIndex(doc)])); } }, frameList(doc)[currentFrameIndex(doc)].id + ':' + frameHold(frameList(doc)[currentFrameIndex(doc)])), _jsx(IconButton, { label: "Increase hold by one frame (Shift+])", disabled: busy || frameHold(frameList(doc)[currentFrameIndex(doc)]) >= MAX_FRAME_HOLD, onClick: () => changeHold(frameHold(frameList(doc)[currentFrameIndex(doc)]) + 1), children: "+" }), _jsx("span", { className: "exposure-unit", children: "frames" })] }), _jsxs("div", { className: "flipbook-controls", "aria-label": "Flipbook quick previews", children: [_jsx("span", { className: "flipbook-label", children: "FLIP" }), _jsx(IconButton, { label: "Flipbook: click to toggle previous drawing; hold comma (,) to preview", active: flipPreview === -1, disabled: busy || currentFrameIndex(doc) === 0, onClick: () => toggleFlipPreview(-1), children: _jsx(ChevronsLeft, { size: 15 }) }), _jsx(IconButton, { label: "Flipbook: click to toggle next drawing; hold period (.) to preview", active: flipPreview === 1, disabled: busy || currentFrameIndex(doc) === frameList(doc).length - 1, onClick: () => toggleFlipPreview(1), children: _jsx(ChevronsRight, { size: 15 }) }), flipPreview !== null && _jsx("span", { className: "flipbook-status", children: "PREVIEW" })] }), _jsxs("div", { className: "onion-controls", "aria-label": "Onion skin controls", children: [_jsx(IconButton, { label: onionSettings.enabled ? 'Hide onion skin (O)' : 'Show onion skin (O)', active: onionSettings.enabled, onClick: () => setOnionSettings(s => ({ ...s, enabled: !s.enabled })), children: onionSettings.enabled ? _jsx(Eye, { size: 15 }) : _jsx(EyeOff, { size: 15 }) }), _jsx(IconButton, { label: "Onion skin settings", active: onionSettingsOpen, onClick: () => setOnionSettingsOpen(o => !o), children: _jsx(SlidersHorizontal, { size: 14 }) }), onionSettingsOpen && _jsxs("div", { className: "onion-settings", role: "group", "aria-label": "Onion skin settings", children: [_jsx("strong", { children: "ONION SKIN" }), _jsx("p", { children: "Ghosts are only guides. They are never saved into your drawings." }), _jsxs("label", { className: "onion-check", children: [_jsx("input", { type: "checkbox", checked: onionSettings.previous, onChange: e => setOnionSettings(s => ({ ...s, previous: e.target.checked })) }), _jsx("span", { className: "onion-swatch previous" }), " Previous drawing"] }), _jsxs("label", { className: "onion-count-row", children: ["Previous frames ", _jsx("select", { "aria-label": "Number of previous onion skin frames", value: onionSettings.previousCount, onChange: e => setOnionSettings(s => ({ ...s, previousCount: +e.target.value })), children: [0, 1, 2, 3, 4, 5].map(n => _jsx("option", { value: n, children: n }, n)) })] }), _jsx(Range, { label: "Previous opacity", value: onionSettings.previousOpacity, unit: "%", onChange: previousOpacity => setOnionSettings(s => ({ ...s, previousOpacity })) }), _jsxs("label", { className: "onion-check", children: [_jsx("input", { type: "checkbox", checked: onionSettings.next, onChange: e => setOnionSettings(s => ({ ...s, next: e.target.checked })) }), _jsx("span", { className: "onion-swatch next" }), " Next drawing"] }), _jsxs("label", { className: "onion-count-row", children: ["Next frames ", _jsx("select", { "aria-label": "Number of next onion skin frames", value: onionSettings.nextCount, onChange: e => setOnionSettings(s => ({ ...s, nextCount: +e.target.value })), children: [0, 1, 2, 3, 4, 5].map(n => _jsx("option", { value: n, children: n }, n)) })] }), _jsx(Range, { label: "Next opacity", value: onionSettings.nextOpacity, unit: "%", onChange: nextOpacity => setOnionSettings(s => ({ ...s, nextOpacity })) }), _jsxs("label", { className: "onion-check", children: [_jsx("input", { type: "checkbox", checked: onionSettings.currentLayerOnly, onChange: e => setOnionSettings(s => ({ ...s, currentLayerOnly: e.target.checked })) }), " Current drawing layer only"] }), _jsx("small", { children: "Press O to toggle. Color ghosts follow the canvas when you zoom or pan." })] })] }), _jsxs("div", { className: "light-table-controls", "aria-label": "Light table controls", children: [_jsx(IconButton, { label: 'Pin or unpin current drawing as a read-only light-table reference (' + shortcuts.pinLightTable.toUpperCase() + ')', active: lightTablePins.some(pin => pin.frameId === frameList(doc)[currentFrameIndex(doc)].id), onClick: pinLightTableFromShortcut, children: _jsx(Plus, { size: 13 }) }), _jsxs("button", { className: 'light-table-toggle' + (lightTablePins.length ? ' light-table-pinned' : ''), type: "button", title: 'Toggle Advanced Light Table (' + shortcuts.lightTable.toUpperCase() + ')', onClick: toggleLightTablePanel, "aria-expanded": lightTableOpen, children: ["LIGHT TABLE (", lightTablePins.length, ") ", _jsx("kbd", { children: shortcuts.lightTable.toUpperCase() })] }), lightTableOpen && _jsxs("div", { className: "light-table-panel", role: "group", "aria-label": "Pinned light table drawings", children: [_jsx("strong", { children: "PINNED DRAWINGS" }), _jsx("p", { children: "Pin up to five drawings, including non-adjacent poses. Overlays are never exported or painted onto the cel." }), _jsxs("button", { className: "light-table-add", disabled: lightTablePins.length >= MAX_LIGHT_TABLE_PINS && !lightTablePins.some(pin => pin.frameId === frameList(doc)[currentFrameIndex(doc)].id), onClick: pinLightTableFromShortcut, children: [lightTablePins.some(pin => pin.frameId === frameList(doc)[currentFrameIndex(doc)].id) ? 'Unpin current drawing' : 'Pin current drawing', " ", _jsx("kbd", { children: shortcuts.pinLightTable.toUpperCase() })] }), sanitizeLightTablePins(doc, lightTablePins).map(pin => {
                                                        const index = frameList(doc).findIndex(f => f.id === pin.frameId);
                                                        return _jsxs("div", { className: "light-table-entry", children: [_jsxs("div", { children: [_jsxs("strong", { children: ["Drawing ", index + 1] }), _jsx("button", { title: "Jump to pinned drawing", onClick: () => goToDrawingFrame(pin.frameId), children: "Go to" }), _jsx("button", { title: "Remove pinned drawing", onClick: () => setLightTablePins(old => old.filter(v => v.frameId !== pin.frameId)), children: _jsx(X, { size: 13 }) })] }), _jsxs("label", { children: ["Opacity ", pin.opacity, "%", _jsx("input", { type: "range", min: "0", max: "100", step: "1", value: pin.opacity, onChange: e => updateReferencePin(pin.frameId, { opacity: +e.target.value }) })] }), _jsxs("label", { children: ["Tint", _jsxs("select", { value: pin.tint, onChange: e => updateReferencePin(pin.frameId, { tint: e.target.value }), children: [_jsx("option", { value: "original", children: "Original colors" }), _jsx("option", { value: "teal", children: "Teal" }), _jsx("option", { value: "red", children: "Red" })] })] }), _jsxs("label", { children: ["Scale ", Math.round(pin.scale * 100), "%", _jsx("input", { type: "range", min: "25", max: "250", step: "5", value: Math.round(pin.scale * 100), onChange: e => updateReferencePin(pin.frameId, { scale: +e.target.value / 100 }) })] }), _jsxs("label", { children: ["Rotation ", pin.angle, "\u00B0", _jsx("input", { type: "range", min: "-180", max: "180", step: "5", value: pin.angle, onChange: e => updateReferencePin(pin.frameId, { angle: +e.target.value }) })] }), _jsxs("div", { className: "light-table-nudge", children: [_jsx("span", { children: "Shift guide" }), _jsx("button", { onClick: () => updateReferencePin(pin.frameId, { dx: pin.dx - 5 }), children: "\u2190" }), _jsx("button", { onClick: () => updateReferencePin(pin.frameId, { dx: pin.dx + 5 }), children: "\u2192" }), _jsx("button", { onClick: () => updateReferencePin(pin.frameId, { dy: pin.dy - 5 }), children: "\u2191" }), _jsx("button", { onClick: () => updateReferencePin(pin.frameId, { dy: pin.dy + 5 }), children: "\u2193" }), _jsx("button", { onClick: () => updateReferencePin(pin.frameId, { dx: 0, dy: 0, scale: 1, angle: 0 }), children: "Reset" })] })] }, pin.frameId);
                                                    }), !lightTablePins.length && _jsx("small", { children: "No pinned drawings yet. Select a drawing in the timeline and pin it here." })] })] }), _jsx(IconButton, { label: "Compact timeline (184 px)", onClick: () => { setFocusMode(false); setLayout(old => ({ ...old, bottom: 184, bottomClosed: false })); }, children: _jsx(Minimize2, { size: 13 }) }), _jsx("button", { className: "timeline-collapse", title: "Collapse or expand timeline region", onClick: () => { stopPlayback(); setLayout({ ...layout, bottomClosed: !layout.bottomClosed }); }, children: _jsx(ChevronDown, { size: 14, style: { transform: layout.bottomClosed ? 'rotate(180deg)' : '' } }) })] }), !layout.bottomClosed && _jsx("div", { className: "timeline-playback-strip", children: _jsxs("div", { className: "playback-controls", "aria-label": "Animation playback controls", children: [_jsx(IconButton, { label: playbackUpdate.state === 'playing' || playbackUpdate.state === 'preparing' || playbackUpdate.state === 'buffering' ? 'Pause animation (Shift+Space)' : 'Play animation (Shift+Space)', active: playbackUpdate.state !== 'stopped', disabled: busy, onClick: togglePlayback, children: playbackUpdate.state === 'playing' || playbackUpdate.state === 'preparing' || playbackUpdate.state === 'buffering' ? _jsx(Pause, { size: 14 }) : _jsx(Play, { size: 14 }) }), _jsx(IconButton, { label: "Stop playback and return to active drawing", disabled: playbackUpdate.state === 'stopped', onClick: stopPlayback, children: _jsx(Square, { size: 13 }) }), _jsxs("label", { className: "playback-fps-label", children: ["FPS", _jsx("input", { type: "number", min: PLAYBACK_FPS_MIN, max: PLAYBACK_FPS_MAX, step: "1", defaultValue: fps, "aria-label": "Playback frames per second", onKeyDown: e => { if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        e.currentTarget.blur();
                                                    }
                                                    else if (e.key === 'Escape') {
                                                        e.stopPropagation();
                                                        e.currentTarget.value = String(fps);
                                                        e.currentTarget.blur();
                                                    } }, onBlur: e => { const value = Number(e.currentTarget.value); if (Number.isInteger(value) && value >= PLAYBACK_FPS_MIN && value <= PLAYBACK_FPS_MAX)
                                                        setFps(value);
                                                    else
                                                        e.currentTarget.value = String(fps); } }, 'fps-' + fps)] }), _jsxs("label", { className: "playback-loop-label", children: [_jsx("input", { type: "checkbox", checked: loop, onChange: e => setLoop(e.target.checked) }), " Loop"] }), playbackUpdate.state !== 'stopped' && _jsxs("span", { className: "playback-exposure", "aria-live": "off", children: ["F", playbackUpdate.exposure, "/", totalExposureFrames(doc), " \u00B7 ", playbackUpdate.state === 'preparing' ? 'Preparing' : playbackUpdate.state === 'buffering' ? 'Buffering' : playbackUpdate.state === 'paused' ? 'Paused' : 'Playing'] })] }) }), !layout.bottomClosed && _jsx(AudioTrack, { audio: doc.audio, expanded: audioTrackOpen, shortcut: shortcuts.audioTrack, muted: audioMuted, busy: busy || audioBusy, exposure: playbackUpdate.state === 'stopped' ? currentExposureRange(doc).start : playbackUpdate.exposure, fps: fps, total: totalExposureFrames(doc), onToggle: audioActionCallbacks.current.toggle, onImport: audioActionCallbacks.current.importClip, onRemove: audioActionCallbacks.current.remove, onMute: audioActionCallbacks.current.mute, onSeek: audioActionCallbacks.current.seek }), !layout.bottomClosed && _jsxs("div", { className: "layer-cel-commandbar", children: [_jsxs("span", { children: [_jsx(Layers, { size: 12 }), " Independent layer cels"] }), _jsxs("button", { disabled: busy, title: "Create a new key drawing from the held picture at this frame (Alt+K)", onClick: () => newLayerKey(true), children: ["New layer key ", _jsx("kbd", { children: "Alt+K" })] }), _jsx("button", { disabled: busy, title: "Create a blank drawing only on the current layer (Alt+Shift+K)", onClick: () => newLayerKey(false), children: "Blank layer key" }), _jsx("button", { disabled: busy, title: "Extend selected layer drawing by one frame (Alt+])", onClick: () => stepLayerHold(1), children: "Hold +" }), _jsx("button", { disabled: busy, title: "Shorten selected layer drawing by one frame (Alt+[)", onClick: () => stepLayerHold(-1), children: "Hold \u2212" })] }), !layout.bottomClosed && _jsxs("div", { className: "timeline-body", children: [_jsxs("div", { ref: timelineTrack, className: "timeline-track", children: [_jsxs("span", { className: "layer-track-heading", children: [_jsx(Layers, { size: 13 }), "DRAWING FRAMES", _jsx("br", {}), " & LAYER CELS"] }), doc.layers.map(l => _jsxs("button", { className: 'layer-track-name ' + (l.id === layer.id ? 'active' : '') + (layerSelectionSet.has(l.id) ? ' multi-selected' : ''), title: 'Select ' + l.name + ' · Shift-click range · Option-click separate layers', onClick: e => { selectLayerWithModifier(l.id, e.shiftKey, e.altKey); stopPlayback(); store.select(l.id); }, children: [_jsx("span", { className: 'track-dot ' + (l.id === layer.id ? 'active' : '') }), _jsx("span", { className: "layer-name-text", children: l.name }), l.locked && _jsx(Lock, { size: 10 })] }, l.id))] }), _jsxs("div", { className: "timeline-grid", role: "group", "aria-label": "Drawing frames", onScroll: e => { if (timelineTrack.current)
                                            timelineTrack.current.scrollTop = e.currentTarget.scrollTop; }, children: [_jsx("div", { className: "timeline-frames", children: frameList(doc).map((frame, i) => {
                                                    const displayHold = holdPreview?.id === frame.id ? holdPreview.hold : frameHold(frame);
                                                    const start = frameExposureStart(doc, i);
                                                    return _jsx("div", { className: 'timeline-cel ' + (frameSelectionSet.has(frame.id) ? ' multi-selected ' : '') + (noteFrameIds.has(frame.id) ? 'has-timing-note ' : '') + (holdPreview?.id === frame.id ? 'resizing ' : '') + (playbackUpdate.state !== 'stopped' && i === playbackUpdate.celIndex ? 'playback-current ' : '') + (i === currentFrameIndex(doc) ? 'selected' : onionSettings.enabled && onionSettings.previous && i === currentFrameIndex(doc) - 1 ? 'onion-previous' : onionSettings.enabled && onionSettings.next && i === currentFrameIndex(doc) + 1 ? 'onion-next' : ''), title: 'Drawing ' + (i + 1) + ' · visible frames ' + start + (frameHold(frame) > 1 ? '–' + (start + frameHold(frame) - 1) : '') + ' · hold ' + frameHold(frame), style: { flexBasis: 47 + 10 * (displayHold - 1) }, children: _jsxs("button", { className: "cel-select", "aria-label": 'Select drawing ' + (i + 1) + ', held for ' + frameHold(frame) + ' frames', "aria-pressed": frameSelectionSet.has(frame.id) || i === currentFrameIndex(doc), title: 'Click to select, then Delete/⌫ to delete the drawing · drag to change hold (1–24). Hold ' + displayHold, onClick: e => clickCel(e, frame.id), onPointerDown: e => beginHoldDrag(e, frame.id, frameHold(frame)), onPointerMove: moveHoldDrag, onPointerUp: e => finishHoldDrag(e, true), onPointerCancel: e => finishHoldDrag(e, false), onLostPointerCapture: () => { if (holdDrag.current?.id === frame.id)
                                                                cancelHoldDrag(); }, children: [_jsx("span", { className: "cel-number", children: String(start).padStart(2, '0') }), noteFrameIds.has(frame.id) && _jsx("span", { className: "timing-note-marker", "aria-label": "Timing note saved", title: "Timing note saved for this drawing", children: "\u25CF" }), _jsx("span", { className: 'cel-art ' + (Object.values(frame.drawings).some(ops => ops.length > 0) ? 'has-art' : ''), children: Object.values(frame.drawings).some(ops => ops.length > 0) ? '●' : '+' }), _jsx("span", { className: "cel-hold", children: displayHold > 1 ? '×' + displayHold : '1f' })] }) }, frame.id);
                                                }) }), doc.layers.map(l => _jsx("div", { className: 'layer-cel-row ' + (l.id === layer.id ? 'active' : '') + (layerSelectionSet.has(l.id) ? ' multi-selected' : ''), "aria-label": l.name + ' animation track', children: frameList(doc).map((frame, i) => {
                                                    const held = isLayerHeld(doc, l.id, frame.id);
                                                    const preview = layerHoldPreview?.layerId === l.id;
                                                    const previewHeld = preview && i > layerHoldPreview.start && i <= layerHoldPreview.end;
                                                    const covered = preview && i > layerHoldPreview.end && i <= layerKeyEnd(doc, l.id, layerHoldPreview.start);
                                                    const shownHeld = previewHeld || (held && !covered);
                                                    return _jsxs("button", { "data-layer-frame-index": i, className: 'layer-exposure-cell ' + (shownHeld ? 'held' : 'key') + ' ' + (frameSelectionSet.has(frame.id) && layerSelectionSet.has(l.id) ? 'multi-selected ' : '') + (l.id === layer.id && i === currentFrameIndex(doc) ? 'active' : ''), style: { flexBasis: 47 + 10 * (frameHold(frame) - 1) }, disabled: busy, "aria-label": l.name + ' frame ' + (i + 1) + (shownHeld ? ' held drawing' : ' new drawing'), title: shownHeld ? l.name + ': holds previous key · Alt+K to make independent' : l.name + ': drawing key · drag to extend or shorten hold', onClick: e => clickLayerFrame(e, l.id, frame.id), onPointerDown: e => layerPointerDown(e, l.id, i), onPointerMove: layerPointerMove, onPointerUp: e => finishLayerDrag(e, true), onPointerCancel: e => finishLayerDrag(e, false), children: [_jsx("span", { children: shownHeld ? '↪' : frame.drawings[l.id]?.length ? '●' : '◇' }), shownHeld && _jsx("small", { children: "HOLD" })] }, frame.id);
                                                }) }, 'track-' + l.id)), _jsx("div", { className: "layer-track-help", children: "Layer tracks: drag a key cel to hold it across later frames \u00B7 click a held cel, then Alt+K to copy it into a new editable key \u00B7 Alt+Shift+K for blank \u00B7 Alt+[ / Alt+] adjust active layer hold \u00B7 Alt+\u2191 / Alt+\u2193 choose layer" }), _jsx("div", { className: "timeline-help", children: "Click to select \u00B7 Shift-click range \u00B7 Option-click separate frames/layers \u00B7 drag directly on the cel (or its right edge) to change HOLD \u00B7 Shift+[ / Shift+] adjust \u00B11 \u00B7 Shift+Space Play/Pause \u00B7 Page Up / Page Down Step \u00B7 F6 New / F7 Duplicate \u00B7 [ / ] Brush size \u00B7 , / . Flip \u00B7 O Onion" })] })] })] }), _jsx("div", { className: "wheel-overlay", children: _jsx(RadialToolbar, { active: tool, onTool: stablePanelHandlers.current.choose, workspace: workbench, homeOpen: !layout.leftClosed && !focusMode, onNotice: stablePanelHandlers.current.notice, mixMode: brushLibrary.mode === 'mix', onToggleMix: () => toggleMixMode() }) })] }), _jsxs("footer", { className: "app-footer", children: [_jsxs("span", { children: [_jsx("i", {}), " LOCAL WORKSPACE", _jsx("span", { className: "footer-divider" }), "All artwork stays on this device"] }), _jsxs("span", { children: [busy ? 'Processing fill' : hasSelection ? 'Selection active' : 'Ready to draw', _jsx("span", { className: "footer-divider" }), doc.width, " \u00D7 ", doc.height, " px", _jsx("span", { className: "footer-divider" }), _jsx(CameraPercent, { camera: camera })] })] }), _jsx("input", { ref: fileInput, type: "file", accept: ".json,.solo.json", hidden: true, onChange: async (e) => { const file = e.target.files?.[0]; if (file)
                    try {
                        await openProject(await importProject(file));
                    }
                    catch (err) {
                        notify('Import failed: ' + String(err));
                    } e.target.value = ''; } }), message && _jsxs("div", { className: "toast", role: "status", children: [message, _jsx("button", { "aria-label": "Dismiss notification", onClick: () => setMessage(''), children: _jsx(X, { size: 15 }) })] }), fillQuestion && _jsx("div", { className: "modal-backdrop", children: _jsxs("div", { className: "modal small", role: "dialog", "aria-modal": "true", "aria-labelledby": "fill-warning-title", children: [_jsx("h2", { id: "fill-warning-title", children: "Open fill boundary" }), _jsx("p", { children: fillQuestion.message }), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { onClick: () => { fillQuestion.resolve(false); setFillQuestion(null); }, children: "Cancel fill" }), _jsx("button", { className: "accent-button", onClick: () => { fillQuestion.resolve(true); setFillQuestion(null); }, children: "Fill anyway" })] })] }) }), renameId && _jsx("div", { className: "modal-backdrop", children: _jsxs("form", { className: "modal small", role: "dialog", "aria-modal": "true", "aria-labelledby": "rename-heading", onSubmit: e => { e.preventDefault(); if (renameValue.trim())
                        commit(editLayer(doc, renameId, { name: renameValue.trim() })); setRenameId(''); }, children: [_jsx("h2", { id: "rename-heading", children: "Rename layer" }), _jsx("input", { "aria-label": "Layer name", autoFocus: true, maxLength: 100, value: renameValue, onChange: e => setRenameValue(e.target.value) }), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { type: "button", onClick: () => setRenameId(''), children: "Cancel" }), _jsx("button", { className: "accent-button", children: "Rename" })] })] }) }), modal && _jsx("div", { className: "modal-backdrop", children: _jsxs("div", { className: 'modal ' + (['new', 'saveas', 'rename'].includes(modal) ? 'small' : ''), role: "dialog", "aria-modal": "true", "aria-labelledby": "dialog-title", children: [_jsx("button", { className: "modal-close", "aria-label": "Close dialog", onClick: closeModal, children: _jsx(X, { size: 18 }) }), ['new', 'saveas', 'rename'].includes(modal) ? _jsxs("form", { onSubmit: e => { e.preventDefault(); void submitProject(); }, children: [_jsx("span", { className: "eyebrow", children: "SOLO ANIME STUDIO" }), _jsx("h2", { id: "dialog-title", children: modal === 'new' ? 'A fresh canvas.' : modal === 'saveas' ? 'Save a new copy.' : 'Name your scene.' }), _jsxs("label", { className: "form-label", children: ["Project name", _jsx("input", { "aria-label": "Project name", autoFocus: true, maxLength: 100, value: name, onChange: e => setName(e.target.value), required: true })] }), modal === 'new' && _jsxs("label", { className: "form-label", children: ["Resolution", _jsxs("select", { "aria-label": "Project resolution", value: resolution, onChange: e => setResolution(e.target.value), children: [_jsx("option", { value: "1920x1080", children: "1920 \u00D7 1080 \u00B7 Full HD" }), _jsx("option", { value: "1280x720", children: "1280 \u00D7 720 \u00B7 HD" }), _jsx("option", { value: "1080x1080", children: "1080 \u00D7 1080 \u00B7 Square" }), _jsx("option", { value: "2048x2048", children: "2048 \u00D7 2048 \u00B7 Square" })] })] }), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { type: "button", onClick: closeModal, children: "Cancel" }), _jsx("button", { className: "accent-button", type: "submit", children: modal === 'new' ? 'Create project' : modal === 'saveas' ? 'Save copy' : 'Rename' })] })] }) : null, ['open', 'recover'].includes(modal) && _jsxs(_Fragment, { children: [_jsx("span", { className: "eyebrow", children: "ON THIS DEVICE" }), _jsx("h2", { id: "dialog-title", children: modal === 'recover' ? 'Welcome back.' : 'Open a project.' }), _jsx("p", { className: "modal-intro", children: modal === 'recover' ? 'Your saved work is here, including the latest successful autosaves.' : 'Choose a local project or import an editable .solo.json backup.' }), _jsx("div", { className: "project-list", children: records.length ? records.map(r => _jsxs("div", { className: "project-row", children: [_jsxs("button", { className: "project-open", disabled: deletingProjects, onClick: () => void openProject(r.project), children: [_jsx("span", { className: "project-list-icon", children: _jsx(Folder, { size: 19 }) }), _jsxs("span", { children: [_jsx("strong", { children: r.project.name }), _jsxs("small", { children: [r.project.width, " \u00D7 ", r.project.height, " \u00B7 ", r.project.layers.length, " layers \u00B7 ", r.kind === 'autosave' ? 'Autosaved' : 'Saved', " ", new Date(r.savedAt).toLocaleString()] })] }), _jsx(ChevronRight, { size: 15 })] }), r.id === doc.id ? _jsx("span", { className: "project-current", title: "Switch to a different project before deleting this one", children: "OPEN" }) : _jsx("label", { className: "project-delete-choice", title: `Select ${r.project.name} for deletion`, children: _jsx("input", { type: "checkbox", "aria-label": `Select ${r.project.name} for deletion`, checked: deleteSelection.includes(r.id), disabled: deletingProjects, onChange: event => toggleProjectForDeletion(r.id, event.target.checked) }) })] }, r.id)) : _jsx("p", { className: "hint", children: "No saved projects yet. Save your scene to find it here." }) }), records.length > 0 && _jsxs("div", { className: "project-delete-actions", children: [_jsx("span", { children: "Select old projects to remove. Your open project is protected." }), _jsxs("button", { type: "button", className: "project-delete-button", disabled: !deleteSelection.length || deletingProjects, onClick: () => void deleteSelectedProjects(), children: [_jsx(Trash2, { size: 14 }), deletingProjects ? 'Deleting…' : `Delete selected (${deleteSelection.length})`] })] }), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { onClick: () => fileInput.current?.click(), children: "Import backup\u2026" }), _jsx("button", { className: "accent-button", onClick: closeModal, children: modal === 'recover' ? 'Start with blank canvas' : 'Close' })] })] }), modal === 'snapshots' && _jsxs(_Fragment, { children: [_jsx("span", { className: "eyebrow", children: "RECOVERY" }), _jsx("h2", { id: "dialog-title", children: "Saved snapshots." }), _jsx("p", { className: "modal-intro", children: "The last 10 successful saves for this project. Restoring can be undone only by reopening a newer snapshot." }), _jsxs("div", { className: "project-list", children: [snapshots.map(s => _jsxs("button", { onClick: () => void openProject(s.project), children: [_jsx(Clock, { size: 18 }), _jsxs("span", { children: [_jsx("strong", { children: new Date(s.savedAt).toLocaleString() }), _jsxs("small", { children: [s.kind, " \u00B7 ", s.project.layers.reduce((n, l) => n + l.operations.length, 0), " drawing operations"] })] }), _jsx(ChevronRight, { size: 14 })] }, s.key)), !snapshots.length && _jsx("p", { children: "No snapshots yet. Save this project first." })] })] }), modal === 'export' && _jsx(PngExport, { project: doc, onExport: options => void exportPng(options) }), modal === 'sequence' && _jsxs(_Fragment, { children: [_jsx(SequenceExport, { project: doc, fps: fps, busy: sequenceBusy, onExport: options => void exportSequence(options) }), sequenceBusy && _jsxs("div", { className: "sequence-progress", role: "status", children: [sequenceProgress?.phase ?? 'Preparing', " \u00B7 ", sequenceProgress?.finished ?? 0, "/", sequenceProgress?.total ?? 0, _jsx("button", { onClick: () => sequenceAbort.current?.abort(), children: "Cancel export" })] })] }), modal === 'settings' && _jsxs(_Fragment, { children: [_jsx("span", { className: "eyebrow", children: "MAKE IT YOURS" }), _jsx("h2", { id: "dialog-title", children: "Keyboard & workspace." }), _jsx("p", { className: "modal-intro", children: "Click a tool key to change it. Shortcuts pause while you type." }), _jsx(ShortcutEditor, { bindings: shortcuts, onChange: setShortcuts, notify: notify }), _jsxs("div", { className: "fixed-shortcuts", children: [_jsxs("span", { children: ["Temporary pan ", _jsx("kbd", { children: "Space + drag" })] }), _jsxs("span", { children: ["Undo ", _jsx("kbd", { children: "Ctrl/\u2318 Z" })] }), _jsxs("span", { children: ["Redo ", _jsx("kbd", { children: "Ctrl/\u2318 Shift Z / Y" })] }), _jsxs("span", { children: ["Save ", _jsx("kbd", { children: "Ctrl/\u2318 S" })] }), _jsxs("span", { children: ["Apply transform ", _jsx("kbd", { children: "Enter" })] }), _jsxs("span", { children: ["Stroke Select ", _jsx("kbd", { children: "S" })] }), _jsxs("span", { children: ["Freeform Transform ", _jsx("kbd", { children: "Option/Alt + T" })] }), _jsxs("span", { children: ["Perspective scale ", _jsx("kbd", { children: "Option/Alt + P" })] }), _jsxs("span", { children: ["Perspective move ", _jsx("kbd", { children: "Option/Alt + Shift + P" })] }), _jsxs("span", { children: ["Duplicate strokes ", _jsx("kbd", { children: "Ctrl/\u2318 J" })] }), _jsxs("span", { children: ["Cancel selection ", _jsx("kbd", { children: "Esc" })] })] }), _jsx("div", { className: "fixed-shortcut-heading", children: "CANVAS & ANIMATION SHORTCUTS" }), _jsxs("div", { className: "fixed-shortcuts", children: [_jsxs("span", { children: ["Canvas Focus Mode ", _jsx("kbd", { children: "F9" })] }), _jsxs("span", { children: ["Compact timeline ", _jsx("kbd", { children: "Double-click top edge" })] }), _jsxs("span", { children: ["Show / hide side Xsheet ", _jsx("kbd", { children: shortcuts.xsheet.toUpperCase() })] }), _jsxs("span", { children: ["Drawing Substitution Shelf ", _jsx("kbd", { children: shortcuts.substitutionShelf.toUpperCase() })] }), _jsxs("span", { children: ["Linked Drawings & Cycles ", _jsx("kbd", { children: shortcuts.reuseShelf.toUpperCase() })] }), _jsxs("span", { children: ["Timing Notes & Motion Arcs ", _jsx("kbd", { children: shortcuts.motionPlanning.toUpperCase() })] }), _jsxs("span", { children: ["Manage local projects ", _jsx("kbd", { children: shortcuts.openProjects.toUpperCase() })] }), _jsxs("span", { children: ["Link to selected frame ", _jsx("kbd", { children: shortcuts.linkCel.toUpperCase() })] }), _jsxs("span", { children: ["Unlink current drawing ", _jsx("kbd", { children: shortcuts.unlinkCel.toUpperCase() })] }), _jsxs("span", { children: ["Pop out / return Tool Wheel ", _jsx("kbd", { children: "SHIFT+W" })] }), _jsxs("span", { children: ["Multi-Cel Transform ", _jsx("kbd", { children: shortcuts.batchTransform.toUpperCase() })] })] }), _jsx("div", { className: "fixed-shortcuts quick-shortcut-list", children: quickShortcutGuide.map(([action, chord]) => _jsxs("span", { children: [action, _jsx("kbd", { children: chord })] }, action)) }), _jsx("p", { className: "hint", children: "These fixed actions use different keys from the customizable drawing-tool letters. The O key is reserved for Onion Skin." }), _jsx("p", { className: "hint", children: "Focus Mode (F9) hides panels while keeping your current canvas zoom and center. Collapse either side into a quick-access icon rail; drag the timeline top edge to resize it. Panel widths, Xsheet side, timeline height and tool wheel placement are remembered. The wheel starts minimized outside the canvas; drag its grip anywhere in the app, or use Shift+W / the wheel options to pop it into a separate browser window. Browser security prevents dragging a wheel beyond the browser itself without a pop-out window." }), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { onClick: () => setShortcuts(initialShortcuts), children: "Reset shortcuts" }), _jsx("button", { className: "accent-button", onClick: closeModal, children: "Done" })] })] }), modal === 'help' && _jsxs(_Fragment, { children: [_jsx("span", { className: "eyebrow", children: "DRAWING STUDIO GUIDE" }), _jsx("h2", { id: "dialog-title", children: "A place to make your scene." }), _jsxs("div", { className: "help-content", children: [_jsxs("p", { children: [_jsx("strong", { children: "Draw." }), " Choose Brush or Eraser with B / E. Use [ and ] to reduce/increase the current brush, eraser, or vector size in 1 px steps. Brush settings include stabilization and a pressure response curve."] }), _jsxs("p", { children: [_jsx("strong", { children: "Workspace." }), " F9 gives you a large canvas without changing zoom, and F9 again restores every panel. Collapse the left and right panels to narrow icon rails. Drag the timeline top edge to resize; double-click it to compact."] }), _jsxs("p", { children: [_jsx("strong", { children: "Navigate." }), " Scroll or press - / = to zoom. Hold Space and drag to pan. Rotation, fit and reset are above the canvas."] }), _jsxs("p", { children: [_jsx("strong", { children: "Animate." }), " Layer tracks can hold Body while Hair has new keys. Drag a layer key across later columns, Alt+K makes a held cel independent, Alt+Shift+K makes it blank, Alt+[ / Alt+] changes only the selected layer's hold, and Alt+Up/Down switches layers. Page Up / Page Down steps between drawing cels. F6 adds a blank cel, F7 duplicates one, and Delete/\u232B deletes a clicked Timeline or Xsheet frame; Shift+F7 still deletes the active frame globally. Delete on canvas still removes selected strokes. Shift+M opens Motion Path Assist; Shift+T opens Multi-Cel Transform after Shift-clicking several frame cells; captured points make non-exported overlay guides. Shift+X opens/closes the left/right Xsheet dock while preserving the bottom Timeline. Shift+U opens Drawing Substitutions; Shift+C opens Linked Drawings & Cycles in the right panel; save selected strokes and insert independent copies into an unlocked drawing layer. Shift+[ / Shift+] changes a cel hold. O toggles onion skin, , / . previews adjacent frames, and Shift+Space plays or pauses."] }), _jsxs("p", { children: [_jsx("strong", { children: "Select / Delete." }), " Press S to select strokes (Shift-click or lasso the character), then press Delete/\u232B to delete those exact strokes. With the ordinary Lasso (L) or Rectangle (M), Delete/\u232B clears the selected area of the active raster layer. Press Control+Z to undo. Click a timeline cell first if you mean to delete a frame."] }), _jsxs("p", { children: [_jsx("strong", { children: "Audio." }), " In ANIMATE, use the Audio waveform strip beneath playback controls; Shift+A toggles its display. Import MP3/WAV or another Chrome-compatible audio clip up to 50 MB / 20 minutes. Click or drag the waveform to seek frames; Shift+Space plays/pause synced audio and animation. Audio is included in .solo.json backups, but autosave stores each audio asset once per project."] }), _jsxs("p", { children: [_jsx("strong", { children: "Fill." }), " G fills a connected region on the active layer. A region touching the output boundary asks for confirmation. For best results, close outlines on the same layer."] }), _jsxs("p", { children: [_jsx("strong", { children: "Save." }), " Ctrl/\u2318 S saves locally. Autosave runs 2.5 seconds after edits. File \u2192 Download editable backup keeps a portable copy. Browser storage can be cleared or evicted; download backups regularly. Open local projects with Control+Option+O on a Mac keyboard running Windows (Ctrl+Alt+O); select old projects and choose Delete selected. The currently open project cannot be deleted. Deletion also removes recovery snapshots."] }), _jsxs("p", { children: [_jsx("strong", { children: "Pen input." }), " Pointer Events use reported pen pressure. Real tablet compatibility has not been verified. Mouse input uses a consistent width."] })] })] }), modal === 'roadmap' && _jsxs(_Fragment, { children: [_jsx("span", { className: "eyebrow", children: "ONE MILESTONE AT A TIME" }), _jsx("h2", { id: "dialog-title", children: "From first line to final scene." }), _jsx("div", { className: "roadmap-list", children: [['01', 'Drawing Studio', 'Current scope · drawing, layers, selections & local projects'], ['02', 'Animation Studio', 'Planned · exposures, onion skin, timing, playback & audio'], ['03', 'Character Library', 'Planned · model sheets, poses, palettes & reusable cycles'], ['04', 'Smart In-Between', 'Planned · editable guides and assisted rough drafts'], ['05', 'Anime Production', 'Planned · cleanup, cameras, compositing & video export']].map(([n, t, d]) => _jsxs("div", { children: [_jsx("span", { children: n }), _jsxs("div", { children: [_jsx("strong", { children: t }), _jsx("p", { children: d })] })] }, n)) }), _jsx("p", { className: "hint", children: "Automated in-between generation is future work and cannot guarantee accurate interpolation between arbitrary drawings." })] }), modal === 'about' && _jsxs(_Fragment, { children: [_jsxs("span", { className: "eyebrow", children: ["VERSION ", buildInfo.version] }), _jsx("h2", { id: "dialog-title", children: "Solo Anime Studio" }), _jsxs("p", { className: "hint", style: { overflowWrap: "anywhere" }, children: ["Build ", buildInfo.mode, " \u00B7 source ", buildInfo.sourceDigest] }), _jsx("p", { className: "modal-intro", children: "A focused drawing foundation for independent anime artists." }), _jsxs("p", { className: "hint", children: ["React \u00B7 TypeScript \u00B7 Canvas 2D \u00B7 IndexedDB", _jsx("br", {}), "Editable version 3 format; version 1 and 2 imports are preserved. All drawing and saving happens in your browser."] }), _jsx("p", { className: "hint", children: lastSaved ? 'Last save: ' + new Date(lastSaved).toLocaleString() : 'No save has been confirmed for this project in this session.' })] })] }) })] });
}
