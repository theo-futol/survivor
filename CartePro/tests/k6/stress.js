import { setupQrContext, visitorFlow } from './scenario.js';
import { options as stressOptions } from './config.js';

/**
 * Stress test: push well past the expected load to find where the API starts
 * degrading. See `average-load.js` for the "normal day" profile.
 */
export const options = stressOptions;

export { setupQrContext as setup };

export default function (data)
{
  visitorFlow(data);
}
