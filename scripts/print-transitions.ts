// Prints the state machine's allowed (from, to) pairs as SQL VALUES rows.
// Used to (re)generate the transition table in drizzle/0001_rules.sql.
import { ALLOWED_PAIRS } from "../lib/cases/state-machine";

console.log(ALLOWED_PAIRS.map(([a, b]) => `  ('${a}', '${b}')`).join(",\n") + ";");
console.error(`${ALLOWED_PAIRS.length} pairs`);
