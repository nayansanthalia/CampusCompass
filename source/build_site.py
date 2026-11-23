"""Build the Cloudflare Worker entry for the existing CampusCompass site."""

import base64
import json

from bundle import ROOT, build, load, read


def legacy_assets():
    known_paths = {
        "index.html": ("/submission/", "text/html; charset=utf-8"),
        "TEAM_AETHERMIND_Milestone2.pdf": ("/submission/TEAM_AETHERMIND_Milestone2.pdf", "application/pdf"),
        "TEAM_AETHERMIND_TechnicalReport.pdf": ("/submission/TEAM_AETHERMIND_TechnicalReport.pdf", "application/pdf"),
    }
    assets = {}
    for filename, (url, content_type) in known_paths.items():
        candidate = ROOT / "dist/submission" / filename
        if not candidate.is_file() and filename.endswith(".pdf"):
            candidate = ROOT / "submission" / filename
        if candidate.is_file():
            entry = {
                "type": content_type,
                "data": base64.b64encode(candidate.read_bytes()).decode("ascii"),
            }
            assets[url] = entry
            if filename == "index.html":
                assets["/submission/index.html"] = entry
    return assets


def main():
    build()
    output = ROOT / "dist/server"
    output.mkdir(parents=True, exist_ok=True)
    data = {"corpus": load("data/corpus.json"), "prompts": load("data/prompts.json")}
    declarations = {
        "SITE_DATA": data,
        "SITE_HTML": read("CampusCompass.html"),
        "LEGACY_ASSETS": legacy_assets(),
    }
    sources = "\n".join("const " + key + " = " + json.dumps(val, separators=(",", ":")) + ";" for key, val in declarations.items())
    replacements = "\n".join(read(file) for file in ("source/engine.js", "source/api.js", "source/site_entry.js"))
    (output / "index.js").write_text(sources + "\n" + replacements, encoding="utf-8", newline="\n")
    print("CampusCompass hosted Worker built.")


if __name__ == "__main__":
    main()
