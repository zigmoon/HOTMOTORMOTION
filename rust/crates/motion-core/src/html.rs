//! Lecteur autonome : un seul fichier HTML, aucune dépendance, aucune requête.
//!
//! Le script embarqué est le même que celui produit par l'éditeur
//! (`Export JS` → « Lecteur autonome ») : mêmes courbes, même ordre de dessin,
//! même comportement. Ce fichier existe pour que l'export soit reproductible
//! hors du navigateur — CI, script de build, correction en ligne de commande.

use std::fmt::Write as _;

use crate::model::Project;

const PLAYER_JS: &str = r#"// HOT MOTOR MOTION — lecteur autonome (aucune dépendance)
const MOTION_DATA = __MOTION_DATA__;

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
}

document.addEventListener('DOMContentLoaded', () => {
    const player = new MotionPlayer('motion-canvas');
    player.render();
    player.play();
    document.getElementById('play-btn').addEventListener('click', () => player.play());
    document.getElementById('pause-btn').addEventListener('click', () => player.pause());
    document.getElementById('stop-btn').addEventListener('click', () => player.stop());
});
"#;

/// Document HTML complet : styles sobres, canvas centré, trois boutons.
pub fn standalone_html(project: &Project) -> String {
    // `<` échappé pour qu'aucun texte d'utilisateur ne puisse fermer la balise
    // <script> qui contient les données.
    let data = project.to_value().to_compact().replace('<', "\\u003c");
    let player = PLAYER_JS.replace("__MOTION_DATA__", &data);

    let width = crate::svg::fmt(project.canvas.width);
    let height = crate::svg::fmt(project.canvas.height);

    let mut out = String::new();
    out.push_str("<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n");
    out.push_str("    <meta charset=\"UTF-8\">\n");
    out.push_str("    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
    let _ = writeln!(
        out,
        "    <title>{} — animation</title>",
        escape_html(&project.name)
    );
    out.push_str(concat!(
        "    <style>\n",
        "        *, *::before, *::after { box-sizing: border-box; }\n",
        "        body {\n",
        "            min-height: 100vh;\n",
        "            margin: 0;\n",
        "            display: flex;\n",
        "            flex-direction: column;\n",
        "            align-items: center;\n",
        "            justify-content: center;\n",
        "            gap: 20px;\n",
        "            padding: 24px;\n",
        "            background: #121214;\n",
        "            color: #ececf1;\n",
        "            font-family: \"Inter\", system-ui, sans-serif;\n",
        "        }\n",
        "        .stage { border-radius: 10px; overflow: hidden;\n",
        "                 box-shadow: 0 26px 70px rgba(0,0,0,.62), 0 0 0 1px rgba(255,255,255,.09); }\n",
        "        canvas { display: block; max-width: 100%; height: auto; background: #000; }\n",
        "        .controls { display: flex; gap: 8px; }\n",
        "        button {\n",
        "            height: 34px; padding: 0 16px;\n",
        "            border: 1px solid #32323a; border-radius: 7px;\n",
        "            background: #1c1c20; color: #a8a8b3;\n",
        "            font: inherit; font-size: 13px; cursor: pointer;\n",
        "            transition: background-color .15s, color .15s, border-color .15s;\n",
        "        }\n",
        "        button:hover { background: #24242a; color: #ececf1; border-color: #45454f; }\n",
        "        button.primary { background: #f0f0f2; border-color: #f0f0f2; color: #121214; font-weight: 600; }\n",
        "        footer { font-size: 11px; letter-spacing: .08em; color: #8b8b96; }\n",
        "    </style>\n",
    ));

    if let Some(link) = font_link(project) {
        out.push_str(&link);
        out.push('\n');
    }

    out.push_str("</head>\n<body>\n");
    out.push_str("    <div class=\"stage\">\n");
    let _ = writeln!(
        out,
        "        <canvas id=\"motion-canvas\" width=\"{width}\" height=\"{height}\"></canvas>"
    );
    out.push_str("    </div>\n");
    out.push_str("    <div class=\"controls\">\n");
    out.push_str("        <button id=\"play-btn\" class=\"primary\">▶ Lecture</button>\n");
    out.push_str("        <button id=\"pause-btn\">⏸ Pause</button>\n");
    out.push_str("        <button id=\"stop-btn\">⏹ Stop</button>\n");
    out.push_str("    </div>\n");
    out.push_str("    <footer>HOT MOTOR MOTION</footer>\n");
    out.push_str("    <script>\n");
    out.push_str(&player);
    out.push_str("    </script>\n</body>\n</html>\n");

    out
}

/// Google Fonts pour les familles réellement utilisées par les textes.
fn font_link(project: &Project) -> Option<String> {
    let mut families: Vec<&str> = project
        .shapes
        .iter()
        .filter(|shape| shape.kind == "Text")
        .map(|shape| shape.font_family.as_str())
        .filter(|family| !family.is_empty())
        .filter(|family| !matches!(*family, "Arial" | "Helvetica" | "sans-serif"))
        .collect();

    families.sort_unstable();
    families.dedup();

    if families.is_empty() {
        return None;
    }

    let query = families
        .iter()
        .map(|family| format!("{}:wght@400;500;600;700;800;900", family.replace(' ', "+")))
        .collect::<Vec<String>>()
        .join("&family=");

    Some(format!(
        "    <link href=\"https://fonts.googleapis.com/css2?family={query}&display=swap\" rel=\"stylesheet\">"
    ))
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Project {
        Project::from_text(
            r#"{
              "name": "Test <script>",
              "duration": 3,
              "shapes": [
                {"id":1,"type":"Text","text":"</script><b>x</b>","fontFamily":"Outfit","fontSize":40}
              ]
            }"#,
        )
        .expect("projet valide")
    }

    #[test]
    fn produces_a_complete_document() {
        let html = standalone_html(&sample());
        assert!(html.starts_with("<!DOCTYPE html>"));
        assert!(html.contains("<canvas id=\"motion-canvas\""));
        assert!(html.trim_end().ends_with("</html>"));
        assert!(html.contains("class MotionPlayer"));
    }

    #[test]
    fn escapes_script_breakers_in_data() {
        let html = standalone_html(&sample());
        // Le contenu utilisateur ne doit jamais pouvoir fermer la balise.
        assert!(!html.contains("</script><b>x</b>"));
        assert!(html.contains("\\u003c/script>"));
        assert!(html.contains("Test &lt;script&gt;"));
    }

    #[test]
    fn embeds_fonts_actually_used() {
        let html = standalone_html(&sample());
        assert!(html.contains("family=Outfit:wght@"));
    }

    #[test]
    fn keeps_canvas_size() {
        let html = standalone_html(&sample());
        assert!(html.contains("width=\"800\" height=\"450\""));
    }

    #[test]
    fn embeds_the_data_once() {
        let html = standalone_html(&sample());
        assert_eq!(html.matches("const MOTION_DATA = ").count(), 1);
    }
}
