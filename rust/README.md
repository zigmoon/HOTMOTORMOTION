# HOT MOTOR MOTION — moteur Rust

Cœur natif de l’éditeur : lecture du fichier projet, validation, interpolation
des courbes, image SVG à un instant donné, lecteur HTML autonome, et un serveur
statique pour la version web.

**Aucune dépendance externe** — ni `serde`, ni rien d’autre. Le JSON a son
propre lecteur/écrivain, donc `cargo test --offline` fonctionne sans registre,
sans réseau, sur une machine neuve.

## Contenu

```
rust/
├── Cargo.toml
├── crates/
│   ├── motion-core/          modèle, courbes, validation, SVG, HTML
│   │   └── src/
│   │       ├── json.rs       lecteur / écrivain JSON
│   │       ├── easing.rs     les 14 courbes de l’éditeur
│   │       ├── model.rs      Project, Shape, Keyframe, stats
│   │       ├── validate.rs   erreurs et avertissements
│   │       ├── svg.rs        rendu d’une image fixe
│   │       └── html.rs       lecteur autonome
│   └── motion-cli/           commande `motion-cli`
├── examples/sample.motion.json
└── scripts/
    ├── build.ps1             build/test Windows (MSVC ou MinGW)
    └── build.sh              build/test Unix
```

## Compiler

### Windows

```powershell
cd rust
./scripts/build.ps1
./scripts/build.ps1 -Release
```

Le script choisit le toolchain tout seul. Il faut savoir pourquoi : sous
Windows, un `link.exe` livré avec Git (ou MSYS) peut se trouver avant celui de
Visual Studio dans le `PATH`. Rust compile alors correctement puis échoue à
l’édition de liens avec un message qui parle d’options manquantes — rien à voir
avec le code. Le script vérifie donc que `link.exe` vient bien de Visual Studio ;
sinon il bascule sur MinGW-W64 avec `+stable-x86_64-pc-windows-gnu`.

Installer MinGW si besoin :

```powershell
winget install BrechtSanders.WinLibs.POSIX.UCRT
```

### Linux / macOS

```bash
cd rust
./scripts/build.sh
# ou
cargo test
cargo build --release
```

## CLI

```bash
motion-cli inspect  examples/sample.motion.json
motion-cli validate examples/sample.motion.json
motion-cli render   examples/sample.motion.json --at 1.2 -o frame.svg
motion-cli to-html  examples/sample.motion.json -o animation.html
motion-cli to-json  examples/sample.motion.json -o normalise.json
motion-cli serve    .. --port 8787
```

| Commande | Sortie |
|---|---|
| `inspect` | résumé : formes, images clés, instants, courbes utilisées, contrôle |
| `validate` | liste des anomalies ; code de sortie **1** s’il y a une erreur |
| `render` | SVG d’un instant (`--at`), échelle (`--scale`), repères (`--guides`) |
| `to-html` | lecteur autonome, sans dépendance |
| `to-json` | projet normalisé (défauts appliqués, images clés triées) |
| `serve` | serveur statique local, traversée de répertoire bloquée |

Avec `cargo run` :

```bash
cargo run -p motion-cli -- inspect examples/sample.motion.json
```

## API Rust

```rust
use motion_core::{html, model::Project, svg, validate};

let source = std::fs::read_to_string("doc.json")?;
let project = Project::from_text(&source)?;

for issue in validate::validate(&project) {
    println!("{} [{}] {}", issue.severity.label(), issue.code, issue.message);
}

let frame = svg::render(&project, &svg::SvgOptions { time: 1.5, ..Default::default() });
let player = html::standalone_html(&project);
let stats = project.stats();
# Ok::<(), Box<dyn std::error::Error>>(())
```

## Ce qui est fidèle, ce qui est approché

L’interpolation est **identique** à celle du navigateur : mêmes 14 courbes,
mêmes bornes, `{ t, v, e }` avec la courbe portée par l’image clé de départ.
Quatre tests verrouillent cet accord, parce que deux implémentations qui
divergent d’un demi-degré produisent deux animations différentes.

| Élément | SVG (Rust) | Lecteur HTML (Rust) |
|---|---|---|
| Rect, Circle, Text | oui | oui |
| Transformations (x, y, échelle, rotation, cisaillement) | oui | oui |
| Perspective `rotationX` / `rotationY` | approximation (facteur d’échelle) | idem éditeur |
| Flou, lueur | filtres SVG | identique au canvas |
| Teinte, saturation, luminosité, contraste | matrices SVG approchées | identique au canvas |
| SVG importé | cadre de remplacement (les données ne sont pas dans le fichier) | image data URL |
| Images | non | oui si `imageSrc` |

Le SVG sert à la vignette, au storyboard et au contrôle : il est net à toute
taille, mais ce n’est pas un export pixel-perfect du canvas. C’est écrit ici
plutôt que découvert à l’impression.

## Tests

```bash
cargo test --offline
```

47 tests : lecteur/écrivain JSON (échappements, paires de substitution,
nombres, ordre des clés), courbes (bornes, dépassement de l’amorti), modèle
(lecture du format éditeur, interpolation, aller-retour), validation (ids
doublons, types inconnus, images clés hors durée), SVG (échappement, ordre de
dessin, résolution des filtres) et l’exemple livré, qui doit rester valide.
