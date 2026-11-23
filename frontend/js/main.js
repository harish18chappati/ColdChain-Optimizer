/**
 * ColdChain Optimizer — Frontend Interactions & Animations
 * Features:
 * - Dynamic year calculation
 * - Sticky header elevation on scroll
 * - Mobile navigation menu toggle and accessibility
 * - Scrollspy active navigation indicator
 * - Smooth anchor navigation
 * - IntersectionObserver scroll-reveal animations
 * - Interactive Network Model facility node hover feedback
 */

(function () {
  "use strict";

  // Elements
  const header = document.querySelector(".site-header");
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.querySelector(".site-nav");
  const navLinks = Array.from(document.querySelectorAll(".site-nav .nav-link"));
  const yearElement = document.querySelector("[data-year]");
  const networkNodes = Array.from(document.querySelectorAll(".network-node"));
  const mstEdges = Array.from(document.querySelectorAll(".edges-mst line"));
  const discardedEdges = Array.from(document.querySelectorAll(".edges-discarded line"));

  // 1. Update copyright year
  if (yearElement) {
    yearElement.textContent = String(new Date().getFullYear());
  }

  // 2. Mobile navigation menu handler
  function setNavOpen(isOpen) {
    document.body.classList.toggle("nav-open", isOpen);
    if (navToggle) {
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
  }

  if (navToggle) {
    navToggle.addEventListener("click", function (event) {
      event.stopPropagation();
      const isOpen = document.body.classList.contains("nav-open");
      setNavOpen(!isOpen);
    });

    // Close on navigation link click
    navLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        setNavOpen(false);
      });
    });

    // Close on Escape key press
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
        setNavOpen(false);
      }
    });

    // Close on click outside menu
    document.addEventListener("click", function (event) {
      if (
        document.body.classList.contains("nav-open") &&
        siteNav &&
        !siteNav.contains(event.target) &&
        !navToggle.contains(event.target)
      ) {
        setNavOpen(false);
      }
    });

    // Close on viewport resize above mobile breakpoint
    window.addEventListener("resize", function () {
      if (window.innerWidth > 900 && document.body.classList.contains("nav-open")) {
        setNavOpen(false);
      }
    });
  }

  // 3. Header elevation on scroll
  function handleHeaderScroll() {
    if (!header) return;
    const isScrolled = window.scrollY > 12;
    header.classList.toggle("is-scrolled", isScrolled);
  }

  // 4. Scrollspy for Active Navigation Indicator
  const sectionTargets = navLinks
    .map(function (link) {
      const targetId = link.getAttribute("href");
      if (!targetId || targetId.charAt(0) !== "#") return null;
      const targetElement = document.querySelector(targetId);
      return targetElement ? { link: link, element: targetElement } : null;
    })
    .filter(Boolean);

  function updateActiveNavLink() {
    if (!sectionTargets.length) return;
    const navHeight = header ? header.offsetHeight : 74;
    const scrollPosition = window.scrollY + navHeight + 60;

    let activeTarget = sectionTargets[0];

    for (let i = 0; i < sectionTargets.length; i++) {
      const item = sectionTargets[i];
      const topOffset = item.element.getBoundingClientRect().top + window.scrollY;
      if (topOffset <= scrollPosition) {
        activeTarget = item;
      }
    }

    sectionTargets.forEach(function (item) {
      if (item.link === activeTarget.link) {
        item.link.setAttribute("aria-current", "page");
      } else {
        item.link.removeAttribute("aria-current");
      }
    });
  }

  // Combined scroll listener
  function onScroll() {
    handleHeaderScroll();
    updateActiveNavLink();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // 5. Scroll Reveal with IntersectionObserver
  const revealElements = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    revealElements.forEach(function (elem) {
      elem.classList.add("is-visible");
    });
  } else {
    const revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    revealElements.forEach(function (elem) {
      revealObserver.observe(elem);
    });
  }

  // 6. Interactive Network Model Node Highlighting (Controlled & Stable)
  const allEdges = Array.from(document.querySelectorAll("line[data-edge]"));

  networkNodes.forEach(function (node) {
    const facilityId = node.getAttribute("data-facility");

    node.addEventListener("mouseenter", function () {
      node.classList.add("is-active");
      if (!facilityId) return;

      allEdges.forEach(function (edge) {
        const edgeFacilities = (edge.getAttribute("data-edge") || "").split(",");
        if (edgeFacilities.includes(facilityId)) {
          edge.classList.add("edge-highlight");
          edge.classList.remove("edge-dim");
        } else {
          edge.classList.add("edge-dim");
          edge.classList.remove("edge-highlight");
        }
      });
    });

    node.addEventListener("mouseleave", function () {
      node.classList.remove("is-active");
      allEdges.forEach(function (edge) {
        edge.classList.remove("edge-highlight", "edge-dim");
      });
    });
  });

  // ==========================================================================
  // 7. Dynamic MST Algorithm Integration & Custom Network Builder
  // ==========================================================================

  // Sample 6-facility network matching initial hand-crafted SVG layout
  const SAMPLE_FACILITIES = [
    { id: "warehouse-a", name: "Warehouse A (Central Cold Hub)" },
    { id: "warehouse-b", name: "Warehouse B (Regional Depot)" },
    { id: "pharmacy-north", name: "Pharmacy North (Dispensary)" },
    { id: "pharmacy-south", name: "Pharmacy South (Specialty Clinic)" },
    { id: "hospital-alpha", name: "Hospital Alpha (Medical Center)" },
    { id: "hospital-beta", name: "Hospital Beta (Acute Care Point)" }
  ];

  // Sample 9 candidate road corridors matching initial hand-crafted SVG layout
  const SAMPLE_EDGES = [
    { src: 0, dest: 2, weight: 12 }, // Warehouse A <-> Pharmacy North
    { src: 1, dest: 2, weight: 14 }, // Warehouse B <-> Pharmacy North
    { src: 0, dest: 3, weight: 15 }, // Warehouse A <-> Pharmacy South
    { src: 2, dest: 5, weight: 16 }, // Pharmacy North <-> Hospital Beta
    { src: 1, dest: 4, weight: 18 }, // Warehouse B <-> Hospital Alpha
    { src: 3, dest: 5, weight: 21 }, // Pharmacy South <-> Hospital Beta
    { src: 2, dest: 4, weight: 22 }, // Pharmacy North <-> Hospital Alpha
    { src: 4, dest: 5, weight: 24 }, // Hospital Alpha <-> Hospital Beta
    { src: 0, dest: 1, weight: 28 }  // Warehouse A <-> Warehouse B
  ];

  // Active Network State (Defaults to Sample Network)
  let isSampleNetwork = true;
  let activeFacilities = JSON.parse(JSON.stringify(SAMPLE_FACILITIES));
  let activeEdges = JSON.parse(JSON.stringify(SAMPLE_EDGES));

  // Canonical edge key helper for direction-agnostic matching
  function getCanonicalKey(idA, idB) {
    return idA < idB ? idA + "--" + idB : idB + "--" + idA;
  }

  // DOM Elements
  const btnKruskal = document.getElementById("btn-run-kruskal");
  const btnPrim = document.getElementById("btn-run-prim");
  const btnModeInstant = document.getElementById("btn-mode-instant");
  const btnModeStep = document.getElementById("btn-mode-step");
  const algoBadge = document.getElementById("algo-badge");
  const networkAlert = document.getElementById("network-alert");
  const metricBackbone = document.getElementById("metric-backbone");
  const metricCandidates = document.getElementById("metric-candidates");
  const metricFacilities = document.getElementById("metric-facilities");

  // Step-by-Step Controller DOM Elements
  const stepBar = document.getElementById("step-bar");
  const btnStepPrev = document.getElementById("btn-step-prev");
  const btnStepNext = document.getElementById("btn-step-next");
  const btnStepReset = document.getElementById("btn-step-reset");
  const currentStepNum = document.getElementById("current-step-num");
  const totalStepNum = document.getElementById("total-step-num");
  const stepStatusBadge = document.getElementById("step-status-badge");
  const stepCorridor = document.getElementById("step-corridor");
  const stepExplanation = document.getElementById("step-explanation");

  // Custom Network Builder DOM Elements
  const btnToggleBuilder = document.getElementById("btn-toggle-builder");
  const customDrawer = document.getElementById("custom-drawer");
  const btnCloseDrawer = document.getElementById("btn-close-drawer");
  const btnLoadSample = document.getElementById("btn-load-sample");
  const customValError = document.getElementById("custom-val-error");
  const customFacilityCount = document.getElementById("custom-facility-count");
  const customRoadCount = document.getElementById("custom-road-count");
  const inputFacilityName = document.getElementById("input-facility-name");
  const btnAddFacility = document.getElementById("btn-add-facility");
  const customFacilitiesList = document.getElementById("custom-facilities-list");
  const selectRoadSrc = document.getElementById("select-road-src");
  const selectRoadDest = document.getElementById("select-road-dest");
  const inputRoadWeight = document.getElementById("input-road-weight");
  const btnAddRoad = document.getElementById("btn-add-road");
  const customRoadsList = document.getElementById("custom-roads-list");

  // SVG Elements Container & Sample Template Capture
  const graphContentGroup = document.getElementById("network-graph-content");
  const SAMPLE_SVG_HTML = graphContentGroup ? graphContentGroup.innerHTML : "";

  let edgeLines = Array.from(document.querySelectorAll("line[data-edge]"));
  let edgeBadges = Array.from(document.querySelectorAll("g[data-edge]"));

  // Application State
  let currentAlgorithm = "kruskal";
  let executionMode = "instant"; // "instant" or "step"
  let cachedAlgorithmData = { kruskal: null, prim: null };
  let currentStepIndex = 0;
  let isSolving = false;

  // Initialize step bar visibility based on default mode
  if (stepBar) {
    stepBar.classList.add("is-instant-mode");
  }

  /**
   * Bind interactive hover highlighting on SVG facility nodes
   */
  function setupNodeHoverListeners() {
    const nodes = Array.from(document.querySelectorAll(".network-node"));
    const lines = Array.from(document.querySelectorAll("line[data-edge]"));

    nodes.forEach(function (node) {
      const facilityId = node.getAttribute("data-facility");

      node.onmouseenter = function () {
        node.classList.add("is-active");
        if (!facilityId) return;

        lines.forEach(function (edge) {
          const edgeFacilities = (edge.getAttribute("data-edge") || "").split(",");
          if (edgeFacilities.includes(facilityId)) {
            edge.classList.add("edge-highlight");
            edge.classList.remove("edge-dim");
          } else {
            edge.classList.add("edge-dim");
            edge.classList.remove("edge-highlight");
          }
        });
      };

      node.onmouseleave = function () {
        node.classList.remove("is-active");
        lines.forEach(function (edge) {
          edge.classList.remove("edge-highlight", "edge-dim");
        });
      };
    });
  }

  // Initial hover binding
  setupNodeHoverListeners();

  /**
   * Dynamically render SVG canvas (Sample layout or Custom balanced ellipse layout)
   */
  function renderNetworkSVG() {
    if (!graphContentGroup) return;

    if (isSampleNetwork && SAMPLE_SVG_HTML) {
      graphContentGroup.innerHTML = SAMPLE_SVG_HTML;
    } else {
      const N = activeFacilities.length;
      const cx = 260, cy = 195, Rx = 185, Ry = 125;
      const coords = [];

      for (let i = 0; i < N; i++) {
        if (N === 1) {
          coords.push({ x: cx, y: cy });
        } else {
          const theta = -Math.PI / 2 + (i * 2 * Math.PI) / N;
          coords.push({
            x: Math.round(cx + Rx * Math.cos(theta)),
            y: Math.round(cy + Ry * Math.sin(theta))
          });
        }
      }

      let edgesHtml = '<g class="edges-discarded" stroke="#71808B" stroke-width="1.8" stroke-dasharray="4 5" opacity="0.65">\n';
      let mstLinesHtml = '<g class="edges-mst" stroke-linecap="round">\n';
      let badgesHtml = '<g class="weight-tags-mst" font-family="\'IBM Plex Mono\', monospace" font-size="10" font-weight="600">\n';

      activeEdges.forEach(function (e) {
        const u = e.src;
        const v = e.dest;
        if (!coords[u] || !coords[v]) return;
        const p1 = coords[u];
        const p2 = coords[v];
        const idA = activeFacilities[u].id;
        const idB = activeFacilities[v].id;
        const mx = Math.round((p1.x + p2.x) / 2);
        const my = Math.round((p1.y + p2.y) / 2);

        // Candidate edge line
        edgesHtml += `  <line data-edge="${idA},${idB}" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" />\n`;

        // MST line and animated pulse flow overlay
        mstLinesHtml += `  <line data-edge="${idA},${idB}" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#FF6542" stroke-width="3.5" style="display:none;" />\n`;
        mstLinesHtml += `  <line data-edge="${idA},${idB}" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#F7F8F9" stroke-width="1.2" stroke-dasharray="8 8" class="pulse-flow" style="display:none;" />\n`;

        // Weight badge
        badgesHtml += `  <g data-edge="${idA},${idB}" transform="translate(${mx}, ${my})" filter="url(#badge-shadow)">\n`;
        badgesHtml += `    <rect x="-24" y="-10" width="48" height="20" rx="10" fill="rgba(36, 42, 48, 0.92)" stroke="#71808B" stroke-width="1" />\n`;
        badgesHtml += `    <text x="0" y="4" text-anchor="middle" fill="#E5E9EC">${e.weight}</text>\n`;
        badgesHtml += `  </g>\n`;
      });

      edgesHtml += '</g>\n';
      mstLinesHtml += '</g>\n';
      badgesHtml += '</g>\n';

      let nodesHtml = '';
      activeFacilities.forEach(function (f, i) {
        const p = coords[i];
        const name = f.name || ("Facility " + i);
        const label = name.length > 16 ? (name.substring(0, 14) + "..") : name;

        nodesHtml += `<g class="network-node" data-facility="${f.id}" transform="translate(${p.x}, ${p.y})" filter="url(#node-shadow)">\n`;
        nodesHtml += `  <circle r="22" fill="#242A30" stroke="#FF6542" stroke-width="2" />\n`;
        nodesHtml += `  <circle r="15" fill="#FF6542" />\n`;
        nodesHtml += `  <text x="0" y="34" text-anchor="middle" font-family="'Sora', sans-serif" font-size="10" font-weight="700" fill="#F7F8F9">${label}</text>\n`;
        nodesHtml += `</g>\n`;
      });

      graphContentGroup.innerHTML = edgesHtml + mstLinesHtml + badgesHtml + nodesHtml;
    }

    // Refresh dynamic DOM selections and hover listeners
    edgeLines = Array.from(document.querySelectorAll("line[data-edge]"));
    edgeBadges = Array.from(document.querySelectorAll("g[data-edge]"));
    setupNodeHoverListeners();
  }

  /**
   * Render complete instant MST returned by C
   */
  function renderInstantMST(data) {
    if (!data || !data.is_connected) return;

    const selectedKeys = new Set();
    if (Array.isArray(data.mst_edges)) {
      data.mst_edges.forEach(function (e) {
        const u = e.src !== undefined ? e.src : e.source;
        const v = e.dest !== undefined ? e.dest : e.destination;
        if (activeFacilities[u] && activeFacilities[v]) {
          selectedKeys.add(getCanonicalKey(activeFacilities[u].id, activeFacilities[v].id));
        }
      });
    }

    // Update SVG Lines
    edgeLines.forEach(function (line) {
      const parts = (line.getAttribute("data-edge") || "").split(",");
      if (parts.length !== 2) return;
      const key = getCanonicalKey(parts[0], parts[1]);
      const isSelected = selectedKeys.has(key);
      const isPulseFlow = line.classList.contains("pulse-flow");

      line.classList.remove("edge-current-step", "edge-rejected-step");

      if (isSelected) {
        if (isPulseFlow) {
          line.style.display = "";
          line.setAttribute("stroke", "#F7F8F9");
          line.setAttribute("stroke-width", "1.2");
          line.setAttribute("stroke-dasharray", "8 8");
          line.style.opacity = "1";
        } else {
          line.setAttribute("stroke", "#FF6542");
          line.setAttribute("stroke-width", "3.5");
          line.removeAttribute("stroke-dasharray");
          line.style.opacity = "1";
        }
      } else {
        if (isPulseFlow) {
          line.style.display = "none";
        } else {
          line.setAttribute("stroke", "#71808B");
          line.setAttribute("stroke-width", "1.8");
          line.setAttribute("stroke-dasharray", "4 5");
          line.style.opacity = "0.65";
        }
      }
    });

    // Update SVG Weight Badges
    edgeBadges.forEach(function (badge) {
      const parts = (badge.getAttribute("data-edge") || "").split(",");
      if (parts.length !== 2) return;
      const key = getCanonicalKey(parts[0], parts[1]);
      const isSelected = selectedKeys.has(key);
      const rect = badge.querySelector("rect");
      const text = badge.querySelector("text");

      if (isSelected) {
        if (rect) {
          rect.setAttribute("stroke", "#FF6542");
          rect.setAttribute("stroke-width", "1.5");
          rect.setAttribute("fill", "#242A30");
        }
        if (text) {
          text.setAttribute("fill", "#F7F8F9");
        }
      } else {
        if (rect) {
          rect.setAttribute("stroke", "#71808B");
          rect.setAttribute("stroke-width", "1");
          rect.setAttribute("fill", "rgba(36, 42, 48, 0.92)");
        }
        if (text) {
          text.setAttribute("fill", "#E5E9EC");
        }
      }
    });

    if (algoBadge) {
      algoBadge.textContent = currentAlgorithm === "kruskal" ? "Kruskal MST" : "Prim MST";
    }
    if (metricBackbone) {
      metricBackbone.textContent = data.edge_count + " Active Lanes · Total Cost: " + data.total_cost;
    }
  }

  /**
   * Render a specific step of the C algorithm execution sequence
   */
  function renderStep(stepIndex) {
    const data = cachedAlgorithmData[currentAlgorithm];
    if (!data || !Array.isArray(data.steps)) return;

    const steps = data.steps;
    const totalSteps = steps.length;

    currentStepIndex = Math.max(0, Math.min(stepIndex, totalSteps));

    if (currentStepNum) currentStepNum.textContent = "Step " + currentStepIndex;
    if (totalStepNum) totalStepNum.textContent = totalSteps;

    const activeKeys = new Set();
    const rejectedKeys = new Set();
    let runningCost = 0;
    let currentStepKey = null;
    let currentStepData = null;

    for (let i = 0; i < currentStepIndex; i++) {
      const s = steps[i];
      if (!activeFacilities[s.u] || !activeFacilities[s.v]) continue;
      const key = getCanonicalKey(activeFacilities[s.u].id, activeFacilities[s.v].id);

      if (s.status === "accepted" || s.status === "connected") {
        activeKeys.add(key);
        runningCost += s.weight;
      } else if (s.status === "rejected") {
        rejectedKeys.add(key);
      }

      if (i === currentStepIndex - 1) {
        currentStepKey = key;
        currentStepData = s;
      }
    }

    // Update Step Info Pill
    if (currentStepIndex === 0) {
      if (stepStatusBadge) {
        stepStatusBadge.className = "step-badge badge-ready";
        stepStatusBadge.textContent = "Ready";
      }
      if (stepCorridor) {
        stepCorridor.textContent = "Network Ready (" + totalSteps + " steps from C)";
      }
      if (stepExplanation) {
        stepExplanation.textContent = "Click 'Next' to evaluate candidate corridors in " + (currentAlgorithm === "kruskal" ? "Kruskal" : "Prim") + ".";
      }
      if (metricBackbone) {
        metricBackbone.textContent = "0 Active Lanes · Cost: 0";
      }
    } else if (currentStepData) {
      const status = currentStepData.status.toLowerCase();
      if (stepStatusBadge) {
        if (currentStepIndex === totalSteps && activeKeys.size === data.edge_count) {
          stepStatusBadge.className = "step-badge badge-complete";
          stepStatusBadge.textContent = "Complete";
        } else if (status === "accepted") {
          stepStatusBadge.className = "step-badge badge-accepted";
          stepStatusBadge.textContent = "Accepted";
        } else if (status === "connected") {
          stepStatusBadge.className = "step-badge badge-connected";
          stepStatusBadge.textContent = "Connected";
        } else if (status === "rejected") {
          stepStatusBadge.className = "step-badge badge-rejected";
          stepStatusBadge.textContent = "Rejected";
        }
      }

      if (stepCorridor) {
        const uLabel = currentStepData.u_name.split(" (")[0];
        const vLabel = currentStepData.v_name.split(" (")[0];
        stepCorridor.textContent = uLabel + " ↔ " + vLabel + " (Cost: " + currentStepData.weight + ")";
      }

      if (stepExplanation) {
        stepExplanation.textContent = currentStepData.message;
      }

      if (metricBackbone) {
        if (currentStepIndex === totalSteps) {
          metricBackbone.textContent = activeKeys.size + " Active Lanes · Total Cost: " + data.total_cost;
        } else {
          metricBackbone.textContent = activeKeys.size + " Active Lanes · Cost: " + runningCost;
        }
      }
    }

    if (btnStepPrev) btnStepPrev.disabled = (currentStepIndex === 0);
    if (btnStepNext) btnStepNext.disabled = (currentStepIndex === totalSteps);

    if (algoBadge) {
      algoBadge.textContent = (currentAlgorithm === "kruskal" ? "Kruskal" : "Prim") +
        (currentStepIndex === totalSteps ? " · Complete" : " [Step " + currentStepIndex + "/" + totalSteps + "]");
    }

    // Update SVG Lines
    edgeLines.forEach(function (line) {
      const parts = (line.getAttribute("data-edge") || "").split(",");
      if (parts.length !== 2) return;
      const key = getCanonicalKey(parts[0], parts[1]);
      const isPulseFlow = line.classList.contains("pulse-flow");
      const isCurrentStep = (key === currentStepKey);

      line.classList.remove("edge-current-step", "edge-rejected-step");

      if (activeKeys.has(key)) {
        if (isPulseFlow) {
          line.style.display = "";
          line.setAttribute("stroke", "#F7F8F9");
          line.setAttribute("stroke-width", "1.2");
          line.setAttribute("stroke-dasharray", "8 8");
          line.style.opacity = "1";
        } else {
          line.setAttribute("stroke", "#FF6542");
          line.setAttribute("stroke-width", "3.5");
          line.removeAttribute("stroke-dasharray");
          line.style.opacity = "1";
          if (isCurrentStep) {
            line.classList.add("edge-current-step");
          }
        }
      } else if (rejectedKeys.has(key)) {
        if (isPulseFlow) {
          line.style.display = "none";
        } else {
          line.setAttribute("stroke", "#71808B");
          line.setAttribute("stroke-width", "1.8");
          line.setAttribute("stroke-dasharray", "4 5");
          line.style.opacity = "0.65";
          if (isCurrentStep) {
            line.classList.add("edge-rejected-step");
          }
        }
      } else {
        if (isPulseFlow) {
          line.style.display = "none";
        } else {
          line.setAttribute("stroke", "#71808B");
          line.setAttribute("stroke-width", "1.6");
          line.setAttribute("stroke-dasharray", "4 5");
          line.style.opacity = "0.4";
        }
      }
    });

    // Update SVG Weight Pills
    edgeBadges.forEach(function (badge) {
      const parts = (badge.getAttribute("data-edge") || "").split(",");
      if (parts.length !== 2) return;
      const key = getCanonicalKey(parts[0], parts[1]);
      const rect = badge.querySelector("rect");
      const text = badge.querySelector("text");

      if (activeKeys.has(key)) {
        if (rect) {
          rect.setAttribute("stroke", "#FF6542");
          rect.setAttribute("stroke-width", "1.5");
          rect.setAttribute("fill", "#242A30");
        }
        if (text) text.setAttribute("fill", "#F7F8F9");
      } else if (rejectedKeys.has(key)) {
        if (rect) {
          rect.setAttribute("stroke", key === currentStepKey ? "#E53E3E" : "#71808B");
          rect.setAttribute("stroke-width", "1");
          rect.setAttribute("fill", "rgba(36, 42, 48, 0.92)");
        }
        if (text) text.setAttribute("fill", key === currentStepKey ? "#FEB2B2" : "#CBD5E0");
      } else {
        if (rect) {
          rect.setAttribute("stroke", "#71808B");
          rect.setAttribute("stroke-width", "1");
          rect.setAttribute("fill", "rgba(36, 42, 48, 0.92)");
        }
        if (text) text.setAttribute("fill", "#71808B");
      }
    });
  }

  /**
   * Execute Algorithm via C runner over Flask /api/solve
   */
  async function executeMST(algorithm, forceFetch = false) {
    if (isSolving) return;

    currentAlgorithm = algorithm;

    if (btnKruskal && btnPrim) {
      if (algorithm === "kruskal") {
        btnKruskal.classList.add("active");
        btnPrim.classList.remove("active");
      } else {
        btnPrim.classList.add("active");
        btnKruskal.classList.remove("active");
      }
    }

    if (!forceFetch && cachedAlgorithmData[algorithm]) {
      const data = cachedAlgorithmData[algorithm];
      if (executionMode === "step") {
        renderStep(0);
      } else {
        renderInstantMST(data);
      }
      return;
    }

    isSolving = true;
    if (btnKruskal && btnPrim) {
      btnKruskal.disabled = true;
      btnPrim.disabled = true;
    }
    if (algoBadge) {
      algoBadge.textContent = "Computing...";
    }
    if (networkAlert) {
      networkAlert.classList.add("hidden");
      networkAlert.textContent = "";
    }

    try {
      const payload = {
        algorithm: algorithm,
        facilities: activeFacilities.map(function (f) { return f.name; }),
        edges: activeEdges
      };

      const response = await fetch("/api/solve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(function () { return {}; });
        throw new Error(errJson.error || ("Server returned HTTP " + response.status));
      }

      const data = await response.json();

      if (!data.is_connected || data.success === false) {
        if (networkAlert) {
          networkAlert.textContent = "⚠️ Network Disconnected: " + (data.error || "Unable to form minimum spanning tree.");
          networkAlert.classList.remove("hidden");
        }
        if (algoBadge) algoBadge.textContent = "Disconnected";
        if (metricBackbone) metricBackbone.textContent = "Disconnected Graph";
        if (stepBar && executionMode === "step") {
          if (stepStatusBadge) {
            stepStatusBadge.className = "step-badge badge-rejected";
            stepStatusBadge.textContent = "Disconnected";
          }
          if (stepExplanation) stepExplanation.textContent = data.error || "Graph is disconnected.";
        }
      } else {
        cachedAlgorithmData[algorithm] = data;

        if (metricFacilities && data.vertex_count) {
          metricFacilities.textContent = data.vertex_count + " Nodes (V)";
        }
        if (metricCandidates) {
          metricCandidates.textContent = activeEdges.length + " Evaluated (E)";
        }

        if (executionMode === "step") {
          renderStep(0);
        } else {
          renderInstantMST(data);
        }
      }
    } catch (err) {
      console.error("MST Solve error:", err);
      if (networkAlert) {
        networkAlert.textContent = "⚠️ Error: " + (err.message || "Failed to connect to algorithm engine.");
        networkAlert.classList.remove("hidden");
      }
      if (algoBadge) algoBadge.textContent = "Engine Offline";
    } finally {
      isSolving = false;
      if (btnKruskal && btnPrim) {
        btnKruskal.disabled = false;
        btnPrim.disabled = false;
      }
    }
  }

  // ==========================================================================
  // 8. Custom Network Builder Form Management & Validation
  // ==========================================================================

  function showValidationError(msg) {
    if (!customValError) return;
    if (msg) {
      customValError.textContent = "⚠️ " + msg;
      customValError.classList.remove("hidden");
    } else {
      customValError.textContent = "";
      customValError.classList.add("hidden");
    }
  }

  /**
   * Update Custom Drawer UI (chips lists, dropdowns, and counter badges)
   */
  function updateDrawerUI() {
    if (customFacilityCount) customFacilityCount.textContent = activeFacilities.length;
    if (customRoadCount) customRoadCount.textContent = activeEdges.length;

    // Render Facility Chips
    if (customFacilitiesList) {
      customFacilitiesList.innerHTML = "";
      activeFacilities.forEach(function (f, idx) {
        const chip = document.createElement("div");
        chip.className = "custom-chip";
        chip.innerHTML = `<span>${idx}: ${f.name}</span><button type="button" class="custom-chip-del" data-del-facility="${idx}" title="Remove Facility">&times;</button>`;
        customFacilitiesList.appendChild(chip);
      });
    }

    // Render Road Chips
    if (customRoadsList) {
      customRoadsList.innerHTML = "";
      activeEdges.forEach(function (e, idx) {
        const uName = activeFacilities[e.src] ? activeFacilities[e.src].name.split(" (")[0] : ("#" + e.src);
        const vName = activeFacilities[e.dest] ? activeFacilities[e.dest].name.split(" (")[0] : ("#" + e.dest);
        const chip = document.createElement("div");
        chip.className = "custom-chip";
        chip.innerHTML = `<span>${uName} ↔ ${vName} (${e.weight})</span><button type="button" class="custom-chip-del" data-del-road="${idx}" title="Remove Road">&times;</button>`;
        customRoadsList.appendChild(chip);
      });
    }

    // Update Dropdown Options for Roads
    if (selectRoadSrc && selectRoadDest) {
      const curSrc = selectRoadSrc.value;
      const curDest = selectRoadDest.value;

      selectRoadSrc.innerHTML = "";
      selectRoadDest.innerHTML = "";

      activeFacilities.forEach(function (f, idx) {
        const optA = document.createElement("option");
        optA.value = idx;
        optA.textContent = idx + ": " + f.name.split(" (")[0];
        selectRoadSrc.appendChild(optA);

        const optB = document.createElement("option");
        optB.value = idx;
        optB.textContent = idx + ": " + f.name.split(" (")[0];
        selectRoadDest.appendChild(optB);
      });

      if (curSrc && selectRoadSrc.querySelector(`option[value="${curSrc}"]`)) {
        selectRoadSrc.value = curSrc;
      }
      if (curDest && selectRoadDest.querySelector(`option[value="${curDest}"]`)) {
        selectRoadDest.value = curDest;
      } else if (activeFacilities.length > 1) {
        selectRoadDest.selectedIndex = 1;
      }
    }

    // Update metrics bar summary
    if (metricFacilities) metricFacilities.textContent = activeFacilities.length + " Nodes (V)";
    if (metricCandidates) metricCandidates.textContent = activeEdges.length + " Evaluated (E)";
  }

  // Initial Drawer UI setup
  updateDrawerUI();

  // Toggle Custom Builder Drawer
  if (btnToggleBuilder) {
    btnToggleBuilder.addEventListener("click", function () {
      const isHidden = customDrawer.classList.contains("hidden");
      customDrawer.classList.toggle("hidden", !isHidden);
      btnToggleBuilder.classList.toggle("active", isHidden);
      btnToggleBuilder.setAttribute("aria-expanded", isHidden ? "true" : "false");
      if (isHidden) {
        showValidationError("");
        updateDrawerUI();
      }
    });
  }

  if (btnCloseDrawer) {
    btnCloseDrawer.addEventListener("click", function () {
      customDrawer.classList.add("hidden");
      if (btnToggleBuilder) {
        btnToggleBuilder.classList.remove("active");
        btnToggleBuilder.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Add Facility Handler
  if (btnAddFacility && inputFacilityName) {
    btnAddFacility.addEventListener("click", function () {
      showValidationError("");
      const name = (inputFacilityName.value || "").trim();

      if (!name) {
        showValidationError("Facility name cannot be empty.");
        inputFacilityName.focus();
        return;
      }

      if (activeFacilities.length >= 30) {
        showValidationError("Maximum 30 facilities allowed.");
        return;
      }

      const lowerName = name.toLowerCase();
      const isDuplicate = activeFacilities.some(function (f) {
        return f.name.toLowerCase() === lowerName;
      });

      if (isDuplicate) {
        showValidationError(`Facility '${name}' already exists. Names must be unique.`);
        inputFacilityName.focus();
        return;
      }

      const slug = "fac-" + activeFacilities.length + "-" + Date.now().toString().slice(-4);
      activeFacilities.push({ id: slug, name: name });
      isSampleNetwork = false;
      cachedAlgorithmData = { kruskal: null, prim: null };

      inputFacilityName.value = "";
      updateDrawerUI();
      renderNetworkSVG();
      executeMST(currentAlgorithm, true);
    });

    inputFacilityName.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        btnAddFacility.click();
      }
    });
  }

  // Delete Facility Handler (Event Delegation)
  if (customFacilitiesList) {
    customFacilitiesList.addEventListener("click", function (e) {
      const delBtn = e.target.closest("[data-del-facility]");
      if (!delBtn) return;
      showValidationError("");

      if (activeFacilities.length <= 1) {
        showValidationError("Network must contain at least one facility.");
        return;
      }

      const delIdx = parseInt(delBtn.getAttribute("data-del-facility"), 10);
      if (isNaN(delIdx) || delIdx < 0 || delIdx >= activeFacilities.length) return;

      activeFacilities.splice(delIdx, 1);

      // Remove connected roads and remap surviving indices
      const updatedEdges = [];
      activeEdges.forEach(function (edge) {
        if (edge.src === delIdx || edge.dest === delIdx) return; // Drop road
        let newSrc = edge.src > delIdx ? edge.src - 1 : edge.src;
        let newDest = edge.dest > delIdx ? edge.dest - 1 : edge.dest;
        updatedEdges.push({ src: newSrc, dest: newDest, weight: edge.weight });
      });
      activeEdges = updatedEdges;

      isSampleNetwork = false;
      cachedAlgorithmData = { kruskal: null, prim: null };

      updateDrawerUI();
      renderNetworkSVG();
      executeMST(currentAlgorithm, true);
    });
  }

  // Add Road Handler
  if (btnAddRoad && selectRoadSrc && selectRoadDest && inputRoadWeight) {
    btnAddRoad.addEventListener("click", function () {
      showValidationError("");

      if (activeFacilities.length < 2) {
        showValidationError("You must have at least 2 facilities before connecting roads.");
        return;
      }

      const src = parseInt(selectRoadSrc.value, 10);
      const dest = parseInt(selectRoadDest.value, 10);
      const weight = parseInt(inputRoadWeight.value, 10);

      if (isNaN(src) || isNaN(dest) || src < 0 || dest < 0 || src >= activeFacilities.length || dest >= activeFacilities.length) {
        showValidationError("Please select valid source and destination facilities.");
        return;
      }

      if (src === dest) {
        showValidationError("Self-loops are not allowed. Source and destination must be different.");
        return;
      }

      if (isNaN(weight) || weight <= 0) {
        showValidationError("Road transit weight must be a positive integer greater than 0.");
        inputRoadWeight.focus();
        return;
      }

      if (weight >= 1000000000) {
        showValidationError("Road weight must be less than 1,000,000,000.");
        return;
      }

      if (activeEdges.length >= 100) {
        showValidationError("Maximum 100 road corridors allowed.");
        return;
      }

      const pairKey = (Math.min(src, dest)) + "--" + (Math.max(src, dest));
      const isDuplicateRoad = activeEdges.some(function (edge) {
        return (Math.min(edge.src, edge.dest) + "--" + Math.max(edge.src, edge.dest)) === pairKey;
      });

      if (isDuplicateRoad) {
        showValidationError("A road already connects these two facilities.");
        return;
      }

      activeEdges.push({ src: src, dest: dest, weight: weight });
      isSampleNetwork = false;
      cachedAlgorithmData = { kruskal: null, prim: null };

      inputRoadWeight.value = "";
      updateDrawerUI();
      renderNetworkSVG();
      executeMST(currentAlgorithm, true);
    });

    inputRoadWeight.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        btnAddRoad.click();
      }
    });
  }

  // Delete Road Handler (Event Delegation)
  if (customRoadsList) {
    customRoadsList.addEventListener("click", function (e) {
      const delBtn = e.target.closest("[data-del-road]");
      if (!delBtn) return;
      showValidationError("");

      const delIdx = parseInt(delBtn.getAttribute("data-del-road"), 10);
      if (isNaN(delIdx) || delIdx < 0 || delIdx >= activeEdges.length) return;

      activeEdges.splice(delIdx, 1);
      isSampleNetwork = false;
      cachedAlgorithmData = { kruskal: null, prim: null };

      updateDrawerUI();
      renderNetworkSVG();
      executeMST(currentAlgorithm, true);
    });
  }

  // Load Sample Network Button
  if (btnLoadSample) {
    btnLoadSample.addEventListener("click", function () {
      showValidationError("");
      isSampleNetwork = true;
      activeFacilities = JSON.parse(JSON.stringify(SAMPLE_FACILITIES));
      activeEdges = JSON.parse(JSON.stringify(SAMPLE_EDGES));
      cachedAlgorithmData = { kruskal: null, prim: null };

      updateDrawerUI();
      renderNetworkSVG();
      executeMST(currentAlgorithm, true);
    });
  }

  // Bind Algorithm Selection Buttons
  if (btnKruskal) {
    btnKruskal.addEventListener("click", function () {
      executeMST("kruskal");
    });
  }

  if (btnPrim) {
    btnPrim.addEventListener("click", function () {
      executeMST("prim");
    });
  }

  // Bind Mode Toggle Buttons (Instant vs Step-by-Step)
  if (btnModeInstant) {
    btnModeInstant.addEventListener("click", function () {
      if (executionMode === "instant") return;
      executionMode = "instant";
      btnModeInstant.classList.add("active");
      if (btnModeStep) btnModeStep.classList.remove("active");
      if (stepBar) stepBar.classList.add("is-instant-mode");

      const data = cachedAlgorithmData[currentAlgorithm];
      if (data) {
        renderInstantMST(data);
      } else {
        executeMST(currentAlgorithm);
      }
    });
  }

  if (btnModeStep) {
    btnModeStep.addEventListener("click", function () {
      if (executionMode === "step") return;
      executionMode = "step";
      btnModeStep.classList.add("active");
      if (btnModeInstant) btnModeInstant.classList.remove("active");
      if (stepBar) stepBar.classList.remove("is-instant-mode");

      const data = cachedAlgorithmData[currentAlgorithm];
      if (data) {
        renderStep(0);
      } else {
        executeMST(currentAlgorithm);
      }
    });
  }

  // Bind Step Controller Buttons (Prev, Next, Reset)
  if (btnStepNext) {
    btnStepNext.addEventListener("click", function () {
      renderStep(currentStepIndex + 1);
    });
  }

  if (btnStepPrev) {
    btnStepPrev.addEventListener("click", function () {
      renderStep(currentStepIndex - 1);
    });
  }

  if (btnStepReset) {
    btnStepReset.addEventListener("click", function () {
      renderStep(0);
    });
  }
})();
