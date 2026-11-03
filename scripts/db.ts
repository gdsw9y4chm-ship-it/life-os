import { connectDatabase, databasePath } from '../src/db/connection';
import { migrate } from '../src/db/migrate';
import { seedJade } from '../src/db/seed';

const command = process.argv[2];
if (command !== 'migrate' && command !== 'seed') throw new Error('Usage: bun scripts/db.ts migrate|seed');
const path = databasePath();
const db = connectDatabase(path);
try {
  if (command === 'migrate') migrate(db);
  else seedJade(db);
  console.log(`${command}: OK (${path})`);
} finally {
  db.close();
}
