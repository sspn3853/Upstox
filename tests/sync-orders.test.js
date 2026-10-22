const assert = require("assert");
const axios = require("axios");
const tokenManager = require("../tokenManager");
const Trade = require("../models/Trade");

const originalGet = axios.get;
const originalGetAccessToken = tokenManager.getAccessToken;
const originalTableName = Trade.tableName;

async function run() {
  Trade.tableName = "sync_orders_test";
  tokenManager.getAccessToken = () => "test-access-token";
  axios.get = async () => ({ data: { data: [] } });

  await Trade.clearAll();
  await Trade.create({
    orderId: "BROKER-MISSING-ORDER-1",
    side: "BUY",
    quantity: 1,
    trading_symbol: "GOLDPETAL FUT 31 DEC 26",
    status: "OPEN"
  });

  const { syncOrders } = require("../syncService");
  await syncOrders();

  const trade = await Trade.findOne({ orderId: "BROKER-MISSING-ORDER-1" });
  assert.strictEqual(trade.status, "OPEN", "missing broker-list entry must not close a local trade");
}

run()
  .then(() => console.log("order reconciliation test passed"))
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Trade.clearAll();
    Trade.tableName = originalTableName;
    axios.get = originalGet;
    tokenManager.getAccessToken = originalGetAccessToken;
  });