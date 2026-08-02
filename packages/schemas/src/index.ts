import { z } from 'zod';

const localPath = z.string().refine((value) => value.startsWith('/') && !value.startsWith('//'), {
  message: 'O redirecionamento precisa ser um caminho interno.'
});

export const signInSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
  next: localPath.optional()
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional().default(''),
  firstTaskTitle: z.string().trim().min(3).max(180),
  steps: z.tuple([
    z.string().trim().min(1).max(180),
    z.string().trim().min(1).max(180),
    z.string().trim().min(1).max(180)
  ])
});

export const confirmQrSchema = z.object({
  token: z.string().trim().min(12).max(128),
  idempotencyKey: z.string().uuid()
});

export const completeStepSchema = z.object({
  idempotencyKey: z.string().uuid()
});

export const evidenceSchema = z.object({
  kind: z.enum(['NOTE', 'PHOTO', 'FILE', 'LINK', 'QR_RECYCLE']),
  title: z.string().trim().min(1).max(180),
  content: z.string().trim().max(5000).optional(),
  storagePath: z.string().trim().max(1000).optional(),
  mimeType: z.string().trim().max(120).optional()
}).refine((value) => Boolean(value.content || value.storagePath), {
  message: 'Informe conteúdo ou arquivo.'
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type ConfirmQrInput = z.infer<typeof confirmQrSchema>;
export type EvidenceInput = z.infer<typeof evidenceSchema>;
