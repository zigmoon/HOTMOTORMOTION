#!/usr/bin/env bash
# Compile et teste le moteur Rust de HOT MOTOR MOTION sous Linux / macOS.
set -euo pipefail

cd "$(dirname "$0")/.."

release=""
if [[ "${1:-}" == "--release" ]]; then
  release="--release"
fi

echo "Moteur HOT MOTOR MOTION — $(rustc --version)"
cargo test --offline $release
cargo build --offline $release

echo
echo "Binaire : rust/target/release/motion-cli"
if [[ -z "$release" ]]; then
  echo "Binaire : rust/target/debug/motion-cli"
  ./target/debug/motion-cli inspect examples/sample.motion.json
else
  ./target/release/motion-cli inspect examples/sample.motion.json
fi
