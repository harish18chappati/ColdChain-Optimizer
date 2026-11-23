import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;
const TARGET_URL = "http://127.0.0.1:5000";

console.log("1. Starting Chrome headless with remote debugging...");
const tempProfile = path.join(process.env.TEMP || "C:\\Temp", "chrome_custom_profile_" + Date.now());
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
      if (res.ok) return await res.json();
    } catch {}
    await sleep(300);
  }
  throw new Error("Chrome CDP not ready.");
}

async function runTest() {
  try {
    await waitForCdp();
    const targetRes = await fetch(`http://127.0.0.1:${PORT}/json/new?${TARGET_URL}`, { method: "PUT" });
    const target = await targetRes.json();
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

    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const reqId = id++;
        pending.set(reqId, { resolve, reject });
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.navigate", { url: TARGET_URL });
    await sleep(2000);

    async function evaluate(expr) {
      const res = await send("Runtime.evaluate", {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        throw new Error("Evaluation error: " + JSON.stringify(res.exceptionDetails));
      }
      return res.result.value;
    }

    console.log("2. Verifying Sample Network Initial State...");
    const sampleState = await evaluate(`(async () => {
      document.getElementById('btn-run-kruskal').click();
      await new Promise(r => setTimeout(r, 600));
      return {
        backbone: document.getElementById('metric-backbone').textContent,
        facilities: document.getElementById('metric-facilities').textContent,
        candidates: document.getElementById('metric-candidates').textContent
      };
    })()`);
    console.log("Sample State:", sampleState);
    if (!sampleState.backbone.includes("Total Cost: 75") || !sampleState.facilities.includes("6 Nodes")) {
      throw new Error("Sample network check failed!");
    }
    console.log("✓ Sample network: 6 nodes, 9 candidates, Total Cost: 75");

    console.log("3. Testing Custom Builder Drawer Toggle & Validations...");
    const valTests = await evaluate(`(async () => {
      // Open drawer
      document.getElementById('btn-toggle-builder').click();
      await new Promise(r => setTimeout(r, 200));
      const drawerOpen = !document.getElementById('custom-drawer').classList.contains('hidden');

      // Test 1: Empty facility name
      document.getElementById('input-facility-name').value = '';
      document.getElementById('btn-add-facility').click();
      const errEmpty = document.getElementById('custom-val-error').textContent;

      // Test 2: Duplicate facility name
      document.getElementById('input-facility-name').value = 'Warehouse A (Central Cold Hub)';
      document.getElementById('btn-add-facility').click();
      const errDuplicate = document.getElementById('custom-val-error').textContent;

      // Test 3: Self-loop road (src == dest)
      document.getElementById('select-road-src').value = '0';
      document.getElementById('select-road-dest').value = '0';
      document.getElementById('input-road-weight').value = '10';
      document.getElementById('btn-add-road').click();
      const errSelfLoop = document.getElementById('custom-val-error').textContent;

      // Test 4: Negative/Zero weight
      document.getElementById('select-road-src').value = '0';
      document.getElementById('select-road-dest').value = '1';
      document.getElementById('input-road-weight').value = '-5';
      document.getElementById('btn-add-road').click();
      const errWeight = document.getElementById('custom-val-error').textContent;

      // Test 5: Duplicate road
      document.getElementById('select-road-src').value = '0';
      document.getElementById('select-road-dest').value = '2'; // 0 <-> 2 already exists
      document.getElementById('input-road-weight').value = '12';
      document.getElementById('btn-add-road').click();
      const errDupRoad = document.getElementById('custom-val-error').textContent;

      return {
        drawerOpen,
        errEmpty,
        errDuplicate,
        errSelfLoop,
        errWeight,
        errDupRoad
      };
    })()`);
    console.log("Validation Tests:", valTests);
    if (!valTests.drawerOpen) throw new Error("Drawer failed to open");
    if (!valTests.errEmpty.includes("empty")) throw new Error("Empty validation failed");
    if (!valTests.errDuplicate.includes("already exists")) throw new Error("Duplicate facility validation failed");
    if (!valTests.errSelfLoop.includes("Self-loops are not allowed")) throw new Error("Self-loop validation failed");
    if (!valTests.errWeight.includes("positive integer")) throw new Error("Weight validation failed");
    if (!valTests.errDupRoad.includes("already connects")) throw new Error("Duplicate road validation failed");
    console.log("✓ All 5 input validations passed!");

    console.log("4. Building a Custom 4-Node, 4-Road Network...");
    const customBuild = await evaluate(`(async () => {
      // Remove facilities until 1 remains
      while (true) {
        const delBtns = document.querySelectorAll('[data-del-facility]');
        if (delBtns.length <= 1) break;
        delBtns[delBtns.length - 1].click();
        await new Promise(r => setTimeout(r, 50));
      }

      // Rename first facility by replacing it
      document.getElementById('input-facility-name').value = 'Vaccine Central Hub';
      document.getElementById('btn-add-facility').click();
      await new Promise(r => setTimeout(r, 50));
      document.querySelector('[data-del-facility="0"]').click(); // remove the old leftover facility
      await new Promise(r => setTimeout(r, 50));

      // Add remaining 3 custom facilities
      const customNames = ['North District Clinic', 'South Regional Hospital', 'East Substation'];
      for (const name of customNames) {
        document.getElementById('input-facility-name').value = name;
        document.getElementById('btn-add-facility').click();
        await new Promise(r => setTimeout(r, 50));
      }

      // Add 4 custom roads:
      // 0 <-> 1 (wt: 10)
      // 1 <-> 2 (wt: 15)
      // 2 <-> 3 (wt: 20)
      // 0 <-> 3 (wt: 35) -> cycle corridor
      const roadsToAdd = [
        { s: '0', d: '1', w: '10' },
        { s: '1', d: '2', w: '15' },
        { s: '2', d: '3', w: '20' },
        { s: '0', d: '3', w: '35' }
      ];

      for (const r of roadsToAdd) {
        document.getElementById('select-road-src').value = r.s;
        document.getElementById('select-road-dest').value = r.d;
        document.getElementById('input-road-weight').value = r.w;
        document.getElementById('btn-add-road').click();
        await new Promise(r => setTimeout(r, 50));
      }

      // Close drawer
      document.getElementById('btn-close-drawer').click();
      await new Promise(r => setTimeout(r, 200));

      return {
        facCount: document.getElementById('custom-facility-count').textContent,
        roadCount: document.getElementById('custom-road-count').textContent,
        facilitiesMetric: document.getElementById('metric-facilities').textContent,
        candidatesMetric: document.getElementById('metric-candidates').textContent
      };
    })()`);
    console.log("Custom Build Summary:", customBuild);
    if (customBuild.facCount !== "4" || customBuild.roadCount !== "4") {
      throw new Error("Custom network build mismatch!");
    }
    console.log("✓ Custom network constructed: 4 facilities, 4 road corridors");

    console.log("5. Testing Kruskal and Prim on Custom Network...");
    const customSolve = await evaluate(`(async () => {
      // Run Kruskal
      document.getElementById('btn-run-kruskal').click();
      await new Promise(r => setTimeout(r, 600));
      const kruskalBackbone = document.getElementById('metric-backbone').textContent;
      const kruskalBadge = document.getElementById('algo-badge').textContent;

      // Run Prim
      document.getElementById('btn-run-prim').click();
      await new Promise(r => setTimeout(r, 600));
      const primBackbone = document.getElementById('metric-backbone').textContent;
      const primBadge = document.getElementById('algo-badge').textContent;

      return {
        kruskalBackbone,
        kruskalBadge,
        primBackbone,
        primBadge
      };
    })()`);
    console.log("Custom Solve Results:", customSolve);
    // Expected MST cost: 10 + 15 + 20 = 45 across 3 active lanes!
    if (!customSolve.kruskalBackbone.includes("Total Cost: 45") || !customSolve.kruskalBackbone.includes("3 Active Lanes")) {
      throw new Error("Custom Kruskal should yield 3 Active Lanes · Total Cost: 45!");
    }
    if (!customSolve.primBackbone.includes("Total Cost: 45") || !customSolve.primBackbone.includes("3 Active Lanes")) {
      throw new Error("Custom Prim should yield 3 Active Lanes · Total Cost: 45!");
    }
    console.log("✓ Both Kruskal and Prim correctly solved custom network: 3 Active Lanes, Total Cost: 45!");

    console.log("6. Testing Step-by-Step Mode on Custom Network...");
    const customStepTest = await evaluate(`(async () => {
      document.getElementById('btn-run-kruskal').click();
      document.getElementById('btn-mode-step').click();
      await new Promise(r => setTimeout(r, 300));

      const step0 = document.getElementById('current-step-num').textContent;
      const totalSteps = document.getElementById('total-step-num').textContent;

      // Step forward 4 times (3 accepted, 1 rejected cycle)
      const stepHistory = [];
      for (let i = 0; i < 4; i++) {
        document.getElementById('btn-step-next').click();
        await new Promise(r => setTimeout(r, 100));
        stepHistory.push({
          step: document.getElementById('current-step-num').textContent,
          badge: document.getElementById('step-status-badge').textContent,
          corridor: document.getElementById('step-corridor').textContent,
          backbone: document.getElementById('metric-backbone').textContent
        });
      }

      return { step0, totalSteps, stepHistory };
    })()`);
    console.log("Custom Step-by-Step:", JSON.stringify(customStepTest, null, 2));
    if (customStepTest.totalSteps !== "4") throw new Error("Expected 4 total steps in custom network");
    if (!customStepTest.stepHistory[3].backbone.includes("Total Cost: 45")) {
      throw new Error("Step-by-step should finish at Total Cost: 45");
    }
    console.log("✓ Step-by-Step mode verified on custom network!");

    console.log("7. Testing 'Load Sample Network' Button...");
    const loadSampleTest = await evaluate(`(async () => {
      document.getElementById('btn-toggle-builder').click();
      await new Promise(r => setTimeout(r, 200));
      document.getElementById('btn-load-sample').click();
      await new Promise(r => setTimeout(r, 600));

      // Switch to instant mode
      document.getElementById('btn-mode-instant').click();
      await new Promise(r => setTimeout(r, 200));

      return {
        facilities: document.getElementById('metric-facilities').textContent,
        candidates: document.getElementById('metric-candidates').textContent,
        backbone: document.getElementById('metric-backbone').textContent
      };
    })()`);
    console.log("Load Sample Test Result:", loadSampleTest);
    if (!loadSampleTest.facilities.includes("6 Nodes") || !loadSampleTest.candidates.includes("9 Evaluated") || !loadSampleTest.backbone.includes("Total Cost: 75")) {
      throw new Error("Load sample network failed to restore original 6-node network!");
    }
    console.log("✓ Sample network successfully restored (6 nodes, 9 roads, Cost: 75)!");

    // Capture screenshot
    const screenshotData = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(process.cwd(), "custom_network_test_screenshot.png"), Buffer.from(screenshotData.data, "base64"));
    console.log("✓ Screenshot saved to custom_network_test_screenshot.png");

    ws.close();
    console.log("ALL CUSTOM NETWORK E2E TESTS PASSED PERFECTLY!");
  } finally {
    try { chromeProc.kill("SIGTERM"); } catch {}
  }
}

runTest().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
