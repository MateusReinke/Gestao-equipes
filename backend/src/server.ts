import { app } from './app';
import { env } from './config/env';
import { iniciarAgendador, pararAgendador } from './modules/directory/sync/sync.scheduler';

const server = app.listen(env.appPort, () => {
  // eslint-disable-next-line no-console
  console.log(`API online em http://localhost:${env.appPort}`);
});

// O agendador do diretório vive no processo da API. Com ENABLE_ENTRA_SYNC
// desligado ele não faz nada — quem não usa diretório não paga por uma
// consulta a cada minuto.
iniciarAgendador();

/// Encerramento ordenado: para de aceitar conexão nova e desliga o agendador.
/// Sem isto, um deploy poderia derrubar o processo no meio de uma carga — e a
/// trava da conexão ficaria presa até o prazo de abandono.
for (const sinal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sinal, () => {
    pararAgendador();
    server.close(() => process.exit(0));
  });
}
