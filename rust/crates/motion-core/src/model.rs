//! Modèle d'un projet HOT MOTOR MOTION.
//!
//! Le fichier lu est celui que produit le bouton « Sauvegarder » de l'éditeur :
//!
//! ```json
//! {
//!   "app": "HOT MOTOR MOTION", "version": "1.0", "name": "…",
//!   "created": "2026-10-25T00:00:00.000Z", "duration": 10,
//!   "canvas": { "width": 800, "height": 450 }, "bgColor": "#121212",
//!   "shapes": [ { "id": 1, "type": "Rect", "x": 400, "y": 225, …,
//!                 "keyframes": { "x": [ { "t": 0, "v": 200, "e": "expoOut" } ] } } ]
//! }
//! ```
//!
//! La lecture est tolérante : un champ absent prend la même valeur par défaut
//! que dans l'éditeur, un champ inconnu est ignoré. Un fichier écrit à la main
//! doit pouvoir s'ouvrir sans outil.

use std::collections::BTreeMap;

use crate::easing;
use crate::json::Value;

pub const DEFAULT_FILL: &str = "#ffffff";
pub const DEFAULT_BG: &str = "#121212";
pub const DEFAULT_FONT: &str = "JetBrains Mono";

/// Propriétés animables, dans l'ordre affiché par `inspect`.
pub const ANIMATABLE: [&str; 22] = [
    "x",
    "y",
    "z",
    "width",
    "height",
    "radius",
    "opacity",
    "rotation",
    "rotationX",
    "rotationY",
    "scaleX",
    "scaleY",
    "skewX",
    "skewY",
    "blur",
    "glow",
    "hue",
    "saturation",
    "brightness",
    "contrast",
    "fontSize",
    "fontWeight",
];

#[derive(Debug, Clone, PartialEq)]
pub struct Canvas {
    pub width: f64,
    pub height: f64,
}

impl Default for Canvas {
    fn default() -> Self {
        Canvas {
            width: 800.0,
            height: 450.0,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Keyframe {
    /// Temps en secondes.
    pub t: f64,
    pub v: f64,
    /// Courbe appliquée *depuis* cette image clé vers la suivante.
    pub easing: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Shape {
    pub id: u32,
    pub kind: String,
    pub name: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub width: f64,
    pub height: f64,
    pub radius: f64,
    pub fill: String,
    pub text: String,
    pub font_size: f64,
    pub font_family: String,
    pub font_weight: f64,
    pub opacity: f64,
    pub rotation: f64,
    pub rotation_x: f64,
    pub rotation_y: f64,
    pub scale_x: f64,
    pub scale_y: f64,
    pub skew_x: f64,
    pub skew_y: f64,
    pub blur: f64,
    pub glow: f64,
    pub glow_color: String,
    pub hue: f64,
    pub saturation: f64,
    pub brightness: f64,
    pub contrast: f64,
    pub image_src: Option<String>,
    pub keyframes: BTreeMap<String, Vec<Keyframe>>,
}

impl Shape {
    /// Valeur statique d'une propriété, hors animation.
    pub fn static_value(&self, prop: &str) -> Option<f64> {
        Some(match prop {
            "x" => self.x,
            "y" => self.y,
            "z" => self.z,
            "width" => self.width,
            "height" => self.height,
            "radius" => self.radius,
            "opacity" => self.opacity,
            "rotation" => self.rotation,
            "rotationX" => self.rotation_x,
            "rotationY" => self.rotation_y,
            "scaleX" => self.scale_x,
            "scaleY" => self.scale_y,
            "skewX" => self.skew_x,
            "skewY" => self.skew_y,
            "blur" => self.blur,
            "glow" => self.glow,
            "hue" => self.hue,
            "saturation" => self.saturation,
            "brightness" => self.brightness,
            "contrast" => self.contrast,
            "fontSize" => self.font_size,
            "fontWeight" => self.font_weight,
            _ => return None,
        })
    }

    /// Valeur interpolée à l'instant `time` (secondes).
    pub fn value_at(&self, prop: &str, time: f64) -> f64 {
        match self.keyframes.get(prop) {
            Some(keys) if !keys.is_empty() => interpolate(keys, time),
            _ => self.static_value(prop).unwrap_or(0.0),
        }
    }

    pub fn animated_properties(&self) -> Vec<&str> {
        self.keyframes
            .iter()
            .filter(|(_, keys)| !keys.is_empty())
            .map(|(prop, _)| prop.as_str())
            .collect()
    }

    pub fn keyframe_count(&self) -> usize {
        self.keyframes.values().map(Vec::len).sum()
    }

    /// Instants distincts (arrondis au centième, comme la timeline).
    pub fn instants(&self) -> Vec<f64> {
        let mut times: Vec<f64> = self
            .keyframes
            .values()
            .flat_map(|keys| keys.iter().map(|key| (key.t * 100.0).round() / 100.0))
            .collect();
        times.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        times.dedup_by(|a, b| (*a - *b).abs() < 1e-9);
        times
    }
}

/// Interpolation linéaire entre deux images clés, avec la courbe de la première.
pub fn interpolate(keys: &[Keyframe], time: f64) -> f64 {
    if keys.is_empty() {
        return 0.0;
    }
    if keys.len() == 1 {
        return keys[0].v;
    }

    let first = &keys[0];
    if time <= first.t {
        return first.v;
    }

    let last = &keys[keys.len() - 1];
    if time >= last.t {
        return last.v;
    }

    for pair in keys.windows(2) {
        let (start, end) = (&pair[0], &pair[1]);
        if time >= start.t && time < end.t {
            let span = end.t - start.t;
            let raw = if span > 0.0 {
                (time - start.t) / span
            } else {
                1.0
            };
            let progress = easing::apply(&start.easing, raw);
            return start.v + (end.v - start.v) * progress;
        }
    }

    last.v
}

#[derive(Debug, Clone, PartialEq)]
pub struct Project {
    pub app: String,
    pub version: String,
    pub name: String,
    pub created: Option<String>,
    pub duration: f64,
    pub canvas: Canvas,
    pub bg_color: String,
    pub shapes: Vec<Shape>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Stats {
    pub shapes: usize,
    pub keyframes: usize,
    pub animated_shapes: usize,
    pub instants: usize,
    pub duration: f64,
    pub widest_property: Option<(String, usize, u32)>,
}

impl Default for Project {
    fn default() -> Self {
        Project {
            app: "HOT MOTOR MOTION".to_string(),
            version: "1.0".to_string(),
            name: "HOT MOTOR MOTION Project".to_string(),
            created: None,
            duration: 10.0,
            canvas: Canvas::default(),
            bg_color: DEFAULT_BG.to_string(),
            shapes: Vec::new(),
        }
    }
}

fn number(value: Option<&Value>, fallback: f64) -> f64 {
    match value {
        Some(Value::Number(n)) if n.is_finite() => *n,
        Some(Value::String(text)) => text.trim().parse::<f64>().unwrap_or(fallback),
        _ => fallback,
    }
}

fn text(value: Option<&Value>, fallback: &str) -> String {
    match value {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => n.to_string(),
        _ => fallback.to_string(),
    }
}

impl Project {
    pub fn from_text(source: &str) -> Result<Project, String> {
        let value = Value::parse(source).map_err(|error| format!("JSON invalide : {error}"))?;
        Project::from_value(&value)
    }

    pub fn from_value(value: &Value) -> Result<Project, String> {
        if !value.is_object() {
            return Err("la racine du projet doit être un objet JSON".to_string());
        }

        let shapes_value = value
            .get("shapes")
            .ok_or_else(|| "clé « shapes » absente".to_string())?;
        let shapes_array = shapes_value
            .as_array()
            .ok_or_else(|| "« shapes » doit être un tableau".to_string())?;

        let canvas_value = value.get("canvas");
        let canvas = Canvas {
            width: number(canvas_value.and_then(|c| c.get("width")), 800.0),
            height: number(canvas_value.and_then(|c| c.get("height")), 450.0),
        };

        let mut shapes = Vec::with_capacity(shapes_array.len());
        for (index, item) in shapes_array.iter().enumerate() {
            shapes.push(shape_from_value(item, index as u32 + 1));
        }

        let duration = number(value.get("duration"), 10.0);

        Ok(Project {
            app: text(value.get("app"), "HOT MOTOR MOTION"),
            version: text(value.get("version"), "1.0"),
            name: text(value.get("name"), "HOT MOTOR MOTION Project"),
            created: value.get("created").and_then(Value::as_str).map(str::to_string),
            duration: if duration > 0.0 { duration } else { 10.0 },
            canvas,
            bg_color: text(value.get("bgColor"), DEFAULT_BG),
            shapes,
        })
    }

    pub fn to_value(&self) -> Value {
        let shapes = self
            .shapes
            .iter()
            .map(Shape::to_value)
            .collect::<Vec<Value>>();

        let mut root = vec![
            ("app".to_string(), Value::String(self.app.clone())),
            ("version".to_string(), Value::String(self.version.clone())),
            ("name".to_string(), Value::String(self.name.clone())),
        ];

        if let Some(created) = &self.created {
            root.push(("created".to_string(), Value::String(created.clone())));
        }

        root.push(("duration".to_string(), Value::Number(self.duration)));
        root.push((
            "canvas".to_string(),
            Value::Object(vec![
                ("width".to_string(), Value::Number(self.canvas.width)),
                ("height".to_string(), Value::Number(self.canvas.height)),
            ]),
        ));
        root.push(("bgColor".to_string(), Value::String(self.bg_color.clone())));
        root.push(("shapes".to_string(), Value::Array(shapes)));

        Value::Object(root)
    }

    pub fn to_json(&self) -> String {
        self.to_value().to_pretty()
    }

    pub fn stats(&self) -> Stats {
        let mut keyframes = 0usize;
        let mut animated_shapes = 0usize;
        let mut instants: Vec<f64> = Vec::new();
        let mut widest: Option<(String, usize, u32)> = None;

        for shape in &self.shapes {
            let count = shape.keyframe_count();
            keyframes += count;
            if count > 0 {
                animated_shapes += 1;
            }
            instants.extend(shape.instants());
            for (prop, keys) in &shape.keyframes {
                if widest.as_ref().map(|(_, n, _)| keys.len() > *n).unwrap_or(true) {
                    widest = Some((prop.clone(), keys.len(), shape.id));
                }
            }
        }

        instants.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        instants.dedup_by(|a, b| (*a - *b).abs() < 1e-9);

        Stats {
            shapes: self.shapes.len(),
            keyframes,
            animated_shapes,
            instants: instants.len(),
            duration: self.duration,
            widest_property: widest,
        }
    }

    /// Ordre de dessin : Z croissant, puis ordre du document (stable).
    pub fn draw_order(&self) -> Vec<&Shape> {
        let mut shapes: Vec<&Shape> = self.shapes.iter().collect();
        shapes.sort_by(|a, b| {
            a.z.partial_cmp(&b.z)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(a.id.cmp(&b.id))
        });
        shapes
    }
}

impl Shape {
    pub fn to_value(&self) -> Value {
        let mut entries: Vec<(String, Value)> = vec![
            ("id".to_string(), Value::Number(self.id as f64)),
            ("type".to_string(), Value::String(self.kind.clone())),
            ("name".to_string(), Value::String(self.name.clone())),
            ("x".to_string(), Value::Number(self.x)),
            ("y".to_string(), Value::Number(self.y)),
            ("z".to_string(), Value::Number(self.z)),
            ("width".to_string(), Value::Number(self.width)),
            ("height".to_string(), Value::Number(self.height)),
            ("radius".to_string(), Value::Number(self.radius)),
            ("fill".to_string(), Value::String(self.fill.clone())),
            ("text".to_string(), Value::String(self.text.clone())),
            ("fontSize".to_string(), Value::Number(self.font_size)),
            ("fontFamily".to_string(), Value::String(self.font_family.clone())),
            ("fontWeight".to_string(), Value::Number(self.font_weight)),
            ("opacity".to_string(), Value::Number(self.opacity)),
            ("rotation".to_string(), Value::Number(self.rotation)),
            ("rotationX".to_string(), Value::Number(self.rotation_x)),
            ("rotationY".to_string(), Value::Number(self.rotation_y)),
            ("scaleX".to_string(), Value::Number(self.scale_x)),
            ("scaleY".to_string(), Value::Number(self.scale_y)),
            ("skewX".to_string(), Value::Number(self.skew_x)),
            ("skewY".to_string(), Value::Number(self.skew_y)),
            ("blur".to_string(), Value::Number(self.blur)),
            ("glow".to_string(), Value::Number(self.glow)),
            ("glowColor".to_string(), Value::String(self.glow_color.clone())),
            ("hue".to_string(), Value::Number(self.hue)),
            ("saturation".to_string(), Value::Number(self.saturation)),
            ("brightness".to_string(), Value::Number(self.brightness)),
            ("contrast".to_string(), Value::Number(self.contrast)),
        ];

        if let Some(src) = &self.image_src {
            entries.push(("imageSrc".to_string(), Value::String(src.clone())));
        }

        let keyframes = self
            .keyframes
            .iter()
            .map(|(prop, keys)| {
                let list = keys
                    .iter()
                    .map(|key| {
                        let mut entries = vec![
                            ("t".to_string(), Value::Number(key.t)),
                            ("v".to_string(), Value::Number(key.v)),
                        ];
                        if key.easing != easing::LINEAR {
                            entries.push(("e".to_string(), Value::String(key.easing.clone())));
                        }
                        Value::Object(entries)
                    })
                    .collect();
                (prop.clone(), Value::Array(list))
            })
            .collect();

        entries.push(("keyframes".to_string(), Value::Object(keyframes)));
        Value::Object(entries)
    }
}

fn shape_from_value(value: &Value, fallback_id: u32) -> Shape {
    let id = match value.get("id").and_then(Value::as_f64) {
        Some(raw) if raw.is_finite() && raw > 0.0 => raw.round() as u32,
        _ => fallback_id,
    };

    Shape {
        id,
        kind: text(value.get("type"), "Rect"),
        name: text(value.get("name"), &format!("Shape {id}")),
        x: number(value.get("x"), 400.0),
        y: number(value.get("y"), 225.0),
        z: number(value.get("z"), 0.0),
        width: number(value.get("width"), 100.0),
        height: number(value.get("height"), 100.0),
        radius: number(value.get("radius"), 50.0),
        fill: text(value.get("fill"), DEFAULT_FILL),
        text: text(value.get("text"), "Text"),
        font_size: number(value.get("fontSize"), 30.0),
        font_family: text(value.get("fontFamily"), DEFAULT_FONT),
        font_weight: number(value.get("fontWeight"), 500.0),
        opacity: number(value.get("opacity"), 1.0),
        rotation: number(value.get("rotation"), 0.0),
        rotation_x: number(value.get("rotationX"), 0.0),
        rotation_y: number(value.get("rotationY"), 0.0),
        scale_x: number(value.get("scaleX"), 1.0),
        scale_y: number(value.get("scaleY"), 1.0),
        skew_x: number(value.get("skewX"), 0.0),
        skew_y: number(value.get("skewY"), 0.0),
        blur: number(value.get("blur"), 0.0),
        glow: number(value.get("glow"), 0.0),
        glow_color: text(value.get("glowColor"), DEFAULT_FILL),
        hue: number(value.get("hue"), 0.0),
        saturation: number(value.get("saturation"), 100.0),
        brightness: number(value.get("brightness"), 100.0),
        contrast: number(value.get("contrast"), 100.0),
        image_src: value.get("imageSrc").and_then(Value::as_str).map(str::to_string),
        keyframes: keyframes_from_value(value.get("keyframes")),
    }
}

fn keyframes_from_value(value: Option<&Value>) -> BTreeMap<String, Vec<Keyframe>> {
    let mut output = BTreeMap::new();
    let entries = match value {
        Some(Value::Object(entries)) => entries,
        _ => return output,
    };

    for (prop, list) in entries {
        let items = match list.as_array() {
            Some(items) => items,
            None => continue,
        };

        let mut keys: Vec<Keyframe> = items
            .iter()
            .filter_map(|item| {
                let t = item.get("t").and_then(Value::as_f64)?;
                let v = item.get("v").and_then(Value::as_f64)?;
                if !t.is_finite() || !v.is_finite() {
                    return None;
                }
                let easing = item
                    .get("e")
                    .and_then(Value::as_str)
                    .filter(|name| easing::is_known(name))
                    .unwrap_or(easing::LINEAR)
                    .to_string();
                Some(Keyframe { t, v, easing })
            })
            .collect();

        if keys.is_empty() {
            continue;
        }

        keys.sort_by(|a, b| a.t.partial_cmp(&b.t).unwrap_or(std::cmp::Ordering::Equal));
        output.insert(prop.clone(), keys);
    }

    output
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r##"{
        "app": "HOT MOTOR MOTION",
        "version": "1.0",
        "duration": 4,
        "canvas": { "width": 800, "height": 450 },
        "bgColor": "#121212",
        "shapes": [
            { "id": 1, "type": "Circle", "x": 100, "y": 225, "radius": 40, "fill": "#f5c518",
              "keyframes": { "x": [ { "t": 0, "v": 100, "e": "expoOut" }, { "t": 2, "v": 700 } ] } },
            { "id": 2, "type": "Text", "text": "MOTION", "fontSize": 48 }
        ]
    }"##;

    #[test]
    fn reads_editor_project_files() {
        let project = Project::from_text(SAMPLE).expect("projet valide");
        assert_eq!(project.shapes.len(), 2);
        assert_eq!(project.duration, 4.0);
        assert_eq!(project.shapes[0].kind, "Circle");
        assert_eq!(project.shapes[0].keyframes["x"].len(), 2);
        assert_eq!(project.shapes[0].keyframes["x"][0].easing, "expoOut");
        assert_eq!(project.shapes[1].text, "MOTION");
        // Défauts identiques à l'éditeur.
        assert_eq!(project.shapes[1].font_family, DEFAULT_FONT);
        assert_eq!(project.shapes[1].opacity, 1.0);
    }

    #[test]
    fn missing_shapes_is_an_error() {
        assert!(Project::from_text("{}").is_err());
        assert!(Project::from_text(r#"{"shapes":{}}"#).is_err());
        assert!(Project::from_text("pas du json").is_err());
    }

    #[test]
    fn applies_easing_when_interpolating() {
        let project = Project::from_text(SAMPLE).expect("projet valide");
        let circle = &project.shapes[0];

        assert!((circle.value_at("x", 0.0) - 100.0).abs() < 1e-9);
        assert!((circle.value_at("x", 2.0) - 700.0).abs() < 1e-9);

        // expoOut est déjà très avancé à mi-course — c'est tout l'intérêt.
        let mid = circle.value_at("x", 1.0);
        assert!(mid > 600.0, "valeur à mi-course : {mid}");

        // Hors bornes : on tient la valeur des extrémités.
        assert!((circle.value_at("x", -5.0) - 100.0).abs() < 1e-9);
        assert!((circle.value_at("x", 99.0) - 700.0).abs() < 1e-9);
    }

    #[test]
    fn static_property_ignores_time() {
        let project = Project::from_text(SAMPLE).expect("projet valide");
        let text = &project.shapes[1];
        assert!((text.value_at("fontSize", 0.0) - 48.0).abs() < 1e-9);
        assert!((text.value_at("fontSize", 9.0) - 48.0).abs() < 1e-9);
    }

    #[test]
    fn round_trip_keeps_values_and_keyframes() {
        let project = Project::from_text(SAMPLE).expect("projet valide");
        let again = Project::from_text(&project.to_json()).expect("relu");
        assert_eq!(project, again);
    }

    #[test]
    fn stats_count_what_matters() {
        let stats = Project::from_text(SAMPLE).expect("projet valide").stats();
        assert_eq!(stats.shapes, 2);
        assert_eq!(stats.keyframes, 2);
        assert_eq!(stats.animated_shapes, 1);
        assert_eq!(stats.instants, 2);
        assert_eq!(stats.widest_property.as_ref().map(|w| w.1), Some(2));
    }

    #[test]
    fn unknown_easing_falls_back_to_linear() {
        let project = Project::from_text(
            r#"{"duration":2,"shapes":[{"id":1,"type":"Rect","keyframes":{"x":[{"t":0,"v":0,"e":"wat"},{"t":2,"v":100}]}}]}"#,
        )
        .expect("projet valide");
        assert_eq!(project.shapes[0].keyframes["x"][0].easing, easing::LINEAR);
        assert!((project.shapes[0].value_at("x", 1.0) - 50.0).abs() < 1e-9);
    }

    #[test]
    fn draw_order_follows_z_then_id() {
        let project = Project::from_text(
            r#"{"shapes":[{"id":3,"type":"Rect","z":5},{"id":1,"type":"Rect","z":0},{"id":2,"type":"Rect","z":0}]}"#,
        )
        .expect("projet valide");
        let ids: Vec<u32> = project.draw_order().iter().map(|s| s.id).collect();
        assert_eq!(ids, vec![1, 2, 3]);
    }
}
