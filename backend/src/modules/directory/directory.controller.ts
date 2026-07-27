import { Request, Response } from 'express';
import { z } from 'zod';
import { auditFromRequest } from '../../services/audit.service';
import {
  ChaveDeCifragemAusenteError,
  ConexaoComVinculosError,
  ConexaoDuplicadaError,
  ConexaoNaoEncontradaError,
  DiretorioDesabilitadoError,
  EquipePadraoInvalidaError,
  ProvedorNaoSuportadoError,
  SegredoObrigatorioError,
  SemEmpresaAtivaError,
  atualizarConexao,
  conexaoSchema,
  conexaoUpdateSchema,
  criarConexao,
  listarConexoes,
  removerConexao,
  testarConexao,
} from './directory.service';

function tratarErro(error: unknown, res: Response) {
  // 503: o servidor está bem, o recurso é que não está habilitado aqui.
  if (error instanceof DiretorioDesabilitadoError) return res.status(503).json({ error: error.message });
  // Idem: sem a chave mestra não há como guardar segredo, e isso é ambiente.
  if (error instanceof ChaveDeCifragemAusenteError) return res.status(503).json({ error: error.message });
  if (error instanceof SemEmpresaAtivaError) return res.status(409).json({ error: error.message });
  if (error instanceof ConexaoNaoEncontradaError) return res.status(404).json({ error: error.message });
  if (error instanceof ConexaoDuplicadaError) return res.status(409).json({ error: error.message });
  if (error instanceof ConexaoComVinculosError) {
    return res.status(409).json({ error: error.message, detalhes: error.detalhes });
  }
  if (error instanceof EquipePadraoInvalidaError) return res.status(400).json({ error: error.message });
  if (error instanceof SegredoObrigatorioError) return res.status(400).json({ error: error.message });
  if (error instanceof ProvedorNaoSuportadoError) return res.status(400).json({ error: error.message });
  throw error;
}

/// Corpo do teste. Todos os campos são opcionais porque a tela testa nas duas
/// situações: rascunho ainda não salvo (manda tudo) e conexão existente
/// (manda nada, ou só o segredo novo que acabou de digitar).
const testeSchema = z.object({
  provider: z.enum(['entra', 'google', 'okta', 'ldap']).optional(),
  provedorTenantId: z.string().trim().optional(),
  clientId: z.string().trim().optional(),
  clientSecret: z.string().trim().optional(),
  authorityUrl: z.string().trim().url().nullable().optional(),
});

export const directoryController = {
  async list(req: Request, res: Response) {
    try {
      return res.json(await listarConexoes(req.user));
    } catch (error) {
      return tratarErro(error, res);
    }
  },

  async create(req: Request, res: Response) {
    const parsed = conexaoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }

    try {
      const conexao = await criarConexao(parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'create',
        entidade: 'diretorio_conexao',
        entidadeId: conexao.id,
        descricao: `Configurou a conexão de diretório "${conexao.nome}"`,
        // `apresentarConexao` já removeu o segredo — o que entra na auditoria
        // é a configuração, nunca a credencial.
        depois: conexao,
      });
      return res.status(201).json(conexao);
    } catch (error) {
      return tratarErro(error, res);
    }
  },

  async update(req: Request, res: Response) {
    const parsed = conexaoUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }

    try {
      const conexao = await atualizarConexao(Number(req.params.id), parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'update',
        entidade: 'diretorio_conexao',
        entidadeId: req.params.id,
        descricao: parsed.data.clientSecret
          ? `Editou a conexão de diretório "${conexao.nome}" (segredo substituído)`
          : `Editou a conexão de diretório "${conexao.nome}"`,
        depois: conexao,
      });
      return res.json(conexao);
    } catch (error) {
      return tratarErro(error, res);
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const conexao = await removerConexao(Number(req.params.id), req.user);
      await auditFromRequest(req, {
        acao: 'delete',
        entidade: 'diretorio_conexao',
        entidadeId: req.params.id,
        descricao: `Removeu a conexão de diretório "${conexao.nome}"`,
        antes: conexao,
      });
      return res.status(204).send();
    } catch (error) {
      return tratarErro(error, res);
    }
  },

  async test(req: Request, res: Response) {
    const parsed = testeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }

    const { clientSecret, ...dados } = parsed.data;
    const id = req.params.id ? Number(req.params.id) : null;

    try {
      const resultado = await testarConexao(id, clientSecret, dados, req.user);
      return res.json(resultado);
    } catch (error) {
      return tratarErro(error, res);
    }
  },
};
