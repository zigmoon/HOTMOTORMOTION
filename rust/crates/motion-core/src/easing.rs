//! Courbes d'accélération — copie exacte de celles du moteur JavaScript
//! (`EASING` dans `js/bundle.js`). Toute divergence entre les deux fait
//! diverger le rendu natif et le rendu navigateur : c'est le seul endroit où
//! la duplication est volontaire, et elle est verrouillée par des tests.

pub const LINEAR: &str = "linear";

/// Noms acceptés dans `keyframes[prop][i].e`.
pub const NAMES: [&str; 14] = [
    "linear",
    "sineIn",
    "sineOut",
    "sineInOut",
    "cubicIn",
    "cubicOut",
    "cubicInOut",
    "expoIn",
    "expoOut",
    "expoInOut",
    "backOut",
    "backInOut",
    "elasticOut",
    "spring",
];

pub fn is_known(name: &str) -> bool {
    NAMES.contains(&name)
}

/// Applique une courbe à une progression brute dans `[0, 1]`.
/// Un nom inconnu retombe sur le linéaire, comme côté navigateur.
pub fn apply(name: &str, p: f64) -> f64 {
    match name {
        "sineIn" => 1.0 - (p * std::f64::consts::FRAC_PI_2).cos(),
        "sineOut" => (p * std::f64::consts::FRAC_PI_2).sin(),
        "sineInOut" => -((std::f64::consts::PI * p).cos() - 1.0) / 2.0,
        "cubicIn" => p * p * p,
        "cubicOut" => 1.0 - (1.0 - p).powi(3),
        "cubicInOut" => {
            if p < 0.5 {
                4.0 * p * p * p
            } else {
                1.0 - (-2.0 * p + 2.0).powi(3) / 2.0
            }
        }
        "expoIn" => {
            if p == 0.0 {
                0.0
            } else {
                (10.0 * p - 10.0).exp2()
            }
        }
        "expoOut" => {
            if p == 1.0 {
                1.0
            } else {
                1.0 - (-10.0 * p).exp2()
            }
        }
        "expoInOut" => {
            if p == 0.0 || p == 1.0 {
                p
            } else if p < 0.5 {
                (20.0 * p - 10.0).exp2() / 2.0
            } else {
                (2.0 - (-20.0 * p + 10.0).exp2()) / 2.0
            }
        }
        "backOut" => {
            const C1: f64 = 1.70158;
            const C3: f64 = C1 + 1.0;
            1.0 + C3 * (p - 1.0).powi(3) + C1 * (p - 1.0).powi(2)
        }
        "backInOut" => {
            const C2: f64 = 1.70158 * 1.525;
            if p < 0.5 {
                (2.0 * p).powi(2) * ((C2 + 1.0) * 2.0 * p - C2) / 2.0
            } else {
                ((2.0 * p - 2.0).powi(2) * ((C2 + 1.0) * (p * 2.0 - 2.0) + C2) + 2.0) / 2.0
            }
        }
        "elasticOut" => {
            if p == 0.0 || p == 1.0 {
                p
            } else {
                (-10.0 * p).exp2() * ((p * 10.0 - 0.75) * (2.0 * std::f64::consts::PI / 3.0)).sin()
                    + 1.0
            }
        }
        // Amorti critique approché : dépassement court, retour net à 1.
        "spring" => {
            if p >= 1.0 {
                1.0
            } else {
                1.0 - (-5.5 * p).exp() * (9.0 * p).cos()
            }
        }
        _ => p,
    }
}

/// Libellé lisible, utilisé par `inspect` et par la documentation.
pub fn label(name: &str) -> &'static str {
    match name {
        "linear" => "linéaire",
        "sineIn" => "sinus, entrée",
        "sineOut" => "sinus, sortie",
        "sineInOut" => "sinus, aller-retour",
        "cubicIn" => "cubique, entrée",
        "cubicOut" => "cubique, sortie",
        "cubicInOut" => "cubique, aller-retour",
        "expoIn" => "exponentielle, entrée",
        "expoOut" => "exponentielle, sortie",
        "expoInOut" => "exponentielle, aller-retour",
        "backOut" => "rebond",
        "backInOut" => "rebond, aller-retour",
        "elasticOut" => "élastique",
        "spring" => "amorti",
        _ => "inconnue",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_curve_starts_and_ends_on_the_unit_interval() {
        for name in NAMES {
            let start = apply(name, 0.0);
            let end = apply(name, 1.0);
            assert!((start - 0.0).abs() < 1e-9, "{name} commence à {start}");
            assert!((end - 1.0).abs() < 1e-9, "{name} finit à {end}");
        }
    }

    #[test]
    fn linear_is_identity() {
        assert!((apply(LINEAR, 0.37) - 0.37).abs() < 1e-12);
    }

    #[test]
    fn out_curves_start_fast() {
        // À mi-parcours, une sortie a déjà dépassé la moitié du chemin.
        assert!(apply("expoOut", 0.5) > 0.9);
        assert!(apply("cubicOut", 0.5) > 0.8);
        assert!(apply("sineOut", 0.5) > 0.7);
    }

    #[test]
    fn spring_overshoots_then_settles() {
        let peak = (1..40)
            .map(|i| apply("spring", i as f64 / 40.0))
            .fold(f64::MIN, f64::max);
        assert!(peak > 1.0, "l'amorti doit dépasser 1, pic = {peak}");
        assert!((apply("spring", 1.0) - 1.0).abs() < 1e-12);
    }

    #[test]
    fn unknown_curve_falls_back_to_linear() {
        assert!((apply("nope", 0.42) - 0.42).abs() < 1e-12);
        assert!(!is_known("nope"));
        assert!(is_known("expoOut"));
    }
}
