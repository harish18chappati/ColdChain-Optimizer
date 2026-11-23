import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;
const TARGET_URL = "http://127.0.0.1:5000";

console.log("1. Starting Chrome headless with remote debugging...");
const tempProfile = path.join(process.env.TEMP || "C:\\Temp", "chrome_step_profile_" + Date.now());
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

    console.log("2. Verifying Instant Mode execution for Kruskal...");
    const instantKruskal = await evaluate(`(async () => {
      document.getElementById('btn-run-kruskal').click();
      await new Promise(r => setTimeout(r, 600));
      return {
        badge: document.getElementById('algo-badge').textContent,
        backbone: document.getElementById('metric-backbone').textContent,
        activeLanes: Array.from(document.querySelectorAll('.edges-mst line:not(.pulse-flow)'))
          .filter(l => l.getAttribute('stroke') === '#FF6542').length
      };
    })()`);
    console.log("Instant Kruskal:", instantKruskal);
    if (!instantKruskal.backbone.includes("Total Cost: 75") || instantKruskal.activeLanes !== 5) {
      throw new Error("Instant Kruskal failed!");
    }
    console.log("✓ Instant Kruskal: 5 active lanes, Total Cost: 75");

    console.log("3. Switching to Step-by-Step Mode...");
    const stepModeInit = await evaluate(`(async () => {
      document.getElementById('btn-mode-step').click();
      await new Promise(r => setTimeout(r, 300));
      return {
        stepBarVisible: !document.getElementById('step-bar').classList.contains('is-instant-mode'),
        stepNum: document.getElementById('current-step-num').textContent,
        totalSteps: document.getElementById('total-step-num').textContent,
        prevDisabled: document.getElementById('btn-step-prev').disabled,
        nextDisabled: document.getElementById('btn-step-next').disabled,
        statusText: document.getElementById('step-status-badge').textContent,
        backbone: document.getElementById('metric-backbone').textContent
      };
    })()`);
    console.log("Step Mode Initialized:", stepModeInit);
    if (!stepModeInit.stepBarVisible) throw new Error("Step bar should be visible in step mode");
    if (stepModeInit.stepNum !== "Step 0") throw new Error("Should be at Step 0");
    if (stepModeInit.totalSteps !== "9") throw new Error("Kruskal should have 9 total steps (Option 2)");
    if (!stepModeInit.prevDisabled) throw new Error("Prev should be disabled at step 0");
    if (stepModeInit.nextDisabled) throw new Error("Next should be enabled at step 0");
    console.log("✓ Step Mode initialized at Step 0 of 9, Prev disabled, Next enabled");

    console.log("4. Stepping through all 9 Kruskal decisions...");
    for (let step = 1; step <= 9; step++) {
      const stepState = await evaluate(`(async () => {
        document.getElementById('btn-step-next').click();
        await new Promise(r => setTimeout(r, 100));
        return {
          stepNum: document.getElementById('current-step-num').textContent,
          badge: document.getElementById('step-status-badge').textContent,
          corridor: document.getElementById('step-corridor').textContent,
          explanation: document.getElementById('step-explanation').textContent,
          backbone: document.getElementById('metric-backbone').textContent,
          nextDisabled: document.getElementById('btn-step-next').disabled,
          prevDisabled: document.getElementById('btn-step-prev').disabled
        };
      })()`);
      console.log("  [" + stepState.stepNum + "] Status: " + stepState.badge + " | " + stepState.corridor + " | " + stepState.backbone);

      if (step <= 5) {
        if (!stepState.badge.toLowerCase().includes("accepted")) {
          throw new Error("Step " + step + " should be ACCEPTED, got " + stepState.badge);
        }
      } else {
        if (!stepState.badge.toLowerCase().includes("rejected") && !stepState.badge.toLowerCase().includes("complete")) {
          throw new Error("Step " + step + " should be REJECTED, got " + stepState.badge);
        }
      }

      if (step === 9) {
        if (!stepState.nextDisabled) throw new Error("Next button should be disabled at final step");
        if (stepState.prevDisabled) throw new Error("Prev button should be enabled at final step");
        if (!stepState.backbone.includes("Total Cost: 75")) throw new Error("Final step must show Total Cost: 75");
      }
    }
    console.log("✓ All 9 Kruskal steps verified: 5 accepted, 4 rejected, Final Total Cost: 75!");

    console.log("5. Testing Step Back (Prev) and Reset...");
    const prevCheck = await evaluate(`(async () => {
      document.getElementById('btn-step-prev').click(); // to Step 8
      await new Promise(r => setTimeout(r, 100));
      const s8 = document.getElementById('current-step-num').textContent;
      document.getElementById('btn-step-prev').click(); // to Step 7
      await new Promise(r => setTimeout(r, 100));
      const s7 = document.getElementById('current-step-num').textContent;

      document.getElementById('btn-step-reset').click(); // to Step 0
      await new Promise(r => setTimeout(r, 100));
      const s0 = document.getElementById('current-step-num').textContent;
      const prevDis = document.getElementById('btn-step-prev').disabled;
      const backbone0 = document.getElementById('metric-backbone').textContent;

      return { s8, s7, s0, prevDis, backbone0 };
    })()`);
    console.log("Prev and Reset Results:", prevCheck);
    if (prevCheck.s8 !== "Step 8" || prevCheck.s7 !== "Step 7" || prevCheck.s0 !== "Step 0") {
      throw new Error("Step backward / reset failed!");
    }
    if (!prevCheck.prevDis) throw new Error("Prev should be disabled at Step 0");
    if (!prevCheck.backbone0.includes("Cost: 0")) throw new Error("Backbone should reset to Cost: 0");
    console.log("✓ Prev and Reset successfully restore step count, buttons, and visual state!");

    console.log("6. Testing Prim in Step-by-Step Mode...");
    const primStepsCheck = await evaluate(`(async () => {
      document.getElementById('btn-run-prim').click();
      await new Promise(r => setTimeout(r, 600));
      const totalPrimSteps = document.getElementById('total-step-num').textContent;
      const step0 = document.getElementById('current-step-num').textContent;

      // Click next 5 times
      for (let i = 0; i < 5; i++) {
        document.getElementById('btn-step-next').click();
        await new Promise(r => setTimeout(r, 100));
      }

      return {
        totalPrimSteps,
        step0,
        finalStepNum: document.getElementById('current-step-num').textContent,
        finalBadge: document.getElementById('step-status-badge').textContent,
        backbone: document.getElementById('metric-backbone').textContent,
        nextDisabled: document.getElementById('btn-step-next').disabled
      };
    })()`);
    console.log("Prim Step-by-Step Result:", primStepsCheck);
    if (primStepsCheck.totalPrimSteps !== "5") throw new Error("Prim must have exactly 5 genuine steps");
    if (primStepsCheck.finalStepNum !== "Step 5") throw new Error("Prim should reach Step 5");
    if (!primStepsCheck.backbone.includes("Total Cost: 75") || !primStepsCheck.backbone.includes("5 Active Lanes")) {
      throw new Error("Prim must finish with 5 Active Lanes · Total Cost: 75");
    }
    if (!primStepsCheck.nextDisabled) throw new Error("Next should be disabled at Prim step 5");
    console.log("✓ Prim Step-by-Step: genuine 5 steps, zero extra steps, Final Total Cost: 75!");

    console.log("7. Switching back to Instant Mode...");
    const instantReturn = await evaluate(`(async () => {
      document.getElementById('btn-mode-instant').click();
      await new Promise(r => setTimeout(r, 200));
      return {
        stepBarHidden: document.getElementById('step-bar').classList.contains('is-instant-mode'),
        backbone: document.getElementById('metric-backbone').textContent,
        algoBadge: document.getElementById('algo-badge').textContent
      };
    })()`);
    console.log("Instant Mode Return:", instantReturn);
    if (!instantReturn.stepBarHidden) throw new Error("Step bar should be hidden in instant mode");
    console.log("✓ Instant Mode successfully toggles back!");

    // Capture screenshot of completed step mode
    await evaluate(`document.getElementById('btn-mode-step').click();`);
    const screenshotData = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(process.cwd(), "step_by_step_screenshot.png"), Buffer.from(screenshotData.data, "base64"));
    console.log("✓ Saved verification screenshot to step_by_step_screenshot.png");

    ws.close();
    console.log("ALL STEP-BY-STEP E2E TESTS PASSED PERFECTLY!");
  } finally {
    try { chromeProc.kill("SIGTERM"); } catch {}
  }
}

runTest().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
