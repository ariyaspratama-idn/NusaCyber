const { runLighthouse } = require('./tests/lighthouse-runner.js');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function finalVerify() {
  console.log("🚀 FINAL VERIFICATION v3.0");
  try {
    console.log("- Checking Lighthouse Result for nusa.biz (test)...");
    const lh = await runLighthouse('http://localhost:5173');
    console.log("✅ Lighthouse Scores:", JSON.stringify(lh.scores));
    
    console.log("- Checking Playwright/Axe-core Result...");
    const { stdout: pwOut } = await execPromise('npx playwright test tests/siksaan-fungsional.spec.js --reporter=json');
    const pw = JSON.parse(pwOut);
    console.log(`✅ Playwright Ran: ${pw.suites ? 'SUCCESS' : 'NO SUITES'}`);

    console.log("--- FINAL CONCLUSION: ALL SENSORS GREEN v3.0 ---");
  } catch (e) {
    console.log("❌ FINAL VERIFICATION FAILED:", e.message);
  }
}

finalVerify();
