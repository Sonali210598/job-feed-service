try {
  rs.status();
  print("Replica set already configured");
} catch (error) {
  print("Initializing single-node replica set");
  rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] });
}
let ready = false;
for (let i = 0; i < 60; i++) {
  try { if (db.hello().isWritablePrimary) { ready = true; break; } } catch (error) {}
  sleep(1000);
}
if (!ready) throw new Error("MongoDB did not become PRIMARY");
print("Replica set PRIMARY ready");
