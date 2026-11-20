import { config } from './config';
import { createApp } from './app';

createApp().listen(config.port, () => {
  console.log(`EUC Room Studio on http://localhost:${config.port}`);
});
