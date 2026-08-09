'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

function defaultState() {
  return {
    schemaVersion: 1,
    consentedAt: null,
    lastProjectPath: null,
    role: 'unrestricted',
    todayGoal: '',
    lastDecision: null
  };
}

class StateStore {
  constructor(dataDirectory) {
    this.dataDirectory = dataDirectory;
    this.file = path.join(dataDirectory, 'state.json');
    this.memory = defaultState();
    this.warning = null;
  }

  async load() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (parsed.schemaVersion !== 1) throw new Error('unsupported schema');
      this.memory = { ...defaultState(), ...parsed };
    } catch (error) {
      if (error.code !== 'ENOENT') this.warning = '本地状态损坏或版本不兼容，本次以空状态启动；未覆盖原文件。';
    }
    return this.snapshot();
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.memory));
  }

  async save(next) {
    this.memory = { ...defaultState(), ...next, schemaVersion: 1 };
    await fs.mkdir(this.dataDirectory, { recursive: true });
    const temporary = path.join(this.dataDirectory, `state.${process.pid}.${Date.now()}.tmp`);
    await fs.writeFile(temporary, `${JSON.stringify(this.memory, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temporary, this.file);
    return this.snapshot();
  }

  setMemoryDecision(decision, context) {
    this.memory = { ...this.memory, ...context, lastDecision: decision };
    return this.snapshot();
  }

  async clearDecision() {
    const next = { ...this.memory, lastDecision: null };
    if (next.consentedAt) return this.save(next);
    this.memory = next;
    return this.snapshot();
  }

  async clearAll() {
    try {
      await fs.unlink(this.file);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    this.memory = defaultState();
    this.warning = null;
    return this.snapshot();
  }
}

module.exports = { StateStore, defaultState };
