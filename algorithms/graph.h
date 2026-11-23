#ifndef GRAPH_H
#define GRAPH_H

/* Maximum limits for our cold-chain network */
#define MAX_VERTICES 30
#define MAX_EDGES 100
#define INF 1000000000

/*
 * Structure to represent a single transit road (edge)
 * connecting two medical facilities.
 */
typedef struct {
    int src;        // Source facility index (e.g. 0 for Warehouse)
    int dest;       // Destination facility index (e.g. 1 for Hospital)
    int weight;     // Refrigeration transit cost (lower is cheaper)
} Edge;

/*
 * Structure to represent the cold-chain logistics network.
 * Uses an Edge-List representation for maximum clarity.
 */
typedef struct {
    int numVertices;        // Total facilities in the network (V)
    int numEdges;           // Total candidate transit routes (E)
    Edge edges[MAX_EDGES];  // Array storing all candidate edges
} Graph;

/*
 * Structure to record an individual step of algorithm execution
 * for frontend visualization (step-by-step playback).
 */
typedef struct {
    int stepNumber;
    int u;
    int v;
    int weight;
    char status[16];   // "accepted", "rejected", "connected"
    char message[80];  // Explanation (e.g. "Cycle detected", "Connected to MST")
} AlgorithmStep;

/*
 * Structure to hold complete structured results of an MST run
 * to send back to Flask as JSON.
 */
typedef struct {
    char algorithm[16];                  // "kruskal" or "prim"
    int isConnected;                     // 1 = valid MST, 0 = disconnected
    int totalCost;                       // Total minimum refrigeration cost
    int edgeCount;                       // Number of edges in MST (V - 1)
    Edge mstEdges[MAX_VERTICES];         // Edges in the final tree
    int stepCount;                       // Number of execution steps recorded
    AlgorithmStep steps[MAX_EDGES * 2];  // Step-by-step history
    char errorMessage[128];              // Error description if disconnected/invalid
} MSTResult;

/* Function declarations for graph setup */
void initGraph(Graph* g, int numVertices);
void addEdge(Graph* g, int src, int dest, int weight);

/* Standard terminal algorithm functions (used by main.c) */
int runKruskalMST(const Graph* g, const char* facilityNames[]);
int runPrimMST(const Graph* g, const char* facilityNames[]);

/* Structured algorithm functions with step tracking (used by runner.c) */
int runKruskalWithResult(const Graph* g, const char* facilityNames[], MSTResult* result, int verbose);
int runPrimWithResult(const Graph* g, const char* facilityNames[], MSTResult* result, int verbose);

#endif /* GRAPH_H */
