// Only nodes traversed by us are trusted as deeply frozen. A caller's shallow
// Object.freeze must never hide mutable children from the document or its history.
const sealed = new WeakSet<object>();

export function sealTree<T>(value: T, visiting = new Set<object>()): T {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  )
    return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object') throw new Error('invalid_document_value');
  if (sealed.has(value)) return value;
  if (visiting.has(value)) throw new Error('cyclic_document_value');
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
    throw new Error('invalid_document_prototype');
  visiting.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') throw new Error('symbol_document_key');
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor) || (!descriptor.enumerable && !(array && key === 'length')))
      throw new Error('non_data_document_property');
    sealTree(descriptor.value as unknown, visiting);
  }
  visiting.delete(value);
  Object.freeze(value);
  sealed.add(value);
  return value;
}
