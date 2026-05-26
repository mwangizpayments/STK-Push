import { createBranch } from '../services/branchRepository.js';
import { requireString } from '../utils/validators.js';

export async function postBranch(req, res) {
  const branch = await createBranch({
    active: req.body.active ?? true,
    name: requireString(req.body.name, 'name'),
    shortcode: req.body.shortcode || '',
    tillNumber: req.body.till_number || req.body.tillNumber || req.body.code || ''
  });

  res.status(201).json({ branch });
}
