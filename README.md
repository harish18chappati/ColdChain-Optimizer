# ColdChain Optimizer

A student project that demonstrates how **Minimum Spanning Tree (MST)**
algorithms can help connect warehouses, pharmacies, and hospitals
through a low-cost cold-chain distribution network.

The project implements **Kruskal's Algorithm** and **Prim's Algorithm**
in C, runs them through a Python Flask backend, and displays the network
and selected MST edges in a web interface.

## Features

-   Visualize a cold-chain network as a graph.
-   Find a Minimum Spanning Tree using Kruskal's Algorithm.
-   Find a Minimum Spanning Tree using Prim's Algorithm.
-   Compare the results of both algorithms.
-   View the algorithm execution step by step.
-   Create a custom network by adding facilities and roads.
-   Validate graph inputs such as duplicate roads, self-loops, and
    invalid weights.
-   Display the selected MST edges and total network weight.

## Technologies Used

-   **C** --- Kruskal's and Prim's algorithms
-   **Python / Flask** --- backend API and execution of the C algorithm
    runner
-   **HTML, CSS, JavaScript** --- frontend and graph visualization
-   **SVG** --- graph rendering

## Project Structure

``` text
ColdChain-Optimizer/
├── algorithms/
│   ├── graph.h
│   ├── kruskal.c
│   ├── prim.c
│   ├── runner.c
│   └── main.c
├── backend/
│   └── app.py
├── frontend/
│   ├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   └── main.js
│   └── index.html
├── tests/
├── requirements.txt
└── .gitignore
```

## How It Works

1.  The user selects the sample network or creates a custom graph.
2.  The frontend sends the graph data to the Flask backend.
3.  Flask passes the graph to the compiled C algorithm runner.
4.  The C program executes the selected MST algorithm.
5.  The backend returns the result to the frontend.
6.  The website displays the selected edges, total weight, and algorithm
    steps.

**Note:** The MST computation is performed by the C algorithms, not by
JavaScript.

## Algorithms

### Kruskal's Algorithm

-   Sorts graph edges by weight.
-   Uses a Disjoint Set Union (DSU) structure to detect cycles.
-   Adds an edge when it does not create a cycle.
-   Stops when the MST contains `V - 1` edges for a connected graph.

### Prim's Algorithm

-   Starts from a selected vertex.
-   Uses a min-heap to choose the lowest-weight edge connecting the
    current tree to a new vertex.
-   Continues until all vertices are included or the graph is found to
    be disconnected.

Both algorithms produce an MST with the same minimum total weight for a
connected, undirected, weighted graph, although the selected edges may
differ when multiple MSTs exist.

## Run Locally (Windows)

### 1. Clone the repository

``` powershell
git clone https://github.com/<your-username>/ColdChain-Optimizer.git
cd ColdChain-Optimizer
```

### 2. Create and activate a Python virtual environment

``` powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

### 3. Install Python dependencies

``` powershell
pip install -r requirements.txt
```

### 4. Compile the C runner

Compile the runner using the C source files in the `algorithms` folder.
For example, if GCC is installed and these are the source files used by
the runner:

``` powershell
gcc algorithms/runner.c algorithms/kruskal.c algorithms/prim.c -o coldchain_runner.exe
```

If your project uses an additional C source file, include it in the
compile command.

### 5. Start the Flask application

Run the Flask application using the entry point configured in
`backend/app.py`. A common command is:

``` powershell
python backend/app.py
```

Open the local address printed by Flask in your browser (usually
`http://127.0.0.1:5000`).

## Tests

The `tests/` folder contains browser end-to-end tests for the website's
graph input, custom network, and step-by-step visualization features.

Run the tests using the commands and dependencies configured by the
project. Browser tests may require Node.js and the relevant browser
testing packages.

## Deployment

The C runner must be compiled for the operating system used by the
hosting service. The Windows `.exe` file cannot run directly on a Linux
hosting service.

For a Linux deployment, compile the C sources during the build process
and configure Flask to execute the Linux binary. Use a production WSGI
server such as Gunicorn rather than Flask's development server.

## Example

For the included sample network, both Kruskal's and Prim's algorithms
return an MST with:

-   **Vertices:** 6
-   **Edges in the MST:** 5
-   **Total weight:** 75

The total is a graph weight; its real-world unit depends on how the road
weights are defined.

## Learning Outcomes

This project demonstrates: - Graph representation using vertices and
weighted edges. - Minimum Spanning Tree concepts. - Kruskal's Algorithm
and Disjoint Set Union. - Prim's Algorithm and min-heap usage. -
Integration of C algorithms with a Python Flask backend. -
Frontend-to-backend communication and graph visualization.

## Author

Developed as an academic Data Structures and Algorithms project.

------------------------------------------------------------------------

If you find an issue or want to suggest an improvement, feel free to
open an issue in the repository.
