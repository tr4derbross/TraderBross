const vault = new Map();

function generateToken() {
  return crypto.randomUUID();
}

export function storeSecret(scope, payload) {
  const token = generateToken();
  vault.set(token, {
    scope,
    payload,
    createdAt: Date.now(),
  });
  return token;
}

export function getSecret(token) {
  return vault.get(token) || null;
}

export function clearSecret(token) {
  return vault.delete(token);
}
