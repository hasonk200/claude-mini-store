import { CLOUD_UID_KEY, LS } from './storage-keys.mjs';
import { $ } from './dom.mjs';

function draftKey(kind, k) {
  let owner = 'local';
  try {
    owner = localStorage.getItem(CLOUD_UID_KEY) || 'local';
  } catch (e) {}
  return LS + '-draft-' + owner + '-' + kind + '-' + k;
}

function clearOwnerDrafts() {
  try {
    const prefix = draftKey('', '').slice(0, -1);
    for (const k of Object.keys(localStorage)) if (k.startsWith(prefix)) localStorage.removeItem(k);
  } catch (e) {}
}

function readDraft(kind, k) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(kind, k)) || 'null');
  } catch (e) {
    return null;
  }
}

function writeDraft(kind, k, value) {
  try {
    localStorage.setItem(draftKey(kind, k), JSON.stringify(value));
  } catch (e) {
    $('#storage-warning').hidden = false;
  }
}

function removeDraft(kind, k) {
  try {
    localStorage.removeItem(draftKey(kind, k));
  } catch (e) {}
}

export { readDraft, removeDraft, writeDraft, clearOwnerDrafts };
