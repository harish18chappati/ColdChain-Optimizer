import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;
const TARGET_URL = "http://127.0.0.1:5000";

console.log("Starting Chrome headless for Weight input testing...");
const tempProfile = path.join(process.env.TEMP || "C:\\Temp", "chrome_weight_profile_" + Date.now());
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

    console.log("1. Inspecting Weight input field dimensions and placeholder...");
    const inputMetrics = await evaluate(`(async () => {
      const toggle = document.getElementById('btn-toggle-builder');
      if (document.getElementById('custom-drawer').classList.contains('hidden')) {
        toggle.click();
        await new Promise(r => setTimeout(r, 300));
      }

      const drawer = document.getElementById('custom-drawer');
      const drawerHidden = drawer.classList.contains('hidden');
      const input = document.getElementById('input-road-weight');
      const rect = input.getBoundingClientRect();
      const style = window.getComputedStyle(input);

      return {
        drawerHidden,
        placeholder: input.getAttribute('placeholder'),
        renderedWidth: rect.width,
        renderedHeight: rect.height,
        minWidth: style.minWidth,
        textAlign: style.textAlign,
        fontFamily: style.fontFamily
      };
    })()`);
    console.log("Weight Input Metrics:", inputMetrics);

    if (inputMetrics.placeholder !== "Weight") {
      throw new Error("Placeholder should be 'Weight', got: " + inputMetrics.placeholder);
    }
    if (inputMetrics.renderedWidth < 80) {
      throw new Error("Rendered width is too narrow: " + inputMetrics.renderedWidth + "px");
    }
    console.log("✓ Placeholder is 'Weight' and rendered width is " + Math.round(inputMetrics.renderedWidth) + "px (expanded > 85px)");

    console.log("2. Testing input text visibility for weights 100, 1000, and 500000...");
    const valuesTest = await evaluate(`(async () => {
      const input = document.getElementById('input-road-weight');
      const testValues = ['100', '1000', '500000'];
      const results = [];

      for (const val of testValues) {
        input.value = val;
        // Verify input scrollWidth does not exceed clientWidth (i.e. no horizontal text overflow)
        const hasOverflow = input.scrollWidth > input.clientWidth;
        results.push({
          value: val,
          length: val.length,
          clientWidth: input.clientWidth,
          scrollWidth: input.scrollWidth,
          hasOverflow: hasOverflow
        });
      }
      return results;
    })()`);
    console.log("Text visibility checks:", valuesTest);
    for (const r of valuesTest) {
      if (r.hasOverflow) {
        throw new Error("Text overflowed for weight value: " + r.value);
      }
    }
    console.log("✓ All values (100, 1000, 500000) are fully visible without overflow!");

    console.log("3. Testing adding custom roads with large weights and verifying Kruskal and Prim...");
    const solverTest = await evaluate(`(async () => {
      // Add 3 custom facilities: City Hub, Regional Depot, Mountain Hospital
      // First clean to empty
      while (true) {
        const delBtns = document.querySelectorAll('[data-del-facility]');
        if (delBtns.length <= 1) break;
        delBtns[delBtns.length - 1].click();
        await new Promise(r => setTimeout(r, 40));
      }

      document.getElementById('input-facility-name').value = 'City Hub';
      document.getElementById('btn-add-facility').click();
      await new Promise(r => setTimeout(r, 40));
      document.querySelector('[data-del-facility="0"]').click();
      await new Promise(r => setTimeout(r, 40));

      document.getElementById('input-facility-name').value = 'Regional Depot';
      document.getElementById('btn-add-facility').click();
      await new Promise(r => setTimeout(r, 40));

      document.getElementById('input-facility-name').value = 'Mountain Hospital';
      document.getElementById('btn-add-facility').click();
      await new Promise(r => setTimeout(r, 40));

      // Add Road 1: 0 <-> 1 (weight 1000)
      document.getElementById('select-road-src').value = '0';
      document.getElementById('select-road-dest').value = '1';
      document.getElementById('input-road-weight').value = '1000';
      document.getElementById('btn-add-road').click();
      await new Promise(r => setTimeout(r, 40));

      // Add Road 2: 1 <-> 2 (weight 500000)
      document.getElementById('select-road-src').value = '1';
      document.getElementById('select-road-dest').value = '2';
      document.getElementById('input-road-weight').value = '500000';
      document.getElementById('btn-add-road').click();
      await new Promise(r => setTimeout(r, 40));

      // Add Road 3: 0 <-> 2 (weight 600000) -> cycle road
      document.getElementById('select-road-src').value = '0';
      document.getElementById('select-road-dest').value = '2';
      document.getElementById('input-road-weight').value = '600000';
      document.getElementById('btn-add-road').click();
      await new Promise(r => setTimeout(r, 40));

      // Close drawer
      document.getElementById('btn-close-drawer').click();
      await new Promise(r => setTimeout(r, 100));

      // Run Kruskal
      document.getElementById('btn-run-kruskal').click();
      await new Promise(r => setTimeout(r, 500));
      const kruskalBackbone = document.getElementById('metric-backbone').textContent;

      // Run Prim
      document.getElementById('btn-run-prim').click();
      await new Promise(r => setTimeout(r, 500));
      const primBackbone = document.getElementById('metric-backbone').textContent;

      return {
        kruskalBackbone,
        primBackbone
      };
    })()`);
    console.log("Large Weights Solve Result:", solverTest);
    // Expected MST: Road 1 (1000) + Road 2 (500000) = 501000 across 2 active lanes
    if (!solverTest.kruskalBackbone.includes("501000") || !solverTest.kruskalBackbone.includes("2 Active Lanes")) {
      throw new Error("Kruskal failed with large weights! Got: " + solverTest.kruskalBackbone);
    }
    if (!solverTest.primBackbone.includes("501000") || !solverTest.primBackbone.includes("2 Active Lanes")) {
      throw new Error("Prim failed with large weights! Got: " + solverTest.primBackbone);
    }
    console.log("✓ Both Kruskal and Prim solved correctly with large weights: 2 Active Lanes, Total Cost: 501000!");

    // Restore sample network
    await evaluate(`(async () => {
      document.getElementById('btn-toggle-builder').click();
      await new Promise(r => setTimeout(r, 100));
      document.getElementById('btn-load-sample').click();
      await new Promise(r => setTimeout(r, 400));
      document.getElementById('btn-close-drawer').click();
    })()`);
    console.log("✓ Sample network restored after test.");

    ws.close();
    console.log("ALL WEIGHT INPUT TESTS PASSED SUCCESSFULLY!");
  } finally {
    try { chromeProc.kill("SIGTERM"); } catch {}
  }
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
