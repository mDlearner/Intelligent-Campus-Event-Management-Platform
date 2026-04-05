function sanitizeStringValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  // Normalize and trim user input while preserving intentional spaces in between words.
  return value.normalize("NFKC").trim();
}

function sanitizeObject(target) {
  if (!target || typeof target !== "object") {
    return target;
  }

  if (Array.isArray(target)) {
    return target.map((item) => sanitizeObject(item));
  }

  const output = {};
  for (const [key, rawValue] of Object.entries(target)) {
    const value = sanitizeObject(rawValue);
    output[key] = sanitizeStringValue(value);
  }

  return output;
}

function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === "object") {
    req.query = sanitizeObject(req.query);
  }

  if (req.params && typeof req.params === "object") {
    req.params = sanitizeObject(req.params);
  }

  return next();
}

module.exports = sanitizeInput;
