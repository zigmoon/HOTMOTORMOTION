//! Rendu d'une image fixe en SVG, à un instant donné.
//!
//! Ce n'est pas un exporteur « parfait » : les filtres du canvas (flou, lueur,
//! teinte, saturation) sont traduits par leurs équivalents SVG, qui sont des
//! approximations. C'est suffisant pour une vignette, un storyboard ou une
//! planche de contrôle — et ça reste du vectoriel, donc net à tout format.

use std::fmt::Write as _;

use crate::model::{Project, Shape};

#[derive(Debug, Clone)]
pub struct SvgOptions {
    /// Instant à rendre, en secondes.
    pub time: f64,
    /// Échelle appliquée aux dimensions (1 = taille du canvas).
    pub scale: f64,
    /// Fond transparent au lieu de la couleur du projet.
    pub transparent: bool,
    /// Repères de cadre (bordure fine) — utile pour vérifier un cadrage.
    pub guides: bool,
}

impl Default for SvgOptions {
    fn default() -> Self {
        SvgOptions {
            time: 0.0,
            scale: 1.0,
            transparent: false,
            guides: false,
        }
    }
}

pub fn render(project: &Project, options: &SvgOptions) -> String {
    let scale = if options.scale > 0.0 { options.scale } else { 1.0 };
    let width = project.canvas.width * scale;
    let height = project.canvas.height * scale;
    let time = options.time.clamp(0.0, project.duration);

    let mut out = String::new();
    let _ = writeln!(
        out,
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {cw} {ch}" role="img" aria-label="HOT MOTOR MOTION — image à {t:.2}s">"#,
        w = fmt(width),
        h = fmt(height),
        cw = fmt(project.canvas.width),
        ch = fmt(project.canvas.height),
        t = time
    );

    let filters = filters_for(project, time);
    if !filters.is_empty() {
        out.push_str("<defs>\n");
        out.push_str(&filters);
        out.push_str("</defs>\n");
    }

    if !options.transparent {
        let _ = writeln!(
            out,
            r#"<rect x="0" y="0" width="{w}" height="{h}" fill="{fill}"/>"#,
            w = fmt(project.canvas.width),
            h = fmt(project.canvas.height),
            fill = escape(&project.bg_color)
        );
    }

    for shape in project.draw_order() {
        draw_shape(&mut out, shape, time, project);
    }

    if options.guides {
        let _ = writeln!(
            out,
            r##"<rect x="0.5" y="0.5" width="{w}" height="{h}" fill="none" stroke="#888888" stroke-opacity="0.45" stroke-dasharray="4 4"/>"##,
            w = fmt(project.canvas.width - 1.0),
            h = fmt(project.canvas.height - 1.0)
        );
    }

    out.push_str("</svg>\n");
    out
}

fn draw_shape(out: &mut String, shape: &Shape, time: f64, project: &Project) {
    let opacity = clamp(shape.value_at("opacity", time), 0.0, 1.0);
    if opacity <= 0.001 {
        return;
    }

    let x = shape.value_at("x", time);
    let y = shape.value_at("y", time);
    let rotation = shape.value_at("rotation", time);
    let rotation_x = shape.value_at("rotationX", time);
    let rotation_y = shape.value_at("rotationY", time);
    let scale_x = shape.value_at("scaleX", time);
    let scale_y = shape.value_at("scaleY", time);
    let skew_x = shape.value_at("skewX", time);
    let skew_y = shape.value_at("skewY", time);

    // Même empilement que le canvas : translation, échelle (avec la
    // perspective approximée), cisaillement, rotation.
    let perspective = 1.0 + rotation_x * 0.002 + rotation_y * 0.002;
    let mut transform = format!("translate({} {})", fmt(x), fmt(y));

    let sx = scale_x * perspective;
    let sy = scale_y * perspective;
    if (sx - 1.0).abs() > 1e-9 || (sy - 1.0).abs() > 1e-9 {
        let _ = write!(transform, " scale({} {})", fmt(sx), fmt(sy));
    }

    if skew_x.abs() > 1e-9 || skew_y.abs() > 1e-9 {
        let _ = write!(
            transform,
            " matrix(1 {} {} 1 0 0)",
            fmt((skew_y * std::f64::consts::PI / 180.0).tan()),
            fmt((skew_x * std::f64::consts::PI / 180.0).tan())
        );
    }

    if rotation.abs() > 1e-9 {
        let _ = write!(transform, " rotate({})", fmt(rotation));
    }

    let filter = if needs_filter(shape, time) {
        format!(r#" filter="url(#{})""#, filter_id(shape))
    } else {
        String::new()
    };
    let mut attributes = format!(
        r#" transform="{t}" fill="{fill}" opacity="{opacity}""#,
        t = transform,
        fill = escape(&shape.fill),
        opacity = fmt(opacity)
    );
    attributes.push_str(&filter);

    match shape.kind.as_str() {
        "Circle" => {
            let radius = shape.value_at("radius", time).max(0.0);
            let _ = writeln!(
                out,
                r#"<circle cx="0" cy="0" r="{}"{}/>"#,
                fmt(radius),
                attributes
            );
        }
        "Text" => {
            let size = shape.value_at("fontSize", time).max(0.0);
            let weight = shape.value_at("fontWeight", time);
            let family = if shape.font_family.trim().is_empty() {
                "sans-serif"
            } else {
                shape.font_family.as_str()
            };
            let _ = writeln!(
                out,
                r#"<text x="0" y="0" font-family="{family}" font-size="{size}" font-weight="{weight}" text-anchor="middle" dominant-baseline="central"{attrs}>{text}</text>"#,
                family = escape(family),
                size = fmt(size),
                weight = fmt(weight),
                attrs = attributes,
                text = escape(&shape.text)
            );
        }
        "SVG" => {
            // Les données vectorielles importées ne sont pas conservées dans
            // le projet (seule la data URL de l'image l'est, et le SVG natif
            // n'embarque pas d'image externe) : on dessine un cadre de
            // remplacement, visible, jamais un trou silencieux.
            if shape.image_src.is_some() {
                let w = shape.value_at("width", time).max(0.0);
                let h = shape.value_at("height", time).max(0.0);
                let _ = writeln!(
                    out,
                    r#"<rect x="{}" y="{}" width="{}" height="{}"{} stroke="{stroke}" stroke-opacity="0.5" stroke-dasharray="6 6"/>"#,
                    fmt(-w / 2.0),
                    fmt(-h / 2.0),
                    fmt(w),
                    fmt(h),
                    attributes,
                    stroke = escape(&shape.fill)
                );
            }
        }
        _ => {
            let w = shape.value_at("width", time).max(0.0);
            let h = shape.value_at("height", time).max(0.0);
            let _ = writeln!(
                out,
                r#"<rect x="{}" y="{}" width="{}" height="{}"{}/>"#,
                fmt(-w / 2.0),
                fmt(-h / 2.0),
                fmt(w),
                fmt(h),
                attributes
            );
        }
    }

    let _ = project;
}

/// Vrai si la forme porte au moins un filtre actif à cet instant.
/// Une référence `url(#…)` vers un filtre absent fait disparaître l'élément
/// dans les navigateurs : l'attribut ne doit être posé que s'il existe.
fn needs_filter(shape: &Shape, time: f64) -> bool {
    shape.value_at("blur", time) > 0.01
        || shape.value_at("glow", time) > 0.01
        || shape.value_at("hue", time).abs() > 0.01
        || (shape.value_at("saturation", time) - 100.0).abs() > 0.01
        || (shape.value_at("brightness", time) - 100.0).abs() > 0.01
        || (shape.value_at("contrast", time) - 100.0).abs() > 0.01
}

/// Filtres SVG regroupés par forme, dans un seul `<defs>`.
fn filters_for(project: &Project, time: f64) -> String {
    let mut out = String::new();

    for shape in project.draw_order() {
        if !needs_filter(shape, time) {
            continue;
        }

        let blur = shape.value_at("blur", time);
        let glow = shape.value_at("glow", time);
        let hue = shape.value_at("hue", time);
        let saturation = shape.value_at("saturation", time);
        let brightness = shape.value_at("brightness", time);
        let contrast = shape.value_at("contrast", time);

        let id = filter_id(shape);
        let _ = write!(
            out,
            r#"<filter id="{id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">"#
        );

        if blur > 0.01 {
            let _ = write!(
                out,
                r#"<feGaussianBlur stdDeviation="{}"/>"#,
                fmt(blur / 2.0)
            );
        }

        if (hue.abs() > 0.01) || (saturation - 100.0).abs() > 0.01 {
            if hue.abs() > 0.01 {
                let _ = write!(
                    out,
                    r#"<feColorMatrix type="hueRotate" values="{}"/>"#,
                    fmt(hue)
                );
            }
            if (saturation - 100.0).abs() > 0.01 {
                let _ = write!(
                    out,
                    r#"<feColorMatrix type="saturate" values="{}"/>"#,
                    fmt(saturation / 100.0)
                );
            }
        }

        if (brightness - 100.0).abs() > 0.01 || (contrast - 100.0).abs() > 0.01 {
            let slope = (brightness / 100.0) * (contrast / 100.0);
            let intercept = (1.0 - contrast / 100.0) / 2.0;
            let _ = write!(
                out,
                r#"<feComponentTransfer><feFuncR type="linear" slope="{s}" intercept="{i}"/><feFuncG type="linear" slope="{s}" intercept="{i}"/><feFuncB type="linear" slope="{s}" intercept="{i}"/></feComponentTransfer>"#,
                s = fmt(slope),
                i = fmt(intercept)
            );
        }

        if glow > 0.01 {
            let _ = write!(
                out,
                r#"<feDropShadow dx="0" dy="0" stdDeviation="{}" flood-color="{}"/>"#,
                fmt(glow / 2.0),
                escape(&shape.glow_color)
            );
        }

        out.push_str("</filter>\n");
    }

    out
}

fn filter_id(shape: &Shape) -> String {
    format!("f{}", shape.id)
}

fn clamp(value: f64, min: f64, max: f64) -> f64 {
    if value.is_nan() {
        min
    } else {
        value.max(min).min(max)
    }
}

/// Nombre sans zéros inutiles : `400`, `0.5`, `-12.25`.
pub fn fmt(value: f64) -> String {
    if !value.is_finite() {
        return "0".to_string();
    }
    let rounded = (value * 1000.0).round() / 1000.0;
    if rounded == rounded.trunc() && rounded.abs() < 1e15 {
        (rounded as i64).to_string()
    } else {
        let mut text = format!("{rounded}");
        if text.contains('.') {
            while text.ends_with('0') {
                text.pop();
            }
            if text.ends_with('.') {
                text.pop();
            }
        }
        text
    }
}

fn escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            other => out.push(other),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Project {
        Project::from_text(
            r##"{
              "duration": 4,
              "bgColor": "#121212",
              "shapes": [
                {"id":1,"type":"Rect","x":400,"y":225,"width":200,"height":100,"fill":"#f5c518","z":1},
                {"id":2,"type":"Circle","x":200,"y":225,"radius":40,"fill":"#ffffff","z":0,
                 "keyframes":{"x":[{"t":0,"v":200},{"t":4,"v":600}]}},
                {"id":3,"type":"Text","x":400,"y":380,"text":"A < B & C","fontSize":40,"fill":"#ffffff"}
              ]
            }"##,
        )
        .expect("projet valide")
    }

    #[test]
    fn renders_all_three_primitives() {
        let svg = render(&sample(), &SvgOptions::default());
        assert!(svg.starts_with("<svg"));
        assert!(svg.contains("<rect"));
        assert!(svg.contains("<circle"));
        assert!(svg.contains("<text"));
        assert!(svg.trim_end().ends_with("</svg>"));
    }

    #[test]
    fn escapes_user_text() {
        let svg = render(&sample(), &SvgOptions::default());
        assert!(svg.contains("A &lt; B &amp; C"));
        assert!(!svg.contains("A < B & C"));
    }

    #[test]
    fn respects_draw_order() {
        let svg = render(&sample(), &SvgOptions::default());
        let circle = svg.find("<circle").unwrap();
        let rect = svg.find("<rect x=\"-100\"").expect("rect centré");
        assert!(circle < rect, "z=0 doit être dessiné avant z=1");
    }

    #[test]
    fn animates_with_time() {
        let project = sample();
        let start = render(&project, &SvgOptions { time: 0.0, ..Default::default() });
        let end = render(&project, &SvgOptions { time: 4.0, ..Default::default() });
        assert!(start.contains("translate(200 225)"));
        assert!(end.contains("translate(600 225)"));
    }

    #[test]
    fn clamps_time_to_duration() {
        let svg = render(&sample(), &SvgOptions { time: 99.0, ..Default::default() });
        assert!(svg.contains("à 4.00s"));
    }

    #[test]
    fn scale_changes_pixel_size_not_viewbox() {
        let svg = render(&sample(), &SvgOptions { scale: 2.0, ..Default::default() });
        assert!(svg.contains("width=\"1600\""));
        assert!(svg.contains("viewBox=\"0 0 800 450\""));
    }

    #[test]
    fn transparent_option_removes_background() {
        let svg = render(&sample(), &SvgOptions { transparent: true, ..Default::default() });
        assert!(!svg.contains("#121212"));
    }

    #[test]
    fn numbers_are_compact() {
        assert_eq!(fmt(400.0), "400");
        assert_eq!(fmt(0.5), "0.5");
        assert_eq!(fmt(-12.25), "-12.25");
        assert_eq!(fmt(1.0 / 3.0), "0.333");
        assert_eq!(fmt(f64::NAN), "0");
    }

    #[test]
    fn filter_references_always_resolve() {
        // Une forme sans filtre ne doit pas porter d'attribut `filter` :
        // une référence `url(#…)` sans définition fait disparaître l'élément.
        let svg = render(&sample(), &SvgOptions::default());
        assert!(!svg.contains("filter=\"url(#f1)\""));

        let referenced: Vec<&str> = svg
            .split("filter=\"url(#")
            .skip(1)
            .filter_map(|chunk| chunk.split(')').next())
            .collect();
        for id in referenced {
            assert!(
                svg.contains(&format!("<filter id=\"{id}\"")),
                "filtre manquant : {id}"
            );
        }
    }

    #[test]
    fn glow_produces_a_filter() {
        let project = Project::from_text(
            r##"{"shapes":[{"id":7,"type":"Circle","radius":20,"glow":24,"glowColor":"#ffffff"}]}"##,
        )
        .expect("projet valide");
        let svg = render(&project, &SvgOptions::default());
        assert!(svg.contains("<filter id=\"f7\""));
        assert!(svg.contains("filter=\"url(#f7)\""));
        assert!(svg.contains("feDropShadow"));
    }
}
