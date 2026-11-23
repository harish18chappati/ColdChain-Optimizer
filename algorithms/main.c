#include <stdio.h>
#include "graph.h"

/*
 * Initializes the cold-chain graph with a given number of facilities.
 */
void initGraph(Graph* g, int numVertices) {
    g->numVertices = numVertices;
    g->numEdges = 0;
}

/*
 * Adds an undirected transit corridor (refrigerated road) between two facilities.
 */
void addEdge(Graph* g, int src, int dest, int weight) {
    if (g->numEdges < MAX_EDGES) {
        g->edges[g->numEdges].src = src;
        g->edges[g->numEdges].dest = dest;
        g->edges[g->numEdges].weight = weight;
        g->numEdges++;
    } else {
        printf("[WARN] Maximum edge capacity reached!\n");
    }
}

/*
 * Helper function to print all candidate transit corridors in the network.
 */
static void printNetworkSummary(const Graph* g, const char* facilityNames[]) {
    printf("------------------------------------------------------\n");
    printf("Candidate Logistics Network (%d Facilities, %d Roads):\n",
           g->numVertices, g->numEdges);
    printf("------------------------------------------------------\n");
    for (int i = 0; i < g->numEdges; i++) {
        printf("  Road %02d: %-22s <---> %-22s [Cost: %d]\n",
               i + 1,
               facilityNames[g->edges[i].src],
               facilityNames[g->edges[i].dest],
               g->edges[i].weight);
    }
    printf("------------------------------------------------------\n");
}

int main(void) {
    printf("\n******************************************************\n");
    printf("       COLDCHAIN OPTIMIZER - DAA ALGORITHM ENGINE      \n");
    printf("  Minimum Spanning Tree Optimization for Refrigerated Transit\n");
    printf("******************************************************\n\n");

    /* ==========================================================
     * TEST CASE 1: Connected Cold-Chain Facility Network
     * ========================================================== */
    printf(">>> TEST CASE 1: Medical Cold-Chain Facility Network\n");

    // 6 Facilities across Warehouses, Hospitals, and Pharmacies
    const char* facilityNames[] = {
        "Central Warehouse (W1)",       // Index 0
        "Regional Warehouse (W2)",      // Index 1
        "City General Hospital (H1)",   // Index 2
        "Children's Hospital (H2)",     // Index 3
        "Metro Pharmacy (P1)",          // Index 4
        "Community Pharmacy (P2)"       // Index 5
    };
    int numFacilities = 6;

    Graph coldChainNetwork;
    initGraph(&coldChainNetwork, numFacilities);

    // Adding candidate transit corridors with refrigeration/distance costs
    addEdge(&coldChainNetwork, 0, 1, 4);  // W1 <-> W2 (cost 4)
    addEdge(&coldChainNetwork, 0, 2, 2);  // W1 <-> H1 (cost 2)
    addEdge(&coldChainNetwork, 1, 2, 1);  // W2 <-> H1 (cost 1)
    addEdge(&coldChainNetwork, 1, 3, 5);  // W2 <-> H2 (cost 5)
    addEdge(&coldChainNetwork, 2, 3, 8);  // H1 <-> H2 (cost 8)
    addEdge(&coldChainNetwork, 2, 4, 10); // H1 <-> P1 (cost 10)
    addEdge(&coldChainNetwork, 3, 4, 2);  // H2 <-> P1 (cost 2)
    addEdge(&coldChainNetwork, 3, 5, 6);  // H2 <-> P2 (cost 6)
    addEdge(&coldChainNetwork, 4, 5, 3);  // P1 <-> P2 (cost 3)

    printNetworkSummary(&coldChainNetwork, facilityNames);

    // 1. Run Kruskal's Algorithm
    int kruskalCost = runKruskalMST(&coldChainNetwork, facilityNames);

    // 2. Run Prim's Algorithm
    int primCost = runPrimMST(&coldChainNetwork, facilityNames);

    // 3. Mathematical Verification
    printf("\n======================================================\n");
    printf("                  VERIFICATION REPORT                 \n");
    printf("======================================================\n");
    printf("  Kruskal's Algorithm Total Cost : %d\n", kruskalCost);
    printf("  Prim's Algorithm Total Cost    : %d\n", primCost);

    if (kruskalCost > 0 && primCost > 0 && kruskalCost == primCost) {
        printf("\n  [SUCCESS] Both algorithms produced the EXACT same optimal cost (%d)!\n", kruskalCost);
        printf("  Cycle-free reachability guaranteed for all 6 cold-chain facilities.\n");
    } else {
        printf("\n  [FAIL] Discrepancy detected between Kruskal and Prim results!\n");
    }
    printf("======================================================\n\n");

    /* ==========================================================
     * TEST CASE 2: Disconnected Graph Handling
     * ========================================================== */
    printf(">>> TEST CASE 2: Disconnected Facilities Test\n");

    const char* disconnectedNames[] = {
        "Island Depot (W0)",
        "Island Clinic (H0)",
        "Mainland Hub (W1)",
        "Mainland Hospital (H1)"
    };

    Graph disconnectedNetwork;
    initGraph(&disconnectedNetwork, 4);

    // Island has an internal road, Mainland has an internal road,
    // but there is NO bridge/connection between Island and Mainland!
    addEdge(&disconnectedNetwork, 0, 1, 5); // Island Depot <-> Island Clinic
    addEdge(&disconnectedNetwork, 2, 3, 7); // Mainland Hub <-> Mainland Hospital

    printNetworkSummary(&disconnectedNetwork, disconnectedNames);

    printf("Executing Kruskal on disconnected network:\n");
    int discKruskal = runKruskalMST(&disconnectedNetwork, disconnectedNames);

    printf("\nExecuting Prim on disconnected network:\n");
    int discPrim = runPrimMST(&disconnectedNetwork, disconnectedNames);

    printf("\nDisconnected Network Test Result:\n");
    if (discKruskal == -1 && discPrim == -1) {
        printf("  [SUCCESS] Both algorithms correctly detected the disconnected graph!\n");
    } else {
        printf("  [FAIL] Disconnected detection failed!\n");
    }

    printf("\n******************************************************\n");
    printf("               EXECUTION COMPLETE                     \n");
    printf("******************************************************\n");

    return 0;
}
