import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { unwrap, notFound } from '../errors.js';
import { idParams } from './_shared.js';

// Moderation queue. Every route requires a verified admin profile.
export function adminRoutes({ admin, auth }) {
  const r = Router();
  r.use('/admin', auth.requireAuth, auth.requireAdmin);

  r.get('/admin/reports', validate({ query: z.object({ status: z.enum(['open', 'actioned', 'dismissed']).default('open') }) }),
    async (req, res) => {
      const items = unwrap(await admin.from('reports').select('*').eq('status', req.valid.query.status)
        .order('created_at', { ascending: false }).limit(100));
      res.json({ items });
    });

  const resolve = z.object({ action: z.enum(['dismiss', 'approve_listing', 'remove_listing', 'hide_message']) });
  r.post('/admin/reports/:id/resolve', validate({ params: idParams, body: resolve }), async (req, res) => {
    const report = unwrap(await admin.from('reports').select('*').eq('id', req.valid.params.id).maybeSingle());
    if (!report) throw notFound();
    const { action } = req.valid.body;
    if (report.target_type === 'listing' && action === 'approve_listing') {
      unwrap(await admin.from('listings').update({ status: 'available' }).eq('id', report.target_id).eq('status', 'pending_review'));
    }
    if (report.target_type === 'listing' && action === 'remove_listing') {
      unwrap(await admin.from('listings').update({ status: 'removed' }).eq('id', report.target_id).in('status', ['available', 'pending_review']));
    }
    if (report.target_type === 'message' && action === 'hide_message') {
      unwrap(await admin.from('messages').update({ flagged: true }).eq('id', report.target_id));
    }
    unwrap(await admin.from('reports').update({ status: action === 'dismiss' ? 'dismissed' : 'actioned', resolved_by: req.user.id })
      .eq('id', report.id));
    res.status(204).end();
  });

  r.post('/admin/orders/:id/resolve-dispute', validate({ params: idParams, body: z.object({ refund: z.boolean() }) }), async (req, res) => {
    res.json({ order: unwrap(await req.db.rpc('admin_resolve_dispute', { p_order: req.valid.params.id, p_refund: req.valid.body.refund })) });
  });

  return r;
}
