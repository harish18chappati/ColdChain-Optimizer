#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include "graph.h"

/*
 * Graph helper implementations for the runner executable.
 */
void initGraph(Graph* g, int numVertices) {
    g->numVertices = numVertices;
    g->numEdges = 0;
}

void addEdge(Graph* g, int src, int dest, int weight) {
    if (g->numEdges < MAX_EDGES) {
        g->edges[g->numEdges].src = src;
        g->edges[g->numEdges].dest = dest;
        g->edges[g->numEdges].weight = weight;
        g->numEdges++;
    }
}

/*
 * RFC 8259 compliant JSON string escaping.
 * Properly escapes quotes, backslashes, and all control characters (0x00 - 0x1F).
 */
static void printJsonEscaped(const char* str) {
    putchar('"');
    if (str != NULL) {
        for (int i = 0; str[i] != '\0'; i++) {
            unsigned char c = (unsigned char)str[i];
            switch (c) {
                case '"':  printf("\\\""); break;
                case '\\': printf("\\\\"); break;
                case '\b': printf("\\b");  break;
                case '\f': printf("\\f");  break;
                case '\n': printf("\\n");  break;
                case '\r': printf("\\r");  break;
                case '\t': printf("\\t");  break;
                default:
                    if (c < 0x20) {
                        printf("\\u%04x", (unsigned int)c);
                    } else {
                        putchar(c);
                    }
                    break;
            }
        }
    }
    putchar('"');
}

/*
 * Prints a structured JSON error response and terminates cleanly.
 */
static void printJsonError(const char* message) {
    printf("{\n");
    printf("  \"success\": false,\n");
    printf("  \"error\": ");
    printJsonEscaped(message);
    printf("\n}\n");
    exit(0);
}

int main(void) {
    char algorithm[32] = {0};

    // 1. Read algorithm name
    if (scanf("%31s", algorithm) != 1) {
        printJsonError("Failed to read algorithm name from input.");
    }

    // Convert to lowercase
    for (int i = 0; algorithm[i]; i++) {
        algorithm[i] = (char)tolower((unsigned char)algorithm[i]);
    }

    if (strcmp(algorithm, "kruskal") != 0 && strcmp(algorithm, "prim") != 0) {
        char err[128];
        snprintf(err, sizeof(err), "Unknown algorithm '%s'. Supported algorithms: 'kruskal' or 'prim'.", algorithm);
        printJsonError(err);
    }

    // 2. Read facility and road counts
    int V = 0, E = 0;
    if (scanf("%d %d", &V, &E) != 2) {
        printJsonError("Failed to read vertex and edge counts. Expected: <numVertices> <numEdges>.");
    }

    // Validation: Vertex count bounds
    if (V < 1 || V > MAX_VERTICES) {
        char err[128];
        snprintf(err, sizeof(err), "Invalid facility count %d. Must be between 1 and %d.", V, MAX_VERTICES);
        printJsonError(err);
    }

    // Validation: Edge count bounds
    if (E < 0 || E > MAX_EDGES) {
        char err[128];
        snprintf(err, sizeof(err), "Invalid road count %d. Must be between 0 and %d.", E, MAX_EDGES);
        printJsonError(err);
    }

    Graph g;
    initGraph(&g, V);

    // 3. Read candidate roads (edges)
    for (int i = 0; i < E; i++) {
        int u, v, weight;
        if (scanf("%d %d %d", &u, &v, &weight) != 3) {
            char err[128];
            snprintf(err, sizeof(err), "Failed to read road %d of %d. Expected: <src> <dest> <weight>.", i + 1, E);
            printJsonError(err);
        }

        // Validation: Vertex indices within range
        if (u < 0 || u >= V || v < 0 || v >= V) {
            char err[128];
            snprintf(err, sizeof(err), "Road %d connects invalid facility index (%d <-> %d). Indices must be between 0 and %d.",
                     i + 1, u, v, V - 1);
            printJsonError(err);
        }

        // Validation: Weight must be non-negative and less than INF
        if (weight < 0 || weight >= INF) {
            char err[128];
            snprintf(err, sizeof(err), "Road %d has invalid weight %d. Weight must be between 0 and %d.",
                     i + 1, weight, INF - 1);
            printJsonError(err);
        }

        addEdge(&g, u, v, weight);
    }

    // Consume trailing newline from the last numeric line before reading facility names
    int ch;
    while ((ch = getchar()) != '\n' && ch != EOF) {}

    // 4. Read facility names (handles spaces and multi-word names cleanly)
    char facilityNamesStorage[MAX_VERTICES][64];
    const char* facilityNames[MAX_VERTICES];

    for (int i = 0; i < V; i++) {
        if (fgets(facilityNamesStorage[i], sizeof(facilityNamesStorage[i]), stdin) != NULL) {
            // Strip trailing carriage return and newline
            size_t len = strlen(facilityNamesStorage[i]);
            while (len > 0 && (facilityNamesStorage[i][len - 1] == '\n' || facilityNamesStorage[i][len - 1] == '\r')) {
                facilityNamesStorage[i][--len] = '\0';
            }
            if (len == 0) {
                snprintf(facilityNamesStorage[i], sizeof(facilityNamesStorage[i]), "Facility %d", i);
            }
        } else {
            snprintf(facilityNamesStorage[i], sizeof(facilityNamesStorage[i]), "Facility %d", i);
        }
        facilityNames[i] = facilityNamesStorage[i];
    }

    // 5. Execute chosen algorithm with structured result tracking (verbose = 0 keeps stdout pure JSON)
    MSTResult result;
    if (strcmp(algorithm, "kruskal") == 0) {
        runKruskalWithResult(&g, facilityNames, &result, 0);
    } else {
        runPrimWithResult(&g, facilityNames, &result, 0);
    }

    // 6. Emit strictly valid JSON to stdout
    printf("{\n");
    printf("  \"success\": %s,\n", result.isConnected ? "true" : "false");
    printf("  \"algorithm\": \"%s\",\n", algorithm);
    printf("  \"is_connected\": %s,\n", result.isConnected ? "true" : "false");
    printf("  \"vertex_count\": %d,\n", V);
    printf("  \"edge_count\": %d,\n", result.edgeCount);
    printf("  \"total_cost\": %d,\n", result.totalCost);

    if (!result.isConnected) {
        printf("  \"error\": ");
        printJsonEscaped(result.errorMessage);
        printf(",\n");
    } else {
        printf("  \"error\": null,\n");
    }

    // Final MST Edges
    printf("  \"mst_edges\": [\n");
    for (int i = 0; i < result.edgeCount; i++) {
        int u = result.mstEdges[i].src;
        int v = result.mstEdges[i].dest;
        int w = result.mstEdges[i].weight;
        printf("    {\n");
        printf("      \"src\": %d,\n", u);
        printf("      \"dest\": %d,\n", v);
        printf("      \"src_name\": ");
        printJsonEscaped(facilityNames[u]);
        printf(",\n");
        printf("      \"dest_name\": ");
        printJsonEscaped(facilityNames[v]);
        printf(",\n");
        printf("      \"weight\": %d\n", w);
        printf("    }%s\n", (i < result.edgeCount - 1) ? "," : "");
    }
    printf("  ],\n");

    // Execution Steps for Frontend Animation
    printf("  \"steps\": [\n");
    for (int i = 0; i < result.stepCount; i++) {
        AlgorithmStep* s = &result.steps[i];
        printf("    {\n");
        printf("      \"step\": %d,\n", s->stepNumber);
        printf("      \"u\": %d,\n", s->u);
        printf("      \"v\": %d,\n", s->v);
        printf("      \"u_name\": ");
        printJsonEscaped(facilityNames[s->u]);
        printf(",\n");
        printf("      \"v_name\": ");
        printJsonEscaped(facilityNames[s->v]);
        printf(",\n");
        printf("      \"weight\": %d,\n", s->weight);
        printf("      \"status\": ");
        printJsonEscaped(s->status);
        printf(",\n");
        printf("      \"message\": ");
        printJsonEscaped(s->message);
        printf("\n");
        printf("    }%s\n", (i < result.stepCount - 1) ? "," : "");
    }
    printf("  ]\n");
    printf("}\n");

    return 0;
}
