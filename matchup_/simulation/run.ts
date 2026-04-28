import { Simulator, aggressiveStrategy, randomStrategy } from './simulate.js';

// 1. Silent simulation (fast)
/*const sim1 = new Simulator({
  homeFormation: '4-3-3',
  awayFormation: '5-3-2',
  homeStrategy: aggressiveStrategy,
  awayStrategy: aggressiveStrategy, // Random gets destroyed by aggressive
});
const result1 = sim1.run();
sim1.printReport(result1);
*/
// 2. Watch it happen in the terminal (slower)
const sim2 = new Simulator({
  homeFormation: '4-3-3',
  awayFormation: '5-3-2',
  homeStrategy: aggressiveStrategy,
  awayStrategy: randomStrategy, // Random gets destroyed by aggressive
  verbose: true // Prints the ASCII pitch every turn
});
const result2 = sim2.run();
sim2.printReport(result2);