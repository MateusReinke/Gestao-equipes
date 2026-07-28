import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A fronteira entre diretório e operação, verificada.
 *
 * A promessa do módulo é que a sincronização não sobrescreve escala, turno,
 * férias, plantão, cliente nem indicador. Uma promessa dessas não pode
 * depender de disciplina de quem escreve o código depois — este teste
 * transforma a regra em algo que quebra o build quando alguém a cruza.
 *
 * A travessia legítima existe e é única: a reconciliação (Fase D), que é
 * explícita, tem lista fechada de campos e está na lista de exceções abaixo.
 */

const RAIZ = join(__dirname, '..');

/// Quem pode importar o quê fora do módulo. Tudo que não está aqui é proibido.
const EXCECOES: Record<string, string[]> = {
  // Controllers são camada de borda: auditoria é transversal a todo o sistema.
  'directory.controller.ts': ['../../services/audit.service'],
  'link.controller.ts': ['../../services/audit.service'],
  // A ponte: o único arquivo do módulo autorizado a escrever em tabela
  // operacional. Tudo que alcança colaborador passa por aqui, inclusive o que
  // o serviço de vínculo (`link.service.ts`) orquestra.
  'sync/reconcile.service.ts': ['../../../repositories/collaborator.repository'],
};

function arquivosTs(diretorio: string): string[] {
  return readdirSync(diretorio).flatMap((entrada) => {
    const caminho = join(diretorio, entrada);
    if (statSync(caminho).isDirectory()) {
      return entrada === '__tests__' ? [] : arquivosTs(caminho);
    }
    return entrada.endsWith('.ts') ? [caminho] : [];
  });
}

function importsDe(caminho: string): string[] {
  const fonte = readFileSync(caminho, 'utf8');
  return [...fonte.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

const ARQUIVOS = arquivosTs(RAIZ);

describe('o motor de sincronização não alcança o mundo operacional', () => {
  it('nenhum arquivo do módulo importa repositório ou serviço operacional sem exceção declarada', () => {
    const violacoes: string[] = [];

    for (const caminho of ARQUIVOS) {
      const nome = relative(RAIZ, caminho).replace(/\\/g, '/');
      const permitidos = EXCECOES[nome] ?? [];

      for (const importado of importsDe(caminho)) {
        const ehOperacional = /(\.\.\/)+((repositories|services)\/)/.test(importado);
        if (ehOperacional && !permitidos.includes(importado)) {
          violacoes.push(`${nome} → ${importado}`);
        }
      }
    }

    expect(violacoes).toEqual([]);
  });

  it('provedores não tocam no banco — eles falam com a rede', () => {
    const violacoes: string[] = [];

    for (const caminho of ARQUIVOS.filter((c) => c.includes('/providers/'))) {
      const fonte = readFileSync(caminho, 'utf8');
      const nome = relative(RAIZ, caminho).replace(/\\/g, '/');

      for (const importado of importsDe(caminho)) {
        // Cliente Prisma e repositório são acesso a dado — proibidos.
        if (/config\/prisma|repository/i.test(importado)) {
          violacoes.push(`${nome} → ${importado}`);
        }
      }

      // `@prisma/client` é tolerado só como vocabulário de tipos (o enum de
      // provedores vive lá para não divergir do banco). Trazer valor de lá —
      // `PrismaClient`, por exemplo — seria acesso a dado disfarçado.
      const importsDePrisma = [...fonte.matchAll(/^import\s+(type\s+)?[^;]*?from\s+['"]@prisma\/client['"]/gm)];
      for (const [trecho, ehTipo] of importsDePrisma) {
        if (!ehTipo) violacoes.push(`${nome} → ${trecho.trim()} (deveria ser \`import type\`)`);
      }
    }

    // Um provedor que sabe persistir vira dois provedores diferentes na hora
    // de plugar Google ou LDAP. Ele traduz payload, e só.
    expect(violacoes).toEqual([]);
  });

  it('o repositório do módulo só lê de tabela operacional, nunca escreve', () => {
    const fonte = readFileSync(join(RAIZ, 'directory.repository.ts'), 'utf8');

    // Modelos do espelho. Escrever em qualquer coisa fora desta lista é o que
    // o teste existe para pegar — inclusive quando alguém acrescenta um modelo
    // novo e esquece de declarar que ele é do diretório.
    const MODELOS_DO_DIRETORIO = [
      'directoryConnection',
      'directoryPerson',
      'directoryDepartment',
      'directoryJobTitle',
      'directoryGroup',
      'directoryGroupMember',
      'directorySyncRun',
      'directorySyncEvent',
    ];
    const LEITURAS = ['findFirst', 'findMany', 'findUnique', 'count', 'aggregate', 'groupBy'];

    const escritasIndevidas = [...fonte.matchAll(/prisma\.(\w+)\.(\w+)/g)]
      .filter(([, modelo, metodo]) => !MODELOS_DO_DIRETORIO.includes(modelo) && !LEITURAS.includes(metodo))
      .map(([trecho]) => trecho);

    expect(escritasIndevidas).toEqual([]);
  });

  it('a lista de exceções não acumula entrada morta', () => {
    // Exceção que sobra depois de uma refatoração vira permissão esquecida.
    const existentes = new Set(ARQUIVOS.map((c) => relative(RAIZ, c).replace(/\\/g, '/')));
    const orfas = Object.keys(EXCECOES).filter((nome) => !existentes.has(nome));

    // `sync/reconcile.service.ts` só nasce na Fase D; até lá é exceção
    // declarada em antecipação, e o teste a tolera nominalmente.
    expect(orfas.filter((nome) => nome !== 'sync/reconcile.service.ts')).toEqual([]);
  });
});
