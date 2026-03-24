/**
 * db.js — Operaciones Firestore.
 * Estructura:
 *   /users/{uid}                    → ajustes (categories, goals, notif, palette, timer…)
 *   /users/{uid}/entries/{entryId}  → entradas individuales
 */
import { db } from './firebase.js';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, getDocs, writeBatch,
} from 'firebase/firestore';

// ── Ajustes del usuario ──────────────────────────────────────────────────────

/** Carga el documento de ajustes del usuario. Devuelve null si no existe. */
export async function loadUserSettings(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

/** Sobreescribe (merge) los ajustes del usuario. */
export async function saveUserSettings(uid, settings) {
  await setDoc(doc(db, 'users', uid), settings, { merge: true });
}

// ── Entradas (subcollection) ─────────────────────────────────────────────────

/** Carga todas las entradas del usuario. */
export async function loadEntries(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'entries'));
  return snap.docs.map(d => d.data());
}

/** Guarda o actualiza una entrada. Usa entry.id como ID del documento. */
export async function saveEntry(uid, entry) {
  await setDoc(
    doc(db, 'users', uid, 'entries', String(entry.id)),
    entry
  );
}

/** Elimina una entrada por su id. */
export async function deleteEntry(uid, entryId) {
  await deleteDoc(doc(db, 'users', uid, 'entries', String(entryId)));
}

/**
 * Guarda un array completo de entradas en batch.
 * Útil para la migración desde localStorage.
 * Firestore tiene límite de 500 ops por batch — divide si hace falta.
 */
export async function saveAllEntries(uid, entries) {
  const BATCH_SIZE = 400;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    entries.slice(i, i + BATCH_SIZE).forEach(entry => {
      batch.set(
        doc(db, 'users', uid, 'entries', String(entry.id)),
        entry
      );
    });
    await batch.commit();
  }
}
