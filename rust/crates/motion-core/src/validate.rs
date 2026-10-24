//! Contrôles de cohérence d'un projet, avant export.
//!
//! Deux niveaux seulement : `Error` empêche un export fidèle, `Warning`
//! signale une valeur douteuse qui reste dessinable. Rien n'est corrigé
//! silencieusement : le fichier de l'utilisateur n'est pas réécrit.

use crate::easing;
use crate::model::{Project, ANIMATABLE};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    Error,
    Warning,
}

impl Severity {
    pub fn label(self) -> &'static str {
        match self {
            Severity::Error => "erreur",
            Severity::Warning => "avertissement",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Issue {
    pub severity: Severity,
    pub code: &'static str,
    pub message: String,
    pub shape: Option<u32>,
}

impl Issue {
    fn new(severity: Severity, code: &'static str, message: impl Into<String>, shape: Option<u32>) -> Self {
        Issue {
            severity,
            code,
            message: message.into(),
            shape,
        }
    }
}

/// Toutes les anomalies, dans l'ordre du document.
pub fn validate(project: &Project) -> Vec<Issue> {
    let mut issues = Vec::new();

    if !(project.duration.is_finite() && project.duration > 0.0) {
        issues.push(Issue::new(
            Severity::Error,
            "duration",
            format!("durée invalide : {} (doit être > 0)", project.duration),
            None,
        ));
    }

    if !(project.canvas.width > 0.0 && project.canvas.height > 0.0) {
        issues.push(Issue::new(
            Severity::Error,
            "canvas",
            format!(
                "canvas invalide : {} × {}",
                project.canvas.width, project.canvas.height
            ),
            None,
        ));
    }

    if !is_color(&project.bg_color) {
        issues.push(Issue::new(
            Severity::Warning,
            "bg-color",
            format!("couleur de fond inattendue : {}", project.bg_color),
            None,
        ));
    }

    let mut seen_ids = Vec::new();

    for shape in &project.shapes {
        if seen_ids.contains(&shape.id) {
            issues.push(Issue::new(
                Severity::Error,
                "duplicate-id",
                format!("identifiant {} utilisé plusieurs fois", shape.id),
                Some(shape.id),
            ));
        } else {
            seen_ids.push(shape.id);
        }

        match shape.kind.as_str() {
            "Rect" | "Circle" | "Text" | "SVG" => {}
            other => issues.push(Issue::new(
                Severity::Error,
                "shape-type",
                format!("type de forme inconnu : {other}"),
                Some(shape.id),
            )),
        }

        if !is_color(&shape.fill) {
            issues.push(Issue::new(
                Severity::Warning,
                "fill",
                format!("remplissage inattendu : {}", shape.fill),
                Some(shape.id),
            ));
        }

        if !(0.0..=1.0).contains(&shape.opacity) {
            issues.push(Issue::new(
                Severity::Warning,
                "opacity",
                format!("opacité hors [0, 1] : {}", shape.opacity),
                Some(shape.id),
            ));
        }

        if shape.width < 0.0 || shape.height < 0.0 || shape.radius < 0.0 {
            issues.push(Issue::new(
                Severity::Warning,
                "negative-size",
                "dimension négative".to_string(),
                Some(shape.id),
            ));
        }

        if shape.scale_x == 0.0 || shape.scale_y == 0.0 {
            issues.push(Issue::new(
                Severity::Warning,
                "zero-scale",
                "échelle nulle : la forme sera invisible".to_string(),
                Some(shape.id),
            ));
        }

        if shape.kind == "Text" && shape.text.trim().is_empty() {
            issues.push(Issue::new(
                Severity::Warning,
                "empty-text",
                "texte vide".to_string(),
                Some(shape.id),
            ));
        }

        if !inside_canvas(shape, project) {
            issues.push(Issue::new(
                Severity::Warning,
                "offscreen",
                "forme entièrement hors du canvas à l'instant 0".to_string(),
                Some(shape.id),
            ));
        }

        for (prop, keys) in &shape.keyframes {
            if !ANIMATABLE.contains(&prop.as_str()) {
                issues.push(Issue::new(
                    Severity::Warning,
                    "animated-property",
                    format!("propriété « {prop} » animée mais non interpolable"),
                    Some(shape.id),
                ));
            }

            for key in keys {
                if !easing::is_known(&key.easing) {
                    issues.push(Issue::new(
                        Severity::Warning,
                        "easing",
                        format!("courbe inconnue « {} » sur {prop}", key.easing),
                        Some(shape.id),
                    ));
                }
                if key.t < 0.0 || key.t > project.duration + 1e-6 {
                    issues.push(Issue::new(
                        Severity::Warning,
                        "keyframe-time",
                        format!(
                            "image clé {prop} hors de la durée ({:.2}s > {:.2}s)",
                            key.t, project.duration
                        ),
                        Some(shape.id),
                    ));
                }
            }

            let unsorted = keys.windows(2).any(|pair| pair[0].t > pair[1].t);
            if unsorted {
                issues.push(Issue::new(
                    Severity::Warning,
                    "keyframe-order",
                    format!("images clés {prop} non triées"),
                    Some(shape.id),
                ));
            }
        }
    }

    issues
}

pub fn has_errors(issues: &[Issue]) -> bool {
    issues.iter().any(|issue| issue.severity == Severity::Error)
}

fn is_color(value: &str) -> bool {
    let bytes = value.as_bytes();
    if !(bytes.len() == 7 || bytes.len() == 4) || bytes[0] != b'#' {
        return false;
    }
    bytes[1..].iter().all(|byte| byte.is_ascii_hexdigit())
}

fn inside_canvas(shape: &crate::model::Shape, project: &Project) -> bool {
    let half_w = if shape.kind == "Circle" {
        shape.radius
    } else {
        shape.width / 2.0
    };
    let half_h = if shape.kind == "Circle" {
        shape.radius
    } else {
        shape.height / 2.0
    };

    let x = shape.value_at("x", 0.0);
    let y = shape.value_at("y", 0.0);
    let margin = 2000.0; // tolérance : entrées/sorties de cadre animées

    x + half_w > -margin
        && x - half_w < project.canvas.width + margin
        && y + half_h > -margin
        && y - half_h < project.canvas.height + margin
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(json: &str) -> Project {
        Project::from_text(json).expect("projet valide")
    }

    #[test]
    fn clean_project_has_no_issue() {
        let issues = validate(&project(
            r##"{"duration":3,"shapes":[{"id":1,"type":"Rect","x":400,"y":225,"fill":"#ffffff"}]}"##,
        ));
        assert!(issues.is_empty(), "inattendu : {issues:?}");
    }

    #[test]
    fn catches_duplicate_ids_and_unknown_types() {
        let issues = validate(&project(
            r#"{"shapes":[{"id":1,"type":"Rect"},{"id":1,"type":"Cone"}]}"#,
        ));
        assert!(issues.iter().any(|i| i.code == "duplicate-id"));
        assert!(issues.iter().any(|i| i.code == "shape-type"));
        assert!(has_errors(&issues));
    }

    #[test]
    fn warns_on_keyframes_outside_duration() {
        let issues = validate(&project(
            r#"{"duration":2,"shapes":[{"id":1,"type":"Rect","keyframes":{"x":[{"t":0,"v":0},{"t":5,"v":10}]}}]}"#,
        ));
        assert!(issues.iter().any(|i| i.code == "keyframe-time"));
        assert!(!has_errors(&issues));
    }

    #[test]
    fn warns_on_bad_colour_and_opacity() {
        let issues = validate(&project(
            r#"{"shapes":[{"id":1,"type":"Rect","fill":"red","opacity":2}]}"#,
        ));
        assert!(issues.iter().any(|i| i.code == "fill"));
        assert!(issues.iter().any(|i| i.code == "opacity"));
    }

    #[test]
    fn catches_invalid_duration() {
        let mut broken = project(r#"{"duration":2,"shapes":[]}"#);
        broken.duration = 0.0;
        let issues = validate(&broken);
        assert!(issues.iter().any(|i| i.code == "duration"));
    }

    #[test]
    fn accepts_three_and_six_digit_hex() {
        assert!(is_color("#fff"));
        assert!(is_color("#f5c518"));
        assert!(!is_color("#ggg"));
        assert!(!is_color("white"));
    }
}
