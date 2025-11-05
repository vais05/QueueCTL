import { getConfig, setConfig, getAllConfig } from './db.js';

export function getConfigValue(key) {
  return getConfig(key);
}

export function setConfigValue(key, value) {
  return setConfig(key, value);
}

export function getAllConfigValues() {
  return getAllConfig();
}

