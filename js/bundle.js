/* ═══════════════════════════════════════════════════════════════════════════
   Courbes d'accélération
   Une animation contemporaine se joue sur l'amorti, pas sur la densité
   d'images clés : chaque segment peut porter sa courbe (`{ t, v, e }`).
   ═══════════════════════════════════════════════════════════════════════════ */

const EASING = {
    linear: (p) => p,
    sineIn: (p) => 1 - Math.cos((p * Math.PI) / 2),
    sineOut: (p) => Math.sin((p * Math.PI) / 2),
    sineInOut: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
    cubicIn: (p) => p * p * p,
    cubicOut: (p) => 1 - Math.pow(1 - p, 3),
    cubicInOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    expoIn: (p) => (p === 0 ? 0 : Math.pow(2, 10 * p - 10)),
    expoOut: (p) => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    expoInOut: (p) => {
        if (p === 0 || p === 1) return p;
        return p < 0.5
            ? Math.pow(2, 20 * p - 10) / 2
            : (2 - Math.pow(2, -20 * p + 10)) / 2;
    },
    backOut: (p) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    },
    backInOut: (p) => {
        const c2 = 1.70158 * 1.525;
        return p < 0.5
            ? (Math.pow(2 * p, 2) * ((c2 + 1) * 2 * p - c2)) / 2
            : (Math.pow(2 * p - 2, 2) * ((c2 + 1) * (p * 2 - 2) + c2) + 2) / 2;
    },
    elasticOut: (p) => {
        if (p === 0 || p === 1) return p;
        return Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    },
    // Amorti critique approché : dépassement court, retour net à 1.
    spring: (p) => {
        if (p >= 1) return 1;
        return 1 - Math.exp(-5.5 * p) * Math.cos(9 * p);
    }
};

const EASING_LABELS = [
    { value: 'linear', label: 'Linéaire' },
    { value: 'sineInOut', label: 'Douce' },
    { value: 'cubicOut', label: 'Sortie douce' },
    { value: 'expoOut', label: 'Sortie expo' },
    { value: 'backOut', label: 'Rebond' },
    { value: 'elasticOut', label: 'Élastique' },
    { value: 'spring', label: 'Amorti' }
];

function applyEasing(name, progress) {
    const fn = EASING[name];
    return fn ? fn(progress) : progress;
}

const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6L19 12z" fill="currentColor"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="5.4" width="3.6" height="13.2" rx="1" fill="currentColor"/><rect x="13.4" y="5.4" width="3.6" height="13.2" rx="1" fill="currentColor"/></svg>';

class Timeline {
    constructor() {
        this.currentTime = 0;
        this.duration = 10; // seconds
        this.isPlaying = false;
        this.fps = 60;
        this.editor = null;
        this.ui = null;
        this.rafId = null;
        this.lastFrameTime = 0;
        this.loopEnabled = false; // Loop mode
    }

    setEditor(editor) {
        this.editor = editor;
    }

    setUI(ui) {
        this.ui = ui;
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            this.lastFrameTime = performance.now();
            this.tick();
            this.ui.updatePlayButton(true);
        } else {
            cancelAnimationFrame(this.rafId);
            this.ui.updatePlayButton(false);
        }
    }

    stop() {
        this.isPlaying = false;
        this.currentTime = 0;
        cancelAnimationFrame(this.rafId);
        this.ui.updatePlayButton(false);
        this.ui.updateTimeDisplay(0);
        this.editor.render();
    }

    tick() {
        if (!this.isPlaying) return;

        const now = performance.now();
        const deltaTime = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        this.currentTime += deltaTime;

        // Check if we've reached the end
        if (this.currentTime >= this.duration) {
            if (this.loopEnabled) {
                // Reset to beginning and continue
                this.currentTime = 0;
            } else {
                // Stop at end
                this.currentTime = this.duration;
                this.isPlaying = false;
                cancelAnimationFrame(this.rafId);
                this.ui.updatePlayButton(false);
                this.ui.updateTimeDisplay(this.currentTime);
                this.editor.render();
                return;
            }
        }

        this.ui.updateTimeDisplay(this.currentTime);
        this.editor.render();

        this.rafId = requestAnimationFrame(() => this.tick());
    }

    seek(time) {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        this.editor.render();
        this.ui.updateTimeDisplay(this.currentTime);
    }
}

class Editor {
    constructor(canvas, timeline) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.timeline = timeline;
        this.ui = null;
        this.shapes = [];
        this.selectedShapeId = null;
        this.nextId = 1;
        this.bgColor = '#121212';
        
        // Base dimensions
        this.baseWidth = 800;
        this.baseHeight = 450;
        
        // Zoom
        this.zoom = 1;
        this.minZoom = 0.25;
        this.maxZoom = 4;
        this.canvasWrapper = null;
        
        // High DPI support
        this.dpr = window.devicePixelRatio || 1;
        this.setupHighDPI();
        
        // Undo/Redo
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50;

        // Courbe des nouvelles images clés (partagée avec l'inspecteur).
        this.defaultEasing = 'expoOut';

        this.setupInteractions();
        this.setupUndoRedo();
    }
    
    setupHighDPI() {
        // Set canvas size for high DPI
        const scale = this.dpr * this.zoom;
        this.canvas.width = this.baseWidth * scale;
        this.canvas.height = this.baseHeight * scale;
        this.canvas.style.width = this.baseWidth + 'px';
        this.canvas.style.height = this.baseHeight + 'px';
        this.ctx.scale(scale, scale);
    }
    
    setupUndoRedo() {
        const isEditable = (target) => {
            if (!target) return false;
            if (target.isContentEditable) return true;
            return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || '');
        };

        document.addEventListener('keydown', (e) => {
            if (isEditable(e.target)) return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                this.redo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                this.redo();
            }
        });
    }
    
    snapshot() {
        return {
            shapes: JSON.parse(JSON.stringify(this.shapes)),
            selectedShapeId: this.selectedShapeId,
            bgColor: this.bgColor,
            // La durée fait partie de la scène : sans elle, annuler après
            // l'ouverture d'un projet laissait la timeline sur la nouvelle valeur.
            duration: this.timeline.duration
        };
    }

    restore(state) {
        this.shapes = state.shapes;
        this.selectedShapeId = state.selectedShapeId;
        this.bgColor = state.bgColor;
        if (Number.isFinite(state.duration) && state.duration > 0) {
            this.timeline.duration = state.duration;
        }
        const picker = document.getElementById('bg-color');
        if (picker) picker.value = this.bgColor;

        this.render();
        if (this.ui) {
            this.ui.syncDurationSelect(this.timeline.duration);
            this.ui.refreshTimeline();
            const shape = this.getShape(this.selectedShapeId);
            if (shape) {
                this.ui.showProperties(shape);
                this.ui.updateFXSliders(shape);
            } else {
                this.ui.showProperties(null);
            }
        }
    }

    saveState() {
        this.undoStack.push(this.snapshot());

        // Limit stack size
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }

        // Clear redo stack on new action
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length === 0) return;
        this.redoStack.push(this.snapshot());
        this.restore(this.undoStack.pop());
    }

    redo() {
        if (this.redoStack.length === 0) return;
        this.undoStack.push(this.snapshot());
        this.restore(this.redoStack.pop());
    }

    setUI(ui) {
        this.ui = ui;
        this.canvasWrapper = this.canvas.parentElement;
        this.updateZoomDisplay();
    }

    setZoom(newZoom) {
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
        
        // Update canvas resolution for crisp rendering
        const scale = this.dpr * this.zoom;
        this.canvas.width = this.baseWidth * scale;
        this.canvas.height = this.baseHeight * scale;
        this.canvas.style.width = (this.baseWidth * this.zoom) + 'px';
        this.canvas.style.height = (this.baseHeight * this.zoom) + 'px';
        this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
        
        this.updateZoomDisplay();
        this.render();
    }
    
    zoomIn() {
        this.setZoom(this.zoom * 1.25);
    }
    
    zoomOut() {
        this.setZoom(this.zoom / 1.25);
    }
    
    zoomReset() {
        this.setZoom(1);
    }
    
    zoomFit() {
        const container = this.canvas.parentElement.parentElement;
        if (!container) return;
        const containerW = container.clientWidth - 56;
        const containerH = container.clientHeight - 56;
        const scaleX = containerW / this.baseWidth;
        const scaleY = containerH / this.baseHeight;
        this.setZoom(Math.min(scaleX, scaleY, 1));
    }
    
    updateZoomDisplay() {
        const display = document.getElementById('zoom-info');
        if (display) {
            display.textContent = Math.round(this.zoom * 100) + '%';
        }
    }

    addShape(type) {
        this.saveState(); // Save for undo
        const id = this.nextId++;
        const shape = {
            id: id,
            type: type,
            name: `${type} ${id}`,
            x: 400,
            y: 225,
            z: 0,
            width: 100,
            height: 100,
            radius: 50,
            fill: '#ffffff',
            text: 'Text',
            fontSize: 30,
            fontFamily: 'JetBrains Mono',
            fontWeight: 500,
            // Transform
            opacity: 1,
            rotation: 0,
            rotationX: 0,
            rotationY: 0,
            scaleX: 1,
            scaleY: 1,
            anchorX: 0,
            anchorY: 0,
            // FX
            blur: 0,
            hue: 0,
            saturation: 100,
            brightness: 100,
            contrast: 100,
            glow: 0,
            glowColor: '#ffffff',
            // Motion
            skewX: 0,
            skewY: 0,
            keyframes: {}
        };
        this.shapes.push(shape);
        this.selectShape(shape.id);
        this.ui.refreshTimeline();
        this.render();
    }

    duplicateSelected() {
        if (!this.selectedShapeId) return;
        const original = this.getShape(this.selectedShapeId);
        if (!original) return;
        
        this.saveState(); // Save for undo

        const clone = JSON.parse(JSON.stringify(original));
        clone.id = this.nextId++;
        clone.name = original.name + ' copy';
        clone.x += 20;
        clone.y += 20;
        clone.keyframes = {};

        // Clone image separately if SVG
        if (original.type === 'SVG' && original.image) {
            clone.image = new Image();
            clone.image.src = original.image.src;
        }

        this.shapes.push(clone);
        this.selectShape(clone.id);
        this.ui.refreshTimeline();
        this.render();
    }

    addSVG(dataUrl, name) {
        this.saveState(); // Save for undo
        const img = new Image();
        img.src = dataUrl;
        const id = this.nextId++;

        const shape = {
            id: id,
            type: 'SVG',
            name: name || `SVG ${id}`,
            x: 400,
            y: 225,
            z: 0,
            width: 100,
            height: 100,
            // Transform
            rotation: 0,
            rotationX: 0,
            rotationY: 0,
            scaleX: 1,
            scaleY: 1,
            anchorX: 0,
            anchorY: 0,
            opacity: 1,
            // FX
            blur: 0,
            hue: 0,
            saturation: 100,
            brightness: 100,
            contrast: 100,
            glow: 0,
            glowColor: '#ffffff',
            // Motion
            skewX: 0,
            skewY: 0,
            image: img,
            fill: '#ffffff',
            keyframes: {}
        };

        img.onload = () => {
            const aspect = img.width / img.height;
            if (aspect > 1) {
                shape.width = 200;
                shape.height = 200 / aspect;
            } else {
                shape.height = 200;
                shape.width = 200 * aspect;
            }
            this.render();
            // Refresh UI if this shape is still selected
            if (this.selectedShapeId === shape.id) {
                this.ui.showProperties(shape);
            }
        };

        this.shapes.push(shape);
        this.selectShape(shape.id);
        this.ui.refreshTimeline();
        this.render();
    }

    deleteSelected() {
        if (this.selectedShapeId) {
            this.saveState(); // Save for undo
            this.shapes = this.shapes.filter(s => s.id !== this.selectedShapeId);
            this.selectedShapeId = null;
            this.ui.refreshTimeline();
            this.ui.showProperties(null);
            this.render();
        }
    }

    selectShape(id) {
        this.selectedShapeId = id;
        const shape = this.getShape(id);
        this.ui.highlightLayer(id);
        this.ui.showProperties(shape);
        this.ui.updateFXSliders(shape);
        this.render();
    }

    getShape(id) {
        return this.shapes.find(s => s.id === id);
    }

    updateShape(id, props) {
        const shape = this.getShape(id);
        if (shape) {
            const t = this.timeline.currentTime;
            
            Object.keys(props).forEach(prop => {
                const val = props[prop];
                
                // Check if property is animated (has keyframes)
                if (shape.keyframes[prop] && shape.keyframes[prop].length > 0) {
                    // Auto-keyframe logic
                    const existingKey = shape.keyframes[prop].find(k => Math.abs(k.t - t) < 0.01);
                    if (existingKey) {
                        existingKey.v = val;
                    } else {
                        // Même source de vérité que l'inspecteur (UI) : la
                        // courbe choisie s'applique aussi aux images créées
                        // automatiquement en déplaçant une forme.
                        const ease = this.defaultEasing;
                        shape.keyframes[prop].push(ease && ease !== 'linear' ? { t, v: val, e: ease } : { t, v: val });
                        // Keep sorted
                        shape.keyframes[prop].sort((a, b) => a.t - b.t);
                    }
                } else {
                    // Static property update
                    shape[prop] = val;
                }
            });

            this.render();
        }
    }

    // Interpolate value based on current time
    getValue(shape, prop) {
        const keys = shape.keyframes[prop];
        if (!keys || keys.length === 0) return shape[prop];

        const t = this.timeline.currentTime;

        // Les tableaux sont maintenus triés à l'écriture ; on ne vérifie que
        // l'ordre (O(n)) au lieu de retrier à chaque image et chaque propriété.
        let sorted = true;
        for (let i = 1; i < keys.length; i++) {
            if (keys[i - 1].t > keys[i].t) {
                sorted = false;
                break;
            }
        }
        if (!sorted) keys.sort((a, b) => a.t - b.t);

        // Before first keyframe
        if (t <= keys[0].t) return keys[0].v;
        // After last keyframe
        if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].v;

        // Find interval
        for (let i = 0; i < keys.length - 1; i++) {
            if (t >= keys[i].t && t < keys[i+1].t) {
                const k1 = keys[i];
                const k2 = keys[i+1];
                const span = k2.t - k1.t;
                const raw = span > 0 ? (t - k1.t) / span : 1;
                const progress = applyEasing(k1.e, raw);
                return k1.v + (k2.v - k1.v) * progress;
            }
        }
        return shape[prop];
    }

    render() {
        const ctx = this.ctx;
        
        // Clear using base dimensions (scale is already applied via transform)
        ctx.clearRect(0, 0, this.baseWidth, this.baseHeight);

        // Background
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(0, 0, this.baseWidth, this.baseHeight);

        // Z croissant : la valeur Z de l'inspecteur pilote l'ordre d'affichage.
        const ordered = [...this.shapes].sort((a, b) => (a.z || 0) - (b.z || 0));

        ordered.forEach(shape => {
            ctx.save();
            
            const x = this.getValue(shape, 'x');
            const y = this.getValue(shape, 'y');
            const rotation = this.getValue(shape, 'rotation');
            const rotX = this.getValue(shape, 'rotationX');
            const rotY = this.getValue(shape, 'rotationY');
            const scaleX = this.getValue(shape, 'scaleX');
            const scaleY = this.getValue(shape, 'scaleY');
            const skewX = this.getValue(shape, 'skewX');
            const skewY = this.getValue(shape, 'skewY');
            const opacity = this.getValue(shape, 'opacity');
            const blur = this.getValue(shape, 'blur');
            const hue = this.getValue(shape, 'hue');
            const sat = this.getValue(shape, 'saturation');
            const bri = this.getValue(shape, 'brightness');
            const contrast = this.getValue(shape, 'contrast');
            const glow = this.getValue(shape, 'glow');
            const glowColor = shape.glowColor;

            ctx.translate(x, y);
            
            // Apply 3D-like transforms via 2D approximation
            const perspectiveScale = 1 + (rotX * 0.002) + (rotY * 0.002);
            ctx.scale(scaleX * perspectiveScale, scaleY * perspectiveScale);
            
            // Skew for 3D perspective feel
            ctx.transform(1, Math.tan(skewY * Math.PI / 180), Math.tan(skewX * Math.PI / 180), 1, 0, 0);
            
            // Rotation
            ctx.rotate(rotation * Math.PI / 180);
            
            ctx.globalAlpha = opacity;
            
            // Filters
            let filter = '';
            if (blur > 0) filter += `blur(${blur}px) `;
            if (hue !== 0) filter += `hue-rotate(${hue}deg) `;
            if (sat !== 100) filter += `saturate(${sat}%) `;
            if (bri !== 100) filter += `brightness(${bri}%) `;
            if (contrast !== 100) filter += `contrast(${contrast}%) `;
            
            ctx.filter = filter || 'none';
            
            // Glow effect
            if (glow > 0) {
                ctx.shadowBlur = glow;
                ctx.shadowColor = glowColor;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fillStyle = shape.fill;

            if (shape.type === 'Rect') {
                const w = this.getValue(shape, 'width');
                const h = this.getValue(shape, 'height');
                ctx.fillRect(-w/2, -h/2, w, h);
            } else if (shape.type === 'Circle') {
                const r = this.getValue(shape, 'radius');
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
            } else if (shape.type === 'Text') {
                const fontFamily = shape.fontFamily || 'JetBrains Mono';
                const fontWeight = shape.fontWeight || 500;
                const fontSize = this.getValue(shape, 'fontSize') || shape.fontSize || 24;
                ctx.font = `${fontWeight} ${fontSize}px '${fontFamily}', sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(shape.text ?? ''), 0, 0);
            } else if (shape.type === 'SVG') {
                const w = this.getValue(shape, 'width');
                const h = this.getValue(shape, 'height');
                if (shape.image && shape.image.complete) {
                    ctx.drawImage(shape.image, -w/2, -h/2, w, h);
                }
            }

            // Selection outline
            if (shape.id === this.selectedShapeId) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.filter = 'none'; // Don't blur the selection box
                if (shape.type === 'Rect' || shape.type === 'SVG') {
                    const w = this.getValue(shape, 'width');
                    const h = this.getValue(shape, 'height');
                    ctx.strokeRect(-w/2 - 2, -h/2 - 2, w + 4, h + 4);
                } else if (shape.type === 'Circle') {
                    const r = this.getValue(shape, 'radius');
                    ctx.beginPath();
                    ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.setLineDash([]);
            }

            ctx.restore();
        });
    }

    setupInteractions() {
        let isDragging = false;
        let hasSavedForDrag = false;
        
        // Background color picker
        const bgColorPicker = document.getElementById('bg-color');
        if (bgColorPicker) {
            bgColorPicker.addEventListener('input', (e) => {
                this.bgColor = e.target.value;
                this.render();
            });
        }
        
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            // Convert mouse coordinates accounting for zoom
            const mx = (e.clientX - rect.left) / this.zoom;
            const my = (e.clientY - rect.top) / this.zoom;

            // Simple hit detection (reverse order to select top-most)
            const clickedShape = [...this.shapes]
                .sort((a, b) => (a.z || 0) - (b.z || 0))
                .reverse()
                .find(s => {
                const x = this.getValue(s, 'x');
                const y = this.getValue(s, 'y');
                const halfW = s.type === 'Circle' ? this.getValue(s, 'radius') : this.getValue(s, 'width') / 2;
                const halfH = s.type === 'Circle' ? this.getValue(s, 'radius') : this.getValue(s, 'height') / 2;
                const sx = Math.abs(this.getValue(s, 'scaleX')) || 1;
                const sy = Math.abs(this.getValue(s, 'scaleY')) || 1;
                return Math.abs(mx - x) <= Math.max(halfW * sx, 6) &&
                       Math.abs(my - y) <= Math.max(halfH * sy, 6);
            });

            if (clickedShape) {
                this.selectShape(clickedShape.id);
                isDragging = true;
                hasSavedForDrag = false; // Will save on first move
            } else {
                this.selectedShapeId = null;
                this.ui.showProperties(null);
                this.ui.refreshLayers();
                this.render();
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (isDragging && this.selectedShapeId) {
                // Save state on first drag move
                if (!hasSavedForDrag) {
                    this.saveState();
                    hasSavedForDrag = true;
                }
                
                const rect = this.canvas.getBoundingClientRect();
                // Convert mouse coordinates accounting for zoom
                const mx = (e.clientX - rect.left) / this.zoom;
                const my = (e.clientY - rect.top) / this.zoom;
                
                this.updateShape(this.selectedShapeId, { x: mx, y: my });
                // Also update UI inputs if needed
                this.ui.updateInputs(this.getShape(this.selectedShapeId));
            }
        });

        // Le relâchement est écouté sur window : sinon un drag sorti du canvas
        // laisse la forme collée au curseur au retour dans la zone.
        window.addEventListener('mouseup', () => {
            isDragging = false;
            hasSavedForDrag = false;
        });
    }

    openExportModal() {
        document.getElementById('export-modal').classList.remove('hidden');
    }

    // Sérialisation du projet : même schéma que le fichier « Sauvegarder »
    // et que le modèle lu par le moteur Rust (rust/crates/motion-core).
    serializeShape(shape) {
        return {
            id: shape.id,
            type: shape.type,
            name: shape.name,
            x: shape.x, y: shape.y, z: shape.z || 0,
            width: shape.width,
            height: shape.height,
            radius: shape.radius,
            fill: shape.fill,
            text: shape.text,
            fontSize: shape.fontSize,
            fontFamily: shape.fontFamily,
            fontWeight: shape.fontWeight,
            opacity: shape.opacity,
            rotation: shape.rotation,
            rotationX: shape.rotationX,
            rotationY: shape.rotationY,
            scaleX: shape.scaleX,
            scaleY: shape.scaleY,
            skewX: shape.skewX,
            skewY: shape.skewY,
            blur: shape.blur,
            glow: shape.glow,
            glowColor: shape.glowColor,
            hue: shape.hue,
            saturation: shape.saturation,
            brightness: shape.brightness,
            contrast: shape.contrast,
            imageSrc: shape.image && typeof shape.image.src === 'string' && shape.image.src.startsWith('data:') ? shape.image.src : null,
            keyframes: shape.keyframes || {}
        };
    }

    serializeProject() {
        return {
            app: 'HOT MOTOR MOTION',
            version: '1.0',
            name: 'HOT MOTOR MOTION Project',
            created: new Date().toISOString(),
            duration: this.timeline.duration,
            canvas: { width: this.baseWidth, height: this.baseHeight },
            bgColor: this.bgColor,
            shapes: this.shapes.map(shape => this.serializeShape(shape))
        };
    }

    saveProjectFile() {
        const json = JSON.stringify(this.serializeProject(), null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `motion-project-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    async exportWebM(width = 800, height = 450, fps = 60, bitrate = 5000000) {
        const progressFill = document.getElementById('export-progress-fill');
        const progressText = document.getElementById('export-progress-text');
        const progressDiv = document.getElementById('export-progress');
        const startBtn = document.getElementById('export-start');

        const resetExportUI = () => {
            if (progressDiv) progressDiv.classList.add('hidden');
            if (progressFill) progressFill.style.width = '0%';
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.textContent = 'Start Export';
            }
        };

        if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
            alert("L'export vidéo n'est pas disponible dans ce navigateur. Utilisez « Export JS » à la place.");
            return;
        }

        // 4K est la limite raisonnable pour une capture temps réel dans un
        // navigateur ; au-delà, le canvas dépasse la mémoire allouable.
        if (width * height > 3840 * 2160) {
            alert("L'export vidéo est limité à 4K (3840×2160). Choisissez une résolution plus basse.");
            return;
        }

        // Create a separate canvas for export at target resolution
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = width;
        exportCanvas.height = height;
        const exportCtx = exportCanvas.getContext('2d');
        if (!exportCtx) {
            alert("Impossible de préparer le canvas d'export à cette résolution.");
            return;
        }
        
        // Calculate scale factor from base size to export size
        const scaleX = width / this.baseWidth;
        const scaleY = height / this.baseHeight;
        const scale = Math.min(scaleX, scaleY);

        if (progressDiv) progressDiv.classList.remove('hidden');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = 'Exporting...';
        }

        // Check for codec support
        let mimeType = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm;codecs=vp8';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm';
            }
        }
        
        const stream = exportCanvas.captureStream(fps);
        let recorder;
        try {
            recorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: bitrate
            });
        } catch (error) {
            alert("L'enregistreur vidéo n'a pas pu démarrer : " + error.message);
            resetExportUI();
            return;
        }
        const chunks = [];

        recorder.ondataavailable = e => {
            if (e.data.size > 0) chunks.push(e.data);
        };
        
        const self = this;
        
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `HOT-MOTOR-MOTION-${width}x${height}-${Date.now()}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Reset UI
            resetExportUI();
            
            // Close modal
            document.getElementById('export-modal').classList.add('hidden');
        };

        // Calculate total frames
        const duration = this.timeline.duration;
        const frameTime = 1 / fps;
        const totalFrames = Math.ceil(duration * fps);
        let currentFrame = 0;
        
        // Reset timeline
        this.timeline.stop();
        this.timeline.currentTime = 0;

        // Start recording
        recorder.start(100);
        
        // Render frame by frame with proper timing
        const renderNextFrame = () => {
            const currentTime = currentFrame * frameTime;
            
            // Clear export canvas
            exportCtx.fillStyle = this.bgColor;
            exportCtx.fillRect(0, 0, width, height);
            
            // Apply scale transform
            exportCtx.save();
            exportCtx.scale(scale, scale);
            
            // Center the content
            const offsetX = (width / scale - this.baseWidth) / 2;
            const offsetY = (height / scale - this.baseHeight) / 2;
            exportCtx.translate(offsetX, offsetY);
            
            // Render all shapes at current time
            this.renderShapesToContext(exportCtx, currentTime);
            
            exportCtx.restore();
            
            // Update progress
            const progress = ((currentFrame + 1) / totalFrames) * 100;
            progressFill.style.width = progress + '%';
            progressText.textContent = `Exporting... ${Math.round(progress)}% (${currentFrame + 1}/${totalFrames} frames)`;
            
            // Update timeline display
            this.timeline.currentTime = currentTime;
            this.ui.updateTimeDisplay(currentTime);
            
            currentFrame++;
            
            if (currentFrame < totalFrames) {
                // Use setTimeout to give browser time to process and record the frame
                // This ensures each frame is captured even at high resolutions
                setTimeout(renderNextFrame, 1000 / fps);
            } else {
                // Wait a bit then stop recording
                setTimeout(() => {
                    recorder.stop();
                    this.timeline.currentTime = 0;
                    this.ui.updateTimeDisplay(0);
                }, 500);
            }
        };
        
        // Start rendering after a short delay to let recorder initialize
        setTimeout(renderNextFrame, 100);
    }
    
    // Render shapes to a specific context (for export)
    renderShapesToContext(ctx, time) {
        // Temporarily set timeline time for getValue to work
        const originalTime = this.timeline.currentTime;
        this.timeline.currentTime = time;

        [...this.shapes].sort((a, b) => (a.z || 0) - (b.z || 0)).forEach(shape => {
            ctx.save();
            
            const x = this.getValue(shape, 'x');
            const y = this.getValue(shape, 'y');
            const rotation = this.getValue(shape, 'rotation');
            const rotX = this.getValue(shape, 'rotationX');
            const rotY = this.getValue(shape, 'rotationY');
            const scaleX = this.getValue(shape, 'scaleX');
            const scaleY = this.getValue(shape, 'scaleY');
            const skewX = this.getValue(shape, 'skewX');
            const skewY = this.getValue(shape, 'skewY');
            const opacity = this.getValue(shape, 'opacity');
            const blur = this.getValue(shape, 'blur');
            const hue = this.getValue(shape, 'hue');
            const sat = this.getValue(shape, 'saturation');
            const bri = this.getValue(shape, 'brightness');
            const contrast = this.getValue(shape, 'contrast');
            const glow = this.getValue(shape, 'glow');
            const glowColor = shape.glowColor;

            ctx.translate(x, y);
            
            // Apply 3D-like transforms via 2D approximation
            const perspectiveScale = 1 + (rotX * 0.002) + (rotY * 0.002);
            ctx.scale(scaleX * perspectiveScale, scaleY * perspectiveScale);
            
            // Skew for 3D perspective feel
            ctx.transform(1, Math.tan(skewY * Math.PI / 180), Math.tan(skewX * Math.PI / 180), 1, 0, 0);
            
            // Rotation
            ctx.rotate(rotation * Math.PI / 180);
            
            ctx.globalAlpha = opacity;
            
            // Filters
            let filter = '';
            if (blur > 0) filter += `blur(${blur}px) `;
            if (hue !== 0) filter += `hue-rotate(${hue}deg) `;
            if (sat !== 100) filter += `saturate(${sat}%) `;
            if (bri !== 100) filter += `brightness(${bri}%) `;
            if (contrast !== 100) filter += `contrast(${contrast}%) `;
            
            ctx.filter = filter || 'none';
            
            // Glow effect
            if (glow > 0) {
                ctx.shadowBlur = glow;
                ctx.shadowColor = glowColor || shape.fill || '#ffffff';
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fillStyle = shape.fill || '#ffffff';

            if (shape.type === 'Rect') {
                const w = this.getValue(shape, 'width');
                const h = this.getValue(shape, 'height');
                ctx.fillRect(-w/2, -h/2, w, h);
            } else if (shape.type === 'Circle') {
                const r = this.getValue(shape, 'radius');
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
            } else if (shape.type === 'Text') {
                const fontFamily = shape.fontFamily || 'JetBrains Mono';
                const fontWeight = shape.fontWeight || 500;
                const fontSize = this.getValue(shape, 'fontSize') || shape.fontSize || 24;
                ctx.font = `${fontWeight} ${fontSize}px '${fontFamily}', sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(shape.text || 'Text', 0, 0);
            } else if (shape.type === 'SVG') {
                const w = this.getValue(shape, 'width');
                const h = this.getValue(shape, 'height');
                if (shape.image && shape.image.complete) {
                    ctx.drawImage(shape.image, -w/2, -h/2, w, h);
                }
            }

            ctx.restore();
        });
        
        // Restore original time
        this.timeline.currentTime = originalTime;
    }

    generateExportJS(format = 'full') {
        // Sérialisation fidèle : les noms de propriétés doivent être ceux du
        // moteur (fill, saturation, rotationX…), sinon l'animation exportée
        // reste muette. Les images SVG ne survivent que sous forme de data URL.
        const shapes = this.shapes.map(s => ({
            id: s.id,
            type: s.type,
            name: s.name,
            x: s.x, y: s.y, z: s.z || 0,
            width: s.width,
            height: s.height,
            radius: s.radius ?? 50,
            fill: s.fill,
            text: s.text,
            fontSize: s.fontSize ?? 30,
            fontFamily: s.fontFamily || 'JetBrains Mono',
            fontWeight: s.fontWeight ?? 500,
            opacity: s.opacity ?? 1,
            rotation: s.rotation || 0,
            rotationX: s.rotationX || 0,
            rotationY: s.rotationY || 0,
            scaleX: s.scaleX ?? 1,
            scaleY: s.scaleY ?? 1,
            skewX: s.skewX || 0,
            skewY: s.skewY || 0,
            blur: s.blur || 0,
            glow: s.glow || 0,
            glowColor: s.glowColor,
            hue: s.hue || 0,
            saturation: s.saturation ?? 100,
            brightness: s.brightness ?? 100,
            contrast: s.contrast ?? 100,
            imageSrc: s.image && typeof s.image.src === 'string' && s.image.src.startsWith('data:') ? s.image.src : null,
            keyframes: s.keyframes || {}
        }));

        const data = {
            app: 'HOT MOTOR MOTION',
            version: '1.0',
            canvas: { width: this.baseWidth, height: this.baseHeight },
            bgColor: this.bgColor,
            duration: this.timeline.duration,
            shapes: shapes
        };

        if (format === 'data') {
            return JSON.stringify(data, null, 2);
        }

        // Échappe les chevrons pour qu'aucune donnée utilisateur ne puisse
        // fermer la balise <script> du document exporté.
        const json = JSON.stringify(data).replace(/</g, '\\u003c');

        const playerJS = `// HOT MOTOR MOTION — lecteur autonome (aucune dépendance)
const MOTION_DATA = ${json};

// Mêmes courbes que l'éditeur : l'export conserve l'amorti de l'animation.
const MOTION_EASING = {
    linear: (p) => p,
    sineIn: (p) => 1 - Math.cos((p * Math.PI) / 2),
    sineOut: (p) => Math.sin((p * Math.PI) / 2),
    sineInOut: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
    cubicIn: (p) => p * p * p,
    cubicOut: (p) => 1 - Math.pow(1 - p, 3),
    cubicInOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    expoIn: (p) => (p === 0 ? 0 : Math.pow(2, 10 * p - 10)),
    expoOut: (p) => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    expoInOut: (p) => (p === 0 || p === 1 ? p : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2),
    backOut: (p) => 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2),
    elasticOut: (p) => (p === 0 || p === 1 ? p : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
    spring: (p) => (p >= 1 ? 1 : 1 - Math.exp(-5.5 * p) * Math.cos(9 * p))
};

function motionEase(name, progress) {
    const fn = MOTION_EASING[name];
    return fn ? fn(progress) : progress;
}

function motionValue(shape, prop, time) {
    const keys = shape.keyframes && shape.keyframes[prop];
    if (!keys || keys.length === 0) return shape[prop];
    if (keys.length === 1) return keys[0].v;
    if (time <= keys[0].t) return keys[0].v;
    const last = keys[keys.length - 1];
    if (time >= last.t) return last.v;
    for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i];
        const b = keys[i + 1];
        if (time >= a.t && time < b.t) {
            const span = b.t - a.t;
            const progress = motionEase(a.e, span > 0 ? (time - a.t) / span : 1);
            return a.v + (b.v - a.v) * progress;
        }
    }
    return last.v;
}

function motionDrawShape(ctx, shape, time) {
    const value = (prop) => motionValue(shape, prop, time);

    ctx.save();
    ctx.translate(value('x'), value('y'));

    const perspective = 1 + value('rotationX') * 0.002 + value('rotationY') * 0.002;
    ctx.scale(value('scaleX') * perspective, value('scaleY') * perspective);
    ctx.transform(1, Math.tan(value('skewY') * Math.PI / 180), Math.tan(value('skewX') * Math.PI / 180), 1, 0, 0);
    ctx.rotate(value('rotation') * Math.PI / 180);

    ctx.globalAlpha = value('opacity');

    let filter = '';
    if (value('blur') > 0) filter += 'blur(' + value('blur') + 'px) ';
    if (value('hue') !== 0) filter += 'hue-rotate(' + value('hue') + 'deg) ';
    if (value('saturation') !== 100) filter += 'saturate(' + value('saturation') + '%) ';
    if (value('brightness') !== 100) filter += 'brightness(' + value('brightness') + '%) ';
    if (value('contrast') !== 100) filter += 'contrast(' + value('contrast') + '%) ';
    ctx.filter = filter || 'none';

    if (value('glow') > 0) {
        ctx.shadowBlur = value('glow');
        ctx.shadowColor = shape.glowColor || shape.fill || '#ffffff';
    }

    ctx.fillStyle = shape.fill || '#ffffff';

    if (shape.type === 'Rect') {
        const w = value('width');
        const h = value('height');
        ctx.fillRect(-w / 2, -h / 2, w, h);
    } else if (shape.type === 'Circle') {
        ctx.beginPath();
        ctx.arc(0, 0, value('radius'), 0, Math.PI * 2);
        ctx.fill();
    } else if (shape.type === 'Text') {
        const family = shape.fontFamily || 'Inter';
        const weight = value('fontWeight') || 400;
        const size = value('fontSize') || 30;
        ctx.font = weight + ' ' + size + "px '" + family + "', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shape.text || '', 0, 0);
    } else if (shape.type === 'SVG' && shape.image) {
        const w = value('width');
        const h = value('height');
        ctx.drawImage(shape.image, -w / 2, -h / 2, w, h);
    }

    ctx.restore();
}

class MotionPlayer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = MOTION_DATA.canvas.width;
        this.canvas.height = MOTION_DATA.canvas.height;
        this.shapes = MOTION_DATA.shapes.map((shape) => Object.assign({}, shape));
        this.duration = MOTION_DATA.duration;
        this.bgColor = MOTION_DATA.bgColor;
        this.currentTime = 0;
        this.playing = false;
        this.loop = true;
        this.lastTime = 0;
        this.loadImages();
    }

    loadImages() {
        this.shapes.forEach((shape) => {
            if (!shape.imageSrc) return;
            const img = new Image();
            img.onload = () => this.render();
            img.src = shape.imageSrc;
            shape.image = img;
        });
    }

    render() {
        const ctx = this.ctx;
        ctx.save();
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();
        this.shapes.forEach((shape) => motionDrawShape(ctx, shape, this.currentTime));
    }

    play() {
        if (this.playing) return;
        this.playing = true;
        this.lastTime = performance.now();
        this.animate();
    }

    pause() {
        this.playing = false;
    }

    stop() {
        this.playing = false;
        this.currentTime = 0;
        this.render();
    }

    seek(time) {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        this.render();
    }

    animate() {
        if (!this.playing) return;
        const now = performance.now();
        this.currentTime += (now - this.lastTime) / 1000;
        this.lastTime = now;
        if (this.currentTime >= this.duration) {
            if (this.loop) {
                this.currentTime = 0;
            } else {
                this.currentTime = this.duration;
                this.playing = false;
            }
        }
        this.render();
        if (this.playing) requestAnimationFrame(() => this.animate());
    }
}`;

        if (format === 'js') {
            return playerJS;
        }

        const families = [...new Set(
            this.shapes
                .filter(s => s.type === 'Text' && s.fontFamily)
                .map(s => s.fontFamily)
        )].filter(f => !['Arial', 'Helvetica', 'sans-serif'].includes(f));

        const fontLink = families.length
            ? '    <link href="https://fonts.googleapis.com/css2?family=' +
              families.map(f => f.replace(/ /g, '+') + ':wght@400;500;600;700;800;900').join('&family=') +
              '&display=swap" rel="stylesheet">'
            : '';

        const width = this.baseWidth;
        const height = this.baseHeight;

        const fullHTML = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HOT MOTOR MOTION — animation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 20px;
            background: #121214;
            color: #ececf1;
            font-family: "Inter", system-ui, sans-serif;
        }
        .stage {
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 26px 70px rgba(0, 0, 0, 0.62), 0 0 0 1px rgba(255, 255, 255, 0.09);
        }
        canvas { display: block; background: #000; }
        .controls { display: flex; gap: 8px; }
        button {
            height: 34px;
            padding: 0 16px;
            border: 1px solid #32323a;
            border-radius: 7px;
            background: #1c1c20;
            color: #a8a8b3;
            font: inherit;
            font-size: 13px;
            cursor: pointer;
            transition: background-color 0.15s, color 0.15s, border-color 0.15s;
        }
        button:hover { background: #24242a; color: #ececf1; border-color: #45454f; }
        button.primary { background: #f0f0f2; border-color: #f0f0f2; color: #121214; font-weight: 600; }
        footer { font-size: 11px; letter-spacing: 0.08em; color: #8b8b96; }
    </style>
${fontLink}
</head>
<body>
    <div class="stage">
        <canvas id="motion-canvas" width="${width}" height="${height}"></canvas>
    </div>
    <div class="controls">
        <button id="play-btn" class="primary">▶ Lecture</button>
        <button id="pause-btn">⏸ Pause</button>
        <button id="stop-btn">⏹ Stop</button>
    </div>
    <footer>HOT MOTOR MOTION</footer>
    <script>
${playerJS}

document.addEventListener('DOMContentLoaded', () => {
    const player = new MotionPlayer('motion-canvas');
    player.render();
    player.play();
    document.getElementById('play-btn').addEventListener('click', () => player.play());
    document.getElementById('pause-btn').addEventListener('click', () => player.pause());
    document.getElementById('stop-btn').addEventListener('click', () => player.stop());
});
    </script>
</body>
</html>`;

        return fullHTML;
    }
}

class UI {
    constructor(editor, timeline) {
        this.editor = editor;
        this.timeline = timeline;
        
        this.timelineLayers = document.getElementById('timeline-layers');
        this.timelineTracks = document.getElementById('timeline-tracks');
        this.playhead = null;
        
        // Timeline zoom
        this.timelineZoom = 1;
        this.timelineMinZoom = 0.5;
        this.timelineMaxZoom = 5;
        this.rulerDrag = null;

        // Reflète la courbe du moteur pour l'inspecteur.
        this.defaultEasing = this.editor.defaultEasing;

        this.propsContent = document.getElementById('properties-content');
        this.timeDisplay = document.getElementById('time-display');
        this.scrubber = document.getElementById('timeline-scrubber');
        this.playBtn = document.getElementById('btn-play-pause');

        this.setupGlobalListeners();
        this.setupPresetButtons();
        this.setupTimelineZoom();
        this.setupTransportTracking();
        this.refreshTimeline();
    }
    
    setupTimelineZoom() {
        const timelineTracks = document.getElementById('timeline-tracks');
        if (!timelineTracks) return;

        // Ctrl + molette : zoom temporel ; sans modificateur, défilement normal.
        timelineTracks.addEventListener('wheel', (e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            const factor = e.deltaY > 0 ? 1 / 1.25 : 1.25;
            this.setTimelineZoom(this.timelineZoom * factor);
        }, { passive: false });

        // La colonne des calques suit le défilement vertical des pistes.
        timelineTracks.addEventListener('scroll', () => {
            if (this.timelineLayers) this.timelineLayers.scrollTop = timelineTracks.scrollTop;
        }, { passive: true });

        this.setupTransport();
    }

    setTimelineZoom(value) {
        this.timelineZoom = Math.max(this.timelineMinZoom, Math.min(this.timelineMaxZoom, value));
        this.applyTimelineZoom();
        this.renderRulerMarks();
    }

    applyTimelineZoom() {
        const inner = document.getElementById('timeline-tracks-inner');
        if (inner) inner.style.width = `${100 * this.timelineZoom}%`;

        const label = document.getElementById('tl-zoom-reset');
        if (label) {
            label.textContent = Math.abs(this.timelineZoom - 1) < 0.01
                ? 'Ajuster'
                : `${this.timelineZoom.toFixed(1)}×`;
        }
    }

    setupTransport() {
        const stepFrame = (dir) => {
            const fps = this.timeline.fps || 60;
            const next = this.timeline.currentTime + dir / fps;
            this.timeline.seek(Math.max(0, Math.min(this.timeline.duration, next)));
        };

        document.getElementById('btn-step-back')?.addEventListener('click', () => stepFrame(-1));
        document.getElementById('btn-step-fwd')?.addEventListener('click', () => stepFrame(1));
        document.getElementById('tl-zoom-in')?.addEventListener('click', () => this.setTimelineZoom(this.timelineZoom * 1.5));
        document.getElementById('tl-zoom-out')?.addEventListener('click', () => this.setTimelineZoom(this.timelineZoom / 1.5));
        document.getElementById('tl-zoom-reset')?.addEventListener('click', () => this.setTimelineZoom(1));

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const el = e.target;
            if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || ''))) return;

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                stepFrame(e.shiftKey ? 10 : 1);
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                stepFrame(e.shiftKey ? -10 : -1);
            } else if (e.key === 'Home') {
                e.preventDefault();
                this.timeline.seek(0);
            } else if (e.key === 'End') {
                e.preventDefault();
                this.timeline.seek(this.timeline.duration);
            }
        });
    }

    // Écoute unique du drag de la tête de lecture : refreshTimeline() détruit
    // la règle à chaque rendu, mais jamais les écouteurs de document.
    setupTransportTracking() {
        document.addEventListener('mousemove', (e) => {
            if (!this.rulerDrag) return;
            this.seekFromRuler(e, this.rulerDrag, true);
        });
        document.addEventListener('mouseup', () => {
            this.rulerDrag = null;
        });
    }

    seekFromRuler(event, container, snap) {
        const rect = container.getBoundingClientRect();
        if (!rect.width) return;

        const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        let time = ratio * this.timeline.duration;

        if (snap) {
            // Aimantation douce sur l'image clé la plus proche (7 px).
            const threshold = (7 / rect.width) * this.timeline.duration;
            let best = null;
            this.editor.shapes.forEach(shape => {
                Object.values(shape.keyframes || {}).forEach(keys => {
                    keys.forEach(kf => {
                        const delta = Math.abs(kf.t - time);
                        if (delta <= threshold && (!best || delta < best.delta)) best = { delta, t: kf.t };
                    });
                });
            });
            if (best) time = best.t;
        }

        this.timeline.seek(time);
    }

    // Graduation lisible : entre 4 et 12 repères, quelle que soit la durée.
    timelineStep() {
        const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];
        const minStep = this.timelineZoom >= 2 ? 0.25 : 1;
        const maxMarks = 12;
        for (const step of candidates) {
            if (step < minStep) continue;
            if (this.timeline.duration / step <= maxMarks) return step;
        }
        return 300;
    }

    formatRulerTime(time, step) {
        if (this.timeline.duration >= 60) {
            const minutes = Math.floor(time / 60);
            const seconds = Math.round(time % 60);
            return minutes > 0 ? `${minutes}m${String(seconds).padStart(2, '0')}` : `${seconds}s`;
        }
        return step < 1 ? `${time.toFixed(1)}s` : `${Math.round(time)}s`;
    }

    setupGlobalListeners() {
        // Tools
        document.getElementById('btn-rect').onclick = () => this.editor.addShape('Rect');
        document.getElementById('btn-circle').onclick = () => this.editor.addShape('Circle');
        document.getElementById('btn-text').onclick = () => this.editor.addShape('Text');

        // SVG Import
        const fileInput = document.getElementById('file-input-svg');
        document.getElementById('btn-import-svg').onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.editor.addSVG(event.target.result, file.name);
                };
                reader.readAsDataURL(file);
            }
            fileInput.value = '';
        };

        // Timeline
        this.playBtn.onclick = () => this.timeline.togglePlay();
        document.getElementById('btn-stop').onclick = () => this.timeline.stop();
        
        // Loop button
        const loopBtn = document.getElementById('btn-loop');
        if (loopBtn) {
            loopBtn.onclick = () => {
                this.timeline.loopEnabled = !this.timeline.loopEnabled;
                loopBtn.classList.toggle('active', this.timeline.loopEnabled);
            };
        }
        
        // Duration control
        document.getElementById('timeline-duration').onchange = (e) => {
            const newDuration = parseInt(e.target.value, 10);
            if (!Number.isFinite(newDuration) || newDuration <= 0) return;
            this.timeline.duration = newDuration;
            this.timeline.stop();
            this.refreshTimeline();
        };
        
        this.scrubber.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            const time = (val / 100) * this.timeline.duration;
            this.timeline.seek(time);
        });

        // Left panel FX sliders
        this.setupFXSliders();
        
        // Animation scripts
        this.setupScriptButtons();
    }

    setupFXSliders() {
        const sliders = {
            'fx-rotX': { prop: 'rotationX', suffix: '°', valId: 'val-rotX' },
            'fx-rotY': { prop: 'rotationY', suffix: '°', valId: 'val-rotY' },
            'fx-rotZ': { prop: 'rotation', suffix: '°', valId: 'val-rotZ' },
            'fx-skewX': { prop: 'skewX', suffix: '°', valId: 'val-skewX' },
            'fx-skewY': { prop: 'skewY', suffix: '°', valId: 'val-skewY' },
            'fx-scale': { prop: 'scaleX', suffix: 'x', valId: 'val-scale', also: 'scaleY' },
            'fx-opacity': { prop: 'opacity', suffix: '%', valId: 'val-opacity', mult: 100 },
            'fx-blur': { prop: 'blur', suffix: 'px', valId: 'val-blur' },
            'fx-glow': { prop: 'glow', suffix: '', valId: 'val-glow' },
            'fx-hue': { prop: 'hue', suffix: '°', valId: 'val-hue' },
            'fx-saturate': { prop: 'saturation', suffix: '%', valId: 'val-saturate' },
            'fx-brightness': { prop: 'brightness', suffix: '%', valId: 'val-brightness' },
            'fx-contrast': { prop: 'contrast', suffix: '%', valId: 'val-contrast' }
        };

        Object.keys(sliders).forEach(id => {
            const slider = document.getElementById(id);
            const config = sliders[id];
            if (!slider) return;
            
            // Save state when starting to drag slider
            slider.addEventListener('mousedown', () => {
                const shape = this.editor.getShape(this.editor.selectedShapeId);
                if (shape) this.editor.saveState();
            });

            slider.addEventListener('input', () => {
                const shape = this.editor.getShape(this.editor.selectedShapeId);
                if (!shape) return;

                const val = parseFloat(slider.value);
                const update = { [config.prop]: val };
                if (config.also) update[config.also] = val;

                this.editor.updateShape(shape.id, update);

                const displayVal = config.mult ? Math.round(val * config.mult) : val;
                const valueEl = document.getElementById(config.valId);
                if (valueEl) valueEl.textContent = displayVal + config.suffix;

                // On resynchronise seulement le champ concerné : reconstruire
                // tout l'inspecteur à chaque pixel de curseur le rendait
                // saccadé et cassait le focus.
                const inspectorInput = this.propsContent
                    ? this.propsContent.querySelector(`.prop-input[data-prop="${config.prop}"]`)
                    : null;
                if (inspectorInput) inspectorInput.value = val;
            });
        });
    }

    updateFXSliders(shape) {
        if (!shape) return;
        
        const updates = [
            { id: 'fx-rotX', val: shape.rotationX || 0, display: 'val-rotX', suffix: '°' },
            { id: 'fx-rotY', val: shape.rotationY || 0, display: 'val-rotY', suffix: '°' },
            { id: 'fx-rotZ', val: shape.rotation || 0, display: 'val-rotZ', suffix: '°' },
            { id: 'fx-skewX', val: shape.skewX || 0, display: 'val-skewX', suffix: '°' },
            { id: 'fx-skewY', val: shape.skewY || 0, display: 'val-skewY', suffix: '°' },
            { id: 'fx-scale', val: shape.scaleX || 1, display: 'val-scale', suffix: 'x' },
            { id: 'fx-opacity', val: shape.opacity, display: 'val-opacity', suffix: '%', mult: 100 },
            { id: 'fx-blur', val: shape.blur || 0, display: 'val-blur', suffix: 'px' },
            { id: 'fx-glow', val: shape.glow || 0, display: 'val-glow', suffix: '' },
            { id: 'fx-hue', val: shape.hue || 0, display: 'val-hue', suffix: '°' },
            { id: 'fx-saturate', val: shape.saturation || 100, display: 'val-saturate', suffix: '%' },
            { id: 'fx-brightness', val: shape.brightness || 100, display: 'val-brightness', suffix: '%' },
            { id: 'fx-contrast', val: shape.contrast || 100, display: 'val-contrast', suffix: '%' }
        ];

        updates.forEach(u => {
            const slider = document.getElementById(u.id);
            const valEl = document.getElementById(u.display);
            if (slider) slider.value = u.val;
            if (valEl) {
                const displayVal = u.mult ? Math.round(u.val * u.mult) : u.val;
                valEl.textContent = displayVal + u.suffix;
            }
        });
    }

    setupScriptButtons() {
        const scripts = {
            spin: (shape, t) => {
                this.addKeyframes(shape, 'rotation', [
                    { t: t, v: 0 },
                    { t: t + 1, v: 360 }
                ]);
            },
            pulse: (shape, t) => {
                this.addKeyframes(shape, 'scaleX', [
                    { t: t, v: 1 }, { t: t + 0.25, v: 1.2 }, { t: t + 0.5, v: 1 }
                ]);
                this.addKeyframes(shape, 'scaleY', [
                    { t: t, v: 1 }, { t: t + 0.25, v: 1.2 }, { t: t + 0.5, v: 1 }
                ]);
            },
            bounce: (shape, t) => {
                const startY = shape.y;
                this.addKeyframes(shape, 'y', [
                    { t: t, v: startY },
                    { t: t + 0.2, v: startY - 80 },
                    { t: t + 0.4, v: startY },
                    { t: t + 0.55, v: startY - 40 },
                    { t: t + 0.7, v: startY },
                    { t: t + 0.8, v: startY - 20 },
                    { t: t + 0.9, v: startY }
                ]);
            },
            shake: (shape, t) => {
                const startX = shape.x;
                this.addKeyframes(shape, 'x', [
                    { t: t, v: startX },
                    { t: t + 0.1, v: startX - 10 },
                    { t: t + 0.2, v: startX + 10 },
                    { t: t + 0.3, v: startX - 10 },
                    { t: t + 0.4, v: startX + 10 },
                    { t: t + 0.5, v: startX }
                ]);
            },
            fadeIn: (shape, t) => {
                this.addKeyframes(shape, 'opacity', [
                    { t: t, v: 0 },
                    { t: t + 1, v: 1 }
                ]);
            },
            fadeOut: (shape, t) => {
                this.addKeyframes(shape, 'opacity', [
                    { t: t, v: 1 },
                    { t: t + 1, v: 0 }
                ]);
            },
            zoomIn: (shape, t) => {
                this.addKeyframes(shape, 'scaleX', [{ t: t, v: 0 }, { t: t + 0.5, v: 1 }]);
                this.addKeyframes(shape, 'scaleY', [{ t: t, v: 0 }, { t: t + 0.5, v: 1 }]);
                this.addKeyframes(shape, 'opacity', [{ t: t, v: 0 }, { t: t + 0.5, v: 1 }]);
            },
            zoomOut: (shape, t) => {
                this.addKeyframes(shape, 'scaleX', [{ t: t, v: 1 }, { t: t + 0.5, v: 0 }]);
                this.addKeyframes(shape, 'scaleY', [{ t: t, v: 1 }, { t: t + 0.5, v: 0 }]);
                this.addKeyframes(shape, 'opacity', [{ t: t, v: 1 }, { t: t + 0.5, v: 0 }]);
            },
            slideL: (shape, t) => {
                this.addKeyframes(shape, 'x', [
                    { t: t, v: 900 },
                    { t: t + 0.5, v: shape.x }
                ]);
            },
            slideR: (shape, t) => {
                this.addKeyframes(shape, 'x', [
                    { t: t, v: -100 },
                    { t: t + 0.5, v: shape.x }
                ]);
            },
            flipX: (shape, t) => {
                this.addKeyframes(shape, 'rotationX', [
                    { t: t, v: 0 },
                    { t: t + 0.5, v: 180 },
                    { t: t + 1, v: 360 }
                ]);
            },
            flipY: (shape, t) => {
                this.addKeyframes(shape, 'rotationY', [
                    { t: t, v: 0 },
                    { t: t + 0.5, v: 180 },
                    { t: t + 1, v: 360 }
                ]);
            },
            wobble: (shape, t) => {
                this.addKeyframes(shape, 'rotation', [
                    { t: t, v: 0 },
                    { t: t + 0.15, v: -15 },
                    { t: t + 0.3, v: 12 },
                    { t: t + 0.45, v: -9 },
                    { t: t + 0.6, v: 6 },
                    { t: t + 0.75, v: -3 },
                    { t: t + 0.9, v: 0 }
                ]);
                this.addKeyframes(shape, 'x', [
                    { t: t, v: shape.x },
                    { t: t + 0.15, v: shape.x - 25 },
                    { t: t + 0.3, v: shape.x + 20 },
                    { t: t + 0.45, v: shape.x - 15 },
                    { t: t + 0.6, v: shape.x + 10 },
                    { t: t + 0.75, v: shape.x - 5 },
                    { t: t + 0.9, v: shape.x }
                ]);
            },
            swing: (shape, t) => {
                this.addKeyframes(shape, 'rotation', [
                    { t: t, v: 0 },
                    { t: t + 0.2, v: 15 },
                    { t: t + 0.4, v: -10 },
                    { t: t + 0.6, v: 5 },
                    { t: t + 0.8, v: -5 },
                    { t: t + 1, v: 0 }
                ]);
            },
            float: (shape, t) => {
                this.addKeyframes(shape, 'y', [
                    { t: t, v: shape.y },
                    { t: t + 1, v: shape.y - 20 },
                    { t: t + 2, v: shape.y }
                ]);
            },
            glitch: (shape, t) => {
                this.addKeyframes(shape, 'x', [
                    { t: t, v: shape.x },
                    { t: t + 0.05, v: shape.x + 20 },
                    { t: t + 0.1, v: shape.x - 15 },
                    { t: t + 0.15, v: shape.x + 10 },
                    { t: t + 0.2, v: shape.x }
                ]);
                this.addKeyframes(shape, 'hue', [
                    { t: t, v: 0 },
                    { t: t + 0.05, v: 180 },
                    { t: t + 0.1, v: 90 },
                    { t: t + 0.15, v: 270 },
                    { t: t + 0.2, v: 0 }
                ]);
                this.addKeyframes(shape, 'opacity', [
                    { t: t, v: 1 },
                    { t: t + 0.05, v: 0.5 },
                    { t: t + 0.1, v: 1 },
                    { t: t + 0.15, v: 0.7 },
                    { t: t + 0.2, v: 1 }
                ]);
            }
        };

        document.querySelectorAll('.script-btn').forEach(btn => {
            btn.onclick = () => {
                const scriptName = btn.dataset.script;
                const shape = this.editor.getShape(this.editor.selectedShapeId);
                if (!shape) {
                    alert('Sélectionnez une forme avant d\'appliquer une animation.');
                    return;
                }
                this.editor.saveState();
                const t = this.timeline.currentTime;
                if (scripts[scriptName]) {
                    scripts[scriptName](shape, t);
                    this.refreshTimeline();
                    this.editor.render();
                }
            };
        });
    }

    addKeyframes(shape, prop, keyframes) {
        if (!shape.keyframes[prop]) shape.keyframes[prop] = [];
        keyframes.forEach(kf => {
            // Remove existing keyframe at same time
            shape.keyframes[prop] = shape.keyframes[prop].filter(k => Math.abs(k.t - kf.t) > 0.01);
            shape.keyframes[prop].push(kf);
        });
        shape.keyframes[prop].sort((a, b) => a.t - b.t);
    }

    /* ── Bibliothèque de presets ─────────────────────────────────────────── */

    presetHelpers() {
        return {
            duration: this.timeline.duration,
            clear: () => {
                this.editor.shapes = [];
                this.editor.nextId = 1;
                this.editor.selectedShapeId = null;
            },
            shape: (type, props) => this.createShape(type, props),
            keys: (shape, prop, keys) => this.addKeyframes(shape, prop, keys)
        };
    }

    applyPreset(preset) {
        if (!preset || typeof preset.build !== 'function') return;

        this.editor.saveState();
        this.timeline.stop();

        const h = this.presetHelpers();
        h.clear();
        preset.build(h);

        this.showProperties(null);
        this.refreshTimeline();
        this.editor.render();
        this.timeline.seek(0);

        if (!this.timeline.isPlaying) this.timeline.togglePlay();
    }

    setupPresetButtons() {
        const library = window.HMMPresets;
        const host = document.getElementById('preset-panel');
        if (!library || !host) return;

        this.presetLibrary = library;
        host.innerHTML = '';

        // Section 1 : animations rapides appliquées à la sélection.
        if (Array.isArray(library.scripts) && library.scripts.length) {
            const quick = document.createElement('section');
            quick.className = 'preset-group';
            quick.dataset.label = 'sur la sélection';
            quick.dataset.search = library.scripts
                .map(script => script.label + ' ' + script.id)
                .join(' ')
                .toLowerCase();

            const quickHeader = document.createElement('button');
            quickHeader.type = 'button';
            quickHeader.className = 'preset-group-header';
            quickHeader.setAttribute('aria-expanded', 'false');
            quickHeader.innerHTML =
                '<span class="preset-group-title">Sur la sélection</span>' +
                `<span class="preset-group-count">${library.scripts.length}</span>`;

            const quickBody = document.createElement('div');
            quickBody.className = 'preset-group-body';
            const quickGrid = document.createElement('div');
            quickGrid.className = 'preset-grid';

            library.scripts.forEach(script => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'preset-chip script-btn';
                chip.dataset.script = script.id;
                chip.dataset.search = (script.label + ' ' + script.id).toLowerCase();
                chip.title = `${script.label} — s'applique à la forme sélectionnée`;
                chip.innerHTML =
                    `<span class="preset-glyph" aria-hidden="true">${script.glyph}</span>` +
                    `<span class="preset-label">${this.escapeAttr(script.label)}</span>`;
                quickGrid.appendChild(chip);
            });

            quickBody.appendChild(quickGrid);
            quickHeader.addEventListener('click', () => {
                quick.classList.toggle('is-open');
                quickHeader.setAttribute('aria-expanded', quick.classList.contains('is-open') ? 'true' : 'false');
            });
            quick.appendChild(quickHeader);
            quick.appendChild(quickBody);
            host.appendChild(quick);

            this.setupScriptButtons();
        }

        library.categories.forEach((category, index) => {
            const section = document.createElement('section');
            section.className = 'preset-group' + (index === 0 ? ' is-open' : '');
            section.dataset.label = category.label.toLowerCase();
            section.dataset.search = (category.label + ' ' + category.presets.map(p => p.label + ' ' + p.id).join(' ')).toLowerCase();

            const header = document.createElement('button');
            header.type = 'button';
            header.className = 'preset-group-header';
            header.setAttribute('aria-expanded', index === 0 ? 'true' : 'false');
            header.innerHTML =
                `<span class="preset-group-title">${this.escapeAttr(category.label)}</span>` +
                `<span class="preset-group-count">${category.presets.length}</span>`;

            const body = document.createElement('div');
            body.className = 'preset-group-body';

            const grid = document.createElement('div');
            grid.className = 'preset-grid';

            category.presets.forEach(preset => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'preset-chip';
                chip.dataset.preset = preset.id;
                chip.dataset.search = (preset.label + ' ' + preset.id).toLowerCase();
                chip.title = `${preset.label} — ${category.label}`;
                chip.innerHTML =
                    `<span class="preset-glyph" aria-hidden="true">${preset.glyph}</span>` +
                    `<span class="preset-label">${this.escapeAttr(preset.label)}</span>`;
                chip.addEventListener('click', () => this.applyPreset(preset));
                grid.appendChild(chip);
            });

            header.addEventListener('click', () => {
                const wasOpen = section.classList.contains('is-open');
                host.querySelectorAll('.preset-group').forEach(group => {
                    group.classList.remove('is-open');
                    const groupHeader = group.querySelector('.preset-group-header');
                    if (groupHeader) groupHeader.setAttribute('aria-expanded', 'false');
                });
                if (!wasOpen) {
                    section.classList.add('is-open');
                    header.setAttribute('aria-expanded', 'true');
                }
            });

            body.appendChild(grid);
            section.appendChild(header);
            section.appendChild(body);
            host.appendChild(section);
        });

        const search = document.getElementById('preset-search');
        if (search) {
            search.addEventListener('input', () => this.filterPresets(search.value));
            search.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    search.value = '';
                    this.filterPresets('');
                }
            });
        }

        const demo = document.getElementById('preset-demo');
        if (demo) demo.addEventListener('click', () => this.applyPreset(library.get('logoLockup')));

        this.updatePresetCount();
    }

    filterPresets(query) {
        const host = document.getElementById('preset-panel');
        if (!host) return;

        const term = String(query || '').trim().toLowerCase();

        // On mémorise les sections ouvertes avant la recherche pour les
        // rouvrir à l'identique quand le champ est vidé.
        if (term && !this.presetOpenBeforeSearch) {
            this.presetOpenBeforeSearch = [...host.querySelectorAll('.preset-group.is-open')]
                .map(group => group.dataset.label);
        } else if (!term && this.presetOpenBeforeSearch) {
            const openLabels = this.presetOpenBeforeSearch;
            this.presetOpenBeforeSearch = null;
            host.querySelectorAll('.preset-group').forEach(group => {
                group.classList.toggle('is-open', openLabels.includes(group.dataset.label));
            });
        }

        host.querySelectorAll('.preset-group').forEach(section => {
            const groupLabel = section.dataset.label || '';
            const groupMatch = !term || groupLabel.includes(term);
            let visible = 0;

            section.querySelectorAll('.preset-chip').forEach(chip => {
                const chipSearch = chip.dataset.search || '';
                const show = !term || groupMatch || chipSearch.includes(term);
                chip.hidden = !show;
                if (show) visible++;
            });

            section.hidden = visible === 0;
            if (term) section.classList.add('is-open');
        });

        this.updatePresetCount();
    }

    updatePresetCount() {
        const counter = document.getElementById('preset-count');
        const host = document.getElementById('preset-panel');
        if (!counter || !host) return;
        const visible = [...host.querySelectorAll('.preset-chip')].filter(chip => !chip.hidden).length;
        counter.textContent = String(visible);
    }

    createShape(type, props = {}) {
        const id = this.editor.nextId++;
        const defaults = {
            id: id,
            type: type,
            name: `${type} ${id}`,
            x: 400,
            y: 225,
            z: 0,
            width: 100,
            height: 100,
            radius: 50,
            fill: '#ffffff',
            text: 'Text',
            fontSize: 30,
            fontFamily: 'JetBrains Mono',
            fontWeight: 500,
            opacity: 1,
            rotation: 0,
            rotationX: 0,
            rotationY: 0,
            scaleX: 1,
            scaleY: 1,
            blur: 0,
            hue: 0,
            saturation: 100,
            brightness: 100,
            contrast: 100,
            glow: 0,
            glowColor: '#ffffff',
            skewX: 0,
            skewY: 0,
            keyframes: {}
        };
        
        const shape = { ...defaults, ...props, keyframes: {} };
        this.editor.shapes.push(shape);
        return shape;
    }

    refreshTimeline() {
        const duration = Math.max(0.1, this.timeline.duration);
        const previousScroll = this.timelineTracks ? this.timelineTracks.scrollLeft : 0;

        this.timelineLayers.innerHTML = '';
        this.timelineTracks.innerHTML = '';

        // En-tête de la colonne, aligné sur la règle.
        const head = document.createElement('div');
        head.className = 'layers-head';
        head.innerHTML =
            `<span class="layers-head-label">Calques</span>` +
            `<span class="layers-head-count">${this.editor.shapes.length}</span>`;
        this.timelineLayers.appendChild(head);

        const inner = document.createElement('div');
        inner.className = 'timeline-tracks-inner';
        inner.id = 'timeline-tracks-inner';

        const ruler = document.createElement('div');
        ruler.className = 'timeline-ruler';
        ruler.id = 'timeline-ruler';
        const marks = document.createElement('div');
        marks.className = 'ruler-marks';
        ruler.appendChild(marks);
        inner.appendChild(ruler);

        this.rulerEl = ruler;
        this.marksEl = marks;
        this.renderRulerMarks();

        ruler.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            this.rulerDrag = ruler;
            this.seekFromRuler(e, ruler, true);
        });

        // Calques : dessus de pile en premier, comme dans la scène.
        const ordered = [...this.editor.shapes].sort((a, b) => (b.z || 0) - (a.z || 0));

        ordered.forEach((shape, index) => {
            const isSelected = shape.id === this.editor.selectedShapeId;

            const header = document.createElement('div');
            header.className = `layer-header${isSelected ? ' is-selected' : ''}`;
            header.dataset.id = shape.id;
            header.innerHTML =
                `<span class="layer-index">${String(index + 1).padStart(2, '0')}</span>` +
                `<span class="layer-name">${this.escapeAttr(shape.name)}</span>` +
                `<span class="layer-tag">${this.escapeAttr(shape.type)}</span>`;
            header.addEventListener('click', () => this.editor.selectShape(shape.id));
            this.timelineLayers.appendChild(header);

            const row = document.createElement('div');
            row.className = `track-row${isSelected ? ' is-selected' : ''}`;
            row.dataset.id = shape.id;

            row.addEventListener('click', (e) => {
                if (e.target.classList.contains('keyframe')) return;
                const rect = row.getBoundingClientRect();
                if (!rect.width) return;
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                this.timeline.seek(ratio * this.timeline.duration);
                this.editor.selectShape(shape.id);
            });

            header.addEventListener('mouseenter', () => row.classList.add('is-hover'));
            header.addEventListener('mouseleave', () => row.classList.remove('is-hover'));
            row.addEventListener('mouseenter', () => header.classList.add('is-hover'));
            row.addEventListener('mouseleave', () => header.classList.remove('is-hover'));

            this.renderKeyframes(row, shape);
            inner.appendChild(row);
        });

        const playhead = document.createElement('div');
        playhead.className = 'playhead';
        playhead.id = 'playhead';
        playhead.innerHTML = '<span class="playhead-grip" aria-hidden="true"></span>';
        inner.appendChild(playhead);
        this.playhead = playhead;

        const grip = playhead.querySelector('.playhead-grip');
        if (grip) {
            grip.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                this.rulerDrag = inner;
                this.seekFromRuler(e, inner, true);
            });
        }

        if (!ordered.length) {
            const empty = document.createElement('div');
            empty.className = 'timeline-empty';
            empty.innerHTML =
                '<strong>Aucun calque</strong>' +
                '<span>Créez une forme avec R, C ou T — ou piochez un effet dans la bibliothèque.</span>';
            inner.appendChild(empty);
            playhead.style.display = 'none';
        }

        this.timelineTracks.appendChild(inner);
        this.applyTimelineZoom();
        this.updateTimeDisplay(this.timeline.currentTime);
        this.timelineTracks.scrollLeft = previousScroll;
    }

    renderRulerMarks() {
        const marks = this.marksEl;
        if (!marks) return;

        const duration = Math.max(0.1, this.timeline.duration);
        marks.innerHTML = '';

        const step = this.timelineStep();
        const minor = step / 4;

        const minorCount = Math.round(duration / minor);
        for (let i = 0; i <= minorCount; i++) {
            const t = i * minor;
            const tick = document.createElement('span');
            const isMajor = Math.abs(t / step - Math.round(t / step)) < 0.001;
            tick.className = `ruler-tick${isMajor ? ' is-major' : ''}`;
            tick.style.left = `${(t / duration) * 100}%`;
            marks.appendChild(tick);
        }

        const majorCount = Math.round(duration / step);
        for (let i = 0; i <= majorCount; i++) {
            const t = i * step;
            const label = document.createElement('span');
            label.className = 'ruler-mark';
            label.style.left = `${(t / duration) * 100}%`;
            label.textContent = this.formatRulerTime(t, step);
            marks.appendChild(label);
        }
    }

    renderKeyframes(row, shape) {
        const duration = Math.max(0.1, this.timeline.duration);
        const MAX_DOTS = 160;

        // Un seul repère par instant : plusieurs propriétés animées au même
        // temps se superposent. Au-delà de MAX_DOTS instants distincts, une
        // barre de densité remplace les losanges.
        const instants = new Map();
        Object.keys(shape.keyframes || {}).forEach(prop => {
            (shape.keyframes[prop] || []).forEach(kf => {
                const key = Math.round(kf.t * 100);
                if (!instants.has(key)) instants.set(key, { t: kf.t, entries: [] });
                instants.get(key).entries.push({ prop, kf });
            });
        });

        const sortedInstants = [...instants.values()].sort((a, b) => a.t - b.t);

        if (sortedInstants.length > MAX_DOTS) {
            const bar = document.createElement('div');
            bar.className = 'track-density';
            const first = sortedInstants[0].t;
            const last = sortedInstants[sortedInstants.length - 1].t;
            bar.style.left = `${(first / duration) * 100}%`;
            bar.style.width = `${Math.max(0.6, ((last - first) / duration) * 100)}%`;
            bar.title = `${sortedInstants.length} instants animés — zoomez (Ctrl + molette) pour voir le détail`;
            row.appendChild(bar);
            return;
        }

        sortedInstants.forEach(instant => {
            const eased = instant.entries.some(entry => entry.kf.e);
            const dot = document.createElement('span');
            dot.className = `keyframe${eased ? ' is-eased' : ''}`;
            dot.style.left = `${(instant.t / duration) * 100}%`;

            const props = instant.entries.map(entry => entry.prop).join(', ');
            const curve = eased ? ` · ${instant.entries.find(entry => entry.kf.e).kf.e}` : '';
            dot.title = `${props} @ ${instant.t.toFixed(2)}s${curve}\nGlisser pour déplacer • Double-clic pour supprimer`;

            dot.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.editor.saveState();
                instant.entries.forEach(({ prop, kf }) => {
                    shape.keyframes[prop] = (shape.keyframes[prop] || []).filter(k => k !== kf);
                    if (shape.keyframes[prop].length === 0) delete shape.keyframes[prop];
                });
                this.refreshTimeline();
                this.editor.render();
            });

            let isDragging = false;
            let hasMoved = false;

            dot.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                e.preventDefault();
                isDragging = true;
                hasMoved = false;
                const startX = e.clientX;
                dot.classList.add('is-dragging');
                document.body.style.cursor = 'ew-resize';

                const onMouseMove = (moveEvent) => {
                    if (!isDragging) return;
                    if (!hasMoved && Math.abs(moveEvent.clientX - startX) < 2) return;

                    const rowRect = row.getBoundingClientRect();
                    if (!rowRect.width) return;

                    if (!hasMoved) {
                        this.editor.saveState();
                        hasMoved = true;
                    }

                    const x = Math.max(0, Math.min(moveEvent.clientX - rowRect.left, rowRect.width));
                    const newTime = Math.round((x / rowRect.width) * this.timeline.duration * 100) / 100;

                    instant.entries.forEach(({ kf }) => { kf.t = newTime; });
                    instant.t = newTime;

                    dot.style.left = `${(newTime / this.timeline.duration) * 100}%`;
                    this.timeline.seek(newTime);
                };

                const onMouseUp = () => {
                    if (!isDragging) return;
                    isDragging = false;
                    dot.classList.remove('is-dragging');
                    document.body.style.cursor = '';

                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);

                    if (hasMoved) {
                        Object.keys(shape.keyframes).forEach(prop => {
                            shape.keyframes[prop].sort((a, b) => a.t - b.t);
                        });
                        this.refreshTimeline();
                        this.editor.render();
                    } else {
                        this.timeline.seek(instant.t);
                        this.editor.selectShape(shape.id);
                    }
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            row.appendChild(dot);
        });
    }

    refreshLayers() {
        this.refreshTimeline();
    }

    highlightLayer(id) {
        this.refreshTimeline();
    }

    escapeAttr(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // Forme complète à partir d'un objet partiel (fichier projet, réponse IA).
    // Les valeurs non numériques sont écartées : un NaN dans un keyframe casse
    // tout le rendu, silencieusement.
    normalizeShapeData(raw, forcedId) {
        const source = raw && typeof raw === 'object' ? raw : {};
        const num = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
        const id = Number.isFinite(forcedId) ? forcedId : num(source.id, this.editor.nextId++);

        return {
            id: Math.round(id),
            type: source.type || 'Rect',
            name: source.name || `Shape ${Math.round(id)}`,
            x: num(source.x, 400),
            y: num(source.y, 225),
            z: num(source.z, 0),
            width: num(source.width, 100),
            height: num(source.height, 100),
            radius: num(source.radius, 50),
            fill: source.fill || '#ffffff',
            text: source.text != null ? String(source.text) : 'Text',
            fontSize: num(source.fontSize, 30),
            fontFamily: source.fontFamily || 'JetBrains Mono',
            fontWeight: num(source.fontWeight, 500),
            opacity: num(source.opacity, 1),
            rotation: num(source.rotation, 0),
            rotationX: num(source.rotationX, 0),
            rotationY: num(source.rotationY, 0),
            scaleX: num(source.scaleX, 1),
            scaleY: num(source.scaleY, 1),
            skewX: num(source.skewX, 0),
            skewY: num(source.skewY, 0),
            blur: num(source.blur, 0),
            glow: num(source.glow, 0),
            glowColor: source.glowColor || '#ffffff',
            hue: num(source.hue, 0),
            saturation: num(source.saturation, 100),
            brightness: num(source.brightness, 100),
            contrast: num(source.contrast, 100),
            imageSrc: typeof source.imageSrc === 'string' ? source.imageSrc : null,
            keyframes: this.normalizeKeyframes(source.keyframes)
        };
    }

    normalizeKeyframes(raw) {
        const output = {};
        if (!raw || typeof raw !== 'object') return output;

        Object.keys(raw).forEach(prop => {
            const list = Array.isArray(raw[prop]) ? raw[prop] : [];
            const keys = list
                .map(key => ({
                    t: Number(key && key.t),
                    v: Number(key && key.v),
                    e: key && typeof key.e === 'string' && EASING[key.e] ? key.e : null
                }))
                .filter(key => Number.isFinite(key.t) && Number.isFinite(key.v))
                .sort((a, b) => a.t - b.t)
                .map(key => {
                    const clean = { t: Math.round(key.t * 1000) / 1000, v: key.v };
                    if (key.e && key.e !== 'linear') clean.e = key.e;
                    return clean;
                });

            if (keys.length) output[prop] = keys;
        });

        return output;
    }

    openProjectFile(file) {
        const reader = new FileReader();

        reader.onload = () => {
            try {
                this.applyProject(JSON.parse(String(reader.result || '')));
            } catch (error) {
                alert(`Projet illisible : ${error.message}`);
            }
        };

        reader.onerror = () => alert('Lecture du fichier impossible.');

        reader.readAsText(file);
    }

    applyProject(data) {
        if (!data || !Array.isArray(data.shapes)) {
            throw new Error('le fichier ne contient pas de liste « shapes »');
        }

        this.editor.saveState();
        this.timeline.stop();

        this.editor.shapes = data.shapes.map(shape => this.normalizeShapeData(shape));
        this.editor.nextId = this.editor.shapes.reduce((max, shape) => Math.max(max, shape.id), 0) + 1;
        this.editor.selectedShapeId = null;

        // Les SVG ne voyagent que sous forme de data URL : on recharge l'image.
        this.editor.shapes.forEach(shape => {
            if (shape.type !== 'SVG' || !shape.imageSrc) return;
            const img = new Image();
            img.onload = () => this.editor.render();
            img.src = shape.imageSrc;
            shape.image = img;
        });

        const duration = Number(data.duration);
        if (Number.isFinite(duration) && duration > 0) {
            const next = Math.round(duration * 100) / 100;
            this.timeline.duration = next;
            this.syncDurationSelect(next);
        }

        const bg = typeof data.bgColor === 'string' && /^#[0-9a-f]{6}$/i.test(data.bgColor) ? data.bgColor : null;
        if (bg) {
            this.editor.bgColor = bg;
            const picker = document.getElementById('bg-color');
            if (picker) picker.value = bg;
        }

        this.showProperties(null);
        this.refreshTimeline();
        this.editor.render();
        this.timeline.seek(0);
    }

    // La liste déroulante ne connaît que des durées fixes : une durée importée
    // hors liste est ajoutée, sinon l'affichage mentirait sur la timeline.
    syncDurationSelect(duration) {
        const select = document.getElementById('timeline-duration');
        if (!select) return;

        const value = String(duration);
        if (![...select.options].some(option => option.value === value)) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = `${duration} s`;
            select.appendChild(option);
        }
        select.value = value;
    }

    showProperties(shape) {
        if (!shape) {
            this.propsContent.innerHTML = '<div class="empty-state">Aucune sélection</div>';
            return;
        }

        let html = `
            <!-- FX - EN PREMIER -->
            <div class="prop-section">
                <div class="prop-section-title">Effets</div>
                <div class="prop-row">
                    <div class="prop-group">
                        <label class="prop-label">Opacité</label>
                        <input type="range" min="0" max="1" step="0.01" class="prop-input" data-prop="opacity" value="${shape.opacity}">
                    </div>
                    <div class="prop-group">
                        <label class="prop-label">Flou</label>
                        <input type="range" min="0" max="50" class="prop-input" data-prop="blur" value="${shape.blur}">
                    </div>
                </div>
                <div class="prop-row">
                    <div class="prop-group">
                        <label class="prop-label">Lueur</label>
                        <input type="range" min="0" max="60" class="prop-input" data-prop="glow" value="${shape.glow}">
                    </div>
                    <div class="prop-group">
                        <label class="prop-label">Couleur de lueur</label>
                        <input type="color" class="prop-input" data-prop="glowColor" value="${this.escapeAttr(shape.glowColor || '#ffffff')}">
                    </div>
                </div>
                <div class="prop-row-4">
                    <div class="prop-group">
                        <label class="prop-label">Teinte</label>
                        <input type="range" min="0" max="360" class="prop-input" data-prop="hue" value="${shape.hue}">
                    </div>
                    <div class="prop-group">
                        <label class="prop-label">Saturation</label>
                        <input type="range" min="0" max="200" class="prop-input" data-prop="saturation" value="${shape.saturation}">
                    </div>
                    <div class="prop-group">
                        <label class="prop-label">Luminosité</label>
                        <input type="range" min="0" max="200" class="prop-input" data-prop="brightness" value="${shape.brightness}">
                    </div>
                    <div class="prop-group">
                        <label class="prop-label">Contraste</label>
                        <input type="range" min="0" max="200" class="prop-input" data-prop="contrast" value="${shape.contrast || 100}">
                    </div>
                </div>
            </div>

            <!-- TRANSFORM -->
            <div class="prop-section">
                <div class="prop-section-title">Transformation</div>
                <div class="prop-row-3">
                    <div class="prop-group">
                        <label class="prop-label">X</label>
                        <input type="number" class="prop-input" data-prop="x" value="${Math.round(shape.x)}">
                    </div>
                    <div class="prop-group">
                        <label class="prop-label">Y</label>
                        <input type="number" class="prop-input" data-prop="y" value="${Math.round(shape.y)}">
                    </div>
                    <div class="prop-group">
                        <label class="prop-label">Z</label>
                        <input type="number" class="prop-input" data-prop="z" value="${shape.z || 0}">
                    </div>
                </div>
                <div class="prop-row-3">
                    <div class="prop-group">
                        <label class="prop-label">Rot Z</label>
                        <input type="number" class="prop-input" data-prop="rotation" value="${shape.rotation}">
                    </div>
                    <div class="prop-group">
                        <label class="prop-label">Rot X</label>
                        <input type="number" class="prop-input" data-prop="rotationX" value="${shape.rotationX || 0}">
                    </div>
                    <div class="prop-group">
                        <label class="prop-label">Rot Y</label>
                        <input type="number" class="prop-input" data-prop="rotationY" value="${shape.rotationY || 0}">
                    </div>
                </div>
                <div class="prop-row-4">
                    <div class="prop-group">
                        <label class="prop-label">Échelle X</label>
                        <input type="number" class="prop-input" data-prop="scaleX" step="0.1" value="${shape.scaleX || 1}">
                    </div>
                    <div class="prop-group">
                        <label class="prop-label">Échelle Y</label>
                        <input type="number" class="prop-input" data-prop="scaleY" step="0.1" value="${shape.scaleY || 1}">
                    </div>
                    <div class="prop-group">
                        <label class="prop-label">Skew X</label>
                        <input type="number" class="prop-input" data-prop="skewX" value="${shape.skewX || 0}">
                    </div>
                    <div class="prop-group">
                        <label class="prop-label">Skew Y</label>
                        <input type="number" class="prop-input" data-prop="skewY" value="${shape.skewY || 0}">
                    </div>
                </div>
            </div>
        `;

        // Size/Shape specific
        if (shape.type === 'Rect' || shape.type === 'SVG') {
            html += `
            <div class="prop-section">
                <div class="prop-section-title">Taille</div>
                <div class="prop-row">
                    <div class="prop-group">
                        <label class="prop-label">L</label>
                        <input type="number" class="prop-input" data-prop="width" value="${Math.round(shape.width)}">
                    </div>
                    <div class="prop-group">
                        <label class="prop-label">H</label>
                        <input type="number" class="prop-input" data-prop="height" value="${Math.round(shape.height)}">
                    </div>
                </div>
            </div>
            `;
        } else if (shape.type === 'Circle') {
            html += `
            <div class="prop-section">
                <div class="prop-section-title">Taille</div>
                <div class="prop-group">
                    <label class="prop-label">Rayon</label>
                    <input type="number" class="prop-input" data-prop="radius" value="${shape.radius}">
                </div>
            </div>
            `;
        } else if (shape.type === 'Text') {
            const fonts = [
                'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'IBM Plex Mono', 
                'Space Mono', 'Roboto Mono', 'Ubuntu Mono', 'Inconsolata',
                'Victor Mono', 'Cascadia Code',
                'Inter', 'Space Grotesk', 'Syne', 'Outfit', 'Manrope',
                'Plus Jakarta Sans', 'DM Sans', 'Arial', 'Helvetica'
            ];
            const weights = [400, 500, 600, 700, 800, 900];
            
            const escapedText = this.escapeAttr(shape.text || '');
            html += `
            <div class="prop-section">
                <div class="prop-section-title">Texte</div>
                <div class="prop-group">
                    <input type="text" class="prop-input" data-prop="text" value="${escapedText}">
                </div>
                <div class="prop-row">
                    <div class="prop-group">
                        <label class="prop-label">Police</label>
                        <select class="prop-input" data-prop="fontFamily">
                            ${fonts.map(f => `<option value="${f}" ${shape.fontFamily === f ? 'selected' : ''} style="font-family:'${f}'">${f}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="prop-row">
                    <div class="prop-group">
                        <label class="prop-label">Taille</label>
                        <input type="number" class="prop-input" data-prop="fontSize" value="${shape.fontSize}">
                    </div>
                    <div class="prop-group">
                        <label class="prop-label">Graisse</label>
                        <select class="prop-input" data-prop="fontWeight">
                            ${weights.map(w => `<option value="${w}" ${shape.fontWeight === w ? 'selected' : ''}>${w}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
            `;
        }

        // Appearance
        html += `
            <div class="prop-section">
                <div class="prop-section-title">Remplissage</div>
                <div class="prop-row">
                    <div class="prop-group">
                        <input type="color" class="prop-input" data-prop="fill" value="${this.escapeAttr(shape.fill || '#ffffff')}">
                    </div>
                    <div class="prop-group">
                        <label class="prop-label">Nom</label>
                        <input type="text" class="prop-input" data-prop="name" value="${this.escapeAttr(shape.name)}">
                    </div>
                </div>
            </div>
        `;

        // Actions
        html += `
            <div class="prop-section">
                <div class="prop-section-title">Images clés</div>
                <div class="prop-group">
                    <label class="prop-label">Courbe</label>
                    <select class="prop-input" id="shape-easing">
                        ${EASING_LABELS.map(option => `<option value="${option.value}" ${(this.defaultEasing || 'expoOut') === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
                    </select>
                </div>
                <div class="prop-row">
                    <button id="btn-add-keyframe" class="action-btn sm">+ Position</button>
                    <button id="btn-add-keyframe-all" class="action-btn sm">+ Tout</button>
                </div>
            </div>
            <button id="btn-duplicate" class="action-btn sm block">Dupliquer (Ctrl+D)</button>
        `;

        this.propsContent.innerHTML = html;

        const easingSelect = document.getElementById('shape-easing');
        if (easingSelect) {
            easingSelect.onchange = () => {
                const curve = easingSelect.value;
                this.defaultEasing = curve;
                this.editor.defaultEasing = curve;
                this.editor.saveState();
                Object.keys(shape.keyframes || {}).forEach(prop => {
                    shape.keyframes[prop].forEach(kf => {
                        if (curve === 'linear') delete kf.e;
                        else kf.e = curve;
                    });
                });
                this.refreshTimeline();
                this.editor.render();
            };
        }

        const readEasing = () => (easingSelect ? easingSelect.value : this.defaultEasing) || 'linear';

        // Bind inputs (scoped to properties panel only)
        const inputs = this.propsContent.querySelectorAll('.prop-input');
        inputs.forEach(input => {
            const handleChange = (e) => {
                const prop = e.target.dataset.prop;
                let val = e.target.value;
                if (e.target.type === 'number' || e.target.type === 'range') {
                    val = parseFloat(val);
                    if (Number.isNaN(val)) return;
                }
                this.editor.updateShape(shape.id, { [prop]: val });
                if (prop === 'name') this.refreshTimeline();
            };
            
            input.addEventListener('input', handleChange);
            input.addEventListener('change', handleChange);
        });

        document.getElementById('btn-add-keyframe').onclick = () => {
            const t = this.timeline.currentTime;
            const ease = readEasing();
            this.editor.saveState();

            ['x', 'y'].forEach(prop => {
                if (!shape.keyframes[prop]) shape.keyframes[prop] = [];
                shape.keyframes[prop] = shape.keyframes[prop].filter(k => Math.abs(k.t - t) > 0.01);
                shape.keyframes[prop].push(ease === 'linear' ? { t, v: shape[prop] } : { t, v: shape[prop], e: ease });
                shape.keyframes[prop].sort((a, b) => a.t - b.t);
            });

            this.refreshTimeline();
        };

        document.getElementById('btn-add-keyframe-all').onclick = () => {
            const t = this.timeline.currentTime;
            const ease = readEasing();
            const animatableProps = ['x', 'y', 'rotation', 'rotationX', 'rotationY', 'scaleX', 'scaleY', 'opacity', 'blur', 'glow', 'hue', 'skewX', 'skewY'];

            this.editor.saveState();

            animatableProps.forEach(prop => {
                if (shape[prop] === undefined) return;
                if (!shape.keyframes[prop]) shape.keyframes[prop] = [];
                shape.keyframes[prop] = shape.keyframes[prop].filter(k => Math.abs(k.t - t) > 0.01);
                shape.keyframes[prop].push(ease === 'linear' ? { t, v: shape[prop] } : { t, v: shape[prop], e: ease });
                shape.keyframes[prop].sort((a, b) => a.t - b.t);
            });

            this.refreshTimeline();
        };

        document.getElementById('btn-duplicate').onclick = () => {
            this.editor.duplicateSelected();
        };
    }

    updateInputs(shape) {
        if (!shape) return;
        const xInput = document.querySelector('input[data-prop="x"]');
        const yInput = document.querySelector('input[data-prop="y"]');
        if (xInput) xInput.value = Math.round(shape.x);
        if (yInput) yInput.value = Math.round(shape.y);
    }

    formatTimecode(time) {
        const safe = Math.max(0, Number.isFinite(time) ? time : 0);
        const minutes = Math.floor(safe / 60);
        const seconds = Math.floor(safe % 60);
        const centis = Math.floor((safe % 1) * 100);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
    }

    updateTimeDisplay(time) {
        if (this.timeDisplay) {
            this.timeDisplay.textContent = this.formatTimecode(time);
        }

        const total = document.getElementById('time-total');
        if (total) {
            total.textContent = `/ ${this.formatTimecode(this.timeline.duration)}`;
        }

        const percent = this.timeline.duration > 0 ? (time / this.timeline.duration) * 100 : 0;

        if (this.scrubber) this.scrubber.value = percent;

        if (this.playhead) {
            this.playhead.style.left = `${percent}%`;
        }
    }

    updatePlayButton(isPlaying) {
        if (!this.playBtn) return;
        this.playBtn.classList.toggle('is-playing', !!isPlaying);
        this.playBtn.innerHTML = isPlaying ? ICON_PAUSE : ICON_PLAY;
        this.playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Lecture');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('motion-canvas');
    
    const timeline = new Timeline();
    const editor = new Editor(canvas, timeline);
    const ui = new UI(editor, timeline);
    const aiAssistant = new AIAssistant(editor, timeline, ui);

    // Expose editor globally for motion detector
    window.editor = editor;

    // Connect components
    editor.setUI(ui);
    timeline.setEditor(editor);
    timeline.setUI(ui);

    // Initialize Motion Detector
    window.motionDetector = new MotionDetector(editor);

    // Initial render
    editor.render();

    // New project button
    document.getElementById('btn-new')?.addEventListener('click', () => {
        if (editor.shapes.length === 0 || confirm('Effacer le projet actuel ?')) {
            editor.shapes = [];
            editor.nextId = 1;
            editor.selectedShapeId = null;
            timeline.stop();
            timeline.currentTime = 0;
            ui.refreshTimeline();
            ui.updateInputs(null);
            editor.render();
        }
    });

    // Save project button
    document.getElementById('btn-save')?.addEventListener('click', () => {
        editor.saveProjectFile();
    });

    // Open project button
    const projectInput = document.getElementById('file-input-project');
    document.getElementById('btn-open')?.addEventListener('click', () => {
        if (projectInput) projectInput.click();
    });
    if (projectInput) {
        projectInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) ui.openProjectFile(file);
            projectInput.value = '';
        });
    }

    // Collapsible panel sections
    document.querySelectorAll('.panel-header.toggle').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.dataset.target;
            const target = document.getElementById(targetId);
            const icon = header.querySelector('.toggle-icon');
            const section = header.closest('.panel-section');
            
            if (target) {
                target.classList.toggle('hidden');
                if (target.classList.contains('hidden')) {
                    icon.textContent = '▶';
                    section.classList.add('collapsed');
                } else {
                    icon.textContent = '▼';
                    section.classList.remove('collapsed');
                }
            }
        });
    });

    // Accordion system for right panel
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.dataset.accordion;
            const content = document.getElementById(targetId);
            
            if (content) {
                const isOpen = !content.classList.contains('hidden');
                
                // Close all accordions first
                document.querySelectorAll('.accordion-content').forEach(c => c.classList.add('hidden'));
                document.querySelectorAll('.accordion-header').forEach(h => h.classList.remove('active'));
                
                // If it was closed, open it
                if (!isOpen) {
                    content.classList.remove('hidden');
                    header.classList.add('active');
                }
            }
        });
    });

    // Global shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return; // Ignore when typing in form fields
        
        if (e.code === 'Space') {
            e.preventDefault();
            timeline.togglePlay();
        }
        if (e.code === 'Delete' || e.code === 'Backspace') {
            editor.deleteSelected();
        }
        if (e.code === 'KeyD' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            editor.duplicateSelected();
        }
        // Zoom shortcuts
        if ((e.ctrlKey || e.metaKey) && (e.code === 'Equal' || e.code === 'NumpadAdd')) {
            e.preventDefault();
            editor.zoomIn();
        }
        if ((e.ctrlKey || e.metaKey) && (e.code === 'Minus' || e.code === 'NumpadSubtract')) {
            e.preventDefault();
            editor.zoomOut();
        }
        if ((e.ctrlKey || e.metaKey) && e.code === 'Digit0') {
            e.preventDefault();
            editor.zoomReset();
        }
        if ((e.ctrlKey || e.metaKey) && e.code === 'Digit1') {
            e.preventDefault();
            editor.zoomFit();
        }
    });
    
    // Zoom with mouse wheel
    const canvasArea = document.querySelector('.canvas-area');
    if (canvasArea) {
        canvasArea.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (e.deltaY < 0) {
                    editor.zoomIn();
                } else {
                    editor.zoomOut();
                }
            }
        }, { passive: false });
    }

    // Export button opens modal
    document.getElementById('btn-export').addEventListener('click', () => {
        editor.openExportModal();
    });

    // Export modal controls
    document.getElementById('export-modal-close')?.addEventListener('click', () => {
        document.getElementById('export-modal').classList.add('hidden');
    });

    // Export size buttons
    let exportWidth = 800, exportHeight = 450, exportFps = 60, exportBitrate = 5000000;
    
    document.querySelectorAll('.export-size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.export-size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            exportWidth = parseInt(btn.dataset.width);
            exportHeight = parseInt(btn.dataset.height);
            updateExportInfo();
        });
    });

    document.querySelectorAll('.export-fps-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.export-fps-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            exportFps = parseInt(btn.dataset.fps);
            updateExportInfo();
        });
    });

    document.querySelectorAll('.export-quality-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.export-quality-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            exportBitrate = parseInt(btn.dataset.bitrate);
            updateExportInfo();
        });
    });

    function updateExportInfo() {
        const info = document.getElementById('export-info-text');
        if (info) {
            info.textContent = `Prêt : ${exportWidth}×${exportHeight} @ ${exportFps} fps`;
        }
    }

    document.getElementById('export-start')?.addEventListener('click', () => {
        editor.exportWebM(exportWidth, exportHeight, exportFps, exportBitrate);
    });

    // Export JS Modal
    let currentExportJSTab = 'full';
    
    document.getElementById('btn-export-js')?.addEventListener('click', () => {
        document.getElementById('export-js-modal').classList.remove('hidden');
        updateExportJSCode();
    });

    document.getElementById('export-js-modal-close')?.addEventListener('click', () => {
        document.getElementById('export-js-modal').classList.add('hidden');
    });

    document.querySelectorAll('.export-js-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.export-js-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentExportJSTab = tab.dataset.tab;
            updateExportJSCode();
        });
    });

    function updateExportJSCode() {
        const code = editor.generateExportJS(currentExportJSTab);
        const codeEl = document.getElementById('export-js-code');
        const sizeEl = document.getElementById('export-js-size');
        if (codeEl) {
            codeEl.textContent = code;
            // Syntax highlighting could be added here
        }
        if (sizeEl) {
            const bytes = new Blob([code]).size;
            const kb = (bytes / 1024).toFixed(1);
            sizeEl.textContent = `${kb} KB (${bytes} bytes)`;
        }
    }

    document.getElementById('copy-export-js')?.addEventListener('click', (e) => {
        const code = document.getElementById('export-js-code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            const btn = e.target;
            btn.textContent = '✓ Copié!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = '📋 Copier';
                btn.classList.remove('copied');
            }, 2000);
        });
    });

    document.getElementById('download-export-js')?.addEventListener('click', () => {
        const code = editor.generateExportJS(currentExportJSTab);
        const ext = currentExportJSTab === 'data' ? 'json' : (currentExportJSTab === 'js' ? 'js' : 'html');
        const mime = currentExportJSTab === 'data' ? 'application/json' : (currentExportJSTab === 'js' ? 'text/javascript' : 'text/html');
        const blob = new Blob([code], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `motion-animation.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Zoom buttons
    document.getElementById('zoom-in')?.addEventListener('click', () => editor.zoomIn());
    document.getElementById('zoom-out')?.addEventListener('click', () => editor.zoomOut());
    document.getElementById('zoom-reset')?.addEventListener('click', () => editor.zoomReset());
});

// AI Assistant Class
class AIAssistant {
    constructor(editor, timeline, ui) {
        this.editor = editor;
        this.timeline = timeline;
        this.ui = ui;
        
        this.provider = null;
        this.apiKey = null;
        this.model = null;
        this.connected = false;
        
        this.models = {
            gemini: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
            anthropic: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
            openai: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
            grok: ['grok-3', 'grok-3-mini', 'grok-2'],
            mistral: ['mistral-large-latest', 'mistral-small-latest', 'open-mistral-nemo', 'codestral-latest'],
            cohere: ['command-r-plus', 'command-r', 'command-light']
        };
        
        this.setupListeners();
    }
    
    setupListeners() {
        // Bouton IA : la console s'ouvre si la connexion est déjà établie,
        // sinon on passe par la configuration.
        document.getElementById('btn-ia').onclick = () => {
            if (this.connected) {
                document.getElementById('ai-console').classList.remove('hidden');
                return;
            }
            document.getElementById('ai-modal').classList.remove('hidden');
        };
        
        // Close modal
        document.getElementById('modal-close').onclick = () => {
            document.getElementById('ai-modal').classList.add('hidden');
        };
        
        // Close console
        document.getElementById('ai-console-close').onclick = () => {
            document.getElementById('ai-console').classList.add('hidden');
        };
        
        // Make console draggable
        this.setupConsoleDrag();
        
        // Provider selection
        document.querySelectorAll('.ai-provider-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.ai-provider-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.provider = btn.dataset.provider;
                this.updateModelSelect();
            };
        });
        
        // Connect button
        document.getElementById('ai-connect').onclick = () => this.connect();
        
        // Send prompt
        document.getElementById('ai-send').onclick = () => this.sendPrompt();
        document.getElementById('ai-prompt').addEventListener('keydown', (e) => {
            // Enter to send, Shift+Enter for new line
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendPrompt();
            }
        });
        
        // Example prompt buttons
        document.querySelectorAll('.ai-example-btn').forEach(btn => {
            btn.onclick = () => {
                const prompt = btn.dataset.prompt;
                if (prompt) {
                    document.getElementById('ai-prompt').value = prompt;
                    // Auto-send if connected
                    if (this.connected) {
                        this.sendPrompt();
                    }
                }
            };
        });
    }
    
    setupConsoleDrag() {
        const console = document.getElementById('ai-console');
        const header = document.getElementById('ai-console-drag');
        
        let isDragging = false;
        let startX, startY, initialX, initialY;
        
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = console.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            
            // Switch from bottom/right to top/left positioning
            console.style.bottom = 'auto';
            console.style.right = 'auto';
            console.style.left = initialX + 'px';
            console.style.top = initialY + 'px';
            
            document.body.style.cursor = 'grabbing';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            let newX = initialX + dx;
            let newY = initialY + dy;
            
            // Keep within viewport
            newX = Math.max(0, Math.min(newX, window.innerWidth - console.offsetWidth));
            newY = Math.max(0, Math.min(newY, window.innerHeight - console.offsetHeight));
            
            console.style.left = newX + 'px';
            console.style.top = newY + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = '';
            }
        });
    }
    
    updateModelSelect() {
        const select = document.getElementById('ai-model-select');
        select.innerHTML = '';
        
        if (this.provider && this.models[this.provider]) {
            this.models[this.provider].forEach(model => {
                const opt = document.createElement('option');
                opt.value = model;
                opt.textContent = model;
                select.appendChild(opt);
            });
        }
    }
    
    connect() {
        const apiKey = document.getElementById('ai-api-key').value.trim();
        const model = document.getElementById('ai-model-select').value;
        const errorEl = document.getElementById('ai-error');
        
        if (!this.provider) {
            errorEl.textContent = 'Sélectionnez un fournisseur';
            return;
        }
        if (!apiKey) {
            errorEl.textContent = 'Saisissez une clé API';
            return;
        }
        if (!model) {
            errorEl.textContent = 'Sélectionnez un modèle';
            return;
        }
        
        this.apiKey = apiKey;
        this.model = model;
        this.connected = true;
        
        // Update UI
        document.getElementById('ai-status').textContent = '● Connected';
        document.getElementById('ai-status').classList.add('connected');
        document.getElementById('ai-model').textContent = `${this.provider} / ${this.model}`;
        
        // Close modal, show console
        document.getElementById('ai-modal').classList.add('hidden');
        document.getElementById('ai-console').classList.remove('hidden');
        
        this.addMessage('ai', `Connecté à ${this.provider} (${this.model}). Décrivez une animation, je la crée.`);
    }
    
    addMessage(type, text) {
        const container = document.getElementById('ai-messages');
        const msg = document.createElement('div');
        msg.className = `ai-message ${type}`;
        msg.textContent = text;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }
    
    async sendPrompt() {
        const input = document.getElementById('ai-prompt');
        const prompt = input.value.trim();
        
        if (!prompt) return;
        if (!this.connected) {
            this.addMessage('error', 'Non connecté. Cliquez sur IA pour configurer.');
            return;
        }
        
        this.addMessage('user', prompt);
        input.value = '';
        
        try {
            this.addMessage('ai', 'Analyse…');
            
            const systemPrompt = this.getSystemPrompt();
            const response = await this.callAPI(systemPrompt, prompt);
            
            // Remove "Thinking..." message
            const messages = document.getElementById('ai-messages');
            messages.lastChild.remove();
            
            // Parse and execute response
            this.executeAIResponse(response);
            
        } catch (error) {
            const messages = document.getElementById('ai-messages');
            if (messages.lastChild.textContent === 'Analyse…') {
                messages.lastChild.remove();
            }
            this.addMessage('error', `Erreur : ${error.message}`);
        }
    }
    
    getSystemPrompt() {
        const duration = this.timeline.duration;
        const shapes = this.editor.shapes;
        
        // Build current scene context with full details for modification
        let sceneContext = '';
        if (shapes && shapes.length > 0) {
            sceneContext = `\n=== CURRENT SCENE (${shapes.length} objects) ===\n`;
            sceneContext += `You can MODIFY these existing objects by referencing their ID:\n\n`;
            shapes.forEach((shape) => {
                const kfProps = shape.keyframes ? Object.keys(shape.keyframes) : [];
                sceneContext += `• ID:${shape.id} "${shape.name}" (${shape.type})`;
                sceneContext += ` - pos:(${Math.round(shape.x)},${Math.round(shape.y)})`;
                sceneContext += ` fill:${shape.fill}`;
                if (shape.type === 'Text') sceneContext += ` text:"${shape.text}"`;
                if (kfProps.length > 0) sceneContext += ` animated:[${kfProps.join(',')}]`;
                sceneContext += '\n';
            });
            sceneContext += `\nTo MODIFY existing shapes: use "action": "modify" and include their "id"\n`;
            sceneContext += `To ADD new shapes: use "action": "add"\n`;
            sceneContext += `To REPLACE everything: use "action": "replace"\n`;
        } else {
            sceneContext = '\n=== CURRENT SCENE ===\nEmpty canvas - no objects yet.\n';
        }

        return `You are the AI assistant built into HOT MOTOR MOTION — a professional, browser-based motion graphics editor written entirely in JavaScript/Canvas.
Your ONLY job is to create, modify, or replace animation scenes by returning PURE JSON. Never return explanation text, markdown, or code blocks — ONLY valid JSON.

=== ABOUT HOT MOTOR MOTION ===
HOT MOTOR MOTION is a real-time motion design tool running in the browser.
- Users place shapes (Rect, Circle, Text, SVG) on an 800×450 canvas.
- Each shape has visual properties (fill, opacity, blur, glow…) and transform properties (x, y, rotation, scale…).
- Users animate properties with KEYFRAMES on a timeline (0 → ${duration}s).
- The engine linearly interpolates values between keyframes in real time.
- Users can export to WebM video or standalone JavaScript.
- The tool supports Google Fonts, 3D rotations (via rotationX/Y), glow effects, blur, hue shifting, etc.
- The canvas coordinate system: top-left is (0,0), center is (400,225), bottom-right is (800,450).
${sceneContext}
=== SHAPE TYPES ===
| Type   | Specific Properties |
|--------|---------------------|
| Rect   | width, height |
| Circle | radius |
| Text   | text, fontSize, fontFamily, fontWeight |
| SVG    | width, height (loaded externally) |

=== ALL ANIMATABLE PROPERTIES ===
Position:   x (0–800), y (0–450)
Size:       width, height (Rect/SVG), radius (Circle)
Transform:  rotation (degrees), rotationX, rotationY (3D), scaleX, scaleY (1=100%), skewX, skewY (degrees)
Visual:     opacity (0–1), fill (hex color e.g. "#ff0000")
Effects:    blur (0–50 px), glow (0–50), glowColor (hex), hue (0–360°), saturation (0–200, 100=normal), brightness (0–200, 100=normal), contrast (0–200, 100=normal)

=== TEXT-SPECIFIC PROPERTIES ===
- text: string content to display
- fontSize: pixels (default 48)
- fontFamily: any Google Font loaded in the app — JetBrains Mono, Fira Code, Source Code Pro, IBM Plex Mono, Space Mono, Roboto Mono, Ubuntu Mono, Inconsolata, Victor Mono, Cascadia Code, Inter, Space Grotesk, Syne, Outfit, Manrope, Plus Jakarta Sans, DM Sans, Arial, Helvetica
- fontWeight: 100–900 (400=normal, 700=bold)

=== KEYFRAME SYSTEM ===
Each animatable property can have an array of keyframes: { "t": <seconds>, "v": <value> }
The engine interpolates linearly between consecutive keyframes.
- t=0 is the animation start, t=${duration} is the end.
- Multiple intermediate keyframes create easing effects (ease-in/out by clustering keyframes).
- Properties WITHOUT keyframes remain static at their base value.

=== RESPONSE FORMAT (STRICT) ===
Return ONLY this JSON structure — no text before or after:
{
  "message": "Short human-readable description of what was created/changed",
  "action": "add" | "modify" | "replace",
  "shapes": [ ... ]
}

ACTION TYPES:
- "replace" → clear the entire canvas and create a fresh scene
- "add"     → add new shapes while keeping all existing ones
- "modify"  → update existing shapes by ID (include only changed properties)

SHAPE OBJECT IN "shapes" ARRAY:
{
  "type": "Rect|Circle|Text",
  "name": "Human-readable label",
  "x": 400, "y": 225,
  "width": 100, "height": 100,
  "radius": 50,
  "fill": "#ffffff",
  "opacity": 1,
  "rotation": 0,
  "text": "Hello",
  "fontSize": 48,
  "fontFamily": "Inter",
  "fontWeight": 700,
  "blur": 0, "glow": 0, "glowColor": "#ffffff",
  "scaleX": 1, "scaleY": 1,
  "keyframes": {
    "x": [{"t":0,"v":100},{"t":${duration},"v":700}],
    "opacity": [{"t":0,"v":0},{"t":1,"v":1}]
  }
}

=== MODIFY ACTION ===
- Include "id" matching an existing shape's ID.
- Send ONLY the properties you want to change.
- Keyframes are MERGED unless you add "replaceKeyframes": true.

=== DESIGN GUIDELINES ===
- Create visually striking, professional-quality animations.
- Combine multiple animated properties for richness (movement + opacity + glow + rotation).
- Use staggered start times for sequential/cascading effects.
- Use intermediate keyframes to simulate easing (fast→slow or slow→fast).
- Use glow + hue animation for neon/cyberpunk effects.
- Scale from 0→1 for "pop-in", 1→0 for "pop-out".
- Blur transitions create depth-of-field effects.
- For text animations: fade in letters one by one using multiple Text shapes with staggered opacity.
- For logo reveals: combine scale, opacity, glow, and blur keyframes.
- Keep shapes within canvas bounds (0–800 x, 0–450 y) unless intentionally entering/exiting frame.

=== EXAMPLE PATTERNS ===

1. BOUNCING BALL:
{"type":"Circle","name":"Ball","x":400,"y":50,"radius":30,"fill":"#ff4444","keyframes":{"y":[{"t":0,"v":50},{"t":0.5,"v":400},{"t":1,"v":50},{"t":1.5,"v":400},{"t":2,"v":50}]}}

2. TITLE REVEAL (fade+slide):
{"type":"Text","name":"Title","x":400,"y":225,"text":"HELLO","fontSize":72,"fontFamily":"Inter","fontWeight":800,"fill":"#ffffff","opacity":0,"keyframes":{"opacity":[{"t":0,"v":0},{"t":1,"v":1}],"y":[{"t":0,"v":280},{"t":1,"v":225}],"blur":[{"t":0,"v":10},{"t":1,"v":0}]}}

3. NEON GLOW PULSE:
{"type":"Circle","name":"Neon","x":400,"y":225,"radius":60,"fill":"#00ffcc","glow":20,"glowColor":"#00ffcc","keyframes":{"glow":[{"t":0,"v":5},{"t":1,"v":40},{"t":2,"v":5}],"scaleX":[{"t":0,"v":1},{"t":1,"v":1.3},{"t":2,"v":1}],"scaleY":[{"t":0,"v":1},{"t":1,"v":1.3},{"t":2,"v":1}]}}

4. SPINNING LOGO:
{"type":"Rect","name":"Logo BG","x":400,"y":225,"width":120,"height":120,"fill":"#FFD700","keyframes":{"rotation":[{"t":0,"v":0},{"t":${duration},"v":360}],"scaleX":[{"t":0,"v":0},{"t":0.5,"v":1.2},{"t":1,"v":1}],"scaleY":[{"t":0,"v":0},{"t":0.5,"v":1.2},{"t":1,"v":1}]}}

Create professional, smooth, visually appealing animations!`;
    }
    
    async callAPI(systemPrompt, userPrompt) {
        let url, headers, body;
        
        if (this.provider === 'openai') {
            url = 'https://api.openai.com/v1/chat/completions';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            };
            // o-series (reasoning) models require max_completion_tokens and temperature=1
            const isReasoningModel = this.model.startsWith('o');
            const params = {
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' }
            };
            if (isReasoningModel) {
                params.max_completion_tokens = 8192;
            } else {
                params.temperature = 0.7;
                params.max_tokens = 8192;
            }
            body = JSON.stringify(params);
        } else if (this.provider === 'anthropic') {
            url = 'https://api.anthropic.com/v1/messages';
            headers = {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                // Autorise l'appel direct depuis le navigateur (CORS).
                'anthropic-dangerous-direct-browser-access': 'true'
            };
            body = JSON.stringify({
                model: this.model,
                max_tokens: 8192,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: userPrompt }
                ]
            });
        } else if (this.provider === 'gemini') {
            // La clé passe par l'en-tête : elle ne finit ni dans l'URL ni dans
            // les journaux du serveur.
            url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
            headers = {
                'Content-Type': 'application/json',
                'x-goog-api-key': this.apiKey
            };
            body = JSON.stringify({
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
                contents: [{
                    role: 'user',
                    parts: [{ text: userPrompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    responseMimeType: 'application/json',
                    maxOutputTokens: 8192
                }
            });
        } else if (this.provider === 'grok') {
            url = 'https://api.x.ai/v1/chat/completions';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            };
            body = JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 8192
            });
        } else if (this.provider === 'mistral') {
            url = 'https://api.mistral.ai/v1/chat/completions';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            };
            body = JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 8192,
                response_format: { type: 'json_object' }
            });
        } else if (this.provider === 'cohere') {
            url = 'https://api.cohere.com/v2/chat';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            };
            body = JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 8192
            });
        }
        
        let response;
        let usingProxy = false;

        // Try using local PHP proxy first (bypasses CORS)
        if (window.location.protocol.startsWith('http')) {
            try {
                const proxyResponse = await fetch('proxy.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, headers, body })
                });
                
                // If proxy.php exists (not 404), use its response
                if (proxyResponse.status !== 404) {
                    response = proxyResponse;
                    usingProxy = true;
                }
            } catch (e) {
                // Relais absent (hébergement statique) : appel direct.
            }
        }

        // Fallback to direct call if proxy didn't work
        if (!usingProxy) {
            response = await fetch(url, { method: 'POST', headers, body });
        }
        
        if (!response.ok) {
            let error;
            try {
                error = await response.json();
            } catch (parseError) {
                error = { message: `HTTP ${response.status} ${response.statusText}`.trim() };
            }
            console.error('API Error:', error);
            // Anthropic specific error format
            if (error.error?.type) {
                throw new Error(`${error.error.type}: ${error.error.message}`);
            }
            const errorMsg = error.error?.message || error.message || error.detail || JSON.stringify(error);
            throw new Error(errorMsg);
        }
        
        const data = await response.json();
        
        // Extract text based on provider
        let text;
        if (this.provider === 'openai' || this.provider === 'grok' || this.provider === 'mistral') {
            text = data.choices?.[0]?.message?.content;
        } else if (this.provider === 'anthropic') {
            text = data.content?.[0]?.text;
        } else if (this.provider === 'gemini') {
            text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        } else if (this.provider === 'cohere') {
            // Cohere v2 uses message.content, v1 uses text
            text = data.message?.content?.[0]?.text || data.text;
        }

        if (!text) {
            throw new Error('Réponse vide du fournisseur.');
        }
        
        return text;
    }
    
    executeAIResponse(response) {
        try {
            // Clean response (remove markdown if present)
            let jsonStr = String(response || '').trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
            }

            // Certains modèles ajoutent une phrase avant ou après le JSON.
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace > 0 || lastBrace < jsonStr.length - 1) {
                if (firstBrace >= 0 && lastBrace > firstBrace) {
                    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
                }
            }
            
            const data = JSON.parse(jsonStr);
            
            if (data.message) {
                this.addMessage('ai', data.message);
            }
            
            if (data.shapes && Array.isArray(data.shapes) && this.editor) {
                const action = data.action || 'replace';
                let addedCount = 0;
                let modifiedCount = 0;

                this.editor.saveState();

                if (action === 'replace') {
                    // Clear existing shapes and create new ones
                    this.editor.shapes = [];
                    this.editor.nextId = 1;
                    this.editor.selectedShapeId = null;
                    this.ui.showProperties(null);
                    
                    data.shapes.forEach(shapeData => {
                        const shape = this.createShapeFromData(shapeData);
                        this.editor.shapes.push(shape);
                        addedCount++;
                    });
                    
                } else if (action === 'add') {
                    // Add new shapes without removing existing ones
                    data.shapes.forEach(shapeData => {
                        const shape = this.createShapeFromData(shapeData);
                        this.editor.shapes.push(shape);
                        addedCount++;
                    });
                    
                } else if (action === 'modify') {
                    // Modify existing shapes by ID
                    data.shapes.forEach(shapeData => {
                        if (shapeData.id) {
                            const existing = this.editor.shapes.find(s => s.id === shapeData.id);
                            if (existing) {
                                // Update only provided properties
                                const propsToUpdate = ['x', 'y', 'width', 'height', 'radius', 'fill', 
                                    'text', 'fontSize', 'fontFamily', 'fontWeight', 'opacity', 
                                    'rotation', 'rotationX', 'rotationY', 'scaleX', 'scaleY',
                                    'blur', 'hue', 'saturation', 'brightness', 'contrast',
                                    'glow', 'glowColor', 'skewX', 'skewY', 'name'];
                                
                                propsToUpdate.forEach(prop => {
                                    if (shapeData[prop] !== undefined) {
                                        existing[prop] = shapeData[prop];
                                    }
                                });
                                
                                // Handle keyframes
                                if (shapeData.keyframes) {
                                    if (shapeData.replaceKeyframes) {
                                        existing.keyframes = shapeData.keyframes;
                                    } else {
                                        // Merge keyframes
                                        existing.keyframes = existing.keyframes || {};
                                        for (const [prop, kfs] of Object.entries(shapeData.keyframes)) {
                                            existing.keyframes[prop] = kfs;
                                        }
                                    }
                                }
                                modifiedCount++;
                            }
                        } else {
                            // No ID means add new shape
                            const shape = this.createShapeFromData(shapeData);
                            this.editor.shapes.push(shape);
                            addedCount++;
                        }
                    });
                }
                
                this.ui.refreshTimeline();
                this.editor.render();
                
                // Build result message
                let resultMsg = '';
                if (addedCount > 0) resultMsg += `${addedCount} forme(s) ajoutée(s). `;
                if (modifiedCount > 0) resultMsg += `${modifiedCount} forme(s) modifiée(s). `;
                resultMsg += 'Appuyez sur Espace pour lire.';
                this.addMessage('ai', resultMsg);
            }
            
        } catch (e) {
            this.addMessage('error', 'Réponse IA illisible : ' + e.message);
            console.error('AI Response:', response);
        }
    }
    
    createShapeFromData(shapeData) {
        return this.ui.normalizeShapeData(shapeData, this.editor.nextId++);
    }
}

// Motion Detection Class
class MotionDetector {
    constructor(editor) {
        this.editor = editor;
        this.video = document.getElementById('webcam-video');
        this.videoMini = document.getElementById('webcam-video-mini');
        this.canvas = document.getElementById('webcam-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.handCursor = document.getElementById('hand-cursor');
        
        this.isRunning = false;
        this.stream = null;
        this.previousFrame = null;
        this.sensitivity = 50;
        this.mirror = true;
        
        this.motionX = 0;
        this.motionY = 0;
        this.smoothX = 0.5;
        this.smoothY = 0.5;
        
        this.setupListeners();
    }
    
    setupListeners() {
        const modal = document.getElementById('webcam-modal');
        const mini = document.getElementById('webcam-mini');
        const btnWebcam = document.getElementById('btn-webcam');
        const btnClose = document.getElementById('webcam-modal-close');
        const btnStart = document.getElementById('webcam-start');
        const btnStop = document.getElementById('webcam-stop');
        const btnMinimize = document.getElementById('webcam-minimize');
        const btnExpand = document.getElementById('webcam-expand');
        const sensitivitySlider = document.getElementById('webcam-sensitivity');
        const mirrorCheckbox = document.getElementById('webcam-mirror');
        
        if (btnWebcam) {
            btnWebcam.onclick = () => {
                modal.classList.remove('hidden');
                if (mini) mini.classList.add('hidden');
            };
        }
        
        if (btnClose) {
            btnClose.onclick = () => {
                modal.classList.add('hidden');
                // Don't stop - keep running in background if started
                if (this.isRunning && mini) {
                    mini.classList.remove('hidden');
                }
            };
        }
        
        if (btnStart) {
            btnStart.onclick = () => this.start();
        }
        
        if (btnStop) {
            btnStop.onclick = () => {
                this.stop();
                if (mini) mini.classList.add('hidden');
            };
        }
        
        if (btnMinimize) {
            btnMinimize.onclick = () => {
                modal.classList.add('hidden');
                if (this.isRunning && mini) {
                    mini.classList.remove('hidden');
                }
            };
        }
        
        if (btnExpand) {
            btnExpand.onclick = () => {
                if (mini) mini.classList.add('hidden');
                modal.classList.remove('hidden');
            };
        }
        
        if (sensitivitySlider) {
            sensitivitySlider.oninput = (e) => {
                this.sensitivity = parseInt(e.target.value);
            };
        }
        
        if (mirrorCheckbox) {
            mirrorCheckbox.onchange = (e) => {
                this.mirror = e.target.checked;
                if (this.video) {
                    this.video.style.transform = this.mirror ? 'scaleX(-1)' : 'scaleX(1)';
                }
                if (this.videoMini) {
                    this.videoMini.style.transform = this.mirror ? 'scaleX(-1)' : 'scaleX(1)';
                }
            };
        }
    }
    
    async start() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240, facingMode: 'user' }
            });
            
            this.video.srcObject = this.stream;
            await this.video.play();
            
            // Also set mini video
            if (this.videoMini) {
                this.videoMini.srcObject = this.stream;
                this.videoMini.play();
            }
            
            this.canvas.width = 320;
            this.canvas.height = 240;
            
            this.isRunning = true;
            this.previousFrame = null;
            this.smoothX = 0.5;
            this.smoothY = 0.5;
            
            if (this.handCursor) {
                this.handCursor.classList.add('active');
            }
            
            // Update button states
            const btnStart = document.getElementById('webcam-start');
            const btnStop = document.getElementById('webcam-stop');
            if (btnStart) btnStart.textContent = '● Running';
            if (btnStop) btnStop.classList.add('primary');
            
            // Update status indicator
            const status = document.getElementById('webcam-mini-status');
            if (status) status.style.color = '#00ff88';
            
            this.detectMotion();
            
        } catch (err) {
            console.error('Webcam error:', err);
            alert('Caméra inaccessible : ' + err.message);
        }
    }
    
    stop() {
        this.isRunning = false;
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.video) {
            this.video.srcObject = null;
        }
        
        if (this.videoMini) {
            this.videoMini.srcObject = null;
        }
        
        if (this.handCursor) {
            this.handCursor.classList.remove('active');
        }
        
        // Update button states
        const btnStart = document.getElementById('webcam-start');
        const btnStop = document.getElementById('webcam-stop');
        if (btnStart) btnStart.textContent = '▶ Start Camera';
        if (btnStop) btnStop.classList.remove('primary');
        
        this.previousFrame = null;
    }
    
    detectMotion() {
        if (!this.isRunning) return;
        
        // Draw current frame
        this.ctx.drawImage(this.video, 0, 0, 320, 240);
        const currentFrame = this.ctx.getImageData(0, 0, 320, 240);
        
        if (this.previousFrame) {
            const motion = this.analyzeMotion(this.previousFrame, currentFrame);
            
            if (motion.detected) {
                // Smooth the motion
                this.smoothX += (motion.x - this.smoothX) * 0.3;
                this.smoothY += (motion.y - this.smoothY) * 0.3;
                
                // Update hand cursor position
                if (this.handCursor) {
                    const containerRect = this.canvas.parentElement.getBoundingClientRect();
                    let cursorX = this.mirror ? (1 - this.smoothX) : this.smoothX;
                    this.handCursor.style.left = (cursorX * containerRect.width) + 'px';
                    this.handCursor.style.top = (this.smoothY * containerRect.height) + 'px';
                }
                
                // Move selected shape directly
                if (this.editor && this.editor.selectedShapeId) {
                    const shape = this.editor.getShape(this.editor.selectedShapeId);
                    if (shape) {
                        // Coordonnées de la scène (800×450), pas celles du canvas
                        // agrandi par le DPR et le zoom.
                        const canvasWidth = this.editor.baseWidth;
                        const canvasHeight = this.editor.baseHeight;

                        let targetX = this.mirror ? (1 - this.smoothX) : this.smoothX;

                        // Update shape position directly (bypass keyframe system for live control)
                        shape.x = targetX * canvasWidth;
                        shape.y = this.smoothY * canvasHeight;
                        
                        // Re-render the canvas
                        this.editor.render();
                        
                        // Update UI inputs if visible
                        if (this.editor.ui) {
                            this.editor.ui.updateInputs(shape);
                        }
                    }
                }
            }
            
            // Draw motion visualization
            this.drawMotionOverlay(currentFrame, this.previousFrame);
        }
        
        this.previousFrame = currentFrame;
        
        requestAnimationFrame(() => this.detectMotion());
    }
    
    analyzeMotion(prev, curr) {
        const data1 = prev.data;
        const data2 = curr.data;
        const width = 320;
        const height = 240;
        
        let totalMotion = 0;
        let motionX = 0;
        let motionY = 0;
        let motionCount = 0;
        
        const threshold = 150 - this.sensitivity; // Higher sensitivity = lower threshold
        const blockSize = 10;
        
        for (let y = 0; y < height; y += blockSize) {
            for (let x = 0; x < width; x += blockSize) {
                let blockDiff = 0;
                
                for (let by = 0; by < blockSize && y + by < height; by++) {
                    for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
                        const i = ((y + by) * width + (x + bx)) * 4;
                        const diff = Math.abs(data1[i] - data2[i]) +
                                    Math.abs(data1[i + 1] - data2[i + 1]) +
                                    Math.abs(data1[i + 2] - data2[i + 2]);
                        blockDiff += diff;
                    }
                }
                
                blockDiff /= (blockSize * blockSize * 3);
                
                if (blockDiff > threshold) {
                    motionX += x + blockSize / 2;
                    motionY += y + blockSize / 2;
                    motionCount++;
                    totalMotion += blockDiff;
                }
            }
        }
        
        if (motionCount > 5) {
            return {
                detected: true,
                x: (motionX / motionCount) / width,
                y: (motionY / motionCount) / height,
                intensity: totalMotion / motionCount
            };
        }
        
        return { detected: false, x: 0.5, y: 0.5, intensity: 0 };
    }
    
    drawMotionOverlay(curr, prev) {
        const data1 = prev.data;
        const data2 = curr.data;
        const output = this.ctx.createImageData(320, 240);
        const out = output.data;
        
        const threshold = 150 - this.sensitivity;
        
        for (let i = 0; i < data1.length; i += 4) {
            const diff = Math.abs(data1[i] - data2[i]) +
                        Math.abs(data1[i + 1] - data2[i + 1]) +
                        Math.abs(data1[i + 2] - data2[i + 2]);
            
            if (diff > threshold) {
                out[i] = 0;       // R
                out[i + 1] = 255; // G
                out[i + 2] = 136; // B
                out[i + 3] = 150; // A
            } else {
                out[i + 3] = 0;
            }
        }
        
        this.ctx.putImageData(output, 0, 0);
    }
}

// Particle Effects now use timeline-based presets instead of Three.js overlay
// See setupPresetButtons() for starField, galaxySpin, particleWaveField, snowFall, etc.
