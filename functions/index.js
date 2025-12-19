const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.onRunFinished = functions.firestore
  .document("runs/{runId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (!before || !after) return null;
    if (before.status === after.status) return null;
    if (after.status !== "finished") return null;

    const startAt = after.startAt;
    const endAt = after.endAt;
    if (!startAt || !endAt) return null;

    const startMs = startAt.toMillis();
    const endMs = endAt.toMillis();
    const durationMs = endMs - startMs;

    // 基本防作弊
    if (!(durationMs > 0) || durationMs > 60 * 60 * 1000) return null;

    // 寫回 run（client 不能寫這個）
    await change.after.ref.set({ durationMs }, { merge: true });

    const uid = after.uid;
    const name = (after.name || "Player").slice(0, 12);
    const timeSec = Math.round((durationMs / 1000) * 100) / 100;

    // 1) Leaderboard
    await admin.firestore().collection("scores").add({
      uid,
      name,
      time: timeSec,
      runId: context.params.runId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2) User stats
    const statsRef = admin.firestore().doc(`userStats/${uid}`);
    await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(statsRef);
      const cur = snap.exists ? snap.data() : { gamesPlayed: 0, totalTime: 0, bestTime: 0 };

      tx.set(statsRef, {
        gamesPlayed: (cur.gamesPlayed || 0) + 1,
        totalTime: (cur.totalTime || 0) + timeSec,
        bestTime: Math.max((cur.bestTime || 0), timeSec),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    return null;
  });