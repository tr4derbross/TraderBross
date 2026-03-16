function serialize(meta) {
  if (!meta) {
    return "";
  }

  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return " {\"meta\":\"unserializable\"}";
  }
}

export function createLogger(level = "info") {
  const activeLevels = new Set(["debug", "info", "warn", "error"]);
  const currentLevel = activeLevels.has(level) ? level : "info";
  const rank = { debug: 10, info: 20, warn: 30, error: 40 };

  const log = (targetLevel, message, meta) => {
    if (rank[targetLevel] < rank[currentLevel]) {
      return;
    }

    const stamp = new Date().toISOString();
    const line = `[${stamp}] ${targetLevel.toUpperCase()} ${message}${serialize(meta)}`;
    const fn = targetLevel === "error" ? console.error : targetLevel === "warn" ? console.warn : console.log;
    fn(line);
  };

  return {
    debug(message, meta) {
      log("debug", message, meta);
    },
    info(message, meta) {
      log("info", message, meta);
    },
    warn(message, meta) {
      log("warn", message, meta);
    },
    error(message, meta) {
      log("error", message, meta);
    },
  };
}
