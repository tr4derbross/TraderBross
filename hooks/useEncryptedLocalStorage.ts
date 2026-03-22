"use client";

import { useCallback } from "react";

const DEVICE_SECRET_KEY = "traderbross.device.secret.v1";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getOrCreateDeviceSecret() {
  if (!isBrowser()) return "";
  const existing = window.localStorage.getItem(DEVICE_SECRET_KEY);
  if (existing) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const next = toBase64(bytes);
  window.localStorage.setItem(DEVICE_SECRET_KEY, next);
  return next;
}

async function deriveAesKey(namespace: string) {
  const encoder = new TextEncoder();
  const secretMaterial = `${namespace}:${getOrCreateDeviceSecret()}`;
  const source = await crypto.subtle.digest("SHA-256", encoder.encode(secretMaterial));
  return crypto.subtle.importKey("raw", source, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

type CipherEnvelope = {
  iv: string;
  data: string;
};

async function encryptJson<T>(namespace: string, value: T) {
  const key = await deriveAesKey(namespace);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(ciphertext)),
  } satisfies CipherEnvelope;
}

async function decryptJson<T>(namespace: string, envelope: CipherEnvelope): Promise<T | null> {
  const key = await deriveAesKey(namespace);
  const iv = fromBase64(envelope.iv);
  const data = fromBase64(envelope.data);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  const decoded = new TextDecoder().decode(plaintext);
  return JSON.parse(decoded) as T;
}

export function useEncryptedLocalStorage<T>(namespace: string) {
  const getItem = useCallback(
    async (key: string): Promise<T | null> => {
      if (!isBrowser()) return null;
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const envelope = JSON.parse(raw) as CipherEnvelope;
        if (!envelope?.iv || !envelope?.data) return null;
        return await decryptJson<T>(namespace, envelope);
      } catch {
        return null;
      }
    },
    [namespace],
  );

  const setItem = useCallback(
    async (key: string, value: T) => {
      if (!isBrowser()) return false;
      try {
        const envelope = await encryptJson(namespace, value);
        window.localStorage.setItem(key, JSON.stringify(envelope));
        return true;
      } catch {
        return false;
      }
    },
    [namespace],
  );

  const removeItem = useCallback((key: string) => {
    if (!isBrowser()) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore localStorage failures.
    }
  }, []);

  return { getItem, setItem, removeItem };
}

