import { Router } from 'express';
import { requireRole, userOf } from '../../http/auth';
import type { Quota } from '../../http/quota';
import type { UsageService } from '../usage/usage.service';
import { parseAssistRequest } from './assist.schema';
import type { AssistService } from './assist.service';
import { parseRecommendRequest } from './recommend';

export function assistRoutes({ assist, quota, usage }: { assist: AssistService; quota: Quota; usage: UsageService }): Router {
  const router = Router();
  router.use(['/assist', '/recommend'], requireRole('admin', 'designer'));

  /** AI help for a prompt bar. */
  router.post('/assist', async (req, res) => {
    const input = parseAssistRequest(req.body);
    quota.take(req, 1);
    res.json(await usage.track({ userId: userOf(req).id, action: 'assist', images: 0, provider: assist.provider }, () => assist.suggest(input)));
  });

  /** Furniture recommendations for a style (Generate). */
  router.post('/recommend', async (req, res) => {
    const input = parseRecommendRequest(req.body);
    quota.take(req, 1);
    res.json(await usage.track({ userId: userOf(req).id, action: 'recommend', images: 0, provider: assist.provider }, () => assist.recommend(input)));
  });

  return router;
}
