#include <stdio.h>
#include <string.h>
#include "graph.h"

// Find the parent of a vertex (with path compression)
int find(int parent[], int vertex) {
    if (parent[vertex] != vertex) {
        parent[vertex] = find(parent, parent[vertex]);
    }
    return parent[vertex];
}

// Join two different sets using rank
void unionSets(int parent[], int rank[], int a, int b) {
    int rootA = find(parent, a);
    int rootB = find(parent, b);

    if (rootA == rootB) {
        return;
    }

    if (rank[rootA] < rank[rootB]) {
        parent[rootA] = rootB;
    }
    else if (rank[rootA] > rank[rootB]) {
        parent[rootB] = rootA;
    }
    else {
        parent[rootB] = rootA;
        rank[rootA]++;
    }
}

// Sort edges by increasing weight (bubble sort)
void sortEdges(Edge edges[], int E) {
    for (int i = 0; i < E - 1; i++) {
        for (int j = 0; j < E - i - 1; j++) {
            if (edges[j].weight > edges[j + 1].weight) {
                Edge temp = edges[j];
                edges[j] = edges[j + 1];
                edges[j + 1] = temp;
            }
        }
    }
}

// Kruskal's algorithm supporting optional structured result tracking and verbosity flag
int runKruskalWithResult(const Graph* g, const char* facilityNames[], MSTResult* result, int verbose) {
    int V = g->numVertices;
    int E = g->numEdges;

    Edge edges[MAX_EDGES];
    int parent[MAX_VERTICES];
    int rank[MAX_VERTICES];

    int totalCost = 0;
    int count = 0;

    // Initialize result structure if provided
    if (result != NULL) {
        snprintf(result->algorithm, sizeof(result->algorithm), "kruskal");
        result->isConnected = 0;
        result->totalCost = 0;
        result->edgeCount = 0;
        result->stepCount = 0;
        result->errorMessage[0] = '\0';
    }

    // Copy candidate edges
    for (int i = 0; i < E; i++) {
        edges[i] = g->edges[i];
    }

    // Sort edges by ascending transit cost
    sortEdges(edges, E);

    // Initially, every vertex is its own parent
    for (int i = 0; i < V; i++) {
        parent[i] = i;
        rank[i] = 0;
    }

    if (verbose) {
        printf("\n--- KRUSKAL'S ALGORITHM ---\n");
    }

    // Select minimum-cost edges and evaluate all candidate corridors
    for (int i = 0; i < E; i++) {
        int u = edges[i].src;
        int v = edges[i].dest;
        int weight = edges[i].weight;

        int rootU = find(parent, u);
        int rootV = find(parent, v);

        // Different roots mean no cycle AND tree not yet full
        if (rootU != rootV && count < V - 1) {
            if (verbose) {
                printf("[ACCEPTED] %s - %s : %d\n",
                       facilityNames[u],
                       facilityNames[v],
                       weight);
            }

            // Record step for visualization if result requested
            if (result != NULL && result->stepCount < MAX_EDGES * 2) {
                AlgorithmStep* step = &result->steps[result->stepCount++];
                step->stepNumber = result->stepCount;
                step->u = u;
                step->v = v;
                step->weight = weight;
                snprintf(step->status, sizeof(step->status), "accepted");
                snprintf(step->message, sizeof(step->message), "No cycle formed. Added to MST.");

                // Add to final MST edge collection
                if (result->edgeCount < MAX_VERTICES) {
                    result->mstEdges[result->edgeCount++] = edges[i];
                }
            }

            unionSets(parent, rank, u, v);
            totalCost += weight;
            count++;
        }
        else {
            if (verbose) {
                printf("[REJECTED] %s - %s : Cycle detected\n",
                       facilityNames[u],
                       facilityNames[v]);
            }

            // Record rejected step for visualization
            if (result != NULL && result->stepCount < MAX_EDGES * 2) {
                AlgorithmStep* step = &result->steps[result->stepCount++];
                step->stepNumber = result->stepCount;
                step->u = u;
                step->v = v;
                step->weight = weight;
                snprintf(step->status, sizeof(step->status), "rejected");
                snprintf(step->message, sizeof(step->message), "Cycle detected. Redundant corridor rejected.");
            }
        }
    }

    // Check whether all vertices are connected
    if (count != V - 1) {
        if (verbose) {
            printf("Graph is disconnected. MST does not exist.\n");
        }
        if (result != NULL) {
            result->isConnected = 0;
            result->totalCost = -1;
            snprintf(result->errorMessage, sizeof(result->errorMessage),
                     "Graph is disconnected! Found %d of %d required edges. A universal cold-chain network cannot be formed.",
                     count, V - 1);
        }
        return -1;
    }

    if (verbose) {
        printf("Minimum Cost = %d\n", totalCost);
    }

    if (result != NULL) {
        result->isConnected = 1;
        result->totalCost = totalCost;
    }

    return totalCost;
}

// Wrapper preserving the existing terminal function signature for main.c
int runKruskalMST(const Graph* g, const char* facilityNames[]) {
    return runKruskalWithResult(g, facilityNames, NULL, 1);
}
