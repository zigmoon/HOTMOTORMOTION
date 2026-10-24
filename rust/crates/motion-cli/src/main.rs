//! `motion-cli` — ligne de commande du moteur HOT MOTOR MOTION.
//!
//! ```text
//! motion-cli inspect <projet.json>
//! motion-cli validate <projet.json>
//! motion-cli render <projet.json> [--at 1.5] [--scale 2] [--guides] [-o image.svg]
//! motion-cli to-html <projet.json> [-o animation.html]
//! motion-cli to-json <projet.json> [-o normalise.json]
//! motion-cli serve [dossier] [--port 8787]
//! ```

use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use motion_core::easing;
use motion_core::html;
use motion_core::model::Project;
use motion_core::svg::{self, SvgOptions};
use motion_core::validate::{self, Severity};

const HELP: &str = "\
HOT MOTOR MOTION — moteur natif

USAGE
  motion-cli inspect  <projet.json>
  motion-cli validate <projet.json>
  motion-cli render   <projet.json> [--at <s>] [--scale <n>] [--guides] [-o <fichier.svg>]
  motion-cli to-html  <projet.json> [-o <fichier.html>]
  motion-cli to-json  <projet.json> [-o <fichier.json>]
  motion-cli serve    [dossier] [--port <n>]

EXEMPLES
  motion-cli inspect examples/sample.motion.json
  motion-cli render examples/sample.motion.json --at 1.2 -o frame.svg
  motion-cli to-html examples/sample.motion.json -o demo.html
  motion-cli serve .. --port 8787
";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();

    if args.is_empty() || matches!(args[0].as_str(), "-h" | "--help" | "help") {
        print!("{HELP}");
        return ExitCode::SUCCESS;
    }

    if matches!(args[0].as_str(), "-V" | "--version" | "version") {
        println!("motion-cli {}", env!("CARGO_PKG_VERSION"));
        return ExitCode::SUCCESS;
    }

    let command = args[0].as_str();
    let rest = &args[1..];

    let result = match command {
        "inspect" => command_inspect(rest),
        "validate" => command_validate(rest),
        "render" => command_render(rest),
        "to-html" => command_to_html(rest),
        "to-json" => command_to_json(rest),
        "serve" => command_serve(rest),
        other => Err(format!("commande inconnue : « {other} ». Voir --help.")),
    };

    match result {
        Ok(code) => code,
        Err(message) => {
            eprintln!("motion-cli : {message}");
            ExitCode::from(2)
        }
    }
}

// ── Arguments ───────────────────────────────────────────────────────────────

struct Options {
    input: PathBuf,
    output: Option<PathBuf>,
    at: Option<f64>,
    scale: f64,
    guides: bool,
}

fn parse_options(args: &[String], allow_time: bool) -> Result<Options, String> {
    let mut input: Option<PathBuf> = None;
    let mut output = None;
    let mut at = None;
    let mut scale = 1.0;
    let mut guides = false;

    let mut index = 0;
    while index < args.len() {
        let arg = args[index].as_str();
        match arg {
            "-o" | "--out" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "« -o » attend un chemin de fichier".to_string())?;
                output = Some(PathBuf::from(value));
            }
            "--at" if allow_time => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "« --at » attend un instant en secondes".to_string())?;
                at = Some(
                    value
                        .parse::<f64>()
                        .map_err(|_| format!("instant invalide : « {value} »"))?,
                );
            }
            "--scale" if allow_time => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "« --scale » attend un nombre".to_string())?;
                scale = value
                    .parse::<f64>()
                    .map_err(|_| format!("échelle invalide : « {value} »"))?;
                if !(scale > 0.0 && scale <= 16.0) {
                    return Err("l'échelle doit être comprise entre 0 et 16".to_string());
                }
            }
            "--guides" if allow_time => guides = true,
            other if other.starts_with('-') => {
                return Err(format!("option inconnue : « {other} »"));
            }
            other => {
                if input.is_some() {
                    return Err(format!("argument en trop : « {other} »"));
                }
                input = Some(PathBuf::from(other));
            }
        }
        index += 1;
    }

    let input = input.ok_or_else(|| "fichier projet manquant".to_string())?;

    Ok(Options {
        input,
        output,
        at,
        scale,
        guides,
    })
}

fn load(path: &Path) -> Result<Project, String> {
    let source = fs::read_to_string(path)
        .map_err(|error| format!("lecture impossible de {} : {error}", path.display()))?;
    Project::from_text(&source).map_err(|error| format!("{} : {error}", path.display()))
}

fn write_output(output: &Option<PathBuf>, content: &str) -> Result<(), String> {
    match output {
        Some(path) => {
            fs::write(path, content)
                .map_err(|error| format!("écriture impossible de {} : {error}", path.display()))?;
            let size = content.len();
            println!("{} — {} octets", path.display(), size);
        }
        None => print!("{content}"),
    }
    Ok(())
}

// ── Commandes ───────────────────────────────────────────────────────────────

fn command_inspect(args: &[String]) -> Result<ExitCode, String> {
    let options = parse_options(args, false)?;
    let project = load(&options.input)?;
    let stats = project.stats();
    let issues = validate::validate(&project);

    println!("Projet      {}", project.name);
    println!("Format      {} (v{})", project.app, project.version);
    println!(
        "Canvas      {} × {}",
        svg::fmt(project.canvas.width),
        svg::fmt(project.canvas.height)
    );
    println!("Durée       {:.2} s", stats.duration);
    println!("Fond        {}", project.bg_color);
    println!();
    println!("Formes      {}", stats.shapes);
    println!("Animées     {}", stats.animated_shapes);
    println!("Images clés {}", stats.keyframes);
    println!("Instants    {}", stats.instants);

    if let Some((prop, count, id)) = &stats.widest_property {
        println!("Plus dense  {prop} — {count} images clés (forme {id})");
    }

    let mut curves: Vec<&str> = project
        .shapes
        .iter()
        .flat_map(|shape| shape.keyframes.values().flatten())
        .map(|key| key.easing.as_str())
        .collect();
    curves.sort_unstable();
    curves.dedup();
    if !curves.is_empty() {
        let labels: Vec<String> = curves
            .iter()
            .map(|name| format!("{name} ({})", easing::label(name)))
            .collect();
        println!("Courbes     {}", labels.join(", "));
    }

    if !project.shapes.is_empty() {
        println!("\nFormes :");
        for shape in &project.shapes {
            let animated = shape.animated_properties();
            let suffix = if animated.is_empty() {
                "statique".to_string()
            } else {
                format!("animé : {}", animated.join(", "))
            };
            println!(
                "  #{:<3} {:<6} {:<22} {}",
                shape.id,
                shape.kind,
                truncate(&shape.name, 22),
                suffix
            );
        }
    }

    let errors = issues.iter().filter(|i| i.severity == Severity::Error).count();
    let warnings = issues.len() - errors;
    println!("\nContrôle    {errors} erreur(s), {warnings} avertissement(s)");

    Ok(ExitCode::SUCCESS)
}

fn command_validate(args: &[String]) -> Result<ExitCode, String> {
    let options = parse_options(args, false)?;
    let project = load(&options.input)?;
    let issues = validate::validate(&project);

    if issues.is_empty() {
        println!("{} : aucun problème détecté.", options.input.display());
        return Ok(ExitCode::SUCCESS);
    }

    for issue in &issues {
        let location = issue
            .shape
            .map(|id| format!(" (forme {id})"))
            .unwrap_or_default();
        println!(
            "{:<13} {:<18} {}{}",
            issue.severity.label(),
            issue.code,
            issue.message,
            location
        );
    }

    let errors = issues.iter().filter(|i| i.severity == Severity::Error).count();
    let warnings = issues.len() - errors;
    println!("\n{errors} erreur(s), {warnings} avertissement(s).");

    Ok(if validate::has_errors(&issues) {
        ExitCode::from(1)
    } else {
        ExitCode::SUCCESS
    })
}

fn command_render(args: &[String]) -> Result<ExitCode, String> {
    let options = parse_options(args, true)?;
    let project = load(&options.input)?;

    let frame = svg::render(
        &project,
        &SvgOptions {
            time: options.at.unwrap_or(0.0),
            scale: options.scale,
            transparent: false,
            guides: options.guides,
        },
    );

    write_output(&options.output, &frame)?;
    Ok(ExitCode::SUCCESS)
}

fn command_to_html(args: &[String]) -> Result<ExitCode, String> {
    let options = parse_options(args, false)?;
    let project = load(&options.input)?;
    let document = html::standalone_html(&project);
    write_output(&options.output, &document)?;
    Ok(ExitCode::SUCCESS)
}

fn command_to_json(args: &[String]) -> Result<ExitCode, String> {
    let options = parse_options(args, false)?;
    let project = load(&options.input)?;
    let normalized = project.to_json();
    write_output(&options.output, &normalized)?;

    if validate::has_errors(&validate::validate(&project)) {
        eprintln!("attention : le projet contient des erreurs ; voir `motion-cli validate`.");
    }

    Ok(ExitCode::SUCCESS)
}

fn command_serve(args: &[String]) -> Result<ExitCode, String> {
    let mut root = PathBuf::from(".");
    let mut port: u16 = 8787;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--port" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "« --port » attend un numéro".to_string())?;
                port = value
                    .parse::<u16>()
                    .map_err(|_| format!("port invalide : « {value} »"))?;
            }
            other if other.starts_with('-') => {
                return Err(format!("option inconnue : « {other} »"));
            }
            other => root = PathBuf::from(other),
        }
        index += 1;
    }

    let root = fs::canonicalize(&root)
        .map_err(|error| format!("dossier introuvable {} : {error}", root.display()))?;

    let listener = TcpListener::bind(("127.0.0.1", port))
        .map_err(|error| format!("impossible d'écouter sur le port {port} : {error}"))?;

    println!("HOT MOTOR MOTION — {}", root.display());
    println!("http://127.0.0.1:{port}/index.html");
    println!("Ctrl+C pour arrêter.");

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let root = root.clone();
                std::thread::spawn(move || {
                    if let Err(error) = serve_connection(stream, &root) {
                        eprintln!("connexion : {error}");
                    }
                });
            }
            Err(error) => eprintln!("connexion refusée : {error}"),
        }
    }

    Ok(ExitCode::SUCCESS)
}

// ── Serveur statique ────────────────────────────────────────────────────────

fn serve_connection(mut stream: TcpStream, root: &Path) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;

    // On vide les en-têtes : les ignorer est sans risque pour un serveur local.
    loop {
        let mut header = String::new();
        if reader.read_line(&mut header)? == 0 || header == "\r\n" || header == "\n" {
            break;
        }
    }

    let path = request_line.split_whitespace().nth(1).unwrap_or("/");
    let decoded = percent_decode(path.split(['?', '#']).next().unwrap_or("/"));

    let relative = decoded.trim_start_matches('/');
    let relative = if relative.is_empty() || relative.ends_with('/') {
        format!("{relative}index.html")
    } else {
        relative.to_string()
    };

    // Traversée de répertoire : on résout puis on vérifie que le chemin reste
    // sous la racine servie.
    let candidate = root.join(&relative);
    let resolved = match candidate.canonicalize() {
        Ok(path) => path,
        Err(_) => return respond(&mut stream, 404, "text/plain; charset=utf-8", b"404"),
    };

    if !resolved.starts_with(root) {
        return respond(&mut stream, 403, "text/plain; charset=utf-8", b"403");
    }

    let mut file = match fs::File::open(&resolved) {
        Ok(file) => file,
        Err(_) => return respond(&mut stream, 404, "text/plain; charset=utf-8", b"404"),
    };

    let mut body = Vec::new();
    file.read_to_end(&mut body)?;

    let mime = mime_for(&resolved);
    respond(&mut stream, 200, mime, &body)
}

fn respond(stream: &mut TcpStream, status: u16, mime: &str, body: &[u8]) -> std::io::Result<()> {
    let reason = match status {
        200 => "OK",
        403 => "Forbidden",
        _ => "Not Found",
    };

    let header = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        body.len()
    );

    stream.write_all(header.as_bytes())?;
    stream.write_all(body)?;
    stream.flush()
}

fn mime_for(path: &Path) -> &'static str {
    match path.extension().and_then(|ext| ext.to_str()).unwrap_or("") {
        "html" | "htm" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" | "map" => "application/json; charset=utf-8",
        "webmanifest" => "application/manifest+json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "ico" => "image/x-icon",
        "txt" => "text/plain; charset=utf-8",
        "xml" => "application/xml; charset=utf-8",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "webm" => "video/webm",
        "mp4" => "video/mp4",
        _ => "application/octet-stream",
    }
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[index + 1..index + 3]).unwrap_or("");
            if let Ok(value) = u8::from_str_radix(hex, 16) {
                out.push(value);
                index += 3;
                continue;
            }
        }
        out.push(bytes[index]);
        index += 1;
    }

    String::from_utf8_lossy(&out).to_string()
}

fn truncate(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_string();
    }
    let mut out: String = text.chars().take(max.saturating_sub(1)).collect();
    out.push('…');
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_percent_escapes() {
        assert_eq!(percent_decode("/a%20b.js"), "/a b.js");
        assert_eq!(percent_decode("/plain"), "/plain");
        assert_eq!(percent_decode("/bad%ZZ"), "/bad%ZZ");
    }

    #[test]
    fn maps_mime_types() {
        assert_eq!(mime_for(Path::new("a.html")), "text/html; charset=utf-8");
        assert_eq!(mime_for(Path::new("a.js")), "text/javascript; charset=utf-8");
        assert_eq!(mime_for(Path::new("a.unknown")), "application/octet-stream");
    }

    #[test]
    fn truncates_on_char_boundaries() {
        assert_eq!(truncate("court", 10), "court");
        assert_eq!(truncate("beaucoup trop long", 8), "beaucou…");
        assert_eq!(truncate("éééééé", 3), "éé…");
    }

    #[test]
    fn parses_render_options() {
        let args: Vec<String> = ["file.json", "--at", "1.5", "--scale", "2", "--guides", "-o", "out.svg"]
            .iter()
            .map(|s| s.to_string())
            .collect();
        let options = parse_options(&args, true).expect("options valides");
        assert_eq!(options.input, PathBuf::from("file.json"));
        assert_eq!(options.at, Some(1.5));
        assert_eq!(options.scale, 2.0);
        assert!(options.guides);
        assert_eq!(options.output, Some(PathBuf::from("out.svg")));
    }

    #[test]
    fn rejects_time_options_without_time_support() {
        let args: Vec<String> = ["file.json", "--at", "1"]
            .iter()
            .map(|s| s.to_string())
            .collect();
        assert!(parse_options(&args, false).is_err());
    }
}
