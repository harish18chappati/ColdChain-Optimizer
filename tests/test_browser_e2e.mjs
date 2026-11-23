import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;
const TARGET_URL = "http://127.0.0.1:5000";

// Start Chrome headless with remote debugging
console.log("1. Starting Chrome headless with remote debugging on port " + PORT + "...");
const tempProfile = path.join(process.env.TEMP || "C:\\Temp", "chrome_test_profile_" + Date.now());
fs.mkdirSync(tempProfile, { recursive: true });

const chromeProc = spawn(CHROME_PATH, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${tempProfile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--headless=new",
  "--disable-gpu",
  "--window-size=1280,900"
], { stdio: "ignore" });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCdp(maxRetries = 20) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    await sleep(300);
  }
  throw new Error("Chrome CDP did not become ready within timeout.");
}

async function runTest() {
  try {
    const versionInfo = await waitForCdp();
    console.log("✓ Chrome CDP ready:", versionInfo.Browser);

    // Create a new target page
    const targetRes = await fetch(`http://127.0.0.1:${PORT}/json/new?${TARGET_URL}`, { method: "PUT" });
    const target = await targetRes.json();
    console.log("✓ Created target page:", target.webSocketDebuggerUrl);

    const ws = new WebSocket(target.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
    console.log("✓ Connected to Page WebSocket");

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const reqId = id++;
        pending.set(reqId, { resolve, reject });
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    // Enable Page and Runtime
    await send("Page.enable");
    await send("Runtime.enable");

    console.log("2. Navigating to " + TARGET_URL + "...");
    await send("Page.navigate", { url: TARGET_URL });
    await sleep(2000); // Allow scripts and styles to load

    // Helper to evaluate JS in the browser page
    async function evaluate(expression) {
      const res = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        throw new Error("Evaluation error: " + JSON.stringify(res.exceptionDetails));
      }
      return res.result.value;
    }

    // Verify initial DOM
    console.log("3. Verifying initial DOM elements...");
    const initialCheck = await evaluate(`(() => {
      return {
        hasKruskalBtn: !!document.getElementById('btn-run-kruskal'),
        hasPrimBtn: !!document.getElementById('btn-run-prim'),
        hasBadge: !!document.getElementById('algo-badge'),
        hasBackboneMetric: !!document.getElementById('metric-backbone'),
        hasAlert: !!document.getElementById('network-alert')
      };
    })()`);
    console.log("Initial elements check:", initialCheck);
    if (!initialCheck.hasKruskalBtn || !initialCheck.hasPrimBtn) {
      throw new Error("Buttons missing in DOM!");
    }

    // Test 1: Click Run Kruskal
    console.log("4. Testing 'Run Kruskal' click...");
    const kruskalResult = await evaluate(`(async () => {
      const btn = document.getElementById('btn-run-kruskal');
      btn.click();
      // Wait for fetch to complete
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 100));
        const badge = document.getElementById('algo-badge').textContent;
        if (badge === 'Kruskal MST') break;
      }
      return {
        activeBtn: document.getElementById('btn-run-kruskal').classList.contains('active'),
        badgeText: document.getElementById('algo-badge').textContent,
        backboneText: document.getElementById('metric-backbone').textContent,
        alertHidden: document.getElementById('network-alert').classList.contains('hidden'),
        selectedEdges: Array.from(document.querySelectorAll('.edges-mst line:not(.pulse-flow)'))
          .filter(l => l.getAttribute('stroke') === '#FF6542')
          .map(l => l.getAttribute('data-edge')),
        pulseFlowCount: Array.from(document.querySelectorAll('.edges-mst line.pulse-flow'))
          .filter(l => l.style.display !== 'none').length
      };
    })()`);
    console.log("Kruskal Run Result:", JSON.stringify(kruskalResult, null, 2));

    if (!kruskalResult.activeBtn) throw new Error("Kruskal button should be active");
    if (kruskalResult.badgeText !== "Kruskal MST") throw new Error("Badge should show Kruskal MST");
    if (!kruskalResult.backboneText.includes("Total Cost: 75") || !kruskalResult.backboneText.includes("5 Active Lanes")) {
      throw new Error("Backbone metric should show '5 Active Lanes · Total Cost: 75'");
    }
    if (kruskalResult.pulseFlowCount !== 5) {
      throw new Error("Expected 5 pulse-flow lines visible, got " + kruskalResult.pulseFlowCount);
    }
    console.log("✓ Kruskal verification PASSED: 5 MST edges, Total Cost 75, badge 'Kruskal MST'");

    // Test 2: Click Run Prim
    console.log("5. Testing 'Run Prim' click...");
    const primResult = await evaluate(`(async () => {
      const btn = document.getElementById('btn-run-prim');
      btn.click();
      // Wait for fetch to complete
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 100));
        const badge = document.getElementById('algo-badge').textContent;
        if (badge === 'Prim MST') break;
      }
      return {
        activePrimBtn: document.getElementById('btn-run-prim').classList.contains('active'),
        kruskalInactive: !document.getElementById('btn-run-kruskal').classList.contains('active'),
        badgeText: document.getElementById('algo-badge').textContent,
        backboneText: document.getElementById('metric-backbone').textContent,
        alertHidden: document.getElementById('network-alert').classList.contains('hidden'),
        selectedEdges: Array.from(document.querySelectorAll('.edges-mst line:not(.pulse-flow)'))
          .filter(l => l.getAttribute('stroke') === '#FF6542')
          .map(l => l.getAttribute('data-edge')),
        pulseFlowCount: Array.from(document.querySelectorAll('.edges-mst line.pulse-flow'))
          .filter(l => l.style.display !== 'none').length
      };
    })()`);
    console.log("Prim Run Result:", JSON.stringify(primResult, null, 2));

    if (!primResult.activePrimBtn) throw new Error("Prim button should be active");
    if (!primResult.kruskalInactive) throw new Error("Kruskal button should not be active");
    if (primResult.badgeText !== "Prim MST") throw new Error("Badge should show Prim MST");
    if (!primResult.backboneText.includes("Total Cost: 75") || !primResult.backboneText.includes("5 Active Lanes")) {
      throw new Error("Backbone metric should show '5 Active Lanes · Total Cost: 75'");
    }
    if (primResult.pulseFlowCount !== 5) {
      throw new Error("Expected 5 pulse-flow lines visible, got " + primResult.pulseFlowCount);
    }
    console.log("✓ Prim verification PASSED: 5 MST edges, Total Cost 75, badge 'Prim MST'");

    // Capture screenshot of the rendered page
    console.log("6. Capturing screenshot...");
    const screenshotData = await send("Page.captureScreenshot", { format: "png" });
    const screenshotPath = path.join(process.cwd(), "browser_test_screenshot.png");
    fs.writeFileSync(screenshotPath, Buffer.from(screenshotData.data, "base64"));
    console.log("✓ Screenshot saved to:", screenshotPath);

    ws.close();
    console.log("ALL BROWSER E2E TESTS PASSED SUCCESSFULLY!");
  } finally {
    try {
      chromeProc.kill("SIGTERM");
    } catch {}
  }
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
