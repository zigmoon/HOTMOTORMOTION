//! Lecture et écriture JSON, sans dépendance externe.
//!
//! Le moteur échange exactement le format que produit l'éditeur
//! (`Sauvegarder` → `*.json`). Un `serde_json` complet serait plus court à
//! écrire, mais impose un registre et une version ; ici, `cargo test` compile
//! hors ligne, sur n'importe quelle machine, sans réseau.

use std::fmt;

/// Valeur JSON. Les objets gardent l'ordre des clés : un aller-retour
/// `parse` → `to_pretty` ne réordonne pas le fichier de l'utilisateur.
#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<Value>),
    Object(Vec<(String, Value)>),
}

impl Value {
    pub fn get(&self, key: &str) -> Option<&Value> {
        match self {
            Value::Object(entries) => entries.iter().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Value::Number(n) => Some(*n),
            Value::String(s) => s.trim().parse::<f64>().ok(),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::String(s) => Some(s.as_str()),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            Value::Bool(b) => Some(*b),
            _ => None,
        }
    }

    pub fn as_array(&self) -> Option<&[Value]> {
        match self {
            Value::Array(items) => Some(items.as_slice()),
            _ => None,
        }
    }

    pub fn is_object(&self) -> bool {
        matches!(self, Value::Object(_))
    }

    pub fn to_compact(&self) -> String {
        let mut out = String::new();
        write_compact(self, &mut out);
        out
    }

    pub fn to_pretty(&self) -> String {
        let mut out = String::new();
        write_pretty(self, &mut out, 0);
        out.push('\n');
        out
    }

    pub fn parse(text: &str) -> Result<Value, JsonError> {
        let mut parser = Parser {
            bytes: text.as_bytes(),
            pos: 0,
        };
        parser.skip_ws();
        let value = parser.parse_value()?;
        parser.skip_ws();
        if parser.pos != parser.bytes.len() {
            return Err(parser.error("texte inattendu après la fin du document"));
        }
        Ok(value)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct JsonError {
    pub message: String,
    pub offset: usize,
}

impl fmt::Display for JsonError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} (octet {})", self.message, self.offset)
    }
}

impl std::error::Error for JsonError {}

struct Parser<'a> {
    bytes: &'a [u8],
    pos: usize,
}

impl<'a> Parser<'a> {
    fn error(&self, message: &str) -> JsonError {
        JsonError {
            message: message.to_string(),
            offset: self.pos,
        }
    }

    fn peek(&self) -> Option<u8> {
        self.bytes.get(self.pos).copied()
    }

    fn skip_ws(&mut self) {
        while matches!(self.peek(), Some(b' ') | Some(b'\t') | Some(b'\n') | Some(b'\r')) {
            self.pos += 1;
        }
    }

    fn expect(&mut self, byte: u8, what: &str) -> Result<(), JsonError> {
        if self.peek() == Some(byte) {
            self.pos += 1;
            Ok(())
        } else {
            Err(self.error(what))
        }
    }

    fn parse_value(&mut self) -> Result<Value, JsonError> {
        match self.peek() {
            Some(b'{') => self.parse_object(),
            Some(b'[') => self.parse_array(),
            Some(b'"') => Ok(Value::String(self.parse_string()?)),
            Some(b't') => self.parse_literal("true", Value::Bool(true)),
            Some(b'f') => self.parse_literal("false", Value::Bool(false)),
            Some(b'n') => self.parse_literal("null", Value::Null),
            Some(b'-') | Some(b'0'..=b'9') => self.parse_number(),
            Some(_) => Err(self.error("valeur JSON invalide")),
            None => Err(self.error("document vide ou tronqué")),
        }
    }

    fn parse_literal(&mut self, literal: &str, value: Value) -> Result<Value, JsonError> {
        let end = self.pos + literal.len();
        if end <= self.bytes.len() && &self.bytes[self.pos..end] == literal.as_bytes() {
            self.pos = end;
            Ok(value)
        } else {
            Err(self.error("littéral JSON invalide"))
        }
    }

    fn parse_object(&mut self) -> Result<Value, JsonError> {
        self.expect(b'{', "objet attendu")?;
        let mut entries = Vec::new();
        self.skip_ws();

        if self.peek() == Some(b'}') {
            self.pos += 1;
            return Ok(Value::Object(entries));
        }

        loop {
            self.skip_ws();
            let key = self.parse_string()?;
            self.skip_ws();
            self.expect(b':', "« : » attendu après une clé")?;
            self.skip_ws();
            let value = self.parse_value()?;
            entries.push((key, value));
            self.skip_ws();
            match self.peek() {
                Some(b',') => {
                    self.pos += 1;
                }
                Some(b'}') => {
                    self.pos += 1;
                    break;
                }
                _ => return Err(self.error("« , » ou « } » attendu")),
            }
        }

        Ok(Value::Object(entries))
    }

    fn parse_array(&mut self) -> Result<Value, JsonError> {
        self.expect(b'[', "tableau attendu")?;
        let mut items = Vec::new();
        self.skip_ws();

        if self.peek() == Some(b']') {
            self.pos += 1;
            return Ok(Value::Array(items));
        }

        loop {
            self.skip_ws();
            items.push(self.parse_value()?);
            self.skip_ws();
            match self.peek() {
                Some(b',') => {
                    self.pos += 1;
                }
                Some(b']') => {
                    self.pos += 1;
                    break;
                }
                _ => return Err(self.error("« , » ou « ] » attendu")),
            }
        }

        Ok(Value::Array(items))
    }

    fn parse_string(&mut self) -> Result<String, JsonError> {
        self.expect(b'"', "chaîne attendue")?;
        let mut out = String::new();

        loop {
            let start = self.pos;
            while let Some(byte) = self.peek() {
                if byte == b'"' || byte == b'\\' {
                    break;
                }
                if byte < 0x20 {
                    return Err(self.error("caractère de contrôle dans une chaîne"));
                }
                self.pos += 1;
            }

            if self.pos > start {
                // Les octets proviennent d'une `&str` valide : la tranche l'est
                // aussi, sauf si elle coupe un caractère multi-octets — ce qui
                // ne peut pas arriver ici, on s'arrête sur `"` ou `\` (ASCII).
                match std::str::from_utf8(&self.bytes[start..self.pos]) {
                    Ok(chunk) => out.push_str(chunk),
                    Err(_) => return Err(self.error("chaîne UTF-8 invalide")),
                }
            }

            match self.peek() {
                Some(b'"') => {
                    self.pos += 1;
                    return Ok(out);
                }
                Some(b'\\') => {
                    self.pos += 1;
                    let escape = self.peek().ok_or_else(|| self.error("échappement incomplet"))?;
                    self.pos += 1;
                    match escape {
                        b'"' => out.push('"'),
                        b'\\' => out.push('\\'),
                        b'/' => out.push('/'),
                        b'b' => out.push('\u{8}'),
                        b'f' => out.push('\u{c}'),
                        b'n' => out.push('\n'),
                        b'r' => out.push('\r'),
                        b't' => out.push('\t'),
                        b'u' => {
                            let first = self.parse_hex4()?;
                            let code = if (0xD800..0xDC00).contains(&first) {
                                // Paire de substitution : deux \uXXXX pour un seul caractère.
                                if self.peek() == Some(b'\\')
                                    && self.bytes.get(self.pos + 1) == Some(&b'u')
                                {
                                    self.pos += 2;
                                    let second = self.parse_hex4()?;
                                    if (0xDC00..0xE000).contains(&second) {
                                        0x10000
                                            + ((first - 0xD800) << 10)
                                            + (second - 0xDC00)
                                    } else {
                                        return Err(self.error("paire de substitution invalide"));
                                    }
                                } else {
                                    return Err(self.error("paire de substitution incomplète"));
                                }
                            } else {
                                first
                            };
                            match char::from_u32(code) {
                                Some(ch) => out.push(ch),
                                None => return Err(self.error("point de code invalide")),
                            }
                        }
                        _ => return Err(self.error("échappement inconnu")),
                    }
                }
                _ => return Err(self.error("chaîne non terminée")),
            }
        }
    }

    fn parse_hex4(&mut self) -> Result<u32, JsonError> {
        if self.pos + 4 > self.bytes.len() {
            return Err(self.error("\\u tronqué"));
        }
        let mut value = 0u32;
        for _ in 0..4 {
            let byte = self.bytes[self.pos];
            let digit = match byte {
                b'0'..=b'9' => (byte - b'0') as u32,
                b'a'..=b'f' => (byte - b'a' + 10) as u32,
                b'A'..=b'F' => (byte - b'A' + 10) as u32,
                _ => return Err(self.error("chiffre hexadécimal attendu")),
            };
            value = value * 16 + digit;
            self.pos += 1;
        }
        Ok(value)
    }

    fn parse_number(&mut self) -> Result<Value, JsonError> {
        let start = self.pos;
        while matches!(
            self.peek(),
            Some(b'-') | Some(b'+') | Some(b'.') | Some(b'e') | Some(b'E') | Some(b'0'..=b'9')
        ) {
            self.pos += 1;
        }
        let raw = std::str::from_utf8(&self.bytes[start..self.pos])
            .map_err(|_| self.error("nombre invalide"))?;
        raw.parse::<f64>()
            .map(Value::Number)
            .map_err(|_| self.error("nombre invalide"))
    }
}

fn write_compact(value: &Value, out: &mut String) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(true) => out.push_str("true"),
        Value::Bool(false) => out.push_str("false"),
        Value::Number(_) => write_number(value, out),
        Value::String(text) => write_string(text, out),
        Value::Array(items) => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_compact(item, out);
            }
            out.push(']');
        }
        Value::Object(entries) => {
            out.push('{');
            for (index, (key, item)) in entries.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_string(key, out);
                out.push(':');
                write_compact(item, out);
            }
            out.push('}');
        }
    }
}

fn write_pretty(value: &Value, out: &mut String, depth: usize) {
    let pad = |out: &mut String, depth: usize| {
        for _ in 0..depth {
            out.push_str("  ");
        }
    };

    match value {
        Value::Array(items) if !items.is_empty() => {
            out.push_str("[\n");
            for (index, item) in items.iter().enumerate() {
                pad(out, depth + 1);
                write_pretty(item, out, depth + 1);
                if index + 1 < items.len() {
                    out.push(',');
                }
                out.push('\n');
            }
            pad(out, depth);
            out.push(']');
        }
        Value::Object(entries) if !entries.is_empty() => {
            out.push_str("{\n");
            for (index, (key, item)) in entries.iter().enumerate() {
                pad(out, depth + 1);
                write_string(key, out);
                out.push_str(": ");
                write_pretty(item, out, depth + 1);
                if index + 1 < entries.len() {
                    out.push(',');
                }
                out.push('\n');
            }
            pad(out, depth);
            out.push('}');
        }
        _ => write_compact(value, out),
    }
}

fn write_number(value: &Value, out: &mut String) {
    let number = match value {
        Value::Number(n) => *n,
        _ => 0.0,
    };
    if !number.is_finite() {
        out.push('0');
    } else if number == number.trunc() && number.abs() < 1e15 {
        out.push_str(&(number as i64).to_string());
    } else {
        // `{}` sur f64 donne la représentation la plus courte qui revient
        // exactement à la même valeur : 0.1 reste 0.1, pas 0.10000000000000001.
        out.push_str(&number.to_string());
    }
}

fn write_string(text: &str, out: &mut String) {
    out.push('"');
    for ch in text.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_nested_document() {
        let value = Value::parse(r#"{"a":[1,2.5,-3e2],"b":{"c":true,"d":null},"e":"x"}"#)
            .expect("document valide");
        assert_eq!(value.get("a").and_then(Value::as_array).map(<[Value]>::len), Some(3));
        assert_eq!(value.get("b").and_then(|b| b.get("c")).and_then(Value::as_bool), Some(true));
        assert_eq!(value.get("e").and_then(Value::as_str), Some("x"));
    }

    #[test]
    fn decodes_escapes_and_surrogates() {
        let value = Value::parse(r#"{"t":"a\"b\\c\u00e9\uD83D\uDE00"}"#).expect("échappements");
        assert_eq!(value.get("t").and_then(Value::as_str), Some("a\"b\\cé😀"));
    }

    #[test]
    fn rejects_truncated_input() {
        assert!(Value::parse("{\"a\":1").is_err());
        assert!(Value::parse("[1,2,,]").is_err());
        assert!(Value::parse("").is_err());
    }

    #[test]
    fn round_trips_numbers_without_noise() {
        let value = Value::parse(r#"{"a":400,"b":0.1,"c":-2.5,"d":1e-7}"#).expect("nombres");
        let compact = value.to_compact();
        assert_eq!(compact, r#"{"a":400,"b":0.1,"c":-2.5,"d":0.0000001}"#);
        assert_eq!(Value::parse(&compact).expect("relu"), value);
    }

    #[test]
    fn keeps_key_order() {
        let value = Value::parse(r#"{"z":1,"a":2,"m":3}"#).expect("ordre");
        let keys: Vec<&str> = match &value {
            Value::Object(entries) => entries.iter().map(|(k, _)| k.as_str()).collect(),
            _ => Vec::new(),
        };
        assert_eq!(keys, vec!["z", "a", "m"]);
    }

    #[test]
    fn pretty_output_is_reparsable() {
        let value = Value::parse(r#"{"a":[{"t":0,"v":1},{"t":1,"v":2}],"b":[]}"#).expect("projet");
        let pretty = value.to_pretty();
        assert_eq!(Value::parse(&pretty).expect("relu"), value);
        assert!(pretty.contains("\n  \"a\": ["));
    }
}
