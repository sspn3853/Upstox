const assert = require("assert");
const Trade = require("../models/Trade");
const profitBooking = require("../profitBooking");

const originalTableName = Trade.tableName;

async function run() {
  Trade.tableName = "position_recovery_test";
  profitBooking.activePositions.clear();
  await Trade.clearAll();

  await Trade.create({
    orderId: "RECOVERY-OPEN-1",
    instrument: "NSE_EQ|TEST",
    trading_symbol: "TEST",
    exchange: "NSE",
    side: "BUY",
    quantity: 10,
    requested_quantity: 10,
    filled_qty: 3,
    entry_price: 100,
    target_points: 10,
    stop_loss_points: 5,
    status: "CLOSED",
    profit_booking_status: "MONITORING",
    profit_booked: false
  });

  await profitBooking.restoreActivePositions();
  assert.strictEqual(profitBooking.activePositions.has("RECOVERY-OPEN-1"), true);
  assert.strictEqual(profitBooking.activePositions.get("RECOVERY-OPEN-1").orderQuantity, 3);

  await Trade.updateOne(
    { orderId: "RECOVERY-OPEN-1" },
    { profit_booking_status: "BOOKED", profit_booked: true }
  );
  profitBooking.activePositions.clear();
  await profitBooking.restoreActivePositions();
  assert.strictEqual(profitBooking.activePositions.has("RECOVERY-OPEN-1"), false);
}

run()
  .then(() => console.log("position recovery test passed"))
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    profitBooking.activePositions.clear();
    await Trade.clearAll();
    Trade.tableName = originalTableName;
  });