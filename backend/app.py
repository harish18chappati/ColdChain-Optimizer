import json
import subprocess
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
RUNNER_EXE = BASE_DIR / "coldchain_runner.exe"

app = Flask(__name__)

# Default Cold-Chain Facility Network
DEFAULT_FACILITIES = [
    "Central Warehouse (W1)",
    "Regional Warehouse (W2)",
    "City General Hospital (H1)",
    "Children's Hospital (H2)",
    "Metro Pharmacy (P1)",
    "Community Pharmacy (P2)"
]

DEFAULT_EDGES = [
    {"src": 0, "dest": 1, "weight": 4},
    {"src": 0, "dest": 2, "weight": 2},
    {"src": 1, "dest": 2, "weight": 1},
    {"src": 1, "dest": 3, "weight": 5},
    {"src": 2, "dest": 3, "weight": 8},
    {"src": 2, "dest": 4, "weight": 10},
    {"src": 3, "dest": 4, "weight": 2},
    {"src": 3, "dest": 5, "weight": 6},
    {"src": 4, "dest": 5, "weight": 3}
]


# Open the homepage
@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


# API: Get default cold-chain facility network
@app.route("/api/network", methods=["GET"])
def get_network():
    return jsonify({
        "success": True,
        "facilities": DEFAULT_FACILITIES,
        "edges": DEFAULT_EDGES
    })


# API: Solve MST using compiled C runner (Kruskal or Prim)
@app.route("/api/solve", methods=["POST"])
def solve_mst():
    try:
        data = request.get_json(force=True, silent=True)
        if data is None:
            data = {}

        # 1. Validate algorithm name
        algorithm = data.get("algorithm", "kruskal")
        if not isinstance(algorithm, str):
            return jsonify({
                "success": False,
                "error": "Algorithm must be a string ('kruskal' or 'prim')."
            }), 400

        algorithm = algorithm.strip().lower()
        if algorithm not in ("kruskal", "prim"):
            return jsonify({
                "success": False,
                "error": f"Invalid algorithm '{algorithm}'. Must be 'kruskal' or 'prim'."
            }), 400

        # 2. Resolve facilities and edges
        # Note: An explicitly supplied empty list [] must NOT be replaced with defaults
        has_facilities = "facilities" in data or "vertices" in data
        has_edges = "edges" in data

        if not has_facilities and not has_edges:
            # Neither provided -> use default cold-chain network
            facilities = DEFAULT_FACILITIES
            edges = DEFAULT_EDGES
        else:
            raw_fac = data.get("facilities") if "facilities" in data else data.get("vertices")
            facilities = raw_fac if raw_fac is not None else DEFAULT_FACILITIES
            edges = data.get("edges") if has_edges else []

        # 3. Validate facilities list
        if not isinstance(facilities, list):
            return jsonify({
                "success": False,
                "error": "'facilities' must be a list of facility names."
            }), 400

        num_vertices = len(facilities)
        if num_vertices < 1 or num_vertices > 30:
            return jsonify({
                "success": False,
                "error": f"Invalid facility count {num_vertices}. Must be between 1 and 30."
            }), 400

        clean_facilities = []
        seen_names = set()
        for i, name in enumerate(facilities):
            s = str(name).strip()
            if not s:
                s = f"Facility {i}"
            lower_name = s.lower()
            if lower_name in seen_names:
                return jsonify({
                    "success": False,
                    "error": f"Duplicate facility name '{s}'. Each facility must have a unique name."
                }), 400
            seen_names.add(lower_name)
            clean_facilities.append(s)

        # 4. Validate edges list
        if not isinstance(edges, list):
            return jsonify({
                "success": False,
                "error": "'edges' must be a list of road corridor objects."
            }), 400

        num_edges = len(edges)
        if num_edges < 0 or num_edges > 100:
            return jsonify({
                "success": False,
                "error": f"Invalid road count {num_edges}. Must be between 0 and 100."
            }), 400

        clean_edges = []
        seen_pairs = set()
        for i, e in enumerate(edges):
            s_val = e.get("src") if "src" in e else e.get("source")
            d_val = e.get("dest") if "dest" in e else e.get("destination")
            if not isinstance(e, dict) or s_val is None or d_val is None or "weight" not in e:
                return jsonify({
                    "success": False,
                    "error": f"Road at index {i} must be an object with 'src'/'source', 'dest'/'destination', and 'weight'."
                }), 400

            try:
                src = int(s_val)
                dest = int(d_val)
                weight = int(e["weight"])
            except (ValueError, TypeError):
                return jsonify({
                    "success": False,
                    "error": f"Road at index {i} fields ('src', 'dest', 'weight') must be integers."
                }), 400

            if src < 0 or src >= num_vertices or dest < 0 or dest >= num_vertices:
                return jsonify({
                    "success": False,
                    "error": f"Road at index {i} has invalid endpoints ({src} <-> {dest}). Must be between 0 and {num_vertices - 1}."
                }), 400

            if src == dest:
                return jsonify({
                    "success": False,
                    "error": f"Road at index {i} is a self-loop ({src} <-> {dest}). Self-loops are not allowed."
                }), 400

            edge_pair = (min(src, dest), max(src, dest))
            if edge_pair in seen_pairs:
                return jsonify({
                    "success": False,
                    "error": f"Duplicate road corridor between facility {src} and facility {dest} at index {i}."
                }), 400
            seen_pairs.add(edge_pair)

            if weight <= 0 or weight >= 1000000000:
                return jsonify({
                    "success": False,
                    "error": f"Road at index {i} weight ({weight}) must be a positive integer between 1 and 999,999,999."
                }), 400

            clean_edges.append({"src": src, "dest": dest, "weight": weight})

        # 5. Build plain-text protocol for C runner
        lines = [algorithm, f"{num_vertices} {num_edges}"]
        for e in clean_edges:
            lines.append(f"{e['src']} {e['dest']} {e['weight']}")
        for name in clean_facilities:
            lines.append(name)

        stdin_payload = "\n".join(lines) + "\n"

        if not RUNNER_EXE.exists():
            return jsonify({
                "success": False,
                "error": f"C runner executable not found at '{RUNNER_EXE}'. Please compile algorithms/runner.c first."
            }), 500

        # 6. Execute C runner via subprocess with returncode checking
        proc = subprocess.run(
            [str(RUNNER_EXE)],
            input=stdin_payload,
            text=True,
            capture_output=True,
            timeout=10
        )

        stdout_text = proc.stdout.strip()

        # Handle non-zero exit code
        if proc.returncode != 0:
            if stdout_text:
                try:
                    err_json = json.loads(stdout_text)
                    return jsonify(err_json), 400
                except Exception:
                    pass
            stderr_text = proc.stderr.strip() or f"Process exited with error code {proc.returncode}"
            return jsonify({
                "success": False,
                "error": f"C algorithm execution error: {stderr_text}"
            }), 500

        if not stdout_text:
            return jsonify({
                "success": False,
                "error": f"C engine returned empty output. Stderr: {proc.stderr.strip()}"
            }), 500

        # Parse valid JSON returned from C engine
        result = json.loads(stdout_text)
        return jsonify(result)

    except json.JSONDecodeError as jde:
        return jsonify({
            "success": False,
            "error": f"Failed to parse C engine JSON output: {str(jde)}",
            "raw_output": proc.stdout
        }), 500
    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False,
            "error": "C algorithm engine timed out (10-second limit exceeded)."
        }), 504
    except Exception as ex:
        return jsonify({
            "success": False,
            "error": str(ex)
        }), 500


# Serve CSS, JavaScript, images and other frontend files
@app.route("/<path:filename>")
def frontend_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
