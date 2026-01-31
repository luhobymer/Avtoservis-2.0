import * as partsDao from './dao/partsDao';

export const listParts = async () => {
  const rows = await partsDao.listAll();
  return rows.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description || '',
    price: Number(p.price) || 0,
    quantity: typeof p.stock === 'number' ? p.stock : 0,
    manufacturer: p.manufacturer || '',
    part_number: p.part_number || ''
  }));
};

export const addPart = async (payload) => {
  const created = await partsDao.create({
    name: payload.name,
    description: payload.description,
    price: payload.price,
    stock: payload.quantity
  });
  return created;
};

export const updatePart = async (id, payload) => {
  const updated = await partsDao.updateById(id, {
    name: payload.name,
    description: payload.description,
    price: payload.price,
    stock: payload.quantity
  });
  return updated;
};

export const deletePart = async (id) => {
  await partsDao.deleteById(id);
  return { success: true };
};

export const getLatestPart = async () => {
  const list = await partsDao.listAll();
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }
  const sorted = [...list].sort((a, b) => Number(b.id) - Number(a.id));
  return sorted[0];
};

