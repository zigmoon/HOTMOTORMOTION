/* ═══════════════════════════════════════════════════════════════════════════
   HOT MOTOR MOTION — bibliothèque de presets
   Principe : peu d'images clés, mais de vraies courbes d'accélération. Un
   mouvement contemporain se joue sur l'amorti (spring, expo, back), pas sur
   des milliers de micro-images clés. Chaque preset tient sous 25 formes et
   sous 200 images clés : application instantanée, lecture fluide, export léger.
   Palette sobre : encre, gris, une seule touche d'or (la marque).
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    var INK = '#f2f2f4';
    var MUTED = '#8b8b96';
    var LINE = '#33333c';
    var GOLD = '#f5c518';
    var SHADE = '#1a1a20';

    // ── Aides ──────────────────────────────────────────────────────────────

    function k(t, v, e) {
        return e ? { t: Math.round(t * 1000) / 1000, v: v, e: e } : { t: Math.round(t * 1000) / 1000, v: v };
    }

    function text(h, props) {
        return h.shape('Text', Object.assign({
            fill: INK,
            fontFamily: 'Inter',
            fontWeight: 600,
            fontSize: 48
        }, props));
    }

    function rect(h, props) {
        return h.shape('Rect', Object.assign({ fill: INK }, props));
    }

    function circle(h, props) {
        return h.shape('Circle', Object.assign({ fill: INK }, props));
    }

    // Entrée amortie : échelle + opacité, la base de tout mouvement propre.
    function popIn(h, shape, start, dur, from, ease) {
        var s = from == null ? 0.86 : from;
        h.keys(shape, 'scaleX', [k(start, s, ease || 'backOut'), k(start + dur, 1)]);
        h.keys(shape, 'scaleY', [k(start, s, ease || 'backOut'), k(start + dur, 1)]);
        h.keys(shape, 'opacity', [k(start, 0), k(start + dur * 0.62, 1)]);
    }

    function riseIn(h, shape, start, dur, distance, ease) {
        var d = distance == null ? 26 : distance;
        h.keys(shape, 'y', [k(start, shape.y + d, ease || 'expoOut'), k(start + dur, shape.y)]);
        h.keys(shape, 'opacity', [k(start, 0), k(start + dur * 0.7, 1)]);
    }

    // Une orbite coûte 2 × (pas + 1) images clés : 16 pas suffisent largement.
    function orbit(h, shape, cx, cy, radius, start, end, phase, steps) {
        var n = steps || 16;
        var xs = [];
        var ys = [];
        for (var i = 0; i <= n; i++) {
            var p = i / n;
            var a = phase + p * Math.PI * 2;
            var t = start + p * (end - start);
            xs.push(k(t, cx + Math.cos(a) * radius));
            ys.push(k(t, cy + Math.sin(a) * radius));
        }
        h.keys(shape, 'x', xs);
        h.keys(shape, 'y', ys);
    }

    function letters(h, word, opts) {
        var o = Object.assign({
            y: 225,
            fontSize: 64,
            fontWeight: 700,
            fill: INK,
            family: 'Inter',
            start: 0,
            stagger: 0.06,
            dur: 0.6,
            spread: 0.86
        }, opts || {});

        var chars = word.split('');
        var step = o.fontSize * o.spread;
        var total = (chars.length - 1) * step;
        var out = [];

        chars.forEach(function (ch, i) {
            var t = text(h, {
                x: 400 - total / 2 + i * step,
                y: o.y + 30,
                text: ch,
                fontSize: o.fontSize,
                fontFamily: o.family,
                fontWeight: o.fontWeight,
                fill: o.fill,
                opacity: 0
            });
            var d = o.start + i * o.stagger;
            h.keys(t, 'y', [k(d, o.y + 30, 'expoOut'), k(d + o.dur, o.y)]);
            h.keys(t, 'opacity', [k(d, 0), k(d + o.dur * 0.55, 1)]);
            out.push(t);
        });

        return out;
    }

    // ── Catégories ─────────────────────────────────────────────────────────

    var categories = [
        {
            id: 'essentiels',
            label: 'Fondations',
            hint: 'Les mouvements de base, réglés au millimètre.',
            presets: [
                {
                    id: 'springIn',
                    label: 'Spring',
                    glyph: '◉',
                    build: function (h) {
                        h.clear();
                        var c = circle(h, { x: 400, y: 225, radius: 92, fill: INK, opacity: 0 });
                        h.keys(c, 'scaleX', [k(0, 0.55, 'spring'), k(1.1, 1)]);
                        h.keys(c, 'scaleY', [k(0, 0.55, 'spring'), k(1.1, 1)]);
                        h.keys(c, 'opacity', [k(0, 0), k(0.22, 1)]);
                        h.keys(c, 'glow', [k(0, 0), k(0.5, 22, 'expoOut'), k(1.6, 8)]);
                    }
                },
                {
                    id: 'fadeUp',
                    label: 'Fade up',
                    glyph: '↑',
                    build: function (h) {
                        h.clear();
                        var t = text(h, { x: 400, y: 208, text: 'MOTION DESIGN', fontSize: 54, fontWeight: 700, letterSpacing: 0, opacity: 0 });
                        h.keys(t, 'y', [k(0, 246, 'expoOut'), k(0.95, 208)]);
                        h.keys(t, 'opacity', [k(0, 0), k(0.6, 1)]);
                        h.keys(t, 'blur', [k(0, 16, 'cubicOut'), k(0.9, 0)]);
                        var rule = rect(h, { x: 400, y: 258, width: 0, height: 2, fill: LINE });
                        h.keys(rule, 'width', [k(0.55, 0, 'expoOut'), k(1.45, 300)]);
                    }
                },
                {
                    id: 'popGrid',
                    label: 'Grille pop',
                    glyph: '▦',
                    build: function (h) {
                        h.clear();
                        var cols = 3, rows = 2, size = 72, gap = 24;
                        var totalW = cols * size + (cols - 1) * gap;
                        var totalH = rows * size + (rows - 1) * gap;
                        for (var r = 0; r < rows; r++) {
                            for (var c = 0; c < cols; c++) {
                                var x = 400 - totalW / 2 + size / 2 + c * (size + gap);
                                var y = 225 - totalH / 2 + size / 2 + r * (size + gap);
                                var tile = rect(h, {
                                    x: x, y: y, width: size, height: size,
                                    fill: r === 0 ? INK : SHADE,
                                    opacity: 0
                                });
                                var d = (r * cols + c) * 0.07;
                                h.keys(tile, 'scaleX', [k(d, 0.62, 'backOut'), k(d + 0.55, 1)]);
                                h.keys(tile, 'scaleY', [k(d, 0.62, 'backOut'), k(d + 0.55, 1)]);
                                h.keys(tile, 'rotation', [k(d, -8, 'backOut'), k(d + 0.55, 0)]);
                                h.keys(tile, 'opacity', [k(d, 0), k(d + 0.3, 1)]);
                            }
                        }
                    }
                },
                {
                    id: 'slideStack',
                    label: 'Slides',
                    glyph: '≡',
                    build: function (h) {
                        h.clear();
                        for (var i = 0; i < 4; i++) {
                            var bar = rect(h, {
                                x: 400, y: 140 + i * 52, width: i === 0 ? 300 : 220 + i * 20, height: 22,
                                fill: i === 0 ? INK : MUTED, opacity: i === 0 ? 1 : 0.55
                            });
                            h.keys(bar, 'x', [k(i * 0.09, bar.x - 220, 'expoOut'), k(i * 0.09 + 0.85, bar.x)]);
                            h.keys(bar, 'opacity', [k(i * 0.09, 0), k(i * 0.09 + 0.5, i === 0 ? 1 : 0.55)]);
                        }
                    }
                },
                {
                    id: 'focusPull',
                    label: 'Mise au point',
                    glyph: '◐',
                    build: function (h) {
                        h.clear();
                        var t = text(h, { x: 400, y: 215, text: 'FOCUS', fontSize: 76, fontWeight: 800, opacity: 0 });
                        h.keys(t, 'blur', [k(0, 26, 'expoOut'), k(1.3, 0)]);
                        h.keys(t, 'opacity', [k(0, 0), k(0.9, 1)]);
                        h.keys(t, 'scaleX', [k(0, 1.06, 'expoOut'), k(1.4, 1)]);
                        h.keys(t, 'scaleY', [k(0, 1.06, 'expoOut'), k(1.4, 1)]);
                        var sub = text(h, { x: 400, y: 285, text: 'depth of field', fontSize: 18, fontWeight: 500, fill: MUTED, opacity: 0 });
                        h.keys(sub, 'opacity', [k(0.7, 0), k(1.3, 1)]);
                    }
                },
                {
                    id: 'kenBurns',
                    label: 'Ken Burns',
                    glyph: '⌗',
                    build: function (h) {
                        h.clear();
                        var end = Math.max(4, h.duration);
                        var bg = rect(h, { x: 400, y: 225, width: 800, height: 450, fill: '#15151a' });
                        h.keys(bg, 'scaleX', [k(0, 1.02, 'sineInOut'), k(end, 1.14)]);
                        h.keys(bg, 'scaleY', [k(0, 1.02, 'sineInOut'), k(end, 1.14)]);
                        h.keys(bg, 'x', [k(0, 390, 'sineInOut'), k(end, 418)]);
                        var t = text(h, { x: 400, y: 225, text: 'HOT MOTOR', fontSize: 46, fontWeight: 700, opacity: 0 });
                        h.keys(t, 'opacity', [k(0.4, 0), k(1.6, 1)]);
                        h.keys(t, 'scaleX', [k(0.4, 1.02, 'sineOut'), k(end, 1)]);
                        h.keys(t, 'scaleY', [k(0.4, 1.02, 'sineOut'), k(end, 1)]);
                    }
                }
            ]
        },
        {
            id: 'typo',
            label: 'Typographie',
            hint: 'Du texte qui entre comme un titre de film.',
            presets: [
                {
                    id: 'titleReveal',
                    label: 'Titre ciné',
                    glyph: 'Aa',
                    build: function (h) {
                        h.clear();
                        var t = text(h, { x: 400, y: 218, text: 'MOTION', fontSize: 86, fontWeight: 800, opacity: 0 });
                        h.keys(t, 'opacity', [k(0, 0), k(0.7, 1)]);
                        h.keys(t, 'blur', [k(0, 22, 'expoOut'), k(1.2, 0)]);
                        h.keys(t, 'scaleX', [k(0, 1.12, 'expoOut'), k(1.5, 1)]);
                        h.keys(t, 'scaleY', [k(0, 1.12, 'expoOut'), k(1.5, 1)]);
                        h.keys(t, 'glow', [k(0.6, 0), k(1.2, 16, 'expoOut'), k(2.4, 6)]);
                        var rule = rect(h, { x: 400, y: 272, width: 0, height: 2, fill: GOLD });
                        h.keys(rule, 'width', [k(0.9, 0, 'expoOut'), k(1.8, 240)]);
                    }
                },
                {
                    id: 'kineticWords',
                    label: 'Mots cinétiques',
                    glyph: '⋮',
                    build: function (h) {
                        h.clear();
                        var words = ['HOT', 'MOTOR', 'MOTION'];
                        words.forEach(function (word, i) {
                            var t = text(h, {
                                x: 400, y: 150 + i * 65, text: word, fontSize: 46,
                                fontWeight: i === 2 ? 800 : 500,
                                fill: i === 2 ? GOLD : INK, opacity: 0
                            });
                            var d = i * 0.16;
                            h.keys(t, 'y', [k(d, t.y + 34, 'expoOut'), k(d + 0.8, t.y)]);
                            h.keys(t, 'opacity', [k(d, 0), k(d + 0.42, 1)]);
                        });
                    }
                },
                {
                    id: 'letterStagger',
                    label: 'Lettres',
                    glyph: '⣿',
                    build: function (h) {
                        h.clear();
                        letters(h, 'MOTION', { y: 225, fontSize: 72, stagger: 0.055, dur: 0.65 });
                    }
                },
                {
                    id: 'caretType',
                    label: 'Curseur',
                    glyph: '▌',
                    build: function (h) {
                        h.clear();
                        var t = text(h, {
                            x: 400, y: 222, text: 'hmm:// motion', fontSize: 38, fontWeight: 500,
                            fill: INK, opacity: 0
                        });
                        h.keys(t, 'opacity', [k(0, 0), k(0.35, 1)]);
                        var caret = rect(h, { x: 560, y: 222, width: 3, height: 44, fill: GOLD, opacity: 0 });
                        h.keys(caret, 'opacity', [
                            k(0.2, 1), k(0.62, 0), k(0.72, 1), k(1.14, 0),
                            k(1.24, 1), k(1.66, 0), k(1.76, 1)
                        ]);
                    }
                },
                {
                    id: 'manifesto',
                    label: 'Manifeste',
                    glyph: '¶',
                    build: function (h) {
                        h.clear();
                        var lines = [
                            { text: 'MOUVEMENT', weight: 800, size: 58, y: 160, fill: INK },
                            { text: 'PRÉCISION', weight: 500, size: 58, y: 225, fill: MUTED },
                            { text: 'ÉMOTION', weight: 800, size: 58, y: 290, fill: GOLD }
                        ];
                        lines.forEach(function (line, i) {
                            var t = text(h, {
                                x: 400, y: line.y, text: line.text, fontSize: line.size,
                                fontWeight: line.weight, fill: line.fill, opacity: 0
                            });
                            var d = i * 0.14;
                            h.keys(t, 'opacity', [k(d, 0), k(d + 0.5, 1)]);
                            h.keys(t, 'scaleX', [k(d, 0.94, 'expoOut'), k(d + 0.75, 1)]);
                            h.keys(t, 'scaleY', [k(d, 0.94, 'expoOut'), k(d + 0.75, 1)]);
                            h.keys(t, 'blur', [k(d, 10, 'cubicOut'), k(d + 0.7, 0)]);
                        });
                    }
                }
            ]
        },
        {
            id: 'reveals',
            label: 'Révélations',
            hint: 'Masques, rideaux et balayages, sans une seule image de trop.',
            presets: [
                {
                    id: 'curtain',
                    label: 'Rideau',
                    glyph: '◫',
                    build: function (h) {
                        h.clear();
                        var t = text(h, { x: 400, y: 225, text: 'REVEAL', fontSize: 72, fontWeight: 800, opacity: 1 });
                        var top = rect(h, { x: 400, y: 112, width: 800, height: 226, fill: SHADE });
                        var bottom = rect(h, { x: 400, y: 338, width: 800, height: 226, fill: SHADE });
                        h.keys(top, 'y', [k(0.15, 112), k(1.05, -120, 'expoInOut')]);
                        h.keys(bottom, 'y', [k(0.15, 338), k(1.05, 570, 'expoInOut')]);
                        h.keys(t, 'scaleX', [k(0.35, 0.96), k(1.25, 1)]);
                        h.keys(t, 'scaleY', [k(0.35, 0.96), k(1.25, 1)]);
                    }
                },
                {
                    id: 'lineWipe',
                    label: 'Filet',
                    glyph: '─',
                    build: function (h) {
                        h.clear();
                        var rule = rect(h, { x: 400, y: 225, width: 0, height: 3, fill: INK });
                        h.keys(rule, 'width', [k(0, 0, 'expoOut'), k(1.1, 460)]);
                        var t = text(h, { x: 400, y: 190, text: 'MOTION', fontSize: 58, fontWeight: 700, opacity: 0 });
                        h.keys(t, 'opacity', [k(0.55, 0), k(1.15, 1)]);
                        h.keys(t, 'y', [k(0.55, 178, 'expoOut'), k(1.2, 190)]);
                        var sub = text(h, { x: 400, y: 262, text: 'éditeur temps réel', fontSize: 16, fontWeight: 500, fill: MUTED, opacity: 0 });
                        h.keys(sub, 'opacity', [k(0.85, 0), k(1.4, 1)]);
                    }
                },
                {
                    id: 'shimmer',
                    label: 'Balayage',
                    glyph: '∕',
                    build: function (h) {
                        h.clear();
                        var track = rect(h, { x: 400, y: 225, width: 420, height: 46, fill: SHADE });
                        var bar = rect(h, { x: 220, y: 225, width: 80, height: 46, fill: INK, glow: 24, glowColor: '#ffffff' });
                        h.keys(bar, 'x', [k(0.2, 220, 'expoInOut'), k(1.5, 400), k(2.6, 580, 'expoInOut')]);
                        h.keys(bar, 'opacity', [k(0.2, 0), k(0.5, 1), k(2.4, 1), k(2.6, 0)]);
                        h.keys(bar, 'width', [k(0.2, 90), k(1.5, 140), k(2.6, 90)]);
                        var t = text(h, { x: 400, y: 225, text: 'LOADING', fontSize: 15, fontWeight: 700, fill: MUTED });
                        h.keys(t, 'opacity', [k(0, 0), k(0.4, 1)]);
                    }
                },
                {
                    id: 'barsReveal',
                    label: 'Bandelettes',
                    glyph: '⋕',
                    build: function (h) {
                        h.clear();
                        var count = 9;
                        var step = 800 / count;

                        for (var i = 0; i < count; i++) {
                            var bar = rect(h, {
                                x: step / 2 + i * step, y: 225,
                                width: step - 5, height: 330,
                                fill: i % 3 === 1 ? '#22222a' : '#1a1a20'
                            });
                            var d = Math.abs(i - (count - 1) / 2) * 0.045;
                            h.keys(bar, 'scaleY', [k(d, 0, 'backOut'), k(d + 0.8, 1)]);
                            h.keys(bar, 'opacity', [k(d, 0), k(d + 0.35, 1)]);
                        }

                        var t = text(h, { x: 400, y: 225, text: 'HOT MOTOR', fontSize: 50, fontWeight: 800, opacity: 0 });
                        h.keys(t, 'opacity', [k(0.7, 0), k(1.3, 1)]);
                        h.keys(t, 'scaleX', [k(0.7, 1.05, 'expoOut'), k(1.5, 1)]);
                        h.keys(t, 'scaleY', [k(0.7, 1.05, 'expoOut'), k(1.5, 1)]);
                    }
                },
                {
                    id: 'irisOut',
                    label: 'Iris',
                    glyph: '◯',
                    build: function (h) {
                        h.clear();
                        var t = text(h, { x: 400, y: 225, text: 'FOCUS', fontSize: 66, fontWeight: 800, opacity: 0 });
                        h.keys(t, 'opacity', [k(0.1, 0), k(0.8, 1)]);
                        var halo = circle(h, { x: 400, y: 225, radius: 30, fill: INK, opacity: 0 });
                        h.keys(halo, 'radius', [k(1.0, 30, 'expoOut'), k(2.2, 260)]);
                        h.keys(halo, 'opacity', [k(1.0, 0.18), k(2.2, 0)]);
                    }
                },
                {
                    id: 'tilesReveal',
                    label: 'Tuiles',
                    glyph: '▚',
                    build: function (h) {
                        h.clear();
                        var cols = 4, rows = 3;
                        var tw = 800 / cols, th = 450 / rows;
                        for (var r = 0; r < rows; r++) {
                            for (var c = 0; c < cols; c++) {
                                var tile = rect(h, {
                                    x: tw / 2 + c * tw, y: th / 2 + r * th,
                                    width: tw - 4, height: th - 4, fill: INK, opacity: 0
                                });
                                var d = (r + c) * 0.035;
                                h.keys(tile, 'opacity', [k(d, 0), k(d + 0.28, 0.94), k(1.05 + d, 0.94), k(1.5 + d, 0)]);
                                h.keys(tile, 'scaleX', [k(d, 0.86, 'backOut'), k(d + 0.55, 1), k(1.5 + d, 0.7, 'cubicIn')]);
                                h.keys(tile, 'scaleY', [k(d, 0.86, 'backOut'), k(d + 0.55, 1), k(1.5 + d, 0.7, 'cubicIn')]);
                            }
                        }
                        var t = text(h, { x: 400, y: 225, text: 'MOTION', fontSize: 74, fontWeight: 800, opacity: 0 });
                        h.keys(t, 'opacity', [k(0.9, 0), k(1.45, 1)]);
                        h.keys(t, 'blur', [k(0.9, 14, 'expoOut'), k(1.8, 0)]);
                    }
                }
            ]
        },
        {
            id: 'boucles',
            label: 'Boucles',
            hint: 'Cycles parfaits, calculés sur la durée de la timeline.',
            presets: [
                {
                    id: 'breathe',
                    label: 'Respiration',
                    glyph: '◎',
                    build: function (h) {
                        h.clear();
                        var D = h.duration;
                        var c = circle(h, { x: 400, y: 225, radius: 96, fill: INK, glow: 18, glowColor: '#ffffff' });
                        h.keys(c, 'scaleX', [k(0, 1, 'sineInOut'), k(D / 2, 1.08, 'sineInOut'), k(D, 1)]);
                        h.keys(c, 'scaleY', [k(0, 1, 'sineInOut'), k(D / 2, 1.08, 'sineInOut'), k(D, 1)]);
                        h.keys(c, 'glow', [k(0, 10, 'sineInOut'), k(D / 2, 30, 'sineInOut'), k(D, 10)]);
                    }
                },
                {
                    id: 'float',
                    label: 'Flottement',
                    glyph: '≈',
                    build: function (h) {
                        h.clear();
                        var D = h.duration;
                        [[300, 200, 54], [400, 260, 34], [500, 190, 44]].forEach(function (p, i) {
                            var c = circle(h, { x: p[0], y: p[1], radius: p[2], fill: i === 1 ? GOLD : INK, opacity: i === 1 ? 1 : 0.82 });
                            var phase = i * 0.25;
                            h.keys(c, 'y', [k(D * phase, p[1], 'sineInOut'), k(D * (phase + 0.5), p[1] - 18, 'sineInOut'), k(D, p[1])]);
                            h.keys(c, 'rotation', [k(0, -3, 'sineInOut'), k(D / 2, 3, 'sineInOut'), k(D, -3)]);
                        });
                    }
                },
                {
                    id: 'orbit',
                    label: 'Orbite',
                    glyph: '◌',
                    build: function (h) {
                        h.clear();
                        var D = h.duration;
                        var core = circle(h, { x: 400, y: 225, radius: 26, fill: INK });
                        h.keys(core, 'scaleX', [k(0, 0.94, 'sineInOut'), k(D / 2, 1.06, 'sineInOut'), k(D, 0.94)]);
                        h.keys(core, 'scaleY', [k(0, 0.94, 'sineInOut'), k(D / 2, 1.06, 'sineInOut'), k(D, 0.94)]);
                        var a = circle(h, { x: 400, y: 125, radius: 12, fill: GOLD });
                        orbit(h, a, 400, 225, 100, 0, D, 0, 16);
                        var b = circle(h, { x: 400, y: 85, radius: 7, fill: MUTED });
                        orbit(h, b, 400, 225, 140, 0, D, Math.PI, 16);
                    }
                },
                {
                    id: 'waveBars',
                    label: 'Onde',
                    glyph: '▮▮',
                    build: function (h) {
                        h.clear();
                        var D = h.duration;
                        var count = 7;
                        for (var i = 0; i < count; i++) {
                            var bar = rect(h, {
                                x: 400 + (i - (count - 1) / 2) * 34, y: 225,
                                width: 14, height: 90, fill: i === 3 ? GOLD : INK, opacity: 0.9
                            });
                            var phase = i / count * 0.35;
                            h.keys(bar, 'scaleY', [
                                k(0, 0.5, 'sineInOut'),
                                k(D * (phase + 0.25), 1.25, 'sineInOut'),
                                k(D * (phase + 0.5), 0.55, 'sineInOut'),
                                k(D, 0.5)
                            ]);
                        }
                    }
                },
                {
                    id: 'marquee',
                    label: 'Bandeau',
                    glyph: '⇆',
                    build: function (h) {
                        h.clear();
                        var D = h.duration;
                        var label = 'HOT MOTOR MOTION  •  ';
                        for (var i = 0; i < 2; i++) {
                            var t = text(h, {
                                x: 400 + i * 800, y: 225, text: label.repeat(3),
                                fontSize: 34, fontWeight: 700, fill: i === 0 ? INK : MUTED
                            });
                            h.keys(t, 'x', [k(0, t.x), k(D, t.x - 800)]);
                        }
                    }
                },
                {
                    id: 'pulseRing',
                    label: 'Impulsion',
                    glyph: '◍',
                    build: function (h) {
                        h.clear();
                        var D = h.duration;
                        var core = circle(h, { x: 400, y: 225, radius: 22, fill: INK });
                        h.keys(core, 'scaleX', [k(0, 1), k(D / 2, 1.14, 'sineInOut'), k(D, 1)]);
                        h.keys(core, 'scaleY', [k(0, 1), k(D / 2, 1.14, 'sineInOut'), k(D, 1)]);
                        for (var i = 0; i < 2; i++) {
                            var ring = circle(h, { x: 400, y: 225, radius: 30, fill: INK, opacity: 0 });
                            var start = i * D / 2;
                            h.keys(ring, 'radius', [k(start, 26, 'expoOut'), k(start + D / 2, 150)]);
                            h.keys(ring, 'opacity', [k(start, 0.22), k(start + 0.02, 0.16), k(start + D / 2, 0)]);
                        }
                    }
                },
                {
                    id: 'ticker',
                    label: 'Ticker',
                    glyph: '⇅',
                    build: function (h) {
                        h.clear();
                        var D = h.duration;
                        var rows = ['STUDIO 2026', 'MOTION DESIGN', 'TEMPS RÉEL'];
                        rows.forEach(function (label, i) {
                            var t = text(h, {
                                x: 400, y: 150 + i * 70, text: label,
                                fontSize: 44, fontWeight: i === 1 ? 800 : 400,
                                fill: i === 1 ? GOLD : MUTED
                            });
                            h.keys(t, 'x', [k(0, 400 + (i % 2 === 0 ? 320 : -320)), k(D, 400 - (i % 2 === 0 ? 320 : -320))]);
                        });
                    }
                }
            ]
        },
        {
            id: 'showcase',
            label: 'Démonstrations',
            hint: 'Scènes courtes taillées pour l’export et la présentation.',
            presets: [
                {
                    id: 'logoLockup',
                    label: 'Logo',
                    glyph: '◈',
                    build: function (h) {
                        h.clear();
                        var mark = rect(h, { x: 400, y: 205, width: 92, height: 92, fill: GOLD, opacity: 0 });
                        h.keys(mark, 'scaleX', [k(0, 0.4, 'spring'), k(1.2, 1)]);
                        h.keys(mark, 'scaleY', [k(0, 0.4, 'spring'), k(1.2, 1)]);
                        h.keys(mark, 'rotation', [k(0, -24, 'backOut'), k(1, 0)]);
                        h.keys(mark, 'opacity', [k(0, 0), k(0.25, 1)]);

                        var brand = text(h, { x: 400, y: 285, text: 'HOT MOTOR', fontSize: 34, fontWeight: 700, opacity: 0 });
                        h.keys(brand, 'opacity', [k(0.55, 0), k(1.1, 1)]);
                        h.keys(brand, 'blur', [k(0.55, 10, 'expoOut'), k(1.3, 0)]);
                        h.keys(brand, 'y', [k(0.55, 296, 'expoOut'), k(1.25, 285)]);

                        var product = text(h, { x: 400, y: 322, text: 'MOTION', fontSize: 14, fontWeight: 700, fill: MUTED, opacity: 0 });
                        h.keys(product, 'opacity', [k(1.05, 0), k(1.6, 1)]);
                        product.z = -1;

                        var rule = rect(h, { x: 400, y: 306, width: 0, height: 1.5, fill: LINE });
                        h.keys(rule, 'width', [k(1.1, 0, 'expoOut'), k(1.9, 260)]);
                    }
                },
                {
                    id: 'elasticStack',
                    label: 'Cartes',
                    glyph: '▤',
                    build: function (h) {
                        h.clear();
                        for (var i = 3; i >= 0; i--) {
                            var card = rect(h, {
                                x: 400 + i * 16, y: 225 - i * 14,
                                width: 300, height: 180,
                                fill: i === 3 ? INK : '#22222a',
                                opacity: 0
                            });
                            var d = (3 - i) * 0.11;
                            h.keys(card, 'opacity', [k(d, 0), k(d + 0.3, 1)]);
                            h.keys(card, 'scaleX', [k(d, 0.9, 'backOut'), k(d + 0.75, 1)]);
                            h.keys(card, 'scaleY', [k(d, 0.9, 'backOut'), k(d + 0.75, 1)]);
                            h.keys(card, 'rotation', [k(d, i === 3 ? -6 : 4, 'backOut'), k(d + 0.8, i === 3 ? 0 : (3 - i) * 1.6)]);
                        }
                        var t = text(h, { x: 400, y: 232, text: 'HOT MOTOR', fontSize: 40, fontWeight: 800, fill: '#121214', opacity: 0 });
                        h.keys(t, 'opacity', [k(0.8, 0), k(1.25, 1)]);
                    }
                },
                {
                    id: 'depthDolly',
                    label: 'Profondeur',
                    glyph: '◇',
                    build: function (h) {
                        h.clear();
                        var back = rect(h, { x: 400, y: 225, width: 460, height: 260, fill: '#1c1c23' });
                        var mid = circle(h, { x: 400, y: 210, radius: 80, fill: MUTED, opacity: 0.9 });
                        var front = text(h, { x: 400, y: 300, text: 'DEPTH', fontSize: 58, fontWeight: 800 });
                        [[back, 1.14, 0.55], [mid, 1.22, 0.9], [front, 1.34, 1]].forEach(function (item) {
                            var shape = item[0], endScale = item[1], op = item[2];
                            h.keys(shape, 'scaleX', [k(0, 1), k(3.4, endScale, 'expoOut')]);
                            h.keys(shape, 'scaleY', [k(0, 1), k(3.4, endScale, 'expoOut')]);
                            h.keys(shape, 'opacity', [k(0, op * 0.4), k(1.4, op)]);
                        });
                        h.keys(back, 'rotation', [k(0, -3, 'sineInOut'), k(3.4, 3)]);
                    }
                },
                {
                    id: 'gridPulse',
                    label: 'Grille',
                    glyph: '⣿',
                    build: function (h) {
                        h.clear();
                        var cols = 4, rows = 3, size = 54, gap = 14;
                        var totalW = cols * size + (cols - 1) * gap;
                        var totalH = rows * size + (rows - 1) * gap;
                        var D = h.duration;
                        for (var r = 0; r < rows; r++) {
                            for (var c = 0; c < cols; c++) {
                                var x = 400 - totalW / 2 + size / 2 + c * (size + gap);
                                var y = 225 - totalH / 2 + size / 2 + r * (size + gap);
                                var tile = rect(h, {
                                    x: x, y: y, width: size, height: size,
                                    fill: (r + c) % 5 === 0 ? GOLD : '#22222a'
                                });
                                var phase = ((r * cols + c) / (cols * rows)) * 1.2;
                                var pulse = phase + 0.45;
                                h.keys(tile, 'scaleX', [k(phase, 1, 'sineInOut'), k(pulse, 1.24, 'sineInOut'), k(pulse + 0.5, 1, 'sineInOut')]);
                                h.keys(tile, 'scaleY', [k(phase, 1, 'sineInOut'), k(pulse, 1.24, 'sineInOut'), k(pulse + 0.5, 1, 'sineInOut')]);
                            }
                        }
                    }
                },
                {
                    id: 'ribbon',
                    label: 'Ruban',
                    glyph: '≋',
                    build: function (h) {
                        h.clear();
                        var D = h.duration;
                        for (var i = 0; i < 12; i++) {
                            var slat = rect(h, {
                                x: 400 + (i - 5.5) * 30, y: 225,
                                width: 8, height: 150, fill: i % 3 === 0 ? GOLD : INK, opacity: 0.85
                            });
                            var phase = i * 0.35;
                            h.keys(slat, 'rotation', [
                                k(0, Math.sin(phase) * 16, 'sineInOut'),
                                k(D / 2, Math.sin(phase + Math.PI) * 16, 'sineInOut'),
                                k(D, Math.sin(phase) * 16)
                            ]);
                            h.keys(slat, 'scaleY', [
                                k(0, 0.8 + Math.cos(phase) * 0.2, 'sineInOut'),
                                k(D / 2, 0.8 - Math.cos(phase) * 0.2, 'sineInOut'),
                                k(D, 0.8 + Math.cos(phase) * 0.2)
                            ]);
                        }
                    }
                },
                {
                    id: 'prism',
                    label: 'Prisme',
                    glyph: '◭',
                    build: function (h) {
                        h.clear();
                        var D = h.duration;
                        var colors = ['#f2f2f4', '#f5c518', '#8b8b96'];
                        colors.forEach(function (fill, i) {
                            var bar = rect(h, {
                                x: 320 + i * 80, y: 225, width: 46, height: 220,
                                fill: fill, opacity: 0, hue: 0
                            });
                            var d = i * 0.1;
                            h.keys(bar, 'opacity', [k(d, 0), k(d + 0.5, 0.92)]);
                            h.keys(bar, 'scaleY', [k(d, 0.2, 'expoOut'), k(d + 0.9, 1)]);
                            h.keys(bar, 'hue', [k(d, 0, 'sineInOut'), k(D, Math.round(30 * (i + 1)))]);
                        });
                    }
                },
                {
                    id: 'converge',
                    label: 'Convergence',
                    glyph: '✳',
                    build: function (h) {
                        h.clear();
                        var spots = [[120, 90], [680, 90], [120, 360], [680, 360], [400, 60]];
                        spots.forEach(function (p, i) {
                            var dot = circle(h, { x: p[0], y: p[1], radius: 12, fill: i === 4 ? GOLD : INK, opacity: 0 });
                            var d = i * 0.08;
                            h.keys(dot, 'opacity', [k(0, 0), k(0.35, 1)]);
                            h.keys(dot, 'x', [k(d, p[0], 'backOut'), k(d + 1.1, 400)]);
                            h.keys(dot, 'y', [k(d, p[1], 'backOut'), k(d + 1.1, 225)]);
                            h.keys(dot, 'scaleX', [k(d, 1), k(d + 1.1, 1.8)]);
                            h.keys(dot, 'scaleY', [k(d, 1), k(d + 1.1, 1.8)]);
                        });
                        var core = circle(h, { x: 400, y: 225, radius: 18, fill: INK, opacity: 0, glow: 22, glowColor: '#ffffff' });
                        h.keys(core, 'opacity', [k(1.1, 0), k(1.4, 1)]);
                        h.keys(core, 'scaleX', [k(1.1, 0.4, 'spring'), k(2, 1)]);
                        h.keys(core, 'scaleY', [k(1.1, 0.4, 'spring'), k(2, 1)]);
                    }
                },
                {
                    id: 'cascade',
                    label: 'Cascade',
                    glyph: '⌄',
                    build: function (h) {
                        h.clear();
                        for (var i = 0; i < 6; i++) {
                            var bar = rect(h, {
                                x: 400 - i * 22, y: 140 + i * 22, width: 220 - i * 20, height: 4,
                                fill: i === 0 ? GOLD : INK, opacity: 0
                            });
                            var d = 0.42 + i * 0.07;
                            h.keys(bar, 'opacity', [k(d, 0), k(d + 0.35, i === 0 ? 1 : 0.5)]);
                            h.keys(bar, 'x', [k(d, bar.x - 40, 'expoOut'), k(d + 0.7, bar.x)]);
                        }
                        var t = text(h, { x: 400, y: 300, text: 'CASCADE', fontSize: 44, fontWeight: 800, opacity: 0 });
                        h.keys(t, 'opacity', [k(0.15, 0), k(0.8, 1)]);
                        h.keys(t, 'y', [k(0.15, 320, 'expoOut'), k(0.95, 300)]);
                    }
                }
            ]
        },
        {
            id: 'transitions',
            label: 'Transitions',
            hint: 'Passages nets entre deux plans, pensés pour le montage.',
            presets: [
                {
                    id: 'pushLeft',
                    label: 'Push',
                    glyph: '→',
                    build: function (h) {
                        h.clear();
                        var first = rect(h, { x: 400, y: 225, width: 720, height: 380, fill: '#1c1c23' });
                        var labelA = text(h, { x: 400, y: 225, text: 'PLAN A', fontSize: 34, fontWeight: 700, fill: MUTED });
                        var second = rect(h, { x: 1200, y: 225, width: 720, height: 380, fill: INK });
                        var labelB = text(h, { x: 1200, y: 225, text: 'PLAN B', fontSize: 34, fontWeight: 800, fill: '#121214' });
                        [first, labelA, second, labelB].forEach(function (shape) {
                            h.keys(shape, 'x', [k(0.6, shape.x, 'expoInOut'), k(1.6, shape.x - 800)]);
                        });
                    }
                },
                {
                    id: 'zoomThrough',
                    label: 'Travelling',
                    glyph: '⊙',
                    build: function (h) {
                        h.clear();
                        var plate = rect(h, { x: 400, y: 225, width: 320, height: 200, fill: INK });
                        h.keys(plate, 'scaleX', [k(0, 1), k(1.3, 4.4, 'expoIn')]);
                        h.keys(plate, 'scaleY', [k(0, 1), k(1.3, 4.4, 'expoIn')]);
                        h.keys(plate, 'opacity', [k(1.02, 1), k(1.3, 0)]);
                        h.keys(plate, 'rotation', [k(0, 0), k(1.3, 8)]);
                        var t = text(h, { x: 400, y: 225, text: 'NEXT', fontSize: 54, fontWeight: 800, opacity: 0 });
                        h.keys(t, 'opacity', [k(1.3, 0), k(1.85, 1)]);
                        h.keys(t, 'blur', [k(1.3, 18, 'expoOut'), k(2, 0)]);
                        h.keys(t, 'scaleX', [k(1.3, 0.82, 'expoOut'), k(2.1, 1)]);
                        h.keys(t, 'scaleY', [k(1.3, 0.82, 'expoOut'), k(2.1, 1)]);
                    }
                },
                {
                    id: 'crossFade',
                    label: 'Fondu',
                    glyph: '◑',
                    build: function (h) {
                        h.clear();
                        var a = text(h, { x: 400, y: 225, text: 'AVANT', fontSize: 58, fontWeight: 700 });
                        var b = text(h, { x: 400, y: 225, text: 'APRÈS', fontSize: 58, fontWeight: 800, fill: GOLD, opacity: 0 });
                        h.keys(a, 'opacity', [k(0.7, 1), k(1.6, 0)]);
                        h.keys(a, 'blur', [k(0.7, 0), k(1.6, 16)]);
                        h.keys(b, 'opacity', [k(0.9, 0), k(1.8, 1)]);
                        h.keys(b, 'blur', [k(0.9, 16, 'cubicOut'), k(1.9, 0)]);
                        h.keys(b, 'scaleX', [k(0.9, 1.04, 'expoOut'), k(1.9, 1)]);
                        h.keys(b, 'scaleY', [k(0.9, 1.04, 'expoOut'), k(1.9, 1)]);
                    }
                },
                {
                    id: 'shutter',
                    label: 'Store',
                    glyph: '▤',
                    build: function (h) {
                        h.clear();
                        var count = 7;
                        var height = 450 / count;
                        var t = text(h, { x: 400, y: 225, text: 'HOT MOTOR', fontSize: 46, fontWeight: 800, opacity: 0 });
                        for (var i = 0; i < count; i++) {
                            var slat = rect(h, {
                                x: 400, y: height / 2 + i * height,
                                width: 800, height: height + 1, fill: SHADE
                            });
                            var d = i * 0.045;
                            h.keys(slat, 'scaleY', [k(d, 0.02, 'expoOut'), k(d + 0.38, 1), k(d + 0.5, 1), k(d + 1.05, 0, 'expoInOut')]);
                        }
                        h.keys(t, 'opacity', [k(0.35, 0), k(0.9, 1)]);
                    }
                }
            ]
        }
    ];

    var index = {};
    categories.forEach(function (category) {
        category.presets.forEach(function (preset) {
            index[preset.id] = { preset: preset, category: category };
        });
    });

    var scripts = [
        { id: 'spin', label: 'Rotation', glyph: '↻' },
        { id: 'pulse', label: 'Pulsation', glyph: '◉' },
        { id: 'bounce', label: 'Rebond', glyph: '↕' },
        { id: 'shake', label: 'Secousse', glyph: '⟷' },
        { id: 'fadeIn', label: 'Apparition', glyph: '▲' },
        { id: 'fadeOut', label: 'Disparition', glyph: '▼' },
        { id: 'zoomIn', label: 'Zoom avant', glyph: '⊕' },
        { id: 'zoomOut', label: 'Zoom arrière', glyph: '⊖' },
        { id: 'slideL', label: 'Glisse ←', glyph: '←' },
        { id: 'slideR', label: 'Glisse →', glyph: '→' },
        { id: 'flipX', label: 'Bascule X', glyph: '⇅' },
        { id: 'flipY', label: 'Bascule Y', glyph: '⇄' },
        { id: 'wobble', label: 'Oscillation', glyph: '∿' },
        { id: 'swing', label: 'Balancement', glyph: '⟳' },
        { id: 'float', label: 'Flottaison', glyph: '☁' },
        { id: 'glitch', label: 'Glitch', glyph: '▓' }
    ];

    window.HMMPresets = {
        categories: categories,
        index: index,
        scripts: scripts,
        get: function (id) {
            return index[id] ? index[id].preset : null;
        },
        count: Object.keys(index).length
    };
})();
