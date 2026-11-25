import { Router } from 'express';
import type { Variation } from '@shared/types';
import { requireRole, userOf } from '../../http/auth';
import type { Quota } from '../../http/quota';
import type { UsageService } from '../usage/usage.service';
import { parseEditRequest, parseFinalRequest, parseGenerateRequest, parseRedesignRequest } from './studio.schema';
import type { StudioService } from './studio.service';

// HTTP only: check the body, check the person's daily allowance, call the
// service and log the call. Errors go to the app's error handler. A bad request
// is refused before it uses any allowance. Viewers cannot use the AI.

const made = (images: Variation[]) => images.filter((v) => v.image).length;

export function studioRoutes({ studio, quota, usage }: { studio: StudioService; quota: Quota; usage: UsageService }): Router {
  const router = Router();
  router.use(['/edit', '/redesign', '/final', '/generate'], requireRole('admin', 'designer'));

  /** Checks both allowances (per address per hour, per person per day), then runs and logs the call. */
  function charge<T>(req: Parameters<Quota['take']>[0], action: Parameters<UsageService['log']>[0]['action'], count: number, work: () => Promise<T>, imagesOk?: (r: T) => number) {
    const user = userOf(req);
    usage.reserve(user, count);
    quota.take(req, count);
    return usage.track({ userId: user.id, action, images: count, provider: studio.provider }, work, imagesOk);
  }

  router.post('/edit', async (req, res) => {
    const input = parseEditRequest(req.body);
    res.json(await charge(req, input.action === 'remove' ? 'remove' : 'edit', 1, () => studio.edit(input)));
  });

  router.post('/redesign', async (req, res) => {
    const input = parseRedesignRequest(req.body);
    res.json(await charge(req, 'redesign', input.variants.length, () => studio.redesign(input), (r) => made(r.variations)));
  });

  router.post('/generate', async (req, res) => {
    const input = parseGenerateRequest(req.body);
    res.json(await charge(req, 'generate', input.concepts.length, () => studio.generate(input), (r) => made(r.concepts)));
  });

  router.post('/final', async (req, res) => {
    const input = parseFinalRequest(req.body);
    res.json(await charge(req, 'final', 1, () => studio.final(input)));
  });

  return router;
}
