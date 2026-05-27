import { createBranch, deleteBranch, listBranches, updateBranch } from '../services/branchRepository.js';
import { createCashier } from '../services/userRepository.js';
import { requireString } from '../utils/validators.js';

export async function getBranches(_req, res) {
  const branches = await listBranches();
  res.json({ branches });
}

export async function postBranch(req, res) {
  const branch = await createBranch({
    active: req.body.active ?? true,
    darajaPasskey: req.body.passkey || req.body.daraja_passkey || '',
    name: requireString(req.body.name, 'name'),
    shortcode: req.body.shortcode || '',
    tillNumber: req.body.till_number || req.body.tillNumber || req.body.code || ''
  });

  const cashier = await createCashier({
    branchId: branch.id,
    email: requireString(req.body.email, 'email').toLowerCase(),
    password: requireString(req.body.password, 'password')
  });

  res.status(201).json({ branch, cashier });
}

export async function putBranch(req, res) {
  const branch = await updateBranch(req.params.id, {
    active: req.body.active,
    darajaPasskey: req.body.passkey || req.body.daraja_passkey || '',
    name: req.body.name,
    shortcode: req.body.shortcode,
    tillNumber: req.body.till_number || req.body.tillNumber
  });

  if (!branch) {
    res.status(404).json({ message: 'Branch not found' });
    return;
  }

  res.json({ branch });
}

export async function removeBranch(req, res) {
  const branch = await deleteBranch(req.params.id);

  if (!branch) {
    res.status(404).json({ message: 'Branch not found' });
    return;
  }

  res.json({ branch });
}
