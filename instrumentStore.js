const fs = require("fs");
const path = require("path");

const syncInstruments = require("./syncInstruments");

// ==============================
const DATA_DIR = path.join(__dirname, "data");
const FILE_PATH = path.join(DATA_DIR, "instruments.csv");
const WEEKLY_SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const SYNC_RETRY_INTERVAL_MS = 24 * 60 * 60 * 1000;

let instrumentCache = null;
let weeklySyncTimer = null;
let weeklySyncStopped = true;

// ==============================
function normalize(str) {
  if (!str) return "";
  return str
    .replace(/"/g, "")
    .replace(/\s+/g, "")
    .replace(/\r/g, "")
    .trim()
    .toUpperCase();
}

// ==============================
async function ensureLocalFile(forceRefresh = false) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log("📁 Created data directory");
    }

    if (fs.existsSync(FILE_PATH)) {
      const stats = fs.statSync(FILE_PATH);
      const mtime = new Date(stats.mtime);
      const now = new Date();
      const diffDays =
        (now.getTime() - mtime.getTime()) / (1000 * 60 * 60 * 24);

      if (forceRefresh) {
        console.log("🔄 Forced refresh requested for instrument CSV...");
      } else if (diffDays < 7) {
        console.log("📁 Instrument CSV already exists (Updated < 7 days ago)");
        return true;
      } else {
        console.log(
          `⚠️ Instrument CSV is older than 7 days (${Math.floor(
            diffDays
          )} days old). Refreshing...`
        );
      }
    } else {
      console.log("⚠️ Instrument CSV not found. Syncing...");
    }

    const result = await syncInstruments();
    if (result && result.success) {
      instrumentCache = null;
      return true;
    }

    return false;
  } catch (err) {
    console.log("❌ ensureLocalFile:", err.message);
    return false;
  }
}

function startWeeklyInstrumentSync(
  sync = () => ensureLocalFile(true),
  intervalMs = WEEKLY_SYNC_INTERVAL_MS
) {
  if (weeklySyncTimer || !weeklySyncStopped) return weeklySyncTimer;

  weeklySyncStopped = false;

  const scheduleNext = (delay) => {
    weeklySyncTimer = setTimeout(runSync, delay);
    weeklySyncTimer.unref?.();
  };

  const runSync = async () => {
    weeklySyncTimer = null;
    let succeeded = false;

    try {
      succeeded = await sync();
    } catch (err) {
      console.error("❌ Weekly instrument sync failed:", err.message);
    }

    if (!weeklySyncStopped) {
      scheduleNext(succeeded ? intervalMs : SYNC_RETRY_INTERVAL_MS);
    }
  };

  scheduleNext(getInitialSyncDelay(intervalMs));
  return weeklySyncTimer;
}

function stopWeeklyInstrumentSync() {
  weeklySyncStopped = true;
  if (weeklySyncTimer) clearTimeout(weeklySyncTimer);
  weeklySyncTimer = null;
}

function getInitialSyncDelay(intervalMs) {
  if (intervalMs !== WEEKLY_SYNC_INTERVAL_MS || !fs.existsSync(FILE_PATH)) {
    return intervalMs;
  }

  const lastUpdated = fs.statSync(FILE_PATH).mtimeMs;
  return Math.max(0, lastUpdated + intervalMs - Date.now());
}

// ==============================
function loadInstrumentCache() {
  if (instrumentCache) return instrumentCache;

  instrumentCache = new Map();

  try {
    const data = fs.readFileSync(FILE_PATH, "utf-8");
    const lines = data.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // ✅ FIXED CSV PARSER (handles commas inside quotes)
      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

      // skip header
      if (i === 0 && cols[0]?.toLowerCase().includes("instrument")) continue;

      // columns:
      // trading_symbol,name,instrument_key,exchange,instrument_type,expiry,lot_size,strike_price,segment
      const trading_symbol = cols[0]?.trim();
      const name = cols[1]?.trim().replace(/"/g, "");
      const instrument_key = cols[2]?.trim();
      const exchange = cols[3]?.trim().replace(/"/g, "");
      const instrument_type = cols[4]?.trim().replace(/"/g, "");
      const expiry = cols[5]?.trim().replace(/"/g, "");
      const lot_size_raw = cols[6]?.trim();
      const strike_price = cols[7]?.trim().replace(/"/g, "");
      const segment = cols[8]?.trim().replace(/"/g, "");

      if (!instrument_key || !trading_symbol) continue;

      const normalizedSymbol = normalize(trading_symbol);
      const normalizedKey = instrument_key.replace(/"/g, "");

      // ✅ SAFE LOT SIZE PARSE
      const lot_size =
        Number(lot_size_raw?.replace(/"/g, "").trim()) || 1;

      instrumentCache.set(normalizedSymbol, {
        instrument_key: normalizedKey,
        lot_size,
        trading_symbol: trading_symbol.replace(/"/g, ""),
        name,
        exchange,
        instrument_type,
        expiry: expiry.replace(/"/g, ""),
        strike_price: Number(strike_price),
        segment
      });

      // 🔍 Optional debug (enable if needed)
      // if (normalizedSymbol.includes("SBIN")) {
      //   console.log("DEBUG:", { trading_symbol, instrument_key, lot_size });
      // }
    }

    console.log("✅ Instrument cache loaded:", instrumentCache.size);
  } catch (err) {
    console.log("❌ Cache load error:", err.message);
  }

  return instrumentCache;
}

const MONTH_NAME_MAP = {
  1: "JAN",
  2: "FEB",
  3: "MAR",
  4: "APR",
  5: "MAY",
  6: "JUN",
  7: "JUL",
  8: "AUG",
  9: "SEP",
  O: "OCT",
  N: "NOV",
  D: "DEC",
  JAN: "JAN",
  FEB: "FEB",
  MAR: "MAR",
  APR: "APR",
  MAY: "MAY",
  JUN: "JUN",
  JUL: "JUL",
  AUG: "AUG",
  SEP: "SEP",
  OCT: "OCT",
  NOV: "NOV",
  DEC: "DEC"
};

const MONTH_NUMBER_MAP = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12"
};

function getLookupCandidates(symbol) {
  const candidates = new Set();

  if (!symbol) return [];

  const base = normalize(symbol);
  const stripped = base.replace(/[^A-Z0-9]/g, "");

  if (base) candidates.add(base);
  if (stripped) candidates.add(stripped);

  const compactMatch = base.match(/^([A-Z]+)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/);

  if (compactMatch) {
    const [, rawSymbol, year, monthCode, day, strike, optionType] = compactMatch;
    const month = MONTH_NAME_MAP[monthCode] || monthCode;
    const yearFull = year.length === 2 ? `20${year}` : year;

    const variants = [
      `${rawSymbol}${strike}${optionType}${day}${month}${year}`,
      `${rawSymbol}${strike}${optionType}${day}${month}${yearFull}`,
      `${rawSymbol} ${strike} ${optionType} ${day} ${month} ${year}`,
      `${rawSymbol} ${strike} ${optionType} ${day} ${month} ${yearFull}`,
      `${rawSymbol} ${day} ${month} ${year} ${strike} ${optionType}`,
      `${rawSymbol} ${day} ${month} ${yearFull} ${strike} ${optionType}`,
      `${rawSymbol}${day}${month}${year}${strike}${optionType}`,
      `${rawSymbol}${day}${month}${yearFull}${strike}${optionType}`
    ];

    for (const variant of variants) {
      candidates.add(variant);
      candidates.add(normalize(variant));
      candidates.add(variant.replace(/[^A-Z0-9]/g, ""));
    }
  }

  return [...candidates];
}

function getFutureIdentity(symbol) {
  const normalized = normalize(symbol);
  const monthPattern = "(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)";
  const compactMatch = normalized.match(new RegExp(`^([A-Z]+)(\\d{2})${monthPattern}FUT$`));
  const formattedMatch = normalized.match(new RegExp(`^([A-Z]+)FUT(?:\\d{1,2})?${monthPattern}(\\d{2}|\\d{4})$`));

  if (compactMatch) {
    return {
      symbol: compactMatch[1],
      month: compactMatch[3],
      year: compactMatch[2].slice(-2)
    };
  }

  if (formattedMatch) {
    return {
      symbol: formattedMatch[1],
      month: formattedMatch[2],
      year: formattedMatch[3].slice(-2)
    };
  }

  return null;
}

function findOptionByContractMonth(contract) {
  const month = MONTH_NUMBER_MAP[String(contract.month || "").toUpperCase()];
  const year = `20${String(contract.year).slice(-2)}`;
  const expectedSegment = contract.exchange === "NFO" ? "NSE_FO" : contract.exchange;

  if (!month || !contract.symbol || !contract.optionType || !Number.isFinite(Number(contract.strike))) {
    return null;
  }

  const candidates = [...loadInstrumentCache().values()].filter((row) =>
    row.name?.toUpperCase() === String(contract.symbol).toUpperCase() &&
    row.instrument_type?.toUpperCase() === String(contract.optionType).toUpperCase() &&
    row.strike_price === Number(contract.strike) &&
    row.expiry?.startsWith(`${year}-${month}-`) &&
    (!expectedSegment || row.segment?.toUpperCase() === String(expectedSegment).toUpperCase())
  );

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.expiry.localeCompare(a.expiry));
  const row = candidates[0];

  return {
    instrument_key: row.instrument_key,
    instrument_token: row.instrument_key,
    lot_size: row.lot_size,
    trading_symbol: row.trading_symbol
  };
}

// ==============================
// 🔥 FINAL MATCH
// ==============================
function findInstrument(symbol) {
  const cache = loadInstrumentCache();
  const normalizedInput = normalize(symbol);
  const candidates = getLookupCandidates(normalizedInput);
  const futureIdentity = getFutureIdentity(normalizedInput);

  if (futureIdentity) {
    const futurePattern = new RegExp(
      `^${futureIdentity.symbol}FUT\\d{1,2}${futureIdentity.month}${futureIdentity.year}$`
    );

    for (const [cacheKey, row] of cache.entries()) {
      if (futurePattern.test(normalize(cacheKey))) {
        console.log(
          "🎯 FOUND FUTURE:",
          cacheKey,
          "→",
          row.instrument_key,
          "| Lot:",
          row.lot_size
        );

        return {
          instrument_key: row.instrument_key,
          instrument_token: row.instrument_key,
          lot_size: row.lot_size
        };
      }
    }
  }

  for (const candidate of candidates) {
    const row = cache.get(candidate) || cache.get(normalize(candidate));
    if (row) {
      console.log(
        "🎯 FOUND:",
        candidate,
        "→",
        row.instrument_key,
        "| Lot:",
        row.lot_size
      );

      return {
        instrument_key: row.instrument_key,
        instrument_token: row.instrument_key,
        lot_size: row.lot_size
      };
    }
  }

  const directMatch = cache.get(normalizedInput) || cache.get(normalizedInput.replace(/[^A-Z0-9]/g, ""));
  if (directMatch) {
    console.log(
      "🎯 FOUND EXACT:",
      normalizedInput,
      "→",
      directMatch.instrument_key,
      "| Lot:",
      directMatch.lot_size
    );

    return {
      instrument_key: directMatch.instrument_key,
      instrument_token: directMatch.instrument_key,
      lot_size: directMatch.lot_size
    };
  }

  console.log("⚠️ NOT FOUND:", normalizedInput);
  return null;
}

// ==============================
module.exports = {
  ensureLocalFile,
  startWeeklyInstrumentSync,
  stopWeeklyInstrumentSync,
  loadInstrumentCache,
  findInstrument,
  findOptionByContractMonth,
  getLookupCandidates,
  getFutureIdentity
};
