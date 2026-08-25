import UI from './ui-upstream.js';
import * as WebUtil from './webutil.js';
import { startMobilePanel } from './mobile-panel.js';

const upstreamStart = UI.start.bind(UI);
UI.start = (...args) => upstreamStart(...args).then((result) => {
  startMobilePanel(UI, WebUtil);
  return result;
});

export default UI;
