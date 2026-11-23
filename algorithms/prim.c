#include <stdio.h>
#include <string.h>
#include "graph.h"

// Structure for Min-Heap
typedef struct {
    int vertex;
    int weight;
} HeapNode;

typedef struct {
    HeapNode nodes[MAX_EDGES + 1];
    int size;
} MinHeap;

// Swap two heap nodes
void swap(HeapNode *a, HeapNode *b) {
    HeapNode temp = *a;
    *a = *b;
    *b = temp;
}

// Move a node down to maintain Min-Heap
void heapify(MinHeap *heap, int i) {
    int smallest = i;
    int left = 2 * i + 1;
    int right = 2 * i + 2;

    if (left < heap->size &&
        heap->nodes[left].weight < heap->nodes[smallest].weight) {
        smallest = left;
    }

    if (right < heap->size &&
        heap->nodes[right].weight < heap->nodes[smallest].weight) {
        smallest = right;
    }

    if (smallest != i) {
        swap(&heap->nodes[i], &heap->nodes[smallest]);
        heapify(heap, smallest);
    }
}

// Insert a new node into Min-Heap with capacity check
void insert(MinHeap *heap, int vertex, int weight) {
    if (heap->size >= MAX_EDGES + 1) {
        return;
    }

    int i = heap->size;
    heap->nodes[i].vertex = vertex;
    heap->nodes[i].weight = weight;
    heap->size++;

    while (i > 0 &&
           heap->nodes[i].weight < heap->nodes[(i - 1) / 2].weight) {
        int parent = (i - 1) / 2;
        swap(&heap->nodes[i], &heap->nodes[parent]);
        i = parent;
    }
}

// Remove the minimum node
HeapNode extractMin(MinHeap *heap) {
    HeapNode min = heap->nodes[0];

    heap->nodes[0] = heap->nodes[heap->size - 1];
    heap->size--;

    if (heap->size > 0) {
        heapify(heap, 0);
    }

    return min;
}

// Prim's algorithm supporting optional structured result tracking and verbosity flag
int runPrimWithResult(const Graph *g, const char *facilityNames[], MSTResult* result, int verbose) {
    int V = g->numVertices;
    int E = g->numEdges;

    int visited[MAX_VERTICES] = {0};
    int key[MAX_VERTICES];
    int parent[MAX_VERTICES];

    MinHeap heap;
    heap.size = 0;

    int totalCost = 0;
    int count = 0;

    // Initialize result structure if provided
    if (result != NULL) {
        snprintf(result->algorithm, sizeof(result->algorithm), "prim");
        result->isConnected = 0;
        result->totalCost = 0;
        result->edgeCount = 0;
        result->stepCount = 0;
        result->errorMessage[0] = '\0';
    }

    // Initialize all vertices
    for (int i = 0; i < V; i++) {
        key[i] = INF;
        parent[i] = -1;
    }

    // Start from facility 0 (Central Warehouse)
    key[0] = 0;
    insert(&heap, 0, 0);

    if (verbose) {
        printf("\n--- PRIM'S ALGORITHM ---\n");
    }

    while (heap.size > 0) {
        HeapNode current = extractMin(&heap);
        int u = current.vertex;

        if (visited[u]) {
            continue;
        }

        visited[u] = 1;
        count++;

        // Add the selected edge to MST
        if (parent[u] != -1) {
            if (verbose) {
                printf("[CONNECTED] %s - %s : %d\n",
                       facilityNames[parent[u]],
                       facilityNames[u],
                       key[u]);
            }

            totalCost += key[u];

            // Record step for visualization if result requested
            if (result != NULL && result->stepCount < MAX_EDGES * 2) {
                AlgorithmStep* step = &result->steps[result->stepCount++];
                step->stepNumber = result->stepCount;
                step->u = parent[u];
                step->v = u;
                step->weight = key[u];
                snprintf(step->status, sizeof(step->status), "connected");
                snprintf(step->message, sizeof(step->message), "Cheapest cut edge connected to MST.");

                if (result->edgeCount < MAX_VERTICES) {
                    result->mstEdges[result->edgeCount].src = parent[u];
                    result->mstEdges[result->edgeCount].dest = u;
                    result->mstEdges[result->edgeCount].weight = key[u];
                    result->edgeCount++;
                }
            }
        }

        // Check all edges connected to u
        for (int i = 0; i < E; i++) {
            int v = -1;
            int weight = g->edges[i].weight;

            if (g->edges[i].src == u) {
                v = g->edges[i].dest;
            }
            else if (g->edges[i].dest == u) {
                v = g->edges[i].src;
            }

            // Update if a cheaper connection is found
            if (v != -1 && !visited[v] && weight < key[v]) {
                key[v] = weight;
                parent[v] = u;

                insert(&heap, v, weight);
            }
        }
    }

    // Check connectivity
    if (count != V) {
        if (verbose) {
            printf("Graph is disconnected. MST does not exist.\n");
        }
        if (result != NULL) {
            result->isConnected = 0;
            result->totalCost = -1;
            snprintf(result->errorMessage, sizeof(result->errorMessage),
                     "Graph is disconnected! Only %d of %d facilities were reachable.",
                     count, V);
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
int runPrimMST(const Graph *g, const char *facilityNames[]) {
    return runPrimWithResult(g, facilityNames, NULL, 1);
}
