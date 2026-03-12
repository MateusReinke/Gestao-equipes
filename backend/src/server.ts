import { app } from './app';
import { env } from './config/env';

app.listen(env.appPort, () => {
  // eslint-disable-next-line no-console
  console.log(`API online em http://localhost:${env.appPort}`);
});
