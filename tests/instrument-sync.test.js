const assert = require("assert");
const {
  startWeeklyInstrumentSync,
  stopWeeklyInstrumentSync
} = require("../instrumentStore");

async function run() {
  let syncCalls = 0;
  const timer = startWeeklyInstrumentSync(async () => {
    syncCalls += 1;
    return true;
  }, 5);

  assert.ok(timer, "weekly sync scheduler should return a timer");
  await new Promise((resolve) => setTimeout(resolve, 30));
  stopWeeklyInstrumentSync();

  assert.ok(syncCalls >= 1, "scheduler should run the instrument sync callback");
  console.log("instrument sync scheduler test passed");
}

run().catch((error) => {
  stopWeeklyInstrumentSync();
  console.error(error.stack || error.message);
  process.exitCode = 1;
});