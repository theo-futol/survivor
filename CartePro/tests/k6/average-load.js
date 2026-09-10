import { setupQrContext, visitorFlow } from './scenario.js';
import { averageLoadOptions } from './config.js';

/**
 * Average-load test: hold the traffic a normal day is expected to bring, long
 * enough for the system to settle (connection pools, caches, GC). It answers
 * "is the API healthy under typical usage?", not "where does it break?" —
 * that's `stress.js`.
 */
export const options = averageLoadOptions;

export { setupQrContext as setup };

export default function (data)
{
  visitorFlow(data);
}
