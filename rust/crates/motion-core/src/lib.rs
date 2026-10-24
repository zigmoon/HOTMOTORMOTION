//! Moteur natif de HOT MOTOR MOTION.
//!
//! Lit le fichier projet produit par l'éditeur (`Sauvegarder`), le valide,
//! l'interroge et l'exporte. Aucune dépendance externe : le JSON a son propre
//! lecteur/écrivain, les courbes sont recopiées à l'identique du moteur
//! JavaScript et verrouillées par des tests.
//!
//! ```no_run
//! use motion_core::{html, model::Project, svg, validate};
//!
//! let source = std::fs::read_to_string("examples/sample.motion.json").unwrap();
//! let project = Project::from_text(&source).unwrap();
//!
//! for issue in validate::validate(&project) {
//!     println!("{} [{}] {}", issue.severity.label(), issue.code, issue.message);
//! }
//!
//! let frame = svg::render(&project, &svg::SvgOptions { time: 1.5, ..Default::default() });
//! let player = html::standalone_html(&project);
//! println!("{} / {} octets", frame.len(), player.len());
//! ```

pub mod easing;
pub mod html;
pub mod json;
pub mod model;
pub mod svg;
pub mod validate;

pub use html::standalone_html;
pub use model::{Project, Shape, Stats};
pub use svg::{render, SvgOptions};
pub use validate::{validate as validate_project, Issue, Severity};

/// Version du format de projet comprise par ce moteur.
pub const FORMAT_VERSION: &str = "1.0";

#[cfg(test)]
mod integration {
    use super::*;

    /// Le fichier d'exemple livré avec le dépôt doit rester valide : c'est ce
    /// que la documentation demande d'ouvrir en premier.
    #[test]
    fn example_project_is_valid_and_exportable() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../examples/sample.motion.json");
        let source = std::fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("exemple introuvable ({}): {error}", path.display()));
        let project = Project::from_text(&source).expect("exemple lisible");

        let issues = validate::validate(&project);
        assert!(
            !validate::has_errors(&issues),
            "l'exemple ne doit pas contenir d'erreur : {issues:?}"
        );

        assert!(project.shapes.len() >= 3);
        assert!(project.stats().keyframes > 0);

        let svg = svg::render(&project, &SvgOptions { time: 1.0, ..Default::default() });
        assert!(svg.contains("<svg"));
        assert!(svg.contains("<text"));

        let html = html::standalone_html(&project);
        assert!(html.contains("MOTION_DATA"));
    }
}
