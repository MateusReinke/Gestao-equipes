import { Request, Response } from 'express';
import { z } from 'zod';
import { auditFromRequest } from '../../services/audit.service';
import {
  ColaboradorJaVinculadoError,
  ConexaoInativaError,
  ConexaoNaoEncontradaError,
  DiretorioDesabilitadoError,
  PessoaNaoEncontradaError,
  ReconciliacaoInvalidaError,
  SemEmpresaAtivaError,
  definirTravas,
  desvincularPessoa,
  listarPendencias,
  previewDaPessoa,
  promoverPessoa,
  vincularPessoa,
} from './link.service';
import { grupos, organograma, sugestoesDeResponsavel } from './org.service';

function tratarErro(error: unknown, res: Response) {
  if (error instanceof DiretorioDesabilitadoError) return res.status(503).json({ error: error.message });
  if (error instanceof SemEmpresaAtivaError) return res.status(409).json({ error: error.message });
  if (error instanceof ConexaoNaoEncontradaError) return res.status(404).json({ error: error.message });
  if (error instanceof PessoaNaoEncontradaError) return res.status(404).json({ error: error.message });
  // 409 e não 400: o pedido é válido, o estado é que impede — e a mensagem diz
  // quem já ocupa o lugar.
  if (error instanceof ColaboradorJaVinculadoError) return res.status(409).json({ error: error.message });
  if (error instanceof ReconciliacaoInvalidaError) return res.status(400).json({ error: error.message });
  if (error instanceof ConexaoInativaError) return res.status(409).json({ error: error.message });
  throw error;
}

const vinculoSchema = z.object({ colaboradorId: z.coerce.number().int().positive() });
const promocaoSchema = z.object({ equipeId: z.coerce.number().int().positive() });
const travasSchema = z.object({ campos: z.array(z.string().trim().min(1)).max(20) });

export const linkController = {
  async pending(req: Request, res: Response) {
    try {
      return res.json(await listarPendencias(Number(req.params.id), req.user));
    } catch (error) {
      return tratarErro(error, res);
    }
  },

  /// O que mudaria no cadastro se este vínculo fosse aplicado. Existe para que
  /// ninguém precise descobrir depois de gravar.
  async preview(req: Request, res: Response) {
    const colaboradorId = req.query.colaboradorId ? Number(req.query.colaboradorId) : null;
    try {
      return res.json(await previewDaPessoa(Number(req.params.pessoaId), colaboradorId, req.user));
    } catch (error) {
      return tratarErro(error, res);
    }
  },

  async link(req: Request, res: Response) {
    const parsed = vinculoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }

    try {
      const resultado = await vincularPessoa(Number(req.params.pessoaId), parsed.data.colaboradorId, req.user);

      // Auditado como mudança de permissão porque é o que de fato acontece: a
      // partir daqui, um sistema externo passa a escrever neste cadastro.
      await auditFromRequest(req, {
        acao: 'permission_change',
        entidade: 'diretorio_vinculo',
        entidadeId: req.params.pessoaId,
        descricao: `Vinculou "${resultado.pessoa.nomeExibicao}" do diretório ao colaborador "${resultado.colaborador.nome}"`,
        depois: { externalId: resultado.pessoa.externalId, colaboradorId: resultado.colaborador.id, aplicado: resultado.aplicado },
      });

      return res.json(resultado);
    } catch (error) {
      return tratarErro(error, res);
    }
  },

  async promote(req: Request, res: Response) {
    const parsed = promocaoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }

    try {
      const resultado = await promoverPessoa(Number(req.params.pessoaId), parsed.data.equipeId, req.user);

      await auditFromRequest(req, {
        acao: 'create',
        entidade: 'colaborador',
        entidadeId: resultado.colaborador.id,
        descricao: `Criou o colaborador "${resultado.colaborador.nome}" a partir do diretório`,
        depois: resultado.colaborador,
      });

      return res.status(201).json(resultado);
    } catch (error) {
      return tratarErro(error, res);
    }
  },

  async unlink(req: Request, res: Response) {
    try {
      const resultado = await desvincularPessoa(Number(req.params.pessoaId), req.user);

      await auditFromRequest(req, {
        acao: 'permission_change',
        entidade: 'diretorio_vinculo',
        entidadeId: req.params.pessoaId,
        descricao: `Desvinculou "${resultado.pessoa.nomeExibicao}" do diretório — o cadastro deixa de ser atualizado pela sincronização`,
        antes: { externalId: resultado.pessoa.externalId, colaboradorId: resultado.colaboradorId },
      });

      return res.json(resultado);
    } catch (error) {
      return tratarErro(error, res);
    }
  },

  async locks(req: Request, res: Response) {
    const parsed = travasSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }

    try {
      const resultado = await definirTravas(Number(req.params.pessoaId), parsed.data.campos, req.user);

      await auditFromRequest(req, {
        acao: 'update',
        entidade: 'diretorio_vinculo',
        entidadeId: req.params.pessoaId,
        descricao:
          resultado.camposBloqueados.length === 0
            ? `Liberou todos os campos de "${resultado.pessoa.nomeExibicao}" para a sincronização`
            : `Travou contra a sincronização: ${resultado.camposBloqueados.join(', ')}`,
        depois: { camposBloqueados: resultado.camposBloqueados },
      });

      return res.json(resultado);
    } catch (error) {
      return tratarErro(error, res);
    }
  },
};

/// Leituras derivadas do diretório: organograma, grupos e a sugestão de
/// responsáveis. Nenhuma escreve nada.
export const orgController = {
  async chart(req: Request, res: Response) {
    try {
      return res.json(await organograma(Number(req.params.id), req.user));
    } catch (error) {
      return tratarErro(error, res);
    }
  },

  async groups(req: Request, res: Response) {
    try {
      return res.json(await grupos(Number(req.params.id), req.user));
    } catch (error) {
      return tratarErro(error, res);
    }
  },

  async suggestions(req: Request, res: Response) {
    try {
      return res.json(await sugestoesDeResponsavel(Number(req.params.id), req.user));
    } catch (error) {
      return tratarErro(error, res);
    }
  },
};
