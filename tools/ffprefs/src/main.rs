// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Basics
// ------
// Any pref defined in one of the files included here should *not* be defined
// in a data file such as all.js; that would just be useless duplication.
//
// (Except under unusual circumstances where the value defined here must be
// overridden, e.g. for some Thunderbird prefs. In those cases the default
// value from the data file will override the static default value defined
// here.)
//
// Please follow the existing prefs naming convention when considering adding a
// new pref, and don't create a new pref group unless it's appropriate and there
// are likely to be multiple prefs within that group. (If you do, you'll need to
// update the `pref_groups` variable in modules/libpref/moz.build.)
//
// Definitions
// -----------
// A pref definition looks like this:
//
//   - name: <pref-name>                                 // mandatory
//     cpptype: <cpp-type>                               // mandatory if static
//     value: <default-value>                            // mandatory
//     mirror: <never | once | always>                   // mandatory if static
//     lang: <static | rust | dynamic>                   // optional
//     condition: <condition>                            // optional
//     locked: <true | false>.                           // optional only on dynamic prefs
//     sticky: <true | false>                            // optional only on dynamic prefs
//
// - `name` is the name of the pref, without double-quotes, as it appears
//   in about:config. It is used in most libpref API functions (from both C++
//   and JS code).
//
// - `cpptype` is one of `bool`, `int32_t`, `uint32_t`, `float`, an atomic version
//   of one of those, `String` or `DataMutexString`. Note that float prefs are
//   stored internally as strings. The C++ preprocessor doesn't like template
//   syntax in a macro argument, so use the typedefs defined in
//   StaticPrefsBase.h; for example, use `RelaxedAtomicBool` instead of
//   `Atomic<bool, Relaxed>`.
//
// - `value` is the default value. Its type should be appropriate for
//   <cpp-type>, otherwise the generated code will fail to compile. A complex
//   C++ numeric expressions like `60 * 60` (which the YAML parser cannot treat
//   as an integer or float) is treated as a string and passed through without
//   change, which is useful.
//
// - `mirror` indicates how the pref value is mirrored into a C++ variable.
//
//   * `never`: There is no C++ mirror variable. The pref value can only be
//     accessed via the standard libpref API functions.
//
//   * `once`: The pref value is mirrored into a variable at startup; the
//     mirror variable is left unchanged after that. (The exact point at which
//     all `once` mirror variables are set is when the first `once` mirror
//     variable is accessed, via its getter function.) This is mostly useful for
//     graphics prefs where we often don't want a new pref value to apply until
//     restart. Otherwise, this update policy is best avoided because its
//     behaviour can cause confusion and bugs.
//
//   * `always`: The mirror variable is always kept in sync with the pref value.
//     This is the most common choice.
//
//   When a mirror variable is present, a getter will be created that can access
//   it. Using the getter function to read the pref's value has the two
//   following advantages over the normal API functions.
//
//   * A direct variable access is faster than a hash table lookup.
//
//   * A mirror variable can be accessed off the main thread. If a pref *is*
//     accessed off the main thread, it should have an atomic type. Assertions
//     enforce this.
//
//   Note that Rust code must access the mirror variable directly, rather than
//   via the getter function.
//
// - `lang=rust` indicates if the mirror variable is used by Rust code. If so, it
//   will be usable via the `static_prefs::pref!` macro, e.g.
//   `static_prefs::pref!("layout.css.cross-fade.enabled")`.
//
// - `condition` is an optional condition that must be true for the pref to be
//   defined. It is a C++ expression that can use any global variable or macro
//   defined in the C++ code, such as `MOZ_WIDGET_GTK` or `XP_MACOS`.
//
//   example: condition: "defined(XP_MACOS) || defined(MOZ_WIDGET_GTK)"
//
// - `locked` is an optional boolean that indicates whether the pref is locked
//   (i.e., cannot be changed by the user). If set to `true`, the pref will
//   be locked in the generated code, and the user will not be able
//   to change it in about:config.
//
// The getter function's base name is the same as the pref's name, but with
// '.' or '-' chars converted to '_', to make a valid identifier. For example,
// the getter for `foo.bar_baz` is `foo_bar_baz()`. This is ugly but clear,
// and you can search for both the pref name and the getter using the regexp
// /foo.bar.baz/. Suffixes are added as follows:
//
// - If the `mirror` value is `once`, `_AtStartup` is appended, to indicate the
//   value was obtained at startup.
//

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::PathBuf;

const STATIC_PREFS: &str = "../engine/modules/libpref/init/zen-static-prefs.inc";
const FIREFOX_PREFS: &str = "../engine/browser/app/profile/firefox.js";
const DYNAMIC_PREFS: &str = "../engine/browser/app/profile/zen.js";

#[derive(Serialize, Deserialize, PartialEq, Debug)]
struct Preference {
    name: String,
    value: String,
    r#type: Option<String>,
    condition: Option<String>,
    hidden: Option<bool>,
    cpptype: Option<String>,
    mirror: Option<String>,
    locked: Option<bool>,
    sticky: Option<bool>,
}

fn get_config_path() -> PathBuf {
    let mut path = env::current_dir().expect("Failed to get current directory");
    path.push("prefs");
    path
}

fn ordered_prefs(mut prefs: Vec<Preference>) -> Vec<Preference> {
    // Sort preferences by name
    prefs.sort_by(|a, b| a.name.cmp(&b.name));
    prefs
}

fn get_prefs_files_recursively(dir: &PathBuf, files: &mut Vec<PathBuf>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_dir() {
                    get_prefs_files_recursively(&path, files);
                } else if let Some(ext) = path.extension() {
                    if ext == "yaml" || ext == "yml" {
                        files.push(path);
                    }
                }
            }
        }
    }
}

fn load_preferences() -> Vec<Preference> {
    let mut prefs = Vec::new();
    let config_path = get_config_path();
    let mut pref_files = Vec::new();
    get_prefs_files_recursively(&config_path, &mut pref_files);
    for file_path in pref_files {
        let content = fs::read_to_string(&file_path).expect("Failed to read file");
        let mut parsed_prefs: Vec<Preference> =
            serde_yaml::from_str(&content).expect("Failed to parse YAML");
        prefs.append(&mut parsed_prefs);
    }
    ordered_prefs(prefs)
}

fn get_condition_string(condition: &Option<String>) -> String {
    condition
        .as_deref()
        .map_or_else(String::new, |cond| cond.trim().to_string())
}

fn get_pref_with_condition(content: &str, condition: &str) -> String {
    if condition.is_empty() {
        return format!("\n{}", content);
    }
    format!("\n#if {}\n{}#endif", condition, content)
}

fn get_static_pref(pref: &Preference) -> String {
    // - name: <pref-name>                                 # mandatory
    //   type: <cpp-type>                                  # mandatory
    //   value: <default-value>                            # mandatory
    //   mirror: <never | once | always>                   # mandatory
    //   do_not_use_directly: <true | false>               # optional
    //   include: <header-file>                            # optional
    //   rust: <true | false>                              # optional
    //   set_spidermonkey_pref: <false | startup | always> # optional
    // We do not hide preferences in static prefs, so we ignore the `hidden` field.
    let name = format!("- name: {}\n", pref.name);
    let cpp_type = format!(
        "  type: {}\n",
        pref.cpptype
            .as_deref()
            .expect("cpp type is mandatory on static prefs")
    );
    let value = format!("  value: {}\n", pref.value);
    let rust = if pref.r#type.as_deref() == Some("rust") {
        "  rust: true\n".to_string()
    } else {
        "  rust: false\n".to_string()
    };
    let mirror = format!(
        "  mirror: {}\n",
        pref.mirror
            .as_deref()
            .expect("mirror is mandatory on static prefs")
    );
    let content = format!("{}{}{}{}{}", name, cpp_type, value, mirror, rust);
    get_pref_with_condition(&content, &get_condition_string(&pref.condition))
}

fn get_dynamic_pref(pref: &Preference) -> String {
    let value = get_value(pref);
    if pref.hidden.unwrap_or(false) {
        return format!("# Hidden preference: {} = {}", pref.name, value);
    }
    let third_arg;
    let is_locked = pref.locked.unwrap_or(false);
    let is_sticky = pref.sticky.unwrap_or(false);
    if is_locked && is_sticky {
        panic!("A dynamic pref cannot be both locked and sticky");
    } else if is_locked {
        third_arg = ", locked".to_string();
    } else if is_sticky {
        third_arg = ", sticky".to_string();
    } else {
        third_arg = String::new();
    }
    // note: Dont use "value" here, as it adds quotes around the value
    if pref.value == "@cond" {
        // If the value is "@cond", we assume it is a placeholder for a condition
        // that will be replaced later, so we do not include it in the pref definition.
        return get_pref_with_condition(
            &format!(
                "pref(\"{}\", true);\n#else\npref(\"{}\", false);\n",
                pref.name, pref.name
            ),
            &get_condition_string(&pref.condition),
        );
    }
    get_pref_with_condition(
        &format!("pref(\"{}\", {}{});\n", pref.name, value, third_arg),
        &get_condition_string(&pref.condition),
    )
}

fn get_value(pref: &Preference) -> String {
    // Strings must be wrapped inside double quotes
    let value = &pref.value;
    // Other values such as numbers or booleans can be used directly
    // If the value is empty or there are any characters that could be misinterpreted,
    // we should wrap it in double quotes.
    let letters_inside_value =
        value.chars().any(|c| c.is_alphabetic() || c == '.') && value != "true" && value != "false";
    if value.is_empty() || value.contains([' ', '\n', '\t', '"']) || letters_inside_value {
        format!("\"{}\"", value.replace('"', "\\\""))
    } else {
        value.to_string()
    }
}

fn write_preferences(prefs: &[Preference]) {
    let config_path = get_config_path();
    if !config_path.exists() {
        fs::create_dir_all(&config_path).expect("Failed to create prefs directory");
    }

    let static_prefs_path = config_path.join(STATIC_PREFS);
    let dynamic_prefs_path = config_path.join(DYNAMIC_PREFS);
    println!(
        "Writing preferences to:\n  Static: {}\n  Dynamic: {}",
        static_prefs_path.display(),
        dynamic_prefs_path.display()
    );
    let mut static_content = String::new();
    let mut dynamic_content = String::new();
    for pref in prefs {
        let ty = pref.r#type.as_deref().unwrap_or("");
        if ty == "static" || ty == "rust" {
            let content = get_static_pref(pref);
            static_content.push_str(&content);
        }
        let content = get_dynamic_pref(pref);
        dynamic_content.push_str(&content);
    }

    // Create files if they do not exist
    if !static_prefs_path.exists() {
        fs::File::create(&static_prefs_path).expect("Failed to create static prefs file");
    }
    if !dynamic_prefs_path.exists() {
        fs::File::create(&dynamic_prefs_path).expect("Failed to create dynamic prefs file");
    }

    fs::write(&static_prefs_path, static_content).expect("Failed to write static prefs");
    fs::write(&dynamic_prefs_path, dynamic_content).expect("Failed to write dynamic prefs");
}

fn prepare_zen_prefs() {
    // Add `#include zen.js` to the bottom of the firefox.js file if it doesn't exist
    let line = "#include zen.js";
    let firefox_prefs_path = get_config_path().join(FIREFOX_PREFS);
    if let Ok(mut content) = fs::read_to_string(&firefox_prefs_path) {
        if !content.contains(line) {
            content.push_str(format!("\n{}\n", line).as_str());
            // Ensure the file ends with a newline
            fs::write(&firefox_prefs_path, content).expect("Failed to write firefox prefs");
        }
    } else {
        eprintln!(
            "Warning: {} does not exist or cannot be read.",
            firefox_prefs_path.display()
        );
    }
}

fn is_twilight_build() -> bool {
    // Check if '"twilight"' is on .surfer/dynamicConfig.brand.json
    let mut dynamic_config_path = env::current_dir().expect("Failed to get current directory");
    dynamic_config_path.push(".surfer");
    dynamic_config_path.push("dynamicConfig.brand.json");
    if let Ok(content) = fs::read_to_string(&dynamic_config_path) {
        return !content.contains("\"release\"");
    }
    true
}

fn get_env_values() -> HashMap<String, bool> {
    let mut env_values = HashMap::new();
    env_values.insert("IS_TWILIGHT".into(), is_twilight_build());
    env_values
}

fn expand_pref_values(prefs: &mut [Preference]) {
    let env_values = get_env_values();
    for pref in prefs {
        let mut new_value = pref.value.clone();
        for (key, value) in &env_values {
            let placeholder = format!("@{}@", key);
            if new_value.contains(&placeholder) {
                new_value = new_value.replace(&placeholder, if *value { "true" } else { "false" });
            }
            pref.value = new_value.clone();
        }
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let root_path = if args.len() > 1 {
        PathBuf::from(&args[1])
    } else {
        env::current_dir().expect("Failed to get current directory")
    };
    env::set_current_dir(&root_path).expect("Failed to change directory");

    prepare_zen_prefs();
    let mut preferences = load_preferences();
    expand_pref_values(&mut preferences);
    write_preferences(&preferences);
}
