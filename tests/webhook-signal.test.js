const assert = require("assert");
const orderService = require("../orderService");

const originalPlaceOrder = orderService.placeOrder;
let capturedOrder;
orderService.placeOrder = async (order) => {
  capturedOrder = order;
  return { data: { order_id: "TEST-WEBHOOK-1" } };
};

const { handleWebhook } = require("../webhookController");

async function run() {
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    }
  };

  await handleWebhook({
    body: [{
      TT: "BUY",
      E: "NFO",
      TS: "NIFTY26oct23000PE",
      instrument_type: "",
      Q: "1",
      OT: "MARKET",
      P: "NRML",
      VL: "DAY",
      AC: "SHIV",
      TP: 0,
      SL: 0
    }]
  }, response);

  assert.strictEqual(response.statusCode, 200);
  assert.strictEqual(response.body, "✅ Signal processed");
  assert.ok(capturedOrder, "valid signal should reach the order service");
  assert.strictEqual(capturedOrder.TS, "NIFTY26oct23000PE");
  assert.strictEqual(capturedOrder.target_points, null);
  assert.strictEqual(capturedOrder.stop_loss_points, null);
}

run()
  .then(() => console.log("webhook signal test passed"))
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    orderService.placeOrder = originalPlaceOrder;
  });