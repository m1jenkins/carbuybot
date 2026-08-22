const fs = require('node:fs');
const path = require('node:path');

function createMemoryStore(initial = { engagements: {}, processedEvents: [] }) {
  const state = {
    engagements: { ...(initial.engagements || {}) },
    processedEvents: [...(initial.processedEvents || [])],
  };

  return {
    createEngagement(record) {
      state.engagements[record.id] = { ...record };
      return state.engagements[record.id];
    },
    getEngagement(id) {
      return state.engagements[id] || null;
    },
    upsertEngagement(id, patch) {
      state.engagements[id] = { ...(state.engagements[id] || { id }), ...patch, id };
      return state.engagements[id];
    },
    recordPaidEngagement(record) {
      state.engagements[record.id] = {
        ...(state.engagements[record.id] || {}),
        ...record,
        status: 'paid',
        paidAt: record.paidAt || new Date().toISOString(),
      };
      return state.engagements[record.id];
    },
    paidCount() {
      return Object.values(state.engagements).filter((e) => e.status === 'paid').length;
    },
    hasEvent(eventId) {
      return state.processedEvents.includes(eventId);
    },
    markEvent(eventId) {
      if (state.processedEvents.includes(eventId)) return false;
      state.processedEvents.push(eventId);
      return true;
    },
    toJSON() {
      return {
        engagements: { ...state.engagements },
        processedEvents: [...state.processedEvents],
      };
    },
  };
}

function createFileStore(filePath) {
  const dir = path.dirname(filePath);

  function load() {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return { engagements: {}, processedEvents: [] };
    }
  }

  const memory = createMemoryStore(load());

  function persist() {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(memory.toJSON(), null, 2));
  }

  return {
    createEngagement(record) {
      const created = memory.createEngagement(record);
      persist();
      return created;
    },
    getEngagement(id) {
      return memory.getEngagement(id);
    },
    upsertEngagement(id, patch) {
      const next = memory.upsertEngagement(id, patch);
      persist();
      return next;
    },
    recordPaidEngagement(record) {
      const next = memory.recordPaidEngagement(record);
      persist();
      return next;
    },
    paidCount() {
      return memory.paidCount();
    },
    hasEvent(eventId) {
      return memory.hasEvent(eventId);
    },
    markEvent(eventId) {
      const added = memory.markEvent(eventId);
      if (added) persist();
      return added;
    },
  };
}

module.exports = { createMemoryStore, createFileStore };
