import { describe, expect, it } from 'vitest';
import { CAMPOS_DE_USUARIO, mapearUsuario } from '../providers/entra/entra.mapper';

/// Payload no formato que o Graph devolve de verdade — inclusive as
/// inconsistências: `mail` nulo em conta sem licença, `businessPhones` como
/// lista, campos ausentes em conta de serviço.
const USUARIO = {
  id: '8f4a1c22-1111-2222-3333-444455556666',
  displayName: 'Ana Lima',
  givenName: 'Ana',
  surname: 'Lima',
  mail: 'ana.lima@contoso.com.br',
  userPrincipalName: 'ana.lima@contoso.onmicrosoft.com',
  jobTitle: 'Analista de NOC',
  department: 'Tecnologia',
  companyName: 'Contoso Brasil',
  officeLocation: 'São Paulo - Torre A',
  businessPhones: ['+55 11 4547-9706', '+55 11 4547-9707'],
  mobilePhone: '+55 11 99999-0000',
  country: 'Brazil',
  city: 'São Paulo',
  state: 'SP',
  preferredLanguage: 'pt-BR',
  accountEnabled: true,
};

describe('mapeamento do usuário do Graph', () => {
  it('traduz o payload completo para a forma canônica', () => {
    const pessoa = mapearUsuario(USUARIO)!;

    expect(pessoa).toMatchObject({
      externalId: '8f4a1c22-1111-2222-3333-444455556666',
      nomeExibicao: 'Ana Lima',
      primeiroNome: 'Ana',
      sobrenome: 'Lima',
      cargo: 'Analista de NOC',
      departamento: 'Tecnologia',
      escritorio: 'São Paulo - Torre A',
      contaHabilitada: true,
      removido: false,
    });
  });

  it('prefere o e-mail de caixa postal ao login', () => {
    // `userPrincipalName` costuma terminar em .onmicrosoft.com, que ninguém
    // usa para escrever para a pessoa.
    expect(mapearUsuario(USUARIO)!.email).toBe('ana.lima@contoso.com.br');
    expect(mapearUsuario(USUARIO)!.loginPrincipal).toBe('ana.lima@contoso.onmicrosoft.com');
  });

  it('cai no login quando a conta não tem caixa postal', () => {
    const pessoa = mapearUsuario({ ...USUARIO, mail: null })!;
    // Melhor um endereço técnico do que nenhum.
    expect(pessoa.email).toBe('ana.lima@contoso.onmicrosoft.com');
  });

  it('pega o primeiro telefone comercial da lista', () => {
    expect(mapearUsuario(USUARIO)!.telefone).toBe('+55 11 4547-9706');
  });

  it('trata string vazia e só-espaço como ausente', () => {
    // Se virassem string vazia no banco, apareceria um departamento em branco
    // no catálogo derivado.
    const pessoa = mapearUsuario({ ...USUARIO, department: '   ', jobTitle: '' })!;
    expect(pessoa.departamento).toBeNull();
    expect(pessoa.cargo).toBeNull();
  });

  it('conta de serviço sem nome de exibição cai no login', () => {
    const pessoa = mapearUsuario({ id: 'svc-1', userPrincipalName: 'svc-backup@contoso.com' })!;
    expect(pessoa.nomeExibicao).toBe('svc-backup@contoso.com');
  });

  it('sem nome nem login, usa o próprio Object ID como rótulo', () => {
    expect(mapearUsuario({ id: 'svc-2' })!.nomeExibicao).toBe('svc-2');
  });

  it('descarta objeto sem Object ID', () => {
    // Sem ele não há chave de vínculo, e cair no e-mail é exatamente o que a
    // especificação proíbe.
    expect(mapearUsuario({ displayName: 'Sem id', mail: 'x@contoso.com' })).toBeNull();
  });

  it('accountEnabled ausente é tratado como habilitada', () => {
    // O campo só falta quando o $select não o trouxe. Assumir "desabilitada"
    // desativaria gente por engano se a flag de auto-desativar estiver ligada.
    expect(mapearUsuario({ id: 'x' })!.contaHabilitada).toBe(true);
    expect(mapearUsuario({ id: 'x', accountEnabled: false })!.contaHabilitada).toBe(false);
  });

  it('reconhece o marcador de objeto excluído das consultas delta', () => {
    const pessoa = mapearUsuario({ id: 'x', '@removed': { reason: 'changed' } })!;
    expect(pessoa.removido).toBe(true);
  });

  it('deixa o fuso horário nulo — o Graph não o expõe em /users', () => {
    // Ele vive em mailboxSettings e exige outra permissão. Quem preenche é o
    // padrão da conexão, na reconciliação.
    expect(mapearUsuario(USUARIO)!.fusoHorario).toBeNull();
  });

  it('guarda o payload cru para diagnóstico', () => {
    expect(mapearUsuario(USUARIO)!.bruto).toEqual(USUARIO);
  });
});

describe('campos pedidos ao Graph', () => {
  it('pede exatamente o que o mapper lê', () => {
    // A lista é o registro auditável do que este módulo lê do diretório de
    // alguém: pedir a mais seria coletar sem uso.
    const campos = CAMPOS_DE_USUARIO.split(',');
    expect(campos).toContain('id');
    expect(campos).toContain('accountEnabled');
    expect(campos).not.toContain('mailboxSettings');
    // Nada de foto nem de gestor por aqui: são de fases posteriores e cada um
    // tem custo próprio de requisição.
    expect(CAMPOS_DE_USUARIO).not.toContain('photo');
    expect(CAMPOS_DE_USUARIO).not.toContain('manager');
  });
});
