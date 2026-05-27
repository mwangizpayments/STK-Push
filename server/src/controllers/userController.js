import { createCashier, listCashiers } from '../services/userRepository.js';
import { requireString } from '../utils/validators.js';

export async function getCashiers(_req, res) {
  const cashiers = await listCashiers();
  res.json({ cashiers });
}

export async function postCashier(req, res) {
  const cashier = await createCashier({
    branchId: requireString(req.body.branch_id, 'branch_id'),
    email: requireString(req.body.email, 'email').toLowerCase(),
    password: requireString(req.body.password, 'password')
  });

  res.status(201).json({ cashier });
}

